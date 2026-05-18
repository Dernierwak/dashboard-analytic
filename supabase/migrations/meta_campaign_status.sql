-- ============================================================
-- Migration : ajouter effective_status à meta_campaign_config
-- Stocke le statut Meta de la campagne (ACTIVE/PAUSED/WITH_ISSUES/...)
-- Mis à jour à chaque fetch via l'endpoint /campaigns de l'API Meta
-- ============================================================

ALTER TABLE public.meta_campaign_config
    ADD COLUMN IF NOT EXISTS effective_status text DEFAULT NULL;
