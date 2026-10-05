# 24: Le repère de la courbe pleine tait sa date au lecteur d'écran

Type: task
Status: resolved
Blocked by: —

**Trouvé en revue** du ticket 23 (pas demandé, donc un ticket — `CLAUDE.md` §4.4).

Depuis le ticket 23, `Courbe` (`saas/web/components/courbe.tsx`) rend ses
repères de deux façons. Dans la frise d'une fenêtre vide, un repère annonce
« date · libellé » et ouvre sa bulle au focus clavier. Sur la courbe pleine, il
n'annonce que le libellé (« 2 changements · clique pour les voir ») : un
lecteur d'écran ne sait pas de quel jour il s'agit. Et au clavier, le focus
grossit le point sans ouvrir de bulle.

Deux défauts plus petits, plus anciens que le ticket 23 :
- avec un seul jour, la date passe par la branche `i === n - 1`
  (`-translate-x-full`) et se cale à gauche du point au lieu de se centrer
  dessous (ligne de dates de `Courbe`) ;
- sans `onRepere`, un repère reste un bouton focalisable qui ne fait rien.

- [x] Le repère de la courbe pleine dit sa date au lecteur d'écran
- [x] Au clavier, le repère de la courbe pleine ouvre sa bulle, comme dans la frise

## Réponse

Tout dans `saas/web/components/courbe.tsx`.

- **Un seul jeu de propriétés pour les deux rendus** (`accesRepere`) :
  `aria-label` « date · libellé », `onFocus`/`onBlur` qui posent le jour
  survolé. Sur la courbe pleine, le focus clavier ouvre donc la bulle complète
  (valeurs du jour + ligne du repère) et trace le trait vertical, comme le
  survol à la souris.
- **Un seul jour** : la date passe par une branche `n <= 1` et se centre sous
  le point (`-translate-x-1/2`).
- **Sans `onRepere`** : `BoutonRepere` rend un `span role="img"` avec le même
  `aria-label` — le point se lit et s'affiche, il ne prend plus le focus pour
  ne rien faire. Aucun appelant actuel n'est dans ce cas (`components/meta/tendance.tsx`
  passe toujours les deux).

**Vérifié** : harnais jetable (sucrase + `renderToStaticMarkup`, hors de
l'arbre) — date dans l'`aria-label` sur courbe pleine et frise, bouton présent
avec `onRepere`, aucun bouton ni `tabindex` sans lui, date centrée pour un jour,
dernière date toujours calée à droite pour trois. `tsc` et `npm run build`
verts, 18 routes, sur `HEAD` + ce seul fichier (le worktree portait en même
temps les modifications en cours d'une autre session, qui cassaient `tsc`).

**Non vérifié** : le focus → bulle n'a pas été exercé dans un navigateur — il
ne s'exécute pas en rendu serveur ; il reprend à l'identique le `onFocus` de la
frise. Changement purement client : visible au prochain déploiement Vercel,
sans passage du worker.
