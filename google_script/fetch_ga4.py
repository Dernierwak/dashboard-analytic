"""Fetch Google Analytics 4 (GA4) via les API REST Google.

Réutilise l'OAuth Google déjà en place (même refresh_token que Google Ads),
à condition que le consent inclue le scope `analytics.readonly`
(ajouté dans google_script/fetch_token.py).

Deux API :
  - Admin API  : lister les propriétés GA4 accessibles
      GET https://analyticsadmin.googleapis.com/v1beta/accountSummaries
  - Data API   : lire les métriques par jour × source/medium
      POST https://analyticsdata.googleapis.com/v1beta/properties/{id}:runReport

⚠ Pré-requis côté Google Cloud (une fois) :
  - activer "Google Analytics Admin API" + "Google Analytics Data API"
  - ajouter le scope analytics.readonly à l'écran de consentement OAuth

Aucun developer-token ici (c'est spécifique à Google Ads).
"""

from datetime import date
import requests

from google_script.fetch_token import get_access_token_from_refresh

_ADMIN_BASE = "https://analyticsadmin.googleapis.com/v1beta"
_DATA_BASE = "https://analyticsdata.googleapis.com/v1beta"


def _property_number(property_id: str) -> str:
    """Normalise 'properties/123' ou '123' → '123'."""
    return str(property_id or "").split("/")[-1].strip()


def list_ga4_properties(access_token: str) -> tuple[list[dict], str | None]:
    """Liste les propriétés GA4 accessibles avec ce token.
    Returns: ([{id: 'properties/123', name: 'Mon site', account: 'Mon compte'}], error_or_None)
    """
    if not access_token or not access_token.strip():
        return [], "access_token vide"
    url = f"{_ADMIN_BASE}/accountSummaries"
    try:
        r = requests.get(
            url,
            headers={"Authorization": f"Bearer {access_token}"},
            params={"pageSize": 200},
            timeout=20,
        )
    except Exception as e:
        return [], f"Erreur réseau : {e}"

    if r.status_code != 200:
        try:
            msg = r.json().get("error", {}).get("message", r.text[:300])
        except Exception:
            msg = r.text[:300]
        return [], f"HTTP {r.status_code} : {msg}"

    out = []
    for acc in r.json().get("accountSummaries", []):
        acc_name = acc.get("displayName", "")
        for prop in acc.get("propertySummaries", []):
            out.append({
                "id": prop.get("property", ""),            # "properties/123456789"
                "name": prop.get("displayName", ""),
                "account": acc_name,
            })
    return out, None


def fetch_ga4_insights(
    access_token: str,
    property_id: str,
    since: "date",
    until: "date",
) -> tuple[list[dict], str | None]:
    """Fetch les métriques GA4 par jour × source/medium.
    Returns: (rows, error_or_None)
    Chaque row : date (YYYY-MM-DD), source, medium, sessions, conversions, revenue.
    """
    pid = _property_number(property_id)
    if not pid:
        return [], "GA4 property_id manquant"

    body = {
        "dateRanges": [{"startDate": since.isoformat(), "endDate": until.isoformat()}],
        "dimensions": [
            {"name": "date"},
            {"name": "sessionSource"},
            {"name": "sessionMedium"},
            {"name": "sessionCampaignName"},   # utm_campaign → reliable aux campagnes Meta/Google
        ],
        "metrics": [
            {"name": "sessions"},
            {"name": "conversions"},
            {"name": "totalRevenue"},
        ],
        "limit": 100000,
    }
    url = f"{_DATA_BASE}/properties/{pid}:runReport"
    try:
        r = requests.post(
            url,
            headers={"Authorization": f"Bearer {access_token}",
                     "Content-Type": "application/json"},
            json=body,
            timeout=60,
        )
        data = r.json()
    except Exception as e:
        return [], f"Erreur API GA4 : {e}"

    if r.status_code != 200 or (isinstance(data, dict) and "error" in data):
        err = data.get("error", {}) if isinstance(data, dict) else {}
        return [], err.get("message", f"HTTP {r.status_code}")

    rows = []
    for row in data.get("rows", []):
        dims = [d.get("value", "") for d in row.get("dimensionValues", [])]
        mets = [m.get("value", "0") for m in row.get("metricValues", [])]
        if len(dims) < 4 or len(mets) < 3:
            continue
        raw_date = dims[0]  # "20260612"
        iso_date = (f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:8]}"
                    if len(raw_date) == 8 and raw_date.isdigit() else raw_date)
        rows.append({
            "date":        iso_date,
            "source":      dims[1] or "",
            "medium":      dims[2] or "",
            "campaign":    "" if dims[3] in ("(not set)", "(direct)") else (dims[3] or ""),
            "sessions":    int(float(mets[0] or 0)),
            "conversions": float(mets[1] or 0),
            "revenue":     float(mets[2] or 0),
        })
    return rows, None


# Funnel e-commerce standard GA4 (+ lead gen). Ordre = ordre du funnel.
FUNNEL_EVENTS = [
    "view_item", "add_to_cart", "begin_checkout",
    "add_payment_info", "purchase", "generate_lead",
]


def fetch_ga4_events(
    access_token: str,
    property_id: str,
    since: "date",
    until: "date",
) -> tuple[list[dict], str | None]:
    """Fetch le funnel par ÉVÉNEMENT : jour × source/medium/campagne × event_name.

    Seuls les événements du funnel (FUNNEL_EVENTS) sont récupérés — c'est eux qui
    permettent des recos précises (« des paniers mais pas d'achats ») au lieu d'un
    total 'conversions' fourre-tout.
    Returns: (rows, error_or_None) — rows: {date, source, medium, campaign,
    event_name, event_count, event_value}.
    """
    pid = _property_number(property_id)
    if not pid:
        return [], "GA4 property_id manquant"

    body = {
        "dateRanges": [{"startDate": since.isoformat(), "endDate": until.isoformat()}],
        "dimensions": [
            {"name": "date"},
            {"name": "sessionSource"},
            {"name": "sessionMedium"},
            {"name": "sessionCampaignName"},
            {"name": "eventName"},
        ],
        "metrics": [
            {"name": "eventCount"},
            {"name": "eventValue"},
        ],
        "dimensionFilter": {
            "filter": {
                "fieldName": "eventName",
                "inListFilter": {"values": FUNNEL_EVENTS},
            }
        },
        "limit": 100000,
    }
    url = f"{_DATA_BASE}/properties/{pid}:runReport"
    try:
        r = requests.post(
            url,
            headers={"Authorization": f"Bearer {access_token}",
                     "Content-Type": "application/json"},
            json=body,
            timeout=60,
        )
        data = r.json()
    except Exception as e:
        return [], f"Erreur API GA4 : {e}"

    if r.status_code != 200 or (isinstance(data, dict) and "error" in data):
        err = data.get("error", {}) if isinstance(data, dict) else {}
        return [], err.get("message", f"HTTP {r.status_code}")

    rows = []
    for row in data.get("rows", []):
        dims = [d.get("value", "") for d in row.get("dimensionValues", [])]
        mets = [m.get("value", "0") for m in row.get("metricValues", [])]
        if len(dims) < 5 or len(mets) < 2:
            continue
        raw_date = dims[0]
        iso_date = (f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:8]}"
                    if len(raw_date) == 8 and raw_date.isdigit() else raw_date)
        rows.append({
            "date":        iso_date,
            "source":      dims[1] or "",
            "medium":      dims[2] or "",
            "campaign":    "" if dims[3] in ("(not set)", "(direct)") else (dims[3] or ""),
            "event_name":  dims[4] or "",
            "event_count": int(float(mets[0] or 0)),
            "event_value": float(mets[1] or 0),
        })
    return rows, None


def get_property_summary(
    refresh_token: str,
    property_id: str,
    since: "date",
    until: "date",
) -> dict:
    """Helper haut-niveau : refresh_token → access_token → insights → dict agrégé.

    Retourne un dict prêt pour le moteur de recos :
      {connected, paid_conversions, paid_revenue, paid_sessions,
       total_conversions, total_revenue, error}
    'paid_*' = trafic publicitaire (medium contenant cpc/ppc/paid).
    """
    out = {
        "connected": False,
        "paid_conversions": None, "paid_revenue": None, "paid_sessions": None,
        "total_conversions": 0.0, "total_revenue": 0.0, "error": None,
    }
    access = get_access_token_from_refresh(refresh_token)
    if not access:
        out["error"] = "access_token indisponible"
        return out
    rows, err = fetch_ga4_insights(access, property_id, since, until)
    if err:
        out["error"] = err
        return out

    out["connected"] = True
    paid_conv = paid_rev = paid_sess = 0.0
    for r in rows:
        out["total_conversions"] += r["conversions"]
        out["total_revenue"] += r["revenue"]
        if any(k in r["medium"].lower() for k in ("cpc", "ppc", "paid")):
            paid_conv += r["conversions"]
            paid_rev += r["revenue"]
            paid_sess += r["sessions"]
    out["paid_conversions"] = paid_conv
    out["paid_revenue"] = paid_rev
    out["paid_sessions"] = int(paid_sess)
    return out
