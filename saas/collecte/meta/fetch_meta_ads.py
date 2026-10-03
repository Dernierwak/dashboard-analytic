import requests
import json

# ── Récolte headless — appelée par le worker ──────────────────────────────────
# Rien de ce qui suit ne dépend d'une interface : ces fonctions tournent dans
# le cron, sans personne connecté.

_GRAPH = "https://graph.facebook.com/v24.0"


def _centimes(v) -> float | None:
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


def _pages(url: str, params: dict, timeout: int = 30) -> list[dict]:
    """Suit `paging.next` jusqu'au bout. Un compte de 40 campagnes tient sur une
    page, un compte d'agence non — et la page manquante ne lève aucune erreur."""
    out: list[dict] = []
    try:
        data = requests.get(url, params=params, timeout=timeout).json()
    except Exception:
        return out
    out += data.get("data", []) or []
    nxt = (data.get("paging") or {}).get("next")
    while nxt:
        try:
            data = requests.get(nxt, timeout=timeout).json()
        except Exception:
            break
        out += data.get("data", []) or []
        nxt = (data.get("paging") or {}).get("next")
    return out


def _budget_des_adsets(token: str, campaign_id: str) -> tuple[float | None, float | None]:
    """Somme des budgets des ad sets d'une campagne.

    POURQUOI C'EST OBLIGATOIRE : quand le CBO (budget au niveau campagne) est
    désactivé — c'est le réglage par DÉFAUT sur beaucoup de comptes — la
    campagne ne porte aucun budget, il vit sur chaque ad set. Sans cette
    remontée, un compte entier affiche « 0 CHF planifié » alors qu'il dépense
    tous les jours, et la page Coûts conclut qu'il n'y a rien de prévu.

    Returns: (journalier, total) en CHF, None quand aucun ad set n'en porte.
    """
    rows = _pages(
        f"{_GRAPH}/{campaign_id}/adsets",
        {"access_token": token, "fields": "daily_budget,lifetime_budget", "limit": 200},
    )
    jour = 0.0
    total = 0.0
    for a in rows:
        jour += _centimes(a.get("daily_budget")) or 0.0
        total += _centimes(a.get("lifetime_budget")) or 0.0
    return (jour or None), (total or None)


def _jour(v) -> str | None:
    """`start_time` de Meta est un horodatage ISO avec fuseau ; on ne garde que
    le jour, seule granularité que la frise et le prorata savent lire."""
    return str(v)[:10] if v else None


def fetch_campaign_budgets(token: str, ad_account_id: str) -> tuple[list[dict], str | None]:
    """Le budget PLANIFIÉ de chaque campagne Meta, à l'instant du relevé.

    Returns: (rows, error|None) — chaque row : campaign_id, campaign_name,
    status, start_date, end_date, daily_budget, total_budget.
    `end_date` None = campagne déclarée sans fin (pas de `stop_time`).
    """
    if not (token and ad_account_id):
        return [], "token ou ad_account_id manquant"
    try:
        resp = requests.get(
            f"{_GRAPH}/{ad_account_id}/campaigns",
            params={
                "access_token": token,
                "fields": "id,name,status,objective,daily_budget,lifetime_budget,"
                          "budget_remaining,start_time,stop_time",
                "limit": 200,
            },
            timeout=30,
        ).json()
    except Exception as e:
        return [], f"Erreur API: {e}"
    if isinstance(resp, dict) and resp.get("error"):
        return [], resp["error"].get("message", str(resp["error"]))

    camps = resp.get("data", []) or []
    nxt = (resp.get("paging") or {}).get("next")
    while nxt:
        try:
            page = requests.get(nxt, timeout=30).json()
        except Exception:
            break
        camps += page.get("data", []) or []
        nxt = (page.get("paging") or {}).get("next")

    rows: list[dict] = []
    for c in camps:
        cid = str(c.get("id") or "")
        if not cid:
            continue
        jour = _centimes(c.get("daily_budget"))
        total = _centimes(c.get("lifetime_budget"))
        if jour is None and total is None:
            # Budget par ad set (CBO désactivé) — un appel de plus par campagne,
            # et c'est le seul moyen de connaître la promesse.
            jour, total = _budget_des_adsets(token, cid)
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
    return rows, None


# ── Les insights (/insights, niveau `ad`) → lignes de meta_ads_insights ──────

def _link_clicks(actions) -> int:
    # Le `else 0` fabrique un zéro quand Meta omet `link_click` : défaut connu,
    # ticket `.scratch/corrections/issues/01`, pas corrigé ici.
    lc = next((it for it in actions or [] if it.get("action_type") == "link_click"), None)
    return int(lc.get("value", 0)) if lc else 0


def lignes_meta_ads(user_id: str, reponse: list[dict]) -> tuple[list[dict], int]:
    """Les lignes de /insights (niveau `ad`) → les lignes de meta_ads_insights.

    Pure, sans réseau : c'est le seam de test de la récolte Meta (spec
    `.scratch/meta-ads/spec.md`, « Testing Decisions »). Rend (lignes, nombre de lignes sans ad_id).

    LA CLÉ EST `ad_id`, PAS `ad_name`, ET ÇA A COÛTÉ DE LA DÉPENSE RÉELLE.
    `ad_name` est l'étiquette lisible que l'annonceur choisit : rien n'interdit
    deux annonces « Video 1 » dans deux Groupes, et c'est le montage courant.
    Tant que la déduplication portait sur le nom, la seconde annonce n'était
    pas mal attribuée — elle n'entrait jamais en base. Mesuré sur le compte de
    test au 19-20/08/2026 : ~17 € puis ~15 €, environ 40 % de la dépense Meta
    de ces jours-là. `ad_id` est le numéro que Meta attribue à la création, il
    n'est jamais dupliqué.
    """
    seen = set()
    records = []
    sans_id = 0
    for row in reponse:
        ad_id = row.get("ad_id")
        # Une ligne sans ad_id ne peut pas être dédupliquée : elle n'entrerait
        # en conflit avec rien (Postgres ne rapproche jamais deux NULL sous une
        # contrainte UNIQUE) et se réinsèrerait à chaque récolte, doublant la
        # dépense du jour. Meta renvoie toujours ad_id au niveau `ad` ; si ça
        # change un jour, on veut le voir dans le journal, pas le découvrir
        # dans un total qui enfle.
        if not ad_id:
            sans_id += 1
            continue
        key = (row.get("date_start"), ad_id)
        if key in seen:
            continue
        seen.add(key)
        records.append({
            "user_id": user_id,
            "date_start": row.get("date_start"),
            "ad_id": str(ad_id),
            # Les IDs sont recopiés, jamais reconstitués depuis un nom : une
            # ligne sans ID reste sans ID (`.scratch/meta-ads/spec.md`,
            # « L'identité par ID »).
            "campaign_id": str(row["campaign_id"]) if row.get("campaign_id") else None,
            "adset_id": str(row["adset_id"]) if row.get("adset_id") else None,
            "campaign_name": row.get("campaign_name", ""),
            "adset_name": row.get("adset_name", ""),
            "ad_name": row.get("ad_name", ""),
            "impressions": int(row.get("impressions") or 0),
            "clicks": int(row.get("clicks") or 0),
            "reach": int(row.get("reach") or 0) if row.get("reach") is not None else None,
            "link_clicks": _link_clicks(row.get("actions")),
            "spend": float(row.get("spend") or 0),
            "attribution_setting": row.get("attribution_setting"),
            # La colonne « Résultats » d'Ads Manager, TELLE QUE META LA REND :
            # sa forme d'élément n'est documentée nulle part
            # (`.scratch/meta-ads/recherche/colonne-resultats.md`), elle se lit dans la base avant d'être
            # affichée. `.get` garde la distinction qui compte : champ absent
            # → NULL, liste vide → liste vide. Ni l'un ni l'autre n'est un 0.
            "results": row.get("results"),
        })
    return records, sans_id


# ── Le journal des changements DÉCLARÉS (/activities) ────────────────────────
#
# Meta tient le journal de ce qui a été touché dans le compte publicitaire.
# C'est le pendant de `change_event` chez Google, et il comble le même angle
# mort : changer une audience ou remplacer un visuel ne bouge pas forcément la
# dépense du jour, donc rien ne le trahissait dans nos courbes.

_ACTIVITES = {
    "update_campaign_budget":     "budget",
    "update_ad_set_budget":       "budget",
    "update_campaign_run_status": "statut",
    "update_ad_set_run_status":   "statut",
    "update_ad_set_target_spec":  "audience",
    "update_ad_creative":         "creatif",
}

# Les événements portés par la campagne elle-même. Pour les autres, on laisse
# `campaign_id` vide plutôt que d'y ranger l'identifiant d'un ad set : le
# rattachement à la campagne se ferait sur une clé fausse, en silence.
_NIVEAU_CAMPAGNE = {"update_campaign_budget", "update_campaign_run_status"}

_ETATS_META = {
    "PAUSED":   "a été mise en pause",
    "ACTIVE":   "a été réactivée",
    "ARCHIVED": "a été archivée",
    "DELETED":  "a été supprimée",
}


def _chf_fr(v: float) -> str:
    return f"{v:,.2f}".replace(",", " ").replace(".", ",")


def _extra(brut) -> dict:
    """`extra_data` arrive en CHAÎNE JSON, pas en objet — un json.loads de plus.

    Hypothèse sur sa forme : Meta ne la documente pas, on observe
    {"old_value": …, "new_value": …}. Quand elle n'est pas là ou pas lisible, on
    écrit la phrase sans les valeurs plutôt que d'inventer des chiffres.
    """
    if isinstance(brut, dict):
        return brut
    if not brut:
        return {}
    try:
        d = json.loads(brut)
        return d if isinstance(d, dict) else {}
    except Exception:
        return {}


def _cle_meta(quand: str, *parts) -> str:
    """Hachage stable de (canal, horodatage, ressource, champ) — même rôle que
    côté Google : deux récoltes sur la même semaine ne doivent rien dupliquer.

    La phrase n'entre pas dans le hachage : une reformulation ferait réinsérer
    en double tout l'historique au lieu de le mettre à jour."""
    import hashlib
    brut = "|".join(["meta", str(quand)] + [str(p or "") for p in parts])
    return hashlib.sha1(brut.encode("utf-8")).hexdigest()[:24]


def _traduire_meta(act: dict) -> tuple[str, str] | None:
    """(categorie, resume) — ou None quand on ne sait pas nommer le fait."""
    typ = str(act.get("event_type") or "")
    categorie = _ACTIVITES.get(typ)
    if not categorie:
        return None
    nom = (act.get("object_name") or "").strip()
    # Sans le nom de l'objet touché, la phrase se réduirait à « une campagne a
    # changé » — un bruit qui chasse les lignes utiles du fil.
    if not nom:
        return None
    extra = _extra(act.get("extra_data"))
    avant, apres = extra.get("old_value"), extra.get("new_value")
    est_campagne = typ in _NIVEAU_CAMPAGNE
    objet = f'la campagne "{nom}"' if est_campagne else f'l\'ensemble "{nom}"'

    if categorie == "budget":
        a, b = _centimes(avant), _centimes(apres)
        if a is not None and b is not None and a != b:
            return ("budget", f"le budget de {objet} est passé de {_chf_fr(a)} à {_chf_fr(b)} CHF")
        if b is not None:
            return ("budget", f"le budget de {objet} a été réglé à {_chf_fr(b)} CHF")
        return ("budget", f"le budget de {objet} a été modifié")

    if categorie == "statut":
        etat = str(apres or "").upper()
        if etat in _ETATS_META:
            quoi = "la campagne" if est_campagne else "l'ensemble"
            return ("statut", f'{quoi} "{nom}" {_ETATS_META[etat]}')
        return None

    if categorie == "audience":
        return ("audience", f"le ciblage de l'ensemble \"{nom}\" a été modifié")

    if categorie == "creatif":
        return ("creatif", f"le visuel de l'annonce \"{nom}\" a été remplacé")

    return None


# Le worker demande six mois d'activités à chaque passage hebdomadaire, à 500
# par page. La boucle de pagination ne s'arrêtait que quand Meta cessait de
# rendre un `paging.next` — or le Graph API sait rendre un curseur `next` sur
# une page VIDE, et rien ici n'empêchait alors la boucle de tourner sans fin sur
# un seul compte, en mangeant le passage de tous les autres.
#
# 40 pages = 20 000 activités, soit ~110 changements par jour, tous les jours,
# pendant six mois. Au-delà on n'apprend plus rien d'utile : le fil n'affiche
# que 60 jours et l'écriture est idempotente. Le chiffre borne aussi le pire cas
# en temps — 40 requêtes à 45 s de timeout, pas une boucle infinie.
_ACTIVITES_PAGES_MAX = 40


def fetch_activities(
    token: str,
    ad_account_id: str,
    since: str,
    until: str | None = None,
) -> tuple[list[dict], str | None]:
    """Les changements DÉCLARÉS par Meta entre `since` et `until` (YYYY-MM-DD).

    Returns: (rows, error|None) — chaque row : change_id, occurred_at,
    categorie, campaign_id, campaign_name, resume.
    Seuls les événements qu'on sait dire en français ressortent : le reste est
    écarté ici, pas filtré à l'affichage.
    """
    if not (token and ad_account_id):
        return [], "token ou ad_account_id manquant"
    params = {
        "access_token": token,
        "fields": "event_type,event_time,object_id,object_name,extra_data",
        "since": since,
        "limit": 500,
    }
    if until:
        params["until"] = until
    try:
        resp = requests.get(f"{_GRAPH}/{ad_account_id}/activities",
                            params=params, timeout=45).json()
    except Exception as e:
        return [], f"Erreur API: {e}"
    if isinstance(resp, dict) and resp.get("error"):
        return [], resp["error"].get("message", str(resp["error"]))

    actes = resp.get("data", []) or []
    nxt = (resp.get("paging") or {}).get("next")
    pages = 1
    while nxt and pages < _ACTIVITES_PAGES_MAX:
        try:
            page = requests.get(nxt, timeout=45).json()
        except Exception:
            break
        lot = page.get("data", []) or []
        # Page vide alors qu'un `next` est encore là = curseur épuisé qui tourne
        # à vide. On s'arrête plutôt que de suivre un lien qui ne rend plus rien.
        if not lot:
            break
        actes += lot
        pages += 1
        nxt = (page.get("paging") or {}).get("next")
    if nxt and pages >= _ACTIVITES_PAGES_MAX:
        # Pas une erreur : ce qui a été lu est bon et sera écrit. Mais ça se
        # dit, sinon la troncature est parfaitement invisible.
        print(f"    activités Meta : arrêt à {_ACTIVITES_PAGES_MAX} pages "
              f"({len(actes)} activités lues), la suite est ignorée.")

    rows: list[dict] = []
    vus: set[str] = set()
    for a in actes:
        quand = a.get("event_time")
        if not quand:
            continue
        traduit = _traduire_meta(a)
        if not traduit:
            continue
        categorie, resume = traduit
        est_campagne = str(a.get("event_type") or "") in _NIVEAU_CAMPAGNE
        cle = _cle_meta(quand, a.get("event_type"), a.get("object_id"))
        if cle in vus:
            continue
        vus.add(cle)
        rows.append({
            "change_id":     cle,
            "occurred_at":   str(quand),
            "categorie":     categorie,
            "campaign_id":   str(a.get("object_id")) if (est_campagne and a.get("object_id")) else None,
            "campaign_name": (a.get("object_name") or None) if est_campagne else None,
            "resume":        resume,
        })
    return rows, None
