# 27: La cascade des métriques Instagram existe en quatre exemplaires

Type: task
Status: needs-triage
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

- [ ] Une seule fonction `valeurDe(p, cle)` dans `lib/channels.ts`, appelée par les quatre
- [ ] `tsc` et build verts, 18 routes
