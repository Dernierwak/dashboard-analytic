"""`FROM campaign` — les insights par campagne × jour → google_ads_insights."""
from __future__ import annotations

from datetime import date

from saas.data.fetch_data.sources.google.client import AccesGoogle
from saas.data.fetch_data.sources.google.ads.fetchers._query import BASE, entetes
from saas.data.fetch_data.shared import http_client as http
from saas.data.fetch_data.shared.date_ranges import Fenetre, tranches


def tranche(
    access_token: str,
    customer_id: str,
    since: "date",
    until: "date",
    login_customer_id: str | None = None,
) -> tuple[list[dict], str | None]:
    """Fetch les insights par campagne × jour.
    Returns: (rows, error_message_or_None)
    Chaque row contient : campaign_id, campaign_name, date_start (str), impressions, clicks,
    cost_micros, conversions, ctr, avg_cpc_micros, status (effective_status).
    """
    query = f"""
        SELECT
          campaign.id,
          campaign.name,
          campaign.status,
          segments.date,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.ctr,
          metrics.average_cpc
        FROM campaign
        WHERE segments.date BETWEEN '{since.isoformat()}' AND '{until.isoformat()}'
        ORDER BY segments.date DESC
    """
    url = f"{BASE}/customers/{customer_id}/googleAds:searchStream"
    try:
        r = http.post(url, headers=entetes(access_token, login_customer_id),
                          json={"query": query}, timeout=60)
        data = r.json()
    except Exception as e:
        return [], f"Erreur API: {e}"

    # Vérifier erreur API
    if isinstance(data, dict) and "error" in data:
        err = data["error"]
        return [], err.get("message", str(err))

    rows = []
    batches = data if isinstance(data, list) else [data]
    for batch in batches:
        if isinstance(batch, dict) and "error" in batch:
            return [], batch["error"].get("message", str(batch["error"]))
        for row in batch.get("results", []):
            camp = row.get("campaign", {})
            seg = row.get("segments", {})
            m = row.get("metrics", {})
            rows.append({
                "campaign_id":    str(camp.get("id", "")),
                "campaign_name":  camp.get("name", ""),
                "effective_status": camp.get("status", ""),
                "date_start":     seg.get("date", ""),
                "impressions":    int(m.get("impressions", 0) or 0),
                "clicks":         int(m.get("clicks", 0) or 0),
                "cost_micros":    int(m.get("costMicros", 0) or 0),
                "conversions":    float(m.get("conversions", 0) or 0),
                "ctr":            float(m.get("ctr", 0) or 0),
                "avg_cpc_micros": int(m.get("averageCpc", 0) or 0),
            })
    return rows, None


def recuperer(acces: AccesGoogle, fenetre: Fenetre,
              limite: int | None = None) -> tuple[list[dict], list[str]]:
    """Les tranches de 90 jours de la fenêtre → (lignes, trous).

    Une tranche refusée était jetée sans un mot (`if not err`) : la run restait
    verte et le mot disait « N lignes » sur une période trouée. Et le trou peut
    être définitif — une tranche plus vieille que le recouvrement n'est jamais
    redemandée, puisque la reprise part de la dernière date en base.
    """
    lignes, trous = [], []
    for debut, fin in tranches(fenetre.debut, fenetre.fin):
        if limite is not None and len(lignes) >= limite:
            break
        lot, err = tranche(acces.jeton, acces.client, debut, fin, acces.login)
        if err:
            trous.append(f"{debut.isoformat()}→{fin.isoformat()} : {err}")
        else:
            lignes += lot
    return (lignes[:limite] if limite is not None else lignes), trous


def total_client(acces: AccesGoogle, fenetre: Fenetre) -> tuple[float | None, str | None]:
    """Le coût du COMPTE (`FROM customer`) sur la fenêtre, en micros.

    Sert l'essai : la somme des campagnes doit retomber sur ce total.
    """
    query = f"""
        SELECT metrics.cost_micros
        FROM customer
        WHERE segments.date BETWEEN '{fenetre.debut.isoformat()}' AND '{fenetre.fin.isoformat()}'
    """
    url = f"{BASE}/customers/{acces.client}/googleAds:searchStream"
    try:
        data = http.post(url, headers=entetes(acces.jeton, acces.login),
                         json={"query": query}, timeout=60).json()
    except Exception as e:
        return None, f"Erreur API: {e}"
    if isinstance(data, dict) and "error" in data:
        return None, data["error"].get("message", str(data["error"]))
    total = 0
    for batch in data if isinstance(data, list) else [data]:
        if isinstance(batch, dict) and "error" in batch:
            return None, batch["error"].get("message", str(batch["error"]))
        for row in batch.get("results", []):
            total += int((row.get("metrics") or {}).get("costMicros", 0) or 0)
    return float(total), None
