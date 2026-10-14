# Carte — Le journal Meta qui dit ce qui a changé

Label: `wayfinder:map`
Status: resolved — chantier fermé le 2026-10-14.

## Où on est arrivé

Sur `/meta`, en production : chaque changement Meta dit **quel élément**
(campagne, groupe d'annonces ou annonce, avec son nom), **ce qui a été fait**,
**de quoi à quoi** quand Meta le donne, et **qui** l'a fait — une personne ou
Meta. On le lit depuis chaque ligne de la Comparaison et depuis l'onglet
« Changements », filtré comme la page. Sous un filtre de groupe d'annonces,
les changements posés sur sa campagne restent visibles (décision de David,
2026-10-14).

Vérifié par David après la fusion : le `000` est appliqué, le worker a tourné
à la main sur deux comptes, `/meta` se lit. La mesure du panneau en
production (12 à 25 ms sur la preview) est à confirmer par lui.

## Ce qu'il faut savoir avant d'y retoucher

- **Rien n'est traduit.** Les libellés sont ceux de Meta, dans la langue du
  jeton ; toute logique se fonde sur les codes (`event_type`, `run_status`),
  jamais sur un libellé.
- **Le niveau se lit dans le préfixe de `event_type`**, pas dans
  `object_type` (Meta y écrit `CAMPAIGN` pour un groupe d'annonces). Pour un
  changement d'annonce, `extra_data.campaign_id` porte l'ID du **groupe**.
- **`extra_data` est gardé tel que Meta l'envoie** et lu à l'affichage ; sa
  forme n'est pas documentée. Illisible, la phrase dit « modifié » plutôt que
  d'inventer une valeur. Budget en centimes, deux décimales.
- **Meta se reconnaît à `actor_id` = `"0"`** (observé, non documenté) ; le nom
  d'une personne n'est jamais demandé.
- **Une catégorie s'ajoute à trois endroits** : le CHECK de
  `platform_changes` dans `000_run_me_all.sql`, `_ACTIVITES` (Python) et
  `lib/categorie-changement.ts`. **Le `000` d'abord**, sinon le worker voit
  tout son lot Meta refusé.

## Où vit le code

- Récolte : `saas/data/fetch_data/sources/meta/ads/fetchers/activities.py`.
- Schéma : `saas/data/supabase/migrations/000_run_me_all.sql`, table
  `platform_changes`.
- Écran : `saas/web/lib/meta/changements.ts` (portée, panneau),
  `rubriques.ts` (lecture d'`extra_data`), `components/meta/`.

## L'historique

Les 20 tickets, les harnais (récolte, lecture, mise en page) et la recherche
sur l'API `/activities` ont quitté l'arbre le 2026-10-14, à la demande de
David. Le code y renvoie encore (`.scratch/journal-meta/issues/NN`,
`harnais/NN`) ; ils se retrouvent par
`git log --diff-filter=D -- .scratch/journal-meta`.
