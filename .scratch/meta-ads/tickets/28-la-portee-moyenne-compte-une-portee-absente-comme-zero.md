# 28: La portée moyenne compte une portée absente comme zéro

Type: task
Status: needs-triage
Blocked by: —

**Trouvé en revue** du ticket 25, pas demandé — `CLAUDE.md` §4.4.

`histReach` et `postsReach` (`getInstaDash`, `saas/web/lib/channels.ts`)
passent par `mean`, qui moyenne `Number(p.reach) || 0` : une publication dont
la portée n'est pas relevée y entre pour 0 et tire « portée moyenne … / post »
vers le bas, ainsi que le seuil « au-dessus de ton post moyen » de la table.
Même défaut que l'engagement avant le 25.

À trancher d'abord : une portée de 0 sur une publication est-elle une mesure
absente (comme les vues, voir `MoyennesInsta`) ou un zéro réel ? La récolte
(`saas/collecte/meta/`) doit dire si l'API rend 0 ou rien.

- [ ] La règle est tranchée et sourcée
- [ ] `tsc` et build verts, 18 routes
