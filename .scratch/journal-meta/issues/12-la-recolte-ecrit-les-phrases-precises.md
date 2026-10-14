# 12: La récolte garde l'élément et ce que Meta envoie

Type: task
Status: resolved
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

## Answer

Construit le 2026-10-11 et éprouvé hors ligne ; **pas encore vu en base**
(il faut le `000` puis un passage du worker, voir plus bas).

- **Schéma** (`000_run_me_all.sql`, section 14) : `niveau`, `object_id`,
  `object_name`, `adset_id` (text) et `extra_data` (jsonb), ajout seul ;
  CHECK de `niveau` (`campagne` / `groupe` / `annonce`, NULL permis) ;
  catégories `objectif` et `calendrier` ajoutées à la CHECK de `categorie`.
- **Récolte** (`activities.py`) :
  - le niveau se lit dans le préfixe de `event_type` ; `adset_id` vaut
    l'objet pour un groupe, et pour une annonce `extra_data.campaign_id`
    (forme `{"new": ID}`, seul `create_ad` la porte) **sinon la hiérarchie
    des insights**, étendue pour rendre aussi le groupe de chaque annonce.
    Sans ce repli, une annonce mise en pause n'aurait jamais de groupe ;
  - `extra_data` gardé tel que Meta l'envoie (objet JSON ; une chaîne non
    JSON reste une chaîne) ;
  - statut et objectif : « est passé de « avant » à « après » », valeurs
    recopiées dans la langue de Meta ; plus aucun libellé lu par la logique
    (les `PAUSED`/`ACTIVE` traduits sont partis) ;
  - budget : montants lus dans `composite_data` (centimes, devise donnée par
    Meta, aucune supposée), sinon « budget modifié ». **Non testé sur un vrai
    changement** (ticket 07) ;
  - un nom absent ne jette plus la ligne : l'élément se dit par son ID ;
  - créa : « la créa … a été modifiée » au lieu de « le visuel … a été
    remplacé », que Meta dément quand seul l'ID de la créa change (ticket 02).
- **Écriture** (`source_data/platform.py`) : les six colonnes « si connues »
  ne partent que remplies, pour ne rien effacer d'un passage précédent.
- **Vérifié** : harnais [`harnais/12/verifier.py`](../harnais/12/verifier.py),
  24/24 sur les formes du ticket 02 et la forme de budget de la recherche ;
  `py_compile` sur les quatre fichiers touchés ou appelants.

**À faire par David, dans cet ordre :**
1. Jouer `saas/data/supabase/migrations/000_run_me_all.sql` dans l'éditeur
   SQL de Supabase. Il porte deux `DROP CONSTRAINT IF EXISTS` (CHECK de
   `categorie`, remplacée par une liste plus large, et CHECK de `niveau`,
   neuve) : **aucune ligne touchée**. Sans lui, le premier `objectif` ou
   `calendrier` fait refuser tout le lot Meta.
2. Lancer le worker à la main : onglet GitHub Actions → `weekly-fetch.yml`,
   sans option.
3. Vérifier en base que les lignes Meta des 180 derniers jours portent
   `niveau` et `extra_data`, et que les phrases de statut sont en français.
