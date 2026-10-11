# 12: La récolte garde l'élément et ce que Meta envoie

Type: task
Status: open
Blocked by: 10, 11

## Question

Construire le schéma du ticket 11 et la récolte qui le remplit, puis
l'éprouver sur les formes du ticket 02 avant le premier passage du worker.

- **Schéma** (`saas/data/supabase/migrations/000_run_me_all.sql`, section de
  `platform_changes`) : `object_id`, `object_name`, `niveau`, `adset_id`,
  `extra_data jsonb` ; catégories `objectif` et `calendrier`. Ajout seul.
- **Récolte** (`saas/data/fetch_data/sources/meta/ads/fetchers/activities.py`) :
  - chaque ligne porte l'élément touché et `extra_data` tel que Meta l'envoie ;
  - la logique ne lit jamais un libellé (ticket 04) : un statut en français
    n'est plus jeté ; **aucune ligne jetée sans rien dire** — au pire,
    « modifié » ;
  - types ajoutés : `update_ad_set_optimization_goal` (objectif),
    `update_ad_targets_spec` (ciblage d'une annonce), `update_ad_set_duration`
    (calendrier) ;
  - budget : la phrase lit le montant dans `composite_data`, sinon « budget
    modifié » ; dit **non testé** (ticket 07) ;
  - le groupe d'une annonce : `extra_data.campaign_id` (ticket 02).
- **Harnais** écrit pour le ticket, sur les formes du ticket 02 (`CLAUDE.md`
  §9) ; `python3.12 -m py_compile` sur ce qui est touché.
- **À dire à David** : jouer le `000` sur Supabase avant le passage (il porte
  un `DROP CONSTRAINT IF EXISTS` de la CHECK, aucune ligne touchée), puis un
  passage du worker à la main (`weekly-fetch.yml`, sans option) ; vérifier en
  base que les lignes portent `extra_data` et `niveau`.
