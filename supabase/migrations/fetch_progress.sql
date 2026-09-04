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
-- Rejouable sans erreur : la table (`CREATE TABLE IF NOT EXISTS`) n'est jamais
-- recréée et aucune donnée n'est jamais supprimée (aucun DELETE). Les 4
-- policies de partage, elles, sont recréées à chaque passage via
-- `DROP POLICY IF EXISTS` + `CREATE POLICY` — voir plus bas pourquoi.
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
-- DROP POLICY IF EXISTS avant chaque CREATE — et c'est un revirement sur ce
-- fichier : la version précédente ne créait QUE si la policy manquait, au nom
-- d'un « rejouable sans jamais retirer un accès ». Le raisonnement avait un
-- trou : « rejouable » n'est pas « convergent », et ce trou ne se voit que
-- quand ce fichier est rejoué SEUL. Si ce fichier a un jour été exécuté seul,
-- avant que la section 12 n'existe encore (`partage` à faux), il a posé un
-- repli `auth.uid() = user_id` — et un rejeu ultérieur de ce même fichier,
-- isolément, ne le remplaçait JAMAIS, puisque la policy « existait déjà » au
-- sens de la garde `pg_policies`. Un tel repli n'empêche rien pour le
-- propriétaire (`auth.uid() = user_id` reste vrai pour lui), mais renvoie une
-- table vide, sans un octet d'accès, à quiconque n'est QUE invité sur ce
-- compte — silencieusement, sans jamais se corriger tout seul tant que seul
-- ce fichier est rejoué. Le bundle 000_run_me_all.sql, lui, n'a jamais eu ce
-- trou : sa section 15 traite déjà `fetch_progress` comme toutes les autres
-- tables partagées, sans garde `pg_policies`, en DROP+CREATE à chaque passage
-- — c'est CE fichier isolé qu'on aligne maintenant sur ce que le bundle fait
-- déjà. Chaque rejeu ramène la policy à sa définition ACTUELLE, jamais à
-- celle qui existait au premier passage. La fenêtre sans policy entre le DROP
-- et le CREATE dure une fraction de commande SQL et échoue fermé (RLS activée
-- + aucune policy = aucune ligne visible) : jamais un accès en trop.
--
-- Le worker écrit avec la clé service_role, qui passe au-dessus de la RLS : ces
-- politiques ne décident donc que de la LECTURE par l'écran, et de l'écriture
-- éventuelle depuis le navigateur (qui n'existe pas aujourd'hui).
DO $$
DECLARE
    partage boolean := to_regprocedure('public.a_acces(uuid)') IS NOT NULL
                   AND to_regprocedure('public.peut_editer(uuid)') IS NOT NULL;
BEGIN
    DROP POLICY IF EXISTS "partage_select" ON public.fetch_progress;
    IF partage THEN
        CREATE POLICY "partage_select" ON public.fetch_progress
            FOR SELECT USING (public.a_acces(user_id));
    ELSE
        CREATE POLICY "partage_select" ON public.fetch_progress
            FOR SELECT USING (auth.uid() = user_id);
    END IF;

    DROP POLICY IF EXISTS "partage_insert" ON public.fetch_progress;
    IF partage THEN
        CREATE POLICY "partage_insert" ON public.fetch_progress
            FOR INSERT WITH CHECK (public.peut_editer(user_id));
    ELSE
        CREATE POLICY "partage_insert" ON public.fetch_progress
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    DROP POLICY IF EXISTS "partage_update" ON public.fetch_progress;
    IF partage THEN
        CREATE POLICY "partage_update" ON public.fetch_progress
            FOR UPDATE USING (public.peut_editer(user_id))
            WITH CHECK (public.peut_editer(user_id));
    ELSE
        CREATE POLICY "partage_update" ON public.fetch_progress
            FOR UPDATE USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;

    DROP POLICY IF EXISTS "partage_delete" ON public.fetch_progress;
    IF partage THEN
        CREATE POLICY "partage_delete" ON public.fetch_progress
            FOR DELETE USING (public.peut_editer(user_id));
    ELSE
        CREATE POLICY "partage_delete" ON public.fetch_progress
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- fetch_progress est une table neuve : Supabase recharge normalement le cache
-- de schéma de PostgREST après un DDL passé par le SQL editor — c'est ainsi
-- que meta_ads_insights, platform_budgets, ga4_events… répondent déjà en REST
-- sans qu'aucune migration antérieure n'ait jamais posé de NOTIFY. Mais ce
-- rechargement automatique n'est pas garanti instantané ni infaillible ; s'il
-- prend du retard ou ne se déclenche pas pour cette table précise, TOUTE
-- requête REST vers elle échoue en attendant avec PGRST205 (« table
-- introuvable ») alors qu'elle existe bel et bien en base, y compris avec la
-- clé service_role : cette clé fait sauter la RLS, pas ce cache-là.
--
-- Ça veut dire que le worker aurait échoué à écrire ici exactement comme
-- l'écran échoue à lire — mais silencieusement pour lui : `Suivi._ecrire`
-- (saas/collecte/automatisation/suivi.py) attrape l'exception et ne l'imprime que dans le
-- journal du run GitHub, jamais à l'écran. Le reste de la récolte, lui,
-- continue d'écrire sans problème : Meta Ads, Google Ads, GA4, Instagram
-- vivent dans des tables anciennes, déjà connues du cache. C'est cohérent
-- avec le symptôme rapporté : la récolte aboutit, mais le panneau de détail
-- par plateforme reste vide ou en « indisponible » tant que ce cache n'a pas
-- été rechargé. NOTIFY force ce rechargement explicitement, sans dépendre de
-- ce que le rechargement automatique se soit bien déclenché — commande
-- standard, non destructive.
NOTIFY pgrst, 'reload schema';
