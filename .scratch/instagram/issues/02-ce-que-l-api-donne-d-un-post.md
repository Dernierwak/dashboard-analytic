# 02: Ce que l'API Instagram donne d'un post

Type: research
Status: open
Blocked by: —
Assignee: —

## Question

Pour un post d'un compte professionnel Instagram, **quelles métriques
`GET /{ig-media-id}/insights` rend-elle, par type de média** (IMAGE,
CAROUSEL_ALBUM, VIDEO/REELS, STORY), avec nos permissions actuelles
(`instagram_basic`, `instagram_manage_insights`) ?

En particulier :
- `follows`, `profile_visits`, `profile_activity`, `shares`,
  `total_interactions`, `saved`, `reach`, `views` (et ce qui a remplacé
  `impressions` / `plays`) — disponibles pour quels types, définis comment ;
- ces chiffres incluent-ils la part **payante** d'un post boosté ?
- les **stories** : combien de temps restent-elles lisibles, que rendent-elles ;
- quand une métrique est indisponible, l'API rend-elle une erreur, un jeu vide
  ou 0 (la récolte écrit aujourd'hui 0 pour `follows` absent —
  `saas/data/fetch_data/sources/meta/instagram/sync.py`) ;
- le format « Reel / post / story » : `media_type` ou `media_product_type`.

Ce que la récolte demande aujourd'hui :
`saas/data/fetch_data/sources/meta/instagram/fetchers/post_metrics.py`.
Sources de premier rang seulement (documentation Meta for Developers) ; ce qui
n'est pas écrit se signale comme tel, une déduction se nomme déduction.
