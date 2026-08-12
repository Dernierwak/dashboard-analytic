"""Fetch Google Ads via Google Ads API REST.

Doc API : https://developers.google.com/google-ads/api/rest/

Endpoint principal : POST /v17/customers/{customerId}/googleAds:searchStream
Body : { "query": "<GAQL query>" }
Headers requis :
  - Authorization: Bearer <access_token>
  - developer-token: <DEVELOPER_TOKEN>
  - login-customer-id: <MCC ID> (optionnel, si manager account)

Note : tous les montants sont en MICROS (1 CHF = 1_000_000 micros).
"""

from datetime import date, timedelta
import requests

from google_script.fetch_token import get_access_token_from_refresh
from scripts.app_secrets import secret


# ⚠ Google retire les versions API tous les ~12 mois. Adapter si 404 sur l'endpoint.
# Versions supportées actuellement : v19, v20, v21 (mai 2026)
# Doc : https://developers.google.com/google-ads/api/docs/release-notes
_API_VERSION = "v21"
_BASE = f"https://googleads.googleapis.com/{_API_VERSION}"


def _headers(access_token: str, login_customer_id: str | None = None) -> dict:
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


def list_accessible_customers(access_token: str) -> tuple[list[str], str | None]:
    """Liste les customer_ids accessibles avec ce token.
    Returns: (customer_ids: list[str], error_message: str | None)
    """
    # Pré-validation
    if not access_token or not access_token.strip():
        return [], "access_token vide ou None"
    headers = _headers(access_token)
    auth = headers.get("Authorization", "")
    if not auth.startswith("Bearer ") or len(auth) < 20:
        return [], f"Header Authorization mal formé (longueur={len(auth)})"
    dev_token = headers.get("developer-token", "")
    if not dev_token:
        return [], "developer-token absent — vérifie [google_ads].developer_token dans secrets.toml"

    url = f"{_BASE}/customers:listAccessibleCustomers"
    try:
        resp = requests.get(url, headers=headers, timeout=15)
    except Exception as e:
        return [], f"Erreur réseau : {e}"

    # Status HTTP non-OK : on log l'erreur
    if resp.status_code != 200:
        try:
            err = resp.json()
            msg = err.get("error", {}).get("message", str(err))
        except Exception:
            msg = resp.text[:500]
        # Indicateurs visuels pour debug
        token_preview = f"{access_token[:8]}…{access_token[-4:]}" if len(access_token) > 12 else "(trop court)"
        dev_preview = f"{dev_token[:6]}…" if len(dev_token) > 6 else dev_token
        return [], (
            f"HTTP {resp.status_code} : {msg}\n"
            f"DEBUG : access_token={token_preview} (len={len(access_token)}), "
            f"developer-token={dev_preview} (len={len(dev_token)})"
        )

    try:
        data = resp.json()
    except Exception as e:
        return [], f"Réponse non-JSON : {e}"

    # Format attendu : {"resourceNames": ["customers/1234567890", ...]}
    names = data.get("resourceNames", [])
    return [n.split("/")[-1] for n in names], None


def list_managed_accounts(access_token: str, manager_customer_id: str) -> list[dict]:
    """Liste les comptes gérés par un MCC. Retourne [{id, name, currency_code}, ...]."""
    query = """
        SELECT
          customer_client.client_customer,
          customer_client.descriptive_name,
          customer_client.currency_code,
          customer_client.manager
        FROM customer_client
        WHERE customer_client.level <= 1
    """
    url = f"{_BASE}/customers/{manager_customer_id}/googleAds:searchStream"
    try:
        r = requests.post(url, headers=_headers(access_token, manager_customer_id),
                          json={"query": query}, timeout=20)
        data = r.json()
    except Exception:
        return []
    out = []
    # searchStream renvoie une liste de batches
    batches = data if isinstance(data, list) else [data]
    for batch in batches:
        for row in batch.get("results", []):
            cc = row.get("customerClient", {})
            cid = (cc.get("clientCustomer") or "").split("/")[-1]
            if cid and not cc.get("manager"):  # exclure sous-MCC
                out.append({
                    "id": cid,
                    "name": cc.get("descriptiveName", ""),
                    "currency_code": cc.get("currencyCode", ""),
                })
    return out


def fetch_campaign_insights(
    access_token: str,
    customer_id: str,
    since: "date",
    until: "date",
    login_customer_id: str | None = None,
) -> tuple[list[dict], str | None]:
    """Fetch les insights par campagne × jour.
    Returns: (rows, error_message_or_None)
    Chaque row contient : campaign_id, campaign_name, date_start (str), impressions, clicks,
    cost_micros, conversions, ctr, avg_cpc_micros, status (effective_status).
    """
    query = f"""
        SELECT
          campaign.id,
          campaign.name,
          campaign.status,
          segments.date,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.ctr,
          metrics.average_cpc
        FROM campaign
        WHERE segments.date BETWEEN '{since.isoformat()}' AND '{until.isoformat()}'
        ORDER BY segments.date DESC
    """
    url = f"{_BASE}/customers/{customer_id}/googleAds:searchStream"
    try:
        r = requests.post(url, headers=_headers(access_token, login_customer_id),
                          json={"query": query}, timeout=60)
        data = r.json()
    except Exception as e:
        return [], f"Erreur API: {e}"

    # Vérifier erreur API
    if isinstance(data, dict) and "error" in data:
        err = data["error"]
        return [], err.get("message", str(err))

    rows = []
    batches = data if isinstance(data, list) else [data]
    for batch in batches:
        if isinstance(batch, dict) and "error" in batch:
            return [], batch["error"].get("message", str(batch["error"]))
        for row in batch.get("results", []):
            camp = row.get("campaign", {})
            seg = row.get("segments", {})
            m = row.get("metrics", {})
            rows.append({
                "campaign_id":    str(camp.get("id", "")),
                "campaign_name":  camp.get("name", ""),
                "effective_status": camp.get("status", ""),
                "date_start":     seg.get("date", ""),
                "impressions":    int(m.get("impressions", 0) or 0),
                "clicks":         int(m.get("clicks", 0) or 0),
                "cost_micros":    int(m.get("costMicros", 0) or 0),
                "conversions":    float(m.get("conversions", 0) or 0),
                "ctr":            float(m.get("ctr", 0) or 0),
                "avg_cpc_micros": int(m.get("averageCpc", 0) or 0),
            })
    return rows, None


def fetch_ad_insights(
    access_token: str,
    customer_id: str,
    since: "date",
    until: "date",
    login_customer_id: str | None = None,
) -> tuple[list[dict], str | None]:
    """Fetch les insights par ANNONCE × jour (drill-down Campagne → Groupe → Annonce).

    Mirror du level='ad' de Meta. Ne remplace PAS fetch_campaign_insights :
    certaines campagnes (Performance Max notamment) n'exposent pas leurs
    métriques au niveau annonce → les totaux restent portés par le niveau campagne.
    Returns: (rows, error_message_or_None)
    """
    query = f"""
        SELECT
          campaign.id,
          campaign.name,
          ad_group.id,
          ad_group.name,
          ad_group_ad.ad.id,
          ad_group_ad.ad.name,
          segments.date,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions
        FROM ad_group_ad
        WHERE segments.date BETWEEN '{since.isoformat()}' AND '{until.isoformat()}'
          AND metrics.impressions > 0
        ORDER BY segments.date DESC
    """
    url = f"{_BASE}/customers/{customer_id}/googleAds:searchStream"
    try:
        r = requests.post(url, headers=_headers(access_token, login_customer_id),
                          json={"query": query}, timeout=60)
        data = r.json()
    except Exception as e:
        return [], f"Erreur API: {e}"

    if isinstance(data, dict) and "error" in data:
        return [], data["error"].get("message", str(data["error"]))

    rows = []
    batches = data if isinstance(data, list) else [data]
    for batch in batches:
        if isinstance(batch, dict) and "error" in batch:
            return [], batch["error"].get("message", str(batch["error"]))
        for row in batch.get("results", []):
            camp = row.get("campaign", {})
            ag = row.get("adGroup", {})
            ad = (row.get("adGroupAd", {}) or {}).get("ad", {})
            seg = row.get("segments", {})
            m = row.get("metrics", {})
            ad_id = str(ad.get("id", ""))
            rows.append({
                "campaign_id":   str(camp.get("id", "")),
                "campaign_name": camp.get("name", ""),
                "ad_group_id":   str(ag.get("id", "")),
                "ad_group_name": ag.get("name", ""),
                "ad_id":         ad_id,
                # ad.name est souvent vide (selon le type d'annonce) → fallback lisible
                "ad_name":       ad.get("name") or f"Annonce {ad_id}",
                "date_start":    seg.get("date", ""),
                "impressions":   int(m.get("impressions", 0) or 0),
                "clicks":        int(m.get("clicks", 0) or 0),
                "cost_micros":   int(m.get("costMicros", 0) or 0),
                "conversions":   float(m.get("conversions", 0) or 0),
            })
    return rows, None


def _fin_declaree(brut) -> str | None:
    """Google Ads ecrit 2037-12-30 pour « pas de date de fin ».

    On ne stocke jamais cette date : elle se lirait « campagne programmee
    jusqu'en 2037 » et tracerait une barre de onze ans. NULL veut dire ici
    « declaree sans fin », ce qui est la verite.
    """
    if not brut:
        return None
    d = str(brut)[:10]
    return None if d >= "2037-01-01" else d


def _micros(v) -> float | None:
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
    url = f"{_BASE}/customers/{customer_id}/googleAds:searchStream"
    try:
        r = requests.post(url, headers=_headers(access_token, login_customer_id),
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
            journalier = _micros(bud.get("amountMicros", bud.get("amount_micros")))
            total = _micros(bud.get("totalAmountMicros", bud.get("total_amount_micros")))
            rows.append({
                "campaign_id":   cid,
                "campaign_name": camp.get("name", ""),
                "status":        camp.get("status", ""),
                "start_date":    camp.get("startDate") or camp.get("start_date") or None,
                "end_date":      _fin_declaree(camp.get("endDate") or camp.get("end_date")),
                "daily_budget":  None if total else journalier,
                "total_budget":  total,
            })
    return rows, None


def fetch_campaign_statuses(
    access_token: str,
    customer_id: str,
    login_customer_id: str | None = None,
) -> tuple[dict[str, tuple[str, str, str | None, str | None]], str | None]:
    """Fetch statut ET dates declarees de chaque campagne (sans insights).

    Returns: ({campaign_id: (name, status, start_date, end_date)}, error|None)
    `end_date` None = declaree sans date de fin (sentinelle 2037 normalisee).
    """
    query = """
        SELECT campaign.id, campaign.name, campaign.status,
               campaign.start_date, campaign.end_date
        FROM campaign
    """
    url = f"{_BASE}/customers/{customer_id}/googleAds:searchStream"
    try:
        r = requests.post(url, headers=_headers(access_token, login_customer_id),
                          json={"query": query}, timeout=20)
        data = r.json()
    except Exception as e:
        return {}, f"Erreur API: {e}"

    if isinstance(data, dict) and "error" in data:
        return {}, data["error"].get("message", "inconnue")

    out = {}
    batches = data if isinstance(data, list) else [data]
    for batch in batches:
        for row in batch.get("results", []):
            camp = row.get("campaign", {})
            cid = str(camp.get("id", ""))
            if cid:
                out[cid] = (
                    camp.get("name", ""),
                    camp.get("status", ""),
                    camp.get("startDate") or camp.get("start_date") or None,
                    _fin_declaree(camp.get("endDate") or camp.get("end_date")),
                )
    return out, None


# ── Le journal des changements DÉCLARÉS (change_event) ────────────────────────
#
# Trois contraintes de l'API, qui font rejeter la requête si on les oublie :
#   1. la fenêtre ne peut pas dépasser 30 JOURS — au-delà, l'information
#      n'existe plus, aucun rattrapage n'est possible ;
#   2. le filtre sur change_date_time est OBLIGATOIRE ;
#   3. LIMIT est OBLIGATOIRE, et plafonné à 10 000.
#
# Doc : https://developers.google.com/google-ads/api/docs/change-event

_CHANGE_FENETRE_MAX = 30


def _chf(v: float) -> str:
    """Un montant écrit à la française — « 1 234,50 ». Les phrases du fil sont
    lues telles quelles, elles ne repassent par aucun formateur."""
    return f"{v:,.2f}".replace(",", " ").replace(".", ",")


def _champs(brut) -> set[str]:
    """Les champs modifiés, normalisés pour être comparables.

    Le FieldMask du JSON REST arrive en lowerCamelCase (`cpcBidMicros`) alors
    que la doc GAQL parle en snake_case (`cpc_bid_micros`) — et selon les
    versions il arrive soit en chaîne « a,b », soit en objet {"paths": [...]}.
    On aplatit tout en minuscules sans séparateur : une seule forme à comparer.
    """
    if not brut:
        return set()
    if isinstance(brut, dict):
        parts = brut.get("paths") or []
    elif isinstance(brut, (list, tuple)):
        parts = list(brut)
    else:
        parts = str(brut).split(",")
    out = set()
    for p in parts:
        p = str(p).strip()
        if p:
            out.add(p.replace("_", "").replace(".", "").lower())
    return out


def _dernier_segment(resource_name) -> str | None:
    if not resource_name:
        return None
    return str(resource_name).rstrip("/").split("/")[-1] or None


def _ressource(bloc: dict, cle_camel: str, cle_snake: str) -> dict:
    """`old_resource` / `new_resource` est un oneof : un seul de ses champs est
    rempli, et son nom dépend du type de ressource touchée."""
    if not isinstance(bloc, dict):
        return {}
    return bloc.get(cle_camel) or bloc.get(cle_snake) or {}


_ETATS = {
    "PAUSED":  "a été mise en pause",
    "ENABLED": "a été réactivée",
    "REMOVED": "a été supprimée",
}
_ETATS_M = {   # même chose, accord au masculin
    "PAUSED":  "a été mis en pause",
    "ENABLED": "a été réactivé",
    "REMOVED": "a été supprimé",
}


def _mot_cle(bloc: dict) -> str | None:
    crit = _ressource(bloc, "adGroupCriterion", "ad_group_criterion")
    kw = crit.get("keyword") or {}
    return (kw.get("text") or "").strip() or None


def _traduire_google(ev: dict, nom_campagne: str | None) -> tuple[str, str] | None:
    """(categorie, resume) — ou None quand on ne sait pas nommer le fait.

    La règle vaut plus que la couverture : on n'écrit RIEN qu'on ne sache dire
    en français. Un fil rempli de « AD_GROUP_AD updated » chasse les lignes
    utiles et fait perdre confiance dans celles qui restent.
    """
    typ = str(ev.get("changeResourceType") or ev.get("change_resource_type") or "").upper()
    op = str(ev.get("resourceChangeOperation") or ev.get("resource_change_operation") or "").upper()
    champs = _champs(ev.get("changedFields") or ev.get("changed_fields"))
    old = ev.get("oldResource") or ev.get("old_resource") or {}
    new = ev.get("newResource") or ev.get("new_resource") or {}
    de_la_campagne = f' de la campagne "{nom_campagne}"' if nom_campagne else ""

    # ── L'enchère, quel que soit le niveau où elle a bougé ────────────────────
    if any(c.startswith("biddingstrategy") for c in champs):
        return ("enchere", f"la stratégie d'enchères{de_la_campagne} a été changée")
    if "cpcbidmicros" in champs:
        a = _micros(_ressource(old, "adGroupCriterion", "ad_group_criterion").get("cpcBidMicros"))
        b = _micros(_ressource(new, "adGroupCriterion", "ad_group_criterion").get("cpcBidMicros"))
        mot = _mot_cle(new) or _mot_cle(old)
        quoi = f'l\'enchère au clic du mot-clé "{mot}"' if mot else f"l'enchère au clic{de_la_campagne}"
        if a is not None and b is not None:
            return ("enchere", f"{quoi} est passée de {_chf(a)} à {_chf(b)} CHF")
        return ("enchere", f"{quoi} a été changée")
    if "targetcpa" in champs or "targetcpamicros" in champs:
        a = _micros((_ressource(old, "campaign", "campaign").get("targetCpa") or {}).get("targetCpaMicros"))
        b = _micros((_ressource(new, "campaign", "campaign").get("targetCpa") or {}).get("targetCpaMicros"))
        if a is not None and b is not None:
            return ("enchere", f"le coût par acquisition visé{de_la_campagne} est passé de {_chf(a)} à {_chf(b)} CHF")
        return ("enchere", f"le coût par acquisition visé{de_la_campagne} a été changé")
    if "targetroas" in champs:
        a = (_ressource(old, "campaign", "campaign").get("targetRoas") or {}).get("targetRoas")
        b = (_ressource(new, "campaign", "campaign").get("targetRoas") or {}).get("targetRoas")
        try:
            if a is not None and b is not None:
                return ("enchere", f"le retour publicitaire visé{de_la_campagne} est passé de "
                                   f"{_chf(float(a))} à {_chf(float(b))}")
        except (TypeError, ValueError):
            pass
        return ("enchere", f"le retour publicitaire visé{de_la_campagne} a été changé")

    # ── Le budget ────────────────────────────────────────────────────────────
    if typ == "CAMPAIGN_BUDGET":
        a = _micros(_ressource(old, "campaignBudget", "campaign_budget").get("amountMicros"))
        b = _micros(_ressource(new, "campaignBudget", "campaign_budget").get("amountMicros"))
        sujet = f"le budget quotidien{de_la_campagne}" if de_la_campagne else "le budget quotidien"
        if a is not None and b is not None and a != b:
            return ("budget", f"{sujet} est passé de {_chf(a)} à {_chf(b)} CHF")
        if b is not None:
            return ("budget", f"{sujet} a été réglé à {_chf(b)} CHF")
        return ("budget", f"{sujet} a été modifié")

    # ── Le mot-clé ───────────────────────────────────────────────────────────
    if typ == "AD_GROUP_CRITERION":
        mot = _mot_cle(new) or _mot_cle(old)
        # Un critère sans texte n'est pas un mot-clé (audience, tranche d'âge,
        # emplacement…) et on ne saurait pas le nommer : on ne l'écrit pas.
        if not mot:
            return None
        if op == "CREATE":
            return ("motcle", f'le mot-clé "{mot}" a été ajouté')
        if op == "REMOVE":
            return ("motcle", f'le mot-clé "{mot}" a été supprimé')
        if "status" in champs:
            etat = str(_ressource(new, "adGroupCriterion", "ad_group_criterion").get("status") or "").upper()
            if etat in _ETATS_M:
                return ("motcle", f'le mot-clé "{mot}" {_ETATS_M[etat]}')
        return None

    # ── Le statut d'une campagne ou d'un groupe d'annonces ────────────────────
    if typ == "CAMPAIGN" and "status" in champs:
        etat = str(_ressource(new, "campaign", "campaign").get("status") or "").upper()
        nom = nom_campagne or (_ressource(new, "campaign", "campaign").get("name")
                               or _ressource(old, "campaign", "campaign").get("name"))
        if etat in _ETATS and nom:
            return ("statut", f'la campagne "{nom}" {_ETATS[etat]}')
        return None
    if typ == "AD_GROUP" and "status" in champs:
        etat = str(_ressource(new, "adGroup", "ad_group").get("status") or "").upper()
        nom = (_ressource(new, "adGroup", "ad_group").get("name")
               or _ressource(old, "adGroup", "ad_group").get("name"))
        if etat not in _ETATS_M:
            return None
        if nom:
            return ("statut", f'le groupe d\'annonces "{nom}" {_ETATS_M[etat]}')
        if nom_campagne:
            return ("statut", f"un groupe d'annonces{de_la_campagne} {_ETATS_M[etat]}")
        return None

    # ── Le reste : uniquement ce qu'on sait nommer ───────────────────────────
    if typ == "CAMPAIGN" and op == "CREATE":
        nom = nom_campagne or _ressource(new, "campaign", "campaign").get("name")
        return ("autre", f'la campagne "{nom}" a été créée') if nom else None
    if typ == "AD_GROUP_AD" and de_la_campagne:
        if op == "CREATE":
            return ("creatif", f"une nouvelle annonce a été ajoutée{de_la_campagne}")
        if op == "REMOVE":
            return ("creatif", f"une annonce a été retirée{de_la_campagne}")
    return None


def _cle_changement(canal: str, quand: str, *parts) -> str:
    """Hachage stable de (canal, horodatage, ressource, champ).

    Stable veut dire : recalculable à l'identique à chaque récolte, pour qu'un
    second passage sur la même semaine ne duplique rien. L'identifiant de la
    ressource entre dans le hachage — sans lui, deux mots-clés modifiés dans la
    même seconde s'écraseraient l'un l'autre.
    """
    import hashlib
    brut = "|".join([canal, str(quand)] + [str(p or "") for p in parts])
    return hashlib.sha1(brut.encode("utf-8")).hexdigest()[:24]


def fetch_campaign_changes(
    access_token: str,
    customer_id: str,
    since: "date",
    login_customer_id: str | None = None,
    noms_campagnes: dict[str, str] | None = None,
) -> tuple[list[dict], str | None]:
    """Les changements DÉCLARÉS par Google Ads depuis `since`.

    `since` est ramené à 30 jours en arrière quoi qu'on demande : c'est la
    limite dure de `change_event`, et une fenêtre plus large fait rejeter la
    requête entière — donc zéro changement au lieu de trente jours.

    `noms_campagnes` : {campaign_id: nom}, tel que le rend
    `fetch_campaign_statuses`. Sans lui, `change_event` ne donne que le nom de
    ressource de la campagne, et les phrases perdent le seul mot qui les rend
    lisibles.

    Returns: (rows, error|None) — chaque row : change_id, occurred_at,
    categorie, campaign_id, campaign_name, resume.
    """
    plancher = date.today() - timedelta(days=_CHANGE_FENETRE_MAX - 1)
    depuis = max(since, plancher)
    noms = noms_campagnes or {}

    query = f"""
        SELECT change_event.change_date_time, change_event.change_resource_type,
               change_event.changed_fields, change_event.resource_change_operation,
               change_event.old_resource, change_event.new_resource,
               change_event.campaign, change_event.client_type
        FROM change_event
        WHERE change_event.change_date_time >= '{depuis.isoformat()}'
        ORDER BY change_event.change_date_time DESC
        LIMIT 10000
    """
    url = f"{_BASE}/customers/{customer_id}/googleAds:searchStream"
    try:
        r = requests.post(url, headers=_headers(access_token, login_customer_id),
                          json={"query": query}, timeout=60)
        data = r.json()
    except Exception as e:
        return [], f"Erreur API: {e}"

    if isinstance(data, dict) and "error" in data:
        return [], data["error"].get("message", str(data["error"]))

    rows: list[dict] = []
    vus: set[str] = set()
    batches = data if isinstance(data, list) else [data]
    for batch in batches:
        if isinstance(batch, dict) and "error" in batch:
            return [], batch["error"].get("message", str(batch["error"]))
        for row in batch.get("results", []):
            ev = row.get("changeEvent", row.get("change_event", {})) or {}
            quand = ev.get("changeDateTime") or ev.get("change_date_time")
            if not quand:
                continue
            cid = _dernier_segment(ev.get("campaign"))
            nom = noms.get(str(cid)) if cid else None
            traduit = _traduire_google(ev, nom)
            if not traduit:
                continue
            categorie, resume = traduit
            cle = _cle_changement(
                "google", quand,
                ev.get("changeResourceType") or ev.get("change_resource_type"),
                sorted(_champs(ev.get("changedFields") or ev.get("changed_fields"))),
                cid, resume,
            )
            if cle in vus:
                continue
            vus.add(cle)
            rows.append({
                "change_id":     cle,
                # Google écrit « 2026-08-11 14:03:22.114550 » (heure du fuseau
                # du compte, sans décalage). Postgres le lit tel quel ; on ne
                # bricole pas de fuseau qu'on ne connaît pas.
                "occurred_at":   str(quand),
                "categorie":     categorie,
                "campaign_id":   str(cid) if cid else None,
                "campaign_name": nom,
                "resume":        resume,
            })
    return rows, None
