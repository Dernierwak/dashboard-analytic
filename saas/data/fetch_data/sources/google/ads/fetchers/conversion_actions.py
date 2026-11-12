"""`FROM conversion_action` — les réglages de valeur des actions de conversion
→ google_ads_conversion_actions.

Ce sont des réglages ACTUELS, pas un historique : relus en entier à chaque
passage (spec google-ads, § « Les colonnes et tables nouvelles »). Ils servent
la règle « sans valeur » de la page (carte, issue 13) : une action dont la
valeur est imposée (`always_use_default_value`) à 0 ou à 1 ne déclare aucun
montant, sa « valeur » n'est que le nombre de conversions.
"""
from __future__ import annotations

from saas.data.fetch_data.sources.google.client import AccesGoogle
from saas.data.fetch_data.sources.google.ads.fetchers._query import BASE, entetes, mesure, resultats_de
from saas.data.fetch_data.shared import http_client as http

# Aucun filtre sur le statut : une action retirée ou masquée a pu convertir sur
# une période passée que la page relit, et ses conversions par action portent
# encore son ID. Sans ses réglages, la page ne saurait plus la classer.
_REQUETE = """
    SELECT
      conversion_action.id,
      conversion_action.name,
      conversion_action.category,
      conversion_action.status,
      conversion_action.value_settings.always_use_default_value,
      conversion_action.value_settings.default_value,
      conversion_action.value_settings.default_currency_code
    FROM conversion_action
"""


def recuperer(acces: AccesGoogle) -> tuple[list[dict], str | None]:
    """Les actions de conversion du compte → `actions_de`."""
    url = f"{BASE}/customers/{acces.client}/googleAds:searchStream"
    try:
        data = http.post(url, headers=entetes(acces.jeton, acces.login),
                         json={"query": _REQUETE}, timeout=60).json()
    except Exception as e:
        return [], f"Erreur API: {e}"
    return actions_de(data)


def actions_de(reponse) -> tuple[list[dict], str | None]:
    """Le seam « réponse Google → lignes à écrire », sans réseau (harnais :
    `.scratch/google-ads/harnais/03-la-valeur-de-conversion-et-le-roas/`).

    Les réglages sont recopiés TELS QUELS, absence comprise : un réglage que
    Google n'a pas rendu reste `None`. Le deviner (`False`, `0`) classerait
    l'action d'un côté ou de l'autre de la règle sans l'avoir lu.
    """
    resultats, err = resultats_de(reponse)
    if err:
        return [], err
    lignes = []
    for row in resultats:
        a = row.get("conversionAction", {})
        reglages = a.get("valueSettings") or {}
        toujours = reglages.get("alwaysUseDefaultValue")
        lignes.append({
            "conversion_action_id":     str(a.get("id", "")),
            "name":                     a.get("name", ""),
            "category":                 a.get("category") or None,
            "status":                   a.get("status") or None,
            "always_use_default_value": toujours if isinstance(toujours, bool) else None,
            "default_value":            mesure(reglages.get("defaultValue")),
            "currency_code":            reglages.get("defaultCurrencyCode") or None,
        })
    return lignes, None
