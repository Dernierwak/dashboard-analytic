-- ============================================================
-- channel_budgets — budget publicitaire PAR MOIS et par canal
--
-- Remplace le budget global unique (profiles.meta_budget_global /
-- google_budget_global) qu'il fallait modifier chaque mois à la main.
--   • 1 ligne = (canal, mois, montant)
--   • Mois sans ligne → on reporte le dernier budget connu (carry-forward,
--     géré côté app) → on ne ressaisit QUE quand le budget change.
--   • La somme des mois donne le budget annuel.
--
-- Idempotent : ré-exécutable sans erreur.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.channel_budgets (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    channel     text NOT NULL,                 -- 'meta' | 'google' | (futurs canaux)
    month       date NOT NULL,                 -- toujours le 1er du mois (YYYY-MM-01)
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

-- Reprise de l'existant : le budget global actuel devient le budget du mois
-- en cours (si pas déjà saisi).
INSERT INTO public.channel_budgets (user_id, channel, month, amount)
SELECT id, 'meta', date_trunc('month', now())::date, meta_budget_global
FROM public.profiles
WHERE coalesce(meta_budget_global, 0) > 0
ON CONFLICT (user_id, channel, month) DO NOTHING;

INSERT INTO public.channel_budgets (user_id, channel, month, amount)
SELECT id, 'google', date_trunc('month', now())::date, google_budget_global
FROM public.profiles
WHERE coalesce(google_budget_global, 0) > 0
ON CONFLICT (user_id, channel, month) DO NOTHING;
