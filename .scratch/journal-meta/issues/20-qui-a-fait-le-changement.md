# 20: Qui a fait le changement — une personne ou Meta

Type: task
Status: needs-triage
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
