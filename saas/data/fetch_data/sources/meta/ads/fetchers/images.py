"""`/act_…/adimages?hashes=[…]` — l'URL de téléchargement d'un visuel, par son hash."""
from __future__ import annotations

import json

from saas.data.fetch_data.sources.meta.graph_client import GRAPH, AccesMeta, lire

# Les hashes voyagent dans l'URL de `/adimages` : un lot borné garde la requête
# loin des limites de longueur d'URL. 50 hashes de 32 caractères ≈ 2 Ko.
_HASHES_PAR_APPEL = 50


def recuperer(acces: AccesMeta, hashes: list[str],
              limite: int | None = None) -> tuple[dict[str, str], list[str]]:
    """`image_hash` → URL de téléchargement chez Meta, et les lots refusés.

    Seul fichier d'API Meta qui ne prend pas de fenêtre : il lit les hashes
    que les créas ont nommés. Un appel par lot de hashes, pas un par image.
    L'URL rendue est « temporary » : elle sert au téléchargement de ce passage
    et ne s'écrit jamais en base. Un hash que Meta ne rend pas reste sans URL,
    il sera redemandé au passage suivant.
    """
    if limite is not None:
        hashes = hashes[:limite]
    urls: dict[str, str] = {}
    trous: list[str] = []
    for i in range(0, len(hashes), _HASHES_PAR_APPEL):
        lot = hashes[i:i + _HASHES_PAR_APPEL]
        # `limit` = la taille du lot : sans lui, la page par défaut du Graph API
        # peut rendre moins d'images que de hashes demandés, et le reste
        # attendrait un passage de plus sans le dire.
        rep, err = lire(f"{GRAPH}/{acces.compte}/adimages", {
            "access_token": acces.jeton, "hashes": json.dumps(lot),
            "fields": "hash,url", "limit": len(lot),
        }, timeout=60)
        if err:
            trous.append(f"lot d'images refusé — {err}")
            continue
        for image in rep.get("data") or []:
            if image.get("hash") and image.get("url"):
                urls[str(image["hash"])] = str(image["url"])
    return urls, trous
