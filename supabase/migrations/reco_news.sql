-- ============================================================================
-- LA FILE « RECOS NEWS » — TASK-026 (Graphe A, compte entier)
-- (copie autonome de la section 14sexies de 000_run_me_all.sql — exécuter
--  l'un OU l'autre, jamais les deux dans la même session ; 000_run_me_all.sql
--  est le fichier à jouer en priorité, voir CLAUDE.md §2 — ni l'un ni l'autre
--  n'est appliqué en prod tant que David ne l'a pas rejoué lui-même)
--
-- POURQUOI CE FICHIER EXISTE
-- Le classificateur du Graphe A (`saas/worker/build_report.py`, voir
-- `CLASSIFIER_CATEGORIES_IA`) fait déclarer à la candidate IA libre du compte
-- (`ai_reco`) à quelle catégorie de `saas/core/reco_engine.py` elle
-- correspond — parmi 7 valeurs fermées, ou explicitement "aucune". Quand
-- aucune catégorie ne correspond, la piste ne doit JAMAIS retomber dans un
-- fourre-tout générique « autre » (c'est exactement le défaut que TASK-021
-- avait déjà corrigé côté recos par thème, en faisant déclarer la catégorie
-- plutôt que la deviner après coup) : elle part ici, dans une file
-- consultable.
--
-- CE QUE CETTE TABLE N'EST PAS : un pipeline de décision. Décision explicite
-- de David (TASK-026) — personne ne sait aujourd'hui définir « assez de fois
-- pour devenir une catégorie » ni sur quelle population, et le volume de
-- comptes est trop faible pour que ce soit utile. Cette table n'a donc ni
-- statut, ni compteur, ni promotion automatique : c'est un endroit à
-- consulter à la main (Supabase Studio), pour que David décide un jour, lui-
-- même, si un motif répété mérite une 11e catégorie codée en dur dans
-- `reco_engine.py`. Aucune page Pulse dédiée dans cette tâche (David,
-- TASK-026) — un chantier séparé si besoin plus tard.
--
-- Une ligne par utilisateur et par semaine (`reco_news_uq`) : un rapport
-- régénéré la même semaine (« ↻ Recharger mes conseils ») REMPLACE la ligne
-- (upsert côté worker), il n'empile jamais de doublons.
--
-- Idempotent : rejouable sans risque. Aucun DROP de table, aucun DELETE.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.reco_news (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_start  date NOT NULL DEFAULT current_date,
    title       text NOT NULL,
    observation text NOT NULL,
    pourquoi    text NOT NULL,
    verifier    text NOT NULL,
    angle_mort  text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT reco_news_uq UNIQUE (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_reco_news_user
    ON public.reco_news (user_id, week_start DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────
-- Même patron que sur toutes les tables de Pulse : « chacun ses lignes »
-- d'abord (elle vaut même sans le partage d'équipe), le partage ensuite.
ALTER TABLE public.reco_news ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reco_news_select_own" ON public.reco_news;
DROP POLICY IF EXISTS "reco_news_insert_own" ON public.reco_news;
DROP POLICY IF EXISTS "reco_news_update_own" ON public.reco_news;
DROP POLICY IF EXISTS "reco_news_delete_own" ON public.reco_news;
CREATE POLICY "reco_news_select_own" ON public.reco_news
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "reco_news_insert_own" ON public.reco_news
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reco_news_update_own" ON public.reco_news
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reco_news_delete_own" ON public.reco_news
    FOR DELETE USING (auth.uid() = user_id);

-- Le worker écrit avec la clé de service (`SUPABASE_SERVICE_KEY`), qui
-- contourne RLS de toute façon — ces politiques protègent la lecture/écriture
-- depuis le web, pas le worker.

-- Partage d'équipe — seulement si la section 12 (a_acces/peut_editer) est
-- passée. Sans ce garde, ce fichier joué seul sur une base sans ces fonctions
-- s'arrêterait ici et laisserait la table sans ses politiques « chacun ses
-- lignes » déjà posées au-dessus.
DO $$
BEGIN
    IF to_regprocedure('public.a_acces(uuid)') IS NULL
       OR to_regprocedure('public.peut_editer(uuid)') IS NULL THEN
        RAISE WARNING
            'a_acces() / peut_editer() absentes : reco_news reste privée au propriétaire. Joue 000_run_me_all.sql pour ouvrir le partage.';
        RETURN;
    END IF;

    DROP POLICY IF EXISTS "partage_select" ON public.reco_news;
    DROP POLICY IF EXISTS "partage_insert" ON public.reco_news;
    DROP POLICY IF EXISTS "partage_update" ON public.reco_news;
    DROP POLICY IF EXISTS "partage_delete" ON public.reco_news;

    CREATE POLICY "partage_select" ON public.reco_news
        FOR SELECT USING (public.a_acces(user_id));
    CREATE POLICY "partage_insert" ON public.reco_news
        FOR INSERT WITH CHECK (public.peut_editer(user_id));
    CREATE POLICY "partage_update" ON public.reco_news
        FOR UPDATE USING (public.peut_editer(user_id)) WITH CHECK (public.peut_editer(user_id));
    CREATE POLICY "partage_delete" ON public.reco_news
        FOR DELETE USING (public.peut_editer(user_id));
END $$;
