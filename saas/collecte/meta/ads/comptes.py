"""`/me/adaccounts` — le compte publicitaire du jeton, et son fuseau."""
from __future__ import annotations

from saas.collecte.meta.graph import GRAPH, AccesMeta, lire
from saas.collecte.socle.fenetre import Fenetre


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
