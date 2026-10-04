# 18: Une courbe vide dessine un axe à zéro

Type: task
Status: resolved
Blocked by: —

Trouvé en construisant le ticket 10, dans Chrome sur décembre 2025.
`components/courbe.tsx` dessine ses axes même quand toutes les valeurs sont
`null` : l'échelle tombe de 0 à 0 et l'axe écrit « 0,00 CHF ». Un client y lit
un zéro là où rien n'est mesuré (`CLAUDE.md` §7 : une absence n'est pas un
zéro).

Le ticket 10 l'esquive pour la seule Tendance (`components/meta/tendance.tsx` :
une phrase à la place du graphe quand les deux séries sont vides). La
Comparaison et les autres pages qui utilisent `Courbe` ont toujours le
défaut — par exemple une semaine sans aucune ligne.

- [x] `Courbe` ne dessine ni axe ni graduation sans au moins une valeur, et le
      dit ; l'esquive du ticket 10 dans `tendance.tsx` part

## Réponse

`Courbe` compte les valeurs non nulles de toutes ses séries. S'il n'y en a
aucune, elle ne dessine ni SVG ni graduation : elle rend « Aucun chiffre à
tracer sur cette période. » dans une `<figure>` qui porte le `titre` du graphe
(un lecteur d'écran sait de quelle mesure il s'agit). La phrase garde la
`hauteur` du graphe, pour que la grille à deux graphes de la Comparaison ne
saute pas quand un seul est vide. Le cas « aucun jour » (`n === 0`, qui
rendait `null`) passe par la même phrase. Des zéros MESURÉS se tracent
toujours. L'esquive de `tendance.tsx` est partie.

Vérifié :
- harnais de rendu serveur jetable (sucrase + `renderToStaticMarkup`) : 8/8
  sur le nouveau code. Rejoué sur `courbe.tsx` de HEAD, il échoue sur 4 points
  (l'axe y écrit « 0.00 CHF ») ;
- `npx tsc --noEmit` et `npm run build` verts, 18 routes.

Non vérifié dans Chrome. Rien ne passe par le worker : le changement se voit
dès le déploiement de la page, sans relancer `weekly-fetch.yml`.

La revue a relevé que, si toute la fenêtre est vide, les repères du journal
partent avec le graphe. L'esquive du ticket 10 avait déjà ce défaut, il est
noté au ticket 23.
