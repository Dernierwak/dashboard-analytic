"""Le catalogue des événements de la propriété, et lesquels sont des événements clés."""
from __future__ import annotations

from datetime import date

from saas.collecte.google.acces import AccesGoogle
from saas.collecte.google.analytics.rapport import ADMIN_BASE, DATA_BASE, numero_propriete
from saas.collecte.socle import http
from saas.collecte.socle.fenetre import Fenetre


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
    Enlever le filtre de `evenements.py` aurait donné la même liste, mais en
    multipliant sa volumétrie par le nombre de noms : cette table-là est déjà
    paginée pour cause de « dizaines de milliers de lignes » (voir
    `saas/commun/fetch_data.py::fetch_ga4_events`) avec SIX événements. Savoir
    QUELS événements existent et stocker le détail quotidien de CHACUN sont
    deux besoins différents, et un seul des deux coûte cher.

    Google ne documente aucun plafond de noms distincts pour un flux web
    (support.google.com/analytics/answer/9267744 ne borne que les flux app,
    à 500 par utilisateur) — d'où un `limit` explicite plutôt qu'une confiance
    aveugle dans la taille de la réponse.

    Returns: ([{nom, volume, valeur}] trié par volume décroissant, error_or_None)
    """
    pid = numero_propriete(property_id)
    if not pid:
        return [], "GA4 property_id manquant"

    body = {
        "dateRanges": [{"startDate": since.isoformat(), "endDate": until.isoformat()}],
        "dimensions": [{"name": "eventName"}],
        "metrics": [{"name": "eventCount"}, {"name": "eventValue"}],
        "orderBys": [{"metric": {"metricName": "eventCount"}, "desc": True}],
        "limit": int(limit),
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

    Returns: ({eventName, …}, error_or_None). Un ensemble vide sans erreur veut
    dire « aucun événement clé déclaré », ce qui est une information, pas une
    panne.
    """
    pid = numero_propriete(property_id)
    if not pid:
        return set(), "GA4 property_id manquant"

    noms: set[str] = set()
    page_token = None
    url = f"{ADMIN_BASE}/properties/{pid}/keyEvents"
    for _ in range(10):  # garde-fou : 10 pages × 200 = 2 000 événements clés
        params = {"pageSize": 200}
        if page_token:
            params["pageToken"] = page_token
        try:
            r = http.get(
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


def recuperer(acces: AccesGoogle, fenetre: Fenetre,
              limite: int | None = None) -> tuple[list[dict], list[str]]:
    """[{nom, volume, valeur, cle}] sur la fenêtre, trous."""
    lignes, err = fetch_ga4_event_catalog(acces.jeton, acces.propriete,
                                          fenetre.debut, fenetre.fin)
    return (lignes[:limite] if limite is not None else lignes), ([err] if err else [])
