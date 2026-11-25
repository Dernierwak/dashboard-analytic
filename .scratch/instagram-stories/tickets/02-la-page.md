# 02: Les stories dans la page

Type: task
Status: resolved
Blocked by: —

## À faire

Spec `../spec.md` § Ce que la page montre, à la lettre, dans `saas/web/` :
lecture de `instagram_stories` et de `instagram_compte_jours.reach_story`
(schéma § La base, pas encore en base : la page doit rester juste sans eux,
table absente ou vide → pas de rangée Story, aucune erreur), format Story par
journée, Objectif Trafic, Panneau d'une journée (vignettes par URL signée du
bucket privé `instagram-stories`), Tableau, 5 meilleurs, export `.csv`.

## Vérification

`rm -rf .next tsconfig.tsbuildinfo`, `npx tsc --noEmit`, `npm run build` à
**18 routes**. Les calculs de journée (sommes, complète / en cours, story sans
chiffres, sorties pour 100 vues) dans `lib/instagram/`, couverts par un
harnais sous `.scratch/instagram-stories/harnais/`.

## Answer

Construit le 2026-11-25 : une journée devient un `Post` de format `story`
(même foule, place, minimum, liens) — `lib/instagram/stories.ts`,
`donnees-stories.ts`, `components/instagram/panneau-journee.tsx`, Objectif
Trafic au Sélecteur. Harnais `harnais/02-la-page/` : 27 tests verts ; `tsc`
vert, build à 18 routes. Écarts gardés : journée « incomplète » (story jamais
relue) distincte de « en cours » ; en Abonnés, la rangée Story renvoie à
« Abonnés gagnés » au lieu de basculer seule. **Non vérifié** : le rendu dans
un navigateur et les URL signées contre le vrai bucket.
