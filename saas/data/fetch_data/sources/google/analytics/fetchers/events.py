"""`runReport` filtré sur les événements du funnel → ga4_events."""
from __future__ import annotations

from datetime import date

from saas.data.fetch_data.sources.google.client import AccesGoogle
from saas.data.fetch_data.sources.google.analytics.fetchers._reports import DATA_BASE, numero_propriete
from saas.data.fetch_data.shared import http_client as http
from saas.data.fetch_data.shared.date_ranges import Fenetre, tranches


# ─────────────────────────────────────────────────────────────────────────────
# LE PLANCHER, ET CE QU'IL N'EST PLUS.
#
# Ces six noms étaient LA liste : `evenements.tranche` ne récoltait qu'eux, et un
# site qui nomme ses événements autrement (`achat`, `formulaire_envoye`,
# `demande_devis`…) ne remontait donc RIEN, sans qu'aucun message ne le dise.
# On devinait les noms d'un tiers à sa place.
#
# Ils restent, et redeviennent la liste entière depuis que le thème est parti
# du produit : le client choisissait des événements PAR THÈME, et c'était la
# seule autre source de noms. Le plancher est ce qui fait vivre `_rule_funnel`
# (« des paniers mais zéro achat »), écrite sur ces noms-là et sur eux seuls ;
# le retirer casserait un conseil qui marche chez qui utilise le tag e-commerce
# standard de GA4. Il ne coûte rien à qui n'émet pas ces événements : une ligne
# absente n'est pas une ligne vide.
#
# Ordre = ordre du funnel.
FUNNEL_EVENTS = [
    "view_item", "add_to_cart", "begin_checkout",
    "add_payment_info", "purchase", "generate_lead",
]


def tranche(
    access_token: str,
    property_id: str,
    since: "date",
    until: "date",
) -> tuple[list[dict], str | None]:
    """Fetch le détail par ÉVÉNEMENT : jour × source/medium/campagne × event_name.

    Filtré sur `FUNNEL_EVENTS`, et le filtre reste volontairement fermé : sans
    lui, la volumétrie de cette table est multipliée par le nombre de noms
    distincts de la propriété. Le catalogue, lui, est complet et coûte un
    appel — voir `catalogue.list_ga4_event_names`.

    Returns: (rows, error_or_None) — rows: {date, source, medium, campaign,
    event_name, event_count, event_value}.
    """
    pid = numero_propriete(property_id)
    if not pid:
        return [], "GA4 property_id manquant"

    noms = list(FUNNEL_EVENTS)

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
                "inListFilter": {"values": noms},
            }
        },
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
