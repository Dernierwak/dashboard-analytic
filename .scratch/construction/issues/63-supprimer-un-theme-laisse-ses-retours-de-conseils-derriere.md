# Supprimer un thème laisse ses retours de conseils derrière — et un thème recréé les récupère

Type: task
Status: open

**Trouvé en faisant [45](45-renommer-un-theme-lui-fait-perdre-son-etoile.md)**,
en comparant les étapes de `deleteLabel` à celles qu'il déclare lui-même.

## Le fait, lu dans le code

`deleteLabel` (`saas/web/app/actions.ts`) supprime les lignes de
`theme_ga4_events` et `theme_objectifs` du thème effacé, et il ÉCRIT pourquoi :

> Elles sont supprimées et non orphelinées — la contrainte d'unicité porte sur
> (user_id, label, event_name), donc **un thème recréé plus tard sous le même
> nom retrouverait sinon des choix qu'il n'a jamais faits.**

`reco_feedback` a exactement la même forme — sa clé d'unicité porte le thème
(`reco_feedback_uq2`, TASK-025) — et n'est **pas** nettoyée. Un « pas pour moi »
posé sur « Soldes », le thème supprimé, puis un thème recréé sous « Soldes » :
le conseil est **muselé d'entrée** pour un refus que personne n'a donné sur ce
thème-là. C'est le même raisonnement, appliqué à une table près.

Le ticket 45 a fait la moitié voisine : la **suppression retire désormais
l'étoile** (`priority_label:`), et le **renommage** déplace bien les deux (l'étoile
et les retours). Il ne restait que ce cas-ci, que 45 n'ouvrait pas.

`suivi_actions` est dans le même cas et mérite d'être regardé en même temps :
`deleteLabel` ne le touche pas non plus, et une action décidée garde le nom d'un
thème disparu. La différence, c'est qu'une action est une **trace** de ce que le
client a fait — l'effacer perdrait de l'histoire, la garder est peut-être voulu.
À trancher, pas à supposer.

## Ce qu'il faut faire

- Décider, pour `reco_feedback` : effacer avec le thème (cohérent avec GA4 et
  l'objectif) ou garder. **C'est une suppression de données existantes : elle se
  propose** (`CLAUDE.md` §7).
- Trancher `suivi_actions` dans la foulée, en disant lequel des deux est une
  trace qu'on garde.
- Si on efface : une étape de plus dans l'`enchainer` de `deleteLabel`, **avant**
  la liste maîtresse, comme toutes les autres. Le harnais de 45
  (`.scratch/construction/harnais/45-l-etoile-du-renommage/`) a déjà la fausse
  base et ses contraintes d'unicité — le cas s'y ajoute sans rien réinstaller.

## Ce qui n'est PAS dans ce ticket

Le renommage, fait par 45. L'étoile, faite par 45. Les étoiles orphelines déjà
en base, laissées ouvertes par 45 et qui se décident avec David.
