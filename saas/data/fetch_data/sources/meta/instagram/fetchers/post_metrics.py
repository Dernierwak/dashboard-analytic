"""`/{media-id}` et `/{media-id}/insights` — le contenu et les métriques d'un post."""
from __future__ import annotations

from dataclasses import dataclass

from saas.data.fetch_data.sources.meta.graph_client import GRAPH, AccesMeta
from saas.data.fetch_data.shared import http_client as http
from saas.data.fetch_data.shared.http_client import sans_jeton

# R1 (spec § La récolte — Ce qui se corrige) : un appel multi-métriques est
# refusé EN ENTIER (erreur 100) dès qu'une métrique ne s'applique pas au
# produit. Ces six-là valent pour REELS comme pour FEED — l'essai réel
# (`.scratch/instagram/issues/17`) les a lues sur les deux. L'ancienne liste
# « vidéo » oubliait `likes` : d'où les j'aime à 0 des 124 vidéos en base.
_PRINCIPALES = ("reach", "views", "likes", "comments", "saved", "shares")
# FEED seul : un Reel répond « does not support the follows metric for this
# media product type » (essai réel, point 4). Appel à part, pour que ce refus
# n'emporte pas la portée.
_ABONNES = ("follows", "profile_visits")
# REELS seul. Nom relevé dans la doc Media Insights (`ig_reels_avg_watch_time`,
# en millisecondes d'après elle), JAMAIS essayé avec notre jeton : le premier
# passage du worker dira s'il revient.
# https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights
_TEMPS_DE_VISIONNAGE = "ig_reels_avg_watch_time"
# La colonne n'emprunte pas le préfixe de Meta.
_COLONNE = {_TEMPS_DE_VISIONNAGE: "avg_watch_time"}
# Ce que la fiche attend : une métrique non demandée ou non rendue y vaut None.
_VIDE = {_COLONNE.get(m, m): None for m in _PRINCIPALES + _ABONNES + (_TEMPS_DE_VISIONNAGE,)}
# « (#100) … does not support … » : la métrique ne s'applique pas à ce média.
_NON_SUPPORTEE = 100


@dataclass(frozen=True)
class _Refus:
    """Un appel insights refusé — le code sépare une absence (100) d'une panne."""
    code: int | None
    message: str


def info_du_post(acces: AccesMeta, post_id: str) -> dict:
    """Légende, type, URL du média, date, lien public et produit d'un post — la
    réponse brute de Meta, `{"error": …}` compris : l'appelant le teste.

    `permalink` et `media_product_type` (ticket 08 de `.scratch/hebdo/`) se
    lisent avec la même permission `instagram_basic` que les autres champs :
    aucun re-consentement. `media_product_type` est le seul à dire si un `VIDEO`
    est un Reel (`REELS`) ou une vidéo du fil (`FEED`)."""
    params = {
        "fields": "caption,media_type,media_url,thumbnail_url,timestamp,"
                  "permalink,media_product_type",
        "access_token": acces.jeton,
    }
    # Sans `timeout`, `requests` attend indéfiniment : un serveur Graph muet
    # tenait le worker jusqu'au plafond du job GitHub Actions (6 h).
    return http.get(f"{GRAPH}/{post_id}", params=params, timeout=30).json()


def metriques_du_post(acces: AccesMeta, post_id: str,
                      media_product_type: str | None) -> dict | None:
    """Les métriques d'un post → `{colonne: valeur ou None}`, ou None si la
    lecture a échoué.

    None pour le tout n'est pas « rien » : c'est une panne, et la récolte
    n'écrit alors ni métrique ni relevé — sinon des None effaceraient de bonnes
    valeurs déjà en base. None pour une métrique est ce que Meta n'a pas rendu :
    jamais 0 (`CLAUDE.md` §7).
    """
    url = f"{GRAPH}/{post_id}/insights"
    if media_product_type == "REELS":
        lues = _lire_insights(url, acces, _PRINCIPALES + (_TEMPS_DE_VISIONNAGE,))
        if isinstance(lues, _Refus) and lues.code == _NON_SUPPORTEE:
            # Le nom du temps de visionnage vient de la doc, pas d'un essai :
            # s'il est refusé, il ne doit pas emporter la portée avec lui.
            lues = _lire_insights(url, acces, _PRINCIPALES)
        return None if isinstance(lues, _Refus) else {**_VIDE, **lues}

    lues = _lire_insights(url, acces, _PRINCIPALES)
    if isinstance(lues, _Refus):
        return None
    # R4 : sans `media_product_type`, rien ne dit que ce n'est pas un Reel —
    # qui refuserait `follows` ; on ne le demande donc qu'au FEED déclaré.
    if media_product_type != "FEED":
        return {**_VIDE, **lues}
    abonnes = _lire_insights(url, acces, _ABONNES)
    if isinstance(abonnes, _Refus):
        if abonnes.code != _NON_SUPPORTEE:
            return None
        abonnes = {}
    return {**_VIDE, **lues, **abonnes}


def _lire_insights(url: str, acces: AccesMeta, metriques: tuple[str, ...]) -> dict | _Refus:
    """Un appel `/insights` → `{colonne: valeur ou None}`, ou son refus.

    `graph_client.lire` jette le code d'erreur, or c'est lui qui sépare « ne
    s'applique pas » (100, une absence) d'une panne (jeton, limite, réseau).
    Une exception réseau devient un refus au lieu d'arrêter la récolte du compte.
    """
    params = {"metric": ",".join(metriques), "access_token": acces.jeton}
    try:
        corps = http.get(url, params=params, timeout=30).json()
    except Exception as e:
        return _Refus(None, sans_jeton(f"{type(e).__name__}: {e}"))
    if not isinstance(corps, dict):
        return _Refus(None, f"réponse Meta inattendue ({type(corps).__name__})")
    if corps.get("error"):
        err = corps["error"] if isinstance(corps["error"], dict) else {}
        return _Refus(err.get("code"), err.get("message") or "erreur Meta")
    lues = {}
    for item in corps.get("data") or []:
        nom = item.get("name")
        if nom in metriques:
            lues[_COLONNE.get(nom, nom)] = _valeur(item)
    return lues


def _valeur(item: dict):
    """La valeur d'une métrique, quelle que soit sa forme — None si absente.

    `period=lifetime` la rend dans `values[0].value` (essai réel, point 5) ;
    d'autres la rendent à plat (`value`) ou en `total_value.value`. Un 0 rendu
    reste 0 : seule l'absence vaut None.
    """
    if item.get("value") is not None:
        return item["value"]
    valeurs = item.get("values") or []
    if valeurs and isinstance(valeurs[0], dict) and valeurs[0].get("value") is not None:
        return valeurs[0]["value"]
    total = item.get("total_value")
    return total.get("value") if isinstance(total, dict) else None


def recuperer(acces: AccesMeta, post_ids: list[str],
              limite: int | None = None) -> tuple[list[dict], list[str]]:
    """`[{post_id, info, metriques}]` pour une liste de posts — la forme qu'utilise l'essai.

    Ne prend pas de fenêtre : il lit les posts que l'inventaire a nommés. La
    récolte appelle `info_du_post` et `metriques_du_post` elle-même, pour
    marquer l'avancement post par post.
    """
    sortie, trous = [], []
    for post_id in post_ids[:limite] if limite is not None else post_ids:
        try:
            info = info_du_post(acces, post_id)
            if info.get("error"):
                trous.append(f"post {post_id} : fiche refusée par Meta")
                continue
            metriques = metriques_du_post(acces, post_id, info.get("media_product_type"))
            if metriques is None:
                trous.append(f"post {post_id} : métriques refusées par Meta")
            sortie.append({"post_id": post_id, "info": info, "metriques": metriques})
        except Exception as e:
            trous.append(f"post {post_id} : {type(e).__name__}")
    return sortie, trous
