# Le module « à faire cette semaine » qui se vide, et la date où on a agi

Type: task
Status: resolved
Blocked by: 05

## Question

**Tranché par [20](../../refonte/issues/20-a-faire-cette-semaine.md).** C'est le
second des deux tickets que le plan §3 exigeait avant d'écrire une ligne — résolu,
il reste à le bâtir. **La récompense, c'est la liste qui raccourcit**, à chaque
décision, « c'est fait » comme « pas pour moi ».

### La règle unique qui empêche un quatrième objet redondant

**Le module liste ce qui attend une décision de TOI ; le rail montre le temps qui
passe.** C'est la seule frontière qui empêche ce module de contredire les trois
objets qui montrent déjà les mêmes actions.

### Les trois prémisses fausses que 20 a corrigées

- **La baseline n'est pas prise au « fait » mais à `decided_at`**
  (`build_report.py` l. 3751-3760) : **antidater ne fausse aucune mesure**, ça
  avance seulement le verdict. D'où une date libre bornée par
  **`decided_at ≤ done_at ≤ aujourd'hui`**, **sans plafond en jours**.
- **Un plafond de 3 actions ouvertes existait, écrit nulle part** (`page.tsx`
  l. 199) : à cinq conseils, deux n'avaient d'autre sortie que le refus — **le
  code forçait le raccourci que le ticket redoutait. Il meurt.** 14 borne déjà la
  charge par la composition.
- **`not_for_me` est déjà scopé par thème** (+6, sans masquer).

### Le défaut à réparer, à la ligne

`resolveAction` écrit `done_at: isoDate(today)` et fixe l'échéance à **ce jour +
14** (`app/actions.ts` l. 150-156). Faire le changement mardi et cliquer vendredi
décale la mesure de trois jours — **et le Verdict repose sur cette date**.
**Le patron existe déjà dans `saveNote`** : date libre, jamais dans le futur.

### Les décisions de forme, telles quelles

- **La ligne, pas la carte** — le conseil est expliqué sur son thème, **expédié**
  dans le module.
- **Posé après le bilan du carnet** — l'ordre de 10 tient.
- **Les conseils ne s'empilent JAMAIS, les verdicts s'empilent TOUJOURS** :
  proposition de Pulse contre résultat de ton travail. **Ce qui corrige le §9 de
  12** — rien n'archive un `due` tout seul.
- **Les verdicts d'abord**, l'ordre du rail.
- **Aucune raison demandée sur un refus.** « Trop compliqué » est déjà la sortie
  non pénalisante.
- **La liste se vide sous le doigt** — **pas d'écran de félicitations, pas de
  barre de complétion, pas d'animation.** Refusées en 12 après confrontation à 02
  (une barre de progression peut *réduire* la complétion) et à §7 (elle félicite
  d'avoir cliqué). **On ne fête que le mesuré**, à l'arrivée d'un verdict `better`.
- **Le module disparaît quand il est vide ET n'a plus rien à faire découvrir.**
- **Le nudge ne vit que dans le module vide**, un seul à la fois, **éteint pour
  toujours par le premier usage du geste** — jamais par le temps.
- **C'est le module « à faire » qui dit « désigne un thème prioritaire »**, dans
  son état bloqué : le module verrouillé du ticket **08** parle de ce qui manque
  **en base**, celui-ci de ce qui manque **à ta décision**.
- **La tâche écrite soi-même entre sans verdict** — `kind: "note"` naissant en
  `running`, **aucun objet neuf**.

### Le vocabulaire

`CONTEXT.md` gagne **À faire** ; **Note** peut naître avant le fait, **Action
suivie** perd son plafond de trois, **Rappel** perd « jamais de retard ».

### Consigne de repli

La **date libre** d'abord — c'est elle qui casse le fil aujourd'hui, et elle est
petite. Le module ensuite.

## Avancement — session du 2026-09-12 (construction)

**La date libre et le module sont écrits, `tsc` et `npm run build` sont verts à
19 routes, et RIEN N'A ÉTÉ VÉRIFIÉ EN SERVICE** : aucun clic joué sur un vrai
compte, aucune écriture relue en base — le projet Supabase accessible en local ne
donne que la clé anon (fait déjà relevé aux tickets 02 et 16). Aucun test
automatisé non plus : `saas/web` n'a pas de runner, c'est la décision de David au
ticket 16, et la carte l'annonçait pour ce ticket-ci nommément.

### 1 · La date libre — le défaut mesuré est réparé

`resolveAction` prend maintenant un contexte (`{recoKey, theme, title, doneAt}`)
au lieu de quatre arguments positionnels, et **`done_at` vaut le jour choisi**,
plus `isoDate(today)`. `check_at` en découle (`done_at + 14`), donc l'échéance du
verdict part du jour où le changement existe.

- **La borne basse se LIT** — `decided_at` de cette ligne-là — et seulement quand
  une autre date qu'aujourd'hui est proposée : le clic du jour même ne paie pas
  la lecture supplémentaire.
- **Hors bornes, on REFUSE** au lieu de rabattre sur aujourd'hui. Le calendrier
  de l'écran n'offre pas ces jours (`min`/`max`) : y arriver, c'est un écran en
  retard ou un appel forgé, et écrire une date que personne n'a choisie sur la
  seule colonne dont dépend l'échéance serait un fait fabriqué (§7).
- **`plusJours` remplace `new Date(iso)`** : une date nue est lue comme UTC et
  relue avec les accesseurs locaux — à l'ouest de Greenwich, l'échéance reculait
  d'un jour. Le défaut n'était pas visible depuis la Suisse ; il l'aurait été.
- Le calendrier est **prérempli sur aujourd'hui** et posé AVANT le bouton, dans
  le rail (`action-vivante.tsx`) et sur la carte (`reco-actions.tsx`) : le geste
  reste un seul clic pour le cas courant.

### 2 · Le plafond de trois meurt

`capReached` a disparu de `page.tsx`, `theme-card.tsx`, `reco-card.tsx` et
`reco-actions.tsx` — définition, passage de props et bandeau « Tu as déjà 3
chantiers en cours ». Quatre commentaires qui invoquaient encore ce plafond pour
justifier autre chose (le filet hors thème, le renommage d'un thème, la maison du
cycle de vie) ont été réécrits : ils décrivaient un mécanisme qui n'existe plus.

### 3 · Le module

- **`lib/a-faire.ts`** trie et compte — et c'est le SEUL endroit qui compte, pour
  que la pastille de la navigation (refonte 12) ne puisse pas dire un autre
  chiffre. `composerAFaire` est pure ; `compteursAFaire` rend les deux comptages.
- **`components/a-faire.tsx`** (serveur) dessine le module,
  **`components/a-faire-lignes.tsx`** (client) porte les gestes : chaque ligne se
  retire elle-même au clic et revient si le serveur refuse.
- **L'ordre** : verdicts → ce que tu t'es écrit → conseils. Celui du rail, et
  ce que tu as accompli devant ce que Pulse propose.
- **La ligne, pas la carte** : titre + thème + effort, le titre renvoyant à
  l'ancre de la carte du thème — ou à `#reglages`, à qui ce ticket a donné un
  `id`.
- **Trois gestes sur un conseil** : « ✓ C'est fait », « ✕ Pas pour moi »,
  « ◇ Trop compliqué ». Aucune raison demandée.
- **Un geste sur un verdict** : « ✓ Vu — je range ».
- **Le module est posé juste sous le hero**, là où il restera : le bilan du
  Carnet qui doit s'intercaler et la descente du résumé IA appartiennent au
  ticket 13.

### 4 · Trois écarts et une décision que le ticket ne portait pas

- **« ✓ C'est fait » dans le module n'offre PAS de calendrier.** La décision et
  le fait sont le même clic : la borne `decided_at ≤ done_at` d'une ligne née à
  l'instant ne laisse qu'un jour légal. Antidater demanderait de reculer AUSSI la
  décision, donc d'affirmer une prise qui n'a pas eu lieu. Le calendrier vit donc
  là où une ligne existait déjà — le rail, la carte, et la tâche écrite soi-même.
- **Les réglages de base entrent dans la liste.** Ils attendent une décision
  comme les autres ; les laisser dehors ferait de leur bloc le seul endroit où un
  conseil peut se cacher de la liste.
- **Une veille n'entre PAS.** Elle ne demande aucun geste — la carte ne lui donne
  déjà ni « ▶ Je le teste » ni suivi. L'inscrire ferait une liste qu'on ne peut
  pas vider.
- **Le raccourci du hero est retiré** (« ▸ 2 actions en cours · 1 à juger — y
  aller ↓ »). Il pointait vers ce qui tient maintenant dans le même écran, et il
  comptait faux au regard de la frontière décidée : il annonçait « à juger » ce
  qui était en observation, et comptait comme t'attendant les actions en cours,
  qui n'attendent rien de toi. C'était le quatrième objet que ce ticket existe
  pour empêcher.

### 5 · Ce que la tâche écrite soi-même a obligé à toucher ailleurs

Une Note peut naître `running` (`saveTache`) — aucun objet neuf, aucune
migration. Elle n'existe alors **que** dans ce module, et trois lectures devaient
l'apprendre, sans quoi elle serait apparue comme un fait accompli :

- `rail-actions.tsx` ne montre pas une tâche ouverte (le rail montre le temps qui
  passe) ;
- le filet « hors thème » ne la COMPTE plus (`app/page.tsx`) — il l'aurait
  comptée sans pouvoir l'afficher, et le chiffre du module aurait menti ;
- `lib/proto-notes.ts` ne la marque pas sur la courbe — elle ne se date qu'au
  moment où on la coche (`CONTEXT.md`, entrée Note). **Cette correction-là n'est
  PAS dans le commit** : le fichier lui-même n'est pas suivi par git — c'est un
  des cinq modules du prototype de notes laissés non commités par la session du
  bandeau (fait déjà relevé en tête de la carte). Elle part avec eux le jour où
  ils entrent ;
- **`build_report.py`** ne la lit plus dans `_sa` : elle n'a ni indicateur ni
  baseline, aucun verdict ne peut tomber dessus, et elle n'a rien à faire dans la
  mémoire des hypothèses d'un thème. Filtré en Python et non dans la requête —
  un `.neq("kind", …)` échouerait sur une base sans la colonne, et l'`except`
  au-dessus viderait alors TOUT le suivi en silence.

`completeNote` écrit la date choisie sur `decided_at` (la seule date d'une note,
celle que le rail affiche et que la courbe marque), jamais sur `done_at` — une
note n'a rien de mesuré. Même garde de collision que `resolveAction` : `update`
conditionné au statut de départ **et** lignes touchées relues.

### 6 · Le cas « aucune étoile » a déménagé

`ConseilsVerrouilles` ne RÉCLAME plus d'étoile : la demande — la phrase en gras,
le lien vers ◫ Thèmes, ce qu'une étoile débloque — vit dans le module À faire,
comme `CONTEXT.md` l'exige. La carte de thème n'est pas muette pour autant (un
vide non expliqué se lit comme une panne) : elle nomme l'état en une ligne et
renvoie au module. **Un seul endroit demande, tous les autres expliquent** —
répéter la demande sur cinq cartes en ferait le décor qu'on évite partout.

### 7 · Le conseil d'usage du module vide

Deux, dans l'ordre, **un seul à la fois**, **éteints pour toujours par le premier
usage du geste** et jamais par le temps : « tu n'as encore rien écrit toi-même »
(éteint dès qu'une Note existe), puis « tu n'as encore posé aucun budget »
(éteint dès qu'une ligne de `channel_budgets` existe). Deux lectures d'une ligne,
ajoutées à la volée parallèle de `getWeeklyData` — « jamais » ne se déduit pas
d'une fenêtre de 60 lignes. **Une erreur de lecture vaut « déjà fait »** : on ne
pousse pas vers un geste dont on ne sait pas s'il est possible. Et **l'état
bloqué éteint le conseil d'usage** : sans étoile, le module pousse déjà vers un
geste précis, et la refonte 20 interdit que les deux se doublent.

### 8 · Ce qui reste

- [ ] **Le voir en service, sur ton compte.** Une correction du traitement ne se
      voit qu'après un « ↻ Recharger mes conseils », une correction de récolte
      après « ↻ Mes données ».
- [ ] **Le bilan du Carnet s'intercale entre le hero et ce module**, et le résumé
      IA descend replié — ticket [13](13-premier-ecran-et-trois-dates.md).
- [ ] **La pastille de la navigation** lit `compteursAFaire` — refonte 12, hors
      de cette carte.
