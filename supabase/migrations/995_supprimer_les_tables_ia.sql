-- ============================================================================
-- 995_supprimer_les_tables_ia.sql
--
-- ⚠️  CE FICHIER DÉTRUIT DES DONNÉES, DÉFINITIVEMENT, ET SANS RETOUR.
--     Il n'est PAS inclus dans `000_run_me_all.sql` et ne doit jamais l'être :
--     le fichier unique installe, celui-ci démolit. Il se joue UNE FOIS, à la
--     main, après relecture.
--
-- ────────────────────────────────────────────────────────────────────────────
-- POURQUOI
--
-- `ai_recommendations` et `ai_feedback` viennent de l'ancien Streamlit
-- (commit 177762b, recommandations générées par Apertus/HuggingFace). Pulse
-- ne conseille plus rien depuis le 2026-09-21 et n'appelle plus aucun modèle
-- de langage. Mesuré le 2026-10-07 : aucune référence dans `saas/`, aucune
-- fonction ni vue qui les lise ; 7 lignes dans `ai_recommendations`, 0 dans
-- `ai_feedback`. David, le 2026-10-07 : elles partent.
--
-- ────────────────────────────────────────────────────────────────────────────
-- CE QU'IL SUPPRIME
--
--   `ai_feedback` d'abord : sa clé étrangère pointe vers `ai_recommendations`.
--   `ai_recommendations` ensuite.
--
-- Pas de `CASCADE`, pour la raison écrite dans la `998` : une dépendance
-- oubliée fait échouer le fichier, et comme tout est dans une transaction,
-- RIEN n'est supprimé.
-- ============================================================================

BEGIN;

DROP TABLE IF EXISTS public.ai_feedback;
DROP TABLE IF EXISTS public.ai_recommendations;

COMMIT;

-- PostgREST garde en cache le schéma d'avant : sans ce rechargement, une
-- requête vers une table disparue peut répondre comme si elle existait
-- encore, le temps que le cache se renouvelle seul.
NOTIFY pgrst, 'reload schema';

-- ────────────────────────────────────────────────────────────────────────────
-- CONTRÔLE — à jouer après, SEUL (le SQL editor n'affiche que la dernière
-- instruction). Les deux lignes doivent dire « ✓ ».

SELECT o.nom AS objet,
       CASE WHEN to_regclass('public.' || o.nom) IS NULL
            THEN '✓ supprimée' ELSE '✗ ENCORE LÀ' END AS etat
FROM (VALUES ('ai_feedback'), ('ai_recommendations')) AS o(nom);
