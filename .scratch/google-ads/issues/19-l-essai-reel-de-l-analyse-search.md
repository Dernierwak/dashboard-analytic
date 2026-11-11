# 19: L'essai réel de l'Analyse Search

Type: task
Status: open
Blocked by: 18
Assignee: —

## Question

[L'Analyse Search](18-l-analyse-search.md) est tranchée sur la foi de la doc
de l'API v26 (tickets 17 et 18, aucun appel réel). **Avant la spec, qu'est-ce
qui tient sur les deux comptes réels ?** Même démarche que
[L'essai réel des métriques Google](10-l-essai-reel.md) — par l'API, v26,
fenêtre de 90 jours, jour en cours exclu.

À relever, chacun avec la requête, le nombre de lignes et ce qui revient :

1. **Catégories de termes** (`customer_search_term_insight`, puis
   `campaign_search_term_insight` sur une campagne) : libellés obtenus, termes
   par catégorie, part « autres » / fourre-tout. **La condition de David** : un
   mot récurrent (« gratuit » ou l'équivalent réel du compte) ressort-il dans
   une catégorie à lui, ou est-il noyé dans une catégorie d'intention ? Les
   `id` et libellés sont-ils les mêmes sur deux fenêtres décalées d'une
   semaine ? Filtres obligatoires, `RESOURCE_EXHAUSTED`, pagination.
2. **Conversions par action** : `segments.conversion_action` sur
   `keyword_view` et `search_term_view` avec `segments.date` ; la somme par
   action redonne-t-elle `metrics.conversions` du mot-clé ? Noms des actions
   principales lus dans `conversion_action`.
3. **Éléments RSA** : `ad_group_ad_asset_view` par jour — impressions, clics,
   coût, conversions remplis ? Volume de lignes.
4. **« Déclenché tout seul »** : sur quelques mots-clés, part des clics du
   terme au texte identique ; casse et accents des termes tels que rendus ;
   valeurs réelles de `segments.search_term_match_type`.
5. **Ce que 17 a laissé ouvert** : part perdue (budget) avec `keyword_view` ;
   statut `EXCLUDED` face aux listes partagées et à la liste du compte ;
   `quality_info.quality_score` rempli pour quelle part des mots-clés.

Résolu quand chaque point a sa réponse vérifiée ou son « non mesurable »
écrit, et que la condition des catégories est tranchée (catégories de Google
ou groupement par mot de Pulse).
