# 20: Qui a fait le changement — une personne ou Meta

Type: task
Status: resolved
Blocked by: None

## Le constat

David, le 2026-10-14 : le 18 septembre, une annonce passe « En attente de
traitement → En attente d'examen » (16:05) puis « → Actif » (16:09). Pulse
ne dit rien d'autre, et Meta non plus : ni Ads Manager ni `extra_data`
(statut et un `last_learning_exit` non documenté, qu'on n'affiche pas) ne
disent ce qui a été modifié pour relancer l'examen.

Ce qu'Ads Manager montre en plus, c'est la colonne « Modifié par » : une
personne de l'équipe à 16:05, « Meta » à 16:09. Ça distingue « quelqu'un a
touché l'annonce » de « Meta a fait sa revue ».

## Pourquoi Pulse ne l'a pas

`/activities` renvoie `actor_id` et `actor_name` (`recherche/activities.md`,
confirmés), mais la récolte ne demande que
`event_type,event_time,object_id,object_name,extra_data`.

## À trancher

- Ne garder que « une personne / Meta », pas le nom : c'est le nom d'un
  tiers, et l'écran n'en a pas besoin pour lire le changement. Comment
  reconnaître Meta (`actor_name` = « Meta » ? un `actor_id` fixe ?) reste à
  vérifier sur un vrai compte.
- Une colonne de plus dans `platform_changes`, donc le `000`.

## Vérifié sur un vrai compte — 2026-10-14

Lecture seule de `/activities` du 17 avril au 14 octobre 2026 (180 jours),
sur les deux connexions (script hors du dépôt, qui n'affichait ni nom ni ID
de personne) : 988 activités.

- Les **291 activités signées « Meta » ont toutes `actor_id` = `"0"`**, sur
  les deux connexions, donc dans les deux langues de jeton. Les autres se
  répartissent sur **4 `actor_id` de personnes, aucun égal à `"0"`**.
- Le 18 septembre : 14:05:11 UTC (16:05 à Zurich), `update_ad_run_status`
  par **une personne** ; 14:09:19 UTC (16:09), par **Meta**. C'est ce que
  montre la colonne « Modifié par » d'Ads Manager.
- Au passage : à 14:05:10, une seconde plus tôt, la même personne fait trois
  `update_ad_targets_spec` (le ciblage d'une annonce, récolté sous
  `audience`). Je n'ai pas vérifié s'ils portent sur l'annonce de David.
  Si c'est le cas, c'est probablement ce qui a relancé l'examen.
- Meta signe aussi `first_delivery_event`, `ad_account_billing_charge`,
  `create_audience` et une partie des `update_ad_run_status` (84 sur 283).

## Décisions — prises à l'implémentation, dans le sens du ticket

- **Meta se reconnaît à `actor_id` = `"0"`**, pas au nom : c'est le même dans
  les deux langues, et ça permet de **ne jamais demander `actor_name`**. Le
  nom d'un tiers ne quitte pas Meta. Ce `"0"` n'est pas documenté : c'est ce
  que Meta envoie, pas une promesse.
- Colonne `acteur` (`'personne'` | `'meta'`, NULL = pas encore récolté ou
  Google), ajoutée par le `000` : ajout seul, CHECK sur les deux valeurs.
- L'écran : « par une personne » / « par Meta », dans l'en-tête de la carte
  d'une modification et **à chaque étape** d'une chaîne de statut, où Meta et
  une personne se relaient. Une ligne d'avant n'écrit rien.

## Ce qui est construit

- Récolte (`fetchers/activities.py`) : `fields` demande `actor_id`, `_acteur`
  le traduit, et rien n'est envoyé sans ID (un None effacerait par upsert).
  L'acteur n'entre pas dans `change_id` : les lignes déjà en base se
  complètent au lieu de se doubler. `upsert_platform_changes` écrit `acteur`
  quand il est connu.
- Schéma : `acteur` dans le `000`. Aucune ligne touchée, rien de supprimé.
- Écran : `lib/meta/changements.ts` (`Acteur`, sur le changement, la carte et
  chaque étape), `lib/meta/donnees.ts` (colonne lue),
  `components/meta/journal-changements.tsx` (« par … »).
- Harnais `harnais/20/` : `verifier.py` 13/13 (récolte, requête sans
  `actor_name`) et `acteur.test.ts` 4/4 (lecture à l'écran, la chaîne du
  18 septembre). Les étapes attendues du harnais 13 portent désormais
  `acteur: null`. Les harnais 12, 18 et 19 (Python), puis 13, 18 et 19 (TS),
  restent verts : 36/36 en TS. `tsc` et `build` sont verts, avec 18 routes.

## Acceptance criteria

- [x] Comment reconnaître Meta, vérifié sur un vrai compte.
- [x] La récolte écrit `acteur` sans jamais demander ni garder le nom.
- [x] Le panneau dit « par Meta » / « par une personne », et une ligne d'avant
      ne dit rien.
- [x] **Le `000` appliqué en base AVANT la fusion sur `main`.** L'ordre est
      le `000`, puis le déploiement Vercel, puis le worker. `/meta` lit la
      colonne : sans elle, la page dit que le journal n'a pas pu être lu. Le
      worker l'envoie : sans elle, tout son lot de changements Meta est refusé.
- [ ] *(non vérifié — voir la résolution)* Après fusion sur `main` et un passage du worker lancé à la main
      (`weekly-fetch.yml` : `mode` = `mise_a_jour`, `force` coché, `user_id`
      du compte), la carte du 18 septembre sur `/meta` dit « par une
      personne » à 16:05 et « par Meta » à 16:09.

## Résolution — 2026-10-14

**Construit avant d'être tranché, puis accepté par David.** Les décisions
ci-dessus ont été prises à l'implémentation, dans le sens que le ticket
recommandait, et fusionnées par la PR #7 avant que le `000` soit coché. La
revue du chantier l'a relevé ; David confirme que le `000` est appliqué et que
`/meta` se lit en production, et accepte le choix (Meta reconnu à
`actor_id` = `"0"`, aucun nom de personne demandé).

Reste non vérifié : aucun passage du worker n'a encore tourné avec ce code,
donc la colonne `acteur` est vide en base et la carte du 18 septembre ne dit
encore ni « par une personne » ni « par Meta ». Le premier passage lancé à la
main (`weekly-fetch.yml`, `force` coché) l'écrira ; un écart vu alors rouvre
ce ticket.
