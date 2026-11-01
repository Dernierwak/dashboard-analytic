# 16: Ce que montre la case Instagram du bandeau

Type: grilling
Status: open
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
