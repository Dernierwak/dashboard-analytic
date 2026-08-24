-- ============================================================================
-- LES CATÉGORIES DE CONVERSIONS
-- (copie autonome de la section 14quinquies de 000_run_me_all.sql —
--  exécuter l'un OU l'autre, jamais les deux dans la même session)
--
-- POURQUOI CE FICHIER EXISTE
-- `theme_ga4_events` dit quels événements GA4 comptent pour quel THÈME. Il ne
-- dit rien du GENRE de conversion que l'événement représente — un achat n'est
-- pas une prise de contact, et un compte qui suit dix événements différents
-- n'a aucun moyen de voir « où partent mes conversions » d'un coup d'œil, sur
-- la page /conversions, sans les regrouper d'abord.
--
-- DEUX TABLES, ET UNE SEULE RAISON DE LES SÉPARER :
--   · `conversion_categories` — LA LISTE des catégories que le client a créées
--     (« Ventes », « Contacts », « Engagement »…), gérée comme `profiles.labels`
--     (créer, renommer, supprimer).
--   · `ga4_event_categories` — LE CHOIX : quelle catégorie pour quel événement
--     GA4, PAR NOM D'ÉVÉNEMENT, PAS PAR THÈME. Un même événement (`purchase`)
--     signifie la même chose quel que soit le thème qui le suit — la catégorie
--     est une propriété de l'ÉVÉNEMENT, comme son volume ou sa fraîcheur, pas
--     du couple (thème, événement). C'est ce qui permet au camembert de
--     `/conversions` de compter « mes conversions par catégorie » sur tout le
--     compte, sans se demander quel thème regarder.
--
-- MÊME PATRON QUE `theme_ga4_events.sql` / `theme_objectifs.sql` :
--   · le nom est stocké tel quel, comme partout ailleurs dans Pulse — renommer
--     ou supprimer une catégorie doit donc propager dans
--     `ga4_event_categories.category` (fait dans `renameConversionCategory` /
--     deleteConversionCategory`, saas/web/app/actions.ts) ;
--   · l'ABSENCE DE LIGNE dans `ga4_event_categories` EST le « non catégorisé »,
--     il n'y a pas de troisième état à stocker.
--
-- `category_source` REJOUE LA RÈGLE D'OR DE LA LABELLISATION IA :
-- un choix humain (`'user'`, posé par le menu déroulant à côté de chaque
-- conversion sur /conversions) n'est JAMAIS écrasé par la classification
-- automatique (`'ai'`, `saas/worker/categorizing.py`) — même garde-fou que
-- `label_source` sur les campagnes et les posts Instagram.
--
-- Idempotent : rejouable sans risque. Aucun DROP de table, aucun DELETE.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.conversion_categories (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name        text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT conversion_categories_uq UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_conversion_categories_user
    ON public.conversion_categories (user_id);

DROP TRIGGER IF EXISTS trg_conversion_categories_updated_at ON public.conversion_categories;
CREATE TRIGGER trg_conversion_categories_updated_at
    BEFORE UPDATE ON public.conversion_categories
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.ga4_event_categories (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_name      text NOT NULL,
    category        text NOT NULL,
    category_source text NOT NULL DEFAULT 'user',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ga4_event_categories_uq UNIQUE (user_id, event_name)
);

-- `ADD CONSTRAINT IF NOT EXISTS` n'existe pas pour un CHECK : on rattrape
-- l'erreur de doublon plutôt que de la deviner.
DO $$
BEGIN
    ALTER TABLE public.ga4_event_categories
        ADD CONSTRAINT ga4_event_categories_source_ck
        CHECK (category_source IN ('user', 'ai'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_ga4_event_categories_user
    ON public.ga4_event_categories (user_id);

DROP TRIGGER IF EXISTS trg_ga4_event_categories_updated_at ON public.ga4_event_categories;
CREATE TRIGGER trg_ga4_event_categories_updated_at
    BEFORE UPDATE ON public.ga4_event_categories
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────
-- Deux jeux de politiques par table, comme `theme_ga4_events` / `theme_objectifs` :
-- « chacun ses lignes » d'abord (elle vaut même sans le partage d'équipe), le
-- partage ensuite.
ALTER TABLE public.conversion_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cc_select_own" ON public.conversion_categories;
DROP POLICY IF EXISTS "cc_insert_own" ON public.conversion_categories;
DROP POLICY IF EXISTS "cc_update_own" ON public.conversion_categories;
DROP POLICY IF EXISTS "cc_delete_own" ON public.conversion_categories;
CREATE POLICY "cc_select_own" ON public.conversion_categories
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "cc_insert_own" ON public.conversion_categories
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cc_update_own" ON public.conversion_categories
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cc_delete_own" ON public.conversion_categories
    FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.ga4_event_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gec_select_own" ON public.ga4_event_categories;
DROP POLICY IF EXISTS "gec_insert_own" ON public.ga4_event_categories;
DROP POLICY IF EXISTS "gec_update_own" ON public.ga4_event_categories;
DROP POLICY IF EXISTS "gec_delete_own" ON public.ga4_event_categories;
CREATE POLICY "gec_select_own" ON public.ga4_event_categories
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "gec_insert_own" ON public.ga4_event_categories
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gec_update_own" ON public.ga4_event_categories
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gec_delete_own" ON public.ga4_event_categories
    FOR DELETE USING (auth.uid() = user_id);

-- Partage d'équipe — seulement si la section 12 est passée. Sans ce garde, ce
-- fichier joué seul sur une base sans `a_acces()` s'arrêterait ici et laisserait
-- les deux tables sans ses politiques « chacun ses lignes » déjà posées au-dessus.
DO $$
BEGIN
    IF to_regprocedure('public.a_acces(uuid)') IS NULL
       OR to_regprocedure('public.peut_editer(uuid)') IS NULL THEN
        RAISE WARNING
            'a_acces() / peut_editer() absentes : conversion_categories et ga4_event_categories restent privées au propriétaire. Joue 000_run_me_all.sql pour ouvrir le partage.';
        RETURN;
    END IF;

    DROP POLICY IF EXISTS "partage_select" ON public.conversion_categories;
    DROP POLICY IF EXISTS "partage_insert" ON public.conversion_categories;
    DROP POLICY IF EXISTS "partage_update" ON public.conversion_categories;
    DROP POLICY IF EXISTS "partage_delete" ON public.conversion_categories;
    CREATE POLICY "partage_select" ON public.conversion_categories
        FOR SELECT USING (public.a_acces(user_id));
    CREATE POLICY "partage_insert" ON public.conversion_categories
        FOR INSERT WITH CHECK (public.peut_editer(user_id));
    CREATE POLICY "partage_update" ON public.conversion_categories
        FOR UPDATE USING (public.peut_editer(user_id)) WITH CHECK (public.peut_editer(user_id));
    CREATE POLICY "partage_delete" ON public.conversion_categories
        FOR DELETE USING (public.peut_editer(user_id));

    DROP POLICY IF EXISTS "partage_select" ON public.ga4_event_categories;
    DROP POLICY IF EXISTS "partage_insert" ON public.ga4_event_categories;
    DROP POLICY IF EXISTS "partage_update" ON public.ga4_event_categories;
    DROP POLICY IF EXISTS "partage_delete" ON public.ga4_event_categories;
    CREATE POLICY "partage_select" ON public.ga4_event_categories
        FOR SELECT USING (public.a_acces(user_id));
    CREATE POLICY "partage_insert" ON public.ga4_event_categories
        FOR INSERT WITH CHECK (public.peut_editer(user_id));
    CREATE POLICY "partage_update" ON public.ga4_event_categories
        FOR UPDATE USING (public.peut_editer(user_id)) WITH CHECK (public.peut_editer(user_id));
    CREATE POLICY "partage_delete" ON public.ga4_event_categories
        FOR DELETE USING (public.peut_editer(user_id));
END $$;
