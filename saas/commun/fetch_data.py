from supabase import Client
from datetime import date, timedelta


def fetch_post_metrics(supabase: Client, user_id: str):
    return supabase.table("instagram_organic_posts").select("*").eq("user_id", user_id).execute().data


def fetch_daily_followers(supabase: Client, user_id: str):
    return supabase.table("followers_history").select("*").eq("user_id", user_id).order("fetched_at").execute().data


def fetch_meta_ads_latest_date(supabase: Client, user_id: str) -> str | None:
    """Retourne la date la plus récente dans meta_ads_insights pour cet user."""
    result = (
        supabase.table("meta_ads_insights")
        .select("date_start")
        .eq("user_id", user_id)
        .order("date_start", desc=True)
        .limit(1)
        .execute()
    )
    if result.data:
        return result.data[0]["date_start"]
    return None


def _all_pages(make_query, page: int = 1000) -> list[dict]:
    """Contourne le plafond PostgREST (1000 lignes/requête) en paginant.
    make_query() doit retourner un query builder FRAIS à chaque appel."""
    rows: list[dict] = []
    start = 0
    while True:
        chunk = make_query().range(start, start + page - 1).execute().data or []
        rows.extend(chunk)
        if len(chunk) < page:
            return rows
        start += page


def fetch_meta_ads(supabase: Client, user_id: str, months: int | None = None) -> list[dict]:
    """Récupère les données Meta Ads pour un utilisateur.
    Si months est fourni, filtre depuis les X derniers mois. Sinon, tout l'historique.
    Le dashboard a son propre filtre période côté UI — donc on récupère tout par défaut.
    Paginé : sans ça, Supabase tronque silencieusement à 1000 lignes.
    """
    def q():
        query = supabase.table("meta_ads_insights").select("*").eq("user_id", user_id)
        if months is not None:
            since = (date.today() - timedelta(days=30 * months)).isoformat()
            query = query.gte("date_start", since)
        return query.order("date_start", desc=True)
    return _all_pages(q)


# ── Tab Coût — budgets ─────────────────────────────────────────────────────────

def fetch_channel_budgets(supabase: Client, user_id: str) -> list[dict]:
    """Budgets mensuels par canal : [{channel, month: 'YYYY-MM-DD', amount}].
    [] si la table n'existe pas encore (migration non passée) → l'UI retombe
    sur les anciens budgets globaux profiles.
    """
    try:
        return (
            supabase.table("channel_budgets")
            .select("channel, month, amount")
            .eq("user_id", user_id)
            .order("month", desc=False)
            .execute()
            .data
        ) or []
    except Exception:
        return []


def budget_for_month(budgets: list[dict], channel: str, month_iso: str) -> float:
    """Budget d'un canal pour un mois donné, avec CARRY-FORWARD :
    si le mois n'a pas de ligne, on reporte le dernier budget connu ≤ ce mois.
    → on ne ressaisit le budget QUE quand il change.
    """
    best = None
    for b in budgets:
        if b.get("channel") != channel:
            continue
        m = str(b.get("month", ""))[:10]
        if m <= month_iso and (best is None or m > best[0]):
            best = (m, float(b.get("amount") or 0))
    return best[1] if best else 0.0


def fetch_meta_budget_global(supabase: Client, user_id: str) -> float:
    """Budget global Meta Ads (stocké dans profiles.meta_budget_global)."""
    try:
        res = supabase.table("profiles").select("meta_budget_global").eq("id", user_id).execute()
        if res.data:
            return float(res.data[0].get("meta_budget_global") or 0)
    except Exception:
        pass
    return 0.0


# ── Google Ads ────────────────────────────────────────────────────────────────

def fetch_google_ads(supabase: Client, user_id: str) -> list[dict]:
    """Récupère tous les insights Google Ads pour un user (sans filtre date — le filtre
    se fait côté UI). Paginé : sans ça, Supabase tronque silencieusement à 1000 lignes."""
    return _all_pages(
        lambda: supabase.table("google_ads_insights")
        .select("*")
        .eq("user_id", user_id)
        .order("date_start", desc=True)
    )


def fetch_google_ads_ad_insights(supabase: Client, user_id: str) -> list[dict]:
    """Détail annonce × jour (drill-down Campagne → Groupe d'annonces → Annonce).
    [] si la table n'existe pas encore (migration non passée) → l'UI dégrade proprement.

    PAGINÉ DEPUIS QUE LE RAPPORT LA LIT. Un seul `.execute()` s'arrête au
    plafond PostgREST de 1 000 lignes, et il s'y arrête EN SILENCE : un compte à
    40 annonces perd tout ce qui précède les 25 derniers jours, et les règles
    qui comparaient des Annonces auraient comparé un échantillon tronqué sans
    que rien ne le dise (`CLAUDE.md` §8).
    """
    try:
        return _all_pages(
            lambda: supabase.table("google_ads_ad_insights")
            .select("*")
            .eq("user_id", user_id)
            .order("date_start", desc=True)
        )
    except Exception:
        return []


def fetch_google_ads_latest_date(supabase: Client, user_id: str) -> str | None:
    res = (
        supabase.table("google_ads_insights")
        .select("date_start")
        .eq("user_id", user_id)
        .order("date_start", desc=True)
        .limit(1)
        .execute()
    )
    return res.data[0]["date_start"] if res.data else None


def fetch_google_ads_ad_insights_latest_date(supabase: Client, user_id: str) -> str | None:
    """Même rôle que `fetch_google_ads_latest_date`, sur la table du détail par
    annonce (`google_ads_ad_insights`) : son point de reprise se déduit d'elle
    seule, pas de la table campagne — les deux récoltes ne sont pas à la même
    profondeur tant que l'une des deux n'a jamais tourné."""
    res = (
        supabase.table("google_ads_ad_insights")
        .select("date_start")
        .eq("user_id", user_id)
        .order("date_start", desc=True)
        .limit(1)
        .execute()
    )
    return res.data[0]["date_start"] if res.data else None


def fetch_google_budget_global(supabase: Client, user_id: str) -> float:
    try:
        res = supabase.table("profiles").select("google_budget_global").eq("id", user_id).execute()
        if res.data:
            return float(res.data[0].get("google_budget_global") or 0)
    except Exception:
        pass
    return 0.0


def fetch_google_campaign_config(supabase: Client, user_id: str) -> dict[str, dict]:
    """Retourne {campaign_id: {"campaign_name", "budget_max", "effective_status"}}."""
    try:
        res = (
            supabase.table("google_campaign_config")
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )
        return {
            str(row["campaign_id"]): {
                "campaign_name": row.get("campaign_name") or "",
                "budget_max": float(row.get("budget_max") or 0),
                "effective_status": row.get("effective_status"),
            }
            for row in (res.data or [])
        }
    except Exception:
        return {}


def fetch_google_refresh_token(supabase: Client, user_id: str) -> tuple[str | None, str | None]:
    """Retourne (refresh_token, customer_id) ou (None, None).

    Le token Google (Ads + GA4) vit dans connected_accounts (provider='google').
    Fallback lecture sur les anciennes colonnes profiles si la migration n'est
    pas encore passée — sinon Google paraît « déconnecté » à tort.
    """
    try:
        res = (
            supabase.table("connected_accounts")
            .select("google_refresh_token, google_customer_id")
            .eq("user_id", user_id)
            .eq("provider", "google")
            .limit(1)
            .execute()
        )
        if res.data and res.data[0].get("google_refresh_token"):
            return res.data[0].get("google_refresh_token"), res.data[0].get("google_customer_id")
    except Exception:
        pass
    # Pré-migration : anciennes colonnes profiles (supprimées par la migration →
    # cette requête échoue alors silencieusement, c'est voulu).
    try:
        res = supabase.table("profiles").select("google_refresh_token, google_customer_id").eq("id", user_id).execute()
        if res.data:
            return res.data[0].get("google_refresh_token"), res.data[0].get("google_customer_id")
    except Exception:
        pass
    return None, None


# ── Google Analytics 4 (GA4) ──────────────────────────────────────────────────

def fetch_ga4_property_id(supabase: Client, user_id: str) -> str | None:
    """Retourne le GA4 Property ID connecté (ex. 'properties/123456789') ou None.

    Stocké sur la ligne connected_accounts provider='google' (Ads + GA4 = même token).
    """
    try:
        res = (
            supabase.table("connected_accounts")
            .select("ga4_property_id")
            .eq("user_id", user_id)
            .eq("provider", "google")
            .limit(1)
            .execute()
        )
        if res.data and res.data[0].get("ga4_property_id"):
            return res.data[0].get("ga4_property_id")
    except Exception:
        pass
    # Pré-migration : ancienne colonne profiles (supprimée ensuite → silencieux)
    try:
        res = supabase.table("profiles").select("ga4_property_id").eq("id", user_id).execute()
        if res.data:
            return res.data[0].get("ga4_property_id")
    except Exception:
        pass
    return None


def fetch_ga4_events(supabase: Client, user_id: str) -> list[dict]:
    """Funnel GA4 par événement (view_item → purchase). [] si table absente.
    Paginé : sans ça, PostgREST coupe à 1000 lignes et tout ce qui dépasse
    quelques jours devient invisible (le compte a des dizaines de milliers de
    lignes GA4)."""
    try:
        return _all_pages(
            lambda: supabase.table("ga4_events")
            .select("date, source, medium, campaign, event_name, event_count, event_value")
            .eq("user_id", user_id)
            .order("date", desc=True)
        ) or []
    except Exception:
        return []


def fetch_ga4_insights(supabase: Client, user_id: str) -> list[dict]:
    """Tous les insights GA4 d'un user (filtre date côté appelant).
    Paginé pour la même raison que fetch_ga4_events : au-delà de 1000 lignes,
    une fenêtre un peu ancienne se retrouvait silencieusement tronquée."""
    try:
        return _all_pages(
            lambda: supabase.table("ga4_insights")
            .select("*")
            .eq("user_id", user_id)
            .order("date", desc=True)
        )
    except Exception:
        return []


def fetch_ga4_latest_date(supabase: Client, user_id: str) -> str | None:
    try:
        res = (
            supabase.table("ga4_insights")
            .select("date")
            .eq("user_id", user_id)
            .order("date", desc=True)
            .limit(1)
            .execute()
        )
        return res.data[0]["date"] if res.data else None
    except Exception:
        return None


# ── Boucle de feedback (rapport hebdo) ────────────────────────────────────────

def fetch_last_data_date(supabase: Client, user_id: str) -> str | None:
    """Date des données les plus récentes (toutes sources), format 'YYYY-MM-DD'.
    Sert à afficher la fraîcheur des données et à caler la fenêtre de comparaison.
    """
    dates: list[str] = []
    for table, col in [
        ("meta_ads_insights", "date_start"),
        ("instagram_organic_posts", "date"),
        ("daily_followers", "fetched_at"),
        ("google_ads_insights", "date_start"),
        ("ga4_insights", "date"),
    ]:
        try:
            res = (
                supabase.table(table).select(col)
                .eq("user_id", user_id).order(col, desc=True).limit(1).execute()
            )
            if res.data and res.data[0].get(col):
                dates.append(str(res.data[0][col])[:10])
        except Exception:
            pass
    return max(dates) if dates else None


def fetch_objectif(supabase: Client, user_id: str) -> str | None:
    """Objectif principal du compte ('ventes'|'notoriete'|'engagement') ou None."""
    try:
        res = supabase.table("profiles").select("objectif").eq("id", user_id).execute()
        if res.data:
            return res.data[0].get("objectif")
    except Exception:
        pass
    return None


def fetch_onboarding_profile(supabase: Client, user_id: str) -> dict[str, str | None]:
    """Les 4 réponses de l'onboarding express (secteur, budget, temps,
    frustration), saisies une fois à l'inscription et jamais redérivées.

    PLUS PERSONNE NE LES LIT depuis que le profil client vivant est parti avec
    les recommandations (2026-09-21). La lecture reste parce que les réponses,
    elles, sont toujours écrites par l'onboarding."""
    try:
        res = (
            supabase.table("profiles")
            .select("business_type, budget_range, time_budget, frustration")
            .eq("id", user_id)
            .execute()
        )
        if res.data:
            return res.data[0]
    except Exception:
        pass
    return {}


# `fetch_reco_decisions` A ÉTÉ RETIRÉE LE 2026-09-13.
#
# Elle n'alimentait que la « boucle de la preuve » de `build_report.py` — un
# second moteur de verdict qui remesurait sur le compte entier ce que le rail
# mesure sur le thème, et dont la sortie (`payload.preuve`) n'était lue par
# aucun écran. Le moteur est mort avec elle : voir la pierre tombale dans
# `saas/traitement/build_report.py`, et
# `.scratch/construction/issues/12-le-carnet-et-la-mort-de-preuve.md`.
#
# Le bilan au niveau du compte est désormais un COMPTAGE de
# `suivi_actions.verdict`, fait à la lecture côté web : aucune mesure nouvelle,
# donc rien à récolter ici.


def fetch_user_profile(supabase: Client, user_id: str) -> tuple[str | None, str | None]:
    """Persona utilisateur dérivé par l'IA. Returns: (user_profile, updated_at_iso)."""
    try:
        res = (
            supabase.table("profiles")
            .select("user_profile, user_profile_updated_at")
            .eq("id", user_id)
            .execute()
        )
        if res.data:
            row = res.data[0]
            return row.get("user_profile"), row.get("user_profile_updated_at")
    except Exception:
        pass
    return None, None


# ── Le canal qui n'a rien écrit alors qu'il aurait dû ─────────────────────────
#
# CE QUI DISTINGUE UN TROU D'UN ZÉRO, et pourquoi ça ne se déduit pas des
# lignes. Trois états se ressemblent dans `meta_ads_insights` et se traitent à
# l'opposé (`.scratch/construction/issues/20-rapport-publie-sur-un-canal-muet.md`) :
#
#   ① jamais connecté      — le canal n'existe pas pour ce compte. Aucun trou,
#                            aucune mention : il n'y a rien à manquer.
#   ② connecté, ÉCHEC      — jeton expiré, 500, limite de débit, schéma en
#                            retard. La dépense de la semaine MANQUE.
#   ③ connecté, 0 ligne    — aucune campagne active. C'est un zéro MESURÉ, et
#                            il doit continuer à s'afficher comme un zéro.
#
# ② et ③ rendent exactement le même nombre de lignes. Le signal ne peut donc
# JAMAIS être « il y a peu de lignes » — c'est « une écriture a été tentée et
# elle a échoué », ce que seul le worker sait et ce que `fetch_progress` range
# déjà (`saas/collecte/automatisation/suivi.py`, état `echec`).
#
# ON NE LIT QUE LE PASSAGE LE PLUS RÉCENT. `run_id` est un horodatage ISO en
# UTC écrit tel quel : le max lexicographique est le passage le plus récent, et
# c'est la règle que l'écran de récolte applique déjà. Sans ce filtre, un échec
# d'il y a trois semaines tairait éternellement la dépense d'un canal réparé
# depuis.
#
# 'saute' N'EST PAS 'echec', et la nuance porte tout le ①. Un canal sauté n'a
# pas été appelé (aucune connexion, aucune propriété GA4 choisie) ; un canal en
# échec a été appelé et a refusé. Seul le second creuse un trou.
def fetch_canaux_muets(supabase: Client, user_id: str) -> dict[str, str]:
    """Les canaux dont la récolte a ÉCHOUÉ au dernier passage → {canal: mot}.

    Rend `{}` dès que la table est absente ou illisible : un suivi qu'on ne
    sait pas lire ne doit pas faire taire un rapport entier — il rendrait muet
    tout le monde le jour où la migration `fetch_progress.sql` n'est pas jouée.
    Le risque est asymétrique et assumé dans ce sens-là.
    """
    try:
        rows = (supabase.table("fetch_progress")
                .select("canal, run_id, etat, mot_de_fin")
                .eq("user_id", user_id)
                .execute().data) or []
    except Exception:
        return {}
    if not rows:
        return {}
    dernier = max(str(r.get("run_id") or "") for r in rows)
    return {r["canal"]: (r.get("mot_de_fin") or f"{r['canal']} : échec de récolte")
            for r in rows
            if str(r.get("run_id") or "") == dernier and r.get("etat") == "echec"}


# L'ENVOI D'EMAIL LE PLUS RÉCENT (ticket 50). Une ligne par (utilisateur,
# semaine) ; on ne relit jamais que la dernière — les précédentes ont déjà été
# relevées au passage d'avant, et ce qu'on cherche à savoir, c'est ce qu'est
# devenu le dernier message parti.
def fetch_dernier_envoi_email(supabase: Client, user_id: str) -> dict | None:
    """Le dernier email hebdo envoyé à ce compte, ou None.

    Rend `None` dès que la table est absente ou illisible, exactement comme
    `fetch_canaux_muets` : un suivi d'exploitation qu'on ne sait pas lire ne
    doit pas faire tomber une récolte. Le pire qu'on y perde est une ligne de
    journal.
    """
    try:
        rows = (supabase.table("email_envois")
                .select("week_start, fournisseur, message_id, envoi_ok, "
                        "envoye_a, dernier_evenement, releve_a")
                .eq("user_id", user_id)
                .order("week_start", desc=True)
                .limit(1)
                .execute().data) or []
    except Exception:
        return None
    return rows[0] if rows else None
