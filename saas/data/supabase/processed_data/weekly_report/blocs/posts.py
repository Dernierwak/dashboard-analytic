"""`frise.posts` : les posts Instagram de l'année, sans aucun chiffre (ticket 08).

AUCUNE MÉTRIQUE. Le panneau Organique montre ce qui a été publié, pas comment
ça a marché : un post porte sa plateforme, son jour, son format, son visuel et
son lien, rien d'autre.

LE FORMAT NE S'INVENTE PAS. Meta dit `VIDEO` aussi bien pour une vidéo du fil
que pour un Reel ; seul `media_product_type == "REELS"` fait d'un post un Reel.
Les posts récoltés avant ce ticket n'ont pas `media_product_type` (la récolte
n'en relit qu'une partie, `instagram/sync.py:_a_relire`) : ils restent `VIDEO`.
Même chose pour le lien : sans `permalink`, `lien` vaut None — une URL
reconstruite depuis l'ID serait fausse (le permalink porte un code court, pas
l'ID Graph).

LE RAPPORT EST FIGÉ À `semaine.fin`, comme la frise des campagnes : le jour du
fetch et ce qui suit n'entrent pas. Le jour d'un post est son jour UTC, comme
l'ancienne frise — Instagram ne donne pas le fuseau du compte.
"""

from __future__ import annotations

from saas.data.supabase.processed_data.weekly_report.blocs.semaine import Semaine

# Les `media_type` que Meta documente pour un post du fil. Un autre (une story,
# un type futur) rend `format: None` : la page dit « Autre » plutôt qu'un nom
# deviné.
FORMATS = {"IMAGE", "CAROUSEL_ALBUM", "VIDEO"}


def frise_posts(lecteur, semaine: Semaine) -> list[dict] | None:
    """Les posts de l'année de `semaine.fin`, jusqu'à elle, triés par jour.

    None quand le compte n'a ni post ni couverture Instagram : il n'a pas
    d'Instagram, et l'onglet Organique ne doit pas apparaître. Une liste vide
    avec couverture est une vraie année sans post.
    """
    try:
        lignes = lecteur.publications() or []
    except Exception:
        return None
    if not lignes and not _instagram_recolte(lecteur):
        return None

    annee, fin = str(semaine.fin.year), semaine.fin.isoformat()
    posts = []
    for ligne in lignes:
        jour = str(ligne.get("date") or "")[:10]
        if len(jour) != 10 or jour[:4] != annee or jour > fin:
            continue
        posts.append({
            "plateforme": "instagram",
            "date": jour,
            "format": _format(ligne),
            "visuel": ligne.get("media_url") or None,
            "lien": ligne.get("permalink") or None,
        })
    return sorted(posts, key=lambda p: p["date"])


def _format(ligne: dict) -> str | None:
    type_ = str(ligne.get("type") or "").upper()
    if type_ not in FORMATS:
        return None
    if type_ == "VIDEO" and ligne.get("media_product_type") == "REELS":
        return "REEL"
    return type_


def _instagram_recolte(lecteur) -> bool:
    try:
        couverture = lecteur.couverture() or []
    except Exception:
        return False
    return any(c.get("source") == "instagram" and c.get("flux") == "posts" for c in couverture)
