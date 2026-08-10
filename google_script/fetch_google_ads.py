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

from google_script.fetch_token import get_access_token_from_refresh
from scripts.app_secrets import secret


# ⚠ Google retire les versions API tous les ~12 mois. Adapter si 404 sur l'endpoint.
# Versions supportées actuellement : v19, v20, v21 (mai 2026)
# Doc : https://developers.google.com/google-ads/api/docs/release-notes
_API_VERSION = "v21"
_BASE = f"https://googleads.googleapis.com/{_API_VERSION}"


def _headers(access_token: str, login_customer_id: str | None = None) -> dict:
    h = {
        "Authorization":   f"Bearer {access_token}",
        "developer-token": secret("google_ads.developer_token"),
        "Content-Type":    "application/json",
    }
    # Si on passe par un MCC (manager account), spécifier l'ID parent
    try:
        mcc = login_customer_id or secret("google_ads.login_customer_id")
        if mcc:
            h["login-customer-id"] = str(mcc).replace("-", "")
    except Exception:
        pass
    return h


def list_accessible_customers(access_token: str) -> tuple[list[str], str | None]:
    """Liste les customer_ids accessibles avec ce token.
    Returns: (customer_ids: list[str], error_message: str | None)
    """
    # Pré-validation
    if not access_token or not access_token.strip():
        return [], "access_token vide ou None"
    headers = _headers(access_token)
    auth = headers.get("Authorization", "")
    if not auth.startswith("Bearer ") or len(auth) < 20:
        return [], f"Header Authorization mal formé (longueur={len(auth)})"
    dev_token = headers.get("developer-token", "")
    if not dev_token:
        return [], "developer-token absent — vérifie [google_ads].developer_token dans secrets.toml"

    url = f"{_BASE}/customers:listAccessibleCustomers"
    try:
        resp = requests.get(url, headers=headers, timeout=15)
    except Exception as e:
        return [], f"Erreur réseau : {e}"

    # Status HTTP non-OK : on log l'erreur
    if resp.status_code != 200:
        try:
            err = resp.json()
            msg = err.get("error", {}).get("message", str(err))
        except Exception:
            msg = resp.text[:500]
        # Indicateurs visuels pour debug
        token_preview = f"{access_token[:8]}…{access_token[-4:]}" if len(access_token) > 12 else "(trop court)"
        dev_preview = f"{dev_token[:6]}…" if len(dev_token) > 6 else dev_token
        return [], (
            f"HTTP {resp.status_code} : {msg}\n"
            f"DEBUG : access_token={token_preview} (len={len(access_token)}), "
            f"developer-token={dev_preview} (len={len(dev_token)})"
        )

    try:
        data = resp.json()
    except Exception as e:
        return [], f"Réponse non-JSON : {e}"

    # Format attendu : {"resourceNames": ["customers/1234567890", ...]}
    names = data.get("resourceNames", [])
    return [n.split("/")[-1] for n in names], None


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


def fetch_ad_insights(
    access_token: str,
    customer_id: str,
    since: "date",
    until: "date",
    login_customer_id: str | None = None,
) -> tuple[list[dict], str | None]:
    """Fetch les insights par ANNONCE × jour (drill-down Campagne → Groupe → Annonce).

    Mirror du level='ad' de Meta. Ne remplace PAS fetch_campaign_insights :
    certaines campagnes (Performance Max notamment) n'exposent pas leurs
    métriques au niveau annonce → les totaux restent portés par le niveau campagne.
    Returns: (rows, error_message_or_None)
    """
    query = f"""
        SELECT
          campaign.id,
          campaign.name,
          ad_group.id,
          ad_group.name,
          ad_group_ad.ad.id,
          ad_group_ad.ad.name,
          segments.date,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions
        FROM ad_group_ad
        WHERE segments.date BETWEEN '{since.isoformat()}' AND '{until.isoformat()}'
          AND metrics.impressions > 0
        ORDER BY segments.date DESC
    """
    url = f"{_BASE}/customers/{customer_id}/googleAds:searchStream"
    try:
        r = requests.post(url, headers=_headers(access_token, login_customer_id),
                          json={"query": query}, timeout=60)
        data = r.json()
    except Exception as e:
        return [], f"Erreur API: {e}"

    if isinstance(data, dict) and "error" in data:
        return [], data["error"].get("message", str(data["error"]))

    rows = []
    batches = data if isinstance(data, list) else [data]
    for batch in batches:
        if isinstance(batch, dict) and "error" in batch:
            return [], batch["error"].get("message", str(batch["error"]))
        for row in batch.get("results", []):
            camp = row.get("campaign", {})
            ag = row.get("adGroup", {})
            ad = (row.get("adGroupAd", {}) or {}).get("ad", {})
            seg = row.get("segments", {})
            m = row.get("metrics", {})
            ad_id = str(ad.get("id", ""))
            rows.append({
                "campaign_id":   str(camp.get("id", "")),
                "campaign_name": camp.get("name", ""),
                "ad_group_id":   str(ag.get("id", "")),
                "ad_group_name": ag.get("name", ""),
                "ad_id":         ad_id,
                # ad.name est souvent vide (selon le type d'annonce) → fallback lisible
                "ad_name":       ad.get("name") or f"Annonce {ad_id}",
                "date_start":    seg.get("date", ""),
                "impressions":   int(m.get("impressions", 0) or 0),
                "clicks":        int(m.get("clicks", 0) or 0),
                "cost_micros":   int(m.get("costMicros", 0) or 0),
                "conversions":   float(m.get("conversions", 0) or 0),
            })
    return rows, None


def _fin_declaree(brut) -> str | None:
    """Google Ads ecrit 2037-12-30 pour « pas de date de fin ».

    On ne stocke jamais cette date : elle se lirait « campagne programmee
    jusqu'en 2037 » et tracerait une barre de onze ans. NULL veut dire ici
    « declaree sans fin », ce qui est la verite.
    """
    if not brut:
        return None
    d = str(brut)[:10]
    return None if d >= "2037-01-01" else d


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
                out[cid] = (
                    camp.get("name", ""),
                    camp.get("status", ""),
                    camp.get("startDate") or camp.get("start_date") or None,
                    _fin_declaree(camp.get("endDate") or camp.get("end_date")),
                )
    return out, None
