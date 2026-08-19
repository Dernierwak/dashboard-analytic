-- ============================================================================
-- LES ÉVÉNEMENTS GA4 D'UN THÈME
-- (copie autonome de la section 14bis de 000_run_me_all.sql —
--  exécuter l'un OU l'autre, jamais les deux dans la même session)
--
-- POURQUOI CE FICHIER EXISTE
-- `ga4_events` sait compter les événements par jour × source × medium ×
-- campagne. Elle ne sait PAS lesquels comptent pour QUI : le funnel était une
-- liste de six noms écrits en dur dans `google_script/fetch_ga4.py`
-- (view_item, add_to_cart, begin_checkout, add_payment_info, purchase,
-- generate_lead), devinés pour un site e-commerce standard. Un site qui nomme
-- ses conversions autrement ne remontait rien, en silence.
--
-- Deux objets, et deux besoins qu'il ne faut pas confondre :
--
--   · `profiles.ga4_event_catalog` — LA LISTE des événements que la propriété
--     émet vraiment, rafraîchie à chaque récolte. Un cache, pas une donnée
--     relationnelle : on la lit toujours en entier, pour un seul utilisateur,
--     et on ne la joint jamais. D'où le jsonb.
--
--   · `theme_ga4_events` — LE CHOIX : quels événements de cette liste comptent
--     pour quel thème, et lequel porte le verdict.
--
-- PRIMAIRE / SECONDAIRE EST UN CHOIX, PAS UN IMPORT — et c'est le point qui a
-- décidé de la colonne `rang`. GA4 ne connaît qu'un booléen : un événement est
-- « clé » (key event, l'ancien « conversion ») ou ne l'est pas. La ressource
-- Admin `properties.keyEvents` porte `eventName`, `custom`, `deletable`,
-- `countingMethod`, `defaultValue` — et AUCUN champ primaire/secondaire ; la
-- dimension de reporting `isKeyEvent` est elle aussi binaire.
-- Le couple primaire/secondaire vient de GOOGLE ADS, sur ses actions de
-- conversion (`primary_for_goal` : primaire = utilisée par les enchères,
-- secondaire = observée seulement — support.google.com/google-ads/answer/11461796).
-- Un événement clé GA4 importé dans Google Ads y arrive même en SECONDAIRE par
-- défaut. Importer ce rang voudrait donc dire lire l'API Google Ads, qui parle
-- de campagnes et d'actions de conversion, pas de thèmes Pulse. On le laisse
-- donc au client, par thème — c'est plus honnête et c'est plus utile : le même
-- `purchase` peut porter le verdict d'un thème de vente et n'être qu'un
-- indicateur de contexte sur un thème de notoriété.
--
-- LE LABEL EST STOCKÉ PAR SON NOM, comme partout ailleurs dans Pulse
-- (`meta_campaign_config.label`, `instagram_organic_posts.labels`,
-- `suivi_actions.theme`). Renommer ou supprimer un thème doit donc propager
-- ici aussi — c'est fait dans `renameLabel` / `deleteLabel`
-- (saas/web/app/actions.ts). Sans ça, un thème renommé emporterait ses
-- campagnes et laisserait ses événements orphelins.
--
-- Idempotent : rejouable sans risque. Aucun DROP de table, aucun DELETE.
-- ============================================================================

-- ── 1. Le catalogue — ce que la propriété émet ──────────────────────────────
-- Forme : {"maj": "2026-08-18", "evenements": [{"nom","volume","valeur","cle"}]}
-- `maj` vit DANS le jsonb et non dans une colonne à côté : une colonne nommée
-- `..._refreshed_at` déclencherait le contrôle de sécurité du bundle, qui
-- refuse toute colonne de `profiles` dont le nom contient token/secret/refresh
-- — cette table étant partagée avec les invités.
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS ga4_event_catalog jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ── 2. Le choix — quels événements pour quel thème ──────────────────────────
CREATE TABLE IF NOT EXISTS public.theme_ga4_events (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    label       text NOT NULL,
    event_name  text NOT NULL,
    rang        text NOT NULL DEFAULT 'secondaire',
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT theme_ga4_events_uq UNIQUE (user_id, label, event_name)
);

-- `ADD CONSTRAINT IF NOT EXISTS` n'existe pas pour un CHECK : on rattrape
-- l'erreur de doublon plutôt que de la deviner.
DO $$
BEGIN
    ALTER TABLE public.theme_ga4_events
        ADD CONSTRAINT theme_ga4_events_rang_ck
        CHECK (rang IN ('principal', 'secondaire'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_theme_ga4_events_user
    ON public.theme_ga4_events (user_id, label);

DROP TRIGGER IF EXISTS trg_theme_ga4_events_updated_at ON public.theme_ga4_events;
CREATE TRIGGER trg_theme_ga4_events_updated_at
    BEFORE UPDATE ON public.theme_ga4_events
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 3. RLS ──────────────────────────────────────────────────────────────────
-- Deux jeux de politiques, comme sur toutes les tables de Pulse : « chacun ses
-- lignes » d'abord (elle vaut même sans le partage d'équipe), le partage
-- ensuite. PostgreSQL combine en OU les politiques d'une même commande — le
-- propriétaire garde son accès quoi qu'il arrive.
ALTER TABLE public.theme_ga4_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tge_select_own" ON public.theme_ga4_events;
DROP POLICY IF EXISTS "tge_insert_own" ON public.theme_ga4_events;
DROP POLICY IF EXISTS "tge_update_own" ON public.theme_ga4_events;
DROP POLICY IF EXISTS "tge_delete_own" ON public.theme_ga4_events;
CREATE POLICY "tge_select_own" ON public.theme_ga4_events
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tge_insert_own" ON public.theme_ga4_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tge_update_own" ON public.theme_ga4_events
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tge_delete_own" ON public.theme_ga4_events
    FOR DELETE USING (auth.uid() = user_id);

-- Partage d'équipe — seulement si la section 12 est passée. Sans ce garde, ce
-- fichier joué seul sur une base sans `a_acces()` s'arrêterait ici et laisserait
-- la table sans ses politiques « chacun ses lignes » déjà posées au-dessus.
DO $$
BEGIN
    IF to_regprocedure('public.a_acces(uuid)') IS NULL
       OR to_regprocedure('public.peut_editer(uuid)') IS NULL THEN
        RAISE WARNING
            'a_acces() / peut_editer() absentes : theme_ga4_events reste privée au propriétaire. Joue 000_run_me_all.sql pour ouvrir le partage.';
        RETURN;
    END IF;

    DROP POLICY IF EXISTS "partage_select" ON public.theme_ga4_events;
    DROP POLICY IF EXISTS "partage_insert" ON public.theme_ga4_events;
    DROP POLICY IF EXISTS "partage_update" ON public.theme_ga4_events;
    DROP POLICY IF EXISTS "partage_delete" ON public.theme_ga4_events;

    CREATE POLICY "partage_select" ON public.theme_ga4_events
        FOR SELECT USING (public.a_acces(user_id));
    CREATE POLICY "partage_insert" ON public.theme_ga4_events
        FOR INSERT WITH CHECK (public.peut_editer(user_id));
    CREATE POLICY "partage_update" ON public.theme_ga4_events
        FOR UPDATE USING (public.peut_editer(user_id)) WITH CHECK (public.peut_editer(user_id));
    CREATE POLICY "partage_delete" ON public.theme_ga4_events
        FOR DELETE USING (public.peut_editer(user_id));
END $$;
