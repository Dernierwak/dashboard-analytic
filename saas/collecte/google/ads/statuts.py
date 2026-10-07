"""Statut et dates DÉCLARÉES de chaque campagne Google Ads (sans insights)."""
from __future__ import annotations

from saas.collecte.google.acces import AccesGoogle
from saas.collecte.google.ads.gaql import BASE, entetes, fin_declaree
from saas.collecte.socle import http
from saas.collecte.socle.fenetre import Fenetre


def fetch_campaign_statuses(
    access_token: str,
    customer_id: str,
    login_customer_id: str | None = None,
) -> tuple[dict[str, tuple[str, str, str | None, str | None]], str | None]:
    """Fetch statut ET dates declarees de chaque campagne (sans insights).

    Returns: ({campaign_id: (name, status, start_date, end_date)}, error|None)
    `end_date` None = declaree sans date de fin (sentinelle 2037 normalisee).
    """
    query = """
        SELECT campaign.id, campaign.name, campaign.status,
               campaign.start_date, campaign.end_date
        FROM campaign
    """
    url = f"{BASE}/customers/{customer_id}/googleAds:searchStream"
    try:
        r = http.post(url, headers=entetes(access_token, login_customer_id),
                          json={"query": query}, timeout=20)
        data = r.json()
    except Exception as e:
        return {}, f"Erreur API: {e}"

    if isinstance(data, dict) and "error" in data:
        return {}, data["error"].get("message", "inconnue")

    out = {}
    batches = data if isinstance(data, list) else [data]
    for batch in batches:
        for row in batch.get("results", []):
            camp = row.get("campaign", {})
            cid = str(camp.get("id", ""))
            if cid:
                out[cid] = (
                    camp.get("name", ""),
                    camp.get("status", ""),
                    camp.get("startDate") or camp.get("start_date") or None,
                    fin_declaree(camp.get("endDate") or camp.get("end_date")),
                )
    return out, None


def recuperer(acces: AccesGoogle, fenetre: Fenetre | None = None,
              limite: int | None = None) -> tuple[list[dict], list[str]]:
    """[{campaign_id, name, status, start_date, end_date}], trous. Pas daté.

    La récolte lit le dictionnaire de `fetch_campaign_statuses` (les noms
    servent à `change_event`) ; cette forme en lignes sert l'essai.
    """
    carte, err = fetch_campaign_statuses(acces.jeton, acces.client, acces.login)
    lignes = [{"campaign_id": cid, "name": v[0], "status": v[1],
               "start_date": v[2], "end_date": v[3]} for cid, v in carte.items()]
    return (lignes[:limite] if limite is not None else lignes), ([err] if err else [])
