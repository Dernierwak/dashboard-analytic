"""`FROM campaign` — les insights par campagne × jour → google_ads_insights."""
from __future__ import annotations

from datetime import date

from saas.data.fetch_data.sources.google.client import AccesGoogle
from saas.data.fetch_data.sources.google.ads.fetchers._query import BASE, entetes, mesure, resultats_de
from saas.data.fetch_data.shared import http_client as http
from saas.data.fetch_data.shared.date_ranges import Fenetre, tranches


def tranche(
    access_token: str,
    customer_id: str,
    since: "date",
    until: "date",
    login_customer_id: str | None = None,
) -> tuple[list[dict], str | None]:
    """Les insights par campagne × jour, demandés à Google → `lignes_de`.

    Le type et les trois colonnes de conversion sont dans la MÊME requête que
    les métriques d'avant : avec `segments.date`, Google omet les jours où
    toutes les métriques demandées valent 0 (carte, issue 10 : 370 lignes en
    ne demandant que les conversions, 1 562 avec les impressions). Une requête
    à part pour les conversions rendrait d'autres jours que celle-ci.
    """
    query = f"""
        SELECT
          campaign.id,
          campaign.name,
          campaign.status,
          campaign.advertising_channel_type,
          segments.date,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.conversions_value,
          metrics.all_conversions,
          metrics.view_through_conversions,
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
    return lignes_de(data)


def lignes_de(reponse) -> tuple[list[dict], str | None]:
    """Le seam « réponse Google → lignes à écrire » de `google_ads_insights`,
    sans réseau (harnais : `.scratch/google-ads/harnais/02-le-type-de-campagne-en-v26/`).

    Une ligne par résultat rendu, aucune pour un jour que Google a omis.
    Chaque ligne : campaign_id, campaign_name, effective_status, date_start,
    advertising_channel_type, impressions, clicks, cost_micros, conversions,
    conversions_value, all_conversions, view_through_conversions, ctr,
    avg_cpc_micros.

    Deux régimes, et c'est voulu :
    · les colonnes d'avant sont NOT NULL DEFAULT 0 en base et le restent
      (`or 0`) — d'autres lecteurs en dépendent (`couts.ts`, rapport hebdo) ;
    · les colonnes nouvelles gardent l'absence : `None` quand Google ne les a
      pas rendues, jamais 0 (`CLAUDE.md` §7). Le type est recopié BRUT
      (`SEARCH`, `PERFORMANCE_MAX`…) : c'est la page qui le nomme, et un type
      absent reste `None` plutôt que d'être deviné.
    Le coût reste en micros : la page le convertit, une seule fois.
    """
    resultats, err = resultats_de(reponse)
    if err:
        return [], err
    rows = []
    for row in resultats:
        camp = row.get("campaign", {})
        seg = row.get("segments", {})
        m = row.get("metrics", {})
        rows.append({
            "campaign_id":    str(camp.get("id", "")),
            "campaign_name":  camp.get("name", ""),
            "effective_status": camp.get("status", ""),
            "date_start":     seg.get("date", ""),
            "advertising_channel_type": camp.get("advertisingChannelType") or None,
            "impressions":    int(m.get("impressions", 0) or 0),
            "clicks":         int(m.get("clicks", 0) or 0),
            "cost_micros":    int(m.get("costMicros", 0) or 0),
            "conversions":    float(m.get("conversions", 0) or 0),
            "conversions_value":        mesure(m.get("conversionsValue")),
            "all_conversions":          mesure(m.get("allConversions")),
            "view_through_conversions": mesure(m.get("viewThroughConversions")),
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
    resultats, err = resultats_de(data)
    if err:
        return None, err
    total = sum(int((row.get("metrics") or {}).get("costMicros", 0) or 0) for row in resultats)
    return float(total), None
