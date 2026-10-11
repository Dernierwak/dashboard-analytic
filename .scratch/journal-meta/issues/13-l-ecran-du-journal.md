# 13: L'écran du journal

Type: task
Status: open
Blocked by: 11, 12

## Question

Construire sur `/meta` l'écran validé au ticket 10 (voir sa réponse, points 1
à 5) : le filtre « Groupe d'annonces », les onglets du bord droit, aucun point
posé sur l'axe, la mise en avant d'une ligne sur la Comparaison (et la
correction des zones de clic superposées dans `components/courbe.tsx`), le
panneau rangé campagne › groupe d'annonces › annonce avec statut, « Actuel »
et avant / après.

Fichiers : `saas/web/lib/meta/changements.ts`, `components/meta/panneau.tsx`,
`journal-du-jour.tsx`, `tendance.tsx`, `comparaison.tsx`, `bandeau.tsx`,
`components/courbe.tsx`. Vérification : `CLAUDE.md` §9 (`tsc`, `build`,
18 routes) et un harnais pour la logique pure (regroupement, « Actuel »).
