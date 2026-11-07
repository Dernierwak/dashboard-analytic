"""La synchronisation Instagram : posts à relire, images et écriture.

Les appels vivent dans `posts.py`, `account.py` et `post_metrics.py` ; ce
fichier décide quoi relire et envoie à Supabase (`saas/data/supabase/source_data/meta.py`).
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from saas.data.fetch_data.shared.date_ranges import Fenetre
from saas.data.supabase._queries import _all_pages
from saas.data.supabase.source_data.account import (
    ColonneRattrapageAbsente, etat_du_rattrapage, noter_rattrapage,
)
from saas.data.supabase.source_data.couverture import avancer_couverture, debut_des_posts_complets
from saas.data.supabase.source_data.meta import (
    COLONNES_SI_CONNUES, insert_instagram_org, insert_instagram_releves, insert_instagram_total_posts_id,
    televerser_image_instagram,
)
from saas.data.fetch_data.sources.meta.graph_client import AccesMeta
from saas.data.fetch_data.sources.meta.instagram.fetchers import account as compte
from saas.data.fetch_data.sources.meta.instagram.fetchers import boost
from saas.data.fetch_data.sources.meta.instagram.fetchers import post_metrics as metriques
from saas.data.fetch_data.sources.meta.instagram.fetchers import posts

# ── QUELS POSTS ON RELIT — la cadence de la spec ─────────────────────────────
#
# Spec § La récolte — Ce qui s'ajoute, « La relecture » : chaque jour de J+0 à
# J+7 (le passage léger, `releve_quotidien`), à chaque Jour de travail les
# posts de moins de 30 jours (`posts_a_relire`, ici), tous les 3 mois tous les
# posts en base (`relire_tous`, déclenché par `cockpit/instagram_reread.py`).
# Le plafond de 200 posts, la reprise à 40 et le plancher de 6 sont partis
# (spec, « La profondeur de l'historique ») : le trimestriel relit ce que la
# fenêtre de 30 jours laisse de côté, le plancher n'a plus de raison d'être.
#
# 30 jours, et il faut être honnête sur ce chiffre : contrairement aux fenêtres
# d'attribution de Meta Ads et Google Ads, AUCUNE doc ne dit au bout de combien
# de temps les métriques d'un post organique se stabilisent — elles sont
# cumulées à vie et ne se stabilisent jamais tout à fait. C'est un arbitrage
# de coût, repris tel quel par la spec.
# Le quota n'entre pas en jeu : Meta autorise « 4800 * Number of Impressions »
# appels par 24 h sur la plateforme Instagram.
# https://developers.facebook.com/docs/graph-api/overview/rate-limiting/
_JOURS_RAFRAICHIS = 30
# Spec § Le compte gratuit (David, 2026-11-06, `.scratch/instagram/issues/18`) :
# « les 10 plus récents à l'arrivée », puis il grandit — c'est l'offre, pas une
# mesure.
_POSTS_A_L_ARRIVEE_GRATUIT = 10


def _dans_le_stockage(url: str | None) -> bool:
    """L'image est-elle déjà chez nous ?

    Une URL de CDN Instagram expire au bout de quelques jours — c'est la raison
    d'être de `televerser_image_instagram` (`saas/data/supabase/source_data/meta.py`). Une URL de stockage Supabase, elle,
    est définitive. La distinction sert à ne pas refaire le trajet
    téléchargement + envoi pour un fichier qu'on possède déjà, ce qui est de
    loin le poste le plus cher de la récolte Instagram.
    """
    return bool(url) and "/storage/v1/object/public/post-images/" in url



def _rien(_etape: str) -> None:
    return None


def _en_base(sb, uid: str, ids: list[str] | None = None) -> dict[str, dict]:
    """`{post_id: {media_url, booste_vu_le}}` des posts déjà en base (tous, ou `ids`).

    `booste_vu_le` se lit ici, dans la lecture de l'image : l'upsert réécrit
    chaque colonne envoyée, donc la date ne s'envoie que si elle manque — c'est
    ce qui la garde « pour toujours » (ticket 02). Tant que la section 23 n'est
    pas jouée, la colonne n'existe pas (42703) : on relit sans elle.
    """
    for colonnes in ("post_id, media_url, booste_vu_le", "post_id, media_url"):
        def requete(colonnes=colonnes):
            return sb.table("instagram_organic_posts").select(colonnes).eq("user_id", uid)
        try:
            if ids is not None:
                lignes = requete().in_("post_id", ids).execute().data or []
            else:
                # Tous les posts du compte : sans plafond de 200, un payant en a
                # 1 839 (le Rattrapage) et PostgREST tronque à 1 000 en silence
                # (`CLAUDE.md` §8) — 839 posts seraient repris comme neufs.
                lignes = _all_pages(lambda: requete().order("post_id"))
            return {str(r["post_id"]): r for r in lignes}
        except Exception as e:
            if "booste_vu_le" not in colonnes or not _colonne_boost_absente(e):
                raise
            print("    posts Instagram : colonne booste_vu_le absente — lance "
                  "saas/data/supabase/migrations/000_run_me_all.sql.")
    return {}


def _colonne_boost_absente(err: Exception) -> bool:
    """PostgreSQL répond 42703 à un `select` d'une colonne inconnue."""
    msg = str(err).lower()
    return "booste_vu_le" in msg and ("42703" in msg or "does not exist" in msg)


def _a_relire(sb, uid: str, medias: list[dict],
              maintenant: datetime | None = None) -> tuple[list[str], dict]:
    """L'inventaire → (posts à relire, `_en_base`).

    Écrit au passage le décompte total des posts (`total_posts_id_instagram`),
    comme avant.
    """
    insert_instagram_total_posts_id(supabase=sb, user_id=uid, total_posts_id=len(medias))
    connus = _en_base(sb, uid)
    return posts_a_relire(medias, connus, maintenant or datetime.now(timezone.utc),
                          _est_payant(sb, uid)), connus


def _est_payant(sb, uid: str) -> bool:
    """`profiles.is_paid` — sans profil lisible, la règle la plus étroite, celle
    du gratuit (au lieu de l'`IndexError` d'avant)."""
    profil = sb.table("profiles").select("is_paid").eq("id", uid).execute().data or [{}]
    return bool(profil[0].get("is_paid"))


def posts_a_relire(medias: list[dict], connus: dict[str, dict], maintenant: datetime,
                   is_paid: bool) -> list[str]:
    """Les posts que relit le passage du Jour de travail, du plus récent au plus ancien.

    · Absent de la base :
        payant — ceux de moins de 30 jours seulement. Les plus anciens entrent
          par le Rattrapage (`rattrapage`), un bloc par passage léger, et par
          lui seul : sans cette borne, le passage complet les importait tous
          d'un coup (~1 600 sur le compte de l'essai, ~3 appels et une image
          chacun, une durée que rien n'a mesurée). 30 jours plutôt que « la
          première page de l'inventaire » : c'est la fenêtre que ce passage
          relit déjà en base — une seule règle, « le Jour de travail touche ce
          qui a moins de 30 jours » —, et elle suit le rythme de publication,
          pas une taille de page que Meta ne documente pas (`posts.recuperer`) ;
        gratuit — ses 10 plus récents à l'arrivée, puis tout post plus récent
          que le plus ancien de sa base : il grandit, rien ne s'efface, et pas
          de Rattrapage (spec § Le compte gratuit).
    · En base : publié il y a moins de 30 jours, ou image jamais arrivée dans
      notre stockage (le lien de CDN gardé va expirer, l'image serait perdue).
    Un post en base à la date illisible n'est pas relu ici : le trimestriel le
    reprendra (`relire_tous`).

    Les ids de Meta sont des chaînes, ceux de la base des entiers rendus par
    PostgREST : `connus` est indexé en `str` (`_en_base`). Comparer une chaîne à
    un entier ne matchait jamais — mesuré le 2026-08-24, la récolte reprenait
    comme neufs les 200 posts déjà en base à chaque passage.
    """
    ordre = sorted(medias, key=lambda m: m.get("timestamp") or "", reverse=True)
    ids = [str(m["id"]) for m in ordre]
    borne = maintenant - timedelta(days=_JOURS_RAFRAICHIS)
    rangs_connus = [rang for rang, pid in enumerate(ids) if pid in connus]
    if is_paid:
        absents = {pid for media, pid in zip(ordre, ids)
                   if pid not in connus and _publie_depuis(media.get("timestamp"), borne)}
    elif not rangs_connus:
        absents = set(ids[:_POSTS_A_L_ARRIVEE_GRATUIT])
    else:
        plus_ancien = rangs_connus[-1]
        absents = {pid for rang, pid in enumerate(ids) if pid not in connus and rang < plus_ancien}
    retenus = []
    for media, pid in zip(ordre, ids):
        if pid in absents:
            retenus.append(pid)
        elif pid in connus and (_publie_depuis(media.get("timestamp"), borne)
                                or not _dans_le_stockage(connus[pid].get("media_url"))):
            retenus.append(pid)
    return retenus


def _publie_depuis(timestamp: str | None, borne: datetime) -> bool:
    """Publié à `borne` ou après — False si la date est illisible."""
    try:
        publie_le = datetime.fromisoformat(timestamp or "")
    except ValueError:
        return False
    return publie_le.tzinfo is not None and publie_le >= borne


def _image_du_post(sb, uid: str, post_id: str, info: dict, media_connu: dict) -> str:
    """L'URL d'image à écrire pour ce post — sans refaire le trajet pour rien.

    C'est ce qui rend la fenêtre de 30 jours moins chère que les 20 posts
    d'avant, pas plus chère. Relire un post coûtait jusqu'ici trois appels
    Graph PLUS un téléchargement d'image chez Meta PLUS un envoi de fichier
    chez Supabase, pour réécrire un fichier identique. On ne refait le
    trajet que si l'URL connue n'est pas une URL de stockage — c'est-à-dire
    si l'envoi avait échoué et qu'on a gardé un lien de CDN périssable.
    """
    connue = media_connu.get(post_id)
    if _dans_le_stockage(connue):
        return connue
    return televerser_image_instagram(
        sb, uid, post_id, info.get("thumbnail_url") or info.get("media_url", ""))


def recolter(sb, uid: str, acces: AccesMeta, note=_rien) -> str:
    """La récolte Instagram d'un compte → le mot de fin du canal.

    `note(etape)` reçoit l'étape en cours pour que l'écran l'affiche. C'est ICI
    que le chiffre est honnête : le nombre de posts à relire est connu AVANT
    d'entrer dans la boucle, donc « posts 12/37 » est un compte réel.
    """
    if not acces.instagram:
        raise ValueError("instagram_business_id requis en mode headless")
    note("inventaire")
    medias, trous = posts.recuperer(acces)
    # UNE ERREUR NE DOIT PAS PASSER POUR UN COMPTE VIDE. Un jeton expiré rend
    # `{"error": …}` : sans ce contrôle, la suite plantait sur un `KeyError:
    # 'timestamp'` qui ne dit rien de la vraie cause, et `total_posts` aurait pu
    # s'écrire à 0.
    if trous and not medias:
        raise ValueError("Instagram — l'API a refusé la liste des médias : " + trous[0])
    if trous:
        # Pas une erreur : ce qui a été lu est bon. Mais ça se dit, sinon
        # `total_posts` est faux sans que rien ne le signale.
        print(f"    médias Instagram : {trous[0]} — le total sera sous-estimé.")
    a_relire, connus = _a_relire(sb, uid, medias)
    media_connu = {pid: r.get("media_url") for pid, r in connus.items()}
    note("abonnés")
    # Lu et jamais écrit — c'était déjà le cas avant le déménagement. Gardé
    # pour ne rien changer ; l'essai (ticket 08) en a besoin pour son contrôle.
    compte.recuperer(acces)
    resultats, releves, refuses = [], [], 0
    total = len(a_relire)
    for rang, post_id in enumerate(a_relire, start=1):
        note(f"posts {rang}/{total}")
        info = metriques.info_du_post(acces, post_id)
        m = (None if info.get("error")
             else metriques.metriques_du_post(acces, post_id, info.get("media_product_type")))
        fiche, releve = lignes_du_post(uid, info, m, datetime.now(timezone.utc),
                                       booste_vu_le=(connus.get(post_id) or {}).get("booste_vu_le"))
        if fiche is None:
            refuses += 1
            continue
        fiche["media_url"] = _image_du_post(sb, uid, post_id, info, media_connu)
        resultats.append(fiche)
        if releve is None:
            refuses += 1
        else:
            releves.append(releve)
    if refuses:
        # Une panne n'est pas une absence : ces posts gardent leurs valeurs
        # d'avant, sans relevé ce passage-ci. Ça se dit.
        print(f"    posts Instagram : {refuses} lecture(s) refusée(s) par Meta "
              "— valeurs précédentes gardées, pas de relevé.")
    note("écriture")
    if resultats:
        insert_instagram_org(supabase=sb, results=resultats)
    insert_instagram_releves(sb, releves)
    en_base = set(media_connu) | {str(r["post_id"]) for r in resultats}
    avancer_couverture(sb, uid, ("instagram", "posts"),
                       Fenetre(debut_des_posts_complets(medias, en_base), date.today()), trous)
    return f"insta: {len(resultats)} posts relus, {len(releves)} relevés"


# Spec § La relecture, premier tiret : « chaque jour de J+0 à J+7 ». J+7 se
# termine à 8 × 24 h après la publication ; au-delà, c'est la relecture du Jour
# de travail (moins de 30 jours) qui prend le relais.
_AGE_DU_RELEVE_QUOTIDIEN = timedelta(hours=8 * 24)


def posts_du_jour(medias: list[dict], en_base: set[str], maintenant: datetime) -> list[dict]:
    """Les posts de l'inventaire que le passage léger relève, dans son ordre.

    · moins de 8 × 24 h : un relevé par jour de J+0 à J+7 ;
    · absent de la base, quel que soit son âge : sa fiche et son premier relevé
      — sinon un post du mardi attendrait le Jour de travail (spec).
    Un post en base à la date illisible n'est pas relevé : un âge inventé le
    rangerait au mauvais J+n.
    """
    borne = maintenant - _AGE_DU_RELEVE_QUOTIDIEN
    retenus = []
    for media in medias:
        if str(media.get("id")) not in en_base:
            retenus.append(media)
            continue
        try:
            publie_le = datetime.fromisoformat(media.get("timestamp") or "")
        except ValueError:
            continue
        if publie_le.tzinfo is not None and publie_le > borne:
            retenus.append(media)
    return retenus


def releve_quotidien(sb, uid: str, acces: AccesMeta,
                     maintenant: datetime | None = None) -> str:
    """Le passage léger d'un compte → son mot de fin.

    Relève les posts de moins de 8 × 24 h et écrit la fiche des posts neufs
    (spec § La récolte — Ce qui s'ajoute). Ce qu'il NE fait pas, exprès :
    · ni `total_posts_id_instagram` ni la couverture des posts — il ne lit que
      le haut de l'inventaire, un total ou une couverture tirés de là
      seraient faux ;
    · ni `fetch_progress` ni le rapport : c'est l'appelant
      (`account_sync.leger`) qui s'en tient à l'écart.
    """
    if not acces.instagram:
        raise ValueError("instagram_business_id requis en mode headless")
    maintenant = maintenant or datetime.now(timezone.utc)
    # UN COMPTE JAMAIS RÉCOLTÉ ATTEND SON PREMIER PASSAGE COMPLET. Le gratuit
    # n'y prend que ses 10 plus récents (spec § Le compte gratuit) : le léger,
    # qui ajoute tout post absent de la base, en importerait 25 et plus.
    deja = (sb.table("instagram_organic_posts").select("post_id")
            .eq("user_id", uid).limit(1).execute().data)
    if not deja:
        return "insta léger: aucun post en base — premier passage complet attendu"
    medias, trous = posts.recents(acces, maintenant - _AGE_DU_RELEVE_QUOTIDIEN)
    # Même règle que `recolter` : une panne n'est pas un compte sans post neuf.
    if trous and not medias:
        raise ValueError("Instagram — l'API a refusé la liste des médias : " + trous[0])
    if trous:
        print(f"    médias Instagram (léger) : {trous[0]}")
    ids = [str(m["id"]) for m in medias if m.get("id")]
    # Au plus 8 × 25 lignes : sous le plafond de 1 000 de PostgREST.
    connus = _en_base(sb, uid, ids) if ids else {}
    media_connu = {pid: r.get("media_url") for pid, r in connus.items()}

    fiches, releves, refuses, neufs = [], [], 0, 0
    for media in posts_du_jour(medias, set(media_connu), maintenant):
        post_id = str(media["id"])
        m = metriques.metriques_du_post(acces, post_id, media.get("media_product_type"))
        # L'heure du passage, pas celle de chaque appel : le léger d'un compte
        # dure de l'ordre de la minute, un écart sans effet sur un J+n compté
        # en jours — et c'est ce qui rend l'âge vérifiable hors ligne.
        fiche, releve = lignes_du_post(uid, media, m, maintenant,
                                       booste_vu_le=(connus.get(post_id) or {}).get("booste_vu_le"))
        if fiche is None or releve is None:
            # Pas de relevé, et pas de fiche non plus : un post neuf sans
            # métriques reviendra demain, absent de la base, et sera repris.
            refuses += 1
            continue
        fiche["media_url"] = _image_du_post(sb, uid, post_id, media, media_connu)
        neufs += post_id not in media_connu
        fiches.append(fiche)
        releves.append(releve)
    if refuses:
        print(f"    posts Instagram (léger) : {refuses} lecture(s) refusée(s) par Meta "
              "— valeurs précédentes gardées, pas de relevé.")
    if fiches:
        insert_instagram_org(supabase=sb, results=fiches)
    insert_instagram_releves(sb, releves)
    return f"insta léger: {len(releves)} posts relevés dont {neufs} neufs"


# ── LE RATTRAPAGE PAR BLOCS (payant) ─────────────────────────────────────────
#
# Spec § La récolte — Ce qui s'ajoute, « Le Rattrapage » : tous les posts que
# Meta rend, du plus récent au plus ancien, un bloc par passage quotidien.
#
# LA TAILLE DU BLOC N'EST PAS MESURÉE. La spec la veut « fixée sur la durée
# mesurée d'un passage » (§ Notes, « Dans le brouillard ») et aucun passage n'a
# encore tourné : 25 est une valeur d'attente, choisie pour que le bloc pèse au
# pire autant que ce que le léger relève déjà chaque jour (une page de 25,
# `posts._PAGE_DU_JOUR`) — il ne fait au plus que doubler une durée qu'on va
# lire. À régler sur la ligne de journal du léger (ticket 04) : « rattrapage :
# N posts importés en T s » donne le coût d'un post, à rapporter à ce qu'on
# accepte de durée par compte dans le job quotidien (plafond GitHub : 6 h pour
# TOUS les comptes). Ticket 08 de `.scratch/instagram-construction/`, laissé
# `needs-human` pour ce réglage. Au plus 100 : la page de `/media` n'est pas
# documentée au-delà (`posts.recuperer`).
_TAILLE_DU_BLOC = 25
# Coupe-circuit des pages SANS post à importer (le haut de l'inventaire, déjà en
# base par le complet et le léger ; ou tout l'inventaire après un curseur
# refusé). Chacune ne coûte qu'un appel ; 20 pages de 25 = 500 posts sautés par
# passage, du même ordre que les ~19 pages de l'inventaire complet du compte de
# l'essai (1 839 posts à 100 par page). La position gagnée est gardée : un saut
# plus long se finit au passage suivant.
_PAGES_PAR_PASSAGE_MAX = 20


def rattrapage(sb, uid: str, acces: AccesMeta, connexion_id,
               maintenant: datetime | None = None) -> str:
    """Un bloc du Rattrapage d'une connexion → son mot de fin.

    Lit l'inventaire depuis le curseur gardé en base, saute les pages dont
    tous les posts sont déjà en base, importe les absents de la première page
    qui en a (fiche, image, métriques, relevé), puis garde le curseur de la
    page suivante. Plus de page → la fin est datée, les passages suivants ne
    lisent plus rien : un post neuf arrive en HAUT de l'inventaire, c'est le
    travail du léger et du complet.

    · Gratuit : rien (spec § Le compte gratuit, « pas de Rattrapage »).
    · Curseur refusé par Meta (un curseur pointe sur un post : supprimé, il
      ne mène plus nulle part) : reprise du haut ; les pages déjà en base ne
      coûtent qu'un appel chacune. Refusé aussi du haut → panne : lève, le
      curseur ne bouge pas.
    · Métriques refusées pour TOUT le bloc (jeton, limite) : rien n'est écrit
      et le curseur reste AVANT la page — elle sera relue demain. Refusées
      pour une partie : la fiche s'écrit sans métriques (inconnues, pas
      zéro) et le trimestriel les relira ; sinon le curseur passé, ce post ne
      reviendrait jamais.
    """
    if not acces.instagram:
        raise ValueError("instagram_business_id requis en mode headless")
    if not _est_payant(sb, uid):
        return "rattrapage: compte gratuit — pas de Rattrapage"
    try:
        etat = etat_du_rattrapage(sb, uid, connexion_id)
    except ColonneRattrapageAbsente:
        return ("rattrapage: colonnes rattrapage_instagram_* absentes — lance "
                "saas/data/supabase/migrations/000_run_me_all.sql")
    if etat["rattrapage_instagram_fini_le"]:
        return f"rattrapage: fini le {str(etat['rattrapage_instagram_fini_le'])[:10]}"
    maintenant = maintenant or datetime.now(timezone.utc)
    curseur = etat["rattrapage_instagram_curseur"]
    mots: list[str] = []
    fini, sautees, importes, refuses = False, 0, 0, 0
    for _ in range(_PAGES_PAR_PASSAGE_MAX):
        medias, suivant, err = posts.page_du_rattrapage(acces, curseur, _TAILLE_DU_BLOC)
        if err and curseur:
            medias, suivant, err = posts.page_du_rattrapage(acces, None, _TAILLE_DU_BLOC)
            if not err:
                mots.append("curseur refusé par Meta, reprise du haut de l'inventaire")
                curseur = None
        if err:
            raise ValueError("Instagram — l'API a refusé l'inventaire du Rattrapage : " + err)
        ids = [str(m["id"]) for m in medias if m.get("id")]
        connus = _en_base(sb, uid, ids) if ids else {}
        absents = [m for m in medias if m.get("id") and str(m["id"]) not in connus]
        if absents:
            importes, refuses = _importer(sb, uid, acces, absents, maintenant)
            if not importes:
                mots.append(f"{refuses} lecture(s) refusée(s) par Meta — bloc repris demain")
                break
        else:
            sautees += 1
        curseur = suivant
        if not medias or suivant is None:
            fini = True
            break
        if absents:
            break
    bilan = f"{importes} posts importés"
    if refuses and importes:
        bilan += f" ({refuses} sans métriques)"
    if sautees:
        bilan += f", {sautees} page(s) déjà en base sautée(s)"
    mots.insert(0, bilan)
    if fini:
        mots.append("fin de l'inventaire")
    if not noter_rattrapage(sb, uid, connexion_id, curseur, maintenant if fini else None):
        mots.append("curseur NON écrit — 0 ligne touchée, le bloc sera refait")
    return "rattrapage: " + ", ".join(mots)


def _importer(sb, uid: str, acces: AccesMeta, medias: list[dict],
              maintenant: datetime) -> tuple[int, int]:
    """Les posts absents d'une page → (importés avec métriques, refusés).

    Rien n'est écrit si aucun n'a ses métriques : c'est une panne, pas une
    page de posts sans chiffres."""
    lus = []
    for media in medias:
        post_id = str(media["id"])
        m = metriques.metriques_du_post(acces, post_id, media.get("media_product_type"))
        lus.append((media, m))
    importes = sum(m is not None for _, m in lus)
    if not importes:
        return 0, len(lus)
    fiches, releves = [], []
    for media, m in lus:
        fiche, releve = lignes_du_post(uid, media, m, maintenant)
        if fiche is None:
            continue
        fiche["media_url"] = _image_du_post(sb, uid, str(media["id"]), media, {})
        fiches.append(fiche)
        if releve is not None:
            releves.append(releve)
    _ecrire(sb, fiches, releves)
    return importes, len(lus) - importes


# Écrire tous les 100 posts relus : la relecture unique d'un compte à 1 839
# posts (le Rattrapage, spec § La profondeur de l'historique) fait ~5 000
# appels Graph ; un job coupé ou une panne au millième post ne doit pas jeter
# les 999 relectures déjà faites.
_LOT_DE_RELECTURE = 100


def relire_tous(sb, uid: str, acces: AccesMeta,
                maintenant: datetime | None = None) -> str:
    """La relecture de TOUS les posts en base d'un compte → son mot de fin.

    Spec § La récolte — Ce qui s'ajoute, « La relecture unique » (ticket 03),
    puis le trimestriel (07) : remplit `media_product_type`, `permalink`,
    `shares`, `profile_visits`, `booste_vu_le`, les j'aime des vidéos, et vide
    `follows` des Reels — par le même chemin que le relevé (fiche avec
    `boost_ads_list`, puis 1 appel insights pour un Reel, 2 pour le fil).

    · Les posts EN BASE, et seulement eux : aucun inventaire `/media`, aucun
      post neuf — c'est le travail du passage complet et du Rattrapage.
    · Sans image : la relecture ne téléverse rien et n'envoie pas `media_url`,
      l'upsert garde celle qui est en base.
    · Ni couverture, ni `total_posts_id_instagram`, ni `fetch_progress` : elle
      ne lit pas l'inventaire, elle ne sait rien d'un total.
    · Un post refusé (supprimé chez Meta, jeton) n'écrit rien : ses vieilles
      valeurs restent, c'est ce que compte le nettoyage du ticket 03.
    """
    if not acces.instagram:
        raise ValueError("instagram_business_id requis en mode headless")
    maintenant = maintenant or datetime.now(timezone.utc)
    connus = _tous_en_base(sb, uid)
    fiches, releves, refuses, relus = [], [], 0, 0
    for post_id, en_base in connus.items():
        try:
            info = metriques.info_du_post(acces, post_id)
        except Exception:
            # `http_client.get` ne réessaie pas une exception réseau : sur des
            # milliers d'appels, une seule ne doit pas arrêter la relecture.
            # Le post est compté refusé, rien n'est écrit pour lui.
            info = {"error": "exception réseau"}
        m = (None if info.get("error")
             else metriques.metriques_du_post(acces, post_id, info.get("media_product_type")))
        fiche, releve = lignes_du_post(uid, info, m, maintenant,
                                       booste_vu_le=en_base.get("booste_vu_le"))
        if fiche is not None:
            fiches.append(fiche)
        if releve is None:
            refuses += 1
        else:
            releves.append(releve)
            relus += 1
        if len(fiches) >= _LOT_DE_RELECTURE:
            _ecrire(sb, fiches, releves)
            fiches, releves = [], []
    _ecrire(sb, fiches, releves)
    return (f"insta relecture: {len(connus)} posts en base, {relus} relus, "
            f"{refuses} refusé(s)")


def _ecrire(sb, fiches: list[dict], releves: list[dict]) -> None:
    if fiches:
        insert_instagram_org(supabase=sb, results=fiches)
    if releves:
        insert_instagram_releves(sb, releves)


def _tous_en_base(sb, uid: str) -> dict[str, dict]:
    """`{post_id: {booste_vu_le}}` de TOUS les posts du compte en base.

    Paginé, ordre total sur `post_id` : PostgREST tronque à 1 000 lignes en
    silence (`CLAUDE.md` §8) et le Rattrapage en ramène 1 839 sur le compte de
    l'essai — sans pagination, 839 posts ne seraient jamais relus. Base sans
    la section 23 (42703) : relue sans `booste_vu_le`, comme `_en_base`.
    """
    for colonnes in ("post_id, booste_vu_le", "post_id"):
        try:
            lignes = _all_pages(lambda: sb.table("instagram_organic_posts").select(colonnes)
                                .eq("user_id", uid).order("post_id"))
            return {str(r["post_id"]): r for r in lignes}
        except Exception as e:
            if "booste_vu_le" not in colonnes or not _colonne_boost_absente(e):
                raise
            print("    posts Instagram : colonne booste_vu_le absente — lance "
                  "saas/data/supabase/migrations/000_run_me_all.sql.")
    return {}


def lignes_du_post(uid: str, info: dict, metriques: dict | None, releve_a: datetime,
                   booste_vu_le: str | None = None) -> tuple[dict | None, dict | None]:
    """Une lecture d'un post → (sa fiche, son relevé) à écrire.

    La fiche porte le dernier relevé ; le relevé s'AJOUTE, daté, avec son âge
    réel (spec § Ce qui s'ajoute, « Le relevé d'un post ») : un passage manqué
    donne un J+8, jamais un faux J+7.

    · Fiche refusée par Meta (post supprimé, jeton) → (None, None) : sans ce
      contrôle, `media_type` retombait sur « IMAGE » et une ligne fausse
      s'écrivait.
    · Métriques refusées (`metriques` à None) → la fiche sans aucune métrique
      ni `releve_a`, et pas de relevé : l'upsert ne réécrit que les colonnes
      envoyées, les bonnes valeurs déjà en base restent.
    · L'image (`media_url`) se règle à part : elle demande le stockage.
    · Le boost (ticket 02) : le relevé porte l'état du moment (`booste`, None
      si le champ n'a pas été obtenu) ; la fiche reçoit `booste_vu_le` — la
      date du relevé — à la première vue seulement (`booste_vu_le` = la valeur
      déjà en base). Jamais envoyée sinon : l'upsert la viderait ou la
      déplacerait. Lu au même appel que la fiche, il se pose même si les
      métriques ont été refusées.
    """
    if info.get("error") or not info.get("id"):
        return None, None
    fiche = {
        "post_id": info["id"],
        "user_id": uid,
        "type": info.get("media_type"),
        "caption": (info.get("caption") or "")[:500],
        "date": info.get("timestamp", ""),
        # Seulement si Meta les rend : l'upsert réécrit chaque colonne
        # envoyée, et un None effacerait une valeur déjà acquise.
        **{k: info[k] for k in COLONNES_SI_CONNUES if info.get(k)},
    }
    booste = boost.est_booste(info)
    if booste and not booste_vu_le:
        fiche["booste_vu_le"] = releve_a.date().isoformat()
    if metriques is None:
        return fiche, None
    horodatage = releve_a.isoformat()
    fiche.update(metriques, releve_a=horodatage)
    releve = {"user_id": uid, "post_id": info["id"], "releve_a": horodatage,
              "age_heures": _age_en_heures(info.get("timestamp"), releve_a),
              "booste": booste, **metriques}
    return fiche, releve


def _age_en_heures(publie_le: str | None, releve_a: datetime) -> float | None:
    """Heures écoulées entre la publication et le relevé — None si la date de
    publication est illisible : un âge inventé placerait le post au mauvais J+n."""
    if not publie_le:
        return None
    try:
        # Meta écrit « 2026-11-01T07:00:00+0000 » ; `fromisoformat` lit le
        # décalage sans deux-points depuis Python 3.11.
        debut = datetime.fromisoformat(publie_le)
    except ValueError:
        return None
    if debut.tzinfo is None:
        return None
    return round((releve_a - debut).total_seconds() / 3600, 2)
