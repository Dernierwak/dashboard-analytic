"""`/me/adaccounts` — le compte publicitaire du jeton, et son fuseau."""
from __future__ import annotations

import re

from saas.data.fetch_data.sources.meta.graph_client import GRAPH, AccesMeta, lire
from saas.data.fetch_data.shared.date_ranges import Fenetre


def recuperer(acces: AccesMeta, fenetre: Fenetre | None = None,
              limite: int | None = None) -> tuple[list[dict], list[str]]:
    """Les comptes publicitaires du jeton (une seule page, comme avant).

    `fenetre` n'a pas de sens ici : un compte n'est pas daté.
    """
    data, err = lire(f"{GRAPH}/me/adaccounts",
                     {"fields": "id,timezone_name", "access_token": acces.jeton},
                     timeout=30)
    if err:
        return [], [err]
    comptes = data.get("data") or []
    return (comptes[:limite] if limite is not None else comptes), []


# Un identifiant de compte publicitaire, tel que Meta le rend dans `id`. Il part
# dans le CHEMIN de l'URL : on ne compose pas une adresse Graph avec un texte
# qui n'a pas cette forme.
_ID_COMPTE = re.compile(r"act_\d+")


def compte_choisi(acces: AccesMeta, compte_id: str) -> tuple[str | None, str | None, str | None]:
    """`/{act_…}?fields=id,timezone_name` → (le compte, son fuseau, erreur).

    LE COMPTE CHOISI SE LIT DIRECTEMENT, IL NE SE CHERCHE PAS DANS LA LISTE.
    `/me/adaccounts` est lu sur UNE page (25 comptes, le défaut de Graph) : un
    client d'agence en voit vite davantage, et le compte qu'il a désigné
    pouvait ne pas être dans la page lue. Un appel, comme la liste.

    Une erreur ne retombe JAMAIS sur le premier compte de la liste : les lignes
    d'un autre compte publicitaire s'écriraient sous le même `user_id`, mêlées
    à celles du compte choisi, sans que rien à l'écran ne le dise.
    """
    if not _ID_COMPTE.fullmatch(compte_id or ""):
        return None, None, "identifiant de compte publicitaire illisible (attendu : act_…)"
    data, err = lire(f"{GRAPH}/{compte_id}",
                     {"fields": "id,timezone_name", "access_token": acces.jeton},
                     timeout=30)
    if err:
        return None, None, err
    if not data.get("id"):
        return None, None, "Meta n'a pas rendu ce compte publicitaire"
    return data["id"], (str(data.get("timezone_name") or "").strip() or None), None


def compte_et_fuseau(comptes: list[dict]) -> tuple[str | None, str | None]:
    """`/me/adaccounts?fields=id,timezone_name` → (le compte lu, son fuseau).

    Le fuseau voyage avec chaque changement (ticket 17 de `.scratch/meta-ads/`) :
    Meta écrit `event_time` en UTC, alors que les jours des insights sont ceux
    du compte. Un fuseau absent rend None — jamais un fuseau supposé.
    """
    if not comptes:
        return None, None
    compte = comptes[0]
    return compte.get("id"), (str(compte.get("timezone_name") or "").strip() or None)
