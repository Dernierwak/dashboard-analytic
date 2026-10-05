# 26: La courbe enjambe un jour sans mesure

Type: task
Status: resolved
Blocked by: —

**Trouvé en revue** du ticket 24, pas demandé — `CLAUDE.md` §4.4.

Depuis le 24, un jour sans impression vaut `null` dans la courbe d'évolution et
dans la mini-série de la tuile « CTR moyen ». `LineChart` et `Sparkline`
(`saas/web/components/line-chart.tsx`) écartent bien ce point, mais relient
ensuite les points restants : le trait passe par-dessus le jour manquant comme
s'il avait été mesuré. Aucun zéro n'est dessiné, mais une continuité l'est.

`LineChart` et `Sparkline` servent aussi Instagram et les coûts : couper le
trait (un segment par plage mesurée) touche ces pages.

- [x] Le trait se coupe sur un point `null`, dans les deux composants
- [x] `tsc` et build verts, 18 routes

## Réponse

`lib/plages-mesurees.ts` (sans directive) découpe une série en suites
d'indices mesurés consécutifs — zéro est une mesure, `null` coupe. `LineChart`
et `Sparkline` tracent le trait ET le dégradé comme un `<path>` à un
sous-chemin par plage d'au moins deux jours ; un jour isolé entre deux trous
garde son rond HTML, sans trait. Une série sans `null` produit le même dessin
qu'avant : Instagram et les coûts ne changent pas tant qu'ils ne passent pas de
`null`.

Vérifié : `plagesMesurees` exécutée sous `node --test` (5 cas : série pleine,
coupure, `null` de bord et répétés, série vide, zéros) ; `tsc --noEmit` et
`npm run build` verts, 18 routes, sur `HEAD` + ces deux fichiers — l'arbre
partagé portait au même moment le ticket 25 en cours (`channels.ts`,
`instagram/page.tsx`), qui ne compilait pas encore. Pas vu à l'écran : c'est un
rendu côté client, pas une correction du traitement — aucun passage du worker
n'est nécessaire, le prochain déploiement suffit.
