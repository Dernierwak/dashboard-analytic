# 12: Le carré de sélection, en maquette

Type: prototype
Status: open
Blocked by: 06, 08
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
