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
