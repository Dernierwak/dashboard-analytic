# 02: Ce que l'API Instagram donne d'un post

Type: research
Status: resolved
Blocked by: —
Assignee: Claude

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

## Answer

Recherche du 2026-11-01, documentation Meta for Developers seulement (Media
Insights v26.0, IG Media, changelogs v21-v22, webhooks), aucun appel réel.
Tableau métrique × surface et citations : branche `research/api-post`
(`d718aaf`), `git show origin/research/api-post:.scratch/instagram/research/api-post.md`.

- **Le format se lit dans `media_product_type`** (`FEED`, `REELS`, `STORY`),
  pas dans `media_type` (`IMAGE`, `VIDEO`, `CAROUSEL_ALBUM`).
- **Partout** : `reach` (estimée), `views` (« in development »), `shares`,
  `reposts`, `total_interactions`. **FEED et REELS** : `likes`, `comments`,
  `saved`. **REELS seuls** : temps de visionnage moyen et total,
  `reels_skip_rate`. **STORY seule** : `link_clicks`, `navigation`, `replies`.
- **`follows`, `profile_visits`, `profile_activity` : FEED et STORY, jamais
  REELS.** La doc ne dit pas « grâce à ce post » : l'attribution au post vient
  de ce que la métrique est rendue sur lui (déduction).
- **Boost** : les métriques organiques « report organic interaction metrics
  only » ; seuls `total_likes`, `total_comments`, `total_views` incluent le
  payant. `boost_ads_list` liste les annonces liées au post.
- **Stories** : 24 h de lecture ; les garder exige le webhook `story_insights`
  (Facebook Login) ; sous 5 spectateurs, erreur `10` / `-1`.
- **Absence** : jeu vide, jamais 0. Une métrique demandée sur une surface qui
  ne la porte pas (`follows` sur un Reel) : erreur ou vide, non documenté.
- **`views` remplace `plays` et `impressions`** (v22.0, 2025-01-21) ;
  `impressions` en erreur pour les médias créés depuis le 2024-07-02.
- **Certaines métriques manquent sous 100 abonnés** — lesquelles, non
  documenté.
- **Permissions** : en Facebook Login, la doc exige aussi
  `pages_read_engagement`, absent de nos scopes alors que la récolte lit déjà
  des insights ; seul un essai réel dira ce que notre jeton obtient.
- **Deux défauts de la récolte, vérifiés dans le code**
  (`fetchers/post_metrics.py:33`) : le test `media_type in ("VIDEO", "REEL")`
  envoie toute `VIDEO` — vidéo du fil comprise — dans la branche sans `likes`
  (`REEL` n'est pas une valeur de `media_type`) ; et `follows` absent, ou
  demandé sur un Reel, est écrit `0`. Reportés au ticket
  [Ce que la récolte et le traitement doivent calculer](14-ce-que-le-traitement-doit-calculer.md).
- Changelogs v23 à v26 non relus ; la récolte tourne en v24.0.
