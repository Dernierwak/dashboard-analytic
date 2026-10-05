# 26: La courbe enjambe un jour sans mesure

Type: task
Status: needs-triage
Blocked by: —

**Trouvé en revue** du ticket 24, pas demandé — `CLAUDE.md` §4.4.

Depuis le 24, un jour sans impression vaut `null` dans la courbe d'évolution et
dans la mini-série de la tuile « CTR moyen ». `LineChart` et `Sparkline`
(`saas/web/components/line-chart.tsx`) écartent bien ce point, mais relient
ensuite les points restants : le trait passe par-dessus le jour manquant comme
s'il avait été mesuré. Aucun zéro n'est dessiné, mais une continuité l'est.

`LineChart` et `Sparkline` servent aussi Instagram et les coûts : couper le
trait (un segment par plage mesurée) touche ces pages.

- [ ] Le trait se coupe sur un point `null`, dans les deux composants
- [ ] `tsc` et build verts, 18 routes
