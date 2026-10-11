# 13: L'écran du journal

Type: task
Status: open
Blocked by: 11, 12

## Question

Construire sur `/meta` l'écran validé au ticket 10 (voir sa réponse, points 1
à 5) : le filtre « Groupe d'annonces », les onglets du bord droit, les points
(sur l'axe un jour sans valeur), la mise en avant d'une ligne sur la Comparaison (et la
correction des zones de clic superposées dans `components/courbe.tsx`), le
panneau rangé campagne › groupe d'annonces › annonce avec statut, « Actuel »
et avant / après.

L'avant / après, « Actuel » et le statut regroupé se **lisent dans
`extra_data` à l'affichage** (ticket 11) : une fonction pure par forme du
ticket 02 (statut, ciblage, créa, objectif, enchère, calendrier, création),
qui rend des rubriques « nom, avant, après » ; une forme inconnue rend la
phrase `resume` seule. Rien n'est traduit (ticket 04).

Fichiers : `saas/web/lib/meta/changements.ts`, `components/meta/panneau.tsx`,
`journal-du-jour.tsx`, `tendance.tsx`, `comparaison.tsx`, `bandeau.tsx`,
`components/courbe.tsx`. Vérification : `CLAUDE.md` §9 (`tsc`, `build`,
18 routes) et un harnais pour la logique pure (lecture de `extra_data`,
regroupement du statut, « Actuel »). Se voit sur `/meta` après le passage du
worker du ticket 12.

## Comments

**2026-10-11 — ce que le ticket 12 laisse en base.** Colonnes `niveau`
(`campagne`/`groupe`/`annonce`), `object_id`, `object_name`, `adset_id`
(l'objet lui-même pour un groupe) et `extra_data` (jsonb, ou chaîne si Meta
n'envoie pas du JSON) ; toutes NULL sur les lignes Google et celles d'avant le
passage. Deux catégories nouvelles, `objectif` et `calendrier`, que
`NATURES` (`lib/meta/changements.ts`), `MOT_CATEGORIE`
(`components/changements.tsx`) et `CategorieChangement`
(`lib/changements-api.ts`) ne connaissent pas encore : elles s'y lisent
aujourd'hui « Réglage ».
