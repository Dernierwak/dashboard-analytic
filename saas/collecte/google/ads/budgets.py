"""Le budget PLANIFIÉ de chaque campagne Google Ads, à l'instant du relevé."""
from __future__ import annotations

from saas.collecte.google.acces import AccesGoogle
from saas.collecte.google.ads.gaql import BASE, entetes, fin_declaree, micros
from saas.collecte.socle import http
from saas.collecte.socle.fenetre import Fenetre


def fetch_campaign_budgets(
    access_token: str,
    customer_id: str,
    login_customer_id: str | None = None,
) -> tuple[list[dict], str | None]:
    """Le budget PLANIFIÉ de chaque campagne, à l'instant du relevé.

    Aucun historique n'est demandable : l'API ne donne que la valeur COURANTE du
    budget. Chaque appel est donc une photo, et c'est ce que
    `platform_budgets.captured_on` enregistre.

    `amount_micros` porte le budget JOURNALIER, `total_amount_micros` le budget
    de TOUTE la durée (rare — seules les campagnes à période fixe en ont un).
    Les deux sont exclusifs à l'écriture : quand un total existe, c'est lui qui
    fait foi et le journalier n'est pas repris, sinon le prorata compterait la
    promesse deux fois.

    Returns: (rows, error|None) — chaque row : campaign_id, campaign_name,
    status, start_date, end_date, daily_budget, total_budget.
    """
    query = """
        SELECT campaign.id, campaign.name, campaign.status,
               campaign.start_date, campaign.end_date,
               campaign_budget.amount_micros, campaign_budget.total_amount_micros,
               campaign_budget.period
        FROM campaign
    """
    url = f"{BASE}/customers/{customer_id}/googleAds:searchStream"
    try:
        r = http.post(url, headers=entetes(access_token, login_customer_id),
                          json={"query": query}, timeout=30)
        data = r.json()
    except Exception as e:
        return [], f"Erreur API: {e}"

    if isinstance(data, dict) and "error" in data:
        return [], data["error"].get("message", str(data["error"]))

    rows: list[dict] = []
    batches = data if isinstance(data, list) else [data]
    for batch in batches:
        if isinstance(batch, dict) and "error" in batch:
            return [], batch["error"].get("message", str(batch["error"]))
        for row in batch.get("results", []):
            camp = row.get("campaign", {}) or {}
            bud = row.get("campaignBudget", row.get("campaign_budget", {})) or {}
            cid = str(camp.get("id", ""))
            if not cid:
                continue
            journalier = micros(bud.get("amountMicros", bud.get("amount_micros")))
            total = micros(bud.get("totalAmountMicros", bud.get("total_amount_micros")))
            rows.append({
                "campaign_id":   cid,
                "campaign_name": camp.get("name", ""),
                "status":        camp.get("status", ""),
                "start_date":    camp.get("startDate") or camp.get("start_date") or None,
                "end_date":      fin_declaree(camp.get("endDate") or camp.get("end_date")),
                "daily_budget":  None if total else journalier,
                "total_budget":  total,
            })
    return rows, None


def recuperer(acces: AccesGoogle, fenetre: Fenetre | None = None,
              limite: int | None = None) -> tuple[list[dict], list[str]]:
    """(lignes, trous). Pas daté : `fenetre` est ignorée."""
    lignes, err = fetch_campaign_budgets(acces.jeton, acces.client, acces.login)
    return (lignes[:limite] if limite is not None else lignes), ([err] if err else [])
