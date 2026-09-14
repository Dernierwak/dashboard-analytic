-- LE DÉCOR QUE SUPABASE POSE, ET QU'AUCUNE MIGRATION DU DÉPÔT NE CRÉE.
--
-- Tout le reste du schéma est JOUÉ depuis les vrais fichiers de migration (voir
-- `pg.py`) : ce fichier ne contient que ce qui n'existe dans aucun d'eux. Un
-- harnais qui recopie la règle qu'il vérifie ne vérifie que sa copie.
--
-- `auth.uid()` est LA PERSONNE connectée, et c'est toute la question du ticket
-- 23 : la politique d'insertion partagée ne regarde que le COMPTE
-- (`peut_editer(user_id)`), jamais la personne. On reproduit donc la fonction
-- telle que Supabase la définit — elle lit le jeton de la requête en cours, et
-- rend NULL hors session authentifiée.

-- ⚠ ON REPART D'UNE BASE VIERGE, ET CE N'EST PAS DE LA PRÉCAUTION.
-- Le répertoire de données de pgserver SURVIT d'une exécution à l'autre. Sans
-- ce nettoyage, `suivi_actions` restait celle du run précédent, donc
-- `ADD COLUMN IF NOT EXISTS author_id … REFERENCES auth.users` trouvait la
-- colonne déjà là et NE REPOSAIT PAS SA CLÉ ÉTRANGÈRE — pendant que le
-- `DROP SCHEMA auth CASCADE` ci-dessous venait justement de l'emporter. Le
-- harnais vérifiait alors un schéma que David ne jouera jamais, et le test du
-- départ d'un membre échouait pour une raison inventée par le harnais
-- lui-même. Relevé en construisant le ticket 23.
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
DROP SCHEMA IF EXISTS auth CASCADE;
CREATE SCHEMA auth;

CREATE TABLE auth.users (
    id    uuid PRIMARY KEY,
    email text
);

CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

CREATE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql STABLE AS $$
    SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;

-- Les rôles de PostgREST. `authenticated` est celui sous lequel l'app écrit,
-- donc le seul sous lequel la RLS s'applique vraiment ; `service_role` porte
-- BYPASSRLS parce que c'est ce que Supabase lui donne, et c'est LUI qu'il faut
-- pouvoir montrer intact — le worker hebdo passe par sa clé
-- (`saas/traitement/build_report.py::_service_client`).
DO $$
BEGIN
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT USAGE ON SCHEMA public, auth TO authenticated, anon, service_role;

-- `profiles` n'est créée par aucune migration non plus (posée à la main avant
-- le dossier). La section de partage la traverse : sans elle, sa boucle passe
-- son chemin en silence, et le harnais jouerait une version amputée de ce que
-- David joue vraiment.
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);
