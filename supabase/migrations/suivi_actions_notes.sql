-- ============================================================================
-- Tes propres notes dans le fil
-- ============================================================================
--
-- Le fil montre ce que Pulse a conseillé et ce que les plateformes ont fait.
-- Il manquait le troisième tiers : ce que TU as fait et que personne ne peut
-- deviner — « refait les visuels », « changé le ciblage à la main », « le
-- concurrent a lancé une promo ».
--
-- Une note n'est PAS une action : elle n'a ni indicateur, ni baseline, ni
-- échéance, donc aucun verdict ne peut tomber dessus. C'est ce que `kind`
-- distingue, et c'est ce qui interdit de lui coller une pastille de verdict.
-- Elle vit dans la même table parce qu'elle vit sur la même frise, au même
-- endroit, triée par la même date.
--
-- À exécuter dans l'éditeur SQL de Supabase.
-- ============================================================================

ALTER TABLE public.suivi_actions
    ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'action';

-- 'action' : née d'un conseil, elle sera jugée.
-- 'note'   : écrite à la main, elle ne sera jamais jugée.
ALTER TABLE public.suivi_actions
    DROP CONSTRAINT IF EXISTS suivi_actions_kind_chk;
ALTER TABLE public.suivi_actions
    ADD CONSTRAINT suivi_actions_kind_chk CHECK (kind IN ('action', 'note'));

-- La contrainte d'unicité porte sur (user_id, reco_key, decided_at). Deux
-- notes écrites le même jour auraient la même clé si on ne la rendait pas
-- unique : `reco_key` d'une note vaut donc 'note:<uuid>', généré côté serveur.

CREATE INDEX IF NOT EXISTS idx_suivi_actions_kind
    ON public.suivi_actions (user_id, kind, decided_at DESC);
