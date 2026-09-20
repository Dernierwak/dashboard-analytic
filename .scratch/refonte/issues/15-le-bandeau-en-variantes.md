# Le bandeau de commandes, en trois variantes comparables

Type: prototype
Status: resolved
Blocked by: 12

## Question

[12](12-module-de-commandes.md) a tranché **ce que le bandeau porte et comment
il se comporte** ; il n'a pas tranché **à quoi il ressemble**. David, en le
résolvant : *« oui on peut, mais avoir un beau design et pas la sensation
d'avoir une barre qui nous suit, cela devrait être design. »*

C'est une question de forme, donc elle se répond en **variantes cliquables**,
pas en description — c'est la façon dont David a demandé à recevoir le travail
(voir les Notes de la carte) : `PrototypeSwitcher`
(`saas/web/components/prototype-switcher.tsx`, 77 l.), plusieurs variantes d'un
même module sur une vraie page via `?variant=`, navigation aux flèches,
invisible en production. Il tourne déjà sur `/labels`.

### Le cahier des charges, entièrement fixé par 12

- Un seul bandeau, collant, rendu au-dessus de la zone de contenu.
- **Il se replie au défilement** en une ligne fine qui n'affiche que les filtres
  actifs (« 30 j · Mariages »), redéployable au clic. C'est le point le plus
  délicat à dessiner et la raison d'être des variantes.
- Porte la date et **plusieurs** thèmes partout ; statut et campagne en plus sur
  `/meta` et `/google` ; un contrôle sans choix ne s'affiche pas.
- Absent de `/`, `/comptes`, `/equipe` ; thèmes seuls sur `/labels` et
  `/conversions`.
- URL : `d` et `l`, via `lienDash` — **on énumère ce qu'on CHANGE**, jamais ce
  qu'on garde (en-tête de `lib/liens.ts`).

### Ce que le prototype doit rendre comparable

Trois façons de traiter le repli et la densité, pas trois palettes. À proposer
sur une vraie page canal, avec de vraies données.

### Ce qui n'est PAS dans ce ticket

Le contenu des rangs 1 à 5 — [07](07-gabarit-de-plateforme.md), résolu. La
pastille de rappel, qui est un objet séparé vivant dans `SideNav` — 12.

### Consigne de conduite

Ticket **HITL**, à ouvrir **après la clôture de la carte** : c'est la première
brique de construction, pas une décision de plan. Skills : `prototype`, puis
`vision-ux` et `ux`.

### Consigne de repli

Livrer deux variantes finies plutôt que trois à moitié.

## Comments

**2026-09-11 — les trois variantes sont en ligne, le ticket attend le verdict
de David.** Ticket HITL : il ne se résout pas sans lui.

### Où les regarder

`/meta?variant=A`, `?variant=B`, `?variant=C` — vraies campagnes, vrais thèmes,
navigation aux flèches ← →, invisible en production. Sans le paramètre, `/meta`
est exactement la page d'avant. Quand une variante est posée, les commandes
actuelles (`PeriodPills`, `DateRange`, `FilterBar`) sont retirées : les laisser
aurait fait juger la densité d'une page qui porte ses filtres en double.

### Ce qui les sépare

|  | A — le ruban | B — le socle | C — la pilule |
|---|---|---|---|
| collant ? | toujours | toujours | jamais : il part avec la page |
| ce que le repli fait | comprime TOUT sur place, en une ligne de 34 px | LAISSE TOMBER l'étage du bas, garde la période à sa taille | détache un objet neuf, minuscule |
| ce qui reste à l'écran | un résumé écrit (« 30 j · Mariages, Audio Tour ») | la période, cliquable sans rien rouvrir | rien, tant qu'on n'a pas dépassé le bandeau |
| rouvrir | la ligne entière est cliquable | une porte (« ◆ 2 filtres ») rouvre l'étage tombé | la pilule ouvre un panneau flottant |
| le pari | on ne perd jamais le contexte | la période gouverne tout, le reste est secondaire | zéro chrome tant qu'on n'en a pas besoin |
| le prix | une bande reste là en permanence | deux étages de haut quand tout est ouvert | les filtres posés ne se lisent plus à côté des chiffres |

### Ce que monter le prototype a appris, avant même le verdict

- **`lienDash` jette tout paramètre absent de `DashParams`.** Sa base est typée,
  donc `variant` — et n'importe quel futur paramètre non déclaré — disparaît en
  silence des liens des tables et du graphe. C'est exactement la perte que son
  en-tête décrit (« un lien énumère ce qu'il CHANGE »), revenue par le typage.
  Le bandeau contourne en repartant de `useSearchParams`. À trancher : soit on
  élargit la base, soit on écrit la limite dans l'en-tête.
- **La plage libre (`DateRange`) pèse ~340 px sur une seule rangée.** Dans A,
  avec cinq thèmes de gabarit, la rangée tenait encore à 1 440 px ; avec un
  vrai vocabulaire de huit ou dix thèmes, elle passera à la ligne — et A perdra
  sa prémisse (« tout sur une rangée »). C'est précisément ce que le test sur
  `/meta` doit montrer.
- **La pilule de C recouvre le contenu.** Conteneur de hauteur nulle : elle ne
  prend pas de ligne, donc elle se pose SUR la première carte. Fond blanc et
  flou d'arrière-plan rendent la chose lisible, mais c'est un vrai arbitrage,
  pas un détail à corriger.

### Ce qu'il a fallu toucher hors prototype, et pourquoi

Deux retouches, toutes deux déjà tranchées par [12](12-module-de-commandes.md),
sans lesquelles le prototype aurait montré des filtres qui ne gouvernent rien —
donc une densité jugée sur un décor.

- `lib/channels.ts` — `DashParams.l` (répété, `?l=a&l=b`) et `keep()` qui
  l'honore : **plusieurs thèmes s'additionnent** (12 §4). `label` reste lu,
  n'est plus jamais écrit (12 §5). La forme répétée plutôt que séparée par des
  virgules suit `filtre-couts.tsx` : un thème peut contenir une virgule.
- `lib/liens.ts` — un paramètre répété survit désormais à un lien.
  `String(["a","b"])` l'aplatissait en `l=a,b`, soit un thème fantôme.

`/google` n'a pas été touchée : un seul terrain d'essai suffit à juger la forme.

### Vérifié

`npx tsc --noEmit` vert, `npm run build` vert, **19 routes**. Les trois
variantes ont été regardées se replier pour de vrai (page de contrôle
temporaire, **supprimée** — `git grep controle-` ne rend que la règle de
`CLAUDE.md` elle-même).

### Ce qui reste à faire, et qui n'est pas de moi

Choisir. Un mélange est une réponse valable (« le repli de A avec la hiérarchie
de B »). Une fois la variante retenue, elle se réécrit proprement — le code du
prototype a été écrit sans filet — et `proto-bandeau-commandes.tsx` part avec
les perdantes.

**2026-09-11, corrigé après retour de David — le piège de `CLAUDE.md` §8, posé
par le prototype lui-même.** `VARIANTES_BANDEAU` était exporté depuis
`proto-bandeau-commandes.tsx`, qui porte `"use client"` : la page serveur
`/meta` n'en recevait qu'une référence client, et `VARIANTES_BANDEAU.some(...)`
levait *« Attempted to call some() from the server »* à la première requête.

La constante et le type sont partis dans `components/proto-bandeau-modele.ts`,
sans directive.

**Pourquoi les vérifications de §9 ne l'ont pas vu, et ce qu'on en garde.**
`tsc` et `npm run build` étaient verts avant comme après : `/meta` est en
`force-dynamic`, donc rien n'est prérendu et la page n'est jamais exécutée à la
construction. **Une page `force-dynamic` n'est vérifiée par aucun des deux
contrôles ; seule une requête réelle la couvre.** La page de contrôle
temporaire montée pour regarder les replis ne l'attrapait pas non plus : elle
codait la variante en dur au lieu de la relire depuis la constante partagée —
elle rejouait la forme, pas le geste. Celle du second tour le rejouait, et
`curl` l'a confirmée en HTTP 200 (supprimée ensuite ; `git grep controle-` ne
rend que la règle de `CLAUDE.md` elle-même).

**2026-09-11, second jet — le premier était refusé, à raison.** David, mot pour
mot : *« deux, trois pins que je peux cliquer, c'est même pas bien ordonné, on
voit pas les informations »*, *« il y a deux fois le moyen de filtrer »*,
*« les trois prototypes sont exactement les mêmes »*.

Les trois défauts viennent du même endroit : le premier jet posait à plat TOUS
les contrôles de la page existante — cinq pastilles de période, une pastille par
thème, deux menus, deux champs de date, un OK — puis ne faisait varier que la
**mécanique de repli**. Quatorze objets permanents, aucune hiérarchie, et trois
variantes indiscernables à l'arrêt parce que ce qui les séparait ne se voyait
qu'en défilant.

### La règle ajoutée, qui gouverne les trois

**Une question, un contrôle — et rien qui n'est pas posé ne s'affiche.**

- La période avait **deux** commandes : les présélections d'un côté, la plage
  libre de l'autre, sans que rien ne dise qu'elles gouvernaient la même chose
  ni que poser l'une effaçait l'autre. Elles vivent maintenant dans **le même
  menu**, sous un seul bouton qui dit la période en cours.
- Un thème coché devient un **jeton qu'on retire**, pas une pastille de plus
  dans une rangée de huit. Statut et campagne ne s'affichent que s'ils ont à
  choisir, et une campagne se **cherche** dès qu'il y en a plus de huit.
- Le mono est réservé aux **données** (les bornes de la fenêtre, le résumé
  contracté). « 30 derniers jours » et « Tout » sont des libellés : en chasse
  fixe ils prenaient le poids d'un chiffre.

### Les trois partis pris, visibles à l'arrêt

|  | **A · La capsule** | **B · L'en-tête vivant** | **C · La phrase** |
|---|---|---|---|
| ce que c'est | un objet posé SUR la page, détaché des bords | aucun objet neuf : le TITRE porte les commandes | aucun contrôle : une phrase dit ce qu'on regarde |
| au repos | capsule blanche flottante, 3 objets | titre Georgia + segmenté + jetons | « Tu regardes les 30 derniers jours, sur Mariages et Audio Tour. » |
| au défilement | se **contracte en largeur** jusqu'à son résumé | le titre **rétrécit** (34 px → 17 px), la 2ᵉ ligne tombe | une **pastille ronde** se pose en haut à droite |
| où tout se règle | menus ancrés sous la capsule | menus ancrés sous l'en-tête | un **tiroir** généreux, groupes étiquetés, jamais de menu dans un menu |
| le pari | un outil qu'on déplace du regard, jamais une barre | rien n'apparaît, donc rien ne peut suivre | zéro chrome au repos, tout l'espace une fois ouvert |
| monté | au-dessus de `<main>` | **à la place** de l'en-tête de page | sous le titre |

Elles ne se montent pas au même endroit dans la page : c'est une partie de ce
qui les sépare.

### Vérifié

Les trois regardées à l'écran, au repos, défilées, menus et tiroir ouverts.
Deux défauts de rendu corrigés en chemin : le voile du tiroir en
`backdrop-blur` que Chrome recopiait en damier (remplacé par un aplat), et
l'en-tête condensé de B qui perdait les filtres actifs — il ne répondait donc
plus à « pourquoi ce graphe montre ça », seule raison pour laquelle une ligne
fine mérite sa place (ticket 12 §2). `npx tsc --noEmit` vert, `npm run build`
vert, **19 routes**, page de contrôle supprimée.

## Answer

**B — l'en-tête vivant.** Tranché par David le 2026-09-11 : *« J'aime beaucoup
la B. Il y a enfin une vraie interaction […] Partir sur la B. Garde celle-ci. »*

### Ce que B décide, et que les deux autres refusaient

**Le bandeau n'est pas un objet de plus : c'est le TITRE de la page.** Rien de
neuf n'entre jamais à l'écran — c'est la réponse structurelle à la demande de
[12](12-module-de-commandes.md) (*« pas la sensation d'avoir une barre qui nous
suit »*). A posait une capsule flottante par-dessus la page, C faisait
apparaître une pastille : les deux ajoutaient un objet. B n'en ajoute aucun, il
fait maigrir celui qui était déjà là. Georgia 34 px devient 17 px, la ligne
passe de ~78 px à ~44 px.

**Le repli ne fait rien tomber : il fusionne.** Amendement de David en
retenant la variante : *« garder la date et le fil par thème […] les laisser
aussi quand on scrolle, qu'ils soient toujours là, que je peux les utiliser
après, et que ça reste pas trop grand. »* Il a raison sur le fond : un filtre
qu'on ne peut plus toucher sans remonter en haut de page n'est pas replié, il
est **retiré** — et c'est précisément en bas de page, devant la table des
campagnes, qu'on veut cocher un thème.

Les deux lignes deviennent donc UNE, et tout reste vivant : la fenêtre en
dates, les thèmes posés (retirables d'un clic), les portes Statut et Campagne,
la période. Mécanique : un seul conteneur `flex-wrap` et une **coupure de
largeur pleine** (`basis-full`) insérée au repos, retirée au défilement ; la
période bascule en `order-last` pour rester à droite dans les deux
dispositions. Rien ne se démonte ni ne se remonte — les contrôles gardent leur
état et leur focus, ils changent seulement de gabarit.

### La règle de densité, acquise au passage et valable pour tout le produit

**Une question, un contrôle — et rien qui n'est pas posé ne s'affiche.**

Le premier jet a été refusé (*« deux, trois pins que je peux cliquer, c'est même
pas bien ordonné, on voit pas les informations »*, *« il y a deux fois le moyen
de filtrer »*, *« les trois prototypes sont exactement les mêmes »*). Le défaut
venait d'avoir recopié la page existante : quatorze objets permanents, et trois
variantes qui ne différaient que par une mécanique invisible à l'arrêt.

- **La période avait deux commandes** qui ne se parlaient pas : les
  présélections d'un côté, la plage libre de l'autre, sans que rien ne dise
  qu'elles gouvernaient la même chose ni que poser l'une effaçait l'autre. Elles
  vivent dans **un seul menu**, sous un bouton qui dit la période en cours.
- **Un thème posé est un jeton qu'on retire**, pas une pastille de plus dans une
  rangée de huit. Statut et campagne ne s'affichent que s'ils ont à choisir
  (règle de 12 §3), et une campagne se **cherche** au-delà de huit.
- **Le mono est réservé aux données** — les bornes de la fenêtre. « 30 derniers
  jours » et « Tout » sont des libellés : en chasse fixe ils prenaient le poids
  d'un chiffre.

### Ce qui a été touché hors prototype, et qui reste

Deux corrections déjà tranchées par 12, sans lesquelles le bandeau aurait
montré des filtres ne gouvernant rien :

- `lib/channels.ts` — `DashParams.l` (répété, `?l=a&l=b`) et `keep()` qui
  l'honore : **plusieurs thèmes s'additionnent** (12 §4). `label` reste lu,
  n'est plus écrit (12 §5). Forme répétée et non séparée par des virgules : un
  thème peut contenir une virgule (`filtre-couts.tsx`).
- `lib/liens.ts` — un paramètre répété survit à un lien.

### Un défaut trouvé en chemin, qui n'est pas du prototype

- **Une page `force-dynamic` n'est vérifiée par aucun des contrôles de
  `CLAUDE.md` §9.** Ni `tsc` ni `npm run build` ne l'exécutent ; une constante
  exportée d'un module `"use client"` et lue côté serveur (§8) n'a levé qu'à la
  première vraie requête. Seule une requête réelle couvre ces pages.

### La suite

La construction — poser B dans le layout, sur toutes les pages concernées, et
retirer A, C et le `PrototypeSwitcher` — sort en
[27](27-le-bandeau-partout.md). Le prototype reste en place jusque-là.

**2026-09-11, correction — `lienDash` ne perd rien.** Ce ticket a affirmé deux
fois, et la carte une troisième, que `lienDash` jetterait tout paramètre absent
de `DashParams`. **C'est faux, et ça n'avait pas été testé.** `Object.entries`
parcourt l'objet REÇU, et ce que Next passe à une page contient tous les
paramètres de l'URL, déclarés ou non : la boucle les recopie donc tous. Vérifié
en exécutant la fonction sur `{ d, l, inconnu }` — `inconnu` ressort dans les
deux liens produits. Le type est une description de ce qu'on manipule, jamais la
liste de ce qui passe ; la limite est écrite dans l'en-tête de `lienDash` pour
qu'on ne la redéduise pas de sa signature. Le contournement par
`useSearchParams` dans le bandeau reste juste — il est simplement nécessaire
parce que le composant est client, pas pour éviter une perte.

Ce qui reste vrai et acquis : **un paramètre RÉPÉTÉ (`?l=a&l=b`) ne survivait
pas** — `String(["a","b"])` l'aplatissait en `l=a,b`, soit un thème fantôme.
C'est la correction faite dans `lib/liens.ts`, et le même essai la confirme.
