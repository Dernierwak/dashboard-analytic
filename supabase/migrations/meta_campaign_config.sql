-- ============================================================
-- Migration : labels campagne + persistance budgets
-- 1. Ajoute campaign_labels et meta_budget_global à profiles
-- 2. Crée la table meta_campaign_config (label + budget_max par campagne)
-- ============================================================

-- ── 1. Extension de profiles ───────────────────────────────────
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS campaign_labels text[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS meta_budget_global numeric(12, 2) NOT NULL DEFAULT 0;

-- ── 2. Table meta_campaign_config ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.meta_campaign_config (
    user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    campaign_name text NOT NULL,
    label         text,
    budget_max    numeric(12, 2) NOT NULL DEFAULT 0,
    updated_at    timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (user_id, campaign_name)
);

-- Index pour les lookups par user
CREATE INDEX IF NOT EXISTS idx_meta_campaign_config_user
    ON public.meta_campaign_config (user_id);

-- Trigger updated_at (réutilise public.set_updated_at déjà créée dans meta_ads_insights.sql)
DROP TRIGGER IF EXISTS trg_meta_campaign_config_updated_at ON public.meta_campaign_config;
CREATE TRIGGER trg_meta_campaign_config_updated_at
    BEFORE UPDATE ON public.meta_campaign_config
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE public.meta_campaign_config ENABLE ROW LEVEL SECURITY;

-- Les quatre DROP ci-dessous rendent ce fichier rejouable. Sans eux, un second
-- passage s'arrêtait sur « policy already exists » — et comme l'éditeur SQL de
-- Supabase joue le fichier d'un bloc, tout ce qui suivait sautait avec.
DROP POLICY IF EXISTS "meta_campaign_config_select_own" ON public.meta_campaign_config;
DROP POLICY IF EXISTS "meta_campaign_config_insert_own" ON public.meta_campaign_config;
DROP POLICY IF EXISTS "meta_campaign_config_update_own" ON public.meta_campaign_config;
DROP POLICY IF EXISTS "meta_campaign_config_delete_own" ON public.meta_campaign_config;

CREATE POLICY "meta_campaign_config_select_own"
    ON public.meta_campaign_config
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "meta_campaign_config_insert_own"
    ON public.meta_campaign_config
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "meta_campaign_config_update_own"
    ON public.meta_campaign_config
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "meta_campaign_config_delete_own"
    ON public.meta_campaign_config
    FOR DELETE
    USING (auth.uid() = user_id);
