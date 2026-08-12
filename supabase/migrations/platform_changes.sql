-- ============================================================================
-- platform_changes — ce que les plateformes DÉCLARENT avoir changé.
--
-- Le fil de Pulse sait déjà DÉDUIRE cinq faits de la dépense quotidienne
-- (lancée, arrêtée, reprise, programmée, dépense changée). C'est robuste, et
-- c'est aveugle : mettre un mot-clé en pause, remonter un CPC cible ou changer
-- une audience ne fait pas forcément bouger la dépense du jour. Ces gestes-là
-- n'apparaissaient donc nulle part, et une courbe qui bouge restait sans
-- explication.
--
-- Les deux plateformes tiennent pourtant ce journal :
--   · Google Ads → la ressource `change_event` — 30 DERNIERS JOURS seulement,
--     filtre de date obligatoire, 10 000 lignes maximum ;
--   · Meta       → `GET /act_<id>/activities`.
--
-- La fenêtre de Google est le fait dur de cette table : au-delà de trente
-- jours, l'information n'existe plus nulle part. Ce qui n'a pas été récolté à
-- temps est perdu — d'où le stockage, et d'où `change_id`, un hachage stable de
-- (canal, horodatage, ressource, champ) qui rend chaque récolte idempotente :
-- deux passages sur la même semaine ne créent pas deux lignes.
--
-- `resume` est DÉJÀ RÉDIGÉ EN FRANÇAIS à la récolte. Rien n'est inséré qu'on ne
-- sache nommer : un fil rempli de « change_event AD_GROUP_AD updated » ne vaut
-- rien, et il vaut moins que rien puisqu'il chasse les lignes utiles.
--
-- Idempotent : ré-exécutable sans erreur.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.platform_changes (
    user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    channel       text NOT NULL CHECK (channel IN ('meta', 'google')),
    change_id     text NOT NULL,          -- hachage stable (canal, horodatage, ressource, champ)
    occurred_at   timestamptz NOT NULL,
    categorie     text NOT NULL CHECK (categorie IN
                      ('budget', 'motcle', 'enchere', 'statut', 'audience', 'creatif', 'autre')),
    campaign_id   text,
    campaign_name text,
    resume        text NOT NULL,          -- déjà rédigé en français
    PRIMARY KEY (user_id, channel, change_id)
);

-- Le fil lit toujours « les changements depuis telle date, du plus récent au
-- plus ancien » — c'est exactement ce que cet index sert.
CREATE INDEX IF NOT EXISTS idx_platform_changes_user_date
    ON public.platform_changes (user_id, occurred_at DESC);

ALTER TABLE public.platform_changes ENABLE ROW LEVEL SECURITY;

-- Même règle que platform_budgets : on teste la présence des fonctions de
-- partage plutôt que de la supposer, pour que cette migration puisse tourner
-- sur une base où equipe_partage.sql n'a pas encore été lancé.
DO $$
DECLARE
    partage boolean := to_regprocedure('public.a_acces(uuid)') IS NOT NULL
                   AND to_regprocedure('public.peut_editer(uuid)') IS NOT NULL;
BEGIN
    DROP POLICY IF EXISTS "partage_select" ON public.platform_changes;
    DROP POLICY IF EXISTS "partage_insert" ON public.platform_changes;
    DROP POLICY IF EXISTS "partage_update" ON public.platform_changes;
    DROP POLICY IF EXISTS "partage_delete" ON public.platform_changes;

    IF partage THEN
        CREATE POLICY "partage_select" ON public.platform_changes
            FOR SELECT USING (public.a_acces(user_id));
        CREATE POLICY "partage_insert" ON public.platform_changes
            FOR INSERT WITH CHECK (public.peut_editer(user_id));
        CREATE POLICY "partage_update" ON public.platform_changes
            FOR UPDATE USING (public.peut_editer(user_id))
            WITH CHECK (public.peut_editer(user_id));
        CREATE POLICY "partage_delete" ON public.platform_changes
            FOR DELETE USING (public.peut_editer(user_id));
    ELSE
        CREATE POLICY "partage_select" ON public.platform_changes
            FOR SELECT USING (auth.uid() = user_id);
        CREATE POLICY "partage_insert" ON public.platform_changes
            FOR INSERT WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "partage_update" ON public.platform_changes
            FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "partage_delete" ON public.platform_changes
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;
