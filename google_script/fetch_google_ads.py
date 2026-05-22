"""Fetch Google Ads via Google Ads API REST.

Doc API : https://developers.google.com/google-ads/api/rest/

Endpoint principal : POST /v17/customers/{customerId}/googleAds:searchStream
Body : { "query": "<GAQL query>" }
Headers requis :
  - Authorization: Bearer <access_token>
  - developer-token: <DEVELOPER_TOKEN>
  - login-customer-id: <MCC ID> (optionnel, si manager account)

Note : tous les montants sont en MICROS (1 CHF = 1_000_000 micros).
"""

from datetime import date, timedelta
import requests
import streamlit as st

from google_script.fetch_token import get_access_token_from_refresh


_API_VERSION = "v17"
_BASE = f"https://googleads.googleapis.com/{_API_VERSION}"


def _headers(access_token: str, login_customer_id: str | None = None) -> dict:
    h = {
        "Authorization":   f"Bearer {access_token}",
        "developer-token": st.secrets.google_ads.developer_token,
        "Content-Type":    "application/json",
    }
    # Si on passe par un MCC (manager account), spécifier l'ID parent
    try:
        mcc = login_customer_id or st.secrets.google_ads.login_customer_id
        if mcc:
            h["login-customer-id"] = str(mcc).replace("-", "")
    except Exception:
        pass
    return h


def list_accessible_customers(access_token: str) -> list[str]:
    """Liste les customer_ids accessibles avec ce token. Returns ['1234567890', ...]."""
    url = f"{_BASE}/customers:listAccessibleCustomers"
    try:
        r = requests.get(url, headers=_headers(access_token), timeout=15).json()
        # Format : {"resourceNames": ["customers/1234567890", ...]}
        names = r.get("resourceNames", [])
        return [n.split("/")[-1] for n in names]
    except Exception:
        return []


def list_managed_accounts(access_token: str, manager_customer_id: str) -> list[dict]:
    """Liste les comptes gérés par un MCC. Retourne [{id, name, currency_code}, ...]."""
    query = """
        SELECT
          customer_client.client_customer,
          customer_client.descriptive_name,
          customer_client.currency_code,
          customer_client.manager
        FROM customer_client
        WHERE customer_client.level <= 1
    """
    url = f"{_BASE}/customers/{manager_customer_id}/googleAds:searchStream"
    try:
        r = requests.post(url, headers=_headers(access_token, manager_customer_id),
                          json={"query": query}, timeout=20)
        data = r.json()
    except Exception:
        return []
    out = []
    # searchStream renvoie une liste de batches
    batches = data if isinstance(data, list) else [data]
    for batch in batches:
        for row in batch.get("results", []):
            cc = row.get("customerClient", {})
            cid = (cc.get("clientCustomer") or "").split("/")[-1]
            if cid and not cc.get("manager"):  # exclure sous-MCC
                out.append({
                    "id": cid,
                    "name": cc.get("descriptiveName", ""),
                    "currency_code": cc.get("currencyCode", ""),
                })
    return out


def fetch_campaign_insights(
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
    url = f"{_BASE}/customers/{customer_id}/googleAds:searchStream"
    try:
        r = requests.post(url, headers=_headers(access_token, login_customer_id),
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


def fetch_campaign_statuses(
    access_token: str,
    customer_id: str,
    login_customer_id: str | None = None,
) -> tuple[dict[str, tuple[str, str]], str | None]:
    """Fetch statut courant de chaque campagne (sans données d'insights).
    Returns: ({campaign_id: (campaign_name, status)}, error_or_None)
    """
    query = """
        SELECT campaign.id, campaign.name, campaign.status
        FROM campaign
    """
    url = f"{_BASE}/customers/{customer_id}/googleAds:searchStream"
    try:
        r = requests.post(url, headers=_headers(access_token, login_customer_id),
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
                out[cid] = (camp.get("name", ""), camp.get("status", ""))
    return out, None
