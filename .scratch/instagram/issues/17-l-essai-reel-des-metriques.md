# 17: L'essai réel des métriques Instagram

Type: task
Status: resolved
Blocked by: —
Assignee: David (session Claude, 2026-11-06)

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

## Le script (2026-11-06)

`.scratch/instagram/essai/essai_reel.sh` (wizard, 5 étapes) lance
`essai_reel.py` : il trouve le `.env` (worktree ou dépôt principal), passe les
clés Supabase au script par l'environnement sans les afficher, liste les
comptes branchés, demande le `user_id` et, en option, le lien d'un post boosté
puis arrêté (point 10). Lecture seule, environ 40 appels Graph v24.0 ; il
imprime un **résumé à coller** (une ligne par point, aucun jeton) et garde les
réponses brutes dans `.essais/` (ignoré par git). Vérifié hors ligne avec une
API simulée : pagination, `boost_ads_list` refusé, aucun jeton dans la
sortie. **Pas encore lancé sur un vrai compte.**

Lancer, depuis la racine du worktree :
`.scratch/instagram/essai/essai_reel.sh`

## Résolution (2026-11-06, essai lancé par David sur un compte réel)

Compte `0b83e564-…` (Instagram `17841400933148249`), 200 posts lus, Graph
v24.0. Détail brut : `.essais/essai-instagram-20261106-2301.json` (local,
ignoré par git). Chiffres sur 7 jours arrêtés au 2026-11-05.

1. **Scopes : suffisants.** Insights du compte et des posts lus sans
   `pages_read_engagement` (accordés : `ads_management`, `business_management`,
   `instagram_basic`, `instagram_manage_insights`, `pages_show_list`).
2. **`follower_count` existe, et compte les abonnés GAGNÉS par jour**, pas le
   total : 30 valeurs (du 2026-10-07 au 2026-11-05), de 16 à 90 par jour ; une
   fenêtre de plus de 30 jours entre `since` et `until` est refusée (erreur
   100). Remonter plus loin par fenêtres successives : **pas essayé**.
3. **`follows_and_unfollows` par `follow_type`** : `FOLLOWER` = gagnés,
   `NON_FOLLOWER` = perdus — 300 et 146 sur 7 jours ; 300 = la somme exacte de
   `follower_count` sur les mêmes jours, d'où la lecture. `total_value.value`
   n'est pas rendu avec la ventilation. Meta : les perdus comptent aussi les
   comptes qui ont quitté Instagram.
4. **`follows` sur un Reel : erreur 100** (« does not support the follows
   metric for this media product type »), pas un jeu vide. La récolte, qui
   écrit 0 sur exception, doit écrire null.
5. **`lifetime` = le cumul à la lecture** ; `period=day` sur un post est
   remplacé : la réponse dit `lifetime`, même valeur.
6. **La portée du compte sur 7 jours est dédoublonnée** : `total_value` =
   65 980, la somme des 7 jours = 101 990. La portée par jour ne
   s'additionne pas ; la portée d'une période se lit en `total_value`.
7. **`media_product_type` sépare bien** : 72 Carrousels, 70 Images, 58 Reels
   (`VIDEO/REELS`) — **aucune vidéo du fil** dans les 200 derniers posts.
   Sur 15 posts du fil, `follows` rend **0** pour 4 et plus de 0 pour 11 : un
   post du fil sans abonné gagné rend un vrai 0, pas un vide.
8. **La part boostée existe** : `AD` présent dans les deux ventilations.
   - **Interactions** : la ventilation s'additionne au total (7 609, dont
     `AD` = 91) → Organique = total − `AD`, **mesurable**.
   - **Portée** : la somme de la ventilation (83 519) dépasse le total
     (65 980) — elle est dédoublonnée par produit, pas entre produits. `AD` =
     32 223 se lit, mais l'organique ne se déduit pas (confirme
     [Le compte dans le temps](10-le-compte-dans-le-temps.md)).
   - La ventilation compte aussi `STORY`, et `CAROUSEL_CONTAINER` /
     `CAROUSEL_ITEM` pour la portée.
9. **`boost_ads_list` : obtenu.** Entrée = `ad_id`, `ad_status` ; 5 posts sur
   200 ont au moins une annonce. **La même annonce revient plusieurs fois**
   (jusqu'à 6) : dédoublonner par `ad_id`. Statuts vus : `completed`,
   `archived`, `error` (une seule annonce, sur un Reel de juillet 2025) —
   minuscules.
10. **Les annonces terminées restent listées** (`completed`, `archived`) : la
    mention « boosts vus seulement quand ils tournaient » de
    [Les posts boostés](19-les-posts-boostes.md) n'a pas lieu d'être.

Deux questions nouvelles, pour David : [Ce que l'essai réel laisse à
décider](22-ce-que-l-essai-laisse-a-decider.md).
