-- ============================================================
-- Tables Google Ads
-- google_ads_insights   : 1 ligne par campagne × date (mirror meta_ads_insights)
-- google_campaign_config: 1 ligne par campagne (label + budget_max + statut)
-- ============================================================

-- ── Table insights (granularité campagne × jour) ──────────────
CREATE TABLE IF NOT EXISTS public.google_ads_insights (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date_start      date NOT NULL,
    campaign_id     text NOT NULL,
    campaign_name   text NOT NULL DEFAULT '',
    impressions     integer NOT NULL DEFAULT 0,
    clicks          integer NOT NULL DEFAULT 0,
    conversions     numeric(12, 2) NOT NULL DEFAULT 0,
    cost_micros     bigint NOT NULL DEFAULT 0,  -- Google renvoie en micros (1 CHF = 1_000_000 micros)
    ctr             numeric(8, 4) NOT NULL DEFAULT 0,
    avg_cpc_micros  bigint NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT google_ads_insights_uq UNIQUE (user_id, date_start, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_google_ads_insights_user_date
    ON public.google_ads_insights (user_id, date_start DESC);

-- Trigger updated_at (réutilise public.set_updated_at déjà créée)
DROP TRIGGER IF EXISTS trg_google_ads_insights_updated_at ON public.google_ads_insights;
CREATE TRIGGER trg_google_ads_insights_updated_at
    BEFORE UPDATE ON public.google_ads_insights
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.google_ads_insights ENABLE ROW LEVEL SECURITY;

-- Les DROP ci-dessous rendent ce fichier rejouable. Sans eux, un second passage
-- s'arrêtait sur « policy already exists » — et comme l'éditeur SQL de Supabase
-- joue le fichier d'un bloc, google_campaign_config et les colonnes ajoutées à
-- profiles en fin de fichier n'étaient jamais posées.
DROP POLICY IF EXISTS "google_ads_select_own" ON public.google_ads_insights;
DROP POLICY IF EXISTS "google_ads_insert_own" ON public.google_ads_insights;
DROP POLICY IF EXISTS "google_ads_update_own" ON public.google_ads_insights;
DROP POLICY IF EXISTS "google_ads_delete_own" ON public.google_ads_insights;

CREATE POLICY "google_ads_select_own" ON public.google_ads_insights
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "google_ads_insert_own" ON public.google_ads_insights
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "google_ads_update_own" ON public.google_ads_insights
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "google_ads_delete_own" ON public.google_ads_insights
    FOR DELETE USING (auth.uid() = user_id);

-- ── Table config (label + budget par campagne, mirror meta_campaign_config) ────
CREATE TABLE IF NOT EXISTS public.google_campaign_config (
    user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    campaign_id      text NOT NULL,
    campaign_name    text NOT NULL DEFAULT '',
    label            text,
    budget_max       numeric(12, 2) NOT NULL DEFAULT 0,
    effective_status text,
    updated_at       timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_google_campaign_config_user
    ON public.google_campaign_config (user_id);

DROP TRIGGER IF EXISTS trg_google_campaign_config_updated_at ON public.google_campaign_config;
CREATE TRIGGER trg_google_campaign_config_updated_at
    BEFORE UPDATE ON public.google_campaign_config
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.google_campaign_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "google_campaign_config_select_own" ON public.google_campaign_config;
DROP POLICY IF EXISTS "google_campaign_config_insert_own" ON public.google_campaign_config;
DROP POLICY IF EXISTS "google_campaign_config_update_own" ON public.google_campaign_config;
DROP POLICY IF EXISTS "google_campaign_config_delete_own" ON public.google_campaign_config;

CREATE POLICY "google_campaign_config_select_own" ON public.google_campaign_config
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "google_campaign_config_insert_own" ON public.google_campaign_config
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "google_campaign_config_update_own" ON public.google_campaign_config
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "google_campaign_config_delete_own" ON public.google_campaign_config
    FOR DELETE USING (auth.uid() = user_id);

-- ── Colonnes user-level (parallèle à profiles.campaign_labels Meta) ──
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS google_campaign_labels text[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS google_budget_global numeric(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS google_refresh_token text DEFAULT NULL,  -- refresh_token OAuth Google (long-lived)
    ADD COLUMN IF NOT EXISTS google_customer_id text DEFAULT NULL;     -- ID du compte Google Ads sélectionné
