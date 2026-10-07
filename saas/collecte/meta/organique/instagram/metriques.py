"""`/{media-id}` et `/{media-id}/insights` — le contenu et les métriques d'un post."""
from __future__ import annotations

from saas.collecte.meta.graph import GRAPH, AccesMeta
from saas.collecte.socle import http


def info_du_post(acces: AccesMeta, post_id: str) -> dict:
    """Légende, type, URL du média et date d'un post — la réponse brute de Meta."""
    params = {
        "fields": "caption,media_type,media_url,thumbnail_url,timestamp",
        "access_token": acces.jeton,
    }
    # Sans `timeout`, `requests` attend indéfiniment : un serveur Graph muet
    # tenait le worker jusqu'au plafond du job GitHub Actions (6 h).
    return http.get(f"{GRAPH}/{post_id}", params=params, timeout=30).json()


def metriques_du_post(acces: AccesMeta, post_id: str, media_type: str) -> dict:
    """Les métriques d'un post, et `follows` à part (deux appels).

    Une métrique absente vaut 0 ici, et c'est un défaut connu, pas un choix :
    `.scratch/recolte/tickets/10-…`. Ce fichier a seulement déménagé.
    """
    url = f"{GRAPH}/{post_id}/insights"
    if media_type in ("VIDEO", "REEL"):
        metric_list = "reach,saved,comments,views"
    else:
        metric_list = "likes,comments,saved,reach,views"
    params = {"metric": metric_list, "access_token": acces.jeton}
    data = http.get(url, params=params, timeout=30).json().get("data", [])
    metrics = {}
    for item in data:
        val = item.get("value")
        if val is None:
            val = item.get("values", [{}])[0].get("value", 0)
        metrics[item["name"]] = val or 0

    try:
        follows_data = http.get(url, params={**params, "metric": "follows"},
                                timeout=30).json().get("data", [])
        if follows_data:
            fd = follows_data[0]
            metrics["follows"] = fd.get("value") or fd.get("values", [{}])[0].get("value", 0)
        else:
            metrics["follows"] = 0
    except Exception:
        metrics["follows"] = 0
    return metrics


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
            sortie.append({"post_id": post_id, "info": info,
                           "metriques": metriques_du_post(
                               acces, post_id, info.get("media_type", "IMAGE"))})
        except Exception as e:
            trous.append(f"post {post_id} : {type(e).__name__}")
    return sortie, trous
