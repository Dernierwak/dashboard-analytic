# Un panneau du bandeau ne se referme pas par son propre bouton

Type: bug
Status: open
Blocked by:

## Question

**Trouvé par la revue de code lancée sur le ticket 29**, qui portait sur toute
la branche. Ne vient pas de 29 : c'est le travail du bandeau de commandes.

### Le fait

`components/bandeau-commandes.tsx`, le composant `Flotte` (« Un panneau ancré :
clic dehors, Échap. Rien d'autre. ») pose un écouteur `mousedown` sur
`document` et ferme dès que la cible est hors de `boite`. `boite` n'enveloppe
que le **panneau** — le bouton qui l'ouvre est donc, par construction, dehors.

L'enchaînement sur un clic du bouton, panneau ouvert :

1. `mousedown` → `dehors` voit une cible hors du panneau → `fermer()` ;
2. React traite un événement discret en vidant l'état tout de suite, donc
   `menu` vaut `null` avant la suite ;
3. `click` → le `onClick` du bouton lit `menu === null` et **rouvre**.

Pour l'utilisateur, cliquer « Filtrer par thème » une deuxième fois ne fait
rien. Le panneau ne se ferme que par Échap ou par un clic ailleurs — alors que
le bouton est l'endroit évident où on va cliquer pour le refermer.

### Ce qu'il faut faire

Que `dehors` ignore les `mousedown` dont la cible est le déclencheur : une `ref`
sur le bouton testée en plus de `boite`, ou un `stopPropagation` sur le bouton.
La correction est dans `Flotte`, pas dans chaque appelant — sinon elle sera
oubliée au prochain panneau.

### Comment on le verra

Tout de suite, à la lecture. Ouvrir un panneau du bandeau, recliquer son
bouton : il doit se fermer.

### Le piège de fichiers

`saas/web/components/bandeau-commandes.tsx` seulement — mais `Flotte` sert
plusieurs panneaux du même bandeau, donc le comportement change partout d'un
coup. C'est voulu.
