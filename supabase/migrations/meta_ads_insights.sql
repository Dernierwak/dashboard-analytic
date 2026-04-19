-- ============================================================
-- Table : meta_ads_insights
-- Stocke les données Meta Ads (niveau ad, granularité journalière)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.meta_ads_insights (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date_start   date NOT NULL,
    campaign_name text NOT NULL DEFAULT '',
    adset_name   text NOT NULL DEFAULT '',
    ad_name      text NOT NULL DEFAULT '',
    impressions  integer NOT NULL DEFAULT 0,
    clicks       integer NOT NULL DEFAULT 0,
    reach        integer,
    link_clicks  integer,
    spend        numeric(10, 4) NOT NULL DEFAULT 0,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),

    -- Une ligne par pub par jour par utilisateur
    CONSTRAINT meta_ads_insights_uq UNIQUE (user_id, date_start, ad_name)
);

-- Index pour accélérer les requêtes par user + date
CREATE INDEX IF NOT EXISTS idx_meta_ads_insights_user_date
    ON public.meta_ads_insights (user_id, date_start DESC);

-- Trigger pour updated_at automatique
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meta_ads_insights_updated_at ON public.meta_ads_insights;
CREATE TRIGGER trg_meta_ads_insights_updated_at
    BEFORE UPDATE ON public.meta_ads_insights
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE public.meta_ads_insights ENABLE ROW LEVEL SECURITY;

-- SELECT : l'utilisateur ne voit que ses propres données
CREATE POLICY "meta_ads_select_own"
    ON public.meta_ads_insights
    FOR SELECT
    USING (auth.uid() = user_id);

-- INSERT : l'utilisateur ne peut insérer que pour lui-même
CREATE POLICY "meta_ads_insert_own"
    ON public.meta_ads_insights
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- UPDATE : l'utilisateur ne peut modifier que ses propres données
CREATE POLICY "meta_ads_update_own"
    ON public.meta_ads_insights
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- DELETE : l'utilisateur peut supprimer ses propres données
CREATE POLICY "meta_ads_delete_own"
    ON public.meta_ads_insights
    FOR DELETE
    USING (auth.uid() = user_id);
