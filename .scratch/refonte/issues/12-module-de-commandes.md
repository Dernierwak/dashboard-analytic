# Le module de commandes : un seul, partout

Type: grilling
Status: resolved

## Question

Gradué par [09](09-la-porte-vers-la-plateforme.md), où David a élargi la réponse
au-delà du ticket :

> *« Si on veut unifier alors oui cela est bien, mais le module devrait être
> visible sur toutes les pages, mais pas intégré par page. On devrait avoir un
> module qui est visible partout — je dis bien **1 module** et pas ajouter les
> filtres partout. Ce module serait pour les filtres qui sont partout, la date
> par exemple et labels aussi. »*

C'est le **rang 0** du gabarit de [07](07-gabarit-de-plateforme.md), promu au
rang d'objet unique de l'application.

### L'état mesuré : deux filtres, quatre pages, trois vocabulaires

| Page | Période | Thème |
|---|---|---|
| `/meta`, `/google` | `d` | `label` — **un seul** |
| `/instagram` | `d` | **aucun** |
| `/couts` | `p` | `l` — **plusieurs** |

Et les pastilles de période sont **écrites deux fois**, à l'identique :
`PeriodPills` (`components/channel-dash.tsx` l. 33) et `PeriodPillsInsta`
(`app/instagram/page.tsx` l. 38) — mêmes options 7/14/30/90/Tout, même balisage,
deux fichiers, deux constructeurs de liens.

Conséquence directe sur [09](09-la-porte-vers-la-plateforme.md) : un lien qui
transporte une fenêtre depuis le rapport doit parler trois langues selon où il
atterrit.

### Ce qui existe déjà et qu'il ne faut pas défaire

`lib/liens.ts` est la bonne base et porte une leçon payée cher, écrite dans son
en-tête : **un lien énumère ce qu'il CHANGE, jamais ce qu'il garde** — sinon il
perd en silence tout paramètre ajouté après lui, en produisant une URL valide.
`exclusifs()` y règle déjà la cohabitation période ↔ plage libre. Le module de
commandes se construit dessus, il ne le remplace pas.

### Ce qu'il faut trancher

- **Ce que le module porte.** La date et le thème sont acquis (David). Le
  statut de campagne et le filtre campagne sont propres aux pages payantes : ils
  restent dans la page, ou ils entrent dans le module et se cachent là où ils
  n'ont pas de sens ?
- **Un thème ou plusieurs.** `/couts` en accepte plusieurs (`l`), les pages canal
  un seul (`label`). Un module unique doit choisir — et si c'est « plusieurs »,
  les pages canal doivent apprendre à additionner.
- **Un seul vocabulaire d'URL.** Les liens partagés et les favoris existants
  cassent si on renomme. Est-ce qu'on accepte l'ancien nom en plus du nouveau,
  et pendant combien de temps ?
- **Où le module se pose, et sur quelles pages.** Les pages sans données de
  canal (`/`, `/labels`, `/comptes`, `/equipe`, `/conversions`) : il s'affiche
  vide, il se cache, ou il porte autre chose ? **Cas dur : la page d'accueil est
  un rapport hebdomadaire publié**, un instantané figé — une date qu'on y change
  ne peut pas recalculer le rapport. Elle pourrait en revanche désigner **quelle
  semaine on relit**, ce qui est exactement le trou mesuré par
  [06](06-le-parcours-comment-les-pages-se-parlent.md) (`weekly_reports` lu
  `.limit(1)`) et le sujet de [08](08-la-memoire-du-travail.md).
- **Collant ou non.** [07](07-gabarit-de-plateforme.md) a établi que la barre
  doit suivre quand on descend ; `sticky` n'existe aujourd'hui que dans les
  en-têtes de tableaux.

### Ce que le ticket 11 y a ajouté : la notification

David, en résolvant [11](11-d-ou-viennent-les-conseils.md) :

> *« Bien avoir la vue de la semaine, ok je vois ce qui se passe, et on peut
> ajouter une ancre pour aller sur les recos — mais cela devrait être plus une
> **notification "tu as encore X recos"**. Cette notification peut vivre sur
> l'app, elle ne doit pas être rattachée à la page hebdomadaire. »*

Même nature que les commandes : quelque chose de **visible partout qui
n'appartient à aucune page**. À trancher avec le reste :

- **Ce qu'elle compte.** Les conseils non traités (plafonnés à cinq par 11) ?
  Les actions en cours et à juger (`suivi_actions`, cf. [08](08-la-memoire-du-travail.md)) ?
  Les deux, ou deux compteurs distincts ?
- **Ce qui la fait disparaître.** Un conseil lu, un conseil écarté, une action
  lancée ? Un compteur qui ne descend jamais devient un décor.
- **Où elle mène**, depuis une page qui n'est pas le rapport.
- **Son rapport au bandeau des commandes** : même barre, ou deux objets voisins ?

### Ce qui n'est PAS dans ce ticket

Le contenu des pages (rangs 1 à 5 du gabarit) — c'est
[07](07-gabarit-de-plateforme.md), résolu. Ce que le carnet relit — c'est
[08](08-la-memoire-du-travail.md). Le code : cette carte produit un plan.

### Consigne de conduite

Ticket **HITL**. Skills : `ux` (les quatre états et le coût d'une action),
`vision-ux` (hiérarchie et uniformisation), puis `grilling` +
`domain-modeling` — le vocabulaire des filtres est à trancher et à écrire dans
`CONTEXT.md`.

### Consigne de repli

Écrire ce qui est tranché sur ce que le module porte plutôt que d'entamer la
question du vocabulaire d'URL.

## Answer

**Un seul bandeau de commandes, collant et repliable, qui porte la date et les
thèmes partout — et une pastille de rappel qui vit dans la nav, séparée de lui.**
Onze décisions, toutes de David sauf mention contraire.

### Le bandeau

**1 · Un seul objet, rendu par le layout, collant.** Pas une barre par page, pas
un composant « partagé » qu'on recopie : le bandeau se pose une fois au-dessus
de la zone de contenu, comme `SideNav` aujourd'hui (`app/layout.tsx`). David a
écarté l'idée de descendre les filtres près des blocs qu'ils gouvernent :
*« les graphs du haut seront filtrés et le filtre se trouve en bas, cela ne fait
pas sense. »* Ce qui gouverne la page se lit avant la page.

**2 · Il se replie au défilement.** Au premier scroll il passe de sa forme
complète à une ligne fine qui n'affiche **que les filtres actifs** (« 30 j ·
Mariages »), redéployable au clic. Demande de David : *« pas la sensation
d'avoir une barre qui nous suit, cela devrait être design. »* C'est le seul
comportement qui garde à l'écran la réponse à « pourquoi ce graphe montre ça »
tout en rendant la place. Les deux autres candidats sont écartés : la barre
pleine hauteur mange ~60 px en permanence, et l'effacement au scroll fait
disparaître l'information au moment précis où on lit les chiffres qu'elle
explique.

**3 · Ce qu'il porte : la date et les thèmes, partout. Statut et campagne en
plus, sur `/meta` et `/google` seulement.** David : *« les filtres qui sont
uniques à une plateforme, campaign name, cela devrait être que sur la
plateforme. »* La règle qui en découle et qui vaut pour tout ajout futur : **un
contrôle n'apparaît que s'il a quelque chose à choisir** — c'est déjà le
principe écrit dans l'en-tête de `rail-filtre.tsx`, on l'étend, on n'invente
rien.

**4 · Plusieurs thèmes, partout, et deux thèmes cochés s'additionnent.**
`/couts` le fait déjà (`l` multi-valeurs, `plusieurs()` l. 87) ; les pages canal
n'acceptent qu'un thème (`label`) et `/instagram` n'en accepte aucun. C'est donc
un vrai travail sur trois pages, pas une uniformisation cosmétique. La **somme**
et pas la comparaison : cocher deux thèmes veut dire « cache-moi le reste ».
David a pesé la comparaison côte à côte et l'a **reportée** : *« séparer serait
super […] mais cela devrait être un autre module, comme sur GA4. Cela devrait
être à faire plus tard, car nous avons déjà beaucoup de choses, et cela est pour
des experts. »* → noté dans `BACKLOG.md`, hors de cette carte. Argument
structurel qui a appuyé la somme : la comparaison thème contre thème a déjà son
lieu, le **rang 3** du gabarit de [07](07-gabarit-de-plateforme.md) — deux lieux
pour une même lecture, c'est exactement comment on s'est retrouvés avec trois
moteurs de « ce qui marche » ([11](11-d-ou-viennent-les-conseils.md)).

**5 · Un seul nom de filtre dans l'URL : `d` pour la période, `l` pour les
thèmes.** L'état mesuré était trois vocabulaires (`d`/`label` sur les canaux,
`p`/`l` sur `/couts`, rien sur `/instagram`) — c'est ce qui empêchait un lien de
voyager d'une page à l'autre, le problème posé par
[09](09-la-porte-vers-la-plateforme.md). On prend les noms **déjà majoritaires**
plutôt que des noms « explicites » : `lienDash` et `exclusifs()` savent déjà les
manier avec `from`/`to`. **Les anciens noms (`p`, `label`) restent compris en
lecture, mais plus aucun lien n'en fabrique** — aucun favori ne casse, et le
vieux nom s'éteint tout seul. Un renommage complet aurait cassé des liens
partagés pour un gain purement esthétique.

**6 · Où il ne s'affiche pas.** Caché sur `/comptes` et `/equipe` (rien à
filtrer, jamais) et **sur `/` (le rapport)** : [08](08-la-memoire-du-travail.md)
a tranché qu'on ne rouvre aucune semaine passée, et un rapport publié est un
instantané figé — une date qu'on y changerait ne peut rien recalculer. Un
contrôle inerte en tête de la page la plus lue est pire que pas de contrôle. Sur
`/labels` et `/conversions`, il ne garde **que les thèmes**. Jamais de contrôle
grisé « pour tenir la place » : une commande désactivée demande de comprendre
pourquoi, à chaque page.

### La pastille de rappel

**7 · Un objet séparé, dans `SideNav`, pas dans le bandeau.** Ils n'ont ni la
même nature ni le même rythme : le bandeau **change ce que je regarde
maintenant** (il se manipule, il ne compte rien) ; la pastille **dit qu'il reste
du travail** (elle ne se manipule pas, elle se vide en jours). Les coller
mettrait un compteur immobile à côté de boutons cliqués dix fois par minute. Et
`SideNav` répond mot pour mot à la demande de 11 : *« cette notification peut
vivre sur l'app, elle ne doit pas être rattachée à la page hebdomadaire. »*

**8 · Deux lignes, pas un nombre fondu** : « X conseils cette semaine » /
« X actions à juger ». Ce ne sont pas deux versions de la même chose — l'une
demande de **décider**, l'autre de **juger**, et la seconde est le seul
mécanisme de rétention de toute la carte ([03](03-le-but-de-pulse.md)). Les
fondre donnerait un nombre qui ne dit pas quoi faire. Elle **disparaît quand les
deux sont à zéro**, sur le patron déjà écrit dans `alerte-themes.tsx` : *« Pas
de "tout est rattaché ✓" chaque lundi. Un bloc qui dit que tout va bien toutes
les semaines s'apprend par cœur en trois semaines. »*

**9 · Elle ne compte que la semaine en cours** (max cinq conseils, plafond posé
par 11). Jamais de retard qui s'empile : un compteur qui monte est un reproche,
et le diagnostic de David le dit lui-même — *« les personnes n'ont pas le temps
ou l'envie de les faire »*. Un conseil ignoré n'est pas perdu pour autant : il
redescend en priorité et **revient plus simple** (→ ticket 14).

**10 · Le clic mène aux conseils dans le rapport, ancré sur le bloc.** David :
*« les conseils sont sur l'hebdomadaire, c'est le cockpit. »* Une ancre par
ligne. Atterrir en haut du rapport rejouerait le trou mesuré par
[06](06-le-parcours-comment-les-pages-se-parlent.md) ; ouvrir directement une
carte de thème choisirait à la place du client, et mentirait dès que les trois
conseils portent sur trois thèmes.

**11 · Le compteur est partagé entre les personnes d'un compte.** David : *« si
une action est faite, c'est mis en fait, c'est en parallèle, les données sont
toutes pareilles. »* Le travail décrit dans le carnet est celui de
l'**entreprise** (03), pas d'une personne : deux verdicts sur un seul chiffre
seraient une contradiction, pas une nuance. **Ce n'est pas gratuit** :
`suivi_actions` et `reco_feedback` sont clés par `user_id` aujourd'hui — c'est
une migration sur du stockage existant, donc elle sort en ticket
[16](16-compteur-partage.md) au lieu d'être glissée ici.

### Ce que David a refusé, et pourquoi c'est écrit ici

Il a demandé une **barre de complétion et des animations de réussite** pour
motiver. Refusé après confrontation à deux mesures, et David a suivi :

- La carte porte un avertissement sourcé au ticket [02](02-sur-quoi-se-differencient-les-autres.md) :
  **une barre de progression peut *réduire* la complétion** en rendant le coût
  saillant.
- `CLAUDE.md` §7 : une barre « 3/5 conseils » félicite d'avoir **cliqué**, pas
  d'avoir **gagné** — elle affiche un progrès qui ne mesure rien.

**Ce qu'on garde de l'intention** : on ne fête que le **mesuré**. L'arrivée d'un
verdict `better` sur le rail des actions (08) devient le moment de célébration,
avec le chiffre gagné dedans. C'est motivant, ça ne peut pas mentir, et **aucun
des dix produits lus en 02 ne l'a**. Si une barre est voulue un jour, la seule
honnête existe déjà : le % de dépense rattachée à un thème (`getCouverture`),
qui mesure un état réel du compte et pas une case cochée.

### Fait constaté en résolvant : le quatrième tuyau mort

Les quatre réactions existent en base — `useful` / `not_for_me` / `too_hard` /
`done` (`app/actions.ts:11`), avec le bouton « ◇ Trop compliqué » à l'écran
(`reco-actions.tsx:44`). **`too_hard` n'est lu par personne** : `build_recos` ne
pondère que `not_for_me` (+6) et `done` (+2/+6 selon verdict) ; aucune
occurrence de `too_hard` dans `saas/recos_ia/`. Le signal exact que réclame la
demande de David — *« si pas faite, faire des recos plus simples »* — est
collecté depuis le début et jeté. Quatrième tuyau mort de la carte après
`preuve` (08), les semaines passées (06) et les constats de `/labels` (11).

### Vocabulaire (écrit dans `CONTEXT.md`)

**Bandeau de commandes** et **Rappel**. Le mot « Rappel » est **proposé, pas
dicté par David** : il a dit « notification », mot réservé ici aux vraies
notifications poussées, que Pulse n'envoie pas — voir `CONTEXT.md`.

### Ce qui sort en tickets

- [14](14-le-conseil-facile-et-la-degradation.md) — le conseil toujours faisable,
  et le conseil ignoré qui revient plus simple.
- [15](15-le-bandeau-en-variantes.md) — le bandeau en trois variantes
  comparables (`PrototypeSwitcher`), **après** la clôture de la carte.
- [16](16-compteur-partage.md) — le compteur partagé entre les personnes d'un
  compte.

## Comments

**2026-09-10, correction versée par [20](20-a-faire-cette-semaine.md)** — le
**§9 est vrai d'une seule des deux lignes de la pastille.** « Jamais de retard
qui s'empile » tient pour les **conseils** (un conseil non décidé redescend et
revient plus simple, 14). Il ne tient pas pour les **Actions suivies arrivées à
échéance** : une action `due` (`build_report.py` l. 3771) ne sort de « à juger »
que par un clic « ✓ Vu » (`app/actions.ts` l. 142-148) — **rien ne l'archive
tout seul**, et c'était déjà le comportement du code avant qu'on en décide quoi
que ce soit.

David l'a tranché en connaissance de cause : un conseil non décidé est une
**proposition de Pulse**, la jeter ne coûte rien ; un verdict est **le résultat
de son travail**, et l'effacer au bout de sept jours pour ne pas lui faire de
reproche effacerait la seule rétention de la carte ([03](03-le-but-de-pulse.md)).
Le nombre reste borné par ce qu'il a entrepris, pas par ce que Pulse propose.

## Comments

**2026-09-11 — le §11 est corrigé par [16](16-compteur-partage.md).** Il annonce
que la pastille partagée coûte *« une migration sur du stockage existant »*,
parce que `suivi_actions` et `reco_feedback` seraient *« clés par `user_id` »*.
Elles le sont — mais `user_id` **porte le compte, pas la personne**
(`const user = { id: compte.uid }` dans tout `app/actions.ts`), et la section 15
du bundle les partage déjà en RLS. **Le compteur est donc partagé aujourd'hui,
sans un geste, et aucune ligne n'est à ré-attribuer.** La décision du §11 tient
entièrement ; c'est son coût qui était surestimé.
