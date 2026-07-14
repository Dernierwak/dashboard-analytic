-- ============================================================
-- fetch_schedule : jour par défaut + backfill des NULL
--
-- Problème : un profil sans fetch_schedule (NULL) n'est jamais fetché par le
-- cron (WHERE fetch_schedule = <jour>), en silence. Deux comptes étaient déjà
-- dans ce cas.
--
-- 1) DEFAULT 'Monday' → tout nouveau profil reçoit un jour, même si l'insert
--    (trigger handle_new_user) ne précise pas fetch_schedule.
-- 2) Backfill → les profils NULL existants passent à lundi.
--
-- Idempotent : ré-exécutable sans erreur.
-- ============================================================

ALTER TABLE public.profiles
    ALTER COLUMN fetch_schedule SET DEFAULT 'Monday';

UPDATE public.profiles
    SET fetch_schedule = 'Monday'
    WHERE fetch_schedule IS NULL;
