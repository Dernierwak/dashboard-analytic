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


# ── Le regroupement par thème — la vue SQL ────────────────────────────────────

class VueRegroupementAbsente(RuntimeError):
    """La vue `theme_regroupement` n'est pas en base : la migration
    `supabase/migrations/theme_regroupement.sql` n'a pas été jouée.

    ELLE NE SE RATTRAPE PAS PAR UN REPLI. Recalculer les thèmes en Python
    ressusciterait la seconde implémentation que la vue existe pour supprimer —
    et elle dériverait en silence, parce qu'un repli qui marche ne se remarque
    pas. Le rapport ne se publie donc pas : une carte de thème vide se lit comme
    un compte qui n'a rien fait, pas comme une migration qui manque.
    """


def fetch_theme_regroupement(supabase: Client, user_id: str) -> list[dict]:
    """Le total de chaque thème, recalculé en base à la lecture.

    Une ligne par thème : dépense, clics, impressions, CTR, revenu attribué,
    publications, portée et engagement moyens, le drapeau `juge` (assez de
    dépense pour qu'on se prononce) et le `roas` qu'il autorise. Voir
    `supabase/migrations/theme_regroupement.sql` pour la règle exacte.

    LE FILTRE `user_id` N'EST PAS DÉCORATIF. La vue est `security_invoker` :
    elle protège l'appelant qui passe par un jeton d'utilisateur (Pulse), pas
    celui qui passe par la clé de service (le worker), pour qui la RLS ne
    s'applique pas. Sans ce filtre, le worker lirait les thèmes de tous les
    comptes et les attribuerait à un seul.

    PAGINÉE, et l'ordre est posé AVANT la pagination : PostgREST plafonne à
    1 000 lignes et tronque en silence (CLAUDE.md §8), et sans ordre stable deux
    pages successives peuvent répéter ou sauter des lignes. Un compte n'a pas
    mille thèmes aujourd'hui — la pagination coûte trois lignes et évite d'avoir
    à le vérifier.
    """
    try:
        return _all_pages(
            lambda: supabase.table("theme_regroupement")
            .select("*")
            .eq("user_id", user_id)
            .order("label")
        )
    except Exception as e:
        # 42P01 = « undefined_table » côté Postgres ; PGRST205 = « la table est
        # introuvable dans le cache de schéma » côté PostgREST, ce qu'il rend
        # quand la vue vient d'être créée ou n'existe pas. Toute autre panne
        # remonte telle quelle : une coupure réseau n'est pas une migration
        # manquante, et la traiter comme telle enverrait David jouer du SQL
        # pour rien.
        if getattr(e, "code", None) in ("42P01", "PGRST205"):
            raise VueRegroupementAbsente(
                "vue theme_regroupement absente — jouer "
                "supabase/migrations/theme_regroupement.sql (ou "
                "000_run_me_all.sql), puis relancer.") from e
        raise


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

    PAGINÉ DEPUIS QUE LE RAPPORT LA LIT. Un seul `.execute()` s'arrête au
    plafond PostgREST de 1 000 lignes, et il s'y arrête EN SILENCE : un compte à
    40 annonces perd tout ce qui précède les 25 derniers jours, et les règles
    qui comparent des Annonces (`saas/recos_ia/regles_payantes.py`) auraient
    comparé un échantillon tronqué sans que rien ne le dise (`CLAUDE.md` §8).
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


def fetch_platform_budgets(supabase: Client, user_id: str) -> list[dict]:
    """Le budget POSÉ sur chaque campagne, au dernier relevé connu de son canal.

    `platform_budgets` est une suite de PHOTOS hebdomadaires : aucune API ne dit
    ce qu'un budget valait il y a trois semaines, on ne connaît que sa valeur au
    moment du relevé (voir `upsert_platform_budgets`). On rend donc le relevé le
    plus récent, et la date de ce relevé avec — un conseil qui s'appuie dessus
    doit pouvoir dire de quand il parle.

    LE RELEVÉ EST CHOISI PAR CANAL, jamais un seul pour les deux. Même raison
    que `getBudgetPlanifie` (`saas/web/lib/budgets.ts`) : le jour où le jeton
    Google expire, seul Meta est photographié — un relevé commun ferait
    s'effondrer le budget posé, puis doubler la semaine suivante, sans que rien
    n'ait bougé chez le client.

    [] si la table n'existe pas encore : la règle qui la lit se tait, elle
    n'invente pas un budget de zéro.
    """
    lignes: list[dict] = []
    for canal in ("meta", "google"):
        try:
            dernier = (
                supabase.table("platform_budgets")
                .select("captured_on")
                .eq("user_id", user_id)
                .eq("channel", canal)
                .order("captured_on", desc=True)
                .limit(1)
                .execute()
                .data
            ) or []
        except Exception:
            # `continue`, PAS `return []` : une panne sur la requête Google ne
            # doit pas jeter les lignes Meta déjà lues (relevé du repost de la
            # revue de code). Si c'est la table qui manque, les deux canaux
            # échouent de la même façon et la fonction rend `[]` toute seule —
            # `theme_hors_budget` se tait alors, elle n'invente pas un zéro.
            continue
        if not dernier:
            continue
        jour = str(dernier[0].get("captured_on") or "")[:10]
        if not jour:
            continue
        try:
            lignes += _all_pages(
                lambda _c=canal, _j=jour: supabase.table("platform_budgets")
                .select("channel, campaign_id, campaign_name, daily_budget, "
                        "total_budget, start_date, end_date, status, captured_on")
                .eq("user_id", user_id)
                .eq("channel", _c)
                .eq("captured_on", _j)
                # Pagination sans ordre stable = lignes répétées ou sautées :
                # PostgREST ne garantit rien sur l'ordre par défaut.
                .order("campaign_id", desc=False)
            )
        except Exception:
            continue
    return lignes


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


def fetch_onboarding_profile(supabase: Client, user_id: str) -> dict[str, str | None]:
    """Les 4 réponses de l'onboarding express (secteur, budget, temps,
    frustration) — la base fixe du profil client vivant (`user_persona.py`),
    saisie une fois à l'inscription et jamais redérivée."""
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
        seul sur tout le compte (voir `build_recos`, `saas/recos_ia/reco_engine.py`) ;
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


def fetch_theme_plan(supabase: Client, user_id: str) -> dict[str, dict]:
    """L'hypothèse ACTIVE d'un thème (table `theme_plan`) — pas l'historique,
    l'état courant : depuis quand elle tourne, quel levier, et sa carte
    complète (`snapshot`) pour la réafficher fidèlement tant que la fenêtre
    d'attente (`ATTENTE_MIN_NOUVELLE_HYPOTHESE`, `build_report.py`) n'est pas
    écoulée — sans ça, `_theme_ai_recos` proposerait une nouvelle hypothèse
    chaque semaine et « suivre une théorie » resterait une façade (wayfinder
    `.scratch/recos-labels/issues/03-suivi-hypothese.md`).

    Ramène AUSSI la seconde couche du plan, la mémoire narrative du thème
    (`resume`, voir `saas/recos_ia/theme_memoire.py`) : une seule lecture pour
    l'état et la mémoire, celle-ci n'étant déjà faite qu'une fois par rapport.

    Returns: {thème normalisé (minuscules) : {reco_key, levier, decided_at,
    snapshot, resume}}. {} si la table n'est pas encore migrée ou si rien
    n'est suivi.
    """
    # `resume` est arrivé après la table : demander une colonne absente fait
    # échouer la requête ENTIÈRE côté PostgREST, pas seulement la colonne. Sans
    # ce repli, un déploiement du code en avance sur la migration ferait perdre
    # aussi l'ÉTAT — donc le blocage d'une nouvelle hypothèse.
    #
    # LE REPLI NE VAUT QUE POUR UNE COLONNE INCONNUE (42703), pas pour
    # n'importe quel échec : sur un timeout ou un 5xx, retenter sans `resume`
    # peut réussir et publier un rapport SANS mémoire alors que la base en a
    # une — indiscernable d'un thème qui n'en a pas encore. Une vraie panne
    # doit rendre {} comme avant, pas une demi-lecture silencieuse.
    for cols in ("theme, reco_key, levier, decided_at, snapshot, resume",
                 "theme, reco_key, levier, decided_at, snapshot"):
        try:
            res = (
                supabase.table("theme_plan")
                .select(cols)
                .eq("user_id", user_id)
                .execute()
            )
        except Exception as err:
            _msg = str(err).lower()
            if "42703" in _msg or "does not exist" in _msg:
                continue
            return {}
        return {str(r["theme"]).strip().lower(): r for r in (res.data or []) if r.get("theme")}
    return {}


def fetch_reco_verdicts(supabase: Client, user_id: str, recent_weeks: int = 4) -> dict[str, str]:
    """Le dernier verdict PERSISTÉ (migration `suivi_actions_verdict.sql`) par
    reco_key, sur les `recent_weeks` semaines — écrit une seule fois par
    `build_report.py`, au moment où la boucle de mesure calcule le verdict
    d'une action `done`/`auto`. Alimente la repondération du feedback `done`
    dans `build_recos` (`saas/recos_ia/reco_engine.py`) : un verdict qui confirme
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
