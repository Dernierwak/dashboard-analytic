# 22: Ce que l'essai réel laisse à décider

Type: grilling
Status: open
Blocked by: —
Assignee: —

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
