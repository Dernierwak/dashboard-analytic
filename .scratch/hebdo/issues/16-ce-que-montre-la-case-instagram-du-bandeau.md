# 16: Ce que montre la case Instagram du bandeau

Type: grilling
Status: resolved
Blocked by: —

## Question

Le bandeau des totaux devait montrer la portée organique par plateforme
(ticket 01). [La portée organique du compte](12-la-portee-organique-du-compte.md)
établit que l'API ne donne aucune portée de semaine garantie dédoublonnée, et
que `reach` compte aussi les pubs. Que devient la case ?

- elle **sort** du bandeau ;
- elle montre les **vues** de la semaine (`views`, somme de 7 jours, à
  récolter — métrique « in development ») ou les **interactions**
  (`total_interactions`, boosts compris) ;
- elle montre autre chose, que David nomme.

Toute métrique de compte nouvelle demande d'essayer les permissions en vrai
(`pages_read_engagement` manque à nos scopes) avant d'entrer dans la spec.

## Answer

Grilling du 2026-11-01. **La case sort du bandeau.**

- **Le bandeau passe à deux colonnes** : dépense et impressions, chacune
  avec son grand chiffre puis la valeur de chaque canal en petit. La colonne
  « portée organique » disparaît entièrement, Facebook et TikTok compris : il
  n'y a pas de case vide en « — ».
- **Le payload perd `totaux.portee`**
  ([Ce que le traitement doit calculer](14-ce-que-le-traitement-doit-calculer.md), §4).
  Rien de nouveau à récolter, aucun essai de `pages_read_engagement`.
- **Instagram reste sur la page par l'onglet Organique** de la frise (les
  posts, sans chiffre). Son chiffre revient **par sa carte dans le module des
  canaux**, avec sa semaine type, quand la page Instagram sera finie
  (Out of scope de la carte).
- **Pourquoi pas les vues ni les interactions** : `views` est marquée « in
  development » chez Meta, compte probablement les contenus boostés et peut
  arriver jusqu'à 48 h en retard ; `total_interactions` compte les boosts à
  coup sûr. Sous un titre « organique », les deux mentiraient. Elles ne sont
  pas rejetées pour toujours : elles se rejugeront quand la carte Instagram
  du module se dessinera, dans un autre chantier.
- **Le coût accepté** : tant que la page Instagram n'existe pas, l'hebdo ne
  montre aucun chiffre organique.
- Aucun mot nouveau pour le vocabulaire, pas d'ADR (la décision se renverse
  facilement).
