# 25: L'engagement d'une publication sans portée vaut zéro

Type: task
Status: needs-triage
Blocked by: —

**Trouvé en chemin** du ticket 24 (la courbe et l'écart), pas demandé — `CLAUDE.md` §4.4.

`InstaPost.eng` (`saas/web/lib/channels.ts`, construction des posts) vaut
`reach > 0 ? … : 0` : une publication dont la portée n'est pas relevée reçoit un
taux d'engagement de 0 %, comme le CTR sans impression avant le 22. Le 24 a
corrigé l'engagement de la COMPARAISON Instagram (`taux()`), pas celui de chaque
publication.

Ce 0 part ensuite dans :

- la table et les cartes de `app/instagram/page.tsx` (« 0.0 % eng. ») ;
- le tri par engagement (`sort === "eng"`, `topMetric === "eng"`) ;
- les moyennes `avgEng` et `postsEng`, qu'il tire vers le bas.

- [ ] `eng` vaut `null` sans portée, s'écrit « — », ferme les tris, sort des moyennes
- [ ] `tsc` et build verts, 18 routes
