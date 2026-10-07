"""`/act_…/insights` au niveau annonce, jour par jour → lignes de meta_ads_insights."""
from __future__ import annotations

import json

from saas.collecte.meta.graph import GRAPH, AccesMeta, pages
from saas.collecte.socle.fenetre import Fenetre, tranches

# `ad_id` porte l'identité de l'annonce ; `ad_name` n'est qu'une étiquette que
# l'annonceur peut réutiliser à volonté. Sans lui, deux annonces homonymes se
# confondent et la dépense de la seconde n'entre jamais en base (voir
# `upsert_meta_ads` et la section ad_id de 000_run_me_all.sql). Même raison pour
# `campaign_id` et `adset_id` : une campagne renommée reste une campagne
# (`.scratch/meta-ads/spec.md`, « L'identité par ID »). `results` est la colonne
# « Résultats » d'Ads Manager, et `attribution_setting` dit selon quel réglage
# elle est comptée (`.scratch/meta-ads/recherche/colonne-resultats.md`). Champs
# de la même requête : zéro appel de plus.
_CHAMPS = ("campaign_name,campaign_id,adset_name,adset_id,ad_name,ad_id,"
           "impressions,clicks,reach,spend,actions,results,"
           "attribution_setting,date_start")


def tranche(acces: AccesMeta, debut: str, fin: str,
            limite: int | None = None) -> tuple[list[dict], str | None]:
    """Une tranche d'insights (YYYY-MM-DD, bornes comprises) → (lignes, erreur).

    LA TRANCHE DIT SI ELLE EST COMPLÈTE — elle ne rend plus une liste vide pour
    « échec » ET pour « ce compte n'a rien dépensé ». Les deux se confondaient,
    et le rejeu d'historique rend la confusion coûteuse : une limite de débit
    Meta au milieu d'un rejeu de treize tranches en perdait quatre-vingt-dix
    jours, sans un mot, sur une run verte. Une pagination interrompue rend une
    tranche TRONQUÉE, pas vide : c'est le cas le plus traître, il se dit aussi.
    """
    params = {
        "access_token": acces.jeton, "level": "ad", "fields": _CHAMPS,
        "time_increment": 1,
        "time_range": json.dumps({"since": debut, "until": fin}),
        "limit": 500,
    }
    lignes, err = pages(f"{GRAPH}/{acces.compte}/insights", params, timeout=60,
                        limite=limite)
    return lignes, (f"{debut}→{fin} : {err}" if err else None)


def recuperer(acces: AccesMeta, fenetre: Fenetre,
              limite: int | None = None) -> tuple[list[dict], list[str]]:
    """Toutes les tranches de 90 jours de la fenêtre → (lignes brutes, trous)."""
    lignes, trous = [], []
    for debut, fin in tranches(fenetre.debut, fenetre.fin):
        reste = None if limite is None else limite - len(lignes)
        if reste is not None and reste <= 0:
            break
        lot, err = tranche(acces, debut.isoformat(), fin.isoformat(), reste)
        lignes += lot
        if err:
            trous.append(err)
    return lignes, trous


def _link_clicks(actions) -> int | None:
    # Deux absences à ne pas confondre (`.scratch/meta-ads/tickets/30-…`) :
    # Meta omet de `actions` les types d'action à zéro — `actions` présent sans
    # `link_click` est donc un vrai 0 ; `actions` absent de la réponse, on ne
    # sait pas, et la colonne nullable reçoit NULL plutôt qu'un 0 inventé.
    if actions is None:
        return None
    lc = next((it for it in actions if it.get("action_type") == "link_click"), None)
    return int(lc.get("value", 0)) if lc else 0


def lignes_meta_ads(user_id: str, reponse: list[dict]) -> tuple[list[dict], int]:
    """Les lignes de /insights (niveau `ad`) → les lignes de meta_ads_insights.

    Pure, sans réseau : c'est le seam de test de la récolte Meta (spec
    `.scratch/meta-ads/spec.md`, « Testing Decisions »). Rend (lignes, nombre de lignes sans ad_id).

    LA CLÉ EST `ad_id`, PAS `ad_name`, ET ÇA A COÛTÉ DE LA DÉPENSE RÉELLE.
    `ad_name` est l'étiquette lisible que l'annonceur choisit : rien n'interdit
    deux annonces « Video 1 » dans deux Groupes, et c'est le montage courant.
    Tant que la déduplication portait sur le nom, la seconde annonce n'était
    pas mal attribuée — elle n'entrait jamais en base. Mesuré sur le compte de
    test au 19-20/08/2026 : ~17 € puis ~15 €, environ 40 % de la dépense Meta
    de ces jours-là. `ad_id` est le numéro que Meta attribue à la création, il
    n'est jamais dupliqué.
    """
    seen = set()
    records = []
    sans_id = 0
    for row in reponse:
        ad_id = row.get("ad_id")
        # Une ligne sans ad_id ne peut pas être dédupliquée : elle n'entrerait
        # en conflit avec rien (Postgres ne rapproche jamais deux NULL sous une
        # contrainte UNIQUE) et se réinsèrerait à chaque récolte, doublant la
        # dépense du jour. Meta renvoie toujours ad_id au niveau `ad` ; si ça
        # change un jour, on veut le voir dans le journal, pas le découvrir
        # dans un total qui enfle.
        if not ad_id:
            sans_id += 1
            continue
        key = (row.get("date_start"), ad_id)
        if key in seen:
            continue
        seen.add(key)
        records.append({
            "user_id": user_id,
            "date_start": row.get("date_start"),
            "ad_id": str(ad_id),
            # Les IDs sont recopiés, jamais reconstitués depuis un nom : une
            # ligne sans ID reste sans ID (`.scratch/meta-ads/spec.md`,
            # « L'identité par ID »).
            "campaign_id": str(row["campaign_id"]) if row.get("campaign_id") else None,
            "adset_id": str(row["adset_id"]) if row.get("adset_id") else None,
            "campaign_name": row.get("campaign_name", ""),
            "adset_name": row.get("adset_name", ""),
            "ad_name": row.get("ad_name", ""),
            "impressions": int(row.get("impressions") or 0),
            "clicks": int(row.get("clicks") or 0),
            "reach": int(row.get("reach") or 0) if row.get("reach") is not None else None,
            "link_clicks": _link_clicks(row.get("actions")),
            "spend": float(row.get("spend") or 0),
            "attribution_setting": row.get("attribution_setting"),
            # La colonne « Résultats » d'Ads Manager, TELLE QUE META LA REND :
            # sa forme d'élément n'est documentée nulle part
            # (`.scratch/meta-ads/recherche/colonne-resultats.md`), elle se lit dans la base avant d'être
            # affichée. `.get` garde la distinction qui compte : champ absent
            # → NULL, liste vide → liste vide. Ni l'un ni l'autre n'est un 0.
            "results": row.get("results"),
        })
    return records, sans_id


def total_compte(acces: AccesMeta, fenetre: Fenetre) -> tuple[float | None, str | None]:
    """La dépense du COMPTE entier sur la fenêtre, telle que Meta l'additionne.

    Sert l'essai (ticket 08 de `.scratch/recolte/`) : la somme des lignes par
    annonce doit retomber sur ce total, sinon une page ou une tranche manque.
    Une seule requête, `level=account`, sans découpage par jour.
    """
    params = {"access_token": acces.jeton, "level": "account", "fields": "spend",
              "time_range": json.dumps({"since": fenetre.debut.isoformat(),
                                        "until": fenetre.fin.isoformat()})}
    lignes, err = pages(f"{GRAPH}/{acces.compte}/insights", params, timeout=60)
    if err:
        return None, err
    # Aucune ligne = aucune dépense déclarée sur la fenêtre : Meta n'écrit pas
    # de ligne à zéro. C'est un vrai 0 ici, et il se compare à une somme vide.
    return sum(float(r.get("spend") or 0) for r in lignes), None
