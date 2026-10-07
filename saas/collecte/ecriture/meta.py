"""Les écritures de la récolte Meta : Meta Ads, Instagram, et leurs visuels.

Les fichiers d'API Meta (`collecte/meta/`) LISENT et ne touchent jamais
Supabase : c'est ce qui permet à l'essai de les appeler sans rien écrire. Tout
ce qui écrit — tables, stockage — vit ici.
"""
from __future__ import annotations

from datetime import datetime, timezone

from supabase import Client

from saas.collecte.socle import http


# ── Instagram — instagram_organic_posts, connected_accounts, post-images ─────

def insert_instagram_org(supabase: Client, results):
    """Écrit les posts récoltés — un jeu de lignes PAR UTILISATEUR.

    Le conflit porte sur (user_id, post_id) et surtout PAS sur post_id seul :
    deux comptes Pulse peuvent suivre la même page Instagram, et avec un
    conflit global l'upsert de l'un réécrivait le user_id des lignes de
    l'autre. Chaque récolte volait donc les posts du voisin au lieu d'ajouter
    les siens, sans lever la moindre erreur. Voir
    supabase/migrations/instagram_posts_par_user.sql.
    """
    if not results:
        return
    supabase.table("instagram_organic_posts").upsert(
        results, on_conflict="user_id,post_id"
    ).execute()


def insert_instagram_total_posts_id(supabase: Client, user_id, total_posts_id):
    supabase.table("connected_accounts").update({"total_posts_id_instagram": total_posts_id}).eq("user_id", user_id).execute()
    
    
def televerser_image_instagram(supabase: Client, user_id: str, post_id: str,
                               image_url: str) -> str:
    """Télécharge l'image d'un post et la range dans `post-images`.

    Une URL de CDN Instagram expire au bout de quelques jours : c'est la raison
    d'être de ce trajet. En cas d'échec, l'URL de CDN est rendue telle quelle
    (comportement historique — `_dans_le_stockage` la fera retenter au passage
    suivant).
    """
    try:
        r = http.get(image_url, timeout=10)
        if r.status_code != 200:
            return image_url
        file_path = f"{user_id}/{post_id}.jpg"
        supabase.storage.from_("post-images").upload(
            path=file_path,
            file=r.content,
            file_options={"content-type": "image/jpeg", "upsert": "true"}
        )
        return supabase.storage.from_("post-images").get_public_url(file_path)
    except Exception:
        return image_url


# ── Meta Ads — meta_ads_insights ──────────────────────────────────────────────

# CE QUI BORNE UN LOT, ET POURQUOI IL Y A DEUX BORNES.
#
# Une récolte de routine demande ~35 jours : elle tient dans un lot et ces
# bornes ne se voient jamais. C'est la RÉCOLTE COMPLÈTE (`recolte_complete.py`) qui
# les rend nécessaires, et l'avertissement était écrit d'avance dans la note
# PROFONDEUR D'HISTORIQUE (`socle/fenetre.py`) : « upsert_meta_ads envoie TOUT en
# un seul appel PostgREST, et 22 500 lignes d'un coup n'ont jamais été
# essayées. À découper avant d'élargir quoi que ce soit. »
#
#  · les DATES, parce que le DELETE les met dans l'URL. `.in_("date_start", …)`
#    est un filtre de query-string : 1 100 dates font ~16 Ko d'URL, au-delà du
#    tampon d'en-têtes habituel (8 Ko) — le serveur répond 414 et l'effacement
#    échoue, donc RIEN n'est écrit après des minutes d'appels à Meta.
#  · les LIGNES, parce que l'upsert les met dans le corps. Un compte à 500
#    annonces × 90 jours ferait 45 000 lignes en un seul envoi.
#
# Les deux plafonds sont volontairement bas : un lot de plus coûte un
# aller-retour, une requête refusée coûte la récolte.
_LOT_DATES_MAX = 90
_LOT_LIGNES_MAX = 5000


def _lots_par_date(records: list[dict]) -> list[list[dict]]:
    """Découpe les lignes en lots, sans jamais séparer une même date.

    Une date doit rester entière dans son lot : son effacement et sa réécriture
    sont une paire (voir `upsert_meta_ads`), et une date à cheval sur deux lots
    verrait ses lignes sans `ad_id` effacées par le premier et une partie
    seulement réécrite.
    """
    par_date: dict[str, list[dict]] = {}
    for r in records:
        par_date.setdefault(r.get("date_start"), []).append(r)

    lots, lot, lignes = [], [], 0
    for jour in sorted(par_date, key=lambda d: (d is None, d)):
        du_jour = par_date[jour]
        trop_de_dates = len(lot) and len({r.get("date_start") for r in lot}) >= _LOT_DATES_MAX
        trop_de_lignes = lignes and lignes + len(du_jour) > _LOT_LIGNES_MAX
        if trop_de_dates or trop_de_lignes:
            lots.append(lot)
            lot, lignes = [], 0
        lot += du_jour
        lignes += len(du_jour)
    if lot:
        lots.append(lot)
    return lots


def upsert_meta_ads(supabase: Client, user_id: str, records: list[dict]):
    """Upsert des lignes de meta_ads_insights, déjà formées par
    `saas.collecte.meta.ads.insights.lignes_meta_ads`.
    Conflict sur (user_id, date_start, ad_id) — une ligne par annonce par jour.
    """
    if not records:
        return

    for lot in _lots_par_date(records):
        # LE DOUBLE COMPTAGE QU'IL FAUT ÉCARTER AVANT D'ÉCRIRE. Les lignes
        # antérieures au passage à `ad_id` le portent à NULL. Un upsert sur
        # (user_id, date_start, ad_id) ne les reconnaît pas — il ajouterait la
        # ligne neuve À CÔTÉ de l'ancienne, et la dépense de ces journées
        # compterait double, durablement. On efface donc les lignes sans ad_id
        # des SEULES dates qu'on s'apprête à réécrire, pour ce SEUL
        # utilisateur : ce sont exactement les lignes que l'upsert remplace.
        #
        # L'EFFACEMENT ET L'ÉCRITURE VONT PAR PAIRE, LOT PAR LOT. Les séparer
        # (tout effacer, puis tout écrire) rouvrirait la fenêtre sans donnée
        # qu'on a justement refusée en écartant le DELETE global.
        dates = sorted({r["date_start"] for r in lot if r.get("date_start")})
        if dates:
            (supabase.table("meta_ads_insights")
             .delete()
             .eq("user_id", user_id)
             .is_("ad_id", "null")
             .in_("date_start", dates)
             .execute())

        supabase.table("meta_ads_insights").upsert(
            lot,
            on_conflict="user_id,date_start,ad_id"
        ).execute()



# ── Meta Ads — meta_campaign_config ───────────────────────────────────────────

def upsert_campaign_statuses(
    supabase: Client,
    user_id: str,
    lignes: list[dict],
) -> int:
    """Écrit statut et dates déclarées des campagnes Meta, rattachés par l'ID.

    `lignes` sort de `lignes_config_meta` (saas/collecte/meta/ads/campagnes.py).
    Rend le nombre de campagnes NON écrites par le repli ci-dessous (0 hors
    repli) : l'appelant le dit dans le journal, sans quoi ces campagnes
    garderaient un statut périmé sans trace.

    LA BASE PEUT ENCORE PORTER L'ANCIENNE CLÉ. L'étape B
    (supabase/migrations/997_la_cle_de_config_meta_passe_a_l_id.sql) se joue à
    la main, après le merge : tant qu'elle ne l'est pas, la clé primaire est
    (user_id, campaign_name) et l'upsert sur l'ID est refusé en 42P10. On
    retombe alors sur le nom, en écrivant l'ID au passage — c'est ce qui
    remplit les ~200 lignes par compte que le report depuis les insights ne
    peut pas atteindre (mesuré le 2026-10-04 : 16 sur 197, les autres n'ont
    jamais dépensé).
    """
    if not lignes:
        return 0
    try:
        supabase.table("meta_campaign_config").upsert(
            lignes, on_conflict="user_id,campaign_id"
        ).execute()
        return 0
    except Exception as e:
        if str(getattr(e, "code", "") or "") != "42P10":
            raise
        # Sous la clé par nom, deux campagnes homonymes viseraient la même
        # ligne : en écrire une serait choisir au hasard laquelle porte l'ID.
        # Elles attendent l'étape B, qui les rend distinctes.
        par_nom: dict[str, int] = {}
        for ligne in lignes:
            par_nom[ligne["campaign_name"]] = par_nom.get(ligne["campaign_name"], 0) + 1
        uniques = [ligne for ligne in lignes
                   if ligne["campaign_name"] and par_nom[ligne["campaign_name"]] == 1]
        if uniques:
            supabase.table("meta_campaign_config").upsert(
                uniques, on_conflict="user_id,campaign_name"
            ).execute()
        return len(lignes) - len(uniques)


# ── Les créas Meta — meta_ads_creatives et meta_ads_creative_assets ──────────

# Les ad_id voyagent dans l'URL du filtre `in.(…)` : un lot borné la garde
# courte, comme `_HASHES_PAR_APPEL` côté Meta.
_ANNONCES_PAR_EFFACEMENT = 100


def remplacer_creas(
    supabase: Client, user_id: str, creas: list[dict], assets: list[dict],
) -> None:
    """Écrit les créas relues, et REMPLACE les assets de chaque annonce relue.

    La clé des assets est `(annonce, provenance, nature, rang)` : un upsert ne
    retire rien. Une annonce passée de 5 textes à 3, ou du carrousel à
    `asset_feed`, garderait ses anciennes lignes, et le Panneau montrerait des
    textes que Meta ne diffuse plus (ticket 05, commentaire du 2026-10-03).
    On efface donc les assets de `(user_id, ad_id)` pour CHAQUE annonce relue
    — y compris celles qui n'en ont plus aucun — puis on insère. Le DELETE
    est borné aux annonces de ce passage : une annonce que Meta n'a pas
    rendue garde ses lignes.

    `creas` et `assets` : la sortie de `lignes_creas`.
    """
    if not creas:
        return
    maintenant = datetime.now(timezone.utc).isoformat()
    supabase.table("meta_ads_creatives").upsert(
        [{**c, "recolte_le": maintenant} for c in creas], on_conflict="user_id,ad_id"
    ).execute()
    ad_ids = [c["ad_id"] for c in creas]
    for i in range(0, len(ad_ids), _ANNONCES_PAR_EFFACEMENT):
        (supabase.table("meta_ads_creative_assets").delete()
         .eq("user_id", user_id).in_("ad_id", ad_ids[i:i + _ANNONCES_PAR_EFFACEMENT])
         .execute())
    if assets:
        supabase.table("meta_ads_creative_assets").insert(assets).execute()



# ── Meta Ads — les visuels des créas, dans le bucket `ad-creatives` ──────────

# Public, et pourquoi : `000_run_me_all.sql`, section 0bis, qui le crée.
BUCKET_CREAS = "ad-creatives"


def chemin_image(user_id: str, image_hash: str) -> str:
    """Un fichier par hash : la même image n'est jamais téléversée deux fois."""
    return f"{user_id}/{image_hash}"


def televerser_image(supabase_client, user_id: str, image_hash: str, url: str) -> str | None:
    """Télécharge l'image chez Meta et la range sous `chemin_image`.

    Rend l'URL publique du bucket, ou None si un des deux trajets échoue —
    jamais l'URL de Meta en repli, contrairement au patron Instagram
    (`_upload_image_to_storage`) : une URL qui expire dans `image_url` est un
    visuel qui disparaîtra sans prévenir.
    """
    try:
        r = http.get(url, timeout=20)
        if r.status_code != 200 or not r.content:
            return None
        chemin = chemin_image(user_id, image_hash)
        bucket = supabase_client.storage.from_(BUCKET_CREAS)
        bucket.upload(path=chemin, file=r.content, file_options={
            "content-type": r.headers.get("content-type") or "image/jpeg",
            "upsert": "true"})
        return bucket.get_public_url(chemin)
    except Exception:
        return None
