"""Le budget PLANIFIÉ de chaque campagne Meta (`/campaigns`, puis `/adsets` au besoin)."""
from __future__ import annotations

from saas.collecte.meta.graph import GRAPH, AccesMeta, pages
from saas.collecte.socle.fenetre import Fenetre


def centimes(v) -> float | None:
    """Meta renvoie ses montants en CENTIMES, et sous forme de CHAÎNE.

    « 5000 » vaut 50,00 CHF. Sans cette division on affiche cent fois le budget
    réel — l'erreur est silencieuse et passe pour un compte très dépensier.
    On rend None quand le champ est absent : « pas de budget ici » et « budget
    à zéro » ne veulent pas dire la même chose (voir `_budget_des_adsets`).

    Hypothèse : la devise du compte a deux décimales. Les devises sans sous-unité
    (JPY, KRW) seraient divisées à tort — aucun compte Pulse n'en utilise
    aujourd'hui, et Meta n'expose pas le facteur dans cette réponse.
    """
    if v in (None, "", 0, "0"):
        return None
    try:
        return float(v) / 100.0
    except (TypeError, ValueError):
        return None


def _budget_des_adsets(token: str, campaign_id: str) -> tuple[float | None, float | None]:
    """Somme des budgets des ad sets d'une campagne.

    POURQUOI C'EST OBLIGATOIRE : quand le CBO (budget au niveau campagne) est
    désactivé — c'est le réglage par DÉFAUT sur beaucoup de comptes — la
    campagne ne porte aucun budget, il vit sur chaque ad set. Sans cette
    remontée, un compte entier affiche « 0 CHF planifié » alors qu'il dépense
    tous les jours, et la page Coûts conclut qu'il n'y a rien de prévu.

    Returns: (journalier, total) en CHF, None quand aucun ad set n'en porte.
    """
    rows, err = pages(
        f"{GRAPH}/{campaign_id}/adsets",
        {"access_token": token, "fields": "daily_budget,lifetime_budget", "limit": 200},
        timeout=30,
    )
    if err:
        # Une liste d'ad sets incomplète donne une somme trop basse : elle
        # s'écrit quand même (c'était le cas avant, en silence), mais se dit.
        print(f"    budgets meta : ad sets de la campagne {campaign_id} incomplets — {err}")
    jour = 0.0
    total = 0.0
    for a in rows:
        jour += centimes(a.get("daily_budget")) or 0.0
        total += centimes(a.get("lifetime_budget")) or 0.0
    return (jour or None), (total or None)


def _jour(v) -> str | None:
    """`start_time` de Meta est un horodatage ISO avec fuseau ; on ne garde que
    le jour, seule granularité que la frise et le prorata savent lire."""
    return str(v)[:10] if v else None


def recuperer(acces: AccesMeta, fenetre: Fenetre | None = None,
              limite: int | None = None) -> tuple[list[dict], list[str]]:
    """Le budget PLANIFIÉ de chaque campagne Meta, à l'instant du relevé.

    Retour : (rows, trous) — chaque row : campaign_id, campaign_name,
    status, start_date, end_date, daily_budget, total_budget.
    `end_date` None = campagne déclarée sans fin (pas de `stop_time`).
    """
    if not (acces.jeton and acces.compte):
        return [], ["token ou ad_account_id manquant"]
    camps, err = pages(
        f"{GRAPH}/{acces.compte}/campaigns",
        {
            "access_token": acces.jeton,
            "fields": "id,name,status,objective,daily_budget,lifetime_budget,"
                      "budget_remaining,start_time,stop_time",
            "limit": 200,
        },
        timeout=30, limite=limite,
    )
    if err and not camps:
        return [], [err]
    # Une liste de campagnes tronquée en cours de pagination s'écrit : les
    # campagnes lues ont leur budget juste. Elle se dit dans le trou rendu.
    trous = [err] if err else []

    rows: list[dict] = []
    for c in camps:
        cid = str(c.get("id") or "")
        if not cid:
            continue
        jour = centimes(c.get("daily_budget"))
        total = centimes(c.get("lifetime_budget"))
        if jour is None and total is None:
            # Budget par ad set (CBO désactivé) — un appel de plus par campagne,
            # et c'est le seul moyen de connaître la promesse.
            jour, total = _budget_des_adsets(acces.jeton, cid)
        rows.append({
            "campaign_id":   cid,
            "campaign_name": c.get("name", ""),
            "status":        c.get("status") or c.get("effective_status") or "",
            "start_date":    _jour(c.get("start_time")),
            # stop_time absent = campagne sans fin programmée, pas « fin inconnue ».
            "end_date":      _jour(c.get("stop_time")),
            # Exclusifs : un lifetime_budget prime, sinon le prorata compterait
            # la même promesse deux fois.
            "daily_budget":  None if total else jour,
            "total_budget":  total,
        })
    return rows, trous


