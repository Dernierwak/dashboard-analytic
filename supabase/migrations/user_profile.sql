-- ============================================================
-- Commentaires de feedback → profil utilisateur pour l'IA
--
-- 1) reco_feedback.comment : commentaire libre attaché à un conseil
--    (l'utilisateur peut commenter SANS réagir → reaction devient nullable)
-- 2) profiles.user_profile : persona synthétisé par l'IA à partir de
--    l'accumulation des commentaires + réactions + objectif. L'IA lit ce
--    profil pour adapter le TON et les PRIORITÉS de ses retours selon le
--    type d'utilisateur.
--
-- Idempotent : ré-exécutable sans erreur.
-- ============================================================

-- 1) Commentaire libre par conseil ------------------------------------------
ALTER TABLE public.reco_feedback
    ADD COLUMN IF NOT EXISTS comment text;

-- Un commentaire peut exister sans réaction 👍/👎/✓.
ALTER TABLE public.reco_feedback
    ALTER COLUMN reaction DROP NOT NULL;

-- 2) Persona dérivé, stocké sur le profil -----------------------------------
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS user_profile            text,
    ADD COLUMN IF NOT EXISTS user_profile_updated_at timestamptz;
