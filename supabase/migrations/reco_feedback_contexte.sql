-- ============================================================================
-- LE CONTEXTE D'UN FEEDBACK : sur QUEL thème, sur QUELLE piste (TASK-025)
-- ============================================================================
--
-- POURQUOI CE FICHIER EXISTE
-- `reco_feedback` ne portait jusqu'ici que `(reco_key, reaction, week_start,
-- comment)`. Deux trous du Graphe B (composition par thème) en découlaient :
--
--   1. Les clés des pistes IA (`ai_<theme>_<i>`) sont POSITIONNELLES : l'ordre
--      de réponse de Gemini change d'une semaine à l'autre. Un `reco_key`
--      d'une semaine passée ne dit donc rien d'une piste précise la semaine
--      suivante — seul le TEXTE (`title`) de la piste, au moment du clic,
--      permet à `_theme_ai_recos` (`saas/traitement/build_report.py`) de savoir
--      « ne repropose pas une idée proche de X » / « celle-ci a marché ».
--   2. `not_for_me` sur une clé-règle générique (ex. « gaspillage », partagée
--      par TOUS les thèmes qui déclenchent cette règle) muselait la règle sur
--      TOUT LE COMPTE dès qu'un thème la refusait — `theme` permet de scoper
--      le museau à (reco_key, thème) au lieu de reco_key seul.
--
-- `theme` DANS LA CLÉ D'UNICITÉ, PAS JUSTE UNE COLONNE À CÔTÉ (rejet du
-- checker, 1re passe) : `reco_key` (une clé-règle générique, ex. « gaspillage »)
-- apparaît sur PLUSIEURS cartes de thème du MÊME rapport (jusqu'à 15 thèmes).
-- Sans `theme` dans `reco_feedback_uq`, un clic « pas pour moi » sur le thème A
-- puis un clic sur le thème B LA MÊME SEMAINE retombaient sur la MÊME ligne
-- (même `reco_key` + `week_start`) : le museau était DÉPLACÉ de A vers B, pas
-- dupliqué — A redevenait muet. Une même réaction sur des thèmes différents
-- doit produire des LIGNES DIFFÉRENTES, donc `theme` doit faire partie de la
-- clé qui les distingue.
--
-- `theme` NOT NULL DEFAULT '' — JAMAIS NULL, ET C'EST VOULU. PostgreSQL ne
-- considère jamais deux NULL comme égaux dans une contrainte UNIQUE : si
-- `theme` restait NULL pour les conseils compte-entier (réglages GA4/funnel),
-- rien n'empêcherait plusieurs lignes de réglages pour le même
-- `(reco_key, week_start)` — et `ON CONFLICT` (upsert) ne les fusionnerait
-- jamais, pour la même raison. `''` est un vrai valeur comparable : les
-- réglages (pas de thème) partagent tous `theme=''`, exactement comme avant
-- cette migration (une seule ligne par `reco_key` et par semaine).
--
-- MÊME PATRON QUE `ga4_events.sql` (section 1, `ga4_insights_uq` →
-- `ga4_insights_uq2`) : `ADD COLUMN ... NOT NULL DEFAULT ''` PUIS
-- `DROP CONSTRAINT` + `ADD CONSTRAINT` avec la nouvelle colonne dans la clé.
-- SANS DANGER sur les lignes déjà en base : le DEFAULT leur donne toutes
-- `theme=''` au moment du rejeu, donc elles restent uniques par construction
-- vis-à-vis de la nouvelle contrainte — aucune ne peut entrer en collision.
--
-- `title`, lui, reste nullable et hors clé : c'est un texte d'affichage/de
-- contexte, jamais un identifiant.
--
-- Écrites UNIQUEMENT à partir du clic qui suit cette migration
-- (`saas/web/app/actions.ts`) : les feedbacks déjà en base héritent de
-- `theme=''`/`title=NULL` — on ne devine pas rétroactivement le thème ou le
-- texte d'un feedback passé.
--
-- Idempotent : rejouable sans risque. Aucun DROP de données, aucun DELETE —
-- seule une CONTRAINTE (pas une table, pas une colonne) est supprimée puis
-- reposée, à l'identique du patron `ga4_events.sql`.
-- ============================================================================

ALTER TABLE public.reco_feedback
    ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS title text;

ALTER TABLE public.reco_feedback DROP CONSTRAINT IF EXISTS reco_feedback_uq;
ALTER TABLE public.reco_feedback DROP CONSTRAINT IF EXISTS reco_feedback_uq2;
ALTER TABLE public.reco_feedback
    ADD CONSTRAINT reco_feedback_uq2 UNIQUE (user_id, reco_key, week_start, theme);

-- Sert le museau `not_for_me` par (reco_key, thème) — voir
-- `scripts/fetch_data.py::fetch_reco_theme_context`. Partiel sur `theme <> ''` :
-- les lignes « réglages » (pas de thème) n'ont rien à y faire, elles ne sont
-- jamais lues par ce chemin.
CREATE INDEX IF NOT EXISTS idx_reco_feedback_theme
    ON public.reco_feedback (user_id, theme, reco_key)
    WHERE theme <> '';
