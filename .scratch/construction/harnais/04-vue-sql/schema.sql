-- Sous-ensemble du schéma réel, strictement les colonnes que la vue lit.
-- Ni RLS ni auth.users : le harnais vérifie l'ARITHMÉTIQUE de la vue.
DROP TABLE IF EXISTS meta_ads_insights, google_ads_insights, meta_campaign_config,
    google_campaign_config, ga4_insights, ga4_events, theme_ga4_events,
    instagram_organic_posts CASCADE;

CREATE TABLE meta_ads_insights (
    user_id uuid NOT NULL, date_start date NOT NULL,
    campaign_name text NOT NULL DEFAULT '', ad_name text NOT NULL DEFAULT '',
    impressions integer NOT NULL DEFAULT 0, clicks integer NOT NULL DEFAULT 0,
    spend numeric(10,4) NOT NULL DEFAULT 0);

CREATE TABLE google_ads_insights (
    user_id uuid NOT NULL, date_start date NOT NULL,
    campaign_id text NOT NULL, campaign_name text NOT NULL DEFAULT '',
    impressions integer NOT NULL DEFAULT 0, clicks integer NOT NULL DEFAULT 0,
    cost_micros bigint NOT NULL DEFAULT 0);

CREATE TABLE meta_campaign_config (
    user_id uuid NOT NULL, campaign_name text NOT NULL, label text,
    PRIMARY KEY (user_id, campaign_name));

CREATE TABLE google_campaign_config (
    user_id uuid NOT NULL, campaign_id text NOT NULL,
    campaign_name text NOT NULL DEFAULT '', label text,
    PRIMARY KEY (user_id, campaign_id));

CREATE TABLE ga4_insights (
    user_id uuid NOT NULL, date date NOT NULL,
    source text NOT NULL DEFAULT '', medium text NOT NULL DEFAULT '',
    campaign text NOT NULL DEFAULT '',
    sessions integer NOT NULL DEFAULT 0,
    conversions numeric(12,2) NOT NULL DEFAULT 0,
    revenue numeric(14,2) NOT NULL DEFAULT 0);

CREATE TABLE ga4_events (
    user_id uuid NOT NULL, date date NOT NULL,
    source text NOT NULL DEFAULT '', medium text NOT NULL DEFAULT '',
    campaign text NOT NULL DEFAULT '', event_name text NOT NULL,
    event_count integer NOT NULL DEFAULT 0,
    event_value numeric(14,2) NOT NULL DEFAULT 0);

CREATE TABLE theme_ga4_events (
    user_id uuid NOT NULL, label text NOT NULL, event_name text NOT NULL,
    rang text NOT NULL DEFAULT 'secondaire');

-- LES COLONNES DE LA PRODUCTION, ET RIEN D'AUTRE. Ce harnais déclarait
-- `eng numeric` : la colonne n'existe nulle part, et le harnais prouvait donc
-- la vue contre une base qui n'existe nulle part (ticket 44). Les noms
-- ci-dessous sont ceux relevés sur `public.instagram_organic_posts` du projet
-- de production le 2026-09-13. La table est ANTÉRIEURE aux migrations : aucun
-- fichier de ce dépôt ne la crée, elle ne peut donc que se recopier.
--
-- LES COMPTES SONT EN `integer`, comme `reach` et pour la même raison : c'est
-- le type qui fait tomber la division entière si la vue oublie un `::numeric`.
-- Un harnais choisit le type le plus SÉVÈRE des types plausibles — celui qui
-- révèle le défaut plutôt que celui qui le masque.
CREATE TABLE instagram_organic_posts (
    id bigserial, created_at timestamptz DEFAULT now(),
    user_id uuid NOT NULL, post_id text NOT NULL,
    type text, caption text, date timestamptz NOT NULL,
    likes integer, comments integer, saved integer,
    reach integer, views integer, follows integer,
    labels text[], label_source text, label_at timestamptz, media_url text);

-- Les index du schéma réel, et EUX SEULS : un harnais qui en invente donne des
-- plans plus beaux que la production.
CREATE INDEX idx_meta_ads_insights_user_date   ON meta_ads_insights (user_id, date_start DESC);
CREATE INDEX idx_google_ads_insights_user_date ON google_ads_insights (user_id, date_start DESC);
CREATE INDEX idx_ga4_insights_user_date        ON ga4_insights (user_id, date DESC);
CREATE INDEX idx_ga4_events_user_date          ON ga4_events (user_id, date DESC);
CREATE INDEX idx_theme_ga4_events_user         ON theme_ga4_events (user_id, label);
CREATE UNIQUE INDEX instagram_organic_posts_user_post_uq
    ON instagram_organic_posts (user_id, post_id);
