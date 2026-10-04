# 24: La courbe, la tuile et l'écart tracent un taux absent à zéro

Type: task
Status: needs-triage
Blocked by: —

**Trouvé en chemin** du ticket 22 (pas demandé, donc un ticket — `CLAUDE.md` §4.4).

Le 22 a fait passer à `null` le CTR, le CPC et le CPM non calculables de
`buildDash` (`saas/web/lib/channels.ts`) : tuiles et table Google affichent « — ».
Quatre endroits recalculent encore le taux eux-mêmes et retombent sur `0` quand
le dénominateur est nul :

- `MetricChart` (`components/channel-dash.tsx`, `val`) — un jour sans impression
  devient une barre CTR à 0 et tire la moyenne et la pente vers le bas.
- La mini-série de la tuile « CTR moyen » (`serie=` dans `AdsKpis`).
- `METRIQUES_ECART.ctr` / `.cpc` (`components/channel-dash.tsx`) — c'est la
  RÉFÉRENCE (la période d'avant) sans impression qui tombe à 0 : une campagne
  qui a un CTR aujourd'hui reçoit un écart chiffré contre un taux qui n'existait
  pas. La ligne courante, elle, est déjà filtrée par le 22.
- La comparaison (`batirComparaison`, métriques `ctr`/`cpc` dans `buildDash`) —
  `MetriqueCompare.courant` est un `number`, la fenêtre sans impression compare 0.

Le module d'écart (`components/ecart.tsx`) et `MetriqueCompare` sont partagés
avec Instagram : leur faire accepter `null` touche les trois canaux.

- [ ] Chacun de ces quatre endroits écrit « — » ou saute le point, jamais 0
- [ ] `tsc` et build verts, 18 routes
