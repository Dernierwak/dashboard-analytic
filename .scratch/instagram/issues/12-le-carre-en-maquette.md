# 12: Le carré de sélection, en maquette

Type: prototype
Status: open
Blocked by: 08
Assignee: —

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
