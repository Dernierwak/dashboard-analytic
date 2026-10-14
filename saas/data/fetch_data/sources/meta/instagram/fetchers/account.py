"""`/{ig-user}?fields=followers_count` — le compte Instagram lui-même."""
from __future__ import annotations

from saas.data.fetch_data.sources.meta.graph_client import GRAPH, AccesMeta, lire
from saas.data.fetch_data.shared.date_ranges import Fenetre


def recuperer(acces: AccesMeta, fenetre: Fenetre | None = None,
              limite: int | None = None) -> tuple[list[dict], list[str]]:
    """`[{followers_count, media_count}]` — une seule ligne. Pas datée : `fenetre` est ignorée.

    `media_count` sert l'essai : l'inventaire des posts doit en avoir autant.
    Même requête, un champ de plus : zéro appel supplémentaire.
    """
    data, err = lire(f"{GRAPH}/{acces.instagram}",
                     {"fields": "followers_count,media_count", "access_token": acces.jeton},
                     timeout=30)
    if err:
        return [], [err]
    return [data], []
