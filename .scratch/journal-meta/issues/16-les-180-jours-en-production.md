# 16: Les 180 derniers jours portent leur détail en production

Type: task
Status: ready-for-agent
Blocked by: 15
Spec : [14](14-spec-le-journal-meta.md), histoires 38, 39, 41.

## What to build

Après la fusion, un passage du worker relit les 180 derniers jours
d'activités Meta et complète les lignes de `platform_changes` avec l'élément
touché et ce que Meta envoie. Sur `/meta` en production, le client voit alors
chaque changement avec son élément, son geste, et l'avant → après quand Meta
le donne.

Deux façons de déclencher le passage : le cron du Jour de travail, ou un
lancement à la main de `weekly-fetch.yml` depuis l'onglet GitHub Actions
(`mode` = `mise_a_jour`, `force` coché, `user_id` du compte). C'est David qui
le lance. Le ticket dit lequel des deux a tourné.

## Acceptance criteria

- [ ] Un passage du worker a tourné sur `main`. Le ticket note lequel
      (cron ou lancement à la main) et sa date.
- [ ] En base : les lignes Meta des 180 derniers jours portent `niveau`, et
      `extra_data` quand Meta l'envoie. Les annonces ont un `adset_id`, y
      compris les mises en pause.
- [ ] En base : les lignes plus anciennes gardent leur `resume`, et aucune
      ligne n'a perdu un détail écrit par un passage précédent.
- [ ] Le rapport hebdo se publie toujours et lit `resume` sans changement.
- [ ] Dans Chrome, sur `/meta` en production : le filtre « Groupe
      d'annonces », l'onglet « Changements » et son nombre, la mise en
      avant d'une ligne de la Comparaison (halo, points pleins), le panneau
      ouvert depuis un point, qui reste dans l'URL et ne déborde pas à
      droite.
- [ ] Ce qui n'a pas pu être vérifié est écrit tel quel dans la réponse.
