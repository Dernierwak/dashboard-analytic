# 25: L'engagement d'une publication sans portée vaut zéro

Type: task
Status: resolved
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

- [x] `eng` vaut `null` sans portée, s'écrit « — », ferme les tris, sort des moyennes
- [x] `tsc` et build verts, 18 routes

## Réponse

`InstaPost.eng` passe par `taux()` et vaut `null` sans portée. Deux fonctions
pures rejoignent `lib/channels.ts` : `trierDecroissant` (les absents en fin —
tri de la table et top 3) et `moyenneMesuree` (`avgEng`, `postsEng`, et la
moyenne du graphe « Tes posts, un par un »). La table, les cartes du top 3, la
tuile « Engagement du compte » et la phrase d'écart écrivent « — ».

Le graphe en barres (`components/bar-chart.tsx`) accepte `value: null` : pas de
barre, « — » dans la bulle, et ni le haut de l'échelle ni « max » ne
s'affichent quand aucun post n'est mesuré (ils auraient écrit « 0.0 % »).
L'ancien filtre `v > 0` de la moyenne du graphe jetait aussi les 0 % mesurés ;
ceux-là restent maintenant dans la moyenne.

Vérifié : `tsc --noEmit` et `npm run build` verts, 18 routes ; les deux
fonctions exécutées sur `[2, null, 0, 5]` → ordre `5, 2, 0, null`, moyenne
7/3. Non vérifié à l'écran : aucune donnée de démo n'a de publication sans
portée. Rien côté worker : c'est de l'affichage, visible au prochain
déploiement Vercel.

Trouvé en revue : tickets 27 et 28.
