-- Le décor minimal : `auth.users` (posée par Supabase, jamais par une migration
-- du dépôt) et `suivi_actions` TELLE QUE les sections 9→11, 19 et 23 la
-- laissent — c'est-à-dire l'état de la table AVANT la migration qu'on vérifie.
-- Rien de plus : un harnais qui invente une colonne prouve quelque chose
-- d'autre que ce que David va jouer.
DROP TABLE IF EXISTS public.suivi_actions CASCADE;
DROP TABLE IF EXISTS auth.users CASCADE;
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE auth.users (id uuid PRIMARY KEY);

CREATE TABLE public.suivi_actions (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reco_key     text NOT NULL,
    title        text NOT NULL,
    theme        text,
    metric       text,
    metric_label text,
    direction    text,
    baseline     numeric(14, 4),
    decided_at   date NOT NULL DEFAULT current_date,
    check_at     date NOT NULL,
    status       text NOT NULL DEFAULT 'running',
    created_at   timestamptz NOT NULL DEFAULT now(),
    done_at      date,
    detail       jsonb,
    kind         text NOT NULL DEFAULT 'action',
    verdict      text,
    CONSTRAINT suivi_actions_uq UNIQUE (user_id, reco_key, decided_at),
    CONSTRAINT suivi_actions_kind_chk CHECK (kind IN ('action', 'note'))
);
