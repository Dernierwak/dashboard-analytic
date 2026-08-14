-- ============================================================================
-- PARTAGE — remettre TOUTES les tables au même niveau, et le vérifier.
--
-- POURQUOI CE FICHIER EXISTE.
-- `equipe_partage.sql` ouvre les tables par une boucle, et cette boucle est une
-- PHOTO : elle ne connaît que les tables qui existaient le jour où on l'a
-- jouée, et elle passe son chemin en silence sur celles qui n'existaient pas
-- encore (`IF NOT EXISTS (...) THEN CONTINUE`). Une table ajoutée ensuite sans
-- sa propre règle de partage reste donc invisible à l'invité — et elle l'est
-- module par module, sans erreur nulle part : le dashboard s'affiche, il est
-- juste vide à cet endroit-là. C'est exactement le genre de trou qui ne se voit
-- qu'en production, et seulement chez l'invité.
--
-- Ce fichier reprend la liste COMPLÈTE et l'applique. Il ne remplace pas
-- `equipe_partage.sql` (qui crée `dashboard_members` et les deux fonctions) —
-- il se joue APRÈS, et se rejoue à chaque fois qu'une table naît.
--
-- ÉTAT CONSTATÉ EN AOÛT 2026 : aucune table lue par Pulse n'était réellement
-- orpheline. `platform_budgets` et `platform_changes`, nées après la boucle,
-- portent leurs propres politiques `partage_*` dans leur migration. Ce fichier
-- ne répare donc pas un trou connu : il enlève la possibilité qu'il s'en ouvre
-- un sans qu'on le voie, et il donne de quoi le constater (bloc de contrôle en
-- fin de fichier).
--
-- CE QUI N'EST PAS PARTAGÉ, ET NE DOIT JAMAIS L'ÊTRE : `connected_accounts`.
-- Elle porte les jetons Meta et Google. Un invité voit les données récoltées,
-- jamais de quoi les récolter lui-même. La section 2 le vérifie plutôt que de
-- le supposer.
--
-- Idempotent : rejouable autant de fois qu'on veut.
-- À exécuter dans l'éditeur SQL de Supabase, après `equipe_partage.sql`.
-- ============================================================================


-- ── 0. Les fonctions doivent être là ────────────────────────────────────────
-- Sans elles, ce fichier poserait des politiques qui échoueraient à
-- l'exécution. Mieux vaut s'arrêter net avec une phrase lisible.

DO $$
BEGIN
    IF to_regprocedure('public.a_acces(uuid)') IS NULL
       OR to_regprocedure('public.peut_editer(uuid)') IS NULL THEN
        RAISE EXCEPTION
            'a_acces() / peut_editer() manquent : joue equipe_partage.sql avant celui-ci.';
    END IF;
END $$;


-- ── 1. La liste complète, appliquée ─────────────────────────────────────────
-- Même règle partout : lire = a_acces, écrire = peut_editer. Une table absente
-- de la base est ignorée (une migration peut ne pas avoir été jouée) mais elle
-- est SIGNALÉE, au lieu d'être sautée en silence comme dans la boucle d'origine
-- — c'est cette discrétion-là qui rendait le trou invisible.

DO $$
DECLARE
    t   text;
    col text;
    tables text[] := ARRAY[
        -- régies publicitaires
        'meta_ads_insights', 'google_ads_insights', 'google_ads_ad_insights',
        'meta_campaign_config', 'google_campaign_config',
        -- organique et analytics
        'instagram_organic_posts', 'followers_history',
        'ga4_insights', 'ga4_events',
        -- ce que Pulse produit et ce que l'utilisateur y répond
        'weekly_reports', 'reco_feedback', 'insight_feedback', 'suivi_actions',
        -- budgets et journal des plateformes
        'channel_budgets', 'platform_budgets', 'platform_changes',
        -- le profil : objectif, labels unifiés (profiles.labels), persona IA
        'profiles'
    ];
    -- NB : 'meta_campaign_status' figurait dans la liste d'origine. Ce n'est
    -- pas une table, c'est le nom d'une migration qui ajoute une colonne à
    -- meta_campaign_config. La boucle la sautait sans rien dire ; on l'a
    -- retirée plutôt que de laisser croire à une table oubliée.
    --
    -- 'unified_labels' non plus n'est pas une table : les labels unifiés vivent
    -- dans profiles.labels, déjà couvert par la ligne 'profiles'.
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                       WHERE table_schema = 'public' AND table_name = t) THEN
            RAISE WARNING 'table % absente — sa migration n''a pas été jouée', t;
            CONTINUE;
        END IF;

        -- profiles se repère par id, toutes les autres par user_id.
        col := CASE WHEN t = 'profiles' THEN 'id' ELSE 'user_id' END;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema = 'public' AND table_name = t
                         AND column_name = col) THEN
            RAISE WARNING 'table % sans colonne % — partage impossible', t, col;
            CONTINUE;
        END IF;

        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS "partage_select" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "partage_insert" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "partage_update" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "partage_delete" ON public.%I', t);

        EXECUTE format(
            'CREATE POLICY "partage_select" ON public.%I FOR SELECT USING (public.a_acces(%I))', t, col);
        EXECUTE format(
            'CREATE POLICY "partage_insert" ON public.%I FOR INSERT WITH CHECK (public.peut_editer(%I))', t, col);
        EXECUTE format(
            'CREATE POLICY "partage_update" ON public.%I FOR UPDATE USING (public.peut_editer(%I)) WITH CHECK (public.peut_editer(%I))', t, col, col);
        EXECUTE format(
            'CREATE POLICY "partage_delete" ON public.%I FOR DELETE USING (public.peut_editer(%I))', t, col);
    END LOOP;
END $$;

-- Les anciennes politiques « chacun ses lignes » restent en place : PostgreSQL
-- combine en OU les politiques d'une même commande, donc elles n'enlèvent aucun
-- droit et garantissent au propriétaire de garder le sien quoi qu'il arrive.


-- ── 2. connected_accounts : on vérifie qu'elle est bien restée fermée ────────
-- Deux gestes, aucun risque :
--   · on supprime toute politique de partage qui aurait atterri là par
--     inadvertance (une liste recopiée trop vite suffirait) ;
--   · on refuse d'activer la RLS sur une table qui n'aurait aucune politique —
--     ce serait fermer la porte au propriétaire lui-même et casser toute la
--     page Connexions. Dans ce cas on avertit, on ne touche à rien.

DO $$
DECLARE
    r        record;
    nb_pol   integer;
    rls_on   boolean;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = 'public' AND table_name = 'connected_accounts') THEN
        RAISE WARNING 'connected_accounts absente — rien à vérifier';
        RETURN;
    END IF;

    -- Toute politique dont la règle invoque a_acces/peut_editer sur cette table
    -- est une fuite de jetons : on la retire, et on le dit fort.
    FOR r IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'connected_accounts'
          AND (coalesce(qual, '') || ' ' || coalesce(with_check, ''))
              ~ '(a_acces|peut_editer)'
    LOOP
        EXECUTE format('DROP POLICY %I ON public.connected_accounts', r.policyname);
        RAISE WARNING
            'politique de PARTAGE retirée de connected_accounts : % — les jetons Meta/Google ne se partagent pas',
            r.policyname;
    END LOOP;

    SELECT count(*) INTO nb_pol
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'connected_accounts';

    SELECT relrowsecurity INTO rls_on
    FROM pg_class WHERE oid = 'public.connected_accounts'::regclass;

    IF nb_pol = 0 THEN
        RAISE WARNING
            'connected_accounts n''a AUCUNE politique. On n''active pas la RLS (plus personne ne lirait ses propres connexions). À regarder à la main.';
    ELSIF NOT rls_on THEN
        ALTER TABLE public.connected_accounts ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'RLS activée sur connected_accounts (% politique(s) déjà en place)', nb_pol;
    ELSE
        RAISE NOTICE 'connected_accounts : RLS active, % politique(s), aucune de partage. Conforme.', nb_pol;
    END IF;
END $$;


-- ============================================================================
-- CONTRÔLE APRÈS EXÉCUTION — à lancer séparément, et à relire.
-- ============================================================================
--
-- A) Ce que l'invité peut lire. Doit lister les 17 tables de la section 1,
--    chacune avec sa politique partage_select :
--
--    SELECT tablename, policyname, qual
--    FROM pg_policies
--    WHERE schemaname = 'public' AND policyname LIKE 'partage_%'
--    ORDER BY tablename, policyname;
--
-- B) LE contrôle qui vaut le coup : les tables « à user_id » qui n'ont AUCUNE
--    politique de lecture passant par a_acces. Tout ce qui sort ici est
--    invisible à l'invité — sauf connected_accounts, qui doit y figurer :
--
--    SELECT c.relname AS table_orpheline
--    FROM pg_class c
--    JOIN pg_namespace n ON n.oid = c.relnamespace
--    WHERE n.nspname = 'public'
--      AND c.relkind = 'r'
--      AND EXISTS (SELECT 1 FROM information_schema.columns
--                  WHERE table_schema = 'public' AND table_name = c.relname
--                    AND column_name IN ('user_id', 'id'))
--      AND NOT EXISTS (SELECT 1 FROM pg_policies p
--                      WHERE p.schemaname = 'public' AND p.tablename = c.relname
--                        AND p.cmd IN ('SELECT', 'ALL')
--                        AND coalesce(p.qual, '') ~ 'a_acces')
--    ORDER BY 1;
--
--    Attendu : connected_accounts (volontaire), dashboard_members (règle
--    propre : dm_select), et les tables de l'ancien Streamlit qui ne sont plus
--    lues par Pulse (ai_recommendations, ai_feedback, free_data, paid_data).
--    Toute AUTRE ligne est un module que l'invité verra vide.
-- ============================================================================
