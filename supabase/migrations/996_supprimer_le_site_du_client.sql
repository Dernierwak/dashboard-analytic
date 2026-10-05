-- ============================================================================
-- 996_supprimer_le_site_du_client.sql
--
-- ⚠️  CE FICHIER DÉTRUIT DES DONNÉES, DÉFINITIVEMENT, ET SANS RETOUR.
--     Il n'est PAS inclus dans `000_run_me_all.sql` et ne doit jamais l'être :
--     le fichier unique installe, celui-ci démolit. Il se joue UNE FOIS, à la
--     main, après relecture.
--
--     Les adresses déjà saisies par les clients sont perdues, sans archive —
--     même règle que le thème et `landing_url` (`998`).
--
-- ────────────────────────────────────────────────────────────────────────────
-- POURQUOI
--
-- `profiles.site_url` se saisissait à l'onboarding et sur `/comptes`. Sa seule
-- raison d'exister était les conseils (« ce qui sépare un conseil générique
-- d'un conseil qui parle de ce que la personne vend »), et Pulse ne conseille
-- plus rien depuis le 2026-09-21. Mesuré le 2026-10-03 : aucune lecture hors
-- de l'écran qui la réaffichait. David, le 2026-10-05 : elle part
-- (`.scratch/meta-ads/tickets/34-le-site-du-client-ne-sert-plus-a-rien.md`).
--
-- ────────────────────────────────────────────────────────────────────────────
-- QUAND LE JOUER — PAS AVANT QUE LE CODE SOIT DÉPLOYÉ
--
-- Le code qui lisait et écrivait la colonne part d'abord, la base ensuite.
-- Joué trop tôt, ce fichier fait échouer la page `/comptes` déployée, qui lit
-- encore `site_url`. Attendre que `main` soit déployé sur Vercel. Le worker,
-- lui, ne l'a jamais lue.
--
-- ────────────────────────────────────────────────────────────────────────────
-- CE QU'IL SUPPRIME
--
--   La contrainte `profiles_site_url_ck` — elle partirait avec la colonne ; la
--               nommer rend le fichier lisible sans connaître la règle.
--   La colonne  `profiles.site_url`.
--
-- Pas de `CASCADE`, pour la raison écrite dans la `998` : une dépendance
-- oubliée fait échouer le fichier, et comme tout est dans une transaction,
-- RIEN n'est supprimé.
-- ============================================================================

BEGIN;

ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_site_url_ck;

ALTER TABLE public.profiles
    DROP COLUMN IF EXISTS site_url;

COMMIT;

-- PostgREST garde en cache le schéma d'avant : sans ce rechargement, une
-- requête vers une colonne disparue peut répondre comme si elle existait
-- encore, le temps que le cache se renouvelle seul.
NOTIFY pgrst, 'reload schema';

-- ────────────────────────────────────────────────────────────────────────────
-- CONTRÔLE — à jouer après, SEUL (sélectionne du `SELECT` au `;` final et
-- Cmd/Ctrl+Entrée : le SQL editor n'affiche que la dernière instruction).
-- Les deux lignes doivent dire « ✓ ». La seconde vérifie que `profiles`, elle,
-- est toujours là.

SELECT 'profiles.site_url' AS objet,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns c
                          WHERE c.table_schema = 'public'
                            AND c.table_name   = 'profiles'
                            AND c.column_name  = 'site_url')
            THEN '✗ ENCORE LÀ' ELSE '✓ supprimée' END AS etat
UNION ALL
SELECT 'profiles',
       CASE WHEN to_regclass('public.profiles') IS NOT NULL
            THEN '✓ présente' ELSE '✗ ABSENTE' END;
