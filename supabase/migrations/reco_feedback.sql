-- ============================================================
-- Boucle de feedback du rapport hebdo
-- reco_feedback   : réaction de l'utilisateur sur chaque conseil (👍/👎/✓)
-- profiles.objectif : objectif principal du compte → re-pondère les recos
-- L'IA lit ces signaux pour adapter ses conseils semaine après semaine.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.reco_feedback (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reco_key    text NOT NULL,             -- clé stable du type de conseil (ex. "gaspillage", "creneau", "ai")
    reaction    text NOT NULL,             -- "useful" | "not_for_me" | "done"
    week_start  date NOT NULL,             -- lundi de la semaine du rapport (regroupe les réactions)
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

CREATE POLICY "reco_feedback_select_own" ON public.reco_feedback
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "reco_feedback_insert_own" ON public.reco_feedback
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reco_feedback_update_own" ON public.reco_feedback
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reco_feedback_delete_own" ON public.reco_feedback
    FOR DELETE USING (auth.uid() = user_id);

-- ── Objectif principal du compte (re-pondère les recos) ──
-- Valeurs : 'ventes' | 'notoriete' | 'engagement' | NULL (non défini)
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS objectif text DEFAULT NULL;
