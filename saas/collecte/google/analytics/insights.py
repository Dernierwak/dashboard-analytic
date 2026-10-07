"""`runReport` jour × source/medium/campagne → ga4_insights."""
from __future__ import annotations

from datetime import date

from saas.collecte.google.acces import AccesGoogle
from saas.collecte.google.analytics.rapport import DATA_BASE, numero_propriete
from saas.collecte.socle import http
from saas.collecte.socle.fenetre import Fenetre, tranches


def tranche(
    access_token: str,
    property_id: str,
    since: "date",
    until: "date",
) -> tuple[list[dict], str | None]:
    """Fetch les métriques GA4 par jour × source/medium.
    Returns: (rows, error_or_None)
    Chaque row : date (YYYY-MM-DD), source, medium, sessions, conversions, revenue.
    """
    pid = numero_propriete(property_id)
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
    url = f"{DATA_BASE}/properties/{pid}:runReport"
    try:
        r = http.post(
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


def recuperer(acces: AccesGoogle, fenetre: Fenetre,
              limite: int | None = None) -> tuple[list[dict], list[str]]:
    """Les tranches de 90 jours de la fenêtre → (lignes, trous).

    Une tranche refusée se dit au lieu de disparaître : un seul `last_error`
    ne parlait que quand AUCUNE tranche n'avait rendu de lignes (ticket 01).
    """
    lignes, trous = [], []
    for debut, fin in tranches(fenetre.debut, fenetre.fin):
        if limite is not None and len(lignes) >= limite:
            break
        lot, err = tranche(acces.jeton, acces.propriete, debut, fin)
        if err:
            trous.append(f"{debut.isoformat()}→{fin.isoformat()} : {err}")
        else:
            lignes += lot
    return (lignes[:limite] if limite is not None else lignes), trous


def total_sessions(acces: AccesGoogle, fenetre: Fenetre) -> tuple[float | None, str | None]:
    """Les sessions de la propriété sur la fenêtre, SANS aucune dimension.

    Sert l'essai : la somme des lignes source/medium/campagne doit en être
    proche. Pas forcément égale — GA4 peut regrouper des lignes en « (other) »
    ou appliquer un seuil de confidentialité sur un rapport détaillé ; l'essai
    montre l'écart, il ne le corrige pas.
    """
    pid = numero_propriete(acces.propriete)
    if not pid:
        return None, "GA4 property_id manquant"
    body = {"dateRanges": [{"startDate": fenetre.debut.isoformat(),
                            "endDate": fenetre.fin.isoformat()}],
            "metrics": [{"name": "sessions"}]}
    try:
        r = http.post(f"{DATA_BASE}/properties/{pid}:runReport",
                      headers={"Authorization": f"Bearer {acces.jeton}",
                               "Content-Type": "application/json"},
                      json=body, timeout=60)
        data = r.json()
    except Exception as e:
        return None, f"Erreur API GA4 : {e}"
    if r.status_code != 200 or (isinstance(data, dict) and "error" in data):
        err = data.get("error", {}) if isinstance(data, dict) else {}
        return None, err.get("message", f"HTTP {r.status_code}")
    lignes = data.get("rows") or []
    if not lignes:
        return 0.0, None
    return float((lignes[0].get("metricValues") or [{}])[0].get("value") or 0), None
