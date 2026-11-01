# Ce que l'API Instagram donne d'un post

Recherche du 2026-11-01 pour le ticket
[02](../issues/02-ce-que-l-api-donne-d-un-post.md). Sources : documentation
Meta for Developers uniquement (référence Media Insights, référence IG Media,
page Insights, changelogs v21 et v22, référence des webhooks). Aucun appel
réel, aucun secret. La référence affiche « latest version v26.0 » ; la récolte
appelle `graph.facebook.com/v24.0` (`saas/data/fetch_data/sources/meta/graph_client.py`).
Ce que la doc n'écrit pas est marqué **non documenté** ; ce que j'en tire est
marqué **déduction**.

## Réponse courte

- **La doc ne raisonne pas en `media_type`, mais en `media_product_type`.**
  Le tableau des métriques est indexé par FEED, REELS et STORY ; IMAGE, VIDEO
  et CAROUSEL_ALBUM n'y figurent pas. `media_type` ne vaut que `CAROUSEL_ALBUM`,
  `IMAGE` ou `VIDEO` ; `media_product_type` vaut `AD`, `FEED`, `STORY` ou
  `REELS` (champ réservé à l'API avec Facebook Login, la nôtre). **Le format
  « Reel / post / story » se lit donc dans `media_product_type`**, et le
  format visuel (image, carrousel, vidéo du fil) dans `media_type`.
- **Communes aux trois surfaces** : `reach` (estimée), `views` (« in
  development »), `shares`, `reposts`, `total_interactions` (« in
  development »).
- **FEED et REELS seulement** : `likes`, `comments`, `saved`.
- **FEED et STORY seulement — pas les Reels** : `follows`, `profile_visits`,
  `profile_activity` (ventilable par `action_type` : clic sur le lien de la
  bio, appel, itinéraire, e-mail, SMS, autre). **Un Reel n'a pas d'abonnés
  attribués dans la doc.**
- **REELS seulement** : `ig_reels_avg_watch_time`,
  `ig_reels_video_view_total_time` (« in development »), `reels_skip_rate`
  (estimée, « in development »).
- **STORY seulement** : `link_clicks`, `navigation` (ventilable :
  avancer, revenir, quitter, story suivante), `replies` (vaut **0** pour les
  stories créées en Europe et au Japon, et exclut les réponses venues de ces
  régions — c'est le cas de nos clients).
- **Définitions** (citées) : `follows` = « The number of Instagram users
  following your app user's Instagram professional account » ;
  `profile_visits` = « The number of times your profile was visited » ;
  `views` = « Total number of times IG Media has been played on Instagram » ;
  `reach` = « Number of unique Instagram users that have seen the reel at
  least once » ; `total_interactions` = likes + enregistrements + commentaires
  + partages, moins les retraits. La définition de `follows` ne dit pas
  explicitement « à cause de ce post » : l'attribution au post se lit dans le
  fait que la métrique vit sur `/{ig-media-id}/insights` (**déduction**).
- **Ce qui a remplacé `impressions` et `plays`** : `views`, ajoutée en v22.0
  (21 janvier 2025). `plays`, `clips_replays_count`,
  `ig_reels_aggregated_all_plays_count` et `impressions` sont dépréciées en
  v22.0+, pour toutes les versions au 21 avril 2025. `impressions` renvoie une
  **erreur** pour les médias créés à partir du 2 juillet 2024. `video_views`
  n'est plus supportée depuis v21.0 (toutes versions au 8 janvier 2025).
- **Part payante d'un post boosté : exclue.** Les métriques organiques
  « report organic interaction metrics only; interactions on ads containing a
  media object are not counted ». Seules `total_likes`, `total_comments` et
  `total_views` (Facebook Login seulement) agrègent la part promue, et
  `total_views` ajoute les vues Facebook. Pour `reach`, `saved`, `follows`,
  `profile_visits` : la phrase générale les range dans l'organique ; la doc ne
  le redit pas métrique par métrique (**déduction** à partir de la phrase
  générale). Savoir si un post est boosté : champ `boost_ads_list` sur le
  média (annonces `ACTIVE` liées au média organique).
- **Stories : 24 heures.** « Story media metrics are only available for 24
  hours. » Pour les garder, il faut le webhook `story_insights` (Facebook
  Login seulement), qui envoie à l'expiration `impressions`, `reach`,
  `taps_forward`, `taps_back`, `exits`, `replies`. Sous 5 spectateurs,
  l'API rend l'erreur **code 10** « Not enough viewers for the media to show
  insights », le webhook rend **-1**.
- **Absence : un jeu vide, jamais 0.** « The API returns an empty data set
  instead of `0` for individual metrics. » La récolte qui écrit 0 quand
  `follows` manque transforme donc une absence en zéro (§7). Une métrique
  demandée sur une surface qui ne la porte pas (ex. `follows` sur un Reel) :
  **non documenté** — erreur ou vide, la doc ne le dit pas ; seule
  `crossposted_views` est décrite comme levant une erreur quand le Reel n'est
  pas partagé sur Facebook.
- **Délai et conservation** : données en retard jusqu'à **48 h**, conservées
  jusqu'à **2 ans**. Certaines métriques manquent aux comptes de moins de
  **100 abonnés** (lesquelles : non documenté).
- **Carrousels** : « Insights data is not available for any media within an
  album » — les médias enfants n'ont pas d'insights ; l'album lui-même est un
  FEED et suit la colonne FEED (**déduction** : la phrase vise les enfants).
- **Permissions** : en Facebook Login, la doc demande `instagram_basic`,
  `instagram_manage_insights` **et `pages_read_engagement`** (plus `ads_read`
  et `ads_management` si l'utilisateur a un rôle Business Manager sur la
  Page). Nos scopes (`saas/web/app/api/oauth/meta/start/route.ts`) n'ont pas
  `pages_read_engagement`. La récolte lit pourtant déjà des insights de posts :
  l'écart entre la doc et la pratique ne se tranche que par un essai réel —
  toute métrique nouvelle s'essaie avant d'être promise.

## Métrique × surface

Source : tableau de la référence Media Insights. « oui » = la surface figure
dans la colonne de la métrique. Colonne « récolté » : ce que
`fetchers/post_metrics.py` demande aujourd'hui.

| Métrique | FEED (image, carrousel, vidéo du fil) | REELS | STORY | Remarque doc | Récolté |
|---|---|---|---|---|---|
| `reach` | oui | oui | oui | estimée | oui |
| `views` | oui | oui | oui | in development ; remplace `plays`/`impressions` | oui |
| `shares` | oui | oui | oui | | non |
| `reposts` | oui | oui | oui | | non |
| `total_interactions` | oui | oui | oui | in development | non |
| `likes` | oui | oui | — | | FEED seulement |
| `comments` | oui | oui | — | | oui |
| `saved` | oui | oui | — | | oui |
| `follows` | oui | **—** | oui | | oui, appel à part, 0 si absent |
| `profile_visits` | oui | — | oui | | non |
| `profile_activity` | oui | — | oui | ventilation `action_type` | non |
| `ig_reels_avg_watch_time` | — | oui | — | | non |
| `ig_reels_video_view_total_time` | — | oui | — | in development | non |
| `reels_skip_rate` | — | oui | — | estimée, in development | non |
| `link_clicks` | — | — | oui | | non |
| `navigation` | — | — | oui | ventilation `story_navigation_action_type` | non |
| `replies` | — | — | oui | 0 en Europe et au Japon | non |
| `facebook_views` | oui | oui | oui | erreur si non partagé sur Facebook | non |
| `crossposted_views` | — | oui | — | erreur si non partagé sur Facebook | non |
| `total_likes` / `total_comments` | oui | oui | — | Facebook Login ; **inclut le payant** | non |
| `total_views` | oui | oui | oui | Facebook Login ; **inclut le payant et Facebook** | non |
| `impressions` | oui | — | oui | dépréciée, erreur pour un média ≥ 2024-07-02 | non |

Périodes listées par la page : `day`, `week`, `days_28`, `month`, `lifetime`,
`total_over_range` ; les exemples de réponse sont tous en `lifetime`. Quelle
période vaut pour quelle métrique de média : non documenté.

## Ce que ça dit du code actuel

- `metriques_du_post` choisit sa liste sur `media_type in ("VIDEO", "REEL")`.
  `REEL` n'est pas une valeur de `media_type` (la doc n'en donne que trois) :
  la branche ne se déclenche que sur `VIDEO`, qui couvre aussi bien un Reel
  qu'une vidéo du fil. Une vidéo du fil (`media_product_type=FEED`) perd donc
  `likes`, que la doc lui accorde (**déduction** de la lecture du code et du
  tableau). Le bon aiguillage est `media_product_type`.
- `follows` est demandé sur tous les posts, Reels compris, où la doc ne le
  porte pas ; la réponse (erreur ou vide, non documenté) finit en `0` par le
  `except` ou le `else`. Sur un Reel, ce 0 est une absence ; sur une image,
  un jeu vide est aussi une absence. Dans les deux cas la doc contredit le 0.
- `val or 0` et `values[0].value, 0` font de même pour les autres métriques.

## Limites

- Les remarques « in development » et « estimated » ne sont pas définies par
  la page : une métrique en développement peut changer de définition sans
  nouvelle version (**déduction**).
- Le comportement d'une métrique non supportée par la surface demandée n'est
  pas documenté. Une seule requête qui en mélange plusieurs peut-elle échouer
  en bloc ? Non documenté — à essayer en vrai, métrique par métrique, avant de
  bâtir dessus.
- La liste des métriques retirées aux comptes de moins de 100 abonnés n'est
  pas donnée.
- `media_product_type = AD` désigne un média publié comme annonce ; rien ne
  dit qu'un post organique boosté change de valeur (**déduction** : le boost
  se lit dans `boost_ads_list`, pas dans la surface).
- La page de référence est sans date de mise à jour ; elle reflète v26.0, la
  récolte tourne en v24.0. Aucun écart entre ces versions n'est signalé pour
  ces métriques dans les changelogs relus (v21, v22), mais v23 à v26 n'ont pas
  été relus.
- Les permissions écrites (avec `pages_read_engagement`) ne correspondent pas
  à nos scopes ; seul un essai réel dit ce que notre jeton obtient.

## Sources

- Référence Media Insights : https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights
- Référence IG Media (`media_type`, `media_product_type`, `boost_ads_list`, `children`) : https://developers.facebook.com/docs/instagram-platform/reference/instagram-media
- Insights, vue d'ensemble (jeu vide, moins de 100 abonnés, métriques `total_*`, webhook) : https://developers.facebook.com/docs/instagram-platform/insights
- Changelog Graph API v22.0 (`views`, dépréciations `plays`, `impressions`…) : https://developers.facebook.com/docs/graph-api/changelog/version22.0/
- Changelog Graph API v21.0 (fin de `video_views`) : https://developers.facebook.com/docs/graph-api/changelog/version21.0/
- Billet Meta du 2025-01-21 (calendrier des dépréciations maintenu) : https://developers.facebook.com/blog/post/2025/01/21/making-it-easier-to-build-integrations-across-the-instagram-api-and-marketing-api/
- Référence des webhooks Instagram (`story_insights`) : https://developers.facebook.com/docs/graph-api/webhooks/reference/instagram
