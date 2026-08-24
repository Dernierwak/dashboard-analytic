-- ============================================================================
-- L'OBJECTIF D'UN THÈME
-- (copie autonome de la section 14quater de 000_run_me_all.sql —
--  exécuter l'un OU l'autre, jamais les deux dans la même session)
--
-- POURQUOI CE FICHIER EXISTE
-- `profiles.objectif` fixe UN objectif pour tout le compte (ventes, notoriété,
-- engagement) — il décide de l'indicateur suivi par la courbe d'un thème et de
-- l'ordre de ses conseils. Deux thèmes prioritaires n'ont pourtant pas toujours
-- la même vocation : une campagne de vente et une campagne de notoriété ne se
-- pilotent pas au même indicateur, et forcer les deux sur l'objectif du compte
-- fait suivre un ROAS à un thème qui n'a jamais eu vocation à vendre.
--
-- MÊME PATRON QUE `theme_ga4_events.sql`, ET C'EST VOULU :
--   · le label est stocké par son NOM, comme partout ailleurs dans Pulse —
--     renommer ou supprimer un thème doit donc propager ici aussi (fait dans
--     `renameLabel` / `deleteLabel`, saas/web/app/actions.ts) ;
--   · l'ABSENCE DE LIGNE est le « non choisi », il n'y a pas de troisième
--     état à stocker ; un thème sans ligne hérite SILENCIEUSEMENT de
--     `profiles.objectif` — c'est ce qui rend cette fonctionnalité non
--     bloquante pour les comptes existants.
--
-- UNIQUEMENT LES THÈMES PRIORITAIRES SE VOIENT PROPOSER CE RÉGLAGE (page
-- /labels) — le reste du rapport continue de suivre l'objectif du compte. Rien
-- n'empêche techniquement une ligne sur un thème non étoilé (elle serait
-- simplement lue et appliquée si le thème redevient prioritaire un jour), mais
-- l'UI ne l'écrit que pour les thèmes étoilés.
--
-- Idempotent : rejouable sans risque. Aucun DROP de table, aucun DELETE.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.theme_objectifs (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    label       text NOT NULL,
    objectif    text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT theme_objectifs_uq UNIQUE (user_id, label)
);

-- `ADD CONSTRAINT IF NOT EXISTS` n'existe pas pour un CHECK : on rattrape
-- l'erreur de doublon plutôt que de la deviner. Mêmes trois valeurs que
-- `profiles.objectif` (voir `components/reco_engine.py::OBJECTIFS`).
DO $$
BEGIN
    ALTER TABLE public.theme_objectifs
        ADD CONSTRAINT theme_objectifs_objectif_ck
        CHECK (objectif IN ('ventes', 'notoriete', 'engagement'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_theme_objectifs_user
    ON public.theme_objectifs (user_id, label);

DROP TRIGGER IF EXISTS trg_theme_objectifs_updated_at ON public.theme_objectifs;
CREATE TRIGGER trg_theme_objectifs_updated_at
    BEFORE UPDATE ON public.theme_objectifs
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────
-- Deux jeux de politiques, comme `theme_ga4_events` : « chacun ses lignes »
-- d'abord (elle vaut même sans le partage d'équipe), le partage ensuite.
ALTER TABLE public.theme_objectifs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "to_select_own" ON public.theme_objectifs;
DROP POLICY IF EXISTS "to_insert_own" ON public.theme_objectifs;
DROP POLICY IF EXISTS "to_update_own" ON public.theme_objectifs;
DROP POLICY IF EXISTS "to_delete_own" ON public.theme_objectifs;
CREATE POLICY "to_select_own" ON public.theme_objectifs
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "to_insert_own" ON public.theme_objectifs
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "to_update_own" ON public.theme_objectifs
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "to_delete_own" ON public.theme_objectifs
    FOR DELETE USING (auth.uid() = user_id);

-- Partage d'équipe — seulement si la section 12 est passée. Sans ce garde, ce
-- fichier joué seul sur une base sans `a_acces()` s'arrêterait ici et laisserait
-- la table sans ses politiques « chacun ses lignes » déjà posées au-dessus.
DO $$
BEGIN
    IF to_regprocedure('public.a_acces(uuid)') IS NULL
       OR to_regprocedure('public.peut_editer(uuid)') IS NULL THEN
        RAISE WARNING
            'a_acces() / peut_editer() absentes : theme_objectifs reste privée au propriétaire. Joue 000_run_me_all.sql pour ouvrir le partage.';
        RETURN;
    END IF;

    DROP POLICY IF EXISTS "partage_select" ON public.theme_objectifs;
    DROP POLICY IF EXISTS "partage_insert" ON public.theme_objectifs;
    DROP POLICY IF EXISTS "partage_update" ON public.theme_objectifs;
    DROP POLICY IF EXISTS "partage_delete" ON public.theme_objectifs;

    CREATE POLICY "partage_select" ON public.theme_objectifs
        FOR SELECT USING (public.a_acces(user_id));
    CREATE POLICY "partage_insert" ON public.theme_objectifs
        FOR INSERT WITH CHECK (public.peut_editer(user_id));
    CREATE POLICY "partage_update" ON public.theme_objectifs
        FOR UPDATE USING (public.peut_editer(user_id)) WITH CHECK (public.peut_editer(user_id));
    CREATE POLICY "partage_delete" ON public.theme_objectifs
        FOR DELETE USING (public.peut_editer(user_id));
END $$;
