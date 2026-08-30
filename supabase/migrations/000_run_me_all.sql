-- ============================================================================
-- 000_run_me_all.sql  —  LE SCHÉMA COMPLET DE PULSE, EN UN SEUL FICHIER.
-- À coller dans Supabase → SQL editor, et à REJOUER à chaque fois qu'on doute.
--
-- ────────────────────────────────────────────────────────────────────────────
-- POURQUOI CE FICHIER A ÉTÉ REPRIS (août 2026)
--
-- Il s'annonçait comme « le fichier unique qui installe tout » et il s'arrêtait
-- à la section 12 — dont le contenu, d'ailleurs, n'était même pas là : un
-- commentaire renvoyait vers `equipe_partage.sql`. Neuf migrations écrites
-- depuis n'y étaient jamais entrées. Le résultat se lit dans l'usage : on
-- découvrait chaque colonne manquante par un message d'erreur, une
-- fonctionnalité à la fois (« Enregistrement impossible — rejoue le SQL
-- site_client.sql »), sans jamais savoir combien il en restait derrière.
--
-- Un document qui prétend être la source d'installation et qui ment coûte plus
-- cher que pas de document du tout : on lui fait confiance. Ce fichier reprend
-- donc TOUT le contenu du dossier `supabase/migrations/`, dans l'ordre où les
-- dépendances l'exigent.
--
-- ────────────────────────────────────────────────────────────────────────────
-- CE QU'IL INSTALLE
--
--   0)     Socle publicitaire : meta_ads_insights, meta_campaign_config,
--          google_ads_insights, google_campaign_config
--   1)     profiles.labels — la liste maîtresse unique (Meta + Google + Insta)
--   2)     GA4 : ga4_insights (+ campagne UTM) et ga4_events (funnel)
--   3)     reco_feedback + profiles.objectif + persona IA + fetch_schedule
--   3bis)  google_ads_ad_insights — le détail par annonce
--   3ter)  channel_budgets — le budget saisi, par mois et par canal
--   4)     Tous les jetons Google dans connected_accounts (provider='google')
--   6)     weekly_reports — le rapport hebdo précalculé
--   7)     Onboarding express (secteur, budget, temps, frustration)
--   8)     label_source + insight_feedback — la labellisation IA validable
--   9→11)  suivi_actions — « Je le teste », done_at, detail
--   12)    Partage d'accès : dashboard_members + a_acces() / peut_editer()
--   13)    platform_budgets — le budget PLANIFIÉ, relevé par relevé
--   14)    platform_changes — ce que les plateformes déclarent avoir changé
--   14bis) theme_ga4_events + profiles.ga4_event_catalog — les événements GA4
--          rattachés à un thème. AVANT la section 15, qui doit la partager.
--   14ter) fetch_progress — l'avancement RÉEL de la récolte, canal par canal.
--          AVANT la section 15 elle aussi, même raison.
--   14quater) theme_objectifs — l'objectif propre d'un thème prioritaire, quand
--          il diffère de celui du compte. AVANT la section 15, même raison.
--   15)    Partage : la liste COMPLÈTE des tables, et le contrôle des jetons
--   16)    Dates déclarées des campagnes (start_date / end_date)
--   17)    landing_url — la page d'arrivée d'une campagne
--   18)    profiles.site_url — le site du client
--   19)    suivi_actions.kind — tes propres notes dans le fil
--   20)    label_at + triggers — QUAND une étiquette a été posée
--   21)    (volontairement absent — voir la section, il faut ta décision)
--   22)    reco_feedback.theme/title + reco_feedback_uq2 — le contexte d'un
--          feedback (Graphe B, TASK-025)
--   23)    suivi_actions.verdict — le verdict d'une action, persisté (TASK-025)
--
-- ────────────────────────────────────────────────────────────────────────────
-- CE QU'IL SUPPOSE DÉJÀ LÀ
--
-- Quatre tables ne sont créées par aucune migration du dossier : elles datent
-- d'avant, posées à la main dans l'interface Supabase. Ce fichier les MODIFIE
-- sans jamais les créer, et s'arrêtera net si elles manquent :
--     profiles · connected_accounts · instagram_organic_posts · followers_history
--
-- ────────────────────────────────────────────────────────────────────────────
-- IL EST REJOUABLE, ET C'EST LA PROPRIÉTÉ QUI COMPTE
--
-- Une partie de ces fichiers a déjà été jouée à la main, dans le désordre, sur
-- une base qui porte de vraies données. Tout est donc écrit pour qu'un second
-- passage ne casse rien et n'efface rien : `IF NOT EXISTS` partout où PostgreSQL
-- le propose, et le motif `DO $$ … EXCEPTION WHEN duplicate_object THEN NULL`
-- pour ce qui n'en dispose pas (les CHECK). Les trois backfills (labels,
-- label_source, budgets) sont gardés par une condition qui les rend muets au
-- deuxième passage : ils ne réécrasent jamais ce que tu auras saisi entre-temps.
--
-- Une seule instruction de ce fichier retire quelque chose : la section 4
-- supprime de `profiles` les trois colonnes Google APRÈS les avoir recopiées
-- dans `connected_accounts`. Elle est là depuis l'origine, elle a déjà tourné,
-- et elle est signalée sur place.
--
-- ────────────────────────────────────────────────────────────────────────────
-- COMMENT SAVOIR QUE ÇA A MARCHÉ
--
-- Une REQUÊTE DE CONTRÔLE, juste avant la toute fin du fichier, liste toutes
-- les tables, colonnes et fonctions attendues et met en HAUT du résultat ce
-- qui manque encore. Rien à interpréter — si la première ligne affiche « ✓ »,
-- il ne manque rien. Elle vérifie aussi, dans le même tableau, que les jetons
-- Meta/Google ne sont lisibles par aucun membre invité.
--
-- ATTENTION : ce n'est PLUS la dernière instruction du fichier — un
-- `NOTIFY pgrst, 'reload schema'` la suit, pour que PostgREST connaisse tout
-- de suite les tables tout juste créées (voir la note en toute fin de
-- fichier). Or le SQL editor de Supabase n'affiche que le résultat de la
-- TOUTE DERNIÈRE instruction jouée : rejouer le fichier en entier affichera
-- donc « Success. No rows returned », pas le tableau de contrôle. Pour lire
-- ce tableau, sélectionne uniquement le bloc CONTRÔLE ci-dessous (du `WITH
-- attendu` jusqu'au `ORDER BY` qui le termine) et exécute cette sélection
-- seule (Cmd/Ctrl+Entrée sur le texte sélectionné) — APRÈS avoir joué le
-- fichier complet, jamais avant : lue trop tôt, sur une base où tout n'est
-- pas encore installé, elle remonte des ✗ normaux (rien n'a de raison d'être
-- là) qui n'ont rien à voir avec un échec. C'est seulement une fois le
-- fichier entier rejoué que ces mêmes ✗ deviennent le signal utile.
-- ============================================================================

-- Fonction trigger updated_at (réutilisée par plusieurs tables) ---------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- 0) LE SOCLE PUBLICITAIRE — les quatre tables dont tout le reste dépend.
--    Voir meta_ads_insights.sql, meta_campaign_config.sql,
--    meta_campaign_status.sql et google_ads.sql (sources de vérité).
--
--    POURQUOI CETTE SECTION EXISTE, ALORS QU'ELLE EST LA PLUS ANCIENNE.
--    Elle manquait. Le fichier commençait à la section 1 en supposant ces
--    tables déjà là — ce qui est vrai sur la base de production, et faux
--    partout ailleurs. Deux endroits en particulier ne pardonnaient pas :
--      · la section 3ter lit `profiles.meta_budget_global` et
--        `profiles.google_budget_global` pour reprendre les budgets existants ;
--      · la section 8 pose `label_source` sur `meta_campaign_config` et
--        `google_campaign_config`.
--    Sans le socle, ces deux sections échouent — donc tout ce qui suit aussi,
--    l'éditeur SQL de Supabase jouant le fichier d'un bloc.
-- ============================================================================

-- ── Meta Ads : une ligne par annonce × jour ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meta_ads_insights (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date_start    date NOT NULL,
    campaign_name text NOT NULL DEFAULT '',
    adset_name    text NOT NULL DEFAULT '',
    ad_name       text NOT NULL DEFAULT '',
    impressions   integer NOT NULL DEFAULT 0,
    clicks        integer NOT NULL DEFAULT 0,
    reach         integer,
    link_clicks   integer,
    spend         numeric(10, 4) NOT NULL DEFAULT 0,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT meta_ads_insights_uq UNIQUE (user_id, date_start, ad_name)
);

CREATE INDEX IF NOT EXISTS idx_meta_ads_insights_user_date
    ON public.meta_ads_insights (user_id, date_start DESC);

DROP TRIGGER IF EXISTS trg_meta_ads_insights_updated_at ON public.meta_ads_insights;
CREATE TRIGGER trg_meta_ads_insights_updated_at
    BEFORE UPDATE ON public.meta_ads_insights
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.meta_ads_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meta_ads_select_own" ON public.meta_ads_insights;
DROP POLICY IF EXISTS "meta_ads_insert_own" ON public.meta_ads_insights;
DROP POLICY IF EXISTS "meta_ads_update_own" ON public.meta_ads_insights;
DROP POLICY IF EXISTS "meta_ads_delete_own" ON public.meta_ads_insights;
CREATE POLICY "meta_ads_select_own" ON public.meta_ads_insights
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "meta_ads_insert_own" ON public.meta_ads_insights
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "meta_ads_update_own" ON public.meta_ads_insights
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "meta_ads_delete_own" ON public.meta_ads_insights
    FOR DELETE USING (auth.uid() = user_id);

-- ── Meta : la config par campagne (étiquette, budget, statut) ───────────────
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS campaign_labels    text[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS meta_budget_global numeric(12, 2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.meta_campaign_config (
    user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    campaign_name text NOT NULL,
    label         text,
    budget_max    numeric(12, 2) NOT NULL DEFAULT 0,
    updated_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, campaign_name)
);

CREATE INDEX IF NOT EXISTS idx_meta_campaign_config_user
    ON public.meta_campaign_config (user_id);

DROP TRIGGER IF EXISTS trg_meta_campaign_config_updated_at ON public.meta_campaign_config;
CREATE TRIGGER trg_meta_campaign_config_updated_at
    BEFORE UPDATE ON public.meta_campaign_config
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.meta_campaign_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meta_campaign_config_select_own" ON public.meta_campaign_config;
DROP POLICY IF EXISTS "meta_campaign_config_insert_own" ON public.meta_campaign_config;
DROP POLICY IF EXISTS "meta_campaign_config_update_own" ON public.meta_campaign_config;
DROP POLICY IF EXISTS "meta_campaign_config_delete_own" ON public.meta_campaign_config;
CREATE POLICY "meta_campaign_config_select_own" ON public.meta_campaign_config
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "meta_campaign_config_insert_own" ON public.meta_campaign_config
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "meta_campaign_config_update_own" ON public.meta_campaign_config
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "meta_campaign_config_delete_own" ON public.meta_campaign_config
    FOR DELETE USING (auth.uid() = user_id);

-- Le statut Meta de la campagne (ACTIVE / PAUSED / WITH_ISSUES / …), remis à
-- jour à chaque récolte. Voir meta_campaign_status.sql.
ALTER TABLE public.meta_campaign_config
    ADD COLUMN IF NOT EXISTS effective_status text DEFAULT NULL;

-- ── Google Ads : insights par campagne × jour, et config par campagne ───────
CREATE TABLE IF NOT EXISTS public.google_ads_insights (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date_start     date NOT NULL,
    campaign_id    text NOT NULL,
    campaign_name  text NOT NULL DEFAULT '',
    impressions    integer NOT NULL DEFAULT 0,
    clicks         integer NOT NULL DEFAULT 0,
    conversions    numeric(12, 2) NOT NULL DEFAULT 0,
    cost_micros    bigint NOT NULL DEFAULT 0,   -- Google compte en micros (1 CHF = 1 000 000)
    ctr            numeric(8, 4) NOT NULL DEFAULT 0,
    avg_cpc_micros bigint NOT NULL DEFAULT 0,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT google_ads_insights_uq UNIQUE (user_id, date_start, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_google_ads_insights_user_date
    ON public.google_ads_insights (user_id, date_start DESC);

DROP TRIGGER IF EXISTS trg_google_ads_insights_updated_at ON public.google_ads_insights;
CREATE TRIGGER trg_google_ads_insights_updated_at
    BEFORE UPDATE ON public.google_ads_insights
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.google_ads_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "google_ads_select_own" ON public.google_ads_insights;
DROP POLICY IF EXISTS "google_ads_insert_own" ON public.google_ads_insights;
DROP POLICY IF EXISTS "google_ads_update_own" ON public.google_ads_insights;
DROP POLICY IF EXISTS "google_ads_delete_own" ON public.google_ads_insights;
CREATE POLICY "google_ads_select_own" ON public.google_ads_insights
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "google_ads_insert_own" ON public.google_ads_insights
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "google_ads_update_own" ON public.google_ads_insights
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "google_ads_delete_own" ON public.google_ads_insights
    FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.google_campaign_config (
    user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    campaign_id      text NOT NULL,
    campaign_name    text NOT NULL DEFAULT '',
    label            text,
    budget_max       numeric(12, 2) NOT NULL DEFAULT 0,
    effective_status text,
    updated_at       timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_google_campaign_config_user
    ON public.google_campaign_config (user_id);

DROP TRIGGER IF EXISTS trg_google_campaign_config_updated_at ON public.google_campaign_config;
CREATE TRIGGER trg_google_campaign_config_updated_at
    BEFORE UPDATE ON public.google_campaign_config
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.google_campaign_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "google_campaign_config_select_own" ON public.google_campaign_config;
DROP POLICY IF EXISTS "google_campaign_config_insert_own" ON public.google_campaign_config;
DROP POLICY IF EXISTS "google_campaign_config_update_own" ON public.google_campaign_config;
DROP POLICY IF EXISTS "google_campaign_config_delete_own" ON public.google_campaign_config;
CREATE POLICY "google_campaign_config_select_own" ON public.google_campaign_config
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "google_campaign_config_insert_own" ON public.google_campaign_config
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "google_campaign_config_update_own" ON public.google_campaign_config
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "google_campaign_config_delete_own" ON public.google_campaign_config
    FOR DELETE USING (auth.uid() = user_id);

-- Colonnes au niveau du compte, en parallèle des colonnes Meta ci-dessus.
-- La migration d'origine (google_ads.sql) ajoutait ici deux colonnes de plus,
-- google_refresh_token et google_customer_id. Elles ne sont PAS reprises :
-- la section 4 les recrée elle-même juste avant de les recopier dans
-- connected_accounts, puis les retire de profiles. Les poser ici ne ferait que
-- les créer pour les supprimer trente lignes plus bas.
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS google_campaign_labels text[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS google_budget_global   numeric(12, 2) NOT NULL DEFAULT 0;


-- ============================================================================
-- 1) LABELS UNIFIÉS  →  profiles.labels (liste maîtresse Meta+Google+Insta)
-- ============================================================================

-- On garantit la présence des anciennes listes pour un backfill sûr
-- (no-op si elles existent déjà).
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS campaign_labels        text[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS google_campaign_labels text[] DEFAULT '{}';

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS labels text[] NOT NULL DEFAULT '{}';

-- Backfill UNE FOIS : union dédupliquée des anciennes listes (sans vides).
-- Guard `labels = '{}'` → ne réécrase pas ce que l'utilisateur ajoutera ensuite.
UPDATE public.profiles p
SET labels = sub.arr
FROM (
    SELECT id, ARRAY(
        SELECT DISTINCT x
        FROM unnest(
            coalesce(campaign_labels,        '{}'::text[]) ||
            coalesce(google_campaign_labels, '{}'::text[])
        ) AS x
        WHERE x IS NOT NULL AND btrim(x) <> ''
    ) AS arr
    FROM public.profiles
) sub
WHERE p.id = sub.id
  AND (p.labels IS NULL OR p.labels = '{}');


-- ============================================================================
-- 2) GA4  →  table ga4_insights  (1 ligne par date × source/medium)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ga4_insights (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date         date NOT NULL,
    source       text NOT NULL DEFAULT '',
    medium       text NOT NULL DEFAULT '',
    sessions     integer NOT NULL DEFAULT 0,
    conversions  numeric(12, 2) NOT NULL DEFAULT 0,
    revenue      numeric(14, 2) NOT NULL DEFAULT 0,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ga4_insights_uq UNIQUE (user_id, date, source, medium)
);

CREATE INDEX IF NOT EXISTS idx_ga4_insights_user_date
    ON public.ga4_insights (user_id, date DESC);

DROP TRIGGER IF EXISTS trg_ga4_insights_updated_at ON public.ga4_insights;
CREATE TRIGGER trg_ga4_insights_updated_at
    BEFORE UPDATE ON public.ga4_insights
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ga4_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ga4_select_own" ON public.ga4_insights;
DROP POLICY IF EXISTS "ga4_insert_own" ON public.ga4_insights;
DROP POLICY IF EXISTS "ga4_update_own" ON public.ga4_insights;
DROP POLICY IF EXISTS "ga4_delete_own" ON public.ga4_insights;
CREATE POLICY "ga4_select_own" ON public.ga4_insights
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ga4_insert_own" ON public.ga4_insights
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ga4_update_own" ON public.ga4_insights
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ga4_delete_own" ON public.ga4_insights
    FOR DELETE USING (auth.uid() = user_id);


-- ── GA4 v2 : campagne UTM + funnel par événement (voir ga4_events.sql) ───────
ALTER TABLE public.ga4_insights
    ADD COLUMN IF NOT EXISTS campaign text NOT NULL DEFAULT '';
ALTER TABLE public.ga4_insights DROP CONSTRAINT IF EXISTS ga4_insights_uq;
ALTER TABLE public.ga4_insights DROP CONSTRAINT IF EXISTS ga4_insights_uq2;
ALTER TABLE public.ga4_insights
    ADD CONSTRAINT ga4_insights_uq2 UNIQUE (user_id, date, source, medium, campaign);

CREATE TABLE IF NOT EXISTS public.ga4_events (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date         date NOT NULL,
    source       text NOT NULL DEFAULT '',
    medium       text NOT NULL DEFAULT '',
    campaign     text NOT NULL DEFAULT '',
    event_name   text NOT NULL,
    event_count  integer NOT NULL DEFAULT 0,
    event_value  numeric(14, 2) NOT NULL DEFAULT 0,
    created_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ga4_events_uq UNIQUE (user_id, date, source, medium, campaign, event_name)
);
CREATE INDEX IF NOT EXISTS idx_ga4_events_user_date
    ON public.ga4_events (user_id, date DESC);
ALTER TABLE public.ga4_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ga4ev_select_own" ON public.ga4_events;
DROP POLICY IF EXISTS "ga4ev_insert_own" ON public.ga4_events;
DROP POLICY IF EXISTS "ga4ev_update_own" ON public.ga4_events;
DROP POLICY IF EXISTS "ga4ev_delete_own" ON public.ga4_events;
CREATE POLICY "ga4ev_select_own" ON public.ga4_events
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ga4ev_insert_own" ON public.ga4_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ga4ev_update_own" ON public.ga4_events
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ga4ev_delete_own" ON public.ga4_events
    FOR DELETE USING (auth.uid() = user_id);


-- ============================================================================
-- 3) FEEDBACK  →  table reco_feedback + profiles.objectif
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.reco_feedback (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reco_key    text NOT NULL,
    reaction    text NOT NULL,
    week_start  date NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT reco_feedback_uq UNIQUE (user_id, reco_key, week_start)
);

CREATE INDEX IF NOT EXISTS idx_reco_feedback_user
    ON public.reco_feedback (user_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_reco_feedback_updated_at ON public.reco_feedback;
CREATE TRIGGER trg_reco_feedback_updated_at
    BEFORE UPDATE ON public.reco_feedback
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.reco_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reco_feedback_select_own" ON public.reco_feedback;
DROP POLICY IF EXISTS "reco_feedback_insert_own" ON public.reco_feedback;
DROP POLICY IF EXISTS "reco_feedback_update_own" ON public.reco_feedback;
DROP POLICY IF EXISTS "reco_feedback_delete_own" ON public.reco_feedback;
CREATE POLICY "reco_feedback_select_own" ON public.reco_feedback
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "reco_feedback_insert_own" ON public.reco_feedback
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reco_feedback_update_own" ON public.reco_feedback
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reco_feedback_delete_own" ON public.reco_feedback
    FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS objectif text DEFAULT NULL;

-- Commentaire libre attaché à un conseil (peut exister sans réaction) +
-- persona utilisateur dérivé par l'IA (profiles.user_profile). Voir
-- supabase/migrations/user_profile.sql pour le détail.
ALTER TABLE public.reco_feedback
    ADD COLUMN IF NOT EXISTS comment text;
ALTER TABLE public.reco_feedback
    ALTER COLUMN reaction DROP NOT NULL;
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS user_profile            text,
    ADD COLUMN IF NOT EXISTS user_profile_updated_at timestamptz;

-- fetch_schedule : jour par défaut (lundi) + backfill des NULL, sinon le profil
-- n'est jamais fetché par le cron. Voir supabase/migrations/fetch_schedule_default.sql
ALTER TABLE public.profiles
    ALTER COLUMN fetch_schedule SET DEFAULT 'Monday';
UPDATE public.profiles
    SET fetch_schedule = 'Monday'
    WHERE fetch_schedule IS NULL;


-- ============================================================================
-- 3bis) GOOGLE ADS — détail par annonce × jour (drill-down Campagne → Groupe
--       d'annonces → Annonce, mirror Meta). Voir google_ads_ad_insights.sql.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.google_ads_ad_insights (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date_start     date NOT NULL,
    campaign_id    text NOT NULL,
    campaign_name  text NOT NULL DEFAULT '',
    ad_group_id    text NOT NULL,
    ad_group_name  text NOT NULL DEFAULT '',
    ad_id          text NOT NULL,
    ad_name        text NOT NULL DEFAULT '',
    impressions    integer NOT NULL DEFAULT 0,
    clicks         integer NOT NULL DEFAULT 0,
    cost_micros    bigint  NOT NULL DEFAULT 0,
    conversions    numeric(12, 2) NOT NULL DEFAULT 0,
    created_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT google_ads_ad_insights_uq UNIQUE (user_id, date_start, ad_id)
);

CREATE INDEX IF NOT EXISTS idx_gads_ad_insights_user_date
    ON public.google_ads_ad_insights (user_id, date_start DESC);

ALTER TABLE public.google_ads_ad_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gads_ad_select_own" ON public.google_ads_ad_insights;
DROP POLICY IF EXISTS "gads_ad_insert_own" ON public.google_ads_ad_insights;
DROP POLICY IF EXISTS "gads_ad_update_own" ON public.google_ads_ad_insights;
DROP POLICY IF EXISTS "gads_ad_delete_own" ON public.google_ads_ad_insights;
CREATE POLICY "gads_ad_select_own" ON public.google_ads_ad_insights
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "gads_ad_insert_own" ON public.google_ads_ad_insights
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gads_ad_update_own" ON public.google_ads_ad_insights
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gads_ad_delete_own" ON public.google_ads_ad_insights
    FOR DELETE USING (auth.uid() = user_id);


-- ============================================================================
-- 3ter) BUDGETS PAR MOIS — voir channel_budgets.sql (source de vérité).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.channel_budgets (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    channel     text NOT NULL,
    month       date NOT NULL,
    amount      numeric(12, 2) NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT channel_budgets_uq UNIQUE (user_id, channel, month)
);
CREATE INDEX IF NOT EXISTS idx_channel_budgets_user
    ON public.channel_budgets (user_id, month DESC);
DROP TRIGGER IF EXISTS trg_channel_budgets_updated_at ON public.channel_budgets;
CREATE TRIGGER trg_channel_budgets_updated_at
    BEFORE UPDATE ON public.channel_budgets
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.channel_budgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chbud_select_own" ON public.channel_budgets;
DROP POLICY IF EXISTS "chbud_insert_own" ON public.channel_budgets;
DROP POLICY IF EXISTS "chbud_update_own" ON public.channel_budgets;
DROP POLICY IF EXISTS "chbud_delete_own" ON public.channel_budgets;
CREATE POLICY "chbud_select_own" ON public.channel_budgets
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "chbud_insert_own" ON public.channel_budgets
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "chbud_update_own" ON public.channel_budgets
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "chbud_delete_own" ON public.channel_budgets
    FOR DELETE USING (auth.uid() = user_id);

INSERT INTO public.channel_budgets (user_id, channel, month, amount)
SELECT id, 'meta', date_trunc('month', now())::date, meta_budget_global
FROM public.profiles WHERE coalesce(meta_budget_global, 0) > 0
ON CONFLICT (user_id, channel, month) DO NOTHING;
INSERT INTO public.channel_budgets (user_id, channel, month, amount)
SELECT id, 'google', date_trunc('month', now())::date, google_budget_global
FROM public.profiles WHERE coalesce(google_budget_global, 0) > 0
ON CONFLICT (user_id, channel, month) DO NOTHING;


-- ============================================================================
-- 4) TOKENS UNIFIÉS  →  tout dans connected_accounts (provider='google')
--    On déplace google_refresh_token / google_customer_id / ga4_property_id
--    de profiles vers connected_accounts, puis on supprime les colonnes profiles.
-- ============================================================================

-- On garantit la présence des colonnes SOURCE sur profiles (no-op si déjà là)
-- pour que la copie ci-dessous ne casse jamais, même si les migrations GA4/Google
-- n'avaient pas été passées.
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS google_refresh_token text,
    ADD COLUMN IF NOT EXISTS google_customer_id   text,
    ADD COLUMN IF NOT EXISTS ga4_property_id       text;

-- Nouvelles colonnes sur connected_accounts (le seul endroit pour les tokens).
ALTER TABLE public.connected_accounts
    ADD COLUMN IF NOT EXISTS provider             text NOT NULL DEFAULT 'meta',
    ADD COLUMN IF NOT EXISTS google_refresh_token text,
    ADD COLUMN IF NOT EXISTS google_customer_id   text,
    ADD COLUMN IF NOT EXISTS ga4_property_id       text;

-- Une ligne provider='meta' n'a pas de token Google, et une ligne
-- provider='google' n'a pas de meta_token / instagram_business_id : on relâche
-- les NOT NULL éventuels pour que la ligne google soit insérable.
ALTER TABLE public.connected_accounts ALTER COLUMN meta_token            DROP NOT NULL;
ALTER TABLE public.connected_accounts ALTER COLUMN instagram_business_id DROP NOT NULL;

-- Une seule ligne google par utilisateur.
CREATE UNIQUE INDEX IF NOT EXISTS connected_accounts_google_uniq
    ON public.connected_accounts (user_id) WHERE provider = 'google';

-- Copie de l'existant profiles.* -> ligne provider='google'.
INSERT INTO public.connected_accounts
    (user_id, provider, account_name, google_refresh_token, google_customer_id, ga4_property_id)
SELECT id, 'google', 'Google', google_refresh_token, google_customer_id, ga4_property_id
FROM public.profiles
WHERE google_refresh_token IS NOT NULL
ON CONFLICT (user_id) WHERE provider = 'google'
DO UPDATE SET
    google_refresh_token = EXCLUDED.google_refresh_token,
    google_customer_id   = EXCLUDED.google_customer_id,
    ga4_property_id      = EXCLUDED.ga4_property_id;

-- ⚠ LA SEULE INSTRUCTION DESTRUCTIVE DU FICHIER, ET ELLE EST D'ORIGINE.
-- Elle retire de `profiles` les trois colonnes que l'INSERT ci-dessus vient de
-- recopier dans `connected_accounts`. Elle a déjà tourné sur la base de
-- production : les colonnes n'y sont plus, et `IF EXISTS` la rend muette au
-- deuxième passage. Elle est laissée en place parce que la retirer ferait
-- réapparaître les jetons Google sur `profiles` — une table qui, elle, EST
-- partagée avec les membres invités (section 15). Le nettoyage est donc aussi
-- une mesure de cloisonnement, pas seulement du rangement.
ALTER TABLE public.profiles
    DROP COLUMN IF EXISTS google_refresh_token,
    DROP COLUMN IF EXISTS google_customer_id,
    DROP COLUMN IF EXISTS ga4_property_id;

-- ============================================================================
-- 6) weekly_reports — rapport hebdo précalculé (payload JSON)
--    Lu par Pulse (Next.js, saas/web) et l'email hebdo.
--    Écrit en headless par saas/worker/build_report.py, au fetch cron.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.weekly_reports (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_start  date NOT NULL,
    payload     jsonb NOT NULL,
    updated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, week_start)
);

ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "weekly_reports_select_own" ON public.weekly_reports;
CREATE POLICY "weekly_reports_select_own" ON public.weekly_reports
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "weekly_reports_insert_own" ON public.weekly_reports;
CREATE POLICY "weekly_reports_insert_own" ON public.weekly_reports
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "weekly_reports_update_own" ON public.weekly_reports;
CREATE POLICY "weekly_reports_update_own" ON public.weekly_reports
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- (Ce n'est pas la fin du fichier : un « FIN » traînait ici alors que dix
--  sections suivaient. Le contrôle complet est tout en bas.)

-- ============================================================================
-- 7) Onboarding express Pulse — profil (business, budget, temps dispo)
-- ============================================================================

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS business_type text,
    ADD COLUMN IF NOT EXISTS budget_range  text,
    ADD COLUMN IF NOT EXISTS time_budget   text,
    ADD COLUMN IF NOT EXISTS frustration   text;

-- ============================================================================
-- 8) Vision globale + labellisation IA — voir vision_labels_ia.sql
--    • label_source ('user'/'ai') : l'IA ne réécrit jamais un label humain
--    • insight_feedback : validation ✓/✗ des constats « Ce qui fonctionne
--      pour toi » — permanente, survit aux recalculs hebdo
-- ============================================================================

ALTER TABLE public.meta_campaign_config
    ADD COLUMN IF NOT EXISTS label_source text;
ALTER TABLE public.google_campaign_config
    ADD COLUMN IF NOT EXISTS label_source text;
ALTER TABLE public.instagram_organic_posts
    ADD COLUMN IF NOT EXISTS label_source text;

-- Backfill UNE FOIS : tout label déjà posé l'a été à la main.
UPDATE public.meta_campaign_config
    SET label_source = 'user'
    WHERE label IS NOT NULL AND btrim(label) <> '' AND label_source IS NULL;
UPDATE public.google_campaign_config
    SET label_source = 'user'
    WHERE label IS NOT NULL AND btrim(label) <> '' AND label_source IS NULL;
UPDATE public.instagram_organic_posts
    SET label_source = 'user'
    WHERE labels IS NOT NULL AND labels <> '{}' AND label_source IS NULL;

CREATE TABLE IF NOT EXISTS public.insight_feedback (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    insight_key text NOT NULL,          -- clé stable, ex. 'theme_best:e-bike'
    verdict     text NOT NULL,          -- 'agree' | 'reject'
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT insight_feedback_uq UNIQUE (user_id, insight_key)
);

CREATE INDEX IF NOT EXISTS idx_insight_feedback_user
    ON public.insight_feedback (user_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_insight_feedback_updated_at ON public.insight_feedback;
CREATE TRIGGER trg_insight_feedback_updated_at
    BEFORE UPDATE ON public.insight_feedback
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.insight_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insight_fb_select_own" ON public.insight_feedback;
DROP POLICY IF EXISTS "insight_fb_insert_own" ON public.insight_feedback;
DROP POLICY IF EXISTS "insight_fb_update_own" ON public.insight_feedback;
DROP POLICY IF EXISTS "insight_fb_delete_own" ON public.insight_feedback;
CREATE POLICY "insight_fb_select_own" ON public.insight_feedback
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insight_fb_insert_own" ON public.insight_feedback
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "insight_fb_update_own" ON public.insight_feedback
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "insight_fb_delete_own" ON public.insight_feedback
    FOR DELETE USING (auth.uid() = user_id);


-- ============================================================================
-- 9) Suivi des recommandations — « ▶ Je le teste » puis verdict 2 semaines
--    après. Voir suivi_actions.sql. La décision est photographiée (titre,
--    indicateur-cible, valeur de départ) → elle reste « en cours » jusqu'à ce
--    qu'elle soit faite / vérifiée.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.suivi_actions (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reco_key    text NOT NULL,
    title       text NOT NULL,
    theme       text,
    metric      text,
    metric_label text,
    direction   text,
    baseline    numeric(14, 4),
    decided_at  date NOT NULL DEFAULT current_date,
    check_at    date NOT NULL,
    status      text NOT NULL DEFAULT 'running',
    created_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT suivi_actions_uq UNIQUE (user_id, reco_key, decided_at)
);

CREATE INDEX IF NOT EXISTS idx_suivi_actions_user
    ON public.suivi_actions (user_id, check_at);

ALTER TABLE public.suivi_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suivi_actions_select_own" ON public.suivi_actions;
DROP POLICY IF EXISTS "suivi_actions_insert_own" ON public.suivi_actions;
DROP POLICY IF EXISTS "suivi_actions_update_own" ON public.suivi_actions;
DROP POLICY IF EXISTS "suivi_actions_delete_own" ON public.suivi_actions;
CREATE POLICY "suivi_actions_select_own" ON public.suivi_actions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "suivi_actions_insert_own" ON public.suivi_actions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "suivi_actions_update_own" ON public.suivi_actions
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "suivi_actions_delete_own" ON public.suivi_actions
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 10) Suivi des recommandations, suite : la colonne done_at.
--     Un conseil passe par trois etats :
--       'running'  = a faire (tu as clique sur "Je le teste") -> en haut du rapport
--       'done'     = fait le done_at -> on observe 14 jours a partir de CE jour
--       'archived' = verdict vu, range dans l'historique
--     Le compteur des deux semaines part donc du jour ou l'action est reellement
--     appliquee, pas du jour ou elle a ete decidee.
-- ============================================================================

ALTER TABLE public.suivi_actions ADD COLUMN IF NOT EXISTS done_at date;

CREATE INDEX IF NOT EXISTS idx_suivi_actions_status
    ON public.suivi_actions (user_id, status, check_at);

-- ============================================================================
-- 11) Le detail du conseil, conserve avec l'action.
--     Une action ne gardait que son titre : deux jours plus tard, impossible de
--     se rappeler de quoi il s'agissait ni pourquoi on l'avait prise. On
--     photographie donc aussi le constat, le pourquoi et le comment tester.
-- ============================================================================

ALTER TABLE public.suivi_actions ADD COLUMN IF NOT EXISTS detail jsonb;

-- ============================================================================
-- 12) PARTAGE D'ACCÈS — inviter quelqu'un sur son dashboard.
--     Voir equipe_partage.sql (source de vérité). Cette section ne renvoyait
--     autrefois QUE vers ce fichier : c'était le trou principal du bundle.
--     Le contenu est maintenant là.
--
--     Le principe : les données restent rangées sous le user_id de leur
--     PROPRIÉTAIRE. On n'en duplique aucune. On élargit seulement la règle de
--     lecture/écriture pour qu'un membre invité voie le compte de celui qui
--     l'a invité.
--
--     Deux rôles :
--       'viewer' — il regarde, il ne touche à rien
--       'editor' — il coche des actions, reclasse des campagnes, choisit des
--                  priorités. Il ne peut jamais inviter ni révoquer.
--
--     connected_accounts n'est PAS partagée, et ne le sera jamais : elle porte
--     les jetons Meta et Google. Un membre voit les données récoltées, jamais
--     de quoi les récolter lui-même. La section 15 le VÉRIFIE au lieu de le
--     supposer.
--
--     ORDRE : cette section doit passer AVANT les sections 13 et 14.
--     platform_budgets et platform_changes testent la présence de a_acces() /
--     peut_editer() pour choisir entre « partagé » et « chacun ses lignes ».
--     Jouées avant, elles retomberaient sur la règle restreinte et l'invité
--     verrait deux modules vides, sans la moindre erreur nulle part.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.dashboard_members (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    member_email text NOT NULL,      -- on invite un e-mail, pas un compte : la
                                     -- personne n'a peut-être rien créé encore
    member_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    owner_email  text,               -- pour nommer le compte dans le sélecteur
                                     -- (auth.users n'est pas lisible côté client)
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
-- L'update sert à DEUX choses, et deux seulement : le propriétaire change un
-- rôle, et l'invité rattache son compte à l'invitation qui porte son e-mail
-- (il écrit member_id et accepted_at, rien d'autre).
--
-- POURQUOI IL Y A UN WITH CHECK, ET POURQUOI IL NE SUFFIT PAS.
--
-- Sans WITH CHECK, PostgreSQL réutilise l'expression du USING pour valider la
-- ligne APRÈS modification. Or cette expression reste vraie quand c'est
-- justement `owner_id` qu'on vient de changer : l'invité gardait son e-mail
-- dans `member_email`, donc la ligne restait « la sienne » et passait le
-- contrôle. Il pouvait repointer son invitation vers le compte de n'importe
-- qui. Reproduit sur PostgreSQL 17 : `UPDATE 1`, puis lecture et écriture
-- complètes chez le tiers.
--
-- Le WITH CHECK ci-dessous ferme ça. Mais il ne peut pas tout fermer, et c'est
-- une limite de fond du modèle : une policy ne voit que la ligne d'ARRIVÉE.
-- Elle sait dire « cette ligne doit t'appartenir » ; elle ne sait pas dire
-- « cette colonne-là n'avait pas le droit de bouger ». Un invité qui se
-- contente de passer son propre `role` à 'editor' produit une ligne qui lui
-- appartient toujours — donc conforme, donc acceptée.
--
-- D'où le USING resserré (l'invité ne vise qu'une invitation PAS ENCORE
-- rattachée, `member_id IS NULL` — c'est exactement ce que fait
-- saas/web/lib/account.ts) ET le trigger de garde juste en dessous, qui épingle
-- les colonnes que seul le propriétaire peut toucher. Les trois ensemble, pas
-- l'un des trois.
CREATE POLICY "dm_update" ON public.dashboard_members
    FOR UPDATE
    USING (auth.uid() = owner_id
           OR (lower(member_email) = lower(auth.jwt() ->> 'email')
               AND member_id IS NULL))
    WITH CHECK (auth.uid() = owner_id
                OR (lower(member_email) = lower(auth.jwt() ->> 'email')
                    AND member_id = auth.uid()));
CREATE POLICY "dm_delete" ON public.dashboard_members
    FOR DELETE USING (auth.uid() = owner_id);

-- ── Le garde-fou que la RLS ne peut pas exprimer ────────────────────────────
-- Ce qui reste ouvert sans lui, et qui a été reproduit : n'importe qui peut
-- s'INSCRIRE une invitation à son propre nom (dm_insert n'exige que
-- `auth.uid() = owner_id`), puis, EN UNE SEULE requête, la rattacher à lui
-- (`member_id`), la repointer vers le compte d'un tiers (`owner_id`) et se
-- donner le rôle 'editor'. La ligne d'arrivée lui appartient, donc les deux
-- policies la laissent passer — et `a_acces()` / `peut_editer()` répondent
-- « oui » sur un compte qui ne l'a jamais invité.
--
-- Le trigger compare l'AVANT et l'APRÈS, ce qu'une policy ne peut pas faire.
CREATE OR REPLACE FUNCTION public.dashboard_members_garde()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Sans contexte utilisateur (service_role, worker cron, éditeur SQL de
    -- Supabase) la RLS est de toute façon contournée : ce n'est pas au trigger
    -- d'inventer une règle que les policies n'appliquent pas.
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    -- `owner_id` NE BOUGE JAMAIS, POUR PERSONNE — pas même pour le
    -- propriétaire de la ligne. C'est LA ligne qui ferme l'auto-invitation
    -- détournée, et elle a coûté un test pour être trouvée : dispenser le
    -- propriétaire de ce contrôle rouvrait tout le trou. N'importe qui peut
    -- s'insérer une invitation à SON nom (dm_insert l'autorise, `owner_id =
    -- auth.uid()`) ; il en est alors le propriétaire, donc toute exemption
    -- « le propriétaire fait ce qu'il veut » le laissait ensuite déplacer la
    -- ligne vers le compte d'un tiers.
    --
    -- Aucun usage légitime n'en a besoin : `owner_id` fait partie de la clé
    -- unique (owner_id, member_email), il est posé à la création et aucun
    -- chemin de l'application ne le réécrit.
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
        RAISE EXCEPTION 'Le compte auquel une invitation donne accès ne se change pas.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Le propriétaire, lui, dispose librement du reste : rôle, libellé.
    IF auth.uid() = OLD.owner_id THEN
        RETURN NEW;
    END IF;

    -- Tout le reste, c'est l'invité. Il ne touche à RIEN de ce qui définit
    -- l'invitation : ni à qui elle s'adresse, ni le niveau de droit qu'elle
    -- accorde.
    IF NEW.owner_email  IS DISTINCT FROM OLD.owner_email
    OR NEW.member_email IS DISTINCT FROM OLD.member_email
    OR NEW.role         IS DISTINCT FROM OLD.role THEN
        RAISE EXCEPTION
            'Seul le propriétaire d''une invitation peut en changer l''adresse ou le rôle.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Et il ne rattache l'invitation qu'à LUI-MÊME.
    IF NEW.member_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Une invitation ne se rattache qu''à son propre compte.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dashboard_members_garde ON public.dashboard_members;
CREATE TRIGGER trg_dashboard_members_garde
    BEFORE UPDATE ON public.dashboard_members
    FOR EACH ROW EXECUTE FUNCTION public.dashboard_members_garde();

-- ── Les deux fonctions qui portent toute la règle d'accès ───────────────────
-- SECURITY DEFINER : sans ça, lire dashboard_members depuis la policy d'une
-- autre table repasserait par la RLS de dashboard_members — récursion.
-- SET search_path = public : sans ça, un search_path hostile ferait résoudre
-- `dashboard_members` vers une table maison. Les deux vont ensemble.

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

-- L'ouverture des tables de données elle-même est faite en section 15, avec la
-- liste COMPLÈTE. La boucle d'origine de equipe_partage.sql est volontairement
-- omise ici : elle posait exactement les mêmes politiques sur un sous-ensemble
-- de tables, la rejouer ne ferait que doubler le travail de la section 15.


-- ============================================================================
-- 13) platform_budgets — le budget PLANIFIÉ, tel qu'il est posé dans les
--     campagnes. Voir platform_budgets.sql (source de vérité).
--
--     Pulse ne connaissait que le budget DÉPENSÉ. Ce qui a été PROMIS
--     n'existait nulle part : un compte réglé à 200 CHF/jour qui n'en consomme
--     que 60 se lisait comme un compte à 60 CHF/jour, sans qu'on puisse dire
--     s'il sous-dépense ou s'il est à sa cible.
--
--     UNE SUITE DE PHOTOS, PAS UN HISTORIQUE : aucune des deux plateformes ne
--     sait dire ce que valait un budget il y a trois mois. Chaque récolte écrit
--     une ligne datée du jour du relevé ; ce qui précède le premier relevé
--     restera à jamais inconnu.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.platform_budgets (
    user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    channel       text NOT NULL CHECK (channel IN ('meta', 'google')),
    campaign_id   text NOT NULL,
    campaign_name text,
    captured_on   date NOT NULL,          -- le jour du relevé, pas le jour du budget
    daily_budget  numeric,                -- CHF/jour   (exclusif avec total_budget)
    total_budget  numeric,                -- CHF pour toute la durée
    start_date    date,
    end_date      date,                   -- NULL = déclarée sans date de fin
    status        text,
    PRIMARY KEY (user_id, channel, campaign_id, captured_on)
);

CREATE INDEX IF NOT EXISTS idx_platform_budgets_user_date
    ON public.platform_budgets (user_id, captured_on DESC);

ALTER TABLE public.platform_budgets ENABLE ROW LEVEL SECURITY;

-- On teste la présence des fonctions de partage plutôt que de la supposer :
-- la migration d'origine doit pouvoir tourner seule, sur une base où le partage
-- n'est pas installé. Ici, jouée après la section 12, elle prend toujours la
-- branche « partagé ».
DO $$
DECLARE
    partage boolean := to_regprocedure('public.a_acces(uuid)') IS NOT NULL
                   AND to_regprocedure('public.peut_editer(uuid)') IS NOT NULL;
BEGIN
    DROP POLICY IF EXISTS "partage_select" ON public.platform_budgets;
    DROP POLICY IF EXISTS "partage_insert" ON public.platform_budgets;
    DROP POLICY IF EXISTS "partage_update" ON public.platform_budgets;
    DROP POLICY IF EXISTS "partage_delete" ON public.platform_budgets;

    IF partage THEN
        CREATE POLICY "partage_select" ON public.platform_budgets
            FOR SELECT USING (public.a_acces(user_id));
        CREATE POLICY "partage_insert" ON public.platform_budgets
            FOR INSERT WITH CHECK (public.peut_editer(user_id));
        CREATE POLICY "partage_update" ON public.platform_budgets
            FOR UPDATE USING (public.peut_editer(user_id))
            WITH CHECK (public.peut_editer(user_id));
        CREATE POLICY "partage_delete" ON public.platform_budgets
            FOR DELETE USING (public.peut_editer(user_id));
    ELSE
        CREATE POLICY "partage_select" ON public.platform_budgets
            FOR SELECT USING (auth.uid() = user_id);
        CREATE POLICY "partage_insert" ON public.platform_budgets
            FOR INSERT WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "partage_update" ON public.platform_budgets
            FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "partage_delete" ON public.platform_budgets
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;


-- ============================================================================
-- 14) platform_changes — ce que les plateformes DÉCLARENT avoir changé.
--     Voir platform_changes.sql (source de vérité).
--
--     Le fil sait déjà DÉDUIRE cinq faits de la dépense quotidienne, et c'est
--     aveugle : mettre un mot-clé en pause ou changer une audience ne fait pas
--     forcément bouger la dépense du jour. Ces gestes-là n'apparaissaient nulle
--     part, et une courbe qui bouge restait sans explication.
--
--     LA FENÊTRE DE GOOGLE EST LE FAIT DUR DE CETTE TABLE : `change_event` ne
--     remonte que 30 jours. Au-delà, l'information n'existe plus nulle part —
--     ce qui n'a pas été récolté à temps est perdu. D'où le stockage, et d'où
--     `change_id`, un hachage stable qui rend chaque récolte idempotente.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.platform_changes (
    user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    channel       text NOT NULL CHECK (channel IN ('meta', 'google')),
    change_id     text NOT NULL,          -- hachage stable (canal, horodatage, ressource, champ)
    occurred_at   timestamptz NOT NULL,
    categorie     text NOT NULL CHECK (categorie IN
                      ('budget', 'motcle', 'enchere', 'statut', 'audience', 'creatif', 'autre')),
    campaign_id   text,
    campaign_name text,
    resume        text NOT NULL,          -- déjà rédigé en français à la récolte
    PRIMARY KEY (user_id, channel, change_id)
);

CREATE INDEX IF NOT EXISTS idx_platform_changes_user_date
    ON public.platform_changes (user_id, occurred_at DESC);

ALTER TABLE public.platform_changes ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    partage boolean := to_regprocedure('public.a_acces(uuid)') IS NOT NULL
                   AND to_regprocedure('public.peut_editer(uuid)') IS NOT NULL;
BEGIN
    DROP POLICY IF EXISTS "partage_select" ON public.platform_changes;
    DROP POLICY IF EXISTS "partage_insert" ON public.platform_changes;
    DROP POLICY IF EXISTS "partage_update" ON public.platform_changes;
    DROP POLICY IF EXISTS "partage_delete" ON public.platform_changes;

    IF partage THEN
        CREATE POLICY "partage_select" ON public.platform_changes
            FOR SELECT USING (public.a_acces(user_id));
        CREATE POLICY "partage_insert" ON public.platform_changes
            FOR INSERT WITH CHECK (public.peut_editer(user_id));
        CREATE POLICY "partage_update" ON public.platform_changes
            FOR UPDATE USING (public.peut_editer(user_id))
            WITH CHECK (public.peut_editer(user_id));
        CREATE POLICY "partage_delete" ON public.platform_changes
            FOR DELETE USING (public.peut_editer(user_id));
    ELSE
        CREATE POLICY "partage_select" ON public.platform_changes
            FOR SELECT USING (auth.uid() = user_id);
        CREATE POLICY "partage_insert" ON public.platform_changes
            FOR INSERT WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "partage_update" ON public.platform_changes
            FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "partage_delete" ON public.platform_changes
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;


-- ============================================================================
-- 14bis) LES ÉVÉNEMENTS GA4 D'UN THÈME — voir theme_ga4_events.sql.
--
--     POURQUOI « 14bis » ET PAS « 22 » : c'est la seule section ajoutée depuis
--     longtemps qui CRÉE UNE TABLE, et la boucle de partage de la section 15
--     est une liste fermée jouée une fois. Une table née après elle n'aurait
--     aucune politique `partage_*` : elle s'afficherait vide chez l'invité,
--     sans erreur nulle part. Les sections 16 à 21 pouvaient se ranger après —
--     elles n'ajoutent que des colonnes à des tables déjà couvertes. Celle-ci
--     non. Elle se pose donc AVANT la section 15, et son nom figure dans la
--     liste de celle-ci.
--
--     CE QU'ELLE INSTALLE, ET POURQUOI DEUX OBJETS PLUTÔT QU'UN.
--     Le funnel GA4 était une liste de six noms écrits en dur dans
--     `google_script/fetch_ga4.py`, devinés pour un e-commerce standard. Un
--     site qui nomme ses conversions autrement ne remontait rien, en silence.
--       · `profiles.ga4_event_catalog` (jsonb) — LA LISTE des événements que la
--         propriété émet vraiment, avec leur volume et la marque « événement
--         clé » de GA4. C'est un cache : lu en entier, pour un seul
--         utilisateur, jamais joint. D'où le jsonb plutôt qu'une table.
--       · `theme_ga4_events` — LE CHOIX : quels événements comptent pour quel
--         thème, et lequel porte le verdict.
--     Deux besoins différents, et un seul des deux coûte cher à récolter :
--     savoir QUELS événements existent tient en un appel d'API qui rend une
--     ligne par nom ; en stocker le détail quotidien × source × campagne
--     multiplie `ga4_events` par le nombre de noms.
--
--     PRIMAIRE / SECONDAIRE EST UN CHOIX, PAS UN IMPORT.
--     GA4 ne connaît qu'un booléen : un événement est « clé » (key event,
--     l'ancien « conversion ») ou ne l'est pas. La ressource Admin
--     `properties.keyEvents` porte eventName, custom, deletable,
--     countingMethod, defaultValue — et AUCUN champ primaire/secondaire ; la
--     dimension `isKeyEvent` est binaire elle aussi. Le couple vient de GOOGLE
--     ADS et de ses actions de conversion (`primary_for_goal` : primaire =
--     utilisée par les enchères, secondaire = observée seulement). Un événement
--     clé GA4 importé dans Google Ads y arrive même en secondaire par défaut.
--     `rang` est donc rempli par le client, par thème.
--
--     LE LABEL EST STOCKÉ PAR SON NOM, comme partout ailleurs
--     (`meta_campaign_config.label`, `suivi_actions.theme`). Renommer ou
--     supprimer un thème propage ici — voir `renameLabel` / `deleteLabel`
--     dans saas/web/app/actions.ts.
-- ============================================================================

-- Le catalogue. `maj` vit DANS le jsonb et non dans une colonne à côté : une
-- colonne nommée `..._refreshed_at` déclencherait le contrôle de sécurité de
-- fin de fichier, qui refuse toute colonne de `profiles` dont le nom contient
-- token/secret/refresh — cette table étant partagée avec les invités.
-- Forme : {"maj": "2026-08-18", "evenements": [{"nom","volume","valeur","cle"}]}
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS ga4_event_catalog jsonb NOT NULL DEFAULT '{}'::jsonb;

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

-- « Chacun ses lignes ». Le partage d'équipe est posé par la section 15, qui
-- suit immédiatement et qui porte cette table dans sa liste.
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


-- ============================================================================
-- 14ter) fetch_progress — l'avancement RÉEL de la récolte (voir
--        fetch_progress.sql, source de vérité).
--
--        AVANT LA SECTION 15, qui doit la partager : sans ça, un membre invité
--        verrait un panneau de récolte vide, sans erreur nulle part.
--
--        Elle existe parce que la barre de « ↻ Mes données » ne mesurait rien —
--        `avancement(sec)` est une exponentielle sur le temps écoulé, et la
--        liste des étapes est horodatée à la main. Depuis que les quatre
--        plateformes tournent en parallèle, ces étapes sont fausses par
--        construction. Le worker écrit désormais où il en est, canal par canal.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.fetch_progress (
    user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    canal      text NOT NULL CHECK (canal IN
                   ('meta', 'instagram', 'google', 'ga4', 'labels', 'rapport')),
    -- Le passage (horodatage ISO du départ). L'écran n'affiche que le run_id le
    -- plus grand : sur un ISO en UTC, le tri texte donne le plus récent.
    run_id     text NOT NULL,
    -- 'saute' n'est pas un échec : c'est « pas appelé, et voici pourquoi ».
    etat       text NOT NULL CHECK (etat IN
                   ('attente', 'en_cours', 'fini', 'echec', 'saute')),
    -- L'étape franchie DANS le canal, en clair. Jamais un pourcentage : le
    -- nombre d'appels API d'un canal n'est pas connu d'avance.
    etape      text,
    -- La ligne que le journal du worker imprime déjà. On la range, on ne la
    -- réécrit pas.
    mot_de_fin text,
    debut_a    timestamptz,
    fin_a      timestamptz,
    maj_a      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, canal)
);

-- « Chacun ses lignes » n'est PAS posé ici : contrairement à theme_ga4_events,
-- cette table est neuve et n'a jamais eu d'autre règle. La section 15, juste en
-- dessous, lui pose ses politiques `partage_*` et c'est la seule source.
ALTER TABLE public.fetch_progress ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 14quater) theme_objectifs — l'objectif propre d'un thème prioritaire (voir
--           theme_objectifs.sql, source de vérité).
--
--           AVANT LA SECTION 15, qui doit la partager, même raison que 14bis.
--
--           `profiles.objectif` fixe UN objectif pour tout le compte. Deux
--           thèmes prioritaires n'ont pourtant pas toujours la même vocation :
--           cette table laisse en choisir un DIFFÉRENT par thème. L'absence de
--           ligne EST le « pas de réglage propre » — le thème hérite alors en
--           silence de `profiles.objectif`, exactement comme un compte qui n'a
--           jamais touché à ce réglage aujourd'hui.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.theme_objectifs (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    label       text NOT NULL,
    objectif    text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT theme_objectifs_uq UNIQUE (user_id, label)
);

DO $$
BEGIN
    ALTER TABLE public.theme_objectifs
        ADD CONSTRAINT theme_objectifs_objectif_ck
        CHECK (objectif IN ('ventes', 'notoriete', 'engagement'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_theme_objectifs_user
    ON public.theme_objectifs (user_id, label);

DROP TRIGGER IF EXISTS trg_theme_objectifs_updated_at ON public.theme_objectifs;
CREATE TRIGGER trg_theme_objectifs_updated_at
    BEFORE UPDATE ON public.theme_objectifs
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- « Chacun ses lignes », comme theme_ga4_events (contrairement à
-- fetch_progress, ce réglage existe déjà en dehors du partage d'équipe dans le
-- fichier autonome, donc on garde le même filet).
ALTER TABLE public.theme_objectifs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "to_select_own" ON public.theme_objectifs;
DROP POLICY IF EXISTS "to_insert_own" ON public.theme_objectifs;
DROP POLICY IF EXISTS "to_update_own" ON public.theme_objectifs;
DROP POLICY IF EXISTS "to_delete_own" ON public.theme_objectifs;
CREATE POLICY "to_select_own" ON public.theme_objectifs
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "to_insert_own" ON public.theme_objectifs
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "to_update_own" ON public.theme_objectifs
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "to_delete_own" ON public.theme_objectifs
    FOR DELETE USING (auth.uid() = user_id);


-- ============================================================================
-- 14quinquies) conversion_categories + ga4_event_categories — les catégories
--              de conversions (voir conversion_categories.sql, source de vérité).
--
--              AVANT LA SECTION 15, qui doit les partager, même raison que
--              14bis/14ter/14quater.
--
--              `theme_ga4_events` dit quel événement GA4 compte pour quel
--              THÈME. Ceci dit à quel GENRE de conversion appartient chaque
--              événement (Ventes, Contacts…) — PAR NOM D'ÉVÉNEMENT, PAS PAR
--              THÈME : un même événement signifie la même chose quel que soit
--              le thème qui le suit, et c'est ce qui permet au camembert de
--              /conversions de compter « conversions par catégorie » sur tout
--              le compte. `category_source` rejoue la règle d'or de la
--              labellisation IA : un choix humain n'est jamais écrasé par la
--              classification automatique (`saas/worker/categorizing.py`).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.conversion_categories (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name        text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT conversion_categories_uq UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_conversion_categories_user
    ON public.conversion_categories (user_id);

DROP TRIGGER IF EXISTS trg_conversion_categories_updated_at ON public.conversion_categories;
CREATE TRIGGER trg_conversion_categories_updated_at
    BEFORE UPDATE ON public.conversion_categories
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.ga4_event_categories (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_name      text NOT NULL,
    category        text NOT NULL,
    category_source text NOT NULL DEFAULT 'user',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ga4_event_categories_uq UNIQUE (user_id, event_name)
);

DO $$
BEGIN
    ALTER TABLE public.ga4_event_categories
        ADD CONSTRAINT ga4_event_categories_source_ck
        CHECK (category_source IN ('user', 'ai'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_ga4_event_categories_user
    ON public.ga4_event_categories (user_id);

DROP TRIGGER IF EXISTS trg_ga4_event_categories_updated_at ON public.ga4_event_categories;
CREATE TRIGGER trg_ga4_event_categories_updated_at
    BEFORE UPDATE ON public.ga4_event_categories
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- « Chacun ses lignes ». Le partage d'équipe est posé par la section 15, qui
-- suit immédiatement et qui porte ces deux tables dans sa liste.
ALTER TABLE public.conversion_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cc_select_own" ON public.conversion_categories;
DROP POLICY IF EXISTS "cc_insert_own" ON public.conversion_categories;
DROP POLICY IF EXISTS "cc_update_own" ON public.conversion_categories;
DROP POLICY IF EXISTS "cc_delete_own" ON public.conversion_categories;
CREATE POLICY "cc_select_own" ON public.conversion_categories
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "cc_insert_own" ON public.conversion_categories
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cc_update_own" ON public.conversion_categories
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cc_delete_own" ON public.conversion_categories
    FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.ga4_event_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gec_select_own" ON public.ga4_event_categories;
DROP POLICY IF EXISTS "gec_insert_own" ON public.ga4_event_categories;
DROP POLICY IF EXISTS "gec_update_own" ON public.ga4_event_categories;
DROP POLICY IF EXISTS "gec_delete_own" ON public.ga4_event_categories;
CREATE POLICY "gec_select_own" ON public.ga4_event_categories
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "gec_insert_own" ON public.ga4_event_categories
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gec_update_own" ON public.ga4_event_categories
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gec_delete_own" ON public.ga4_event_categories
    FOR DELETE USING (auth.uid() = user_id);


-- ============================================================================
-- 15) PARTAGE — toutes les tables au même niveau, et le contrôle des jetons.
--     Voir partage_tables_manquantes.sql (source de vérité).
--
--     POURQUOI CETTE SECTION VIENT APRÈS TOUTES LES CRÉATIONS DE TABLES.
--     La boucle d'origine (equipe_partage.sql) est une PHOTO : elle ne connaît
--     que les tables existant le jour où on l'a écrite, et elle passe son
--     chemin EN SILENCE sur les autres. Une table née ensuite sans sa règle de
--     partage reste invisible à l'invité — module par module, sans erreur nulle
--     part : le dashboard s'affiche, il est juste vide à cet endroit-là. C'est
--     le genre de trou qui ne se voit qu'en production, et seulement chez
--     l'invité. Ici la liste est complète, et une table absente est SIGNALÉE.
-- ============================================================================

-- ── 15.0 Les fonctions doivent être là ──────────────────────────────────────
DO $$
BEGIN
    IF to_regprocedure('public.a_acces(uuid)') IS NULL
       OR to_regprocedure('public.peut_editer(uuid)') IS NULL THEN
        RAISE EXCEPTION
            'a_acces() / peut_editer() manquent : la section 12 n''a pas été jouée.';
    END IF;
END $$;

-- ── 15.1 La liste complète, appliquée ───────────────────────────────────────
DO $$
DECLARE
    t   text;
    col text;
    tables text[] := ARRAY[
        -- régies publicitaires
        'meta_ads_insights', 'google_ads_insights', 'google_ads_ad_insights',
        'meta_campaign_config', 'google_campaign_config',
        -- organique et analytics
        'instagram_organic_posts', 'followers_history',
        'ga4_insights', 'ga4_events',
        -- ce que Pulse produit et ce que l'utilisateur y répond
        'weekly_reports', 'reco_feedback', 'insight_feedback', 'suivi_actions',
        'theme_ga4_events', 'theme_objectifs',
        -- les catégories de conversions
        'conversion_categories', 'ga4_event_categories',
        -- budgets et journal des plateformes
        'channel_budgets', 'platform_budgets', 'platform_changes',
        -- l'avancement de la récolte, lu par le panneau de « ↻ Mes données »
        'fetch_progress',
        -- le profil : objectif, labels unifiés, persona IA, site du client
        'profiles'
    ];
    -- NB : 'meta_campaign_status' figurait dans la liste d'origine. Ce n'est
    -- pas une table, c'est le nom d'une migration qui ajoute une colonne à
    -- meta_campaign_config. La boucle la sautait sans rien dire ; on l'a
    -- retirée plutôt que de laisser croire à une table oubliée.
    --
    -- 'unified_labels' non plus n'est pas une table : les labels unifiés vivent
    -- dans profiles.labels, déjà couvert par la ligne 'profiles'.
    --
    -- 'dashboard_members' n'y est pas non plus, et c'est voulu : elle a ses
    -- propres règles (dm_*). L'ouvrir au partage laisserait un invité lire —
    -- et réécrire — la liste des invitations.
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                       WHERE table_schema = 'public' AND table_name = t) THEN
            RAISE WARNING 'table % absente — sa migration n''a pas été jouée', t;
            CONTINUE;
        END IF;

        -- profiles se repère par id, toutes les autres par user_id.
        col := CASE WHEN t = 'profiles' THEN 'id' ELSE 'user_id' END;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema = 'public' AND table_name = t
                         AND column_name = col) THEN
            RAISE WARNING 'table % sans colonne % — partage impossible', t, col;
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

-- Les anciennes politiques « chacun ses lignes » restent en place : PostgreSQL
-- combine en OU les politiques d'une même commande, donc elles n'enlèvent aucun
-- droit et garantissent au propriétaire de garder le sien quoi qu'il arrive.

-- ── 15.2 connected_accounts : on vérifie qu'elle est restée fermée ──────────
-- Deux gestes, aucun risque :
--   · on retire toute politique de partage qui aurait atterri là par
--     inadvertance (une liste recopiée trop vite suffirait) — c'est le seul
--     DROP de cette section, et il ne peut qu'ENLEVER un accès, jamais en
--     donner un ;
--   · on refuse d'activer la RLS sur une table qui n'aurait aucune politique —
--     ce serait fermer la porte au propriétaire lui-même et casser toute la
--     page Connexions. Dans ce cas on avertit, on ne touche à rien.

DO $$
DECLARE
    r        record;
    nb_pol   integer;
    rls_on   boolean;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = 'public' AND table_name = 'connected_accounts') THEN
        RAISE WARNING 'connected_accounts absente — rien à vérifier';
        RETURN;
    END IF;

    FOR r IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'connected_accounts'
          AND (coalesce(qual, '') || ' ' || coalesce(with_check, ''))
              ~ '(a_acces|peut_editer)'
    LOOP
        EXECUTE format('DROP POLICY %I ON public.connected_accounts', r.policyname);
        RAISE WARNING
            'politique de PARTAGE retirée de connected_accounts : % — les jetons Meta/Google ne se partagent pas',
            r.policyname;
    END LOOP;

    SELECT count(*) INTO nb_pol
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'connected_accounts';

    SELECT relrowsecurity INTO rls_on
    FROM pg_class WHERE oid = 'public.connected_accounts'::regclass;

    IF nb_pol = 0 THEN
        RAISE WARNING
            'connected_accounts n''a AUCUNE politique. On n''active pas la RLS (plus personne ne lirait ses propres connexions). À regarder à la main.';
    ELSIF NOT rls_on THEN
        ALTER TABLE public.connected_accounts ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'RLS activée sur connected_accounts (% politique(s) déjà en place)', nb_pol;
    ELSE
        RAISE NOTICE 'connected_accounts : RLS active, % politique(s), aucune de partage. Conforme.', nb_pol;
    END IF;
END $$;


-- ============================================================================
-- 16) LES DATES DÉCLARÉES D'UNE CAMPAGNE — début et fin programmés.
--     Voir campagnes_dates_declarees.sql (source de vérité).
--
--     Elles ne se déduisent pas de ce qu'on a déjà : nos barres de frise
--     viennent des jours où une campagne a RÉELLEMENT dépensé. Une campagne
--     programmée jusqu'en décembre et une campagne arrêtée hier laissent
--     exactement la même trace. La seule façon de distinguer les deux, c'est de
--     demander à la plateforme ce qui y est écrit.
--
--     `end_date` NULL a DEUX sens qu'il faut savoir distinguer à la lecture :
--       · la ligne existe et end_date est NULL → pas de fin programmée ;
--       · aucune ligne → on n'a rien récolté, on ne sait pas.
--     L'affichage ne montre un prévisionnel que dans le premier cas.
-- ============================================================================

ALTER TABLE public.meta_campaign_config
    ADD COLUMN IF NOT EXISTS start_date date DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS end_date   date DEFAULT NULL;

ALTER TABLE public.google_campaign_config
    ADD COLUMN IF NOT EXISTS start_date date DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS end_date   date DEFAULT NULL;


-- ============================================================================
-- 17) LA PAGE D'ARRIVÉE D'UNE CAMPAGNE — voir campagne_landing.sql.
--
--     Pulse sait ce qu'une campagne COÛTE, pas ce qu'elle VEND : le nom
--     « CH_DE_Prospection_Q3_v2 » ne dit ni le produit, ni le prix, ni la
--     promesse. C'est ce trou qui limite les conseils — on peut dire « ton CPC
--     monte », jamais « ta page d'arrivée demande cinq champs pour un produit
--     à 39 CHF ».
--
--     ON LA STOCKE, ON NE LA VISITE PAS. Aucune requête sortante n'est
--     déclenchée par ce qui est écrit ici. Un champ libre où l'utilisateur colle
--     une adresse, et que le serveur irait chercher tout seul, c'est une SSRF
--     offerte. Le jour où une reco voudra lire la page, ce sera par un chemin
--     explicite avec une liste d'hôtes autorisée.
--
--     LE CHECK N'EST PAS UNE VALIDATION D'URL, C'EST UN GARDE-FOU. La vraie
--     validation vit dans `urlPropre` (saas/web/app/actions.ts). Le CHECK
--     interdit seulement à la base d'accepter ce qui ne ressemble même pas à
--     une adresse — parce qu'un jour un script écrira ici sans passer par
--     l'application.
-- ============================================================================

ALTER TABLE public.meta_campaign_config
    ADD COLUMN IF NOT EXISTS landing_url text;

ALTER TABLE public.google_campaign_config
    ADD COLUMN IF NOT EXISTS landing_url text;

-- `ADD CONSTRAINT IF NOT EXISTS` n'existe pas pour un CHECK : on rattrape
-- l'erreur de doublon plutôt que de la deviner.
DO $$
BEGIN
    ALTER TABLE public.meta_campaign_config
        ADD CONSTRAINT meta_campaign_config_landing_url_ck
        CHECK (
            landing_url IS NULL
            OR (landing_url ~* '^https?://[^[:space:]]+\.[^[:space:]]+$'
                AND length(landing_url) <= 2048)
        );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE public.google_campaign_config
        ADD CONSTRAINT google_campaign_config_landing_url_ck
        CHECK (
            landing_url IS NULL
            OR (landing_url ~* '^https?://[^[:space:]]+\.[^[:space:]]+$'
                AND length(landing_url) <= 2048)
        );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================================
-- 18) LE SITE DU CLIENT — profiles.site_url. Voir site_client.sql.
--
--     C'EST LA COLONNE PAR LAQUELLE ON A DÉCOUVERT QUE CE FICHIER MENTAIT :
--     « Enregistrement impossible — rejoue le SQL site_client.sql ».
--
--     Pulse connaît les chiffres d'un compte sans savoir ce que ce compte VEND.
--     L'onboarding demande le secteur (« e-commerce », « commerce local ») :
--     c'est une case, pas une entreprise. Le domaine, lui, dit tout d'un coup —
--     la gamme, le prix, la langue, le pays, le ton.
--
--     FACULTATIF PAR CONSTRUCTION : nullable, aucun défaut, aucun NOT NULL.
--     Beaucoup de clients n'ont qu'une page Instagram, d'autres ne veulent pas
--     donner leur adresse à la première minute. Un onboarding qui se referme
--     sur ce champ ne perd pas un champ, il perd le client entier.
--
--     Même précaution SSRF qu'en section 17 : on la stocke, le serveur ne la
--     visite jamais.
-- ============================================================================

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS site_url text;

DO $$
BEGIN
    ALTER TABLE public.profiles
        ADD CONSTRAINT profiles_site_url_ck
        CHECK (
            site_url IS NULL
            OR (site_url ~* '^https?://[^[:space:]]+\.[^[:space:]]+$'
                AND length(site_url) <= 2048)
        );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.profiles.site_url IS
    'Site ou page d''accueil du client, facultatif. Stocké, jamais visité par le serveur (SSRF).';


-- ============================================================================
-- 19) TES PROPRES NOTES DANS LE FIL — suivi_actions.kind.
--     Voir suivi_actions_notes.sql (source de vérité).
--
--     Le fil montre ce que Pulse a conseillé et ce que les plateformes ont
--     fait. Il manquait le troisième tiers : ce que TU as fait et que personne
--     ne peut deviner — « refait les visuels », « le concurrent a lancé une
--     promo ».
--
--     Une note n'est PAS une action : ni indicateur, ni baseline, ni échéance,
--     donc aucun verdict ne peut tomber dessus. C'est ce que `kind` distingue,
--     et c'est ce qui interdit de lui coller une pastille de verdict.
--
--     ORDRE : après les sections 9→11, qui créent suivi_actions.
-- ============================================================================

ALTER TABLE public.suivi_actions
    ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'action';

-- 'action' : née d'un conseil, elle sera jugée.
-- 'note'   : écrite à la main, elle ne sera jamais jugée.
--
-- La migration d'origine fait ici un DROP CONSTRAINT IF EXISTS suivi d'un ADD.
-- C'est correct et rejouable, mais ça laisse une fraction de transaction sans
-- contrainte. Ici on préfère le motif « on ajoute, et on ignore le doublon » :
-- rien n'est jamais retiré.
DO $$
BEGIN
    ALTER TABLE public.suivi_actions
        ADD CONSTRAINT suivi_actions_kind_chk CHECK (kind IN ('action', 'note'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- La contrainte d'unicité porte sur (user_id, reco_key, decided_at). Deux notes
-- écrites le même jour auraient la même clé si on ne la rendait pas unique :
-- `reco_key` d'une note vaut donc 'note:<uuid>', généré côté serveur.

CREATE INDEX IF NOT EXISTS idx_suivi_actions_kind
    ON public.suivi_actions (user_id, kind, decided_at DESC);


-- ============================================================================
-- 20) QUAND UNE ÉTIQUETTE A ÉTÉ POSÉE — label_at. Voir labels_origine.sql.
--
--     La section 8 dit QUI a étiqueté ('user' | 'ai'). Elle ne dit pas QUAND.
--     Tant que « Étiqueter tout via l'IA » demandait une validation, ça
--     suffisait. Il applique maintenant DIRECTEMENT — et une action de masse
--     sans retour en arrière est un piège.
--
--     « Annuler » ne peut pas vouloir dire « effacer tout ce qui porte 'ai' » :
--     ça emporterait les étiquettes IA posées il y a trois semaines et gardées
--     depuis. Ce qu'on annule, c'est CE passage-là. Il faut donc une date.
--
--     ORDRE — LE POINT DÉLICAT DU FICHIER : cette section doit venir APRÈS le
--     backfill de la section 8 (`label_source = 'user'` sur les étiquettes
--     existantes). Les triggers ci-dessous horodatent toute écriture ; posés
--     avant, ils dateraient d'aujourd'hui des étiquettes vieilles de six mois.
--
--     AUCUN BACKFILL DE label_at, ET C'EST VOULU. Les lignes existantes gardent
--     NULL. `NULL >= <date>` est faux en SQL : une étiquette IA antérieure ne
--     peut donc JAMAIS tomber dans le périmètre d'une annulation. On ne sait pas
--     quand elle a été posée, alors on ne le prétend pas — et le doute joue en
--     faveur de ce qui est déjà à l'écran.
-- ============================================================================

ALTER TABLE public.meta_campaign_config
    ADD COLUMN IF NOT EXISTS label_source text,
    ADD COLUMN IF NOT EXISTS label_at     timestamptz;

ALTER TABLE public.google_campaign_config
    ADD COLUMN IF NOT EXISTS label_source text,
    ADD COLUMN IF NOT EXISTS label_at     timestamptz;

ALTER TABLE public.instagram_organic_posts
    ADD COLUMN IF NOT EXISTS label_source text,
    ADD COLUMN IF NOT EXISTS label_at     timestamptz;

-- Les campagnes portent UN label (colonne `label`), les posts en portent un
-- tableau (colonne `labels`). Même logique, deux fonctions : une fonction
-- générique devrait passer par `to_jsonb(NEW)`, ce qui coûte une sérialisation
-- de la ligne entière à chaque écriture d'insight.
--
-- LA RÈGLE, EN UNE PHRASE : pas de source, pas de date. C'est ce qui permet à
-- l'annulation de fonctionner — elle remet la ligne à (label NULL,
-- label_source NULL) ; sans cette branche, le trigger verrait « le label a
-- changé » et ré-horodaterait à now() la ligne qu'on vient de vider.

CREATE OR REPLACE FUNCTION public.stamp_label_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.label_source IS NULL THEN
        NEW.label_at := NULL;
    ELSIF TG_OP = 'INSERT'
       OR NEW.label        IS DISTINCT FROM OLD.label
       OR NEW.label_source IS DISTINCT FROM OLD.label_source THEN
        NEW.label_at := now();
    END IF;
    -- Sinon : réécriture à l'identique (le worker ré-upsert la même valeur à
    -- chaque passage) — la date ne bouge pas, l'étiquette n'a pas changé.
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.stamp_label_at_posts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.label_source IS NULL THEN
        NEW.label_at := NULL;
    ELSIF TG_OP = 'INSERT'
       OR NEW.labels       IS DISTINCT FROM OLD.labels
       OR NEW.label_source IS DISTINCT FROM OLD.label_source THEN
        NEW.label_at := now();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meta_campaign_config_label_at ON public.meta_campaign_config;
CREATE TRIGGER trg_meta_campaign_config_label_at
    BEFORE INSERT OR UPDATE ON public.meta_campaign_config
    FOR EACH ROW EXECUTE FUNCTION public.stamp_label_at();

DROP TRIGGER IF EXISTS trg_google_campaign_config_label_at ON public.google_campaign_config;
CREATE TRIGGER trg_google_campaign_config_label_at
    BEFORE INSERT OR UPDATE ON public.google_campaign_config
    FOR EACH ROW EXECUTE FUNCTION public.stamp_label_at();

DROP TRIGGER IF EXISTS trg_instagram_organic_posts_label_at ON public.instagram_organic_posts;
CREATE TRIGGER trg_instagram_organic_posts_label_at
    BEFORE INSERT OR UPDATE ON public.instagram_organic_posts
    FOR EACH ROW EXECUTE FUNCTION public.stamp_label_at_posts();

-- Index partiels sur label_source = 'ai' : l'annulation ne cherche jamais autre
-- chose, et l'index reste minuscule même quand tout est étiqueté à la main.

CREATE INDEX IF NOT EXISTS idx_meta_cfg_label_ia
    ON public.meta_campaign_config (user_id, label_at DESC)
    WHERE label_source = 'ai';

CREATE INDEX IF NOT EXISTS idx_google_cfg_label_ia
    ON public.google_campaign_config (user_id, label_at DESC)
    WHERE label_source = 'ai';

CREATE INDEX IF NOT EXISTS idx_insta_posts_label_ia
    ON public.instagram_organic_posts (user_id, label_at DESC)
    WHERE label_source = 'ai';


-- ============================================================================
-- 21) instagram_posts_par_user.sql — VOLONTAIREMENT ABSENT DE CE FICHIER.
--
--     C'est la seule migration du dossier qui EFFACE des lignes. Elle corrige
--     un vrai bug (post_id était unique GLOBALEMENT : deux comptes Pulse
--     suivant la même page Instagram se volaient leurs posts à chaque récolte,
--     mesuré à 200/200 en production), et pour poser la bonne unicité
--     (user_id, post_id) elle doit d'abord dédoublonner :
--
--         DELETE FROM public.instagram_organic_posts a
--         USING public.instagram_organic_posts b
--         WHERE a.user_id = b.user_id AND a.post_id = b.post_id AND a.id < b.id;
--
--     …précédé de deux boucles qui suppriment la contrainte et l'index uniques
--     hérités. Ce fichier-ci se veut rejouable les yeux fermés : on n'y met
--     rien qui efface. Un DELETE se lance en le regardant, une fois, en sachant
--     ce qu'on fait.
--
--     À FAIRE, SÉPARÉMENT ET UNE SEULE FOIS :
--         supabase/migrations/instagram_posts_par_user.sql
--     Tant qu'elle n'a pas tourné, le bug de vol de posts reste ouvert dès que
--     deux comptes suivent la même page Instagram.
--
--     Seul l'index de LECTURE en est repris ci-dessous : il ne supprime rien,
--     ne peut pas échouer sur des doublons, et toutes les requêtes de l'app
--     filtrent par user_id puis trient par date.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_instagram_posts_user_date
    ON public.instagram_organic_posts (user_id, date DESC);


-- ============================================================================
-- 22) reco_feedback.theme/title + reco_feedback_uq2 — voir
--     reco_feedback_contexte.sql (source de vérité, commentaire complet).
--
--     `theme` DANS LA CLÉ D'UNICITÉ, PAS JUSTE UNE COLONNE À CÔTÉ : une
--     clé-règle générique (ex. « gaspillage ») apparaît sur PLUSIEURS cartes
--     de thème du même rapport — sans `theme` dans la clé, un refus « pas
--     pour moi » sur le thème A et un autre sur le thème B, la même semaine,
--     retombaient sur la MÊME ligne (musellement transféré au lieu d'être
--     scopé par thème). `theme` est NOT NULL DEFAULT '' (jamais NULL : deux
--     NULL ne sont jamais égaux dans une contrainte UNIQUE Postgres, ce qui
--     aurait cassé l'upsert des réglages compte-entier). `title` reste
--     nullable et hors clé — un texte d'affichage, jamais un identifiant.
--
--     DROP CONSTRAINT + ADD CONSTRAINT, même patron que la section 2
--     (`ga4_insights_uq` → `ga4_insights_uq2`) : sans danger sur les lignes
--     déjà en base, qui héritent toutes de `theme=''` au rejeu.
-- ============================================================================

ALTER TABLE public.reco_feedback
    ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS title text;

ALTER TABLE public.reco_feedback DROP CONSTRAINT IF EXISTS reco_feedback_uq;
ALTER TABLE public.reco_feedback DROP CONSTRAINT IF EXISTS reco_feedback_uq2;
ALTER TABLE public.reco_feedback
    ADD CONSTRAINT reco_feedback_uq2 UNIQUE (user_id, reco_key, week_start, theme);

CREATE INDEX IF NOT EXISTS idx_reco_feedback_theme
    ON public.reco_feedback (user_id, theme, reco_key)
    WHERE theme <> '';


-- ============================================================================
-- 23) suivi_actions.verdict — voir suivi_actions_verdict.sql (source de
--     vérité, commentaire complet).
--
--     Le verdict d'une action (`"better"`/`"worse"`/`"stable"`) était calculé
--     À LA VOLÉE dans `build_report.py`, jamais réécrit en base : introuvable
--     la semaine suivante, donc inutilisable pour repondérer un conseil
--     `"done"` selon ce qu'il a RÉELLEMENT donné (`saas/core/reco_engine.py`).
--     Nullable, écrite UNE FOIS au moment où le verdict tombe.
--
--     Index sur `check_at`, PAS `decided_at` : `fetch_reco_verdicts`
--     (`scripts/fetch_data.py`) filtre et trie sur `check_at` — c'est la seule
--     date qui dit fidèlement quand le verdict est réellement tombé
--     (`check_at` est recalculé à `done_at + 14j` au clic « ✓ C'est fait »,
--     qui peut survenir bien après `decided_at`).
-- ============================================================================

ALTER TABLE public.suivi_actions
    ADD COLUMN IF NOT EXISTS verdict text;

DO $$
BEGIN
    ALTER TABLE public.suivi_actions
        ADD CONSTRAINT suivi_actions_verdict_ck
        CHECK (verdict IS NULL OR verdict IN ('better', 'worse', 'stable'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_suivi_actions_verdict
    ON public.suivi_actions (user_id, reco_key, check_at DESC)
    WHERE verdict IS NOT NULL;


-- ============================================================================
-- CONTRÔLE — juste avant la toute fin du fichier. Un `NOTIFY pgrst, 'reload
-- schema'` la suit (voir la note en toute fin de fichier) : ce n'est donc PLUS
-- la dernière instruction, et le SQL editor de Supabase n'affiche que le
-- résultat de la toute dernière instruction jouée. Rejouer le fichier en
-- entier affichera « Success. No rows returned », pas ce tableau. Pour le
-- voir, sélectionne uniquement ce bloc (du `WITH attendu` ci-dessous jusqu'au
-- `ORDER BY` qui le termine) et exécute cette sélection seule
-- (Cmd/Ctrl+Entrée) — APRÈS avoir joué le fichier complet, jamais avant : lue
-- trop tôt, sur une base où tout n'est pas encore installé, elle remonte des
-- ✗ normaux (rien n'a de raison d'être là) qui n'ont rien à voir avec un
-- échec. C'est seulement une fois le fichier entier rejoué que ces mêmes ✗
-- deviennent le signal utile.
--
-- Ce qui manque remonte EN HAUT du tableau. Si la première ligne dit « ✓ »,
-- il ne manque rien. Rien à interpréter, rien à comparer à la main.
--
-- Trois familles dans le même tableau :
--   table / colonne / fonction — ce que ce fichier installe
--   sécurité                   — les jetons ne sont lisibles par aucun invité
--   réglage                    — les défauts qui, absents, échouent en silence
-- ============================================================================

WITH attendu(kind, obj, col) AS (VALUES
    -- ── Tables supposées déjà là (posées à la main avant les migrations) ────
    ('t', 'profiles',                 NULL::text),
    ('t', 'connected_accounts',       NULL),
    ('t', 'instagram_organic_posts',  NULL),
    ('t', 'followers_history',        NULL),
    -- ── Tables installées par ce fichier ───────────────────────────────────
    ('t', 'meta_ads_insights',        NULL),
    ('t', 'meta_campaign_config',     NULL),
    ('t', 'google_ads_insights',      NULL),
    ('t', 'google_campaign_config',   NULL),
    ('t', 'google_ads_ad_insights',   NULL),
    ('t', 'ga4_insights',             NULL),
    ('t', 'ga4_events',               NULL),
    ('t', 'reco_feedback',            NULL),
    ('t', 'insight_feedback',         NULL),
    ('t', 'suivi_actions',            NULL),
    ('t', 'channel_budgets',          NULL),
    ('t', 'weekly_reports',           NULL),
    ('t', 'dashboard_members',        NULL),
    ('t', 'platform_budgets',         NULL),
    ('t', 'platform_changes',         NULL),
    ('t', 'theme_ga4_events',         NULL),
    ('t', 'fetch_progress',           NULL),   -- §14ter
    ('t', 'theme_objectifs',          NULL),   -- §14quater
    ('t', 'conversion_categories',    NULL),   -- §14quinquies
    ('t', 'ga4_event_categories',     NULL),   -- §14quinquies
    -- ── Colonnes : chacune est une fonctionnalité qui, sinon, refuse de ─────
    --    s'enregistrer avec un message d'erreur
    ('c', 'profiles',                 'labels'),               -- §1
    ('c', 'profiles',                 'objectif'),             -- §3
    ('c', 'profiles',                 'user_profile'),         -- §3
    ('c', 'profiles',                 'business_type'),        -- §7
    ('c', 'profiles',                 'budget_range'),         -- §7
    ('c', 'profiles',                 'time_budget'),          -- §7
    ('c', 'profiles',                 'frustration'),          -- §7
    ('c', 'profiles',                 'site_url'),             -- §18
    ('c', 'profiles',                 'ga4_event_catalog'),    -- §14bis
    ('c', 'theme_ga4_events',         'rang'),                 -- §14bis
    ('c', 'connected_accounts',       'provider'),             -- §4
    ('c', 'connected_accounts',       'google_refresh_token'), -- §4
    ('c', 'connected_accounts',       'google_customer_id'),   -- §4
    ('c', 'connected_accounts',       'ga4_property_id'),      -- §4
    ('c', 'ga4_insights',             'campaign'),             -- §2
    ('c', 'reco_feedback',            'comment'),              -- §3
    ('c', 'meta_campaign_config',     'effective_status'),     -- §0
    ('c', 'meta_campaign_config',     'label_source'),         -- §8
    ('c', 'meta_campaign_config',     'label_at'),             -- §20
    ('c', 'meta_campaign_config',     'start_date'),           -- §16
    ('c', 'meta_campaign_config',     'end_date'),             -- §16
    ('c', 'meta_campaign_config',     'landing_url'),          -- §17
    ('c', 'google_campaign_config',   'label_source'),         -- §8
    ('c', 'google_campaign_config',   'label_at'),             -- §20
    ('c', 'google_campaign_config',   'start_date'),           -- §16
    ('c', 'google_campaign_config',   'end_date'),             -- §16
    ('c', 'google_campaign_config',   'landing_url'),          -- §17
    ('c', 'instagram_organic_posts',  'label_source'),         -- §8
    ('c', 'instagram_organic_posts',  'label_at'),             -- §20
    ('c', 'suivi_actions',            'done_at'),              -- §10
    ('c', 'suivi_actions',            'detail'),               -- §11
    ('c', 'suivi_actions',            'kind'),                 -- §19
    ('c', 'reco_feedback',            'theme'),                -- §22
    ('c', 'reco_feedback',            'title'),                -- §22
    ('c', 'suivi_actions',            'verdict'),              -- §23
    -- ── Fonctions ──────────────────────────────────────────────────────────
    ('f', 'public.set_updated_at()',       NULL),
    ('f', 'public.a_acces(uuid)',          NULL),   -- §12
    ('f', 'public.peut_editer(uuid)',      NULL),   -- §12
    ('f', 'public.stamp_label_at()',       NULL),   -- §20
    ('f', 'public.stamp_label_at_posts()', NULL)    -- §20
),
catalogue AS (
    SELECT
        CASE a.kind WHEN 't' THEN 'table'
                    WHEN 'c' THEN 'colonne'
                    ELSE          'fonction' END        AS famille,
        a.obj || coalesce('.' || a.col, '')             AS objet,
        CASE
            WHEN a.kind = 'f' THEN
                CASE WHEN to_regprocedure(a.obj) IS NOT NULL
                     THEN '✓' ELSE '✗ FONCTION ABSENTE' END
            WHEN to_regclass('public.' || a.obj) IS NULL THEN '✗ TABLE ABSENTE'
            WHEN a.kind = 't' THEN '✓'
            WHEN EXISTS (SELECT 1 FROM information_schema.columns c
                         WHERE c.table_schema = 'public'
                           AND c.table_name   = a.obj
                           AND c.column_name  = a.col) THEN '✓'
            ELSE '✗ COLONNE ABSENTE'
        END                                             AS etat
    FROM attendu a
),
securite AS (
    SELECT 'sécurité'::text,
           'connected_accounts — aucune politique de partage'::text,
           CASE WHEN EXISTS (
                    SELECT 1 FROM pg_policies
                    WHERE schemaname = 'public' AND tablename = 'connected_accounts'
                      AND (coalesce(qual, '') || ' ' || coalesce(with_check, ''))
                          ~ '(a_acces|peut_editer)')
                THEN '✗ FUITE DE JETONS — un invité lit connected_accounts'
                ELSE '✓' END
    UNION ALL
    SELECT 'sécurité',
           'connected_accounts — RLS active',
           CASE WHEN coalesce((SELECT c.relrowsecurity FROM pg_class c
                               WHERE c.oid = to_regclass('public.connected_accounts')), false)
                THEN '✓' ELSE '✗ RLS ÉTEINTE SUR LA TABLE DES JETONS' END
    UNION ALL
    SELECT 'sécurité',
           'profiles — aucun jeton (cette table EST partagée)',
           CASE WHEN EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'profiles'
                      AND column_name ~ '(token|secret|refresh)')
                THEN '✗ UN JETON TRAÎNE SUR profiles, LU PAR LES INVITÉS'
                ELSE '✓' END
    UNION ALL
    SELECT 'réglage',
           'profiles.fetch_schedule — défaut ''Monday''',
           CASE WHEN coalesce((SELECT column_default FROM information_schema.columns
                               WHERE table_schema = 'public' AND table_name = 'profiles'
                                 AND column_name = 'fetch_schedule'), '') LIKE '%Monday%'
                THEN '✓' ELSE '✗ sans défaut, un profil n''est jamais récolté' END
)
SELECT famille, objet, etat
FROM (SELECT * FROM catalogue UNION ALL SELECT * FROM securite) r(famille, objet, etat)
ORDER BY (etat = '✓'), famille, objet;

-- ============================================================================
-- FIN — la dernière section de FOND du fichier (tables, policies, contrôle).
-- Ce qui suit n'installe plus rien : deux requêtes de contrôle annexes, à
-- lancer à part (A et B ci-dessous), puis un unique `NOTIFY pgrst, 'reload
-- schema'` exécutable, tout en bas du fichier — voir la note qui l'accompagne.
--
-- Deux contrôles qui ne tiennent pas dans le tableau ci-dessus, à lancer à part
-- le jour où le partage d'équipe pose question :
--
--   A) Ce que l'invité peut lire — doit lister les 22 tables de la section 15.
--      (Le chiffre annoncé ici était 20 : il datait d'avant conversion_categories
--      et ga4_event_categories. Compté sur la liste, pas de mémoire.)
--      SELECT tablename, policyname FROM pg_policies
--      WHERE schemaname = 'public' AND policyname LIKE 'partage_%'
--      ORDER BY tablename, policyname;
--
--   B) Les tables qu'un invité NE voit PAS. Attendu : connected_accounts
--      (volontaire), dashboard_members (règle propre dm_select), et les tables
--      de l'ancien Streamlit (ai_recommendations, ai_feedback, free_data,
--      paid_data). Toute AUTRE ligne est un module que l'invité verra vide :
--      SELECT c.relname
--      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--      WHERE n.nspname = 'public' AND c.relkind = 'r'
--        AND EXISTS (SELECT 1 FROM information_schema.columns
--                    WHERE table_schema = 'public' AND table_name = c.relname
--                      AND column_name IN ('user_id', 'id'))
--        AND NOT EXISTS (SELECT 1 FROM pg_policies p
--                        WHERE p.schemaname = 'public' AND p.tablename = c.relname
--                          AND p.cmd IN ('SELECT', 'ALL')
--                          AND coalesce(p.qual, '') ~ 'a_acces')
--      ORDER BY 1;
-- ============================================================================

-- Supabase recharge normalement le cache de schéma de PostgREST après un DDL
-- passé par le SQL editor — sans ça, aucune des tables de ce fichier ne
-- répondrait jamais en REST, alors qu'elles le font toutes aujourd'hui. Mais
-- ce rechargement automatique n'est pas garanti instantané ni infaillible :
-- s'il prend du retard ou ne se déclenche pas pour une table neuve (ex.
-- fetch_progress, créée section 14ter), elle peut répondre PGRST205 (« table
-- introuvable ») côté API alors qu'elle existe bien en base — et ça vaut pour
-- TOUTE requête REST vers cette table, écriture comme lecture, y compris avec
-- la clé service_role : cette clé fait sauter la RLS, pas ce cache. Voir le
-- commentaire détaillé en fin de `fetch_progress.sql` pour le symptôme que ça
-- produit côté écran. NOTIFY force ce rechargement explicitement, en secours —
-- commande standard, non destructive.
NOTIFY pgrst, 'reload schema';
