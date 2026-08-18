-- ============================================================
-- Table Google Analytics 4 (GA4)
-- ga4_insights : 1 ligne par (date × source/medium)
-- Sert à relier la dépense pub (Meta/Google Ads) aux conversions/revenus RÉELS.
-- Réutilise l'OAuth Google déjà en place (profiles.google_refresh_token) :
-- il suffit que le consent inclue le scope analytics.readonly.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ga4_insights (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date            date NOT NULL,
    source          text NOT NULL DEFAULT '',   -- sessionSource (ex. "facebook", "google", "(direct)")
    medium          text NOT NULL DEFAULT '',   -- sessionMedium (ex. "cpc", "organic", "(none)")
    sessions        integer NOT NULL DEFAULT 0,
    conversions     numeric(12, 2) NOT NULL DEFAULT 0,
    revenue         numeric(14, 2) NOT NULL DEFAULT 0,   -- totalRevenue (devise du compte GA4)
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ga4_insights_uq UNIQUE (user_id, date, source, medium)
);

CREATE INDEX IF NOT EXISTS idx_ga4_insights_user_date
    ON public.ga4_insights (user_id, date DESC);

-- Trigger updated_at (réutilise public.set_updated_at déjà créée par les autres migrations)
DROP TRIGGER IF EXISTS trg_ga4_insights_updated_at ON public.ga4_insights;
CREATE TRIGGER trg_ga4_insights_updated_at
    BEFORE UPDATE ON public.ga4_insights
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ga4_insights ENABLE ROW LEVEL SECURITY;

-- Les quatre DROP ci-dessous rendent ce fichier rejouable. Sans eux, un second
-- passage s'arrêtait sur « policy already exists » — et la colonne
-- ga4_property_id ajoutée en fin de fichier n'était jamais posée.
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

-- ── Colonne user-level : le GA4 Property ID sélectionné (ex. "properties/123456789") ──
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS ga4_property_id text DEFAULT NULL;
