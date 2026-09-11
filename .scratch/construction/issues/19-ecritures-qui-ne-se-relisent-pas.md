# Trente écritures qui ne relisent jamais ce qu'elles ont écrit

Type: task
Status: open

## Question

**Trouvé en réalisant [02](02-garde-de-collision-resolveaction.md)**, qui
demandait de *« chercher le même défaut sur les voisines »*. Le voisinage est
plus large que prévu, et il déborde de la collision.

`app/actions.ts` compte **30 écritures dont le résultat n'est même pas
capturé** — `await supabase.from(…).update/delete/upsert(…)` sans `const r =`.
Ces appels ne peuvent pas voir une erreur, encore moins un compte de lignes :
la fonction rend `{ ok: true }` par construction, et l'écran répond
« enregistré ». C'est le piège de `CLAUDE.md` §8 posé 30 fois.

Trois familles, par gravité décroissante.

**1 · Une collision possible, comme 02.** Un `update`/`delete` visant une ligne
existante par son `id`, qu'un autre membre « Peut agir » peut avoir déplacée ou
supprimée entre-temps :

- `deleteNote` (l. 325) — `delete … eq(id) eq(user_id) eq(kind,'note')`, erreur
  lue mais pas le compte. **Ticket [05](05-migration-deux-colonnes.md) y touche
  déjà** pour `author_id` : à traiter d'un seul geste, pas deux fois.
- `changerRoleMembre` (l. 1862) et `revoquerMembre` (l. 1878) —
  `eq(id) eq(owner_id, compte.moi)`, erreur lue, compte non lu. Un membre déjà
  révoqué par l'autre propriétaire répond « c'est fait ».

**2 · Un refus RLS invisible.** `saveObjectif` (l. 517) écrit sur `profiles` en
jetant tout le résultat : un invité dont la RLS refuse l'écriture sur le profil
du propriétaire reçoit « enregistré » sans qu'une ligne bouge. `saveObjectif`
est appelée depuis deux écrans (le rapport et `/conversions`).

**3 · Une cascade qui peut s'arrêter au milieu.** `renameLabel` (l. 860-924) et
`deleteLabel` (l. 925-973) propagent un thème sur **six tables** en enchaînant
des `await` nus (l. 891-951). Si la troisième échoue, les deux premières restent
écrites, la fonction rend `{ ok: true }`, et le compte se retrouve avec un thème
à moitié renommé — sans un mot. C'est la plus coûteuse des trois : elle produit
un état incohérent, pas seulement un silence.

### Ce qu'il faut faire

- **Ne pas tout convertir mécaniquement.** Un `upsert` écrit toujours une ligne :
  y ajouter un compte n'apprend rien. Le compte de lignes n'a de sens que sur un
  `update`/`delete` **ciblé**, là où zéro ligne veut dire quelque chose.
- Décider ce que dit l'écran dans chaque cas — la famille 1 a son patron dans
  `resolveAction` (ADR 0004 : on nomme l'état, jamais une personne) ; les
  familles 2 et 3 n'ont pas de message aujourd'hui.
- La famille 3 pose une vraie question d'architecture : six écritures qui
  doivent tenir ensemble sont une **transaction**, pas six appels PostgREST. Une
  fonction SQL `SECURITY DEFINER` la ferait d'un coup. À trancher avant de
  coder.

### Ce qui n'est PAS dans ce ticket

La garde de collision de `resolveAction` — [02](02-garde-de-collision-resolveaction.md),
faite. La suppression d'une note par son auteur —
[05](05-migration-deux-colonnes.md), qui porte `author_id`.

### Consigne de repli

Livrer la famille 1 seule, vérifiée, plutôt que d'ouvrir la cascade de thèmes à
moitié : la famille 3 change la forme du code, pas seulement sa vigilance.
