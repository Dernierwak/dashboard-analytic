# 12: Le carré de sélection, en maquette

Type: prototype
Status: open
Blocked by: 08
Assignee: David (session Claude, 2026-11-05)

## Question

**Comment se présente et se manipule le carré ?** « Les 5 du haut que nous
allons travailler, les sélectionner, on les voit et on peut discuter dessus —
ou voir les 5 derniers », avec la place de chacun (dans la moyenne, 50-75 %,
aberrante) et la possibilité d'écarter l'aberrante.

Une maquette jetable, sur des données réelles d'un compte si possible, qui
fait réagir sur : le choix « 5 meilleurs / 5 derniers / sélection à la main »,
la représentation de la place (moustache, bandes, points), le geste pour
écarter et la note qui suit, et l'ouverture de l'aperçu d'un post. Référence :
la Comparaison de Meta (`saas/web/components/meta/comparaison.tsx`), qui coche
jusqu'à quatre éléments.

> **Éclairé par [La structure de la page](01-la-structure-de-la-page.md)
> (2026-11-02)** : le carré s'appelle **Sélection** et se place sous la
> Comparaison (une moustache par format) ; chaque post y est situé sur la
> moustache de son format. La maquette tranche aussi **Comparaison et
> Sélection : un module ou deux** — « peut-être encore avec le format, et on
> peut avoir les différents formats sur le carré, dur à dire » (David). Point
> pro ajouté : **un lien qui garde la sélection** (les posts choisis et
> l'objectif), pour en discuter avec quelqu'un qui voit la même chose.

> **Éclairé par [La place d'un post](06-la-place-d-un-post.md) (2026-11-03)** :
> chaque post porte **sa place sur la métrique choisie**, une à la fois — elle
> change avec la métrique (« si on travaille sur les likes, tout est filtré sur
> les likes »). Mots : « post type », « en dessous », « bas / haut de tes
> habitudes », « au-dessus », « hors norme ». Pas de place sous 6 posts du
> format : la maquette montre la mention.

> **Éclairé par [Écarter un post](08-ecarter-un-post.md) (2026-11-03)** :
> pas de geste « écarter ce post » ni de note à écrire — deux filtres,
> « sans les boostés » et « sans les hors norme » (sur la métrique affichée),
> dans l'URL. Filtrée, la Sélection saute les posts écartés (« les 5
> meilleurs » parmi ceux qui restent). La maquette montre le geste type de
> David : une Sélection sur les likes, un post hors norme qui écrase les
> autres, le filtre qui le retire pour voir les « haut de tes habitudes » —
> et la phrase « 1 post hors norme écarté — moustache sur 18 Reels au lieu
> de 19 ».

> **Éclairé par [Les règles d'analyse réglables](11-les-regles-d-analyse-reglables.md)
> (2026-11-05)** : les deux filtres se rangent sous un bouton discret
> « Règles de lecture » du Bandeau (« · n » quand un filtre est coché) ; la
> phrase des écartés vit **au-dessus des moustaches**, avec le lien
> « Revenir aux règles standard ». Pas de mode avancé.

## Prototype (2026-11-05)

Monté dans la vraie page `/instagram` (sous le Bandeau, hors production
seulement), sur les 235 posts réels du compte :
`saas/web/app/instagram/_prototype-selection/` (`calcul.ts`, `variantes.tsx`,
`switcher.tsx`). Il a vécu sur la branche jetable `prototype/instagram-page`,
jamais sur `main`, supprimée le 2026-11-08 une fois la vraie page construite
(`instagram-construction`) ; il se retrouve au commit `c67bc57`
(`git checkout c67bc57`).

Lancer (depuis ce commit) : `cd saas/web && npm run dev`, puis ouvrir
`/instagram?d=0&variant=A&pm=likes` ; ← → basculent entre les variantes.

- **A · Deux modules, cartes** : Comparaison (une moustache par format), puis
  Sélection en 5 cartes, chacune avec la mini-moustache de son format.
- **B · Un seul module, points numérotés** : les posts choisis posés,
  numérotés, sur les moustaches des formats (échelle commune), et une bande de
  vignettes en dessous.
- **C · Les bandes** : la phrase « 2 en dessous, 2 bas de tes habitudes,
  1 au-dessus », puis une colonne par place, avec les posts rangés dedans.

Communs aux trois : métrique (`pm`), choix « 5 meilleurs / 5 moins bons /
5 plus récents / à la main » (`pmode`, `ps`), « Règles de lecture » →
« sans les hors norme » (`phn`) avec la phrase des écartés et « Revenir aux
règles standard », aperçu d'un post en panneau (`?post=`). L'URL porte tout.

Ce que la maquette a déjà montré :
- **Les Reels n'ont aucun j'aime en base** (0 partout) : sans correction, la
  moustache des Reels annonce « post type 0 ». La maquette traite ce 0 comme
  une absence ; c'est le défaut de récolte du ticket 02, à porter au ticket du
  traitement.
- En j'aime, sur tout l'historique, **les 5 meilleurs sont 5 Images hors
  norme** : c'est exactement le geste de David ; avec le filtre, 7 posts sont
  écartés et les 5 suivants (1 896 à 1 926) **se recouvrent sur la moustache
  en B**.
- « Les 5 derniers » est ambigu (les moins bons ? les plus récents ?) : la
  maquette offre les deux.
- « Sans les boostés » n'est pas branché : rien ne dit encore qu'un post est
  boosté (ticket Les posts boostés).
