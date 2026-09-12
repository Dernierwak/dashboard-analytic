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

CREATE TABLE instagram_organic_posts (
    user_id uuid NOT NULL, post_id text NOT NULL,
    date timestamptz NOT NULL, type text, labels text[],
    -- `reach` en ENTIER, comme un compte : c'est le type qui fait tomber la
    -- division entière si la vue oublie son `::numeric`.
    reach integer, eng numeric);

-- Les index du schéma réel, et EUX SEULS : un harnais qui en invente donne des
-- plans plus beaux que la production.
CREATE INDEX idx_meta_ads_insights_user_date   ON meta_ads_insights (user_id, date_start DESC);
CREATE INDEX idx_google_ads_insights_user_date ON google_ads_insights (user_id, date_start DESC);
CREATE INDEX idx_ga4_insights_user_date        ON ga4_insights (user_id, date DESC);
CREATE INDEX idx_ga4_events_user_date          ON ga4_events (user_id, date DESC);
CREATE INDEX idx_theme_ga4_events_user         ON theme_ga4_events (user_id, label);
CREATE UNIQUE INDEX instagram_organic_posts_user_post_uq
    ON instagram_organic_posts (user_id, post_id);
