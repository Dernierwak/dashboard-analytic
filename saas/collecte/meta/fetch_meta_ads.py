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


def lignes_config_meta(user_id: str, campagnes: list[dict]) -> tuple[list[dict], int]:
    """Les campagnes DÉCLARÉES (/campaigns) → les lignes de meta_campaign_config.

    Pure, sans réseau. Rend (lignes, nombre de campagnes sans id).

    LA LIGNE SE RATTACHE PAR L'ID, LE NOM N'EST QU'UNE ÉTIQUETTE QUI SUIT.
    Une campagne renommée dans Meta perdait sa ligne : la clé par nom en
    créait une seconde au nouveau nom, et l'ancienne gardait le statut et les
    dates d'une campagne qui n'existait plus sous ce nom (spec
    `.scratch/meta-ads/spec.md`, « L'identité par ID » ; ticket 13).
    """
    def _jour(v):
        return str(v)[:10] if v else None

    lignes, vus, sans_id = [], set(), 0
    for c in campagnes:
        campaign_id = c.get("id")
        # Meta rend toujours `id` sur /campaigns. Une ligne sans lui ne pourrait
        # se rattacher que par le nom — c'est exactement ce que ce seam retire.
        if not campaign_id:
            sans_id += 1
            continue
        if campaign_id in vus:
            continue
        vus.add(campaign_id)
        lignes.append({
            "user_id": user_id,
            "campaign_id": str(campaign_id),
            "campaign_name": c.get("name") or "",
            "effective_status": c.get("effective_status") or None,
            "start_date": _jour(c.get("start_time")),
            # stop_time absent = campagne sans date de fin programmée.
            "end_date": _jour(c.get("stop_time")),
        })
    return lignes, sans_id


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
    # Élargis par la carte meta-ads (décision `.scratch/meta-ads/issues/08`, construite
    # au ticket 04) : ce sont les gestes courants
    # d'Ads Manager, et `/activities` les documente
    # (https://developers.facebook.com/docs/marketing-api/reference/ad-activity/).
    # La revue de Meta (`ad_review_*`) n'est pas retenue : ce n'est pas un
    # geste du client.
    "update_ad_run_status":       "statut",
    "update_ad_set_bidding":      "enchere",
    "update_ad_set_bid_strategy": "enchere",
    "update_ad_bid_info":         "enchere",
    "create_campaign_group":      "creation",
    "create_ad_set":              "creation",
    "create_ad":                  "creation",
}

# LES NOUVEAUX TYPES NE LISENT PAS `extra_data`. Sa forme n'est documentée nulle
# part et aucun exemple réel n'a encore été lu pour eux : la phrase dit ce que
# le type d'événement établit à lui seul, sans valeur avant/après. Une valeur ne
# s'ajoute qu'une fois un `extra_data` réel recopié dans le ticket 04.
_PHRASES_SANS_VALEUR = {
    "update_ad_run_status":       'le statut de l\'annonce "{nom}" a été modifié',
    "update_ad_set_bidding":      'l\'enchère du groupe d\'annonces "{nom}" a été modifiée',
    "update_ad_set_bid_strategy": 'la stratégie d\'enchère du groupe d\'annonces "{nom}" a été modifiée',
    "update_ad_bid_info":         'l\'enchère de l\'annonce "{nom}" a été modifiée',
    "create_campaign_group":      'la campagne "{nom}" a été créée',
    "create_ad_set":              'le groupe d\'annonces "{nom}" a été créé',
    "create_ad":                  'l\'annonce "{nom}" a été créée',
}

# Les événements portés par la campagne elle-même : leur `object_id` EST la
# campagne. Pour les autres, `object_id` est un groupe d'annonces ou une annonce, et la
# campagne se retrouve par l'ID dans la hiérarchie des insights
# (`hierarchie_depuis_insights`) — jamais en rangeant l'ID d'un groupe d'annonces dans
# `campaign_id`, ce qui rattacherait le changement sur une clé fausse.
_NIVEAU_CAMPAGNE = {"update_campaign_budget", "update_campaign_run_status",
                    "create_campaign_group"}

# Groupe d'annonces ou annonce → (campaign_id, campaign_name) : `hierarchie_depuis_insights`.
Parents = dict[str, tuple[str, str | None]]

# (campagne, groupe d'annonces) : le participe s'accorde avec le sujet, et le
# groupe d'annonces est masculin (CONTEXT.md, **Groupe d'annonces**).
_ETATS_META = {
    "PAUSED":   ("a été mise en pause", "a été mis en pause"),
    "ACTIVE":   ("a été réactivée",     "a été réactivé"),
    "ARCHIVED": ("a été archivée",      "a été archivé"),
    "DELETED":  ("a été supprimée",     "a été supprimé"),
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
    if typ in _PHRASES_SANS_VALEUR:
        return (categorie, _PHRASES_SANS_VALEUR[typ].format(nom=nom))
    extra = _extra(act.get("extra_data"))
    avant, apres = extra.get("old_value"), extra.get("new_value")
    est_campagne = typ in _NIVEAU_CAMPAGNE
    # « de » + « le groupe » se contracte en « du » : le complément s'écrit
    # entier pour chaque niveau plutôt que d'accoler « de » à l'objet.
    du_objet = f'de la campagne "{nom}"' if est_campagne else f'du groupe d\'annonces "{nom}"'

    if categorie == "budget":
        a, b = _centimes(avant), _centimes(apres)
        if a is not None and b is not None and a != b:
            return ("budget", f"le budget {du_objet} est passé de {_chf_fr(a)} à {_chf_fr(b)} CHF")
        if b is not None:
            return ("budget", f"le budget {du_objet} a été réglé à {_chf_fr(b)} CHF")
        return ("budget", f"le budget {du_objet} a été modifié")

    if categorie == "statut":
        etat = str(apres or "").upper()
        if etat in _ETATS_META:
            feminin, masculin = _ETATS_META[etat]
            if est_campagne:
                return ("statut", f'la campagne "{nom}" {feminin}')
            return ("statut", f'le groupe d\'annonces "{nom}" {masculin}')
        return None

    if categorie == "audience":
        return ("audience", f"le ciblage du groupe d'annonces \"{nom}\" a été modifié")

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
    parents: Parents | None = None,
    fuseau: str | None = None,
) -> tuple[list[dict], str | None]:
    """Les changements DÉCLARÉS par Meta entre `since` et `until` (YYYY-MM-DD).

    Returns: (rows, error|None) — chaque row : change_id, occurred_at,
    categorie, campaign_id, campaign_name, resume, et fuseau quand il est
    connu. `parents` rattache un changement de groupe d'annonces ou d'annonce
    à sa campagne, `fuseau` est celui du compte (`lignes_activites`).
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

    return lignes_activites(actes, parents or {}, fuseau), None


def compte_et_fuseau(comptes: list[dict]) -> tuple[str | None, str | None]:
    """`/me/adaccounts?fields=id,timezone_name` → (le compte lu, son fuseau).

    Le fuseau voyage avec chaque changement (ticket 17 de `.scratch/meta-ads/`) :
    Meta écrit `event_time` en UTC, alors que les jours des insights sont ceux
    du compte. Un fuseau absent rend None — jamais un fuseau supposé.
    """
    if not comptes:
        return None, None
    compte = comptes[0]
    return compte.get("id"), (str(compte.get("timezone_name") or "").strip() or None)



def hierarchie_depuis_insights(lignes: list[dict]) -> Parents:
    """Les lignes de meta_ads_insights → {id de groupe d'annonces ou d'annonce : (campaign_id, campaign_name)}.

    Pure. Meta numérote groupes d'annonces et annonces dans un même espace d'IDs, d'où
    un seul dictionnaire. Une ligne sans `campaign_id` (d'avant le rejeu du
    ticket 03) ne rattache rien : on ne reconstitue jamais une campagne depuis
    un nom. Le nom gardé est le plus récent, pour qu'une campagne renommée se
    lise sous un seul nom (spec, user story 51).
    """
    noms: dict[str, str | None] = {}
    for r in sorted(lignes, key=lambda r: str(r.get("date_start") or "")):
        if r.get("campaign_id"):
            noms[str(r["campaign_id"])] = r.get("campaign_name") or None
    parents: Parents = {}
    for r in lignes:
        if not r.get("campaign_id"):
            continue
        cid = str(r["campaign_id"])
        for oid in (r.get("adset_id"), r.get("ad_id")):
            if oid:
                parents[str(oid)] = (cid, noms[cid])
    return parents


def _campagne_de(act: dict, parents: Parents) -> tuple[str | None, str | None]:
    oid = str(act.get("object_id") or "")
    if not oid:
        return None, None
    if str(act.get("event_type") or "") in _NIVEAU_CAMPAGNE:
        return oid, (act.get("object_name") or None)
    return parents.get(oid, (None, None))


def lignes_activites(actes: list[dict], parents: Parents, fuseau: str | None = None) -> list[dict]:
    """La réponse de /activities → les lignes de platform_changes.

    Pure, sans réseau : c'est le seam de test du journal (harnais
    `.scratch/meta-ads/harnais/04-le-journal/`). `parents` vient de
    `hierarchie_depuis_insights` ; un ID absent laisse la campagne vide, et le
    changement ne se lit alors que sans filtre campagne.

    `occurred_at` reste l'instant UTC écrit par Meta ; `fuseau` dit dans quel
    fuseau l'écran découpe son jour. Inconnu, il n'est PAS envoyé : chaque
    passage relit 180 jours, et un `None` effacerait par upsert le fuseau
    déjà écrit.
    """
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
        cle = _cle_meta(quand, a.get("event_type"), a.get("object_id"))
        if cle in vus:
            continue
        vus.add(cle)
        campaign_id, campaign_name = _campagne_de(a, parents)
        rows.append({
            "change_id":     cle,
            "occurred_at":   str(quand),
            "categorie":     categorie,
            "campaign_id":   campaign_id,
            "campaign_name": campaign_name,
            "resume":        resume,
            **({"fuseau": fuseau} if fuseau else {}),
        })
    return rows


# ── Les créas (/ads?fields=creative{…}) → meta_ads_creatives et _assets ──────
#
# Ce que dit une annonce, pas ce qu'elle a mesuré : aucun chiffre ne sort
# d'ici (`.scratch/meta-ads/spec.md`, « Les créas »). Les champs et leurs
# sources sont dans `.scratch/meta-ads/recherche/champs-api-meta.md` § 4.

# `creative` est un CHAMP de l'annonce, pas une connexion : l'expansion le lit
# pour toute une page d'annonces en une requête, au lieu d'un appel par annonce.
# `call_to_action` n'est pas dans la liste de la recherche : c'est lui qui porte
# le bouton et, quand `link` manque, l'adresse (`value.link`).
_CHAMPS_CREA = (
    "id,name,object_type,title,body,image_hash,video_id,link_url,"
    "call_to_action_type,"
    "object_story_spec{"
    "link_data{message,name,description,link,image_hash,call_to_action,"
    "child_attachments{name,description,link,image_hash,video_id}},"
    "photo_data{caption,image_hash},"
    "video_data{video_id,title,message,link_description,image_hash,call_to_action}},"
    "asset_feed_spec{images{hash},videos{video_id,thumbnail_hash},"
    "bodies{text},titles{text},descriptions{text},link_urls{website_url},"
    "call_to_action_types}"
)

# 100 annonces par page : la réponse embarque une créa entière par annonce,
# carrousels compris. 50 pages = 5 000 annonces ; c'est un coupe-circuit contre
# un curseur qui tourne à vide (voir `_ACTIVITES_PAGES_MAX`), pas une limite.
_ANNONCES_PAR_PAGE = 100
_ANNONCES_PAGES_MAX = 50

# Les hashes voyagent dans l'URL de `/adimages` : un lot borné garde la requête
# loin des limites de longueur d'URL. 50 hashes de 32 caractères ≈ 2 Ko.
_HASHES_PAR_APPEL = 50


def _ou_null(v) -> str | None:
    """Une chaîne vide de Meta n'est pas un texte : elle s'écrit NULL."""
    return str(v) if v not in (None, "") else None


def _cta(bouton) -> tuple[str | None, str | None]:
    """`call_to_action` → (type du bouton, adresse du bouton)."""
    if not isinstance(bouton, dict):
        return None, None
    return _ou_null(bouton.get("type")), _ou_null((bouton.get("value") or {}).get("link"))


def _montage(crea: dict) -> str:
    """Lequel des trois montages porte le contenu.

    `asset_feed_spec` passe devant : une créa dynamique porte aussi un
    `object_story_spec`, réduit à la page qui publie, sans texte.
    """
    if crea.get("asset_feed_spec"):
        return "asset_feed"
    histoire = crea.get("object_story_spec") or {}
    if any(histoire.get(k) for k in ("link_data", "photo_data", "video_data")):
        return "object_story"
    return "flat"


def _contenu_object_story(histoire: dict) -> dict:
    """`object_story_spec` → les colonnes de contenu, `vignette_hash` en plus.

    Le titre d'un lien s'appelle `name`, pas `title` (recherche § 4 b) ; une
    photo n'a pas de titre, sa légende est la description.
    """
    if histoire.get("link_data"):
        lien = histoire["link_data"]
        bouton, lien_bouton = _cta(lien.get("call_to_action"))
        return {"titre": lien.get("name"), "texte": lien.get("message"),
                "description": lien.get("description"),
                "lien_url": lien.get("link") or lien_bouton,
                "call_to_action": bouton, "image_hash": lien.get("image_hash")}
    if histoire.get("video_data"):
        video = histoire["video_data"]
        bouton, lien_bouton = _cta(video.get("call_to_action"))
        # L'`image_hash` d'une vidéo est sa VIGNETTE (« to use as thumbnail »,
        # recherche § 4 b) : la ranger en visuel de l'annonce montrerait une
        # image fixe là où le client a mis une vidéo.
        return {"titre": video.get("title"), "texte": video.get("message"),
                "description": video.get("link_description"), "lien_url": lien_bouton,
                "call_to_action": bouton, "video_id": video.get("video_id"),
                "vignette_hash": video.get("image_hash")}
    photo = histoire.get("photo_data") or {}
    return {"description": photo.get("caption"), "image_hash": photo.get("image_hash")}


def _contenu_flat(crea: dict) -> dict:
    return {"titre": crea.get("title"), "texte": crea.get("body"),
            "lien_url": crea.get("link_url"),
            "call_to_action": crea.get("call_to_action_type"),
            "image_hash": crea.get("image_hash"), "video_id": crea.get("video_id")}


def _asset(provenance: str, kind: str, rang: int, **contenu) -> dict:
    return {"provenance": provenance, "asset_kind": kind, "rang": rang, **contenu}


def _assets_asset_feed(flux: dict) -> list[dict]:
    """Les variantes d'une créa dynamique, chacune à son rang dans la liste de Meta."""
    out: list[dict] = []
    for kind, cle in (("body", "bodies"), ("title", "titles"), ("description", "descriptions")):
        for rang, a in enumerate(flux.get(cle) or []):
            out.append(_asset("asset_feed", kind, rang, texte=a.get("text")))
    for rang, a in enumerate(flux.get("images") or []):
        out.append(_asset("asset_feed", "image", rang, image_hash=a.get("hash")))
    for rang, a in enumerate(flux.get("videos") or []):
        out.append(_asset("asset_feed", "video", rang, video_id=a.get("video_id"),
                          vignette_hash=a.get("thumbnail_hash")))
    for rang, a in enumerate(flux.get("link_urls") or []):
        out.append(_asset("asset_feed", "link_url", rang, lien_url=a.get("website_url")))
    for rang, bouton in enumerate(flux.get("call_to_action_types") or []):
        out.append(_asset("asset_feed", "call_to_action", rang, texte=bouton))
    return out


def _assets_carrousel(cartes: list[dict]) -> list[dict]:
    """Une ligne `carousel_card` par carte (titre, visuel, lien), et sa
    description au même rang. La table n'a qu'une colonne `texte` : la clé
    `(provenance, asset_kind, rang)` loge les deux sans changer le schéma."""
    out: list[dict] = []
    for rang, carte in enumerate(cartes):
        out.append(_asset("child_attachment", "carousel_card", rang,
                          texte=carte.get("name"), image_hash=carte.get("image_hash"),
                          video_id=carte.get("video_id"), lien_url=carte.get("link")))
        if carte.get("description"):
            out.append(_asset("child_attachment", "description", rang,
                              texte=carte["description"]))
    return out


def _bruts_de(crea: dict, montage: str) -> list[dict]:
    if montage == "asset_feed":
        return _assets_asset_feed(crea["asset_feed_spec"])
    lien = (crea.get("object_story_spec") or {}).get("link_data") or {}
    return _assets_carrousel(lien.get("child_attachments") or [])


_COLONNES_ASSET = ("texte", "image_hash", "video_id", "lien_url")


def _asset_ecrit(user_id: str, ad_id: str, brut: dict, stockees: dict[str, str]) -> dict:
    """Toutes les colonnes, toujours : PostgREST écrit NULL pour une clé
    absente d'une ligne mais présente dans le lot."""
    ligne = {"user_id": user_id, "ad_id": ad_id, "provenance": brut["provenance"],
             "asset_kind": brut["asset_kind"], "rang": brut["rang"]}
    for col in _COLONNES_ASSET:
        ligne[col] = _ou_null(brut.get(col))
    ligne["image_url"] = stockees.get(ligne["image_hash"] or "")
    ligne["vignette_url"] = stockees.get(brut.get("vignette_hash") or "")
    return ligne


def lignes_creas(
    user_id: str, annonces: list[dict], stockees: dict[str, str],
) -> tuple[list[dict], list[dict], int]:
    """La réponse de `/ads?fields=id,creative{…}` → (meta_ads_creatives,
    meta_ads_creative_assets, nombre d'annonces sans id).

    Pure, sans réseau : c'est le seam de test des créas (harnais
    `.scratch/meta-ads/harnais/05-les-creas/`). `stockees` associe un
    `image_hash` à son URL dans Supabase Storage.

    UNE IMAGE PAS ENCORE STOCKÉE S'ÉCRIT SANS URL, jamais avec celle de Meta :
    `AdImage.url` est « a temporary URL » (recherche § 5). L'écrire ferait un
    visuel qui s'affiche aujourd'hui et casse dans six mois sans que rien ne
    le distingue d'un visuel durable. Le hash, lui, reste : le passage suivant
    réessaie.
    """
    creas: list[dict] = []
    assets: list[dict] = []
    vues: set[str] = set()
    sans_id = 0
    for annonce in annonces:
        ad_id = annonce.get("id")
        if not ad_id:
            sans_id += 1
            continue
        ad_id = str(ad_id)
        crea = annonce.get("creative")
        if not isinstance(crea, dict) or ad_id in vues:
            continue
        vues.add(ad_id)
        montage = _montage(crea)
        contenu = (_contenu_object_story(crea["object_story_spec"])
                   if montage == "object_story" else _contenu_flat(crea))
        image_hash = _ou_null(contenu.get("image_hash"))
        creas.append({
            "user_id": user_id,
            "ad_id": ad_id,
            "creative_id": _ou_null(crea.get("id")),
            "creative_name": _ou_null(crea.get("name")),
            "montage": montage,
            "object_type": _ou_null(crea.get("object_type")),
            "titre": _ou_null(contenu.get("titre")),
            "texte": _ou_null(contenu.get("texte")),
            "description": _ou_null(contenu.get("description")),
            "lien_url": _ou_null(contenu.get("lien_url")),
            "call_to_action": _ou_null(contenu.get("call_to_action")),
            "image_hash": image_hash,
            "image_url": stockees.get(image_hash or ""),
            "video_id": _ou_null(contenu.get("video_id")),
            "vignette_url": stockees.get(contenu.get("vignette_hash") or ""),
        })
        assets += [_asset_ecrit(user_id, ad_id, b, stockees) for b in _bruts_de(crea, montage)]
    return creas, assets, sans_id


def hashes_des_creas(annonces: list[dict]) -> set[str]:
    """Tous les `image_hash` qu'une page de créas référence — visuels ET
    vignettes de vidéo. Pure : c'est la liste de ce qui doit être en stockage."""
    hashes: set[str] = set()
    for annonce in annonces:
        crea = annonce.get("creative")
        if not isinstance(crea, dict):
            continue
        montage = _montage(crea)
        contenu = (_contenu_object_story(crea["object_story_spec"])
                   if montage == "object_story" else _contenu_flat(crea))
        candidats = [contenu.get("image_hash"), contenu.get("vignette_hash")]
        for brut in _bruts_de(crea, montage):
            candidats += [brut.get("image_hash"), brut.get("vignette_hash")]
        hashes |= {str(h) for h in candidats if h}
    return hashes


def fetch_annonces_creas(token: str, ad_account_id: str) -> tuple[list[dict], str | None]:
    """Chaque annonce du compte avec sa créa — UNE requête par page d'annonces.

    Retour : (annonces, erreur) — `erreur` à None quand la liste est ENTIÈRE,
    même contrat que `_meta_campagnes` dans `fetch_all.py`. Une liste tronquée
    s'écrit quand même : seules les annonces relues voient leurs assets
    remplacés (`remplacer_creas`), les autres gardent ceux du passage d'avant.
    Les messages d'erreur ne portent jamais l'URL : elle contient le jeton.
    """
    if not (token and ad_account_id):
        return [], "token ou ad_account_id manquant"
    params = {"access_token": token, "fields": f"id,creative{{{_CHAMPS_CREA}}}",
              "limit": _ANNONCES_PAR_PAGE}
    try:
        page = requests.get(f"{_GRAPH}/{ad_account_id}/ads", params=params, timeout=60).json()
    except Exception as e:
        return [], type(e).__name__
    annonces: list[dict] = []
    for _ in range(_ANNONCES_PAGES_MAX):
        if not isinstance(page, dict):
            return annonces, f"réponse Meta inattendue ({type(page).__name__})"
        if page.get("error"):
            return annonces, page["error"].get("message", "erreur Meta")
        lot = page.get("data", []) or []
        annonces += lot
        nxt = (page.get("paging") or {}).get("next")
        # Page vide avec un `next` : curseur épuisé qui tourne à vide.
        if not nxt or not lot:
            return annonces, None
        try:
            page = requests.get(nxt, timeout=60).json()
        except Exception as e:
            return annonces, f"liste tronquée à {len(annonces)} annonce(s) ({type(e).__name__})"
    return annonces, (f"liste tronquée à {len(annonces)} annonce(s) : "
                      f"{_ANNONCES_PAGES_MAX} pages suivies sans fin de curseur")


def fetch_urls_images(token: str, ad_account_id: str, hashes: list[str]) -> dict[str, str]:
    """`image_hash` → URL de téléchargement chez Meta, par `/adimages?hashes=[…]`.

    Un appel par lot de hashes, pas un par image. L'URL rendue est
    « temporary » : elle sert au téléchargement de ce passage et ne s'écrit
    jamais en base. Un hash que Meta ne rend pas reste sans URL, il sera
    redemandé au passage suivant.
    """
    urls: dict[str, str] = {}
    for i in range(0, len(hashes), _HASHES_PAR_APPEL):
        lot = hashes[i:i + _HASHES_PAR_APPEL]
        try:
            rep = requests.get(f"{_GRAPH}/{ad_account_id}/adimages", params={
                "access_token": token, "hashes": json.dumps(lot), "fields": "hash,url",
            }, timeout=60).json()
        except Exception:
            continue
        for image in (rep.get("data") or []) if isinstance(rep, dict) else []:
            if image.get("hash") and image.get("url"):
                urls[str(image["hash"])] = str(image["url"])
    return urls


# Public, comme `post-images` d'Instagram : décision de David au ticket 05
# (2026-10-05). Ces visuels sont déjà diffusés publiquement par Meta ; le prix
# accepté est qu'une annonce en pause ou jamais diffusée devient lisible par
# qui connaît son URL (`<user_id>/<image_hash>`, pas devinable).
BUCKET_CREAS = "ad-creatives"


def chemin_image(user_id: str, image_hash: str) -> str:
    """Un fichier par hash : la même image n'est jamais téléversée deux fois."""
    return f"{user_id}/{image_hash}"


def televerser_image(supabase_client, user_id: str, image_hash: str, url: str) -> str | None:
    """Télécharge l'image chez Meta et la range sous `chemin_image`.

    Rend l'URL publique du bucket, ou None si un des deux trajets échoue —
    jamais l'URL de Meta en repli, contrairement au patron Instagram
    (`_upload_image_to_storage`) : une URL qui expire dans `image_url` est un
    visuel qui disparaîtra sans prévenir.
    """
    try:
        r = requests.get(url, timeout=20)
        if r.status_code != 200 or not r.content:
            return None
        chemin = chemin_image(user_id, image_hash)
        bucket = supabase_client.storage.from_(BUCKET_CREAS)
        bucket.upload(path=chemin, file=r.content, file_options={
            "content-type": r.headers.get("content-type") or "image/jpeg",
            "upsert": "true"})
        return bucket.get_public_url(chemin)
    except Exception:
        return None
