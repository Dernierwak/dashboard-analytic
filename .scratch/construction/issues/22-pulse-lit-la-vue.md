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


## Avancement — session du 2026-09-14 (construction)

**La moitié TypeScript est écrite et vérifiée hors ligne. Le ticket reste
ouvert : sa condition d'entrée n'a jamais pu être remplie.**
[44](44-la-vue-du-regroupement-ne-peut-pas-etre-jouee.md) a mesuré le 2026-09-13
que `theme_regroupement` n'existe pas en production **et que sa migration
échoue** (`column p.eng does not exist`). Le seul contrôle qui prouverait le
ticket — classer une campagne et voir le bilan bouger sans passage du worker —
demande la vue en service. Il n'a pas été fait.

Le code a été écrit quand même, avec un repli explicite pour ce cas précis
(§3) : déployé sans la vue, il ne casse rien, il n'apporte simplement rien.

### 1 · Ce qui a été construit

**`saas/web/lib/regroupement.ts`** — la moitié web de la vue, deux fonctions et
aucun calcul.

- **`lisRegroupement(supabase, uid)`** lit `theme_regroupement` avec le **client
  de session** (`lib/supabase/server.ts`, pas la clé de service) :
  `security_invoker` fait le reste et un membre invité voit ce que `a_acces()`
  lui ouvre. **Paginée** (PostgREST tronque à 1 000 lignes en silence,
  `CLAUDE.md` §8) et **ordonnée avant de l'être** (`.order("label")` posé avant
  `.range()`, sinon deux pages se recouvrent). **Bornée au compte REGARDÉ**
  (`getCompteActif().uid`) : `a_acces()` ouvre souvent plusieurs comptes à un
  invité, et sans ce filtre Pulse additionnerait les thèmes de deux clients sur
  la page d'un seul. C'est le pendant de `fetch_theme_regroupement`
  (`saas/commun/fetch_data.py`) pour une raison différente — là-bas c'est la clé
  de service qui ne filtre rien, ici c'est la RLS qui filtre trop large.
- **`fusionneRegroupement(report, regroupement)`** repose les chiffres de la vue
  sur `themes_focus[].summary`. Elle ne calcule rien : elle recopie.

**`revenuTheme()` est mort** (`lib/report.ts`), avec son unique appelant
(`theme-card.tsx`) et la prop `rows` qui le nourrissait (`app/page.tsx`). Son
« max de deux sources » prenait le plus grand entre `summary.revenue` (tout
l'historique) et `themes.rows[].rev` (la seule fenêtre du rapport) : **deux
périmètres, un seul chiffre, et le plus flatteur des deux affiché sous la
fenêtre de l'autre.** Le revenu d'un thème a désormais une source et une seule.

**Le drapeau `juge` voyage jusqu'à l'écran** (`ThemeSummary.juge`). Il n'est pas
décoratif : c'est lui qui distingue les deux raisons de ne PAS afficher de ROAS,
que la carte confondait en une seule phrase. Le seuil des 100 CHF, lui, reste
dans le SQL — le recopier en TypeScript referait le défaut que la vue existe
pour supprimer.

**Les trois `revalidatePath` sont rebranchés** — et les deux premiers l'étaient
déjà : `setCampaignLabel → /couts` et `setPostLabel → /` avaient été posés par
[17](../../refonte/issues/17-ce-qui-se-regroupe-et-ce-qui-est-mesure.md). Restait
le troisième, le `revalidatePath("/")` de `setCampaignLabel`, **no-op documenté
comme s'il marchait**. Il ne l'est plus : relire `/` relit la vue. Les deux
commentaires disent maintenant ce que le geste rafraîchit vraiment, et ce qui
attend toujours le Jour de travail.

### 2 · Ce qui se rafraîchit, et ce qui ne bouge pas

| Champ | D'où il vient maintenant |
|---|---|
| `summary.spend`, `ctr`, `posts`, `reach_avg`, `eng_avg` | **la vue**, à chaque affichage |
| `summary.revenue`, `roas`, `juge` | **la vue**, et elle seule |
| `summary.spend_week` | le payload — c'est LA semaine, pas l'historique (ticket 20) |
| `summary.best_campaign`, `n_campaigns` | le payload — la vue est au grain du thème |
| `jugement` en entier | le payload — **Mesure prise**, ne rétroagit jamais |
| baselines, Verdicts, repères d'action | le payload — idem |
| `themes.rows` / `orphan` (l'anneau) | le payload — **fenêtre du rapport**, pas tout l'historique. Les mélanger aurait posé une part « autres » d'une période contre des parts d'une autre. |
| conseils, `themes_tips` | le payload — des **Écrits** |

**La `series` du thème n'est pas touchée**, comme le ticket le prévoyait : la
vue est au grain du THÈME, pas de la semaine.

### 3 · LE CAS QUE LE TICKET NE TRANCHAIT PAS — la vue muette

Le ticket dit « sans réponse de la vue, pas de revenu ». C'est écrit pour un
thème **sans ligne** dans la vue ; il ne dit rien du cas où la vue **n'existe
pas du tout**. Et ce cas-là n'est pas théorique aujourd'hui (ticket 44). Trois
cas distincts, donc, chacun avec sa raison :

1. **La vue répond pour ce thème** → ses chiffres remplacent les figés.
2. **La vue répond, pas pour ce thème** → plus rien n'est regroupé dessous :
   ses chiffres passent à `null`, c'est-à-dire **inconnu**. Ni les anciens (que
   la vue ne confirme plus), ni zéro (qui affirmerait « il n'a rien dépensé »).
3. **La vue ne répond pas du tout** → **on ne rafraîchit RIEN.** Le payload
   reste tel qu'il a été publié, et la page dit déjà quand il l'a été
   (« publié le X »).

Le cas 3 diverge volontairement de Python, qui LÈVE et ne publie pas. Les deux
ne sont pas au même endroit du produit : le worker échoue dans un journal que
David lit, Pulse est l'écran du client. Vider les bilans de tous les comptes
parce qu'une migration manque punirait le lecteur pour un défaut d'exploitation.
**Le revenu, lui, ne connaît pas ce repli** : `revenuTheme()` étant mort, un
revenu que seul `themes.rows` portait ne s'affiche plus, vue ou pas vue.

**« Et on le dit »** : la carte porte deux phrases là où elle n'en avait qu'une,
parce qu'il y a deux raisons de ne pas montrer de ROAS et qu'elles ne se
confondent pas — « revenu inconnu tant que Google Analytics ne remonte pas la
valeur de tes conversions » (`revenue is null`) et « pas encore assez de dépense
sur ce thème pour se prononcer » (`juge === false`). La première était affichée
pour les deux cas.

### 4 · La vérification — 32 contrôles, plus `tsc` et le build

`.scratch/construction/harnais/22-pulse-lit-la-vue/` (`node verifie.mjs`, ni
base, ni secret, ni réseau). Il transpile `lib/regroupement.ts` tel qu'il est sur
le disque et le fait tourner devant un faux client PostgREST qui pagine. Aucun
runner n'est introduit dans `saas/web` — c'est un script `node` autonome,
`package.json` n'est pas touché, l'arbitrage de [16](16-le-seam-du-payload.md)
tient.

- **12** · la lecture : la bonne vue · bornée au compte regardé · l'ordre posé
  **avant** la pagination · 1 500 thèmes rendent 1 500 lignes en deux requêtes ·
  une panne rend « on ne sait pas », pas « rien ».
- **2** · la clé : casse et espaces normalisés comme `_nrm` côté worker.
- **18** · la fusion : les trois cas ci-dessus, ce qui ne bouge pas, et les
  bords.

**Le harnais tombe quand on casse le code** — vérifié en injectant deux pannes
(boucle de pagination supprimée, repli sur l'ancien total) : 28/32, avec les
quatre bons contrôles en rouge. Un harnais qui passe toujours ne prouve rien.

`rm -rf .next tsconfig.tsbuildinfo`, puis **`npx tsc --noEmit` vert** et
**`npm run build` vert à 19 routes**.

⚠ **Aucune vérification n'a touché la base**, et le `tsc`/build a été joué dans
un worktree où le répertoire de travail non commité a été recopié : `HEAD` seul
ne compile pas, il dépend de `lib/commandes.ts`, `components/bandeau-commandes.tsx`
et des fichiers `proto-*`, non commités. Seuls les fichiers de ce ticket sont
dans le commit.

### 5 · Ce qui reste, et l'ordre ne se négocie pas

- [ ] **[44](44-la-vue-du-regroupement-ne-peut-pas-etre-jouee.md) d'abord** —
      définir l'engagement dans `CONTEXT.md`, aligner le schéma du harnais 04 sur
      la production, réécrire `eng_avg` à partir des colonnes qui existent.
      Sans ça la vue ne peut pas être créée.
- [ ] **Jouer la migration**, puis déployer.
- [ ] **Le fil à la main, une fois la vue en service** : classer une campagne
      depuis `/labels`, revenir sur `/`, et voir le bilan du thème avoir bougé
      **sans passage du worker**. C'est le seul contrôle que ce ticket ne peut
      pas faire lui-même, et le seul qui prouve que le `revalidatePath` n'est
      plus un no-op. Les deux phrases de la carte se lisent au même moment.
- [ ] **Regarder bouger le revenu et le ROAS** (§3 du ticket 04) : certains
      thèmes vont changer de chiffre. Comparer à l'ancien rapport avant de
      conclure à une panne.

### 6 · Deux faits relevés en chemin, qui ne sont pas de ce ticket

- **`fetchAllRows` existe en deux copies** dans `saas/web/lib` (`couts.ts`,
  `changements-api.ts`), avec des sémantiques d'erreur DIFFÉRENTES : l'une
  avale, l'autre lève. Je n'en ai pas fait une troisième — `lisRegroupement`
  pagine en ligne — mais les deux restent, et c'est la copie muette qui est
  dangereuse : une période de coûts tronquée ne se voit pas.
- **La moitié web du ticket [18](18-revenu-google-non-rattachable.md) n'est pas
  faite** : `spend_muette`, `campagnes_muettes` et `part_muette` sont publiés
  par le worker et **aucun fichier de `saas/web` ne les lit** (`git grep`
  propre). Le ROAS incomplet de 10 thèmes sur 17 est donc affiché sans sa
  limite, à l'écran comme dans l'email. La vue les expose déjà — il n'y a qu'à
  les lire.
