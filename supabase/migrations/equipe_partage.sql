-- ============================================================================
-- PARTAGE D'ACCÈS — inviter quelqu'un sur son dashboard.
--
-- Le principe : les données restent rangées sous le user_id de leur
-- PROPRIÉTAIRE. On n'en duplique aucune. On élargit seulement la règle de
-- lecture/écriture pour qu'un membre invité voie le compte de celui qui
-- l'a invité.
--
-- Deux rôles :
--   'viewer' — il regarde, il ne touche à rien
--   'editor' — il peut cocher des actions, reclasser des campagnes, choisir
--              des priorités. Il ne peut jamais inviter ni révoquer.
--
-- IMPORTANT — connected_accounts n'est PAS partagée. Elle contient les jetons
-- Meta et Google : les partager donnerait à l'invité les clés des comptes
-- publicitaires en dehors de Pulse. Un membre voit les données récoltées,
-- jamais de quoi les récolter lui-même.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.dashboard_members (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    member_email text NOT NULL,      -- on invite un e-mail, pas un compte : la
                                     -- personne n'a peut-être rien créé encore
    member_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    owner_email  text,             -- pour nommer le compte dans le selecteur
                                   -- (auth.users n'est pas lisible cote client)
    role         text NOT NULL DEFAULT 'editor',   -- 'viewer' | 'editor'
    created_at   timestamptz NOT NULL DEFAULT now(),
    accepted_at  timestamptz,
    CONSTRAINT dashboard_members_role_chk CHECK (role IN ('viewer', 'editor')),
    CONSTRAINT dashboard_members_uq UNIQUE (owner_id, member_email)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_members_member
    ON public.dashboard_members (member_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_members_email
    ON public.dashboard_members (lower(member_email));

ALTER TABLE public.dashboard_members ENABLE ROW LEVEL SECURITY;

-- Le propriétaire gère ses invitations ; le membre voit seulement la sienne.
DROP POLICY IF EXISTS "dm_select" ON public.dashboard_members;
DROP POLICY IF EXISTS "dm_insert" ON public.dashboard_members;
DROP POLICY IF EXISTS "dm_update" ON public.dashboard_members;
DROP POLICY IF EXISTS "dm_delete" ON public.dashboard_members;
CREATE POLICY "dm_select" ON public.dashboard_members
    FOR SELECT USING (auth.uid() = owner_id OR auth.uid() = member_id
                      OR lower(member_email) = lower(auth.jwt() ->> 'email'));
CREATE POLICY "dm_insert" ON public.dashboard_members
    FOR INSERT WITH CHECK (auth.uid() = owner_id);
-- L'update sert à DEUX choses : le propriétaire change un rôle, et l'invité
-- rattache son compte à l'invitation qui porte son e-mail (member_id).
CREATE POLICY "dm_update" ON public.dashboard_members
    FOR UPDATE USING (auth.uid() = owner_id
                      OR lower(member_email) = lower(auth.jwt() ->> 'email'));
CREATE POLICY "dm_delete" ON public.dashboard_members
    FOR DELETE USING (auth.uid() = owner_id);

-- ── Les deux fonctions qui portent toute la règle d'accès ────────────────────
-- SECURITY DEFINER : sans ça, lire dashboard_members depuis la policy d'une
-- autre table repasserait par la RLS de dashboard_members — récursion.

CREATE OR REPLACE FUNCTION public.a_acces(cible uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT cible = auth.uid()
      OR EXISTS (
           SELECT 1 FROM public.dashboard_members m
           WHERE m.owner_id = cible
             AND m.member_id = auth.uid()
         );
$$;

CREATE OR REPLACE FUNCTION public.peut_editer(cible uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT cible = auth.uid()
      OR EXISTS (
           SELECT 1 FROM public.dashboard_members m
           WHERE m.owner_id = cible
             AND m.member_id = auth.uid()
             AND m.role = 'editor'
         );
$$;

GRANT EXECUTE ON FUNCTION public.a_acces(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.peut_editer(uuid) TO authenticated;

-- ── Ouverture des tables de données ─────────────────────────────────────────
-- Une boucle plutôt que 15 blocs recopiés : même règle partout, impossible
-- d'en oublier une ou d'en écrire une de travers.

DO $$
DECLARE
    t text;
    col text;
    tables text[] := ARRAY[
        'meta_ads_insights', 'google_ads_insights', 'google_ads_ad_insights',
        'instagram_organic_posts', 'followers_history', 'ga4_insights',
        'ga4_events', 'weekly_reports', 'reco_feedback', 'insight_feedback',
        'suivi_actions', 'channel_budgets', 'meta_campaign_config',
        'google_campaign_config', 'meta_campaign_status', 'profiles'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        -- la table existe ?
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                       WHERE table_schema = 'public' AND table_name = t) THEN
            CONTINUE;
        END IF;
        -- profiles se repère par id, les autres par user_id
        col := CASE WHEN t = 'profiles' THEN 'id' ELSE 'user_id' END;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema = 'public' AND table_name = t
                         AND column_name = col) THEN
            CONTINUE;
        END IF;

        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS "partage_select" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "partage_insert" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "partage_update" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "partage_delete" ON public.%I', t);

        EXECUTE format(
            'CREATE POLICY "partage_select" ON public.%I FOR SELECT USING (public.a_acces(%I))', t, col);
        EXECUTE format(
            'CREATE POLICY "partage_insert" ON public.%I FOR INSERT WITH CHECK (public.peut_editer(%I))', t, col);
        EXECUTE format(
            'CREATE POLICY "partage_update" ON public.%I FOR UPDATE USING (public.peut_editer(%I)) WITH CHECK (public.peut_editer(%I))', t, col, col);
        EXECUTE format(
            'CREATE POLICY "partage_delete" ON public.%I FOR DELETE USING (public.peut_editer(%I))', t, col);
    END LOOP;
END $$;

-- Les anciennes policies « own rows » restent en place : PostgreSQL applique
-- les policies d'une même commande en OU, donc elles n'enlèvent aucun droit et
-- garantissent que le propriétaire garde le sien quoi qu'il arrive.
