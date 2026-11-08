# 22: Ce que l'essai réel laisse à décider

Type: grilling
Status: resolved
Blocked by: —
Assignee: David (session Claude, 2026-11-06)

## Question

[L'essai réel des métriques](17-l-essai-reel-des-metriques.md) ouvre deux
décisions :

1. **Une annonce en `error` fait-elle un post boosté ?** `boost_ads_list` rend
   `completed`, `archived` et `error`. Une annonce en erreur n'a peut-être
   jamais tourné, et notre base Meta Ads ne permet pas de le vérifier
   (`meta_ads_insights` est indexée par nom d'annonce, `meta_ads_creatives`
   n'a pas de nom). Compter « au moins une annonce, tout statut », ou « au
   moins une annonce hors `error` » ?
2. **Remonter la courbe des abonnés sur 30 jours ?**
   [Le compte dans le temps](10-le-compte-dans-le-temps.md) dit que la courbe
   commence au premier relevé. Or l'essai montre que les gagnés
   (`follower_count`) et les gagnés / perdus (`follows_and_unfollows`) se
   lisent sur les 30 derniers jours : le total de chaque jour passé se
   calculerait depuis le total du jour (`followers_count`), en retirant les
   gagnés et en rajoutant les perdus, jour après jour. Mesuré, pas estimé —
   mais un écart de Meta entre ses propres compteurs se reporterait sur toute
   la courbe. À trancher : on remonte, ou on attend les relevés. Non essayé :
   `follows_and_unfollows` jour par jour (un appel par jour) sur 30 jours.

## Résolution (2026-11-06, David : « oui pour les deux, on remonte les abonnés »)

1. **Boosté = au moins une annonce hors `error`** dans `boost_ads_list`
   (`completed`, `archived`, active…). Une annonce en `error` seule ne marque
   pas le post : rien ne dit qu'elle a tourné.
2. **La courbe des abonnés remonte 30 jours** au premier passage d'un compte :
   le total de chaque jour passé = le total du jour (`followers_count`) moins
   les gagnés, plus les perdus de chaque jour suivant (`follows_and_unfollows`
   par `follow_type`). Au-delà de 30 jours, la courbe commence là — rien
   d'autre ne se reconstitue. À vérifier à la construction : la lecture jour
   par jour sur 30 jours (un appel par jour, non essayée) ; si un jour manque,
   la courbe s'arrête à ce jour au lieu de sauter le trou (§7).
