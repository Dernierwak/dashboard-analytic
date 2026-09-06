-- ============================================================================
-- L'HYPOTHÈSE ACTIVE D'UN THÈME (Graphe B)
-- (copie autonome de la section 14septies de 000_run_me_all.sql — exécuter
--  l'un OU l'autre, jamais les deux dans la même session ; 000_run_me_all.sql
--  est le fichier à jouer en priorité, voir CLAUDE.md §2)
--
-- POURQUOI CE FICHIER EXISTE
-- `_theme_ai_recos()` (`saas/traitement/build_report.py`) rédige, à chaque
-- génération de rapport, exactement une piste `role="hypothese"` par thème.
-- Sans mémoire de ce qui a déjà été proposé, une nouvelle hypothèse pouvait
-- naître chaque semaine, sans jamais attendre le verdict de la précédente —
-- « suivre une théorie » restait une façade (wayfinder
-- `.scratch/recos-labels/issues/03-suivi-hypothese.md`).
--
-- Cette table porte l'état COURANT (pas l'historique) : depuis quand
-- l'hypothèse active tourne, quel levier, et sa carte complète (`snapshot`,
-- jsonb — title/observation/pourquoi/verifier/angle_mort/etc.) pour la
-- réafficher fidèlement (même `reco_key`, donc mêmes retours client) tant que
-- la fenêtre d'attente n'est pas écoulée (`ATTENTE_MIN_NOUVELLE_HYPOTHESE`,
-- différenciée par levier : 14 jours pour contenu/tempo, 21 pour
-- argent/audience).
--
-- Une ligne par (user_id, theme) : une nouvelle hypothèse REMPLACE la ligne
-- du thème plutôt que d'empiler un historique.
--
-- Idempotent : rejouable sans risque. Aucun DROP de table, aucun DELETE.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.theme_plan (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    theme       text NOT NULL,
    reco_key    text,
    levier      text,
    decided_at  date,
    snapshot    jsonb,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT theme_plan_uq UNIQUE (user_id, theme)
);

CREATE INDEX IF NOT EXISTS idx_theme_plan_user
    ON public.theme_plan (user_id, theme);

DROP TRIGGER IF EXISTS trg_theme_plan_updated_at ON public.theme_plan;
CREATE TRIGGER trg_theme_plan_updated_at
    BEFORE UPDATE ON public.theme_plan
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.theme_plan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "theme_plan_select_own" ON public.theme_plan;
DROP POLICY IF EXISTS "theme_plan_insert_own" ON public.theme_plan;
DROP POLICY IF EXISTS "theme_plan_update_own" ON public.theme_plan;
DROP POLICY IF EXISTS "theme_plan_delete_own" ON public.theme_plan;
CREATE POLICY "theme_plan_select_own" ON public.theme_plan
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "theme_plan_insert_own" ON public.theme_plan
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "theme_plan_update_own" ON public.theme_plan
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "theme_plan_delete_own" ON public.theme_plan
    FOR DELETE USING (auth.uid() = user_id);

-- Le worker écrit avec la clé de service (`SUPABASE_SERVICE_KEY`), qui
-- contourne RLS de toute façon — ces politiques protègent la lecture/écriture
-- depuis le web, pas le worker.

-- Partage d'équipe — seulement si la section 12 (a_acces/peut_editer) est
-- passée.
DO $$
BEGIN
    IF to_regprocedure('public.a_acces(uuid)') IS NULL
       OR to_regprocedure('public.peut_editer(uuid)') IS NULL THEN
        RAISE WARNING
            'a_acces() / peut_editer() absentes : theme_plan reste privée au propriétaire. Joue 000_run_me_all.sql pour ouvrir le partage.';
        RETURN;
    END IF;

    DROP POLICY IF EXISTS "partage_select" ON public.theme_plan;
    DROP POLICY IF EXISTS "partage_insert" ON public.theme_plan;
    DROP POLICY IF EXISTS "partage_update" ON public.theme_plan;
    DROP POLICY IF EXISTS "partage_delete" ON public.theme_plan;

    CREATE POLICY "partage_select" ON public.theme_plan
        FOR SELECT USING (public.a_acces(user_id));
    CREATE POLICY "partage_insert" ON public.theme_plan
        FOR INSERT WITH CHECK (public.peut_editer(user_id));
    CREATE POLICY "partage_update" ON public.theme_plan
        FOR UPDATE USING (public.peut_editer(user_id)) WITH CHECK (public.peut_editer(user_id));
    CREATE POLICY "partage_delete" ON public.theme_plan
        FOR DELETE USING (public.peut_editer(user_id));
END $$;
