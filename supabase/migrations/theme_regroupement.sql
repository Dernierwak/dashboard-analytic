-- ============================================================================
-- theme_regroupement — LE REGROUPEMENT PAR THÈME, CALCULÉ EN BASE.
--
-- Tranché par .scratch/refonte/issues/17-ce-qui-se-regroupe-et-ce-qui-est-mesure.md,
-- construit par .scratch/construction/issues/04-vue-sql-du-regroupement.md.
--
-- POURQUOI UNE VUE, ET PAS UN MODULE PAR LANGAGE.
-- Un Thème ne produit aucune donnée : il change PAR QUOI des chiffres déjà en
-- base sont additionnés (CONTEXT.md, « Regroupement »). Le total d'un thème se
-- recalcule donc à la lecture, tout de suite, sur tout l'historique — y compris
-- les semaines passées. Python le savait faire (`build_matrix`), TypeScript pas
-- du tout. Écrire la seconde implémentation en TS aurait donné deux jeux de
-- seuils qui dérivent — le défaut à trois moteurs mesuré par le ticket 11 de la
-- refonte. Ici, Python et TypeScript lisent LA MÊME arithmétique, et la base
-- rend quelques lignes au lieu de milliers.
--
-- CE QU'ELLE NE COUVRE PAS, EXPRÈS. `formats`, `slots`, `campaigns` et
-- `coverage` de `build_matrix` n'alimentent que des constats RÉDIGÉS, qui
-- attendent le Jour de travail de toute façon : les descendre en SQL serait un
-- gros refactor pour zéro fraîcheur gagnée. La vue ne couvre QUE les thèmes.
--
-- LE SEUIL DE JUGEMENT VIT ICI, avec le chiffre qu'il autorise. `juge` dit
-- « ce thème a assez de dépense pour qu'on se prononce » (≥ 100 CHF, seuil
-- hérité de `C_SEUILS["theme_spend_min"]`, qui disparaît de Python), et `roas`
-- est DÉJÀ filtré par lui — un appelant ne peut pas afficher un ROAS calculé
-- sur 12 CHF en croyant lire un chiffre solide.
--
-- SANS RÉPONSE DE LA VUE, PAS DE REVENU. `revenue` vaut NULL quand Google
-- Analytics ne rattache rien à ce compte — jamais 0, qui affirmerait « ce thème
-- n'a rien rapporté » (CLAUDE.md §7). Un thème d'un compte qui a bien du revenu
-- attribué mais rien sur CE thème vaut bien 0 : là, on le sait.
--
-- ⚠ AUCUN `DROP TABLE`, `DELETE` NI `TRUNCATE` — une vue ne stocke rien. Le
-- `DROP VIEW` ci-dessous ne touche qu'une définition, et il existe parce que
-- `CREATE OR REPLACE VIEW` refuse de changer le TYPE ou l'ORDRE des colonnes
-- existantes : sans lui, la moindre colonne ajoutée demain ferait échouer le
-- rejeu du fichier. Idempotent, rejouable sans risque.
-- ============================================================================

DROP VIEW IF EXISTS public.theme_regroupement;

CREATE VIEW public.theme_regroupement
WITH (security_invoker = true) AS
WITH bornes AS (
    -- LA JOURNÉE EN COURS EST DEHORS (CLAUDE.md §7) — et ici plus qu'ailleurs :
    -- la vue est lue à n'importe quelle heure, pas une fois par semaine à
    -- 07:00. Un thème lu à 23:00 un jour de grosse dépense afficherait la
    -- dépense du jour contre un revenu que Google Analytics n'a pas encore
    -- attribué, donc un ROAS effondré qui n'a jamais existé.
    --
    -- EUROPE/ZURICH, PAS `current_date`. Le serveur est en UTC, le client est
    -- suisse, et Zurich est EN AVANCE sur UTC : à 00h30 à Zurich le jour J, il
    -- est encore 22h30 la veille en UTC. `current_date` vaudrait donc J-1, le
    -- filtre deviendrait « avant J-1 », et la vue perdrait une journée ENTIÈRE
    -- et complète de dépense — chaque nuit, pendant une à deux heures. Le trou
    -- se lirait comme une baisse, ce que §7 interdit précisément.
    SELECT (now() AT TIME ZONE 'Europe/Zurich')::date AS aujourdhui
),

-- ── 1) Les campagnes des deux régies, ramenées à une seule forme ────────────
-- Le grain est la CAMPAGNE, pas le thème : c'est à ce grain que le revenu
-- Google Analytics se rattache (par nom d'UTM), et le regrouper plus tôt
-- perdrait le lien. Une campagne sans étiquette n'entre pas — elle n'appartient
-- à aucun thème.
campagnes AS NOT MATERIALIZED (
    SELECT m.user_id,
           cfg.label                                  AS label,
           lower(btrim(m.campaign_name))              AS nom_norm,
           sum(m.spend)                               AS spend,
           sum(m.clicks)::bigint                      AS clicks,
           sum(m.impressions)::bigint                 AS impressions
      FROM public.meta_ads_insights m
      JOIN public.meta_campaign_config cfg
        ON cfg.user_id = m.user_id
       AND cfg.campaign_name = m.campaign_name
     CROSS JOIN bornes b
     WHERE m.date_start < b.aujourdhui
       AND cfg.label IS NOT NULL
       AND cfg.label <> ''
     -- Meta s'agrège par NOM BRUT, pas normalisé : deux campagnes qui ne
     -- diffèrent que par la casse sont deux campagnes chez Meta, et c'est déjà
     -- comme ça que `build_matrix` les compte.
     GROUP BY m.user_id, cfg.label, m.campaign_name

    UNION ALL

    SELECT g.user_id,
           cfg.label,
           -- Google s'identifie par `campaign_id` ; son NOM sert au seul
           -- rattachement Google Analytics. Une campagne dont la config n'a pas
           -- retenu de nom garde le libellé de repli du rapport, qui ne
           -- rattachera rien — et c'est honnête : on ne sait pas comment elle
           -- est taguée.
           lower(btrim(coalesce(nullif(cfg.campaign_name, ''),
                                'Campagne ' || g.campaign_id))),
           sum(g.cost_micros)::numeric / 1000000.0,
           sum(g.clicks)::bigint,
           sum(g.impressions)::bigint
      FROM public.google_ads_insights g
      JOIN public.google_campaign_config cfg
        ON cfg.user_id = g.user_id
       AND cfg.campaign_id = g.campaign_id
     CROSS JOIN bornes b
     WHERE g.date_start < b.aujourdhui
       AND cfg.label IS NOT NULL
       AND cfg.label <> ''
     GROUP BY g.user_id, cfg.label, g.campaign_id, cfg.campaign_name
),

-- ── 2) Google Analytics sait-il rattacher quoi que ce soit à ce compte ? ────
-- La question se pose AU COMPTE, pas au thème : un compte dont GA4 n'attribue
-- aucune campagne payante ne peut pas dire qu'un thème a rapporté 0 — il ne
-- sait rien. C'est ce drapeau qui décide entre `revenue = 0` et `revenue NULL`.
ga4_present AS NOT MATERIALIZED (
    SELECT DISTINCT g.user_id
      FROM public.ga4_insights g
     CROSS JOIN bornes b
     WHERE g.date < b.aujourdhui
       AND lower(coalesce(g.medium, '')) LIKE ANY (ARRAY['%cpc%', '%ppc%', '%paid%'])
       AND btrim(coalesce(g.campaign, '')) <> ''
),

-- ── 3) Le revenu attribué, par campagne ────────────────────────────────────
-- Trafic PAYANT seulement (`medium` contenant cpc / ppc / paid) : c'est la
-- convention du rapport depuis l'origine, et c'est ce qui rend le rapport d'un
-- thème comparable à sa dépense.
ga4_revenu AS NOT MATERIALIZED (
    SELECT g.user_id,
           lower(btrim(g.campaign))  AS nom_norm,
           sum(g.revenue)            AS revenue
      FROM public.ga4_insights g
     CROSS JOIN bornes b
     WHERE g.date < b.aujourdhui
       AND lower(coalesce(g.medium, '')) LIKE ANY (ARRAY['%cpc%', '%ppc%', '%paid%'])
       AND btrim(coalesce(g.campaign, '')) <> ''
     GROUP BY g.user_id, lower(btrim(g.campaign))
),

-- ── 4) Les événements, par campagne ────────────────────────────────────────
-- AUCUN FILTRE `medium` ICI, contrairement au revenu ci-dessus : un événement
-- se rattache par le NOM de campagne et par rien d'autre. Filtrer sur le medium
-- jetterait en silence les campagnes mal taguées — exactement celles dont on
-- veut parler. (Même raison que `build_ga4_context`, `saas/collecte/ga4/ga4.py`.)
ga4_evenements AS NOT MATERIALIZED (
    SELECT e.user_id,
           lower(btrim(e.campaign))  AS nom_norm,
           e.event_name,
           sum(e.event_value)        AS value
      FROM public.ga4_events e
     CROSS JOIN bornes b
     WHERE e.date < b.aujourdhui
       AND btrim(coalesce(e.campaign, '')) <> ''
       AND e.event_name <> ''
     GROUP BY e.user_id, lower(btrim(e.campaign)), e.event_name
),

-- ── 5) UN NOM DE CAMPAGNE, UNE FOIS ────────────────────────────────────────
-- Google Analytics n'attribue pas son revenu à UNE campagne : il l'attribue à
-- un NOM d'UTM. Deux campagnes qui portent le même nom — une Meta et une Google
-- taguées pareil, ou deux campagnes Meta qui ne diffèrent que par la casse —
-- ne sont pas deux sources de revenu, c'est le même revenu vu deux fois.
--
-- ⚠ CE N'EST PAS CE QUE FAISAIT `build_matrix`. Elle donnait à CHAQUE campagne
-- le revenu de son nom, puis les additionnait dans le thème : trois campagnes
-- homonymes triplaient le revenu, donc le ROAS, donc le Verdict rendu dessus.
-- Mesuré sur le jeu de vérification : 1 560 CHF affichés pour 520 CHF
-- réellement attribués. Un chiffre fabriqué est un chiffre fabriqué même quand
-- c'est l'ancien code qui le fabriquait (CLAUDE.md §7) — la vue compte le nom
-- une fois. C'est le motif pour lequel le ticket 17 en fait la SEULE source du
-- revenu d'un thème.
noms AS NOT MATERIALIZED (
    SELECT DISTINCT user_id, label, nom_norm FROM campagnes
),

-- ── 6) LA conversion que le client a désignée pour un thème ─────────────────
-- Quand un thème a un événement « principal » MESURÉ ET DOTÉ D'UNE VALEUR, cette
-- valeur remplace le revenu générique du compte pour ce thème : sinon la même
-- campagne « achat » gonfle le ROAS d'un thème « newsletter » qui n'a jamais
-- vendu.
--
-- LA CONDITION PORTE SUR LA VALEUR, JAMAIS SUR LE NOMBRE. Un principal mesuré
-- mais sans valeur (generate_lead, sign_up, contact…) — le cas majoritaire hors
-- e-commerce — ne remplace RIEN : il n'a aucun franc à donner, et écrire 0 CHF
-- affirmerait un revenu nul alors que GA4 attribue peut-être un vrai revenu à
-- ces mêmes campagnes. Bug déjà payé une fois : « ROAS 0.0 » publié pour un
-- thème dont les 40 leads mesurés prouvaient le contraire.
revenu_choisi AS NOT MATERIALIZED (
    SELECT c.user_id,
           c.label,
           sum(ev.value) AS value
      FROM noms c
      JOIN public.theme_ga4_events tge
        ON tge.user_id = c.user_id
       AND tge.label = c.label
       AND tge.rang = 'principal'
      JOIN ga4_evenements ev
        ON ev.user_id = c.user_id
       AND ev.nom_norm = c.nom_norm
       AND ev.event_name = tge.event_name
     WHERE EXISTS (SELECT 1 FROM ga4_present p WHERE p.user_id = c.user_id)
     GROUP BY c.user_id, c.label
),

-- ── 7) Le côté payant d'un thème ───────────────────────────────────────────
-- La DÉPENSE se somme par campagne — chaque régie mesure la sienne, deux
-- campagnes homonymes ont bien coûté deux fois. Le REVENU se somme par nom,
-- pour la raison du bloc 5.
pub AS NOT MATERIALIZED (
    SELECT c.user_id,
           c.label,
           sum(c.spend)                              AS spend,
           sum(c.clicks)                             AS clicks,
           sum(c.impressions)                        AS impressions
      FROM campagnes c
     GROUP BY c.user_id, c.label
),

revenu_generique AS NOT MATERIALIZED (
    SELECT n.user_id,
           n.label,
           -- Un nom que GA4 ne rattache pas n'apporte rien ; il ne rend pas le
           -- total du thème inconnu pour autant.
           sum(coalesce(r.revenue, 0))               AS revenue
      FROM noms n
      LEFT JOIN ga4_revenu r
        ON r.user_id = n.user_id
       AND r.nom_norm = n.nom_norm
     GROUP BY n.user_id, n.label
),

-- ── 8) Le côté organique d'un thème ────────────────────────────────────────
-- Un post porte PLUSIEURS thèmes (colonne `labels`) : il compte pour chacun.
-- Une portée absente compte pour 0 dans la moyenne — c'est ce que fait déjà
-- `build_matrix`, et le diviseur reste le nombre de publications.
--
-- ⚠ LE `::numeric` N'EST PAS DÉCORATIF. `count(*)` rend un `bigint`, et la
-- portée est un compte : `sum(bigint) / count(*)` est une DIVISION ENTIÈRE en
-- PostgreSQL. Une portée moyenne de 1 234,7 s'afficherait 1 234 — un chiffre
-- faux qui a l'air juste, sur une colonne dont le type ne vit pas dans ce
-- dépôt (`instagram_organic_posts` est antérieure aux migrations).
posts AS NOT MATERIALIZED (
    SELECT p.user_id,
           lbl                                        AS label,
           count(*)::integer                          AS posts,
           sum(coalesce(p.reach, 0))::numeric / count(*)  AS reach_avg,
           sum(coalesce(p.eng, 0))::numeric   / count(*)  AS eng_avg
      FROM public.instagram_organic_posts p
     CROSS JOIN LATERAL unnest(p.labels) AS lbl
     CROSS JOIN bornes b
     WHERE p.labels IS NOT NULL
       AND (p.date AT TIME ZONE 'Europe/Zurich')::date < b.aujourdhui
       AND lbl <> ''
     GROUP BY p.user_id, lbl
),

-- ── 9) Les deux côtés réunis ───────────────────────────────────────────────
-- LA LISTE DES THÈMES D'ABORD, LEURS CHIFFRES ENSUITE — et c'est une question
-- de performance, pas de style. Un `FULL OUTER JOIN` entre le payant et
-- l'organique aurait donné un `user_id` issu d'un `coalesce()` des deux côtés :
-- PostgreSQL ne sait alors plus de quelle table vient la colonne, et le filtre
-- `WHERE user_id = …` de l'appelant reste tout en haut au lieu de descendre
-- jusqu'aux tables. Mesuré sur 300 comptes × 120 jours : 36 000 lignes lues et
-- agrégées pour en rendre UNE. Avec un `UNION`, la colonne est une vraie
-- colonne et le filtre descend dans les deux branches.
--
-- Même raison pour les `NOT MATERIALIZED` ci-dessus : une CTE lue deux fois est
-- matérialisée par défaut depuis PostgreSQL 12, et une CTE matérialisée est un
-- mur que le filtre ne franchit pas. Cette vue est lue À CHAQUE affichage —
-- c'est tout son intérêt — donc elle ne peut pas lire la table entière.
cles AS NOT MATERIALIZED (
    SELECT user_id, label FROM pub
    UNION
    SELECT user_id, label FROM posts
),

themes AS NOT MATERIALIZED (
    SELECT k.user_id,
           k.label,
           round(coalesce(pub.spend, 0), 2)      AS spend,
           coalesce(pub.clicks, 0)               AS clicks,
           coalesce(pub.impressions, 0)          AS impressions,
           coalesce(posts.posts, 0)              AS posts,
           posts.reach_avg                       AS reach_avg,
           posts.eng_avg                         AS eng_avg,
           rg.revenue                            AS revenue_generique
      FROM cles k
      LEFT JOIN pub
        ON pub.user_id = k.user_id AND pub.label = k.label
      LEFT JOIN revenu_generique rg
        ON rg.user_id = k.user_id AND rg.label = k.label
      LEFT JOIN posts
        ON posts.user_id = k.user_id AND posts.label = k.label
)
SELECT t.user_id,
       t.label,
       t.spend,
       t.clicks,
       t.impressions,
       CASE WHEN t.impressions > 0
            THEN round(t.clicks::numeric / t.impressions * 100, 2)
       END                                              AS ctr,
       t.posts,
       round(t.reach_avg, 1)                            AS reach_avg,
       round(t.eng_avg, 2)                              AS eng_avg,
       round(rev.montant, 2)                            AS revenue,
       -- LE SEUIL DE JUGEMENT, sur la dépense DÉJÀ ARRONDIE : c'est l'ordre que
       -- suivait `build_matrix`, et 99,995 CHF ne doit pas être jugé ici et
       -- ignoré ailleurs.
       (t.spend >= 100) AS juge,
       CASE WHEN t.spend >= 100 AND rev.montant IS NOT NULL
            -- Revenu NON arrondi au numérateur, dépense arrondie au
            -- dénominateur — là encore l'ordre de `build_matrix`.
            THEN round(rev.montant / t.spend, 2)
       END                                              AS roas
  FROM themes t
  LEFT JOIN revenu_choisi rc
    ON rc.user_id = t.user_id
   AND rc.label   = t.label
 CROSS JOIN LATERAL (
     SELECT CASE
              WHEN NOT EXISTS (SELECT 1 FROM ga4_present p WHERE p.user_id = t.user_id)
                   THEN NULL
              -- La conversion choisie prend la place du revenu générique — mais
              -- seulement si elle a des francs à donner.
              WHEN rc.value > 0 THEN rc.value
              ELSE coalesce(t.revenue_generique, 0)
            END AS montant
 ) rev;

COMMENT ON VIEW public.theme_regroupement IS
    'Le total par thème, recalculé à la lecture sur tout l''historique moins la '
    'journée en cours. Source unique du revenu et du ROAS d''un thème, seuil de '
    'jugement compris (`juge`). Voir .scratch/construction/issues/04-vue-sql-du-regroupement.md.';

-- ── Les droits ──────────────────────────────────────────────────────────────
-- `security_invoker = true` fait lire la vue AVEC les droits de l'appelant :
-- les politiques RLS des tables de base s'appliquent, donc un membre invité ne
-- voit que les comptes auxquels `a_acces()` lui ouvre la porte. Sans cette
-- option, la vue lirait avec les droits de son propriétaire et montrerait les
-- chiffres de tout le monde.
--
-- ⚠ LE WORKER, LUI, PASSE PAR LA CLÉ DE SERVICE : la RLS ne le filtre pas. Sa
-- lecture DOIT porter son propre `user_id` — c'est fait dans
-- `fetch_theme_regroupement` (`saas/commun/fetch_data.py`), pas ici.
--
-- Les rôles sont vérifiés plutôt que supposés : ce fichier doit pouvoir se
-- jouer sur un PostgreSQL nu (harnais de vérification), où `anon` n'existe pas.
DO $$
DECLARE
    r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('GRANT SELECT ON public.theme_regroupement TO %I', r);
        ELSE
            RAISE NOTICE 'rôle % absent — GRANT sauté', r;
        END IF;
    END LOOP;
END $$;
