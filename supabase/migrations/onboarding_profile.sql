-- Profil d'onboarding express (4 questions à la première connexion Pulse).
-- Calibre les recos (repères selon budget, volume selon temps dispo) et
-- nourrit le persona IA dès le départ. Idempotent.

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS business_type text,   -- 'ecommerce' | 'local' | 'services' | 'createur'
    ADD COLUMN IF NOT EXISTS budget_range  text,   -- '0-500' | '500-2000' | '2000-10000' | '10000+'
    ADD COLUMN IF NOT EXISTS time_budget   text,   -- '30min' | '1-2h' | '3h+'
    ADD COLUMN IF NOT EXISTS frustration   text;   -- 'comprendre' | 'temps' | 'rentabilite' | 'stagnation'
