-- ============================================================================
-- Vision globale + labellisation IA
-- (copie autonome de la section 8 de 000_run_me_all.sql — exécuter l'un OU l'autre)
--
-- • label_source ('user'/'ai') sur les 3 tables d'assignation de thèmes :
--   l'IA ne labellise que les items sans label_source='user' et ne réécrit
--   jamais un choix humain. Les sélecteurs manuels de Pulse posent 'user'.
-- • insight_feedback : validation « ✓ Ça me parle » / « ✗ Pas d'accord » des
--   constats de la vision globale (payload.vision). Clé stable par constat →
--   un rejet survit aux recalculs hebdo du worker.
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
