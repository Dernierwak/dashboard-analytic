# 22: Un CTR sans impression s'écrit « 0.00 % »

Type: task
Status: needs-triage
Blocked by: —

**Trouvé en revue** du ticket 15 (pas demandé, donc un ticket — `CLAUDE.md` §4.4).

Dans `buildDash` (`saas/web/lib/channels.ts`), le CTR, le CPC et le CPM d'une
campagne et du total valent `0` quand leur dénominateur est nul. Le CPC et le CPM
s'affichent alors « — », parce que le composant teste `> 0`. Le CTR, lui, s'écrit
`ctr.toFixed(2) %`, donc « 0.00 % » pour une campagne sans aucune impression :
une absence de donnée lue comme un zéro (`CLAUDE.md` §7). Même chose dans la
tuile « CTR moyen » de `AdsKpis`.

Pas encore vérifié : une ligne Google à zéro impression existe-t-elle dans la
fenêtre d'un compte réel ? Il faut le lire en base avant de juger l'urgence.

- [ ] Le taux non calculable vaut `null`, pas `0`, et s'affiche « — »
- [ ] `tsc` et build verts, 18 routes
