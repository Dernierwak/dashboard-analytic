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

## Avancement — 2026-10-14, 02:40 UTC

- **Aucun passage sur `main` depuis la fusion** (`9cf14a3`, 02:33 UTC). Le
  cron de 07:00 UTC ne traitera sans doute pas le compte aujourd'hui : ses
  passages longs tombent le samedi (2026-10-10, 17 min), les autres jours
  durent ~25 s. Il faut un **lancement à la main** par David.
- **Le code de production a déjà tourné, sur la branche.** Entre le passage
  du 2026-10-13 (`5f3299e`, `workflow_dispatch` sur `journal-meta/carte`) et
  `main`, rien n'a changé dans `saas/` ni dans `.github/`.
- **Photo « avant »** (`harnais/16/photo.py`, lecture seule, avec la clé
  secrète du `.env` local) : 1 576 lignes Meta, dont 1 266 dans les
  180 jours ; 0 sans `resume` ; 1 248 portent `niveau` et `extra_data`.
  Niveaux : 786 annonces, 412 groupes, 50 campagnes, 18 sans niveau.
  Toutes les annonces de statut (mises en pause comprises) ont un `adset_id`.
- **Deux trous, à suivre après le passage :**
  - les **18 lignes sans `niveau`** (2026-04-28 et 2026-07-01) n'ont pas
    d'`object_id`, et leur `resume` suit l'ancienne formulation
    (« l'ensemble… », doublée de « groupe d'annonces… »). Ce sont
    probablement des orphelines de l'ancien code, que Meta ne renvoie plus
    sous la même clé : un passage ne les complétera pas. Les effacer serait
    un `DELETE`, qui demande l'accord de David ;
  - **15 annonces `creatif`** (2026-04-27 et 2026-05-29) n'ont ni
    `adset_id` ni campagne : leurs parents sont absents des insights.
- **Chrome** : `/meta` en production renvoie vers `/login`, faute de session
  dans le navigateur piloté. Pas encore vérifié.
