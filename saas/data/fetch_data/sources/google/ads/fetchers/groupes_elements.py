"""`FROM asset_group` — les Groupes d'éléments PMax × jour →
google_ads_asset_group_insights.

Google ne rend AUCUNE ligne PMax dans `ad_group` / `ad_group_ad`, et ne lève
aucune erreur (carte google-ads, issue 01 ; essai réel, issue 10 : 0 ligne).
Sans cette récolte, une campagne Performance Max n'a pas de détail. Les
Groupes d'éléments portent, eux, de vraies métriques (issue 01) ; ≈ 600 lignes
sur 90 jours chez le compte A (issue 10).
"""
from __future__ import annotations

from datetime import date

from saas.data.fetch_data.sources.google.client import AccesGoogle
from saas.data.fetch_data.sources.google.ads.fetchers._query import BASE, entetes, mesure, resultats_de
from saas.data.fetch_data.shared import http_client as http
from saas.data.fetch_data.shared.date_ranges import Fenetre, tranches


def tranche(
    access_token: str,
    customer_id: str,
    since: date,
    until: date,
    login_customer_id: str | None = None,
) -> tuple[list[dict], str | None]:
    """Les Groupes d'éléments × jour, demandés à Google → `lignes_de`.

    La campagne se lit par `asset_group.campaign` (le nom de ressource, champ
    propre de la ressource) plutôt que par `campaign.id`, ressource attribuée
    que l'essai réel n'a pas appelée avec `FROM asset_group`.
    """
    query = f"""
        SELECT
          asset_group.id,
          asset_group.name,
          asset_group.campaign,
          segments.date,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.conversions_value
        FROM asset_group
        WHERE segments.date BETWEEN '{since.isoformat()}' AND '{until.isoformat()}'
    """
    url = f"{BASE}/customers/{customer_id}/googleAds:searchStream"
    try:
        data = http.post(url, headers=entetes(access_token, login_customer_id),
                         json={"query": query}, timeout=60).json()
    except Exception as e:
        return [], f"Erreur API: {e}"
    return lignes_de(data)


def _id_de(ressource: str | None) -> str | None:
    """`customers/1/campaigns/222` → `222`."""
    if not ressource:
        return None
    return str(ressource).rsplit("/", 1)[-1] or None


def _entier(v) -> int | None:
    m = mesure(v)
    return None if m is None else int(m)


def lignes_de(reponse) -> tuple[list[dict], str | None]:
    """Le seam « réponse Google → lignes à écrire », sans réseau (harnais :
    `.scratch/google-ads/harnais/05-les-groupes-d-elements-pmax/`).

    Une ligne par résultat rendu, aucune pour un jour que Google a omis : avec
    `segments.date`, Google n'écrit pas les jours où toutes les métriques
    valent 0 (issue 10) — les combler à 0 serait affirmer une mesure.
    Une ligne sans campagne lisible n'est pas écrite : le groupe se rattache à
    sa campagne par l'ID, jamais par devinette.
    Absence → `None`, jamais 0 (`CLAUDE.md` §7), compteurs compris. Le coût
    reste en micros : la page le convertit, une seule fois.
    """
    resultats, err = resultats_de(reponse)
    if err:
        return [], err
    lignes = []
    for row in resultats:
        ag = row.get("assetGroup", {})
        campagne = _id_de(ag.get("campaign"))
        groupe = str(ag.get("id") or "") or None
        if campagne is None or groupe is None:
            continue
        m = row.get("metrics", {})
        lignes.append({
            "date_start":        row.get("segments", {}).get("date", ""),
            "campaign_id":       campagne,
            "asset_group_id":    groupe,
            "asset_group_name":  ag.get("name", ""),
            "impressions":       _entier(m.get("impressions")),
            "clicks":            _entier(m.get("clicks")),
            "cost_micros":       _entier(m.get("costMicros")),
            "conversions":       mesure(m.get("conversions")),
            "conversions_value": mesure(m.get("conversionsValue")),
        })
    return lignes, None


def recuperer(acces: AccesGoogle, fenetre: Fenetre) -> tuple[list[dict], list[str]]:
    """Les tranches de 90 jours de la fenêtre → (lignes, trous). Une tranche
    refusée est NOMMÉE, jamais jetée en silence (même règle que `campaigns`)."""
    lignes, trous = [], []
    for debut, fin in tranches(fenetre.debut, fenetre.fin):
        lot, err = tranche(acces.jeton, acces.client, debut, fin, acces.login)
        if err:
            trous.append(f"{debut.isoformat()}→{fin.isoformat()} : {err}")
        else:
            lignes += lot
    return lignes, trous
