# Les présélections de période sont inertes sur un ancien lien `/couts?p=…`

Type: bug
Status: open
Blocked by:

## Question

**Trouvé par la revue de code lancée sur le ticket 29**, qui portait sur toute
la branche. Ne vient pas de 29 : c'est le travail du bandeau de commandes.

### Le fait

`components/bandeau-commandes.tsx`, `ecrire.periode` : le lien efface bien
`from` et `to`, écrit `d`… et **garde `p`**.

Or `resoudrePeriode` (`lib/couts.ts` l. 255) lit `p` **avant** de retomber sur
`d` :

```
plage sur mesure (from + to)  →  p === "mois"  →  p === "an"  →  d
```

Sur `/couts?p=mois` — un favori que le code soutient exprès (« Encore LU pour
qu'aucun favori ni lien partagé ne casse », ticket 12 §5) — cliquer **7 j**,
**30 j**, **90 j** ou **Tout** change l'URL, re-rend la page, et la période
affiche toujours « ce mois-ci ». Le contrôle ne répond pas, et rien ne dit
pourquoi. Même famille sur `?p=30` : cliquer « 7 j » efface `d` et la page
retombe sur 30 jours.

C'est le piège écrit dans `CLAUDE.md` §8 pris par l'autre bout : **un lien
énumère ce qu'il CHANGE**. Ici il change la période sans retirer l'ancien nom de
la période, donc il produit une URL valide qui ne dit pas ce qu'on a cliqué.

### Ce qu'il faut faire

`q.delete("p")` dans `ecrire.periode`.

**`ecrire.plage` n'est pas touché** — la plage sur mesure est testée en premier,
donc elle gouverne même avec `p` présent. Mais elle laisse un `p` mort dans
l'URL, qui **reprend la main** le jour où la plage est effacée. L'y ajouter est
de la cohérence, pas une correction : à décider en même temps.

### Comment on le verra

Tout de suite, à la lecture — c'est du rendu de page, aucun passage du worker
n'est nécessaire. Ouvrir `/couts?p=mois`, cliquer « 7 j » : le titre de période
doit cesser de dire « ce mois-ci ».

### Le piège de fichiers

`saas/web/components/bandeau-commandes.tsx` (`useEcriture`), et
`saas/web/lib/couts.ts` (`resoudrePeriode`) pour l'ordre de priorité.
