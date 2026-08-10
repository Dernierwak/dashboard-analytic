-- ============================================================
-- Les dates DÉCLARÉES d'une campagne — début et fin programmés
--
-- Pourquoi elles ne peuvent pas se déduire de ce qu'on a déjà : nos barres de
-- frise viennent des jours où une campagne a RÉELLEMENT dépensé. Une campagne
-- programmée jusqu'en décembre et une campagne arrêtée hier laissent
-- exactement la même trace. La seule façon de distinguer les deux, c'est de
-- demander à la plateforme ce qui y est écrit.
--
-- Aucune table nouvelle : `meta_campaign_config` et `google_campaign_config`
-- portent déjà le nom, le libellé et le statut de chaque campagne, sont déjà
-- mises à jour à chaque récolte, et sont déjà dans les règles de partage
-- d'équipe (equipe_partage.sql). Deux colonnes suffisent.
--
-- `end_date` NULL a DEUX sens qu'il faut savoir distinguer à la lecture :
--   · la ligne existe et end_date est NULL → la campagne n'a pas de fin
--     programmée (« sans date de fin ») ;
--   · aucune ligne pour cette campagne → on n'a rien récolté, on ne sait pas.
-- L'affichage ne montre un prévisionnel que dans le premier cas.
--
-- Note Google Ads : l'API renvoie 2037-12-30 pour « pas de fin ». Le sentinelle
-- est normalisé en NULL à la récolte (google_script/fetch_google_ads.py), pas
-- ici — on ne stocke jamais une date qui n'a pas de sens.
-- ============================================================

ALTER TABLE public.meta_campaign_config
    ADD COLUMN IF NOT EXISTS start_date date DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS end_date   date DEFAULT NULL;

ALTER TABLE public.google_campaign_config
    ADD COLUMN IF NOT EXISTS start_date date DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS end_date   date DEFAULT NULL;
