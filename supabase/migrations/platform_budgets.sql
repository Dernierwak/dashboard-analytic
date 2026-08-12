-- ============================================================================
-- platform_budgets — le budget PLANIFIÉ, tel qu'il est posé dans les campagnes.
--
-- Pulse ne connaissait que le budget DÉPENSÉ (meta_ads_insights /
-- google_ads_insights). Ce qui a été PROMIS n'existait nulle part : un compte
-- qui règle 200 CHF/jour et n'en consomme que 60 se lisait comme un compte à
-- 60 CHF/jour, sans qu'on puisse dire s'il sous-dépense ou s'il est à sa cible.
--
-- POURQUOI UNE SUITE DE PHOTOS, ET PAS UN HISTORIQUE.
-- Aucune des deux plateformes ne sait dire ce que valait un budget il y a trois
-- mois : `campaign_budget.amount_micros` et `daily_budget` renvoient la valeur
-- COURANTE, un point c'est tout. On ne peut donc rien reconstituer en arrière.
-- Chaque récolte écrit une ligne par campagne datée du jour du relevé, et tout
-- ce qui précède le premier relevé restera à jamais inconnu. C'est aussi ce que
-- `lib/budgets.ts` dit à l'écran (`vide`, `releveLe`) plutôt que d'afficher un
-- zéro, qui se lirait « rien de prévu ».
--
-- daily_budget et total_budget sont EXCLUSIFS : une campagne porte soit un
-- budget par jour, soit une enveloppe pour toute sa durée. Les deux remplis
-- voudrait dire deux promesses concurrentes, et le prorata ne saurait pas
-- laquelle appliquer.
--
-- Montants en CHF (la conversion micros → CHF côté Google et centimes → CHF
-- côté Meta est faite à la récolte, jamais ici).
--
-- Idempotent : ré-exécutable sans erreur.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.platform_budgets (
    user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    channel       text NOT NULL CHECK (channel IN ('meta', 'google')),
    campaign_id   text NOT NULL,
    campaign_name text,
    captured_on   date NOT NULL,          -- le jour du relevé, pas le jour du budget
    daily_budget  numeric,                -- CHF/jour   (exclusif avec total_budget)
    total_budget  numeric,                -- CHF pour toute la durée
    start_date    date,
    end_date      date,                   -- NULL = déclarée sans date de fin
    status        text,
    PRIMARY KEY (user_id, channel, campaign_id, captured_on)
);

-- La lecture se fait toujours « le relevé le plus récent qui précède telle
-- date » : c'est exactement ce que cet index sert.
CREATE INDEX IF NOT EXISTS idx_platform_budgets_user_date
    ON public.platform_budgets (user_id, captured_on DESC);

ALTER TABLE public.platform_budgets ENABLE ROW LEVEL SECURITY;

-- Le partage d'équipe passe par a_acces() / peut_editer() (equipe_partage.sql).
-- On teste leur présence plutôt que de la supposer : cette migration doit
-- pouvoir tourner sur une base où le partage n'a pas encore été installé, et
-- dans ce cas elle retombe sur la règle « chacun ses lignes ».
DO $$
DECLARE
    partage boolean := to_regprocedure('public.a_acces(uuid)') IS NOT NULL
                   AND to_regprocedure('public.peut_editer(uuid)') IS NOT NULL;
BEGIN
    DROP POLICY IF EXISTS "partage_select" ON public.platform_budgets;
    DROP POLICY IF EXISTS "partage_insert" ON public.platform_budgets;
    DROP POLICY IF EXISTS "partage_update" ON public.platform_budgets;
    DROP POLICY IF EXISTS "partage_delete" ON public.platform_budgets;

    IF partage THEN
        CREATE POLICY "partage_select" ON public.platform_budgets
            FOR SELECT USING (public.a_acces(user_id));
        CREATE POLICY "partage_insert" ON public.platform_budgets
            FOR INSERT WITH CHECK (public.peut_editer(user_id));
        CREATE POLICY "partage_update" ON public.platform_budgets
            FOR UPDATE USING (public.peut_editer(user_id))
            WITH CHECK (public.peut_editer(user_id));
        CREATE POLICY "partage_delete" ON public.platform_budgets
            FOR DELETE USING (public.peut_editer(user_id));
    ELSE
        CREATE POLICY "partage_select" ON public.platform_budgets
            FOR SELECT USING (auth.uid() = user_id);
        CREATE POLICY "partage_insert" ON public.platform_budgets
            FOR INSERT WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "partage_update" ON public.platform_budgets
            FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "partage_delete" ON public.platform_budgets
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;
