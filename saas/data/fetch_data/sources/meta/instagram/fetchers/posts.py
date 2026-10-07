"""`/{ig-user}/media` — l'inventaire des posts du compte Instagram (id, date)."""
from __future__ import annotations

from saas.data.fetch_data.sources.meta.graph_client import GRAPH, AccesMeta, pages
from saas.data.fetch_data.shared.date_ranges import Fenetre

# Plafond de pages sur l'inventaire des médias. À 100 par page, 60 pages =
# 6 000 posts : au-delà, ce n'est plus un compte de marque, et une boucle sans
# fin coûterait le passage de TOUS les autres utilisateurs. Le chiffre borne
# aussi le pire cas en temps — 60 requêtes à 30 s de délai d'attente.
_MEDIA_PAGES_MAX = 60


def recuperer(acces: AccesMeta, fenetre: Fenetre | None = None,
              limite: int | None = None) -> tuple[list[dict], list[str]]:
    """Tous les posts du compte, `[{id, timestamp}]`, dans l'ordre de Meta.

    L'inventaire est COMPLET par construction (`total_posts` est un décompte
    de tout l'historique) : `fenetre` ne s'applique pas.
    """
    params = {
        "fields": "id,timestamp",
        "access_token": acces.jeton,
        # LE POSTE LE PLUS BAVARD DE LA RÉCOLTE, POUR RIEN. Cette boucle
        # parcourt TOUT l'historique média du compte, et elle le faisait SANS
        # `limit`, donc par pages de 25, le défaut du Graph API : un compte à
        # 1 000 posts payait 40 allers-retours uniquement pour compter.
        #
        # 100 plutôt que 25 : la taille maximale de page n'est PAS fermement
        # documentée pour cette edge (la référence de la pagination par curseur
        # décrit `limit` comme « the maximum number of objects that may be
        # returned » et prévient de ne pas déduire la fin d'une page plus
        # courte que demandé). Ce qui rend le choix SANS RISQUE, c'est la
        # condition d'arrêt : la pagination s'arrête sur l'ABSENCE de `next`,
        # jamais sur un compte de lignes. Le pire cas est « aucun gain », pas
        # « données tronquées ».
        "limit": 100,
    }
    medias, err = pages(f"{GRAPH}/{acces.instagram}/media", params, timeout=30,
                        pages_max=_MEDIA_PAGES_MAX, limite=limite)
    return medias, ([err] if err else [])
