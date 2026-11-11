"""Google Ads API REST — la version, les en-têtes, et la lecture des montants.

Doc API : https://developers.google.com/google-ads/api/rest/

Endpoint principal : POST /<version>/customers/{customerId}/googleAds:searchStream
Body : { "query": "<GAQL query>" }
Headers requis :
  - Authorization: Bearer <access_token>
  - developer-token: <DEVELOPER_TOKEN>
  - login-customer-id: <MCC ID> (optionnel, si manager account)

Note : tous les montants sont en MICROS (1 CHF = 1_000_000 micros).
"""

from saas.config.secrets import secret


# ⚠ Google retire les versions API tous les ~12 mois. Adapter si 404 sur l'endpoint.
#
# v21 a sunsetté le 5 août 2026 — confirmé en conditions réelles le 24 août
# 2026 (compte de test, jeton valide) : `googleAds:searchStream` en v21 rend
# un 404 HTML de Google (pas une erreur JSON de l'API), sur CHAQUE appel —
# insights, statuts, budgets ET `change_event`. C'est la cause de « quasi
# aucune donnée Google Ads historique » : `fetch_campaign_insights` rentre
# dans le `except Exception` (le corps HTML n'est pas du JSON), rend
# `([], "Erreur API: ...")`, et `_fetch_google` avale l'erreur en `google: 0
# lignes` — silencieux, comme prévu pour ne jamais faire tomber la récolte,
# mais qui laissait `google_ads_insights` figé au 11 août pour toujours.
# v22 à v25 répondent tous 200 avec de vraies lignes (testé en direct sur le
# même compte) ; v25, sortie le 22 juillet 2026, est la plus récente et
# sunsettera en août 2027 — c'est elle qui repousse le plus loin la prochaine
# panne du même genre.
# Versions supportées actuellement : v23, v24, v25 (août 2026)
#
# Passage à v26 (sortie le 14 octobre 2026) au ticket 02 de la construction
# Google Ads : la carte l'a appelée en conditions réelles, lecture seule, sur
# deux comptes (`.scratch/google-ads/issues/10`, 2026-11-10, et `19`,
# 2026-11-11) — `FROM campaign` avec `advertising_channel_type`,
# `conversions_value`, `all_conversions` et `view_through_conversions` répond
# 200 avec de vraies lignes. Elle repousse encore la panne d'un retrait.
# Doc : https://developers.google.com/google-ads/api/docs/sunset-dates
_API_VERSION = "v26"
BASE = f"https://googleads.googleapis.com/{_API_VERSION}"


def entetes(access_token: str, login_customer_id: str | None = None) -> dict:
    h = {
        "Authorization":   f"Bearer {access_token}",
        "developer-token": secret("google_ads.developer_token"),
        "Content-Type":    "application/json",
    }
    # Si on passe par un MCC (manager account), spécifier l'ID parent
    try:
        mcc = login_customer_id or secret("google_ads.login_customer_id")
        if mcc:
            h["login-customer-id"] = str(mcc).replace("-", "")
    except Exception:
        pass
    return h


def fin_declaree(brut) -> str | None:
    """Google Ads ecrit 2037-12-30 pour « pas de date de fin ».

    On ne stocke jamais cette date : elle se lirait « campagne programmee
    jusqu'en 2037 » et tracerait une barre de onze ans. NULL veut dire ici
    « declaree sans fin », ce qui est la verite.
    """
    if not brut:
        return None
    d = str(brut)[:10]
    return None if d >= "2037-01-01" else d


def micros(v) -> float | None:
    """Google renvoie ses int64 en CHAÎNES dans le JSON REST (proto3).

    `int(v)` sur "5000000" marche, sur 5000000 aussi — mais un float() direct
    sur une chaîne vide ou None lèverait. On rend None quand le champ est
    absent, ce qui n'est pas la même chose qu'un budget à zéro.
    """
    if v in (None, "", 0, "0"):
        return None
    try:
        return float(v) / 1_000_000.0
    except (TypeError, ValueError):
        return None


def mesure(v) -> float | None:
    """Une métrique Google telle qu'elle est revenue : `None` si ABSENTE.

    L'essai réel v26 (carte, issue 10) : un compteur revient `0` explicite, un
    champ que Google ne remplit pas revient absent. Les deux ne disent pas la
    même chose, donc `0` reste `0.0` et l'absence reste `None` — à l'inverse de
    `micros()`, qui lit `0` comme « pas de budget ». Les int64 arrivent en
    chaînes, les double en nombres : `float()` lit les deux.
    """
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def resultats_de(reponse) -> tuple[list[dict], str | None]:
    """Les `results` d'une réponse `searchStream`, ou l'erreur qu'elle porte.

    `searchStream` rend une LISTE de lots ; une erreur arrive seule (objet) ou
    au milieu du flux (un lot `error`). Une erreur, même tardive, annule tout :
    rendre la moitié lue écrirait une période trouée comme si elle était
    complète.
    """
    if isinstance(reponse, dict) and "error" in reponse:
        err = reponse["error"]
        return [], err.get("message", str(err))
    resultats: list[dict] = []
    for lot in reponse if isinstance(reponse, list) else [reponse]:
        if isinstance(lot, dict) and "error" in lot:
            return [], lot["error"].get("message", str(lot["error"]))
        resultats += lot.get("results", []) if isinstance(lot, dict) else []
    return resultats, None
