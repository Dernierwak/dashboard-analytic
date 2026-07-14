-- Rapport hebdo précalculé (payload JSON) — lu par Pulse (Next.js) et l'email hebdo.
-- Écrit par le Streamlit à l'ouverture du rapport (pont), puis par le worker cron.
-- Idempotent : ré-exécutable sans risque.

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
