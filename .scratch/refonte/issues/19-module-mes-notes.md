# Mes notes, situées sur la courbe — sans dupliquer un seul graphique

Type: prototype
Status: claimed
Blocked by: 04

## Question

[04](04-ce-qui-doit-etre-valide-en-premier.md) a tranché la frontière :
**les conseils de Pulse ont un verdict, les notes du client ont une marque.**
Pulse fournit le contexte, le client fournit le jugement — parce que juger la
note obligerait Pulse à choisir à sa place le chiffre à surveiller, donc à
inventer une intention.

David, en le décidant :

> *« Quand une personne fait un changement d'une campagne, elle la sélectionne,
> on a un affichage sur les graphs [que] son action est mise, et elle estime
> elle-même si cela aide. […] La personne dit "j'ai fait cela ce jour-ci pour
> cette campagne". Ensuite soit il voit sur le graph hebdomadaire une
> modification par moi, et voit ok le [CTR] semble monter donc bien. Il fait ses
> propres intuitions. […] Cela lui permet de dire ok je veux regarder tout ce que
> j'ai fait pour une campagne, de filtrer ses notes par campagne, voir un line
> plot avec quand il a fait les changements, et avoir un line plot avec 2-3
> metrics : impression, clics sur ads, CTR. Pour les postes organics, same avec
> une moyenne impression, engagement, follower. »*

**La contrainte que David a posée en validant ce ticket, et qui est la vraie
question :**

> *« Pour le module des notes, cela doit être poussé. On ne devrait pas avoir
> trop de répétition de graphs, utiliser ce que nous avons pour pas dupliquer.
> Rends cela pertinent, et pas juste ajouter un module qui vit à moitié et dont
> personne ne voit un réel intérêt. »*

**Donc la question n'est pas « quel module dessiner » mais « où cette lecture
existe-t-elle déjà, et que faut-il lui ajouter ».**

### Ce qui existe déjà — l'inventaire, pour ne rien redessiner

- **La courbe et son sélecteur de métrique existent, avec exactement les
  métriques demandées.** `channel-dash.tsx` l. 642-647 :
  `spend`, `clicks`, `impressions`, **`ctr`**, `cpc`. Instagram :
  `reach`, `views`, `likes`, `comments`, `saved`, **`eng`** (engagement).
  La métrique affichée est déjà un paramètre d'URL (`m`).
- **Le filtre par campagne existe** : `camp` (`DashParams`), déjà appliqué aux
  KPI, à la courbe et aux tables. Le bandeau de commandes de
  [12](12-module-de-commandes.md) le porte sur `/meta` et `/google`.
- **Les abonnés existent en base** (`followers_history`) mais **ne sont pas** dans
  la liste des métriques sélectionnables — c'est le seul ajout de métrique que la
  demande implique.
- **La frise porte déjà les notes**, deux fois : `_markers` ne filtre pas `kind`
  (relevé en [08](08-la-memoire-du-travail.md)).
- **Le rail des actions sait déjà filtrer** par thème et par plateforme
  (`rail-filtre.tsx`), avec la règle « un sélecteur n'apparaît que s'il sert à
  quelque chose ».
- **`line-chart.tsx` accepte déjà `markers` / `marqueurs`** — les props sont
  vivantes et **ne dessinent plus rien** (voir le piège ci-dessous).

### Le piège d'août, à ne pas rejouer

Les marques d'action sur une courbe ont existé, et **c'est David qui les a fait
retirer** (`line-chart.tsx` l. 45-56, retour du 24 août 2026) :

> *« Retiré à la demande de David : sur une carte de thème, ils ressortaient
> comme deux points noirs pleins au milieu des points bleus de la série et
> brouillaient la lecture de la courbe. »*

La demande d'aujourd'hui n'est pas la même : là, la marque était un **parasite
sur la courbe de quelqu'un d'autre** (une mini-courbe de thème, dans un module
qui parlait d'autre chose) ; ici elle est **le sujet**. Un prototype qui remet
des points pleins sur une série existante refait l'erreur d'août.

### Ce qu'il faut trancher

- **Un nouveau module, ou un rang de plus sur une page existante ?** La piste la
  moins coûteuse : **aucune courbe neuve** — la courbe de la page canal, filtrée
  par campagne (`camp`), gagne les marques ; et « mes notes » devient une
  **liste** avec sa porte vers cette courbe, pas un second graphique. À
  challenger : cette piste éparpille la lecture sur deux pages, ce que la
  contrainte de David interdit peut-être plus encore que la duplication.
- **Où le module vit.** David dit *« limite à côté du point de situation de la
  semaine »*. À confronter au gabarit de [07](07-gabarit-de-plateforme.md) : les
  notes sont-elles un rang du gabarit (donc présentes sur les trois plateformes)
  ou un bloc du rapport ?
- **Comment une marque se dessine sans salir la série** — la question d'août.
  Candidats : une bande verticale claire, une rangée de repères **sous** l'axe,
  un survol. C'est ce qui se prototype en variantes.
- **Ce qui se passe sans campagne.** Une note peut ne porter qu'un thème, ou
  rien. Elle se marque quand même (sur quelle courbe ?) ou elle reste une ligne
  de liste ?
- **Ce qui rend le module vivant plutôt qu'à moitié mort.** Critère à écrire :
  qu'est-ce qu'on y lit qu'on ne peut lire nulle part ailleurs ? Si la réponse
  est « la même courbe avec des points en plus », le module ne mérite pas
  d'exister.

### Ce qui n'est PAS dans ce ticket

Le verdict des conseils de Pulse — [08](08-la-memoire-du-travail.md), résolu. Le
module « à faire cette semaine » et la date de validation —
[20](20-a-faire-cette-semaine.md). La colonne de campagne sur `suivi_actions`,
décidée en 08 : c'est son prérequis, pas sa décision.

### Consigne de conduite

Ticket **HITL**, **prototype** : la question est visuelle, elle se répond en
variantes cliquables (`PrototypeSwitcher`), sur une vraie page avec de vraies
notes. Skills : `prototype`, `vision-ux`, `ux`, et `dataviz` pour la marque sur
la courbe. **Faire l'inventaire de réemploi AVANT de dessiner** : tout graphique
neuf doit être justifié contre la liste ci-dessus.

### Consigne de repli

Rendre l'inventaire de réemploi et le critère « qu'est-ce qu'on lit ici qu'on ne
lit nulle part ailleurs », même sans variante dessinée. C'est ce qui empêche le
module à moitié mort.

## Inventaire de réemploi — session du 2026-09-11

Fait **avant** de dessiner, comme la consigne l'exige. Trois choses que le
ticket ne savait pas encore, et la dernière change la question.

### Ce qui existe et se réemploie tel quel

| Ce qu'il faut | Où c'est déjà | Reste à faire |
|---|---|---|
| une courbe journalière, métrique au choix | `MetricChart` (`channel-dash.tsx` l. 613-720), sur `/meta` et `/google` | rien |
| les métriques que David demande (impressions, clics, **CTR**) | `METRICS` l. 613-619 — `spend`, `clicks`, `impressions`, `ctr`, `cpc` | rien |
| le filtre par campagne | `keep()` (`lib/channels.ts` l. 568-574) — il filtre **déjà `daily`**, pas seulement les KPI et les tables | rien |
| la date exacte de chaque colonne | `DayPoint.date` est un ISO, `daily` est construit jour par jour (l. 622-629) | rien — la note tombe sur sa colonne **sans arrondi** |
| la couche où poser une marque | `LineChart` pose déjà **tout ce qui se lit** en HTML absolu par-dessus le SVG, en `%` de la même boîte (en-tête du fichier) | rien — une marque s'y ajoute sans toucher au tracé |
| une zone de survol par colonne | `LineChart` l. 478-500, un `group` par colonne, déjà pleine hauteur | rien — une note peut entrer dans la bulle existante |
| écrire une note, la supprimer | `saveNote` / `deleteNote` (`app/actions.ts` l. 215-272), `NoteAjout`, `NoteLigne` | rien |
| lire les notes | `lib/report.ts` l. 618-675, `kind: "note"` | rien |
| filtrer un fil par thème et par plateforme | `rail-filtre.tsx`, avec sa règle « un sélecteur n'apparaît que s'il sert » | rien |

### Deux corrections à l'inventaire du ticket

- **Les abonnés ne sont pas un ajout de métrique.** Le ticket dit qu'ils
  manquent au sélecteur. Ils ont en fait **déjà leur propre courbe** —
  `CourbeAbonnes` (`channel-dash.tsx` l. 1391-1448), montée sur `/instagram`,
  avec `socle="bas"` et ses deux bornes écrites parce qu'un cumul sur un axe
  partant de zéro est un trait plat. Les mettre **en plus** dans le sélecteur
  des posts, ce serait la deuxième lecture du même fait — exactement ce que la
  contrainte de David interdit. **Rien à ajouter.**
- **Instagram n'a pas de courbe journalière, et ce n'est pas un oubli.**
  `PostsMetricChart` est un **`BarChart`, une barre par post** : un post est un
  événement, pas un flux quotidien. Une marque « à cette date » n'y transpose
  donc pas — sur Instagram, **les événements SONT déjà les barres**. Ce que
  l'organique peut recevoir, c'est la note **sur la courbe des abonnés**, seule
  série continue de la page. À trancher avec le reste.

### Le fait qui déplace la question

**Les notes et la courbe ne sont pas sur la même page, et rien ne les relie.**

- `RailActions` — le seul endroit où une note s'affiche — n'est monté que sur
  `/` (`theme-card.tsx` l. 560, `hors-theme.tsx` l. 149). Les pages canal ne
  portent **ni rail, ni note, ni bouton pour en écrire une**.
- Une note porte `theme`, `decided_at`, `title`. **Elle ne porte aucune
  campagne** : `suivi_actions` n'a pas la colonne (schéma l. 766-780, plus
  `done_at`, `detail`, `kind`, `verdict`). C'est le prérequis posé en
  [08](08-la-memoire-du-travail.md).

Conséquence directe, et c'est du `CLAUDE.md` §7 : **« filtrer mes notes par
campagne », mot pour mot la demande de David, n'est pas calculable
aujourd'hui.** Par thème, oui — le thème existe des deux côtés. Par campagne,
non, et aucune heuristique ne le rattrape : deviner la campagne d'une note
d'après sa date, ce serait fabriquer le lien qu'on prétend montrer.

**Ce que ça change au dessin.** Une note écrite depuis `/` n'a aucun moyen de
savoir de quelle campagne elle parle. Une note écrite **depuis la page canal,
sous la courbe, filtre déjà posé**, hérite de son contexte sans qu'on demande
rien à personne — la campagne du bandeau et la plateforme de la page. Le
prérequis de 08 cesse alors d'être une colonne à remplir à la main : c'est
l'écran qui la remplit. C'est l'argument le plus fort pour que le module vive
**sur la page canal** plutôt qu'à côté du point de situation.

### Le critère — ce qu'on lit ici et nulle part ailleurs

La question que le ticket demande d'écrire avant de dessiner.

- Le rail de `/` répond **« qu'est-ce que j'ai fait ? »** — une chronologie.
- La courbe de `/meta` répond **« qu'est-ce que les chiffres ont fait ? »**
- Aucun des deux ne répond **« est-ce que les deux tombent au même moment ? »**

**Le module n'existe que s'il rend la COÏNCIDENCE lisible d'un coup d'œil, à la
granularité où la personne travaillait** — cette campagne-là, cette métrique-là.
Une liste ne peut pas montrer une coïncidence ; une courbe nue ne sait pas qui a
agi. Si la réponse à « qu'est-ce qu'on lit ici » est « la même courbe avec des
points en plus », le module ne mérite pas d'exister — c'est le test que David a
posé, et il se passe ici.

**Et la coïncidence n'est pas la cause.** C'est ce qui sépare une note d'une
action : [04](04-ce-qui-doit-etre-valide-en-premier.md) a tranché qu'une note
n'a pas de verdict, parce que juger obligerait Pulse à choisir le chiffre à
surveiller, donc à inventer une intention. Le module fournit le contexte,
**jamais le jugement** — aucune flèche, aucune couleur de statut, aucun
« +12 % depuis ta note ». Un chiffre d'effet sur une note serait le verdict que
04 a refusé, reconstruit par la bande.

## Prototype livré — 2026-09-11 · EN ATTENTE DU JUGEMENT DE DAVID

Le ticket reste **ouvert** : c'est un ticket HITL, il ne se referme pas sans que
David ait comparé les variantes. Tout est en place pour qu'il le fasse.

### Où regarder

`/meta?variant=A` · `B` · `C` · `D` — flèches ← → pour passer de l'une à
l'autre (`PrototypeSwitcher`, invisible en production). **Sans le paramètre, la
page est exactement celle d'avant.**

Sur `/meta` seulement, et c'est délibéré : la question prototypée est **la forme
de la marque**, pas encore l'endroit où le module vit. « Rang du gabarit ou bloc
du rapport » est une décision à part, qui suit celle-ci.

### Les quatre variantes, et l'axe qui les sépare

Toutes montrent les mêmes notes, au même jour. Elles diffèrent sur **ce que la
marque coûte au tracé** et sur **où vit le texte de la note**.

| | A — les traits | B — le peigne | C — la frise | D — la liste commande |
|---|---|---|---|---|
| dans le tracé | un trait fin + un numéro | **rien** | **rien** | rien, sauf à la demande |
| le texte vit | dans la liste, numérotée | dans la liste, datée | **sur la frise**, sous sa colonne | dans la liste, datée |
| visible quand | toujours | toujours | toujours | quand tu survoles la note |
| ce que ça coûte | le tracé se raye dès 4-5 notes | l'œil fait un aller-retour tracé ↔ peigne | de la place, et le texte déborde vite | rien n'est imposé, donc rien ne se voit tout seul |
| ce que ça gagne | la coïncidence saute aux yeux | le tracé ne perd pas un pixel | tout se lit sans rien survoler | la courbe reste propre, la liste est le sujet |

**Aucune ne pose quoi que ce soit SUR le tracé ni sur ses points.** C'est la
règle qui vient du 24 août 2026 : les repères d'action retirés étaient des
points pleins au milieu des points de la série. Une marque est ici **verticale**
(elle marque un temps) ou elle est **hors du cadre**. Elle n'emprunte ni le bleu
de la série ni une couleur de verdict — encre neutre diluée, `#2b2b33`.

### Ce que l'écran avoue, et pourquoi chaque phrase y est

Le module porte trois aveux. Aucun n'est décoratif : chacun empêche une lecture
fausse que la seule proximité produirait (`CLAUDE.md` §7).

1. **« Ces notes ne sont pas filtrées par campagne »** — quand une campagne est
   cochée au bandeau. La courbe obéit au filtre, les notes non, et rien à
   l'écran ne le dirait.
2. **« Cette note ne porte aucun thème — rien ne la rattache à Meta »** — le
   trou le plus grave, et celui que le ticket n'avait pas vu. Le trou de
   campagne se voit (le bandeau est juste au-dessus) ; celui-là ne se voit pas
   du tout. Une note sans thème posée sur la courbe de Meta lui prête un sujet
   qu'elle n'a jamais eu.
3. **« N autres notes hors de la fenêtre affichée »** — sans quoi « 2 notes »
   sur un compte qui en a douze se lit comme une panne.

Et **aucune variante ne juge** : pas de flèche, pas de couleur d'état, pas de
« +12 % depuis ta note ». Un chiffre d'effet sur une note serait le verdict que
[04](04-ce-qui-doit-etre-valide-en-premier.md) a refusé, reconstruit par la
bande.

### Ce qui a été écrit

- `saas/web/lib/proto-notes.ts` — les variantes et le lecteur. **Sans directive,
  volontairement** : `VARIANTES_NOTES` est lu par la page, donc côté serveur, et
  une constante exportée d'un module `"use client"` devient un proxy sans que
  rien ne lève (`CLAUDE.md` §8).
- `saas/web/components/proto-notes-courbe.tsx` — le dessin des quatre variantes
  (client : le survol de D a besoin d'état).
- `saas/web/components/proto-notes-module.tsx` — la coque du module, côté
  serveur.
- `saas/web/app/meta/page.tsx` — le montage conditionnel. **La variante
  REMPLACE `MetricChart`, elle ne s'ajoute pas à lui** : deux fois la même
  courbe sur un écran est précisément ce que le ticket interdit.

`MetricChart` et `LineChart` ne sont **pas touchés** — dix-sept autres courbes en
dépendent. Le prix est que la coque du module est recopiée dans le jetable ; si
une variante gagne, la marque devient une **prop de `LineChart`** et la copie
disparaît. C'est le seul endroit où ce prototype duplique quelque chose, et
c'est du code, pas un graphique à l'écran.

### Vérifié, et ce qui ne l'est pas

`npx tsc --noEmit` vert et `npm run build` vert après `rm -rf .next
tsconfig.tsbuildinfo`, **19 routes**. Le lien du sélecteur de métrique conserve
`?variant=` (`lienDash` itère `Object.entries` et `params` porte les
`searchParams` bruts) : changer de métrique ne fait pas sortir du prototype.

**Ce qui n'a pas pu être vérifié, et il faut le dire** : la session n'a **aucun
accès réseau** — la résolution DNS de Supabase échoue. Je n'ai donc **pas vu les
variantes à l'écran**, et je ne sais pas combien de notes le compte porte
réellement. Deux conséquences honnêtes :

- Si le compte n'a aucune note dans la fenêtre, les quatre variantes affichent
  leur **état vide** — qui est écrit, et qui dit quoi faire. Pour les comparer,
  il faut deux ou trois notes datées dans la période : elles s'écrivent depuis
  la page d'accueil (« ✎ Noter quelque chose que tu as fait »), avec une date
  libre dans le passé.
- Un défaut de collision reste possible et non mesuré : en A, le numéro de la
  toute première note (i = 0) se pose près de l'étiquette du haut de l'échelle
  de `LineChart`. À regarder ; ça ne se corrige que si la variante gagne.

### La question qui reste ouverte, et qui n'est pas la forme

Le ticket demandait aussi **« ce qui rend le module vivant plutôt qu'à moitié
mort »**. L'inventaire y a répondu par un critère (la coïncidence), mais il a
sorti un fait qui déplace la décision suivante :

**Une note écrite depuis la page canal, sous la courbe, filtre posé, hérite de
son contexte sans qu'on demande rien** — la campagne du bandeau et la plateforme
de la page. La colonne de campagne réclamée par [08](08-la-memoire-du-travail.md)
cesse alors d'être un champ à remplir à la main : c'est l'écran qui la remplit.
Le prototype ne porte **pas** ce geste d'écriture, exprès — il aurait fallu
stocker une campagne que la table ne sait pas encore porter, donc promettre à
l'écran un rattachement qui n'existe pas. C'est la décision d'après, et elle a
un prérequis de migration.
