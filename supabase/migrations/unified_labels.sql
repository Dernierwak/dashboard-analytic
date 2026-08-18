-- ============================================================
-- ⚠ FICHIER MORT — NE PAS EXÉCUTER. REMPLACÉ PAR LA SECTION 1 DE
--   supabase/migrations/000_run_me_all.sql.
--
-- IL ÉCHOUE, ET DÈS LE PREMIER PASSAGE :
--     ERROR:  column "labelling" does not exist
--
-- Le backfill ci-dessous lit trois anciennes listes, dont `profiles.labelling`,
-- qui n'a jamais existé sur la base. Le fichier meurt donc sur son UPDATE — et
-- comme l'éditeur SQL de Supabase joue tout d'un bloc, il ne laisse rien
-- derrière lui. Vérifié sur PostgreSQL 17.
--
-- La section 1 du bundle fait le même travail en corrigé : elle unifie
-- `campaign_labels` et `google_campaign_labels` vers `profiles.labels`, avec le
-- même garde `labels = '{}'` qui empêche d'écraser ce que l'utilisateur a
-- ajouté depuis. C'est elle la source de vérité.
--
-- Le fichier est conservé plutôt que supprimé : il documente l'intention
-- d'origine et son en-tête sert d'avertissement au prochain qui le trouvera.
-- Le supprimer reste une décision de David.
-- ============================================================
-- Labels unifiés — une seule liste maîtresse partagée
-- Meta Ads + Google Ads + Instagram organique pointent désormais
-- sur profiles.labels (au lieu de 3 listes séparées).
-- Les assignations par campagne/post (qui stockent le NOM du label)
-- ne bougent pas — seule la liste maîtresse est unifiée.
-- ============================================================

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS labels text[] NOT NULL DEFAULT '{}';

-- Backfill UNE FOIS : union des 3 anciennes listes (dédupliquée, sans vides).
-- Guard `labels = '{}'` → ré-exécution sûre (n'écrase pas ce que l'utilisateur
-- aura ajouté ensuite via la nouvelle page).
-- NB : suppose que campaign_labels / google_campaign_labels / labelling sont text[].
UPDATE public.profiles p
SET labels = sub.arr
FROM (
    SELECT id, ARRAY(
        SELECT DISTINCT x
        FROM unnest(
            coalesce(campaign_labels, '{}'::text[]) ||
            coalesce(google_campaign_labels, '{}'::text[]) ||
            coalesce(labelling, '{}'::text[])
        ) AS x
        WHERE x IS NOT NULL AND btrim(x) <> ''
    ) AS arr
    FROM public.profiles
) sub
WHERE p.id = sub.id
  AND (p.labels IS NULL OR p.labels = '{}');
