"""`/act_…/campaigns` — les campagnes DÉCLARÉES, statut et dates programmées."""
from __future__ import annotations

from saas.collecte.meta.graph import GRAPH, AccesMeta, pages
from saas.collecte.socle.fenetre import Fenetre

_CAMPAGNES_PAR_PAGE = 200
# LE PLAFOND N'EST PAS UNE LIMITE DE PRODUIT, C'EST UN COUPE-CIRCUIT. Meta sait
# rendre une page VIDE qui porte encore un `paging.next` ; le curseur tourne
# alors en rond, à 30 s par requête, et le worker de ce client n'arrive jamais
# au bout — sans une ligne de journal. Cinquante pages, c'est dix mille
# campagnes : aucun compte Pulse n'en approche, et le jour où l'un s'en
# approcherait, il le lirait dans le journal au lieu de découvrir une run qui ne
# finit pas.
_CAMPAGNES_PAGES_MAX = 50


def recuperer(acces: AccesMeta, fenetre: Fenetre | None = None,
              limite: int | None = None) -> tuple[list[dict], list[str]]:
    """Les campagnes DÉCLARÉES du compte — toutes, `paging.next` suivi au bout.

    Une seule page valait 200 campagnes et le curseur était ignoré : au-delà,
    la liste était tronquée SANS UN MOT, et la 201e campagne recevait le même
    `UNKNOWN` qu'une campagne dont Meta ignore vraiment le statut. C'est le
    piège de `CLAUDE.md` §8 sur PostgREST (« au-delà, il tronque en silence »)
    sur une autre API.

    Cette liste ne porte aucune dépense : son échec ne doit jamais coûter la
    semaine d'insights. Elle rend donc son erreur au lieu de lever.
    `fenetre` n'a pas de sens ici : une campagne déclarée n'est pas datée.
    """
    params = {"access_token": acces.jeton,
              "fields": "id,name,effective_status,start_time,stop_time",
              "limit": _CAMPAGNES_PAR_PAGE}
    campagnes, err = pages(f"{GRAPH}/{acces.compte}/campaigns", params, timeout=30,
                           pages_max=_CAMPAGNES_PAGES_MAX, limite=limite)
    return campagnes, ([err] if err else [])


def lignes_config_meta(user_id: str, campagnes: list[dict]) -> tuple[list[dict], int]:
    """Les campagnes DÉCLARÉES (/campaigns) → les lignes de meta_campaign_config.

    Pure, sans réseau. Rend (lignes, nombre de campagnes sans id).

    LA LIGNE SE RATTACHE PAR L'ID, LE NOM N'EST QU'UNE ÉTIQUETTE QUI SUIT.
    Une campagne renommée dans Meta perdait sa ligne : la clé par nom en
    créait une seconde au nouveau nom, et l'ancienne gardait le statut et les
    dates d'une campagne qui n'existait plus sous ce nom (spec
    `.scratch/meta-ads/spec.md`, « L'identité par ID » ; ticket 13).
    """
    def _jour(v):
        return str(v)[:10] if v else None

    lignes, vus, sans_id = [], set(), 0
    for c in campagnes:
        campaign_id = c.get("id")
        # Meta rend toujours `id` sur /campaigns. Une ligne sans lui ne pourrait
        # se rattacher que par le nom — c'est exactement ce que ce seam retire.
        if not campaign_id:
            sans_id += 1
            continue
        if campaign_id in vus:
            continue
        vus.add(campaign_id)
        lignes.append({
            "user_id": user_id,
            "campaign_id": str(campaign_id),
            "campaign_name": c.get("name") or "",
            "effective_status": c.get("effective_status") or None,
            "start_date": _jour(c.get("start_time")),
            # stop_time absent = campagne sans date de fin programmée.
            "end_date": _jour(c.get("stop_time")),
        })
    return lignes, sans_id


