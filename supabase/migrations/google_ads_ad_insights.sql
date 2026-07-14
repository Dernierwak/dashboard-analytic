-- ============================================================
-- google_ads_ad_insights — détail par ANNONCE × jour (drill-down)
--
-- Mirror du niveau "ad" de Meta : campagne → groupe d'annonces (= adset)
-- → annonce (= ad/asset). Sert UNIQUEMENT au drill-down du tab Google Ads.
-- google_ads_insights (campagne × jour) reste la source de vérité des totaux
-- (les campagnes Performance Max n'exposent pas toutes leurs métriques au
-- niveau annonce → les sommes ad-level peuvent être < totaux campagne).
--
-- Idempotent : ré-exécutable sans erreur.
-- ============================================================

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
