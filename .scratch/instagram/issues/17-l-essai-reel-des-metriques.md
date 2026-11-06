# 17: L'essai réel des métriques Instagram

Type: task
Status: open
Blocked by: —
Assignee: —

## Question

Les trois recherches s'arrêtent au même endroit : ce que la documentation ne
tranche pas, **seul un appel réel avec notre jeton** le tranche. Un seul
script, lancé par David (le jeton ne passe jamais par la conversation, §7),
sur un compte branché, qui répond à :

1. **Nos scopes suffisent-ils** sans `pages_read_engagement` pour
   `/{ig-user-id}/insights` et `/{ig-media-id}/insights` ? (recherches 02, 04)
2. **`follower_count`** existe-t-il encore, et sur combien de jours ? (04)
3. **`follows_and_unfollows`** ventilé par `follow_type` : comment lire
   gagnés et perdus ? (04)
4. **`follows` demandé sur un Reel** : erreur ou jeu vide ? (02)
5. **`lifetime`** est-il bien le cumul à la lecture, et un `period=day` sur un
   média est-il remplacé ? (03)
6. **`reach` du compte** en `total_value` sur 7 jours face à la somme des 7
   valeurs `time_series` : dédoublonné ou non ? (hebdo 12)
7. **`media_product_type`** distingue-t-il un Reel d'une vidéo du fil, et un
   post du fil sans abonné gagné rend-il `follows` = 0 ou rien ?
   ([Les formats et les abonnés](09-les-formats-et-les-abonnes.md))
8. **La part boostée du compte** : `reach` et `total_interactions` en
   `breakdown=media_product_type` rendent-ils une valeur `AD` ? Les valeurs
   d'interactions se somment-elles au total ? (interrupteur Tout / Organique
   / Boosté de [Le compte dans le temps](10-le-compte-dans-le-temps.md))
9. **`boost_ads_list`** sur un post : notre jeton l'obtient-il ? Que rend-il
   (identifiants, statut) ? ([Les posts boostés](19-les-posts-boostes.md))
10. **Une annonce terminée** reste-t-elle dans `boost_ads_list` ? À essayer
   sur un post boosté puis arrêté. Si non, la page écrit « boosts vus par
   Pulse seulement quand ils tournaient au moment d'un relevé ».
   ([Les posts boostés](19-les-posts-boostes.md))

Le script se prépare sur le modèle de la skill `wizard` (étapes que seul
David peut faire) ; il imprime les réponses, jamais le jeton. Le résultat
débloque [Le compte dans le temps](10-le-compte-dans-le-temps.md) et précise
[Les formats et les abonnés](09-les-formats-et-les-abonnes.md).
