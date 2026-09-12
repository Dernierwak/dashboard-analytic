# Pulse lit la vue : la moitié TypeScript du regroupement

Type: task
Status: open
Blocked by: 04

## Question

**Le repli de [04](04-vue-sql-du-regroupement.md) a été appliqué**, comme ce
ticket le prévoyait : *« livrer la vue avec sa pagination et son drapeau `juge`,
sans la moitié TypeScript, plutôt que les deux à moitié »*. La vue existe, elle
est vérifiée, **et elle n'est pas jouée** — donc son critère d'entrée (« à faire
ici seulement si la vue est en service ») n'était pas rempli.

La vue est le seul endroit où Python et TypeScript partagent une
implémentation. Tant que Pulse ne la lit pas, ce partage n'existe que d'un côté :
Python lit la vue, Pulse lit encore le payload figé.

### Condition d'entrée

**La vue en service en base.** `000_run_me_all.sql` joué, le code de 04
déployé, un rapport publié dessus. Sans ça, il n'y a rien à brancher et rien à
vérifier.

### Ce qu'il faut faire

- **Lire la vue depuis `/`**, avec le client de session (pas la clé de service) :
  `security_invoker` fait le reste, et un membre invité voit ce que
  `a_acces()` lui ouvre. **Paginer** — PostgREST plafonne à 1 000 lignes et
  tronque en silence (`CLAUDE.md` §8) — et **ordonner avant de paginer**, sinon
  deux pages se recouvrent. Le précédent Python est
  `fetch_theme_regroupement` (`saas/commun/fetch_data.py`).
- **`revenuTheme()` meurt** (`lib/report.ts` l. 210, un seul appelant :
  `theme-card.tsx` l. 199). Son « max de deux sources » est un chemin capable
  d'afficher un revenu que la vue ne confirme pas (§7). **Sans réponse de la
  vue, pas de revenu — et on le dit.** Pas de zéro, pas d'estimation.
- **Rebrancher les trois défauts de rafraîchissement** relevés par
  [17](../../refonte/issues/17-ce-qui-se-regroupe-et-ce-qui-est-mesure.md) :
  `setCampaignLabel` ne rafraîchit pas `/couts` ; `setPostLabel` ne rafraîchit
  pas `/` ; et le `revalidatePath("/")` de `setCampaignLabel` est un **no-op
  documenté comme s'il marchait** — il redevient utile le jour où les blocs par
  thème viennent de la vue.
- **Ce qui vient de la vue se rafraîchit ; ce qui vient du payload attend.**
  L'inventaire est fait, champ par champ, dans l'Answer de 17 : `jugement` en
  entier, les baselines, les Verdicts et les repères d'action sont des **Mesures
  prises** et ne rétroagissent jamais. Ne pas les recalculer.

### Ce qui n'est PAS dans ce ticket

- **La `series` du thème.** 17 la range en Regroupement (*« une courbe n'est
  qu'une suite de sommes »*), mais la vue livrée par 04 est au grain du THÈME,
  pas de la semaine : redessiner la courbe à la lecture demande un second grain,
  qui n'a aucun consommateur aujourd'hui. À rouvrir quand la carte de thème lira
  la vue — pas avant, sinon on bâtit pour personne.
- **Aucun runner de test dans `saas/web`** — arbitré par David
  ([16](16-le-seam-du-payload.md)). Vérification : `npx tsc --noEmit`,
  `npm run build`, **19 routes**, et le fil parcouru à la main.

### Consigne de repli

Livrer **la lecture de la vue et la mort de `revenuTheme()`**, sans les trois
`revalidatePath`, plutôt que les deux à moitié. Un chiffre juste qui met une
semaine à bouger vaut mieux qu'un chiffre faux rafraîchi tout de suite.
