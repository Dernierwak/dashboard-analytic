# À faire cette semaine : le module qui se vide

Type: grilling
Status: resolved
Blocked by: 04

## Question

[04](04-ce-qui-doit-etre-valide-en-premier.md) a tranché que **la récompense,
c'est la liste qui se vide** — pas une animation, pas une barre de complétion
(déjà refusée en [12](12-module-de-commandes.md)).

David :

> *« On a le module notification qui nous dit qu'on a x recos à faire ou tâches.
> Terminer une tâche, ou l'on choisit nous-même la date du terme, nous permet de
> voir qu'il nous reste une tâche de moins dans la barre de choses à faire —
> same quand on dit "j'ai pas envie de la faire car pas pour moi", on voit que
> nous avons une tâche de moins à faire. […] Ce que nous devons faire cette
> semaine devrait être dans un module qui nous montre et [se vide] plus nous
> avançons dans nos tâches. »*

Et l'intention derrière, à ne pas perdre :

> *« C'est important de trouver un moyen que les gens utilisent vraiment ces
> recos, et les valident, ajoutent les leurs. Que cela devienne comme un mini
> "notion" : j'ai mes tâches, je les fais, j'ajoute mes recos, mes idées, c'est
> mon cahier de bord. Et pas "ha oui j'ai fait, mais oublié de cliquer sur
> fait". »*

### Le défaut mesuré qui bloque la demande

**On ne peut pas valider à la date où on a agi.** `resolveAction`
(`app/actions.ts` l. 150-156) écrit `done_at: isoDate(today)` et fixe l'échéance
du verdict à **ce jour + 14**. Faire le changement mardi et cliquer vendredi
décale la mesure de trois jours — et le verdict repose sur cette date, donc ce
n'est pas cosmétique.

À noter : `saveNote` sait déjà le faire pour une note (date libre, jamais dans le
futur — *« on note souvent le lendemain ce qu'on a fait la veille »*). Le patron
existe, il n'est pas appliqué à la validation d'une action.

### Ce qu'il faut trancher

- **Ce que le module liste.** Les cinq conseils de la semaine (plafond de
  [11](11-d-ou-viennent-les-conseils.md)) seulement, ou aussi les actions en
  cours et les verdicts arrivés à échéance ? [12](12-module-de-commandes.md) a
  décidé **deux compteurs** dans la pastille de rappel : le module doit-il avoir
  la même partition, ou une seule liste ?
- **Son rapport à la pastille de la nav** (12). L'un est un compteur dans la
  navigation, l'autre un bloc dans le rapport. Deux objets pour un même chiffre
  ne doivent pas pouvoir se contredire — même exigence que `getCouverture` entre
  la page Thèmes et le rapport.
- **La date de réalisation : jusqu'où en arrière ?** Une date libre ouvre la
  porte à « c'était fait il y a trois mois », ce qui rendrait le verdict absurde
  (la baseline serait relevée sur une fenêtre révolue). Un plafond est
  nécessaire ; lequel, et que dit-on quand on le dépasse ?
- **Ce qui se passe quand la liste est vide.** [12](12-module-de-commandes.md) a
  posé le patron d'`alerte-themes.tsx` : un module qui n'a plus rien à dire
  **disparaît**, pas de « tout est fait ✓ » hebdomadaire. Le module « à faire »
  suit-il la même règle ? S'il disparaît, où va la fierté de l'avoir vidé ?
- **Le nudge, et sa réserve.** David veut que le module pousse aussi à *« ajouter
  une chose faite seul, écrire une reco soi-même, faire une reco dans son cahier
  de note, afin que la personne puisse avoir des minis succès »*. **Réserve
  écrite : un nudge qui revient chaque semaine devient un décor en trois
  semaines** — la leçon d'`alerte-themes.tsx`. À quelle condition apparaît-il, et
  qu'est-ce qui l'éteint ?
- **« Pas pour moi » fait descendre le compteur.** Décidé. Reste sa conséquence :
  `not_for_me` recule déjà une clé-règle de 6 dans `build_recos` — un refus
  utilisé comme raccourci pour vider la liste appauvrirait les conseils suivants.
  Est-ce qu'on l'accepte, ou est-ce qu'un refus demande une raison ?

### Ce qui n'est PAS dans ce ticket

Le compteur dans la navigation — [12](12-module-de-commandes.md), résolu. D'où
viennent les conseils et combien — [11](11-d-ou-viennent-les-conseils.md),
résolu. La note située sur la courbe — [19](19-module-mes-notes.md). Le conseil
facile et la dégradation — [14](14-le-conseil-facile-et-la-degradation.md).

### Consigne de conduite

Ticket **HITL**. Skills : `vision-produit` (l'idée du mini-Notion passe au banc
d'essai : décision, lundi matin, honnêteté, gamification), `ux` (les quatre
états d'une liste qui se vide), puis `grilling`.

### Consigne de repli

Trancher la date de réalisation et son plafond — c'est le seul point qui bloque
un défaut déjà mesuré — plutôt que d'ouvrir le nudge.

## Comments

**2026-09-10, versé par [21](21-le-document-de-refonte.md)** — David a décrit un
nudge de découverte, à trancher ici et pas dans la Mise en place : *« pouvoir
tout tester plus tard car on voit une note : hé teste cela (add labels, add
thème prio, met tes budgets de campagnes…) »*. Il veut *« un peu de liberté mais
qu'on sente être pris par la main »*.

La réserve déjà écrite dans ce ticket s'applique telle quelle : **un nudge qui
revient chaque semaine devient un décor en trois semaines**. La question reste
« à quelle condition apparaît-il, et qu'est-ce qui l'éteint ».

Ce qui a changé autour depuis : les conseils sont **filtrés dur** sur les thèmes
prioritaires (21), donc « désigne un thème prioritaire » n'est plus un conseil
d'usage — c'est ce qui débloque le module. Le nudge et le module verrouillé
disent potentiellement la même chose au même moment : à ne pas laisser se
doubler.

## Answer

### La règle, en une phrase

**Le module liste ce qui attend une décision de TOI cette semaine ; le rail
montre le temps qui passe.** C'est la seule frontière énonçable qui empêche les
deux de se contredire — et il en fallait une, parce que trois objets montrent
déjà les mêmes actions (les cartes de conseil, `rail-actions.tsx`, et la
pastille décidée en [12](12-module-de-commandes.md)).

Concrètement, le module porte **une seule liste** de deux natures : les conseils
de la semaine non encore décidés, et les Actions suivies dont le verdict est
tombé et qu'il faut regarder. « En cours », « en observation » et l'historique
restent au rail : ils n'attendent rien de toi. Les **deux compteurs** de 12 ne
sont pas deux listes — ce sont deux comptages de celle-ci, lus au même endroit,
sur le patron de `getCouverture`.

### Trois prémisses du ticket étaient fausses

**1 · La baseline n'est pas prise le jour du « fait ».** Le ticket redoutait
qu'une date libre « relève la baseline sur une fenêtre révolue ». C'est faux :
la baseline est photographiée à `decided_at`, au clic « ▶ Je le teste », et le
verdict compare cette valeur stockée au KPI d'aujourd'hui (`build_report.py`
l. 3751-3760). `done_at` ne pilote qu'une chose — `check_at = done_at + 14`,
donc le **jour où le verdict tombe**. Antidater ne fausse aucune mesure ; ça
avance seulement le verdict.

**2 · Un plafond de 3 actions ouvertes existe, et il n'est écrit dans aucun
ticket.** `app/page.tsx` l. 199 bloque « Je le teste » dès trois actions non
`done`. Avec cinq conseils par semaine ([11](11-d-ou-viennent-les-conseils.md)),
**la liste ne peut structurellement pas se vider par « fait »** : deux conseils
sur cinq n'ont d'autre sortie que le refus. Le code forçait exactement le
raccourci que ce ticket redoutait.

**3 · `not_for_me` est déjà scopé par thème.** `reco_engine.py` l. 724-729 :
+6 sur la clé, **sur ce thème seulement**, et ça repousse sans masquer.
L'appauvrissement redouté est borné au thème où le refus a été posé.

### Les décisions

**Le module montre la LIGNE, pas la carte.** Titre, thème, et les trois gestes
posés là (fait / pas pour moi / trop compliqué). Le titre est un lien **ancré**
vers la carte de thème, où le conseil est expliqué (pourquoi, comment vérifier,
effort). Un endroit où le conseil est *expliqué*, un endroit où il est
*expédié*. Déplier la carte entière dans le module referait ce que
[21](21-le-document-de-refonte.md) a fermé — sortir le conseil de son thème,
alors que le thème est ce qui le rend légitime ([11](11-d-ou-viennent-les-conseils.md) :
le conseil naît sur la carte du thème). Le doublon de boutons est assumé et le
précédent est déjà écrit : `reco-actions.tsx` l. 25-30, *« c'est la MÊME ligne
écrite par la MÊME server action, avec deux points d'entrée »*. Les gestes
doivent être **dans** le module : [04](04-ce-qui-doit-etre-valide-en-premier.md)
a fait de la liste qui se vide la récompense, on ne peut pas devoir la quitter
pour la vider.

**Il se pose après le bilan du carnet**, dans l'ordre déjà arrêté par
[10](10-l-entree-premier-ecran.md) : verdict → bilan du carnet → **à faire** →
rail des chantiers → résumé IA replié. L'ordre de 10 n'est pas décoratif : le
verdict répond à « ma semaine a été bonne ? », le bilan à « qu'est-ce que j'ai
fait ? » — les deux moitiés d'une même phrase, qu'une liste de corvées ne coupe
pas. Ouvrir le rapport sur ce qui reste à faire en aurait fait une corvée dès la
première ligne.

**Les conseils ne s'empilent jamais, les verdicts s'empilent toujours.** Ce
n'est pas une incohérence, c'est la différence entre une **proposition de
Pulse** et **le résultat de ton travail**. Un conseil non décidé ne coûte rien à
jeter : il redescend en priorité et revient plus simple
([14](14-le-conseil-facile-et-la-degradation.md)). Un verdict effacé au bout de
sept jours effacerait ce que tu as fait pour ne pas te faire de reproche — et
c'est le seul mécanisme de rétention de toute la carte
([03](03-le-but-de-pulse.md)). Le nombre reste borné par ce que tu as entrepris,
pas par ce que Pulse propose.

**→ Correction au §9 de [12](12-module-de-commandes.md)** (*« elle ne compte que
la semaine en cours, jamais de retard qui s'empile »*) : vrai des conseils, faux
des verdicts. Le code le faisait déjà sans que ce soit décidé — une action `due`
(`build_report.py` l. 3771) ne sort de « à juger » que par un clic « ✓ Vu »
(`app/actions.ts` l. 142-148), **rien ne l'archive tout seul**.

**Les verdicts d'abord, les conseils ensuite.** C'est déjà l'ordre du rail
(`rail-actions.tsx` l. 47, `ORDRE = { juger: 0, running: 1, observation: 2 }`) :
deux modules qui trient les mêmes objets en sens inverse sont la contradiction
que cette carte passe son temps à éviter. Et ce que tu as accompli passe devant
ce que Pulse propose.

**La date de réalisation est libre, bornée par `decided_at ≤ done_at ≤
aujourd'hui`.** Pas de plafond en jours, pas de nombre magique à défendre : on
ne peut pas avoir fait une chose avant de l'avoir prise, ni dans le futur. Le
calendrier n'offre simplement pas les jours hors bornes — pas de message
d'erreur, rien à expliquer. Quand `done_at + 14` est déjà passé, le verdict tombe
au rapport suivant : c'est juste, pas absurde, puisque la baseline date de la
décision. Le patron existe déjà pour les notes (`saveNote`, `app/actions.ts`
l. 227-232, *« on note souvent le lendemain ce qu'on a fait la veille »*) ; il
n'était pas appliqué à la validation d'une action.

**Le plafond de 3 meurt.** Ce qui limite la charge, c'est désormais la
*composition* des cinq décidée en [14](14-le-conseil-facile-et-la-degradation.md)
— jamais plus de deux `créer`/`corriger` à effort ≥ 1 h. Deux plafonds pour une
même chose, c'est le plus bête des deux qui gagne : celui de `page.tsx` compte
les lignes sans regarder ce qu'elles pèsent, et il a été posé avant que 14
n'existe.

**Aucune raison demandée sur un refus.** La troisième porte existe déjà —
« ◇ Trop compliqué » (`reco-actions.tsx` l. 44) — et 14 a tranché qu'elle
*simplifie* le conseil au lieu de le repousser : la raison est dans le choix du
bouton, pas dans un formulaire. Ajouter une friction sur le geste exact que 04 a
désigné comme la récompense reviendrait à défaire 04. Ce qui protège le moteur,
c'est que « trop compliqué » soit aussi facile à cliquer que « pas pour moi » —
il l'est déjà, mais **il ne sert encore à rien** : le moteur ne le lit jamais
(cinquième tuyau mort, relevé par [12](12-module-de-commandes.md) ; raccordé
par 14).

**La liste se vide sous le doigt.** La ligne s'en va, le compteur descend, à
chaque décision — c'est exactement ce que David décrit (*« on voit que nous
avons une tâche de moins »*), et ça se voit **au moment du clic**, pas dans un
écran d'arrivée. Pas de « tout est fait ✓ » hebdomadaire : le patron
d'`alerte-themes.tsx` tient. La fierté ne vit pas dans un écran de
félicitations mais dans les deux choses déjà décidées ailleurs — **le bilan du
carnet** (10) et le seul moment que 12 autorise à fêter, **l'arrivée d'un
verdict `better`**, parce que c'est le seul qui soit mesuré (§7).

**Le module ne disparaît pas quand il est vide : il disparaît quand il est vide
ET qu'il n'a plus rien à faire découvrir.** *Vide parce que tu as tout décidé* et
*vide parce que rien ne peut y entrer* ne sont pas le même écran, et la
distinction est réelle, pas cosmétique.

**Le nudge ne vit que dans le module vide**, jamais à côté de la liste, **un
seul à la fois**, et il est **éteint pour toujours par le premier usage du
geste** — pas par une semaine qui passe, pas par un clic « j'ai vu ». « Tu n'as
jamais écrit toi-même une chose faite », « tu n'as jamais posé de budget de
campagne » : une fois fait, jamais revu. C'est la seule condition d'extinction
qui tienne la réserve du ticket — **un nudge déclenché par le temps devient un
décor en trois semaines**, un nudge qui ne revient jamais après avoir été
satisfait ne le peut pas.

**C'est le module « à faire » qui dit « désigne un thème prioritaire »**, dans
son état *bloqué*. [21](21-le-document-de-refonte.md) filtre les conseils **dur**
sur les thèmes prioritaires : sans étoile, le module n'a aucun conseil possible,
jamais — il ne disparaît donc pas, il dit pourquoi il est vide et donne le
geste. La ligne de partage avec le module verrouillé de 04 est nette et
énonçable : **le module verrouillé parle de ce qui manque en base** (classe des
campagnes et tu débloques X), **le module « à faire » parle de ce qui manque à
ta décision.** Une priorité n'est pas une donnée absente, c'est un choix que
Pulse refuse de faire à ta place (`CLAUDE.md` §1). Le fil de démarrage est hors
jeu : 10 a décidé qu'il **ne revient jamais** une fois un rapport publié.

**La tâche qu'on s'écrit soi-même entre dans la liste, sans verdict.** Aucun
objet neuf : la colonne `kind: "note"` existe déjà (`app/actions.ts` l. 241), il
lui manque seulement de pouvoir naître en `running` au lieu d'`archived`. Elle
se coche, elle marque la courbe, elle n'a **ni indicateur, ni baseline, ni
verdict** — [04](04-ce-qui-doit-etre-valide-en-premier.md) l'a tranché, et pour
une raison que David avait lui-même renversée : juger sa note obligerait Pulse à
choisir le chiffre à sa place, donc à inventer une intention. Conséquence
assumée : **le compteur peut monter parce que le client l'a fait monter
lui-même**, et ça, ce n'est pas un reproche.

### Ce qu'il reste à porter en construction (aucune décision, du travail)

- `resolveAction` force `done_at: isoDate(today)` et `check_at = today + 14`
  (`app/actions.ts` l. 150-156) — à ouvrir sur la date choisie, bornée.
- Le plafond de 3 (`app/page.tsx` l. 199) — à retirer.
- `suivi_actions` n'a **aucune colonne de campagne** (relevé par 04) — nécessaire
  pour qu'une ligne écrite soi-même dise sur quoi elle porte.
- `kind: "note"` doit pouvoir naître en `status: "running"` — aucune migration,
  la colonne existe.
- `too_hard` reste non lu par le moteur — la réparation appartient à 14.

### Ce que gagne `CONTEXT.md`

**À faire** (le module). **Note** s'élargit : elle peut naître *avant* le fait,
et ne se date qu'au moment où on la coche — la règle « jamais dans le futur »
tient toujours, puisque la date n'est posée qu'à ce moment-là. **Action suivie**
perd « le produit en plafonne trois à la fois ». **Rappel** perd « il ne compte
jamais un retard accumulé », qui n'est vrai que de sa première ligne.
