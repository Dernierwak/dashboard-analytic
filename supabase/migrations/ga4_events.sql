-- ============================================================
-- GA4 v2 — campagne (UTM) + funnel par événement
--
-- 1) ga4_insights.campaign : dimension sessionCampaignName (utm_campaign)
--    → on relie enfin le revenu GA4 à UNE campagne (Meta ou Google Ads),
--    pas juste à un medium 'cpc'. La contrainte unique inclut la campagne.
--
-- 2) ga4_events : funnel e-commerce par événement × jour × source/medium/campagne
--    (view_item, add_to_cart, begin_checkout, add_payment_info, purchase,
--     generate_lead) → event_count + event_value.
--    Permet les recos « où ça casse » : fiche produit vs panier vs checkout.
--
-- Idempotent : ré-exécutable sans erreur.
-- ============================================================

-- 1) ga4_insights + campaign ---------------------------------------------------
ALTER TABLE public.ga4_insights
    ADD COLUMN IF NOT EXISTS campaign text NOT NULL DEFAULT '';

ALTER TABLE public.ga4_insights DROP CONSTRAINT IF EXISTS ga4_insights_uq;
ALTER TABLE public.ga4_insights DROP CONSTRAINT IF EXISTS ga4_insights_uq2;
ALTER TABLE public.ga4_insights
    ADD CONSTRAINT ga4_insights_uq2 UNIQUE (user_id, date, source, medium, campaign);

-- 2) ga4_events ----------------------------------------------------------------
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
