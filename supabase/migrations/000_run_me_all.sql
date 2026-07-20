-- ============================================================================
-- 000_run_me_all.sql  —  À EXÉCUTER UNE FOIS dans Supabase → SQL editor.
--
-- Regroupe TOUTES les migrations en attente (Labels unifiés, GA4, feedback)
-- + la consolidation de tous les tokens dans connected_accounts.
-- Entièrement idempotent : ré-exécutable sans erreur.
--
-- Après exécution :
--   • profiles.labels existe + est rempli  → la page Labels n'est plus vide
--   • ga4_insights + reco_feedback existent → GA4 et le feedback marchent
--   • tous les tokens Google (Ads + GA4) vivent dans connected_accounts
--     (provider='google'), plus dans profiles
-- ============================================================================

-- Fonction trigger updated_at (réutilisée par plusieurs tables) ---------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- 1) LABELS UNIFIÉS  →  profiles.labels (liste maîtresse Meta+Google+Insta)
-- ============================================================================

-- On garantit la présence des anciennes listes pour un backfill sûr
-- (no-op si elles existent déjà).
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS campaign_labels        text[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS google_campaign_labels text[] DEFAULT '{}';

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS labels text[] NOT NULL DEFAULT '{}';

-- Backfill UNE FOIS : union dédupliquée des anciennes listes (sans vides).
-- Guard `labels = '{}'` → ne réécrase pas ce que l'utilisateur ajoutera ensuite.
UPDATE public.profiles p
SET labels = sub.arr
FROM (
    SELECT id, ARRAY(
        SELECT DISTINCT x
        FROM unnest(
            coalesce(campaign_labels,        '{}'::text[]) ||
            coalesce(google_campaign_labels, '{}'::text[])
        ) AS x
        WHERE x IS NOT NULL AND btrim(x) <> ''
    ) AS arr
    FROM public.profiles
) sub
WHERE p.id = sub.id
  AND (p.labels IS NULL OR p.labels = '{}');


-- ============================================================================
-- 2) GA4  →  table ga4_insights  (1 ligne par date × source/medium)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ga4_insights (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date         date NOT NULL,
    source       text NOT NULL DEFAULT '',
    medium       text NOT NULL DEFAULT '',
    sessions     integer NOT NULL DEFAULT 0,
    conversions  numeric(12, 2) NOT NULL DEFAULT 0,
    revenue      numeric(14, 2) NOT NULL DEFAULT 0,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ga4_insights_uq UNIQUE (user_id, date, source, medium)
);

CREATE INDEX IF NOT EXISTS idx_ga4_insights_user_date
    ON public.ga4_insights (user_id, date DESC);

DROP TRIGGER IF EXISTS trg_ga4_insights_updated_at ON public.ga4_insights;
CREATE TRIGGER trg_ga4_insights_updated_at
    BEFORE UPDATE ON public.ga4_insights
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ga4_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ga4_select_own" ON public.ga4_insights;
DROP POLICY IF EXISTS "ga4_insert_own" ON public.ga4_insights;
DROP POLICY IF EXISTS "ga4_update_own" ON public.ga4_insights;
DROP POLICY IF EXISTS "ga4_delete_own" ON public.ga4_insights;
CREATE POLICY "ga4_select_own" ON public.ga4_insights
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ga4_insert_own" ON public.ga4_insights
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ga4_update_own" ON public.ga4_insights
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ga4_delete_own" ON public.ga4_insights
    FOR DELETE USING (auth.uid() = user_id);


-- ── GA4 v2 : campagne UTM + funnel par événement (voir ga4_events.sql) ───────
ALTER TABLE public.ga4_insights
    ADD COLUMN IF NOT EXISTS campaign text NOT NULL DEFAULT '';
ALTER TABLE public.ga4_insights DROP CONSTRAINT IF EXISTS ga4_insights_uq;
ALTER TABLE public.ga4_insights DROP CONSTRAINT IF EXISTS ga4_insights_uq2;
ALTER TABLE public.ga4_insights
    ADD CONSTRAINT ga4_insights_uq2 UNIQUE (user_id, date, source, medium, campaign);

CREATE TABLE IF NOT EXISTS public.ga4_events (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date         date NOT NULL,
    source       text NOT NULL DEFAULT '',
    medium       text NOT NULL DEFAULT '',
    campaign     text NOT NULL DEFAULT '',
    event_name   text NOT NULL,
    event_count  integer NOT NULL DEFAULT 0,
    event_value  numeric(14, 2) NOT NULL DEFAULT 0,
    created_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ga4_events_uq UNIQUE (user_id, date, source, medium, campaign, event_name)
);
CREATE INDEX IF NOT EXISTS idx_ga4_events_user_date
    ON public.ga4_events (user_id, date DESC);
ALTER TABLE public.ga4_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ga4ev_select_own" ON public.ga4_events;
DROP POLICY IF EXISTS "ga4ev_insert_own" ON public.ga4_events;
DROP POLICY IF EXISTS "ga4ev_update_own" ON public.ga4_events;
DROP POLICY IF EXISTS "ga4ev_delete_own" ON public.ga4_events;
CREATE POLICY "ga4ev_select_own" ON public.ga4_events
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ga4ev_insert_own" ON public.ga4_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ga4ev_update_own" ON public.ga4_events
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ga4ev_delete_own" ON public.ga4_events
    FOR DELETE USING (auth.uid() = user_id);


-- ============================================================================
-- 3) FEEDBACK  →  table reco_feedback + profiles.objectif
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.reco_feedback (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reco_key    text NOT NULL,
    reaction    text NOT NULL,
    week_start  date NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT reco_feedback_uq UNIQUE (user_id, reco_key, week_start)
);

CREATE INDEX IF NOT EXISTS idx_reco_feedback_user
    ON public.reco_feedback (user_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_reco_feedback_updated_at ON public.reco_feedback;
CREATE TRIGGER trg_reco_feedback_updated_at
    BEFORE UPDATE ON public.reco_feedback
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.reco_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reco_feedback_select_own" ON public.reco_feedback;
DROP POLICY IF EXISTS "reco_feedback_insert_own" ON public.reco_feedback;
DROP POLICY IF EXISTS "reco_feedback_update_own" ON public.reco_feedback;
DROP POLICY IF EXISTS "reco_feedback_delete_own" ON public.reco_feedback;
CREATE POLICY "reco_feedback_select_own" ON public.reco_feedback
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "reco_feedback_insert_own" ON public.reco_feedback
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reco_feedback_update_own" ON public.reco_feedback
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reco_feedback_delete_own" ON public.reco_feedback
    FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS objectif text DEFAULT NULL;

-- Commentaire libre attaché à un conseil (peut exister sans réaction) +
-- persona utilisateur dérivé par l'IA (profiles.user_profile). Voir
-- supabase/migrations/user_profile.sql pour le détail.
ALTER TABLE public.reco_feedback
    ADD COLUMN IF NOT EXISTS comment text;
ALTER TABLE public.reco_feedback
    ALTER COLUMN reaction DROP NOT NULL;
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS user_profile            text,
    ADD COLUMN IF NOT EXISTS user_profile_updated_at timestamptz;

-- fetch_schedule : jour par défaut (lundi) + backfill des NULL, sinon le profil
-- n'est jamais fetché par le cron. Voir supabase/migrations/fetch_schedule_default.sql
ALTER TABLE public.profiles
    ALTER COLUMN fetch_schedule SET DEFAULT 'Monday';
UPDATE public.profiles
    SET fetch_schedule = 'Monday'
    WHERE fetch_schedule IS NULL;


-- ============================================================================
-- 3bis) GOOGLE ADS — détail par annonce × jour (drill-down Campagne → Groupe
--       d'annonces → Annonce, mirror Meta). Voir google_ads_ad_insights.sql.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.google_ads_ad_insights (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date_start     date NOT NULL,
    campaign_id    text NOT NULL,
    campaign_name  text NOT NULL DEFAULT '',
    ad_group_id    text NOT NULL,
    ad_group_name  text NOT NULL DEFAULT '',
    ad_id          text NOT NULL,
    ad_name        text NOT NULL DEFAULT '',
    impressions    integer NOT NULL DEFAULT 0,
    clicks         integer NOT NULL DEFAULT 0,
    cost_micros    bigint  NOT NULL DEFAULT 0,
    conversions    numeric(12, 2) NOT NULL DEFAULT 0,
    created_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT google_ads_ad_insights_uq UNIQUE (user_id, date_start, ad_id)
);

CREATE INDEX IF NOT EXISTS idx_gads_ad_insights_user_date
    ON public.google_ads_ad_insights (user_id, date_start DESC);

ALTER TABLE public.google_ads_ad_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gads_ad_select_own" ON public.google_ads_ad_insights;
DROP POLICY IF EXISTS "gads_ad_insert_own" ON public.google_ads_ad_insights;
DROP POLICY IF EXISTS "gads_ad_update_own" ON public.google_ads_ad_insights;
DROP POLICY IF EXISTS "gads_ad_delete_own" ON public.google_ads_ad_insights;
CREATE POLICY "gads_ad_select_own" ON public.google_ads_ad_insights
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "gads_ad_insert_own" ON public.google_ads_ad_insights
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gads_ad_update_own" ON public.google_ads_ad_insights
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gads_ad_delete_own" ON public.google_ads_ad_insights
    FOR DELETE USING (auth.uid() = user_id);


-- ============================================================================
-- 3ter) BUDGETS PAR MOIS — voir channel_budgets.sql (source de vérité).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.channel_budgets (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    channel     text NOT NULL,
    month       date NOT NULL,
    amount      numeric(12, 2) NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT channel_budgets_uq UNIQUE (user_id, channel, month)
);
CREATE INDEX IF NOT EXISTS idx_channel_budgets_user
    ON public.channel_budgets (user_id, month DESC);
DROP TRIGGER IF EXISTS trg_channel_budgets_updated_at ON public.channel_budgets;
CREATE TRIGGER trg_channel_budgets_updated_at
    BEFORE UPDATE ON public.channel_budgets
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.channel_budgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chbud_select_own" ON public.channel_budgets;
DROP POLICY IF EXISTS "chbud_insert_own" ON public.channel_budgets;
DROP POLICY IF EXISTS "chbud_update_own" ON public.channel_budgets;
DROP POLICY IF EXISTS "chbud_delete_own" ON public.channel_budgets;
CREATE POLICY "chbud_select_own" ON public.channel_budgets
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "chbud_insert_own" ON public.channel_budgets
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "chbud_update_own" ON public.channel_budgets
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "chbud_delete_own" ON public.channel_budgets
    FOR DELETE USING (auth.uid() = user_id);

INSERT INTO public.channel_budgets (user_id, channel, month, amount)
SELECT id, 'meta', date_trunc('month', now())::date, meta_budget_global
FROM public.profiles WHERE coalesce(meta_budget_global, 0) > 0
ON CONFLICT (user_id, channel, month) DO NOTHING;
INSERT INTO public.channel_budgets (user_id, channel, month, amount)
SELECT id, 'google', date_trunc('month', now())::date, google_budget_global
FROM public.profiles WHERE coalesce(google_budget_global, 0) > 0
ON CONFLICT (user_id, channel, month) DO NOTHING;


-- ============================================================================
-- 4) TOKENS UNIFIÉS  →  tout dans connected_accounts (provider='google')
--    On déplace google_refresh_token / google_customer_id / ga4_property_id
--    de profiles vers connected_accounts, puis on supprime les colonnes profiles.
-- ============================================================================

-- On garantit la présence des colonnes SOURCE sur profiles (no-op si déjà là)
-- pour que la copie ci-dessous ne casse jamais, même si les migrations GA4/Google
-- n'avaient pas été passées.
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS google_refresh_token text,
    ADD COLUMN IF NOT EXISTS google_customer_id   text,
    ADD COLUMN IF NOT EXISTS ga4_property_id       text;

-- Nouvelles colonnes sur connected_accounts (le seul endroit pour les tokens).
ALTER TABLE public.connected_accounts
    ADD COLUMN IF NOT EXISTS provider             text NOT NULL DEFAULT 'meta',
    ADD COLUMN IF NOT EXISTS google_refresh_token text,
    ADD COLUMN IF NOT EXISTS google_customer_id   text,
    ADD COLUMN IF NOT EXISTS ga4_property_id       text;

-- Une ligne provider='meta' n'a pas de token Google, et une ligne
-- provider='google' n'a pas de meta_token / instagram_business_id : on relâche
-- les NOT NULL éventuels pour que la ligne google soit insérable.
ALTER TABLE public.connected_accounts ALTER COLUMN meta_token            DROP NOT NULL;
ALTER TABLE public.connected_accounts ALTER COLUMN instagram_business_id DROP NOT NULL;

-- Une seule ligne google par utilisateur.
CREATE UNIQUE INDEX IF NOT EXISTS connected_accounts_google_uniq
    ON public.connected_accounts (user_id) WHERE provider = 'google';

-- Copie de l'existant profiles.* -> ligne provider='google'.
INSERT INTO public.connected_accounts
    (user_id, provider, account_name, google_refresh_token, google_customer_id, ga4_property_id)
SELECT id, 'google', 'Google', google_refresh_token, google_customer_id, ga4_property_id
FROM public.profiles
WHERE google_refresh_token IS NOT NULL
ON CONFLICT (user_id) WHERE provider = 'google'
DO UPDATE SET
    google_refresh_token = EXCLUDED.google_refresh_token,
    google_customer_id   = EXCLUDED.google_customer_id,
    ga4_property_id      = EXCLUDED.ga4_property_id;

-- Suppression des anciennes colonnes de profiles (tout est dans connected_accounts).
ALTER TABLE public.profiles
    DROP COLUMN IF EXISTS google_refresh_token,
    DROP COLUMN IF EXISTS google_customer_id,
    DROP COLUMN IF EXISTS ga4_property_id;

-- ============================================================================
-- 6) weekly_reports — rapport hebdo précalculé (payload JSON)
--    Lu par Pulse (Next.js, saas/web) et le futur email hebdo.
--    Écrit par le Streamlit à l'ouverture du rapport, puis par le worker cron.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.weekly_reports (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_start  date NOT NULL,
    payload     jsonb NOT NULL,
    updated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, week_start)
);

ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "weekly_reports_select_own" ON public.weekly_reports;
CREATE POLICY "weekly_reports_select_own" ON public.weekly_reports
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "weekly_reports_insert_own" ON public.weekly_reports;
CREATE POLICY "weekly_reports_insert_own" ON public.weekly_reports
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "weekly_reports_update_own" ON public.weekly_reports;
CREATE POLICY "weekly_reports_update_own" ON public.weekly_reports
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- FIN. Vérifier : SELECT provider, google_customer_id, ga4_property_id
--                 FROM connected_accounts WHERE provider='google';
-- ============================================================================

-- ============================================================================
-- 7) Onboarding express Pulse — profil (business, budget, temps dispo)
-- ============================================================================

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS business_type text,
    ADD COLUMN IF NOT EXISTS budget_range  text,
    ADD COLUMN IF NOT EXISTS time_budget   text,
    ADD COLUMN IF NOT EXISTS frustration   text;

-- ============================================================================
-- 8) Vision globale + labellisation IA — voir vision_labels_ia.sql
--    • label_source ('user'/'ai') : l'IA ne réécrit jamais un label humain
--    • insight_feedback : validation ✓/✗ des constats « Ce qui fonctionne
--      pour toi » — permanente, survit aux recalculs hebdo
-- ============================================================================

ALTER TABLE public.meta_campaign_config
    ADD COLUMN IF NOT EXISTS label_source text;
ALTER TABLE public.google_campaign_config
    ADD COLUMN IF NOT EXISTS label_source text;
ALTER TABLE public.instagram_organic_posts
    ADD COLUMN IF NOT EXISTS label_source text;

-- Backfill UNE FOIS : tout label déjà posé l'a été à la main.
UPDATE public.meta_campaign_config
    SET label_source = 'user'
    WHERE label IS NOT NULL AND btrim(label) <> '' AND label_source IS NULL;
UPDATE public.google_campaign_config
    SET label_source = 'user'
    WHERE label IS NOT NULL AND btrim(label) <> '' AND label_source IS NULL;
UPDATE public.instagram_organic_posts
    SET label_source = 'user'
    WHERE labels IS NOT NULL AND labels <> '{}' AND label_source IS NULL;

CREATE TABLE IF NOT EXISTS public.insight_feedback (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    insight_key text NOT NULL,          -- clé stable, ex. 'theme_best:e-bike'
    verdict     text NOT NULL,          -- 'agree' | 'reject'
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT insight_feedback_uq UNIQUE (user_id, insight_key)
);

CREATE INDEX IF NOT EXISTS idx_insight_feedback_user
    ON public.insight_feedback (user_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_insight_feedback_updated_at ON public.insight_feedback;
CREATE TRIGGER trg_insight_feedback_updated_at
    BEFORE UPDATE ON public.insight_feedback
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.insight_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insight_fb_select_own" ON public.insight_feedback;
DROP POLICY IF EXISTS "insight_fb_insert_own" ON public.insight_feedback;
DROP POLICY IF EXISTS "insight_fb_update_own" ON public.insight_feedback;
DROP POLICY IF EXISTS "insight_fb_delete_own" ON public.insight_feedback;
CREATE POLICY "insight_fb_select_own" ON public.insight_feedback
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insight_fb_insert_own" ON public.insight_feedback
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "insight_fb_update_own" ON public.insight_feedback
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "insight_fb_delete_own" ON public.insight_feedback
    FOR DELETE USING (auth.uid() = user_id);
