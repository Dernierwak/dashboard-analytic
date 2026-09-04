-- ============================================================================
-- L'ORIGINE D'UNE ÉTIQUETTE, ET LE MOMENT OÙ ELLE A ÉTÉ POSÉE
--
-- POURQUOI CE FICHIER EXISTE
-- `vision_labels_ia.sql` a déjà posé `label_source` ('user' | 'ai') sur les
-- trois tables d'assignation. Il dit QUI a étiqueté ; il ne dit pas QUAND.
-- Tant que le bouton « Étiqueter tout via l'IA » demandait une validation, ça
-- suffisait. Il applique maintenant DIRECTEMENT, sans passer par l'utilisateur
-- — et une action de masse sans retour en arrière est un piège.
--
-- Or « annuler » ne peut pas vouloir dire « effacer tout ce qui porte 'ai' » :
-- ça emporterait aussi les étiquettes posées par l'IA il y a trois semaines et
-- gardées depuis. Ce qu'on veut annuler, c'est CE passage-là. Il faut donc une
-- date, et c'est tout ce que ce fichier ajoute.
--
-- POURQUOI UN TRIGGER, ET PAS UNE COLONNE ÉCRITE PAR L'APPLICATION
-- Plusieurs producteurs écrivent ces labels : Pulse (Next.js), le worker de
-- labellisation (`saas/recos_ia/labeling.py`), et longtemps le Streamlit
-- (retiré depuis). Faire porter l'horodatage par chacun d'eux, c'est autant
-- d'endroits à tenir d'accord et un oubli qui rend l'annulation silencieusement
-- fausse. La base le pose elle-même : quel que soit l'écrivain, `label_at` dit
-- la vérité.
--
-- LA RÈGLE DU TRIGGER, EN UNE PHRASE : pas de source, pas de date.
-- C'est ce qui permet à l'annulation de fonctionner. Elle remet la ligne à
-- (label = NULL, label_source = NULL) ; sans cette branche, le trigger verrait
-- « le label a changé » et ré-horodaterait à `now()` la ligne qu'on vient de
-- vider — la seconde annulation aurait alors ramassé des lignes déjà annulées.
--
-- AUCUN BACKFILL, ET C'EST VOULU.
-- Les lignes existantes gardent `label_at = NULL`. `NULL >= <date>` est faux en
-- SQL : une étiquette IA antérieure à cette migration ne peut donc JAMAIS
-- tomber dans le périmètre d'une annulation. On ne sait pas quand elle a été
-- posée, alors on ne le prétend pas — et le doute joue en faveur de ce qui est
-- déjà à l'écran.
--
-- Idempotent : rejouable sans risque.
-- ============================================================================

-- ── 1. Les colonnes ─────────────────────────────────────────────────────────
-- `label_source` est répété ici pour que ce fichier se suffise à lui-même :
-- il peut être joué sur une base où `vision_labels_ia.sql` n'est pas passé.

ALTER TABLE public.meta_campaign_config
    ADD COLUMN IF NOT EXISTS label_source text,
    ADD COLUMN IF NOT EXISTS label_at     timestamptz;

ALTER TABLE public.google_campaign_config
    ADD COLUMN IF NOT EXISTS label_source text,
    ADD COLUMN IF NOT EXISTS label_at     timestamptz;

ALTER TABLE public.instagram_organic_posts
    ADD COLUMN IF NOT EXISTS label_source text,
    ADD COLUMN IF NOT EXISTS label_at     timestamptz;

-- ── 2. Le trigger, en deux variantes ────────────────────────────────────────
-- Les campagnes portent UN label (colonne `label`), les posts en portent un
-- tableau (colonne `labels`). Même logique, deux fonctions : une fonction
-- générique devrait passer par `to_jsonb(NEW)`, ce qui coûte une sérialisation
-- de la ligne entière à chaque écriture d'insight.

CREATE OR REPLACE FUNCTION public.stamp_label_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.label_source IS NULL THEN
        -- Pas de source, pas de date : une étiquette retirée n'a pas d'âge.
        NEW.label_at := NULL;
    ELSIF TG_OP = 'INSERT'
       OR NEW.label        IS DISTINCT FROM OLD.label
       OR NEW.label_source IS DISTINCT FROM OLD.label_source THEN
        NEW.label_at := now();
    END IF;
    -- Sinon : réécriture à l'identique (le worker ré-upsert la même valeur à
    -- chaque passage) — la date ne bouge pas, l'étiquette n'a pas changé.
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.stamp_label_at_posts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.label_source IS NULL THEN
        NEW.label_at := NULL;
    ELSIF TG_OP = 'INSERT'
       OR NEW.labels       IS DISTINCT FROM OLD.labels
       OR NEW.label_source IS DISTINCT FROM OLD.label_source THEN
        NEW.label_at := now();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meta_campaign_config_label_at ON public.meta_campaign_config;
CREATE TRIGGER trg_meta_campaign_config_label_at
    BEFORE INSERT OR UPDATE ON public.meta_campaign_config
    FOR EACH ROW EXECUTE FUNCTION public.stamp_label_at();

DROP TRIGGER IF EXISTS trg_google_campaign_config_label_at ON public.google_campaign_config;
CREATE TRIGGER trg_google_campaign_config_label_at
    BEFORE INSERT OR UPDATE ON public.google_campaign_config
    FOR EACH ROW EXECUTE FUNCTION public.stamp_label_at();

DROP TRIGGER IF EXISTS trg_instagram_organic_posts_label_at ON public.instagram_organic_posts;
CREATE TRIGGER trg_instagram_organic_posts_label_at
    BEFORE INSERT OR UPDATE ON public.instagram_organic_posts
    FOR EACH ROW EXECUTE FUNCTION public.stamp_label_at_posts();

-- ── 3. Les index de l'annulation ────────────────────────────────────────────
-- Partiels sur label_source = 'ai' : l'annulation ne cherche jamais autre
-- chose, et l'index reste minuscule même quand tout est étiqueté à la main.

CREATE INDEX IF NOT EXISTS idx_meta_cfg_label_ia
    ON public.meta_campaign_config (user_id, label_at DESC)
    WHERE label_source = 'ai';

CREATE INDEX IF NOT EXISTS idx_google_cfg_label_ia
    ON public.google_campaign_config (user_id, label_at DESC)
    WHERE label_source = 'ai';

CREATE INDEX IF NOT EXISTS idx_insta_posts_label_ia
    ON public.instagram_organic_posts (user_id, label_at DESC)
    WHERE label_source = 'ai';
