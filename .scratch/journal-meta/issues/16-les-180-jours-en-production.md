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

- [x] Un passage du worker a tourné sur `main`. Le ticket note lequel
      (cron ou lancement à la main) et sa date.
- [ ] En base : les lignes Meta des 180 derniers jours portent `niveau`, et
      `extra_data` quand Meta l'envoie. Les annonces ont un `adset_id`, y
      compris les mises en pause.
- [x] En base : les lignes plus anciennes gardent leur `resume`, et aucune
      ligne n'a perdu un détail écrit par un passage précédent.
- [x] Le rapport hebdo se publie toujours et lit `resume` sans changement.
- [x] Dans Chrome, sur `/meta` en production : le filtre « Groupe
      d'annonces », l'onglet « Changements » et son nombre, la mise en
      avant d'une ligne de la Comparaison (halo, points pleins), le panneau
      ouvert depuis un point, qui reste dans l'URL et ne déborde pas à
      droite.
- [x] Ce qui n'a pas pu être vérifié est écrit tel quel dans la réponse.

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

## Avancement — 2026-10-14, après le passage sur `main`

- **Le passage** : lancement à la main par David, `workflow_dispatch` sur
  `main`, run `38502344781`, de 02:41 à 04:01 UTC, `success`. Deux comptes
  traités, 173 lignes Meta chacun.
- **Meta a limité les appels** : 295 avertissements « User request limit
  reached ». Tous portent sur la liste des groupes d'annonces par campagne
  (« ad sets … incomplets »), aucun sur `/activities`.
- **Photo « après », comparée à celle d'avant** (clé `(user_id,
  change_id)`) : 0 ligne disparue, 0 nouvelle, **aucun détail perdu**, aucun
  `resume` réécrit. L'état est identique à celui d'avant, ce qui est attendu
  puisque le code est le même que celui du passage du 13. Les 18 lignes sans
  `niveau` et les 15 annonces `creatif` sans `adset_id` restent telles quelles.
- **Le rapport hebdo** : les deux `weekly_reports` de la semaine du
  2026-10-12 ont été republiés pendant le passage (03:12 et 04:01 UTC). Le
  journal du run dit « rapport publié » pour les deux comptes.
- **Chrome** : toujours renvoyé vers `/login`, pas encore vérifié.

## Avancement — 2026-10-14, Chrome sur `/meta` en production

David connecté. Vérifié à l'écran sur la période 30 sept. → 6 oct. :

- **Filtre « Groupe d'annonces »** : le menu liste 5 groupes, chacun avec sa
  campagne et sa dépense de la période, avec une recherche.
- **Onglet « Changements »** sur le bord droit, avec son nombre (18) ; la
  Tendance marque le 30 sept. d'un point orange (« 18 changements · clique
  pour les voir »).
- **Panneau d'un jour** (`?jour=2026-09-30`) : 18 changements rangés
  campagne › groupe, chacun avec son geste et l'avant → après
  (« En attente de traitement → Actif »), le Ciblage en clair. Le panneau
  tient après un rechargement complet. Un jour sans changement
  (`?jour=2026-10-03`) le dit en une phrase.
- **Mise en avant dans la Comparaison** : un clic sur une courbe l'épaissit,
  estompe les autres (légende comprise) et rend plein, avec un halo, son
  point de changement du 30 sept., sur les deux graphes.
- **Panneau ouvert depuis ce point** : l'URL porte `jour` et
  `element=annonce:…`, le panneau ne montre que les 2 changements de
  l'annonce (Statut en trois étapes, Création), emboîtés
  campagne › groupe › annonce.
- **Débordement** : ni la page ni le panneau ne débordent à droite (bord du
  panneau à 1 780 px pour 1 792 px de large, aucun défilement horizontal).

Non élucidé : au tout premier essai, l'URL `?jour=2026-09-30` est revenue à
`/meta` sans panneau. Ce n'est pas reproduit : après un rechargement complet
et à chaque ouverture suivante, le panneau tient. Le plus probable est un
second clic de ma part tombé sur le voile, qui ferme le panneau ; ce n'est pas
prouvé.

## Ce qui reste ouvert

Le deuxième critère n'est pas rempli en entier. Le passage ne comble pas :

- **18 lignes sans `niveau`** (2026-04-28 et 2026-07-01), sans `object_id`,
  avec l'ancienne formulation du `resume`. Elles viennent probablement de
  l'ancien code, et Meta ne les renvoie plus sous la même clé. Elles quittent
  la fenêtre de 180 jours entre le 2026-10-25 et le 2026-12-28. Les effacer est
  un `DELETE`, que David doit valider ;
- **15 annonces `creatif`** (2026-04-27 et 2026-05-29) sans `adset_id` ni
  campagne : leurs parents sont absents des insights. Toutes les annonces de
  statut, mises en pause comprises, ont leur `adset_id`.
