-- ============================================================================
-- LE VERDICT, PERSISTÉ (TASK-025)
-- ============================================================================
--
-- POURQUOI CE FICHIER EXISTE
-- Le verdict d'une action (`"better"`/`"worse"`/`"stable"`) était jusqu'ici
-- calculé À LA VOLÉE dans `build_report.py` (comparaison de l'indicateur
-- suivi à sa `baseline`), et jamais réécrit en base : une fois affiché dans le
-- rapport de la semaine où il tombe, il redevenait introuvable la semaine
-- suivante.
--
-- Ça empêchait de repondérer un conseil `"done"` SELON ce qu'il a réellement
-- donné : la reco confirmée qui a amélioré un KPI et celle cochée « fait »
-- sans jamais avoir eu d'effet mesurable étaient traitées à l'identique
-- (`saas/core/reco_engine.py::build_recos`). Cette colonne fixe le verdict
-- le jour où il tombe — le worker le lit ensuite pour repondérer.
--
-- Nullable, écrite UNE FOIS par `build_report.py` au moment précis où le
-- verdict est calculé (jamais avant — une ligne encore `running`, ou `"done"`/
-- `"auto"` mais pas encore à échéance, n'a simplement rien à écrire ici).
-- Aucune ligne existante n'est touchée par cette migration : elles restent à
-- NULL jusqu'à leur prochain passage dans la boucle de mesure.
--
-- Idempotent : rejouable sans risque. Aucun DROP, aucun DELETE.
-- ============================================================================

ALTER TABLE public.suivi_actions
    ADD COLUMN IF NOT EXISTS verdict text;

DO $$
BEGIN
    ALTER TABLE public.suivi_actions
        ADD CONSTRAINT suivi_actions_verdict_ck
        CHECK (verdict IS NULL OR verdict IN ('better', 'worse', 'stable'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Sert `scripts/fetch_data.py::fetch_reco_verdicts` (le dernier verdict connu
-- par reco_key, sur une fenêtre récente) — l'index porte sur `check_at`, PAS
-- `decided_at` : `fetch_reco_verdicts` filtre et trie sur `check_at` (rejet du
-- checker, 2e passe — `decided_at` rendait le verdict illisible dès que le
-- délai entre « ▶ Je le teste » et « ✓ C'est fait » dépassait la fenêtre de
-- lecture), un index sur une autre colonne que celle réellement filtrée ne
-- servirait à rien à cette requête.
CREATE INDEX IF NOT EXISTS idx_suivi_actions_verdict
    ON public.suivi_actions (user_id, reco_key, check_at DESC)
    WHERE verdict IS NOT NULL;
