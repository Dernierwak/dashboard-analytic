# 28: La portée moyenne compte une portée absente comme zéro

Type: task
Status: resolved
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

- [x] La règle est tranchée et sourcée
- [x] `tsc` et build verts, 18 routes

## Réponse

**Règle : une portée de 0 est une mesure absente.** C'est la seule lecture
possible, parce que la récolte ne laisse aucun moyen de distinguer les deux cas.
`_fetch_post_metrics` (`saas/collecte/meta/fetch_instagram.py`) écrit
`val or 0`, et `fetch_headless` écrit `.get("reach", 0)`. Une métrique non
rendue, ou un appel en erreur, arrive donc en base sous la forme d'un 0. La
lecture web (`Number(p.reach) || 0`) fait de même d'un `null`. L'engagement
lisait déjà ce 0 comme une absence depuis le 25.

`porteeRelevee` (`saas/web/lib/channels.ts`) rend `null` pour ce 0.
`histReach` passe par `moyenneMesuree` et vaut `null` quand aucune
publication n'a de portée. La page en tient compte à trois endroits :

- la tuile écrit « — » ;
- l'état vide tait la phrase « porte d'habitude à … » ;
- la légende dit qu'il n'y a pas de post moyen et que rien n'est en vert.

`postsReach` est retiré plutôt que corrigé : `git grep` ne lui trouve aucun
lecteur. `mean` part avec lui.

Vérifié :

- `tsc --noEmit` et `npm run build` sont verts, 18 routes.
- La règle a été exécutée sur des portées `[1000, 0, 500, 0]`. Avant :
  moyenne 375. Après : 750. `null` quand aucune portée n'est relevée, `null`
  sur une liste vide.

Non vérifié à l'écran : aucune donnée de démo n'a de publication sans portée.
Rien à faire côté worker, c'est de l'affichage, visible au prochain
déploiement Vercel.

Trouvé en chemin : ticket 29. La table et le top 3 écrivent encore « 0 »
pour une portée absente, et le tri la range comme un zéro.
