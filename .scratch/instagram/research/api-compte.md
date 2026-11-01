# Ce que l'API Instagram donne du compte, jour par jour

Recherche du 2026-11-01 pour le ticket
[04](../issues/04-ce-que-l-api-donne-du-compte.md). Sources : documentation
Meta for Developers uniquement, aucun appel réel, aucun secret. Elle
**complète** [la recherche de l'hebdo sur la portée du compte](../../hebdo/issues/12-la-portee-organique-du-compte.md),
qu'elle ne refait pas : `reach` (non dédoublonnée sur une plage, pubs
comprises), `views` et `total_interactions` (additionnables), `accounts_engaged`
(non additionnable) y sont déjà établis.

Ce qui est une **déduction** et non une phrase de la doc est marqué comme tel.
Ce que la doc n'écrit pas est dit « non documenté ».

## Réponse courte

- **Un seul point d'accès** : `GET /{ig-user-id}/insights`. Toutes les
  métriques de compte encore listées ont `period=day`.
- **Seule `reach` accepte `metric_type=time_series`** (une valeur par jour en
  un appel). Toutes les autres n'acceptent que `total_value` : la doc définit
  la valeur rendue comme « sum of requested metric values » sur la plage
  `since`/`until`. *Déduction* : pour une série jour par jour, il faut un
  appel par jour (plage d'un jour), ou plusieurs métriques par appel et un
  appel par jour.
- **S'additionnent jour par jour** (comptages d'événements) : `views`,
  `total_interactions`, `likes`, `comments`, `saves`, `shares`, `replies`,
  `reposts`, `profile_links_taps`, et les deux moitiés de
  `follows_and_unfollows`. **Ne s'additionnent pas** (comptes uniques) :
  `reach`, `accounts_engaged`.
- **Abonnés gagnés et perdus** : `follows_and_unfollows` (« accounts that
  followed you and … accounts that unfollowed you or left Instagram »), seule
  breakdown `follow_type` (FOLLOWER / NON_FOLLOWER / UNKNOWN). **La doc ne dit
  pas comment la valeur se sépare en gagnés et perdus** — la breakdown est
  définie comme « followers or non-followers », pas comme « follow /
  unfollow ». Non rendue sous **100 abonnés**. À lever par un essai réel avant
  toute promesse.
- **`follower_count` n'est plus dans le tableau des métriques** de la page de
  référence : seule la section Limitations le nomme encore (« not available
  … fewer than 100 followers »). Le changelog (2020-11-10) l'avait limité à
  **30 jours** d'historique. Statut actuel : ambigu, non documenté — essai réel
  obligatoire.
- **`profile_views` et `website_clicks` sont morts** : retirés le
  2024-10-02 (v21.0), pour toutes les versions le 2025-01-08. Le seul reste
  « profil » est `profile_links_taps` (adresse, appel, e-mail, texto — **pas**
  le lien du site).
- **`impressions` est mort** côté compte (v22.0, toutes versions le
  2025-04-21). `views` le remplace, marquée « in development ».
- **Historique relisible** : « User Metrics data is stored for up to 90
  days » (page générale des Insights, non répété sur la référence) ;
  `follower_count` 30 jours (changelog 2020) ; `online_followers` 30 jours.
  Plage `since`/`until` maximale : **non documentée**. Défaut sans plage :
  24 h. Données en retard jusqu'à **48 h**.
- **Seuil de 100 abonnés** : écrit pour `follower_count`, `online_followers`,
  `follows_and_unfollows`, `follower_demographics` ;
  `engaged_audience_demographics` exige 100 engagements. Pour les autres :
  non documenté (la page générale dit seulement « some metrics »).
- **Une absence rend un jeu vide, pas 0** (écrit) : §7 s'applique tel quel.
- **Scopes** : en Facebook Login, la référence exige `instagram_basic` +
  `instagram_manage_insights` + **`pages_read_engagement`**, et la page des
  permissions liste `pages_read_engagement` comme **dépendance** de
  `instagram_manage_insights`. Nous ne le demandons pas. La doc ne distingue
  aucune métrique : **toutes** les métriques de compte relèvent du même
  jeu de permissions — aucune n'en exige un de plus qu'une autre. Même la
  lecture de `followers_count` sur le nœud IG User demande, selon la doc,
  `instagram_basic` + `pages_read_engagement`, et la récolte la fait
  aujourd'hui sans ce scope. *Déduction* : l'exigence écrite n'est pas
  appliquée à la lettre pour ces lectures-là ; rien ne dit qu'elle ne le sera
  pas pour `/insights` du compte. Un essai réel tranche ; si Meta refuse,
  ajouter `pages_read_engagement` oblige tous les comptes à re-consentir et
  passe par la revue Meta (`saas/web/app/api/oauth/meta/start/route.ts`).
- **La récolte aujourd'hui** : lit `followers_count` et `media_count`
  (`fetchers/account.py`) et **n'écrit rien** — le résultat est jeté
  (`sync.py`, « Lu et jamais écrit »). Elle n'appelle **aucune** métrique
  `/insights` du compte.
- **`followers_history` n'est plus remplie par le dépôt** : son seul
  écrivain, l'Edge Function `supabase/functions/fetch-followers`
  (un `insert` par jour de `followers_count`, sans date de mesure Meta), a
  quitté l'arbre le 2026-09-06 (`7f188f3`). La page `/instagram` la lit
  encore (`lib/channels.ts`, 90 lignes). Si la fonction tourne encore côté
  Supabase : non vérifiable d'ici.

## Métrique par métrique

Source de chaque ligne : la référence IG User Insights, sauf mention.
« FB Login » = nos scopes actuels (`instagram_basic`,
`instagram_manage_insights`, sans `pages_read_engagement`).

### `follower_count`

| Point | Ce que dit la doc |
|---|---|
| Période | Absente du tableau actuel. Ancienne référence (citée par la recherche, page aujourd'hui en 404) : `day`, « Total number of new followers each day within the specified range » |
| `metric_type` | Non documenté (absente du tableau) |
| Historique | 30 jours (changelog 2020-11-10, v9.0+, toutes versions le 2021-05-09) |
| Seuil | Indisponible sous 100 abonnés (Limitations, toujours écrit) |
| Permissions | Celles de la page : `pages_read_engagement` exigé en FB Login |
| Additionnable | Si c'est bien « nouveaux abonnés par jour » : oui. Non garanti |
| Remarque | Ne rend **pas** de perdus. Statut actuel ambigu : essai réel |

### `follows_and_unfollows`

| Point | Ce que dit la doc |
|---|---|
| Période | `day` |
| `metric_type` | `total_value` seulement |
| Breakdown | `follow_type` (FOLLOWER, NON_FOLLOWER, UNKNOWN), valeurs non définies |
| Historique | Non documenté pour la métrique ; 90 jours pour les « User Metrics » (page générale) |
| Seuil | « Not returned if the IG User has less than 100 followers » |
| Permissions | Jeu commun, `pages_read_engagement` exigé en FB Login |
| Additionnable | Oui, comptages d'actions (déduction) |
| Remarque | La séparation gagnés / perdus n'est **pas** écrite. Inclut les départs d'Instagram |

### `profile_views`

| Point | Ce que dit la doc |
|---|---|
| Statut | **Retirée** : changelog v21.0 (2024-10-02), toutes versions le 2025-01-08. La page générale des Insights la montre encore dans un exemple de 2018 : exemple périmé |

### `website_clicks` (et `email_contacts`, `get_direction_clicks`, `phone_call_clicks`, `text_message_clicks`)

| Point | Ce que dit la doc |
|---|---|
| Statut | **Retirées** avec `profile_views` (même entrée v21.0). Aucun remplaçant documenté pour le lien du site |

### `profile_links_taps`

| Point | Ce que dit la doc |
|---|---|
| Période | `day` |
| `metric_type` | `total_value` |
| Breakdown | `contact_button_type` (BOOK_NOW, CALL, DIRECTION, EMAIL, INSTANT_EXPERIENCE, TEXT, UNDEFINED) |
| Définition | « taps on your business address, call button, email button and text button » |
| Historique / seuil | Non documentés pour la métrique |
| Additionnable | Oui (comptage de taps, déduction) |

### `views`

| Point | Ce que dit la doc |
|---|---|
| Période | `day` |
| `metric_type` | `total_value` |
| Breakdown | `follower_type` dans le tableau (sans doute `follow_type`, coquille de la doc), `media_product_type` |
| Définition | « times your content was played or displayed », reels, posts, stories |
| Statut | « This metric is in development » ; ajoutée le 2025-01-21 |
| Additionnable | Oui (déjà établi, hebdo 12) |

### `total_interactions`

| Point | Ce que dit la doc |
|---|---|
| Période | `day` |
| `metric_type` | `total_value` |
| Breakdown | `media_product_type` |
| Définition | Interactions post, story, reel, vidéo, live, « including any interactions on boosted content » |
| Additionnable | Oui, mais **contenus boostés compris** : pas purement organique |

### `accounts_engaged`

| Point | Ce que dit la doc |
|---|---|
| Période | `day` |
| `metric_type` | `total_value` |
| Breakdown | Aucune |
| Définition | Comptes ayant interagi, « including in ads » ; « estimated » |
| Additionnable | **Non** (comptes uniques) |

### `reach`

| Point | Ce que dit la doc |
|---|---|
| Période | `day` |
| `metric_type` | `total_value` **et** `time_series` (la seule encore vivante) |
| Breakdown | `media_product_type`, `follow_type` (en `total_value` seulement) |
| Définition | Comptes uniques, « including in ads » ; « estimated » |
| Additionnable | **Non**. Voir hebdo 12 pour la plage |
| Remarque | *Déduction* : la breakdown `media_product_type` contient `AD` — elle permettrait peut-être d'isoler la part non publicitaire d'un jour. Non documenté comme tel |

### Comptages d'interactions détaillés

| Métrique | Période | `metric_type` | Breakdown | Remarque |
|---|---|---|---|---|
| `likes` | `day` | `total_value` | `media_product_type` | — |
| `comments` | `day` | `total_value` | `media_product_type` | « in development » |
| `saves` | `day` | `total_value` | `media_product_type` | — |
| `shares` | `day` | `total_value` | `media_product_type` | — |
| `replies` | `day` | `total_value` | — | Réponses aux stories |
| `reposts` | `day` | `total_value` | — | Ajoutée le 2025-12-03 (changelog) |

Tous additionnables jour par jour (comptages, déduction). Seuil et historique
propres : non documentés.

### Audience

| Métrique | Période | Paramètres | Seuil / historique |
|---|---|---|---|
| `follower_demographics` | `lifetime` | `timeframe` obligatoire, breakdown age / city / country / gender | 100 abonnés ; 45 premières valeurs |
| `engaged_audience_demographics` | `lifetime` | idem | 100 engagements |
| `online_followers` | Absente du tableau | — | 100 abonnés ; 30 derniers jours (Limitations) |

`timeframe` : `this_week` (7 jours) et `this_month` (30 jours) ; la doc écrit
que `last_14_days`, `last_30_days`, `last_90_days` et `prev_month` ne sont
plus pris en charge depuis v20.0, mais son propre exemple utilise encore
`last_90_days` — contradiction de la doc. Ce sont des **instantanés**, pas
des séries : pas d'historique relisible.

### Ce qui sort de la question mais compte

- **`impressions`** (compte) : retirée, v22.0, toutes versions le 2025-04-21.
- **Fuseau des jours** : non documenté. Les réponses sont en UTC ISO-8601
  (page générale) ; les exemples tombent à 07:00 / 08:00 UTC, ce qui suggère
  une journée à l'heure du Pacifique (déduction, déjà notée par hebdo 12).
- **Combiner les métriques** : demander une breakdown qu'une métrique ne
  prend pas fait échouer tout l'appel (« An unknown error has occurred »).

## Ce que la récolte lit et écrit aujourd'hui du compte

| Où | Quoi |
|---|---|
| `saas/data/fetch_data/sources/meta/instagram/fetchers/account.py` | `GET /{ig-user}?fields=followers_count,media_count` : une ligne, non datée, un instantané |
| `saas/data/fetch_data/sources/meta/instagram/sync.py:184-187` | L'appelle et **jette le résultat** (« Lu et jamais écrit … l'essai (ticket 08) en a besoin ») |
| `/{ig-user-id}/insights` | **Jamais appelé** par la récolte |
| `followers_history` | Table posée à la main (`000_run_me_all.sql` la suppose, ne la crée pas). Son écrivain, `supabase/functions/fetch-followers/index.ts`, insérait `{user_id, followers, fetched_at=now()}` et écrivait `0` si Meta ne rendait rien (`?? 0`, contraire à §7) ; supprimé du dépôt le 2026-09-06 (`7f188f3`) |
| Lecteurs de `followers_history` | `saas/web/lib/channels.ts:923` (90 dernières lignes : total, delta, `growth30`, série 30 points, page `/instagram`) ; `saas/data/supabase/_queries.py:9` (`fetch_daily_followers`, sans appelant trouvé) |
| Scopes OAuth | `ads_management`, `pages_show_list`, `instagram_basic`, `instagram_manage_insights`, `business_management` (`saas/web/app/api/oauth/meta/start/route.ts`) |

Conséquence : la page affiche des abonnés tirés d'une table que plus rien,
dans le dépôt, n'alimente. Sauf fonction encore déployée hors dépôt, le
chiffre est figé depuis septembre. Pour le chantier, `followers_count`
relu à chaque passage (instantané) est la seule source de l'**effectif**
qui ne dépende d'aucune métrique `/insights` ; `follows_and_unfollows` ou
`follower_count` seraient la source des **mouvements**, sous réserve de
l'essai réel.

## Essai réel à faire avant toute promesse

Un compte de plus de 100 abonnés, nos scopes actuels, un jour passé :
`metric=follows_and_unfollows&period=day&metric_type=total_value&breakdown=follow_type`,
puis `metric=follower_count&period=day`, puis
`metric=views,total_interactions,profile_links_taps&period=day&metric_type=total_value`
sur une plage d'un jour. Il dit en une fois : si le scope suffit, si
`follower_count` vit encore, et comment `follow_type` sépare gagnés et perdus.

## Sources

- https://developers.facebook.com/docs/instagram-platform/api-reference/instagram-user/insights
- https://developers.facebook.com/docs/instagram-platform/insights/
- https://developers.facebook.com/docs/instagram-platform/changelog
- https://developers.facebook.com/docs/graph-api/changelog/version21.0/
- https://developers.facebook.com/docs/graph-api/changelog/version22.0/
- https://developers.facebook.com/docs/graph-api/changelog/version18.0
- https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user
- https://developers.facebook.com/docs/permissions
