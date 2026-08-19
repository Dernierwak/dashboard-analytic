"""Fetch Google Analytics 4 (GA4) via les API REST Google.

Réutilise l'OAuth Google déjà en place (même refresh_token que Google Ads),
à condition que le consent inclue le scope `analytics.readonly`
(ajouté dans google_script/fetch_token.py).

Deux API :
  - Admin API  : lister les propriétés GA4 accessibles
      GET https://analyticsadmin.googleapis.com/v1beta/accountSummaries
  - Data API   : lire les métriques par jour × source/medium
      POST https://analyticsdata.googleapis.com/v1beta/properties/{id}:runReport

⚠ Pré-requis côté Google Cloud (une fois) :
  - activer "Google Analytics Admin API" + "Google Analytics Data API"
  - ajouter le scope analytics.readonly à l'écran de consentement OAuth

Aucun developer-token ici (c'est spécifique à Google Ads).
"""

from datetime import date
import requests

from google_script.fetch_token import get_access_token_from_refresh

_ADMIN_BASE = "https://analyticsadmin.googleapis.com/v1beta"
_DATA_BASE = "https://analyticsdata.googleapis.com/v1beta"


def _property_number(property_id: str) -> str:
    """Normalise 'properties/123' ou '123' → '123'."""
    return str(property_id or "").split("/")[-1].strip()


def list_ga4_properties(access_token: str) -> tuple[list[dict], str | None]:
    """Liste les propriétés GA4 accessibles avec ce token.
    Returns: ([{id: 'properties/123', name: 'Mon site', account: 'Mon compte'}], error_or_None)
    """
    if not access_token or not access_token.strip():
        return [], "access_token vide"
    url = f"{_ADMIN_BASE}/accountSummaries"
    try:
        r = requests.get(
            url,
            headers={"Authorization": f"Bearer {access_token}"},
            params={"pageSize": 200},
            timeout=20,
        )
    except Exception as e:
        return [], f"Erreur réseau : {e}"

    if r.status_code != 200:
        try:
            msg = r.json().get("error", {}).get("message", r.text[:300])
        except Exception:
            msg = r.text[:300]
        return [], f"HTTP {r.status_code} : {msg}"

    out = []
    for acc in r.json().get("accountSummaries", []):
        acc_name = acc.get("displayName", "")
        for prop in acc.get("propertySummaries", []):
            out.append({
                "id": prop.get("property", ""),            # "properties/123456789"
                "name": prop.get("displayName", ""),
                "account": acc_name,
            })
    return out, None


def fetch_ga4_insights(
    access_token: str,
    property_id: str,
    since: "date",
    until: "date",
) -> tuple[list[dict], str | None]:
    """Fetch les métriques GA4 par jour × source/medium.
    Returns: (rows, error_or_None)
    Chaque row : date (YYYY-MM-DD), source, medium, sessions, conversions, revenue.
    """
    pid = _property_number(property_id)
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
    url = f"{_DATA_BASE}/properties/{pid}:runReport"
    try:
        r = requests.post(
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


# ─────────────────────────────────────────────────────────────────────────────
# LE PLANCHER, ET CE QU'IL N'EST PLUS.
#
# Ces six noms étaient LA liste : `fetch_ga4_events` ne récoltait qu'eux, et un
# site qui nomme ses événements autrement (`achat`, `formulaire_envoye`,
# `demande_devis`…) ne remontait donc RIEN, sans qu'aucun message ne le dise.
# On devinait les noms d'un tiers à sa place.
#
# Ils restent, mais comme PLANCHER et non comme filtre : `fetch_ga4_events`
# récolte désormais l'union de ce plancher et des événements que le client a
# choisis pour ses thèmes. Le plancher est ce qui fait vivre `_rule_funnel`
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


def list_ga4_event_names(
    access_token: str,
    property_id: str,
    since: "date",
    until: "date",
    limit: int = 300,
) -> tuple[list[dict], str | None]:
    """LA VRAIE LISTE des événements émis par CETTE propriété, avec leur volume.

    Une seule dimension (`eventName`), aucun `dimensionFilter`, aucune date en
    dimension : le rapport rend UNE LIGNE PAR NOM D'ÉVÉNEMENT pour toute la
    fenêtre. C'est ce qui rend l'appel négligeable — le nombre de lignes est le
    nombre de noms distincts (quelques dizaines en pratique), pas le nombre de
    jours × sources × campagnes.

    C'EST LA RAISON POUR LAQUELLE LE CATALOGUE ET LE DÉTAIL SONT DEUX APPELS.
    Enlever le filtre de `fetch_ga4_events` aurait donné la même liste, mais en
    multipliant sa volumétrie par le nombre de noms : cette table-là est déjà
    paginée pour cause de « dizaines de milliers de lignes » (voir
    `scripts/fetch_data.py::fetch_ga4_events`) avec SIX événements. Savoir
    QUELS événements existent et stocker le détail quotidien de CHACUN sont
    deux besoins différents, et un seul des deux coûte cher.

    Google ne documente aucun plafond de noms distincts pour un flux web
    (support.google.com/analytics/answer/9267744 ne borne que les flux app,
    à 500 par utilisateur) — d'où un `limit` explicite plutôt qu'une confiance
    aveugle dans la taille de la réponse.

    Returns: ([{nom, volume, valeur}] trié par volume décroissant, error_or_None)
    """
    pid = _property_number(property_id)
    if not pid:
        return [], "GA4 property_id manquant"

    body = {
        "dateRanges": [{"startDate": since.isoformat(), "endDate": until.isoformat()}],
        "dimensions": [{"name": "eventName"}],
        "metrics": [{"name": "eventCount"}, {"name": "eventValue"}],
        "orderBys": [{"metric": {"metricName": "eventCount"}, "desc": True}],
        "limit": int(limit),
    }
    url = f"{_DATA_BASE}/properties/{pid}:runReport"
    try:
        r = requests.post(
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

    out = []
    for row in data.get("rows", []):
        dims = [d.get("value", "") for d in row.get("dimensionValues", [])]
        mets = [m.get("value", "0") for m in row.get("metricValues", [])]
        if not dims or not dims[0]:
            continue
        out.append({
            "nom":    dims[0],
            "volume": int(float(mets[0] or 0)) if len(mets) > 0 else 0,
            "valeur": float(mets[1] or 0) if len(mets) > 1 else 0.0,
        })
    return out, None


def list_ga4_key_events(
    access_token: str,
    property_id: str,
) -> tuple[set[str], str | None]:
    """Les ÉVÉNEMENTS CLÉS déclarés dans l'administration GA4 de la propriété.

    GET https://analyticsadmin.googleapis.com/v1beta/properties/{id}/keyEvents
    (scope `analytics.readonly`, déjà demandé par notre consentement Google —
    voir `saas/web/app/api/oauth/google/start/route.ts`).

    CE QUE LA RESSOURCE `KeyEvent` CONTIENT, ET CE QU'ELLE NE CONTIENT PAS.
    Ses champs sont `name`, `eventName`, `createTime`, `custom`, `deletable`,
    `countingMethod` (ONCE_PER_EVENT | ONCE_PER_SESSION) et `defaultValue`.
    IL N'Y A AUCUN CHAMP « PRIMAIRE » NI « SECONDAIRE » : dans GA4, un événement
    est clé ou ne l'est pas — c'est un booléen, et la dimension de reporting
    correspondante (`isKeyEvent`) est elle aussi binaire.

    Le couple primaire/secondaire existe bien, mais chez GOOGLE ADS et sur ses
    actions de conversion (`primary_for_goal`) : « primaire » = utilisée par les
    enchères et comptée dans la colonne Conversions, « secondaire » = observée
    seulement (support.google.com/google-ads/answer/11461796). Un événement clé
    GA4 importé dans Google Ads y arrive d'ailleurs EN SECONDAIRE par défaut,
    pour ne pas compter deux fois la même conversion dans les enchères.

    C'est pourquoi le rang principal/secondaire de nos thèmes est un CHOIX du
    client, stocké dans `theme_ga4_events.rang`, et non une donnée importée :
    l'importer voudrait dire lire l'API Google Ads, qui parle de campagnes et
    d'actions de conversion — pas de thèmes Pulse. On n'invente pas une
    distinction que la plateforme ne donne pas à ce niveau.

    Returns: ({eventName, …}, error_or_None). Un ensemble vide sans erreur veut
    dire « aucun événement clé déclaré », ce qui est une information, pas une
    panne.
    """
    pid = _property_number(property_id)
    if not pid:
        return set(), "GA4 property_id manquant"

    noms: set[str] = set()
    page_token = None
    url = f"{_ADMIN_BASE}/properties/{pid}/keyEvents"
    for _ in range(10):  # garde-fou : 10 pages × 200 = 2 000 événements clés
        params = {"pageSize": 200}
        if page_token:
            params["pageToken"] = page_token
        try:
            r = requests.get(
                url,
                headers={"Authorization": f"Bearer {access_token}"},
                params=params,
                timeout=20,
            )
        except Exception as e:
            return noms, f"Erreur réseau : {e}"

        if r.status_code != 200:
            try:
                msg = r.json().get("error", {}).get("message", r.text[:300])
            except Exception:
                msg = r.text[:300]
            return noms, f"HTTP {r.status_code} : {msg}"

        data = r.json()
        for ke in data.get("keyEvents", []):
            nom = (ke.get("eventName") or "").strip()
            if nom:
                noms.add(nom)
        page_token = data.get("nextPageToken")
        if not page_token:
            break
    return noms, None


def fetch_ga4_event_catalog(
    access_token: str,
    property_id: str,
    since: "date",
    until: "date",
) -> tuple[list[dict], str | None]:
    """Le catalogue montrable à l'écran : les événements de la propriété, marqués.

    Croise les deux appels ci-dessus. `cle` vaut True quand GA4 a déclaré
    l'événement comme événement clé — c'est la SEULE qualification que GA4
    donne, et elle est binaire.

    Un échec de l'Admin API ne fait pas échouer le catalogue : mieux vaut la
    liste sans les marques que pas de liste du tout. `cles_lues` dit lequel des
    deux cas on affiche, pour que l'écran ne présente pas « aucun événement
    clé » quand la vérité est « on n'a pas pu demander ».

    Returns: ([{nom, volume, valeur, cle}], error_or_None)
    """
    events, err = list_ga4_event_names(access_token, property_id, since, until)
    if err:
        return [], err
    cles, cles_err = list_ga4_key_events(access_token, property_id)
    for e in events:
        e["cle"] = (e["nom"] in cles) if not cles_err else None
    return events, None


def fetch_ga4_events(
    access_token: str,
    property_id: str,
    since: "date",
    until: "date",
    event_names: list[str] | None = None,
) -> tuple[list[dict], str | None]:
    """Fetch le détail par ÉVÉNEMENT : jour × source/medium/campagne × event_name.

    `event_names` : les événements à récolter EN PLUS du plancher `FUNNEL_EVENTS`
    — en pratique ceux que le client a rattachés à ses thèmes. Le filtre reste
    volontairement fermé : sans lui, la volumétrie de cette table est multipliée
    par le nombre de noms distincts de la propriété, alors qu'on ne sait rien
    faire des événements que personne n'a choisis. Le catalogue, lui, est
    complet et coûte un appel — voir `list_ga4_event_names`.

    Returns: (rows, error_or_None) — rows: {date, source, medium, campaign,
    event_name, event_count, event_value}.
    """
    pid = _property_number(property_id)
    if not pid:
        return [], "GA4 property_id manquant"

    # Union ordonnée : le plancher d'abord (l'ordre du funnel a du sens à la
    # lecture des logs), les choix du client ensuite, sans doublon.
    noms = list(FUNNEL_EVENTS)
    for n in (event_names or []):
        n = str(n or "").strip()
        if n and n not in noms:
            noms.append(n)

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
    url = f"{_DATA_BASE}/properties/{pid}:runReport"
    try:
        r = requests.post(
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


def get_property_summary(
    refresh_token: str,
    property_id: str,
    since: "date",
    until: "date",
) -> dict:
    """Helper haut-niveau : refresh_token → access_token → insights → dict agrégé.

    Retourne un dict prêt pour le moteur de recos :
      {connected, paid_conversions, paid_revenue, paid_sessions,
       total_conversions, total_revenue, error}
    'paid_*' = trafic publicitaire (medium contenant cpc/ppc/paid).
    """
    out = {
        "connected": False,
        "paid_conversions": None, "paid_revenue": None, "paid_sessions": None,
        "total_conversions": 0.0, "total_revenue": 0.0, "error": None,
    }
    access = get_access_token_from_refresh(refresh_token)
    if not access:
        out["error"] = "access_token indisponible"
        return out
    rows, err = fetch_ga4_insights(access, property_id, since, until)
    if err:
        out["error"] = err
        return out

    out["connected"] = True
    paid_conv = paid_rev = paid_sess = 0.0
    for r in rows:
        out["total_conversions"] += r["conversions"]
        out["total_revenue"] += r["revenue"]
        if any(k in r["medium"].lower() for k in ("cpc", "ppc", "paid")):
            paid_conv += r["conversions"]
            paid_rev += r["revenue"]
            paid_sess += r["sessions"]
    out["paid_conversions"] = paid_conv
    out["paid_revenue"] = paid_rev
    out["paid_sessions"] = int(paid_sess)
    return out
