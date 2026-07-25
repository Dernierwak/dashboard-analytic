-- ============================================================================
-- Suivi des recommandations — « ▶ Je le teste » puis verdict 2 semaines après.
-- (copie autonome de la section 9 de 000_run_me_all.sql — exécuter l'un OU l'autre)
--
-- Quand l'utilisateur décide de tester un conseil, on PHOTOGRAPHIE la décision :
-- le titre du conseil, son thème, l'indicateur-cible et sa valeur de départ, la
-- date de décision et la date de re-vérification (+14 j). Le rapport remesure
-- ensuite l'indicateur et affiche le verdict (marché / stable / raté).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.suivi_actions (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reco_key    text NOT NULL,           -- clé du conseil au moment de la décision
    title       text NOT NULL,           -- snapshot du titre (le conseil peut changer)
    theme       text,                    -- thème (label) concerné, si applicable
    metric      text,                    -- indicateur-cible : cpc|roas|eng|reach|posts|purchases (null si non mesurable auto)
    metric_label text,                   -- libellé lisible de l'indicateur
    direction   text,                    -- 'up' (mieux si monte) | 'down' (mieux si baisse)
    baseline    numeric(14, 4),          -- valeur de l'indicateur au moment de la décision
    decided_at  date NOT NULL DEFAULT current_date,
    check_at    date NOT NULL,           -- decided_at + 14 j
    status      text NOT NULL DEFAULT 'running',  -- 'running' | 'archived'
    created_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT suivi_actions_uq UNIQUE (user_id, reco_key, decided_at)
);

CREATE INDEX IF NOT EXISTS idx_suivi_actions_user
    ON public.suivi_actions (user_id, check_at);

ALTER TABLE public.suivi_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suivi_actions_select_own" ON public.suivi_actions;
DROP POLICY IF EXISTS "suivi_actions_insert_own" ON public.suivi_actions;
DROP POLICY IF EXISTS "suivi_actions_update_own" ON public.suivi_actions;
DROP POLICY IF EXISTS "suivi_actions_delete_own" ON public.suivi_actions;
CREATE POLICY "suivi_actions_select_own" ON public.suivi_actions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "suivi_actions_insert_own" ON public.suivi_actions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "suivi_actions_update_own" ON public.suivi_actions
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "suivi_actions_delete_own" ON public.suivi_actions
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 10) Suivi des recommandations, suite : la colonne done_at.
--     Un conseil passe par trois etats :
--       'running'  = a faire (tu as clique sur "Je le teste") -> en haut du rapport
--       'done'     = fait le done_at -> on observe 14 jours a partir de CE jour
--       'archived' = verdict vu, range dans l'historique
--     Le compteur des deux semaines part donc du jour ou l'action est reellement
--     appliquee, pas du jour ou elle a ete decidee.
-- ============================================================================

ALTER TABLE public.suivi_actions ADD COLUMN IF NOT EXISTS done_at date;

CREATE INDEX IF NOT EXISTS idx_suivi_actions_status
    ON public.suivi_actions (user_id, status, check_at);
