# Le module « à faire cette semaine » qui se vide, et la date où on a agi

Type: task
Status: open
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
