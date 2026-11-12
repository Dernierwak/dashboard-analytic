"""`FROM campaign` segmenté par `segments.conversion_action` — les conversions
par action × campagne × jour → google_ads_conversions_by_action.

Sert la seule règle « sans valeur » de la page (spec google-ads, § « Les
conversions et leur valeur ») : savoir QUELLES actions ont converti sur la
période et la campagne choisies.
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
    """Les conversions par action, demandées à Google → `lignes_de`.

    Métriques de conversion SEULES : avec `segments.conversion_action`,
    l'API refuse impressions, clics et coût (doc v26, listes « Selectable
    with » ; carte, issue 18). D'où une requête à part de `campaigns.tranche`.
    La somme par action redonne exactement `metrics.conversions` (essai réel,
    carte, issue 19 : 0 clé en écart).
    """
    query = f"""
        SELECT
          campaign.id,
          segments.conversion_action,
          segments.date,
          metrics.conversions,
          metrics.conversions_value
        FROM campaign
        WHERE segments.date BETWEEN '{since.isoformat()}' AND '{until.isoformat()}'
    """
    url = f"{BASE}/customers/{customer_id}/googleAds:searchStream"
    try:
        data = http.post(url, headers=entetes(access_token, login_customer_id),
                         json={"query": query}, timeout=60).json()
    except Exception as e:
        return [], f"Erreur API: {e}"
    return lignes_de(data)


def _id_action(ressource: str | None) -> str | None:
    """`customers/1/conversionActions/456` → `456`."""
    if not ressource:
        return None
    return str(ressource).rsplit("/", 1)[-1] or None


def lignes_de(reponse) -> tuple[list[dict], str | None]:
    """Le seam « réponse Google → lignes à écrire », sans réseau (harnais :
    `.scratch/google-ads/harnais/03-la-valeur-de-conversion-et-le-roas/`).

    Une ligne sans action lisible n'est pas écrite : rattachée à une action
    inventée, elle fausserait la règle. La page voit alors un reste entre
    `metrics.conversions` et la somme par action, et ne conclut pas.
    Absence → `None`, jamais 0 (`CLAUDE.md` §7).
    """
    resultats, err = resultats_de(reponse)
    if err:
        return [], err
    lignes = []
    for row in resultats:
        seg = row.get("segments", {})
        action = _id_action(seg.get("conversionAction"))
        if action is None:
            continue
        m = row.get("metrics", {})
        lignes.append({
            "date_start":           seg.get("date", ""),
            "campaign_id":          str(row.get("campaign", {}).get("id", "")),
            "conversion_action_id": action,
            "conversions":          mesure(m.get("conversions")),
            "conversions_value":    mesure(m.get("conversionsValue")),
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
