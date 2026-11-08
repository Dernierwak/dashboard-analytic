-- ============================================================================
-- CONTRÔLE — chantier instagram-construction (section 23, relecture, cron)
-- ============================================================================
-- À coller tel quel dans le SQL Editor de Supabase : une seule requête, en
-- LECTURE SEULE (aucun INSERT, UPDATE, DELETE). L'éditeur n'affiche que le
-- dernier résultat, d'où un seul SELECT qui rend un tableau :
--   etape · controle · valeur · attendu · verdict (OK / KO / À LIRE)
--
-- Étape A — la section 23 est jouée.
-- Étape B — la relecture unique a tourné (lancement à la main, ticket 03).
-- Étape C — le cron de 07:00 UTC suivant a tourné (tickets 04 à 08).
-- Un KO en C avant le premier cron est normal : relancer après 07:00 UTC.
--
-- Les seuils viennent des tickets de `.scratch/instagram-construction/` :
-- chaque ligne cite le sien. « À LIRE » = un chiffre que seul le journal du
-- run (GitHub Actions) ou un humain peut juger.
-- ============================================================================

WITH
attendues(table_name, column_name) AS (
    VALUES
        ('instagram_organic_posts', 'shares'),
        ('instagram_organic_posts', 'profile_visits'),
        ('instagram_organic_posts', 'avg_watch_time'),
        ('instagram_organic_posts', 'releve_a'),
        ('instagram_organic_posts', 'booste_vu_le'),
        ('connected_accounts',      'relecture_instagram_le'),
        ('connected_accounts',      'premier_passage_instagram_le'),
        ('connected_accounts',      'rattrapage_instagram_curseur'),
        ('connected_accounts',      'rattrapage_instagram_fini_le'),
        ('instagram_post_releves',  'age_heures'),
        ('instagram_compte_jours',  'reach_ad'),
        ('instagram_compte_periodes', 'reach')
),
schema AS (
    SELECT count(*)                                       AS attendues,
           count(c.column_name)                           AS presentes,
           string_agg(CASE WHEN c.column_name IS NULL
                           THEN a.table_name || '.' || a.column_name END, ', ') AS manquantes
    FROM attendues a
    LEFT JOIN information_schema.columns c
           ON c.table_schema = 'public'
          AND c.table_name   = a.table_name
          AND c.column_name  = a.column_name
),
rls AS (
    SELECT count(*) FILTER (WHERE relrowsecurity) AS avec_rls
    FROM pg_class
    WHERE relnamespace = 'public'::regnamespace
      AND relname IN ('instagram_post_releves', 'instagram_compte_jours', 'instagram_compte_periodes')
),
posts AS (
    SELECT count(*)                                                        AS total,
           count(*) FILTER (WHERE releve_a IS NOT NULL)                    AS relus,
           count(*) FILTER (WHERE releve_a IS NULL)                        AS jamais_relus,
           count(media_product_type)                                       AS avec_produit,
           count(permalink)                                                AS avec_lien,
           count(shares) FILTER (WHERE releve_a IS NOT NULL)               AS relus_avec_partages,
           count(booste_vu_le)                                             AS boostes_vus,
           count(*) FILTER (WHERE media_product_type = 'REELS')            AS reels,
           count(*) FILTER (WHERE media_product_type = 'REELS' AND follows IS NOT NULL)        AS reels_avec_follows,
           count(*) FILTER (WHERE media_product_type = 'REELS' AND avg_watch_time IS NOT NULL) AS reels_avec_visionnage,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY avg_watch_time::float8)
               FILTER (WHERE media_product_type = 'REELS')                 AS visionnage_median,
           count(*) FILTER (WHERE type = 'VIDEO' AND media_product_type IS NULL) AS faux_zeros_restants
    FROM public.instagram_organic_posts
),
releves AS (
    SELECT count(*)                                              AS total,
           count(DISTINCT (user_id, post_id))                    AS posts_releves,
           count(*) FILTER (WHERE age_heures IS NULL)            AS sans_age,
           count(booste)                                         AS avec_boost_connu,
           count(*) FILTER (WHERE releve_a >= current_date)      AS du_jour
    FROM public.instagram_post_releves
),
comptes AS (
    SELECT count(*)                                              AS instagram,
           count(relecture_instagram_le)                         AS dates_relecture,
           count(premier_passage_instagram_le)                   AS premiers_passages,
           count(*) FILTER (WHERE rattrapage_instagram_curseur IS NOT NULL
                               OR rattrapage_instagram_fini_le IS NOT NULL) AS rattrapages_en_cours_ou_finis
    FROM public.connected_accounts
    WHERE instagram_business_id IS NOT NULL
),
jours AS (
    SELECT count(*)                                              AS total,
           count(*) FILTER (WHERE jour >= current_date)          AS jour_en_cours,
           count(*) FILTER (WHERE jour = current_date - 1)       AS lignes_hier,
           min(nb)                                               AS jours_min_par_compte,
           count(abonnes)                                        AS avec_abonnes,
           count(gagnes)                                         AS avec_gagnes
    FROM public.instagram_compte_jours j
    JOIN (SELECT user_id, count(*) AS nb FROM public.instagram_compte_jours GROUP BY user_id) n
      USING (user_id)
),
periodes AS (
    SELECT count(*)                                              AS total,
           count(*) FILTER (WHERE fin - debut <> 6)              AS pas_sept_jours,
           max(fin)                                              AS derniere_fin
    FROM public.instagram_compte_periodes
)
SELECT etape, controle, valeur, attendu, verdict
FROM (
    -- ── A · La section 23 ────────────────────────────────────────────────
    SELECT 1 AS ordre, 'A' AS etape, 'Colonnes et tables de la section 23' AS controle,
           s.presentes || ' / ' || s.attendues || coalesce(' — manque : ' || s.manquantes, '') AS valeur,
           'toutes présentes' AS attendu,
           CASE WHEN s.presentes = s.attendues THEN 'OK' ELSE 'KO' END AS verdict
    FROM schema s
    UNION ALL
    SELECT 2, 'A', 'RLS active sur les 3 nouvelles tables',
           r.avec_rls || ' / 3', '3 / 3 (ticket 01)',
           CASE WHEN r.avec_rls = 3 THEN 'OK' ELSE 'KO' END
    FROM rls r

    -- ── B · La relecture unique ──────────────────────────────────────────
    UNION ALL
    SELECT 10, 'B', 'Posts en base', p.total::text,
           'le compte du journal', 'À LIRE'
    FROM posts p
    UNION ALL
    SELECT 11, 'B', 'Posts jamais relus (releve_a vide)', p.jamais_relus::text,
           '= « N refusé(s) » du journal (posts supprimés chez Meta, ticket 03)', 'À LIRE'
    FROM posts p
    UNION ALL
    SELECT 12, 'B', 'Reels avec un follows (doit être NULL)', p.reels_avec_follows::text,
           '0 — Instagram refuse follows sur un Reel (ticket 01)',
           CASE WHEN p.reels_avec_follows = 0 THEN 'OK' ELSE 'KO' END
    FROM posts p
    UNION ALL
    SELECT 13, 'B', 'Posts relus avec leur format (media_product_type)',
           p.avec_produit || ' / ' || p.relus,
           '≥ posts relus (la relecture le remplit, ticket 03)',
           CASE WHEN p.relus > 0 AND p.avec_produit >= p.relus THEN 'OK'
                WHEN p.relus = 0 THEN 'KO' ELSE 'À LIRE' END
    FROM posts p
    UNION ALL
    SELECT 14, 'B', 'Posts avec un lien public (permalink)',
           p.avec_lien || ' / ' || p.total,
           'proche du total : le Panneau en a besoin pour le lecteur (ticket 11)',
           CASE WHEN p.total > 0 AND p.avec_lien >= p.relus THEN 'OK' ELSE 'À LIRE' END
    FROM posts p
    UNION ALL
    SELECT 15, 'B', 'Posts relus avec les partages',
           p.relus_avec_partages || ' / ' || p.relus,
           '= posts relus : sans partages, le taux reste vide (ticket 10)',
           CASE WHEN p.relus > 0 AND p.relus_avec_partages = p.relus THEN 'OK'
                WHEN p.relus_avec_partages = 0 THEN 'KO' ELSE 'À LIRE' END
    FROM posts p
    UNION ALL
    SELECT 16, 'B', 'Posts vus boostés (booste_vu_le)', p.boostes_vus::text,
           'ce que tu sais avoir boosté (ticket 02)', 'À LIRE'
    FROM posts p
    UNION ALL
    SELECT 17, 'B', 'Reels avec le temps de visionnage',
           p.reels_avec_visionnage || ' / ' || p.reels,
           '> 0 — sinon Meta refuse ig_reels_avg_watch_time (ticket 01)',
           CASE WHEN p.reels = 0 THEN 'À LIRE'
                WHEN p.reels_avec_visionnage = 0 THEN 'KO' ELSE 'OK' END
    FROM posts p
    UNION ALL
    SELECT 18, 'B', 'Temps de visionnage médian d''un Reel (unité brute)',
           coalesce(round(p.visionnage_median::numeric, 1)::text, '–'),
           'quelques milliers = millisecondes (attendu) ; quelques unités = secondes → corriger MS_PAR_SECONDE (ticket 09)',
           CASE WHEN p.visionnage_median IS NULL THEN 'À LIRE'
                WHEN p.visionnage_median >= 500 THEN 'OK' ELSE 'KO' END
    FROM posts p
    UNION ALL
    SELECT 19, 'B', 'Relevés écrits', r.total || ' (' || r.posts_releves || ' posts)',
           '≥ un relevé par post relu (ticket 01)',
           CASE WHEN r.posts_releves >= p.relus AND p.relus > 0 THEN 'OK' ELSE 'KO' END
    FROM releves r, posts p
    UNION ALL
    SELECT 20, 'B', 'Relevés sans âge', r.sans_age::text,
           '0, ou très peu : date de publication illisible chez Meta (ticket 01)',
           CASE WHEN r.sans_age = 0 THEN 'OK' ELSE 'À LIRE' END
    FROM releves r
    UNION ALL
    SELECT 21, 'B', 'Relevés où le boost est connu', r.avec_boost_connu || ' / ' || r.total,
           'proche du total ; NULL = boost_ads_list refusé ce jour-là (ticket 02)',
           CASE WHEN r.total > 0 AND r.avec_boost_connu = r.total THEN 'OK' ELSE 'À LIRE' END
    FROM releves r
    UNION ALL
    SELECT 22, 'B', 'Comptes Instagram datés par la relecture',
           c.dates_relecture || ' / ' || c.instagram,
           'tous (le lancement à la main pose la date, ticket 07)',
           CASE WHEN c.instagram > 0 AND c.dates_relecture = c.instagram THEN 'OK' ELSE 'KO' END
    FROM comptes c
    UNION ALL
    SELECT 23, 'B', 'Faux zéros restants (VIDEO sans format)', p.faux_zeros_restants::text,
           'ce chiffre = le comptage du nettoyage : le montrer AVANT l''UPDATE (ticket 03)', 'À LIRE'
    FROM posts p

    -- ── C · Après le cron de 07:00 UTC ───────────────────────────────────
    UNION ALL
    SELECT 30, 'C', 'Relevés écrits aujourd''hui (passage léger)', r.du_jour::text,
           '> 0 s''il y a des posts de moins de 8 jours (ticket 04)',
           CASE WHEN r.du_jour > 0 THEN 'OK' ELSE 'À LIRE' END
    FROM releves r
    UNION ALL
    SELECT 31, 'C', 'Jour en cours écrit dans le compte', j.jour_en_cours::text,
           '0 — la journée du fetch est incomplète (CLAUDE.md §7)',
           CASE WHEN j.jour_en_cours = 0 THEN 'OK' ELSE 'KO' END
    FROM jours j
    UNION ALL
    SELECT 32, 'C', 'Comptes avec la ligne d''hier', j.lignes_hier || ' / ' || c.instagram,
           'tous (relevé du compte, ticket 05)',
           CASE WHEN c.instagram > 0 AND j.lignes_hier = c.instagram THEN 'OK' ELSE 'KO' END
    FROM jours j, comptes c
    UNION ALL
    SELECT 33, 'C', 'Jours du compte, au moins par compte', coalesce(j.jours_min_par_compte::text, '0'),
           '≈ 90 après le premier passage (ticket 06)',
           CASE WHEN j.jours_min_par_compte >= 85 THEN 'OK'
                WHEN j.jours_min_par_compte IS NULL THEN 'KO' ELSE 'À LIRE' END
    FROM jours j
    UNION ALL
    SELECT 34, 'C', 'Jours avec abonnés / avec gagnés',
           j.avec_abonnes || ' / ' || j.avec_gagnes || ' sur ' || j.total,
           'abonnés ≈ 31 par compte (remontée, ticket 06) ; gagnés vides sous 100 abonnés (doc Meta)', 'À LIRE'
    FROM jours j
    UNION ALL
    SELECT 35, 'C', 'Comptes au premier passage fait',
           c.premiers_passages || ' / ' || c.instagram,
           'tous ; sinon le journal dit « k/88 jours remontés … retenté demain » (ticket 06)',
           CASE WHEN c.instagram > 0 AND c.premiers_passages = c.instagram THEN 'OK' ELSE 'KO' END
    FROM comptes c
    UNION ALL
    SELECT 36, 'C', 'Portées de période (7 jours)',
           pe.total || ' — dernière fin : ' || coalesce(pe.derniere_fin::text, '–'),
           'dernière fin = hier (ticket 05)',
           CASE WHEN pe.derniere_fin = current_date - 1 THEN 'OK' ELSE 'KO' END
    FROM periodes pe
    UNION ALL
    SELECT 37, 'C', 'Périodes qui ne font pas 7 jours', pe.pas_sept_jours::text,
           '0 (ticket 05)',
           CASE WHEN pe.pas_sept_jours = 0 THEN 'OK' ELSE 'KO' END
    FROM periodes pe
    UNION ALL
    SELECT 38, 'C', 'Comptes au Rattrapage commencé ou fini',
           c.rattrapages_en_cours_ou_finis || ' / ' || c.instagram,
           'les comptes payants seulement (ticket 08)', 'À LIRE'
    FROM comptes c
) t
ORDER BY ordre;
