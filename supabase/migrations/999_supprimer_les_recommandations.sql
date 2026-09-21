-- ============================================================================
-- 999_supprimer_les_recommandations.sql
--
-- ⚠️  CE FICHIER DÉTRUIT DES DONNÉES, DÉFINITIVEMENT, ET SANS RETOUR.
--     Il n'est PAS inclus dans `000_run_me_all.sql` et ne doit jamais l'être :
--     le fichier unique installe, celui-ci démolit. Il se joue UNE FOIS, à la
--     main, après relecture — et après une sauvegarde de la base si tu tiens
--     à ce qu'il y a dedans.
--
-- ────────────────────────────────────────────────────────────────────────────
-- CE QU'IL SUPPRIME, ET POURQUOI
--
-- Le moteur de recommandations de Pulse a été retiré du produit : plus de
-- conseils, plus de règles payantes, plus de constats « ce qui marche », plus
-- de brief rédigé par Gemini, plus de suivi d'actions, plus de carnet. Ce qui
-- reste est ce qui se mesure. Le code qui lisait et écrivait ces trois tables
-- a disparu avec lui — plus rien dans le dépôt ne les nomme.
--
--   `reco_feedback`  — les réactions à un conseil (utile / pas pour moi /
--                      fait / trop compliqué) et leurs commentaires.
--   `suivi_actions`  — « ▶ Je le teste », les verdicts à quatorze jours, et
--                      les Notes du Carnet.
--   `theme_plan`     — l'hypothèse active d'un thème et sa mémoire narrative.
--
-- ────────────────────────────────────────────────────────────────────────────
-- CE QU'IL NE SUPPRIME PAS, ET C'EST DÉLIBÉRÉ
--
-- `insight_feedback` RESTE. Elle portait deux choses : les verdicts ✓/✗ sur
-- les constats (morts avec eux) ET **les thèmes prioritaires étoilés**, rangés
-- sous la clé `priority_label:<nom>`. Ces étoiles sont le cœur du produit —
-- c'est le client qui désigne ses priorités (`CLAUDE.md` §1, ADR 0003) — et
-- `created_at` y porte leur ordre d'ancienneté. La détruire effacerait les
-- priorités de tous les comptes.
--
-- Les lignes de verdict qui y dorment encore ne gênent personne : plus rien ne
-- les lit. Le bloc optionnel en bas les efface si tu veux la table nette.
--
-- `weekly_reports` RESTE aussi : le rapport hebdo continue d'être publié, sans
-- ses conseils. Ses payloads déjà écrits gardent les clés mortes (`recos`,
-- `brief`, `tracking`…) ; plus personne ne les lit, elles s'éteignent d'
-- elles-mêmes à la prochaine publication.
--
-- `profiles.user_profile` et `profiles.user_profile_updated_at` RESTENT. Ces
-- deux colonnes portaient le persona rédigé par l'IA. Les retirer est une
-- perte de données sur une table vivante, pour gagner deux colonnes nulles :
-- le rapport bénéfice/risque ne le justifie pas. Elles ne sont plus écrites.
-- ============================================================================

BEGIN;

-- Le déclencheur qui figeait l'auteur d'une Note. Il disparaîtrait avec la
-- table (`DROP TABLE` emporte ses déclencheurs), mais pas la FONCTION qu'il
-- appelle : elle vit au niveau du schéma et resterait orpheline.
DROP TRIGGER IF EXISTS trg_suivi_actions_auteur_fige ON public.suivi_actions;
DROP FUNCTION IF EXISTS public.suivi_actions_auteur_fige();

-- `CASCADE` emporte index, contraintes, politiques RLS et déclencheurs de
-- chaque table. Aucune vue ni clé étrangère ne pointe vers ces trois-là — la
-- vue `theme_regroupement` (§24) n'agrège que les régies, l'organique et GA4.
DROP TABLE IF EXISTS public.reco_feedback CASCADE;
DROP TABLE IF EXISTS public.suivi_actions CASCADE;
DROP TABLE IF EXISTS public.theme_plan    CASCADE;

COMMIT;


-- ────────────────────────────────────────────────────────────────────────────
-- OPTIONNEL — LES VERDICTS DE CONSTATS QUI DORMENT DANS insight_feedback.
--
-- À NE JOUER QU'EN CONNAISSANCE DE CAUSE, et surtout : le `NOT LIKE` est la
-- seule chose qui protège tes étoiles. Une faute de frappe dedans efface les
-- priorités de tous les comptes. Relis-le deux fois avant de décommenter.
--
-- DELETE FROM public.insight_feedback
--  WHERE insight_key NOT LIKE 'priority_label:%';


-- ────────────────────────────────────────────────────────────────────────────
-- CONTRÔLE — à jouer après, pour lire ce qui reste.
--
-- Les trois premières lignes doivent dire « supprimée ». La quatrième doit
-- dire « présente » : si elle dit autre chose, les priorités sont parties et
-- il faut restaurer la sauvegarde.
SELECT
    o.nom,
    CASE WHEN to_regclass('public.' || o.nom) IS NULL
         THEN '✓ supprimée' ELSE '✗ ENCORE LÀ' END AS etat
FROM (VALUES ('reco_feedback'), ('suivi_actions'), ('theme_plan')) AS o(nom)
UNION ALL
SELECT
    'insight_feedback',
    CASE WHEN to_regclass('public.insight_feedback') IS NOT NULL
         THEN '✓ présente (elle porte tes thèmes prioritaires)'
         ELSE '✗ ABSENTE — tes priorités ont disparu' END;
