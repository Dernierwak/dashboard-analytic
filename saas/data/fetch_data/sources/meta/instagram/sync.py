"""La synchronisation Instagram : posts à relire, images et écriture.

Les appels vivent dans `posts.py`, `account.py` et `post_metrics.py` ; ce
fichier décide quoi relire et envoie à Supabase (`saas/data/supabase/source_data/meta.py`).
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import pandas as pd

from saas.data.fetch_data.shared.date_ranges import Fenetre
from saas.data.supabase.source_data.couverture import avancer_couverture, debut_des_posts_complets
from saas.data.supabase.source_data.meta import (
    COLONNES_SI_CONNUES, insert_instagram_org, insert_instagram_releves, insert_instagram_total_posts_id,
    televerser_image_instagram,
)
from saas.data.fetch_data.sources.meta.graph_client import AccesMeta
from saas.data.fetch_data.sources.meta.instagram.fetchers import account as compte
from saas.data.fetch_data.sources.meta.instagram.fetchers import post_metrics as metriques
from saas.data.fetch_data.sources.meta.instagram.fetchers import posts

# ── QUELS POSTS ON RELIT — une DURÉE, plus un compte ─────────────────────────
#
# La règle était « les 20 derniers posts », et un compte ne se mesure pas en
# posts, il se mesure en jours. Qui publie cinq fois par jour ne faisait relire
# que quatre jours ; qui publie une fois par mois en faisait relire vingt mois,
# pour rien. Or ce qui bouge, c'est le TEMPS : un post continue d'accumuler
# vues, portée et enregistrements pendant des semaines après sa publication.
#
# 30 jours, et il faut être honnête sur ce chiffre : contrairement aux fenêtres
# d'attribution de Meta Ads et Google Ads, AUCUNE doc ne dit au bout de combien
# de temps les métriques d'un post organique se stabilisent — elles sont
# cumulées à vie et ne se stabilisent jamais tout à fait. Ce n'est donc pas un
# nombre lu quelque part, c'est un arbitrage de coût assumé : 30 jours couvrent
# la période où un post bouge assez pour changer une conclusion, et le plafond
# ci-dessous empêche un compte très actif de faire exploser la récolte.
_JOURS_RAFRAICHIS = 30
# Plafond dur sur les posts DÉJÀ en base qu'on relit. Cinq publications par
# jour × 30 jours = 150 posts, soit 450 appels Graph : non. À 40, le pire cas
# est borné et connu.
_POSTS_RAFRAICHIS_MAX = 40
# Plancher, pour le compte qui publie une fois par mois : sans lui, la fenêtre
# de 30 jours ne rendrait qu'un seul post et le reste du mur ne bougerait plus.
_POSTS_RAFRAICHIS_MIN = 6

# CE QUE ÇA COÛTE — simulé sur les quatre rythmes de publication, en posts
# relus par passage (un post relu = 3 appels Graph : info, insights, follows) :
#     1 post/jour     20 → 30      1 post/semaine  20 → 6
#     5 posts/jour    20 → 40      1 post/mois     20 → 6
# Deux comptes sur quatre coûtent MOINS cher qu'avant, et le pire cas est
# plafonné. Surtout, l'image ne repart plus dans les deux sens à chaque
# passage (voir `_image_du_post`) : on économise 20 à 40 téléchargements + 20 à
# 40 envois de fichier, qui étaient de très loin la partie la plus lente. La
# fenêtre s'élargit et la récolte accélère.
# Le quota n'entre pas en jeu : Meta autorise « 4800 * Number of Impressions »
# appels par 24 h sur la plateforme Instagram — quelques centaines d'affichages
# suffisent à couvrir mille fois ce qu'on demande.
# https://developers.facebook.com/docs/graph-api/overview/rate-limiting/


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


def _a_relire(sb, uid: str, medias: list[dict]) -> tuple[list, dict]:
    """L'inventaire → (posts à relire, {post_id: media_url déjà en base}).

    Écrit au passage le décompte total des posts (`total_posts_id_instagram`),
    comme avant.
    """
    df = pd.DataFrame(medias).sort_values(by="timestamp", ascending=False)
    insert_instagram_total_posts_id(supabase=sb, user_id=uid, total_posts_id=len(df))

    is_paid = sb.table("profiles").select("is_paid").eq("id", uid).execute().data[0].get("is_paid", False)
    # 200 en payant : le dashboard Instagram a besoin de profondeur
    # (le backfill se fait en plusieurs fetchs).
    limite = 200 if is_paid else 10
    all_post_ids = df["id"][:limite].tolist()

    existing_rows = (sb.table("instagram_organic_posts")
                     .select("post_id, media_url")
                     .eq("user_id", uid).execute().data) or []
    # LE BUG QUI RENDAIT LA RÉCOLTE JAMAIS INCRÉMENTALE, ET DEPUIS TOUJOURS.
    # `post_id` est une colonne numérique (bigint) : PostgREST le rend en
    # `int` Python. `df["id"]` vient du Graph API, qui rend TOUJOURS ses IDs
    # en chaînes JSON. `pid not in existing_ids` comparait donc une chaîne à
    # un ensemble d'entiers — jamais égal, quoi qu'il arrive. Chaque post du
    # compte (jusqu’à `limite`) était donc traité comme neuf à CHAQUE
    # récolte, sans jamais toucher au plafond `_POSTS_RAFRAICHIS_MAX` : sur
    # un compte à 200 posts, ça fait 200 posts relus (3 appels Graph
    # chacun) au lieu d'une poignée de nouveaux + 40 rafraîchis. Mesuré en
    # conditions réelles (2026-08-24) : `new_post_ids` rendait exactement
    # les 200 IDs déjà en base, en chaînes, alors que `existing_ids` les
    # portait en entiers — la comparaison ne pouvait jamais matcher.
    # Le même bug défaisait `_media_connu` (ajouté le 18 août pour éviter
    # de re-télécharger une image déjà en stockage) : la clé cherchée était
    # une chaîne, le dict était indexé par entier, `.get()` rendait
    # toujours `None`, et `_image_du_post` refaisait le trajet
    # téléchargement + envoi pour une image qu'on avait déjà — le poste le
    # plus cher de la récolte Instagram, payé pour rien à chaque passage.
    existing_ids = {str(row["post_id"]) for row in existing_rows}
    media_connu = {str(r["post_id"]): r.get("media_url") for r in existing_rows}

    # La fenêtre de rafraîchissement, en jours (voir _JOURS_RAFRAICHIS).
    # `errors="coerce"` : un timestamp illisible devient NaT, donc hors
    # fenêtre — il sera quand même repris s'il tombe dans le plancher.
    publie_le = pd.to_datetime(df["timestamp"], utc=True, errors="coerce")
    borne = pd.Timestamp.now(tz="UTC") - pd.Timedelta(days=_JOURS_RAFRAICHIS)
    recents = set(df.loc[publie_le >= borne, "id"])

    # Trois raisons de relire un post DÉJÀ en base, toutes plafonnées
    # ensemble à _POSTS_RAFRAICHIS_MAX : il est récent, il fait partie du
    # plancher, ou son image n'a jamais atteint notre stockage (le lien de
    # CDN qu'on avait gardé va expirer, donc on refait le trajet).
    # Un post ABSENT de la base n'est jamais plafonné : il faut bien aller
    # le chercher une première fois.
    a_reprendre, repris = [], 0
    for rang, pid in enumerate(all_post_ids):
        if pid not in existing_ids:
            a_reprendre.append(pid)
            continue
        if repris >= _POSTS_RAFRAICHIS_MAX:
            continue
        if (pid in recents
                or rang < _POSTS_RAFRAICHIS_MIN
                or not _dans_le_stockage(media_connu.get(pid))):
            a_reprendre.append(pid)
            repris += 1
    return a_reprendre, media_connu


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
    a_relire, media_connu = _a_relire(sb, uid, medias)
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
        fiche, releve = lignes_du_post(uid, info, m, datetime.now(timezone.utc))
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
    lignes = (sb.table("instagram_organic_posts").select("post_id, media_url")
              .eq("user_id", uid).in_("post_id", ids).execute().data) if ids else []
    media_connu = {str(r["post_id"]): r.get("media_url") for r in lignes or []}

    fiches, releves, refuses, neufs = [], [], 0, 0
    for media in posts_du_jour(medias, set(media_connu), maintenant):
        post_id = str(media["id"])
        m = metriques.metriques_du_post(acces, post_id, media.get("media_product_type"))
        # L'heure du passage, pas celle de chaque appel : le léger d'un compte
        # dure de l'ordre de la minute, un écart sans effet sur un J+n compté
        # en jours — et c'est ce qui rend l'âge vérifiable hors ligne.
        fiche, releve = lignes_du_post(uid, media, m, maintenant)
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


def lignes_du_post(uid: str, info: dict, metriques: dict | None,
                   releve_a: datetime) -> tuple[dict | None, dict | None]:
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
    if metriques is None:
        return fiche, None
    horodatage = releve_a.isoformat()
    fiche.update(metriques, releve_a=horodatage)
    releve = {"user_id": uid, "post_id": info["id"], "releve_a": horodatage,
              "age_heures": _age_en_heures(info.get("timestamp"), releve_a), **metriques}
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
