# 19: La vignette de la Comparaison accepte une URL de Meta

Type: task
Status: resolved
Blocked by: 05

**Trouvé en revue du ticket 12 (2026-10-04).** Deux règles disent « quel
visuel montrer » pour une même annonce, et elles divergent :

- le Panneau latéral (`lib/meta/annonce.ts`, `visuelDe` + `depuisStorage`) ne
  montre qu'une image du Storage **public** de Pulse ; une URL de Meta, qui
  expire, devient « Visuel pas encore copié dans Pulse » ;
- la vignette de la Comparaison (`lib/meta/donnees.ts`, `lireVignettes`) prend
  `vignette_url ?? image_url` **sans filtre** : si la récolte du ticket 05
  écrit dans `vignette_url` l'URL de Meta (la vignette d'une vidéo, par
  exemple), la liste l'affiche, puis l'image casse quand elle expire.

**À faire, une fois le 05 construit** : regarder ce que la récolte écrit
vraiment dans `vignette_url`, puis faire passer la vignette par la même règle
que le Panneau (une seule fonction, testée).

- [ ] La vignette de la Comparaison et le visuel du Panneau suivent une seule
      règle (testé)
- [ ] Aucune URL de Meta n'est affichée dans la Comparaison

## État au 2026-11-12 — contrôle contre `main` (983d71e)

Toujours valable, faible. Deux règles pour le même visuel : `lib/meta/donnees.ts:209,236` (`vignette_url ?? image_url`, sans filtre) contre `lib/meta/annonce.ts:152-157` (`depuisStorage`). Le risque concret est éteint côté récolte (`creatives.py:164-170` n'écrit que des URL déjà copiées chez nous), mais la première case — une seule règle, testée — reste à faire.

## Réponse — 2026-11-12

Construit sur la branche `meta-ads/19bis-une-regle-pour-la-vignette` (834cf26),
à fusionner dans main. Une seule règle : `premierVisuel(candidats, origine)`
dans `saas/web/lib/meta/annonce.ts` rend le premier candidat que
`depuisStorage` accepte (Storage public de Pulse seulement), sinon `null`. Le
panneau (`visuelDe`), les Aperçus (`lireApercus`) et la vignette de la
Comparaison (`lireVignettes`) passent tous par elle. Un candidat refusé ne
masque plus le suivant, et une `vignette_url` vide ne masque plus une image.

Vérifié :
- harnais `.scratch/meta-ads/harnais/19bis-une-regle-pour-la-vignette/`,
  11/11, relancé par le coordinateur ;
- `tsc --noEmit` vert et `npm run build` à 18 routes ;
- en base (lecture seule) : toutes les URL de `meta_ads_creatives` qui ne sont
  pas vides sont dans le Storage public (166 `vignette_url`, 682 `image_url`),
  donc aucune vignette affichée aujourd'hui ne disparaît.

Pas vu à l'écran. C'est un changement de lecture seule, visible au déploiement
Vercel de main après la fusion, sans passage du worker.
