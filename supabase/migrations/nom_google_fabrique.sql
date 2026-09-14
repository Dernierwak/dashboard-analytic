-- ============================================================================
-- LE NOM FABRIQUÉ D'UNE CAMPAGNE GOOGLE, RENDU À SA VRAIE VALEUR
--
-- Ticket .scratch/construction/issues/43-le-nom-dune-campagne-google-est-fabrique-par-letiqueteuse.md
--
-- ⚠ CE FICHIER RÉÉCRIT DES DONNÉES EXISTANTES — il est le seul du dossier dans
-- ce cas, et il se joue en connaissance de cause (CLAUDE.md §7). Aucun `DROP`,
-- aucun `DELETE`, aucun `TRUNCATE` : un seul `UPDATE`, sur une seule colonne,
-- borné aux lignes dont la valeur actuelle est démontrablement fabriquée.
--
-- CE QU'IL RÉPARE
-- `saas/recos_ia/labeling.py` listait les campagnes Google depuis
-- `google_ads_insights` en ne demandant que `campaign_id`, alors que cette même
-- table porte le `campaign_name` du jour de la récolte. Faute de nom, il
-- fabriquait `Campagne <campaign_id>` et l'upsertait dans
-- `google_campaign_config`. Cette chaîne n'a jamais été émise par Google : GA4
-- ne peut donc pas l'enregistrer en `utm_campaign`, et le revenu de ces
-- campagnes n'a plus aucun thème où se poser.
--
-- Mesuré sur le compte de production le 2026-09-13 : deux campagnes,
-- 808.87 CHF de dépense, dont 352.00 CHF de revenu GA4 réel orphelins. ROAS
-- affiché du thème « Campagne Générale » : 0.00 ; ROAS réel : 0.44.
--
-- La source est corrigée dans `labeling.py` (il n'écrit plus jamais un nom
-- inventé). Ce fichier ne s'occupe que des lignes DÉJÀ écrites — rien d'autre
-- ne les corrigera : leur `effective_status` est NULL, donc
-- `upsert_google_campaign_statuses` ne les a jamais touchées et ne les touchera
-- pas (voir la section « à vérifier séparément » du ticket 43).
--
-- CE QU'IL N'INVENTE PAS
-- Le nom écrit n'est pas déduit : c'est le `campaign_name` le plus récent que
-- la récolte a réellement enregistré pour cet identifiant. S'il n'y en a aucun,
-- la ligne n'est pas touchée — elle reste fausse plutôt que de devenir inventée
-- autrement, et le ticket 18 dit ce que le rapport en fait.
--
-- Idempotent : après un passage, plus aucune ligne ne satisfait le `WHERE`.
-- Rejouable sans risque.
-- ============================================================================

-- ── Ce que le fichier VA changer, avant de le changer ───────────────────────
-- À lire dans la sortie « NOTICE » du SQL Editor. Si le compte est à 0, il n'y
-- a rien à réparer et l'`UPDATE` ci-dessous ne touchera aucune ligne.
DO $$
DECLARE
    n bigint;
BEGIN
    SELECT count(*) INTO n
      FROM public.google_campaign_config cfg
     WHERE cfg.campaign_name = 'Campagne ' || cfg.campaign_id
       AND EXISTS (SELECT 1 FROM public.google_ads_insights g
                    WHERE g.user_id = cfg.user_id
                      AND g.campaign_id = cfg.campaign_id
                      AND btrim(coalesce(g.campaign_name, '')) <> ''
                      AND g.campaign_name <> 'Campagne ' || cfg.campaign_id);
    RAISE NOTICE 'nom_google_fabrique : % ligne(s) à réparer', n;
END $$;

-- ── La réparation ───────────────────────────────────────────────────────────
-- Le `WHERE` porte sur l'ÉGALITÉ EXACTE avec `'Campagne ' || campaign_id` : une
-- campagne que le client aurait lui-même nommée « Campagne d'automne » n'y
-- répond pas. C'est ce qui rend l'`UPDATE` sûr — on ne réécrit que la chaîne
-- que nous avons nous-mêmes fabriquée, caractère pour caractère.
UPDATE public.google_campaign_config cfg
   SET campaign_name = reel.nom
  FROM (
        SELECT DISTINCT ON (g.user_id, g.campaign_id)
               g.user_id,
               g.campaign_id,
               g.campaign_name AS nom
          FROM public.google_ads_insights g
         WHERE btrim(coalesce(g.campaign_name, '')) <> ''
         -- Le nom le plus RÉCENT : la récolte garde celui du jour, donc après
         -- un renommage l'historique porte les deux.
         ORDER BY g.user_id, g.campaign_id, g.date_start DESC
       ) AS reel
 WHERE reel.user_id = cfg.user_id
   AND reel.campaign_id = cfg.campaign_id
   AND cfg.campaign_name = 'Campagne ' || cfg.campaign_id
   AND reel.nom <> 'Campagne ' || cfg.campaign_id;

-- ── Ce qu'il reste, s'il reste quelque chose ────────────────────────────────
-- Une ligne encore fabriquée après ce passage est une campagne dont AUCUNE
-- récolte n'a jamais retenu le nom. On ne la touche pas : on ne sait pas.
DO $$
DECLARE
    n bigint;
BEGIN
    SELECT count(*) INTO n
      FROM public.google_campaign_config cfg
     WHERE cfg.campaign_name = 'Campagne ' || cfg.campaign_id;
    IF n > 0 THEN
        RAISE NOTICE 'nom_google_fabrique : % ligne(s) sans nom récolté, laissées telles quelles', n;
    ELSE
        RAISE NOTICE 'nom_google_fabrique : plus aucun nom fabriqué en base';
    END IF;
END $$;
