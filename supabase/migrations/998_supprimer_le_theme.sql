-- ============================================================================
-- 998_supprimer_le_theme.sql
--
-- ⚠️  CE FICHIER DÉTRUIT DES DONNÉES, DÉFINITIVEMENT, ET SANS RETOUR.
--     Il n'est PAS inclus dans `000_run_me_all.sql` et ne doit jamais l'être :
--     le fichier unique installe, celui-ci démolit. Il se joue UNE FOIS, à la
--     main, après relecture.
--
--     AUCUNE ARCHIVE N'EST FAITE, ET C'EST UNE DÉCISION : David, le 2026-09-30,
--     à la question « faut-il archiver les thèmes posés par les clients avant
--     de les détruire ? » — « Rien, on perd ». Ce qui a été étiqueté disparaît.
--     L'idée, elle, est notée au `BACKLOG.md`.
--
-- ────────────────────────────────────────────────────────────────────────────
-- QUAND LE JOUER — PAS AVANT QUE LE CODE SOIT DÉPLOYÉ
--
-- Le thème et le label ont quitté le produit le 2026-09-30 (carte
-- `.scratch/meta-ads/map.md`). Le code qui les lisait part d'abord (ticket
-- « Le thème et le label quittent l'écran et le code »), la base ensuite.
-- L'ordre n'est pas négociable : joué trop tôt, ce fichier fait casser
-- franchement chaque écran et le worker qui lisent encore une colonne
-- disparue. Attendre que `main` soit déployé sur Vercel ET qu'un passage du
-- worker ait tourné sur le nouveau code.
--
-- ────────────────────────────────────────────────────────────────────────────
-- CE QU'IL SUPPRIME
--
--   La vue      `theme_regroupement` — le total par thème, calculé en base.
--   Les tables  `theme_ga4_events`   — quel événement GA4 compte pour quel thème.
--               `theme_objectifs`    — l'objectif propre d'un thème.
--               `insight_feedback`   — ENTIÈRE. Elle portait deux choses : les
--                   verdicts ✓/✗ sur les constats (morts avec les recos le
--                   2026-09-21) et les thèmes étoilés `priority_label:<nom>`
--                   (morts avec le thème). Plus rien ne la lit ni ne l'écrit.
--   Les colonnes
--     `meta_campaign_config`    label, label_source, label_at
--     `google_campaign_config`  label, label_source, label_at
--     `instagram_organic_posts` labels, label_source, label_at
--     `profiles`                labels (la liste maîtresse), et les deux
--                               listes qu'elle avait remplacées :
--                               campaign_labels, google_campaign_labels
--   Les déclencheurs `trg_*_label_at` et leurs fonctions `stamp_label_at()`,
--               `stamp_label_at_posts()` — une fonction vit au niveau du
--               schéma et survivrait, orpheline, à ses colonnes.
--   Les lignes  `fetch_progress` du canal 'labels' — l'étiquetage par l'IA
--               ne tourne plus depuis le 2026-09-21 ; ces lignes n'avancent
--               plus jamais.
--
-- ────────────────────────────────────────────────────────────────────────────
-- CE QU'IL NE SUPPRIME PAS, ET C'EST DÉLIBÉRÉ
--
-- `meta_campaign_config` et `google_campaign_config` RESTENT : elles portent
-- aussi le budget, le statut, les dates déclarées et la page d'arrivée d'une
-- campagne. Seules leurs colonnes de thème partent.
--
-- `profiles.ga4_event_catalog` RESTE. Il est né dans la même migration que
-- `theme_ga4_events`, mais il ne parle pas de thème : c'est la liste des
-- événements que la propriété GA4 émet, lue par /conversions.
--
-- `conversion_categories` et `ga4_event_categories` RESTENT : une catégorie
-- se rattache à un NOM D'ÉVÉNEMENT, jamais à un thème.
--
-- La contrainte CHECK de `fetch_progress.canal` accepte encore 'labels'. La
-- resserrer demanderait de la supprimer et de la reposer, pour interdire une
-- valeur que plus personne n'écrit : le risque ne paie rien.
--
-- ────────────────────────────────────────────────────────────────────────────
-- POURQUOI AUCUN `CASCADE`
--
-- Le `999` en met partout. Ici, non : `CASCADE` emporte EN SILENCE toute vue
-- ou clé étrangère qui dépendrait d'un objet supprimé — y compris une qu'on
-- n'aurait pas relevée. Sans lui, une dépendance oubliée fait échouer le
-- fichier, et comme tout est dans une transaction, RIEN n'est supprimé : on
-- lit l'erreur, on regarde, on décide. Index, politiques RLS et déclencheurs
-- d'une table partent avec elle de toute façon, `CASCADE` ou pas.
-- ============================================================================

BEGIN;

-- La vue d'abord : elle lit `cfg.label`, `theme_ga4_events` et
-- `instagram_organic_posts.labels`. Tant qu'elle existe, aucun de ces objets
-- ne peut partir sans `CASCADE`.
DROP VIEW IF EXISTS public.theme_regroupement;

DROP TABLE IF EXISTS public.theme_ga4_events;
DROP TABLE IF EXISTS public.theme_objectifs;
DROP TABLE IF EXISTS public.insight_feedback;

DROP TRIGGER IF EXISTS trg_meta_campaign_config_label_at    ON public.meta_campaign_config;
DROP TRIGGER IF EXISTS trg_google_campaign_config_label_at  ON public.google_campaign_config;
DROP TRIGGER IF EXISTS trg_instagram_organic_posts_label_at ON public.instagram_organic_posts;
DROP FUNCTION IF EXISTS public.stamp_label_at();
DROP FUNCTION IF EXISTS public.stamp_label_at_posts();

-- Ces trois index partiels partiraient avec `label_source` ; les nommer rend
-- le fichier lisible sans connaître cette règle de PostgreSQL.
DROP INDEX IF EXISTS public.idx_meta_cfg_label_ia;
DROP INDEX IF EXISTS public.idx_google_cfg_label_ia;
DROP INDEX IF EXISTS public.idx_insta_posts_label_ia;

ALTER TABLE public.meta_campaign_config
    DROP COLUMN IF EXISTS label,
    DROP COLUMN IF EXISTS label_source,
    DROP COLUMN IF EXISTS label_at;

ALTER TABLE public.google_campaign_config
    DROP COLUMN IF EXISTS label,
    DROP COLUMN IF EXISTS label_source,
    DROP COLUMN IF EXISTS label_at;

ALTER TABLE public.instagram_organic_posts
    DROP COLUMN IF EXISTS labels,
    DROP COLUMN IF EXISTS label_source,
    DROP COLUMN IF EXISTS label_at;

ALTER TABLE public.profiles
    DROP COLUMN IF EXISTS labels,
    DROP COLUMN IF EXISTS campaign_labels,
    DROP COLUMN IF EXISTS google_campaign_labels;

DELETE FROM public.fetch_progress WHERE canal = 'labels';

COMMIT;

-- PostgREST garde en cache le schéma d'avant : sans ce rechargement, une
-- requête vers une colonne disparue peut répondre comme si elle existait
-- encore, le temps que le cache se renouvelle seul.
NOTIFY pgrst, 'reload schema';


-- ────────────────────────────────────────────────────────────────────────────
-- CONTRÔLE — à jouer après, SEUL (sélectionne du `SELECT` au `;` final et
-- Cmd/Ctrl+Entrée : le SQL editor n'affiche que la dernière instruction).
--
-- Toutes les lignes doivent dire « ✓ ». Une ligne « ✗ » dit ce qui est encore
-- là. Les deux dernières doivent dire « ✓ présente » : si l'une dit autre
-- chose, une table vivante a été touchée.
WITH parti(obj, col) AS (VALUES
    ('theme_regroupement',      NULL::text),
    ('theme_ga4_events',        NULL),
    ('theme_objectifs',         NULL),
    ('insight_feedback',        NULL),
    ('meta_campaign_config',    'label'),
    ('meta_campaign_config',    'label_source'),
    ('meta_campaign_config',    'label_at'),
    ('google_campaign_config',  'label'),
    ('google_campaign_config',  'label_source'),
    ('google_campaign_config',  'label_at'),
    ('instagram_organic_posts', 'labels'),
    ('instagram_organic_posts', 'label_source'),
    ('instagram_organic_posts', 'label_at'),
    ('profiles',                'labels'),
    ('profiles',                'campaign_labels'),
    ('profiles',                'google_campaign_labels')
)
SELECT p.obj || coalesce('.' || p.col, '') AS objet,
       CASE
           WHEN p.col IS NULL AND to_regclass('public.' || p.obj) IS NULL
               THEN '✓ supprimée'
           WHEN p.col IS NULL
               THEN '✗ ENCORE LÀ'
           WHEN EXISTS (SELECT 1 FROM information_schema.columns c
                         WHERE c.table_schema = 'public'
                           AND c.table_name   = p.obj
                           AND c.column_name  = p.col)
               THEN '✗ ENCORE LÀ'
           ELSE '✓ supprimée'
       END AS etat
  FROM parti p
UNION ALL
SELECT 'fonctions stamp_label_at*',
       CASE WHEN to_regprocedure('public.stamp_label_at()')       IS NULL
             AND to_regprocedure('public.stamp_label_at_posts()') IS NULL
            THEN '✓ supprimées' ELSE '✗ ENCORE LÀ' END
UNION ALL
SELECT 'fetch_progress, canal labels',
       CASE WHEN NOT EXISTS (SELECT 1 FROM public.fetch_progress WHERE canal = 'labels')
            THEN '✓ aucune ligne' ELSE '✗ ENCORE LÀ' END
UNION ALL
SELECT 'meta_campaign_config',
       CASE WHEN to_regclass('public.meta_campaign_config') IS NOT NULL
            THEN '✓ présente (budget, statut, dates)' ELSE '✗ ABSENTE' END
UNION ALL
SELECT 'google_campaign_config',
       CASE WHEN to_regclass('public.google_campaign_config') IS NOT NULL
            THEN '✓ présente (budget, statut, dates)' ELSE '✗ ABSENTE' END;
