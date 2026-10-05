# 27: La cascade des métriques Instagram existe en quatre exemplaires

Type: task
Status: resolved
Blocked by: —

**Trouvé en revue** du ticket 25, pas demandé — `CLAUDE.md` §4.4.

La lecture « clé de métrique → valeur d'un post »
(`metric === "views" ? p.views : … : p.reach`) est écrite quatre fois :
`_mval` dans `getInstaDash` (`saas/web/lib/channels.ts`), `val` dans
`PostsMetricChart` et dans `sortPosts`, et le ternaire des cartes du top 3
(`app/instagram/page.tsx`). Le 25 a dû changer trois signatures à l'identique
pour faire passer `eng` à `number | null`. Une métrique ajoutée ou retypée
touche quatre endroits, et le `: p.reach` final absorbe en silence toute clé
inconnue.

- [x] Une seule fonction `valeurDe(p, cle)` dans `lib/channels.ts`, appelée par les quatre
- [x] `tsc` et build verts, 18 routes

## Réponse

`valeurDe(p, cle)` vit dans `saas/web/lib/channels.ts`, à côté d'`InstaPost` :
une table clé → lecture, appelée par le top 3 de `getInstaDash`, par
`PostsMetricChart`, par `sortPosts` et par la carte du top 3. Les quatre
ternaires sont partis (`git grep ': p\.reach;'` est vide). Une clé inconnue
lit toujours la portée — mais à un seul endroit, et `Object.hasOwn` empêche
`?tri=constructor` de lire le prototype.

La carte du top 3 formatait sa valeur sans prévoir l'absence : elle passe par
`fmtCompte`, qui écrit « — » pour `null` au lieu d'un zéro.

Vérifié : `npx tsc --noEmit` et `npm run build` verts, 18 routes. Pas de
harnais : `saas/web` n'a pas de lanceur de tests, et le changement ne touche ni
le traitement ni la récolte — visible au prochain déploiement Vercel, sans
passage du worker.
