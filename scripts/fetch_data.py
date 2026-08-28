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


# ── Tab Coût — labels & budgets ────────────────────────────────────────────────

def fetch_labels(supabase: Client, user_id: str) -> list[str]:
    """Liste maîtresse UNIQUE des labels (profiles.labels) — partagée Meta/Google/Instagram.

    Fallback : si profiles.labels n'existe pas encore (migration non passée) ou est
    vide, on reconstruit la liste à partir des anciennes colonnes campaign_labels +
    google_campaign_labels → la page Labels n'est jamais vide à tort. L'écriture
    (create/delete) continue d'exiger la colonne labels (donc la migration).
    """
    try:
        res = supabase.table("profiles").select("labels").eq("id", user_id).execute()
        if res.data and res.data[0].get("labels"):
            return list(res.data[0]["labels"])
    except Exception:
        pass
    # Fallback lecture seule : union des anciennes listes.
    try:
        res = (
            supabase.table("profiles")
            .select("campaign_labels, google_campaign_labels")
            .eq("id", user_id)
            .execute()
        )
        if res.data:
            row = res.data[0]
            union = (row.get("campaign_labels") or []) + (row.get("google_campaign_labels") or [])
            return sorted({str(l).strip() for l in union if str(l).strip()})
    except Exception:
        pass
    return []


def fetch_campaign_labels(supabase: Client, user_id: str) -> list[str]:
    """Compat — pointe désormais sur la liste unifiée profiles.labels."""
    return fetch_labels(supabase, user_id)


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


def fetch_campaign_config(supabase: Client, user_id: str) -> dict[str, dict]:
    """Retourne {campaign_name: {"label", "label_source", "budget_max", "effective_status"}}."""
    try:
        # "*" : tolérant au schéma (label_source peut ne pas exister avant migration)
        res = (
            supabase.table("meta_campaign_config")
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )
        return {
            row["campaign_name"]: {
                "label": row.get("label"),
                "label_source": row.get("label_source"),
                "budget_max": float(row.get("budget_max") or 0),
                "effective_status": row.get("effective_status"),
            }
            for row in (res.data or [])
        }
    except Exception:
        return {}


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
    """
    try:
        return (
            supabase.table("google_ads_ad_insights")
            .select("*")
            .eq("user_id", user_id)
            .order("date_start", desc=True)
            .execute()
            .data
        ) or []
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


def fetch_google_campaign_labels(supabase: Client, user_id: str) -> list[str]:
    """Compat — pointe désormais sur la liste unifiée profiles.labels."""
    return fetch_labels(supabase, user_id)


def fetch_google_budget_global(supabase: Client, user_id: str) -> float:
    try:
        res = supabase.table("profiles").select("google_budget_global").eq("id", user_id).execute()
        if res.data:
            return float(res.data[0].get("google_budget_global") or 0)
    except Exception:
        pass
    return 0.0


def fetch_google_campaign_config(supabase: Client, user_id: str) -> dict[str, dict]:
    """Retourne {campaign_id: {"campaign_name", "label", "label_source", "budget_max", "effective_status"}}."""
    try:
        # "*" : tolérant au schéma (label_source peut ne pas exister avant migration)
        res = (
            supabase.table("google_campaign_config")
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )
        return {
            str(row["campaign_id"]): {
                "campaign_name": row.get("campaign_name") or "",
                "label": row.get("label"),
                "label_source": row.get("label_source"),
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


def fetch_theme_objectifs(supabase: Client, user_id: str) -> dict[str, str]:
    """L'objectif propre d'un thème, quand il diffère de celui du compte.

    Returns: {label: 'ventes'|'notoriete'|'engagement'}. {} si la table est
    absente (migration `theme_objectifs.sql` pas passée) ou si rien n'a été
    choisi — l'appelant retombe alors sur `fetch_objectif` (l'objectif du
    compte), exactement comme avant cette fonctionnalité.
    """
    try:
        res = (
            supabase.table("theme_objectifs")
            .select("label, objectif")
            .eq("user_id", user_id)
            .execute()
        )
        rows = res.data or []
    except Exception:
        return {}
    out: dict[str, str] = {}
    for r in rows:
        lbl = (r.get("label") or "").strip()
        obj = r.get("objectif")
        if lbl and obj:
            out[lbl] = obj
    return out


def fetch_reco_feedback(supabase: Client, user_id: str, recent_weeks: int = 4) -> dict[str, str]:
    """Dernière réaction connue par type de conseil, sur les `recent_weeks` semaines.
    Returns: {reco_key: "useful"|"not_for_me"|"done"} (la plus récente par key).
    """
    from datetime import date, timedelta
    cutoff = (date.today() - timedelta(weeks=recent_weeks)).isoformat()
    out: dict[str, str] = {}
    try:
        res = (
            supabase.table("reco_feedback")
            .select("reco_key, reaction, week_start")
            .eq("user_id", user_id)
            .gte("week_start", cutoff)
            .order("week_start", desc=True)
            .execute()
        )
        for row in (res.data or []):
            key = row.get("reco_key")
            if key and key not in out:  # 1re vue = la plus récente (tri desc)
                out[key] = row.get("reaction")
    except Exception:
        pass
    return out


def fetch_reco_theme_context(supabase: Client, user_id: str, recent_weeks: int = 4) -> list[dict] | None:
    """Feedback contextualisé par thème (migration `reco_feedback_contexte.sql`
    — colonnes `theme`/`title`, NOT NULL DEFAULT '' pour `theme`). Sert deux
    besoins distincts du Graphe B (`build_report.py`) :
      - museler `not_for_me` par (reco_key, thème) plutôt que par reco_key
        seul sur tout le compte (voir `build_recos`, `saas/core/reco_engine.py`) ;
      - donner à `_theme_ai_recos` le TEXTE des pistes IA récemment écartées
        ou appliquées sur SON thème — les clés `ai_<theme>_<i>` sont
        positionnelles (l'ordre de Gemini change d'une semaine à l'autre),
        seul ce texte survit d'une semaine à l'autre.
    Returns: [{reco_key, theme, title, reaction, week_start}] du plus récent
    au plus ancien, filtré aux lignes qui portent un thème réel (`theme <> ''`
    — `''` est le sentinel « pas de thème », voir la migration).

    `None` (PAS `[]`) SI LA REQUÊTE ÉCHOUE — distinction volontaire (rejet du
    checker, 2e passe) : `[]` doit vouloir dire « interrogé avec succès, rien
    à raconter » (aucun museau à appliquer, c'est correct et attendu tant que
    personne n'a encore cliqué). Une exception (migration pas encore jouée,
    colonne absente) veut dire autre chose : « je ne sais pas », et NE DOIT
    PAS être lu comme « rien n'a jamais été refusé » — sinon `not_for_me`
    perdrait tout effet sur les cartes de thème tant que la migration n'est
    pas jouée (régression relevée par le checker, 2e passe). L'appelant
    (`build_payload`) retombe sur l'ancien museau compte-entier quand ce
    signal vaut `None`.
    """
    from datetime import date, timedelta
    cutoff = (date.today() - timedelta(weeks=recent_weeks)).isoformat()
    try:
        res = (
            supabase.table("reco_feedback")
            .select("reco_key, theme, title, reaction, week_start")
            .eq("user_id", user_id)
            .gte("week_start", cutoff)
            .neq("theme", "")
            .order("week_start", desc=True)
            .execute()
        )
        return res.data or []
    except Exception:
        return None


def fetch_reco_verdicts(supabase: Client, user_id: str, recent_weeks: int = 4) -> dict[str, str]:
    """Le dernier verdict PERSISTÉ (migration `suivi_actions_verdict.sql`) par
    reco_key, sur les `recent_weeks` semaines — écrit une seule fois par
    `build_report.py`, au moment où la boucle de mesure calcule le verdict
    d'une action `done`/`auto`. Alimente la repondération du feedback `done`
    dans `build_recos` (`saas/core/reco_engine.py`) : un verdict qui confirme
    l'effet dépriorise fortement, un verdict qui le contredit ne dépriorise
    pas, et tant qu'aucun verdict n'est encore tombé (colonne NULL, ou
    migration pas encore passée) la clé est simplement absente d'ici —
    repondération neutre par défaut.

    LE FILTRE PORTE SUR `check_at`, PAS `decided_at` (rejet du checker, 2e
    passe) : le verdict n'est calculé/écrit qu'à `today >= check_at`, et
    `check_at` est RECALCULÉ à `done_at + 14j` au clic « ✓ C'est fait »
    (`saas/web/app/actions.ts::resolveAction`) — `done_at` est postérieur à
    `decided_at` (le jour de « ▶ Je le teste »), parfois de bien plus de 14
    jours. Filtrer sur `decided_at` rendait donc le verdict illisible dès que
    le délai entre les deux clics dépassait `recent_weeks` : `check_at` est la
    SEULE date qui dit fidèlement quand le verdict est réellement tombé.
    Returns: {reco_key: "better"|"worse"|"stable"} (le plus récent par clé).
    """
    from datetime import date, timedelta
    cutoff = (date.today() - timedelta(weeks=recent_weeks)).isoformat()
    out: dict[str, str] = {}
    try:
        res = (
            supabase.table("suivi_actions")
            .select("reco_key, verdict, check_at")
            .eq("user_id", user_id)
            .gte("check_at", cutoff)
            .not_.is_("verdict", "null")
            .order("check_at", desc=True)
            .execute()
        )
        for row in (res.data or []):
            key = row.get("reco_key")
            if key and key not in out:
                out[key] = row.get("verdict")
    except Exception:
        pass
    return out


def fetch_reco_decisions(supabase: Client, user_id: str, recent_weeks: int = 5) -> list[dict]:
    """Décisions « Fait » datées — alimente la boucle de la preuve du rapport
    (le rapport suivant mesure l'effet de chaque décision sur son KPI).
    Returns: [{reco_key, week_start}] du plus récent au plus ancien (1 par key).
    """
    from datetime import date, timedelta
    cutoff = (date.today() - timedelta(weeks=recent_weeks)).isoformat()
    out, seen = [], set()
    try:
        res = (
            supabase.table("reco_feedback")
            .select("reco_key, reaction, week_start")
            .eq("user_id", user_id)
            .eq("reaction", "done")
            .gte("week_start", cutoff)
            .order("week_start", desc=True)
            .execute()
        )
        for row in (res.data or []):
            key = row.get("reco_key")
            if key and key not in seen:
                seen.add(key)
                out.append({"reco_key": key, "week_start": str(row.get("week_start"))[:10]})
    except Exception:
        pass
    return out


def fetch_insight_feedback(supabase: Client, user_id: str) -> dict[str, str]:
    """Validation des constats de la vision globale — permanente (pas de fenêtre).
    Returns: {insight_key: "agree"|"reject"} — un constat rejeté reste écarté
    même quand le worker le régénère à l'identique.
    """
    try:
        res = (
            supabase.table("insight_feedback")
            .select("insight_key, verdict")
            .eq("user_id", user_id)
            .execute()
        )
        return {r["insight_key"]: r["verdict"]
                for r in (res.data or []) if r.get("insight_key") and r.get("verdict")}
    except Exception:
        return {}


def fetch_reco_comments(supabase: Client, user_id: str, limit: int = 60) -> list[dict]:
    """Commentaires libres laissés sur les conseils (les plus récents d'abord).

    Alimente le persona utilisateur ([[comment-profil-user-ia]]) et le pré-remplissage
    du champ commentaire. Returns: [{reco_key, comment, reaction, week_start, created_at}]
    """
    try:
        res = (
            supabase.table("reco_feedback")
            .select("reco_key, comment, reaction, week_start, created_at")
            .eq("user_id", user_id)
            .not_.is_("comment", "null")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return [r for r in (res.data or []) if (r.get("comment") or "").strip()]
    except Exception:
        return []


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
