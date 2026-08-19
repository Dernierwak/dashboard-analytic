-- ============================================================================
-- fetch_progress — l'avancement RÉEL de la récolte, écrit par le worker.
--
-- POURQUOI CETTE TABLE EXISTE.
-- La barre de « ↻ Mes données » n'a jamais rien mesuré : `avancement(sec)` dans
-- `fetch-button.tsx` est une exponentielle sur le TEMPS ÉCOULÉ, et la liste
-- `ETAPES` est une suite d'étiquettes horodatées à la main (« Google Ads » à
-- 420 s). Personne n'avait jamais demandé au worker où il en était. Depuis que
-- la récolte tourne en parallèle, ces étiquettes sont fausses par construction :
-- Google et GA4 ne viennent plus après Instagram, ils tournent en même temps.
--
-- Quatre barres bâties sur ce principe auraient fait quatre chiffres fabriqués
-- au lieu d'un. D'où un vrai canal : le worker écrit ici au fil de la récolte,
-- l'écran lit en sondant — exactement comme il sonde déjà l'état du run GitHub.
--
-- CE QU'ELLE NE PROMET PAS. À l'intérieur d'un canal, le nombre d'appels API
-- n'est pas connu d'avance ; `etape` porte donc un nom d'étape franchie, jamais
-- un pourcentage. Seul Instagram peut chiffrer sa boucle, parce que la liste
-- des posts à relire est connue AVANT de commencer.
--
-- UNE LIGNE PAR (utilisateur, canal), réécrite à chaque passage. Pas d'historique :
-- ce que cette table sert, c'est « où en est la récolte MAINTENANT ». L'historique
-- des récoltes, lui, vit déjà dans les runs GitHub Actions.
--
-- Idempotent : ré-exécutable sans erreur. Aucun DROP, aucun DELETE.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.fetch_progress (
    user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    canal      text NOT NULL CHECK (canal IN
                   ('meta', 'instagram', 'google', 'ga4', 'labels', 'rapport')),

    -- L'identifiant du PASSAGE (horodatage ISO du départ, écrit tel quel). Sans
    -- lui, l'écran ne saurait pas distinguer la ligne « fini » d'hier de celle
    -- d'aujourd'hui. C'est du texte trié lexicographiquement : sur un ISO en
    -- UTC, le max est le plus récent, et l'écran n'affiche que ce max-là.
    run_id     text NOT NULL,

    -- 'saute' n'est pas un échec : c'est « ce canal n'a pas été appelé, et voici
    -- pourquoi » (aucune connexion, aucune propriété GA4 choisie…). La
    -- distinction compte — un canal sauté ne se répare pas au même endroit
    -- qu'un canal en échec.
    etat       text NOT NULL CHECK (etat IN
                   ('attente', 'en_cours', 'fini', 'echec', 'saute')),

    -- L'étape franchie DANS le canal, en clair (« budgets », « posts 12/37 »).
    -- Jamais un pourcentage : voir l'en-tête.
    etape      text,

    -- Le mot de la fin — la ligne que le journal du worker imprime déjà
    -- (« meta: 143 lignes », « google KO: … »). On ne la réécrit pas, on la
    -- range.
    mot_de_fin text,

    debut_a    timestamptz,
    fin_a      timestamptz,
    -- La dernière fois que le worker a donné signe de vie SUR CE CANAL. C'est
    -- ce qui permet à l'écran de dire « en cours depuis 4 min » au lieu de
    -- laisser croire qu'il vient de commencer.
    maj_a      timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (user_id, canal)
);

-- L'écran lit toujours « toutes les lignes de CET utilisateur » — la clé
-- primaire suffit, aucun index de plus n'a de raison d'être ici (six lignes par
-- utilisateur au maximum).

ALTER TABLE public.fetch_progress ENABLE ROW LEVEL SECURITY;

-- ── Les politiques ───────────────────────────────────────────────────────────
--
-- Même règle que platform_budgets / platform_changes : on TESTE la présence des
-- fonctions de partage plutôt que de la supposer, pour que cette migration
-- puisse tourner sur une base où la section 12 n'a pas encore été jouée.
--
-- Et contrairement aux migrations plus anciennes, aucun `DROP POLICY` ici : sur
-- une table neuve il n'y a rien à remplacer, et une création gardée par
-- `pg_policies` est tout aussi rejouable sans jamais retirer un accès, même une
-- fraction de seconde. La section 15 de 000_run_me_all.sql, elle, garde son
-- drop/create : c'est elle qui garantit que TOUTES les tables partagées portent
-- exactement les mêmes règles.
--
-- Le worker écrit avec la clé service_role, qui passe au-dessus de la RLS : ces
-- politiques ne décident donc que de la LECTURE par l'écran, et de l'écriture
-- éventuelle depuis le navigateur (qui n'existe pas aujourd'hui).
DO $$
DECLARE
    partage boolean := to_regprocedure('public.a_acces(uuid)') IS NOT NULL
                   AND to_regprocedure('public.peut_editer(uuid)') IS NOT NULL;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname = 'public' AND tablename = 'fetch_progress'
                     AND policyname = 'partage_select') THEN
        IF partage THEN
            CREATE POLICY "partage_select" ON public.fetch_progress
                FOR SELECT USING (public.a_acces(user_id));
        ELSE
            CREATE POLICY "partage_select" ON public.fetch_progress
                FOR SELECT USING (auth.uid() = user_id);
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname = 'public' AND tablename = 'fetch_progress'
                     AND policyname = 'partage_insert') THEN
        IF partage THEN
            CREATE POLICY "partage_insert" ON public.fetch_progress
                FOR INSERT WITH CHECK (public.peut_editer(user_id));
        ELSE
            CREATE POLICY "partage_insert" ON public.fetch_progress
                FOR INSERT WITH CHECK (auth.uid() = user_id);
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname = 'public' AND tablename = 'fetch_progress'
                     AND policyname = 'partage_update') THEN
        IF partage THEN
            CREATE POLICY "partage_update" ON public.fetch_progress
                FOR UPDATE USING (public.peut_editer(user_id))
                WITH CHECK (public.peut_editer(user_id));
        ELSE
            CREATE POLICY "partage_update" ON public.fetch_progress
                FOR UPDATE USING (auth.uid() = user_id)
                WITH CHECK (auth.uid() = user_id);
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname = 'public' AND tablename = 'fetch_progress'
                     AND policyname = 'partage_delete') THEN
        IF partage THEN
            CREATE POLICY "partage_delete" ON public.fetch_progress
                FOR DELETE USING (public.peut_editer(user_id));
        ELSE
            CREATE POLICY "partage_delete" ON public.fetch_progress
                FOR DELETE USING (auth.uid() = user_id);
        END IF;
    END IF;
END $$;
