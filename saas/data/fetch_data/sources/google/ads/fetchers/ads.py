"""`FROM ad_group_ad` — les insights par annonce × jour → google_ads_ad_insights."""
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
    url = f"{BASE}/customers/{customer_id}/googleAds:searchStream"
    try:
        r = http.post(url, headers=entetes(access_token, login_customer_id),
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
