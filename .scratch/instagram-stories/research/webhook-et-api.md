# Le webhook `story_insights` et l'API des stories, à jour

Recherche du 2026-11-25 pour le ticket
[01](../issues/01-le-webhook-et-l-api-des-stories.md). Elle complète, sans la
refaire, la recherche du 2026-11-01
(`git show origin/research/api-post:.scratch/instagram/research/api-post.md`).

Sources : documentation Meta for Developers et changelogs uniquement. Aucun
appel à l'API, aucun secret. Les pages lues affichent la version **v27.0** ;
la récolte appelle v24.0. Aucun changelog relu ne signale d'écart entre ces
versions pour les points ci-dessous. Meta a déplacé une partie de la doc
Instagram de `/docs/instagram-platform/…` vers
`/documentation/instagram-platform/…` : les deux arborescences coexistent, et
parfois se contredisent (voir Q2).

Ce que la doc n'écrit pas est marqué **non documenté** ; ce que j'en tire est
marqué **déduction**.

## Réponse courte

1. **Contenu du webhook** : la référence liste toujours `media_id`,
   `impressions`, `reach`, `taps_forward`, `taps_back`, `exits`, `replies`.
   **Ni `views` ni `navigation` n'y sont entrés.** Aucun changelog ne touche au
   contenu de `story_insights` depuis 2019. Pourtant `impressions` est dépréciée
   (v22, erreur pour un média ≥ 2024-07-02) et `taps_forward`, `taps_back`,
   `exits` ont été retirées de l'API des insights le 2023-09-12 (v18, toutes
   versions au 2023-12-11). Ce que le webhook envoie vraiment pour ces quatre
   champs aujourd'hui (valeur, absence, `-1`) est **non documenté** : seule une
   vraie livraison le dira. Aucun exemple de message `story_insights` n'est
   publié (la page d'exemples affiche par erreur un `messaging_postbacks`).
2. **Pour le recevoir** : app **publiée / Live** (« must be published or Live
   to receive notifications for app users ») ; en mode Développement, seules
   les notifications de test du tableau de bord et celles déclenchées par une
   personne ayant un rôle sur l'app arrivent. Champ `story_insights` coché dans
   le tableau de bord (Webhooks de la configuration Instagram), puis
   **`POST /{page-id}/subscribed_apps`** avec un **jeton de Page** de la Page
   liée — pas sur le compte Instagram. Permissions exigées pour ce champ en
   Facebook Login : `instagram_basic`, `instagram_manage_insights`,
   **`pages_manage_metadata`**, **`pages_read_engagement`**, `pages_show_list`.
   **Nos scopes n'ont ni `pages_manage_metadata` ni `pages_read_engagement`.**
   « Webhooks does not require App Review », mais respecte les permissions ;
   et servir des comptes que l'on ne possède pas demande l'**Advanced Access**,
   donc l'**App Review** et la **vérification d'entreprise**. **Déduction** :
   pour les clients de Pulse, la revue Meta est nécessaire.
3. **Livraison** : à l'expiration de la story (« Notifies you when a story
   expires ») ; délai précis **non documenté**. En cas d'échec : nouvel essai
   immédiat, puis « a few more times » à fréquence décroissante sur
   **36 heures**, abandon au-delà ; **nombre d'essais non documenté**.
   Répondre `200 OK` en HTTPS ; aucun délai de réponse n'est donné pour
   Instagram (Messenger exige ≤ 5 s — autre produit). Enveloppe :
   `object: "instagram"`, `entry[]` (un `id` = le compte Instagram
   professionnel, `time`), `changes[]` (`field`, `value`). Lots jusqu'à
   **1 000 mises à jour**, non garantis ; plusieurs changements d'objets du
   même type peuvent être groupés. Doublons possibles : dédoublonner.
   Métriques sous 5 → `-1`. Seules les **24 premières heures** de métriques
   sont envoyées, même si la story passe en « à la une ».
4. **`/{ig-user-id}/stories`** : rend par défaut le seul `id` ; les champs
   (`media_type`, `media_product_type`, `media_url`, `thumbnail_url` — vidéo
   seulement —, `permalink`, `timestamp`, `caption`…) sont ceux de l'objet IG
   Media. `media_url` peut manquer (vidéo à son sous droits) : la doc dit de
   le traiter comme optionnel. **Durée de vie de `media_url` : non
   documentée.** Stories Live et repartages exclus ; « Stories are only
   available for 24 hours ». Pagination : celle du Graph (curseurs, `next`
   absent = dernière page, une page vide peut avoir un `next`). Limite :
   « Calls within 24 hours = 4800 * Number of Impressions » par compte
   (BUC) ; **déduction** : 24 appels par jour et par compte sont très en deçà.
   Permissions de la référence : `instagram_basic` + `pages_read_engagement`.
5. **Signature** : en-tête `X-Hub-Signature-256`, valeur préfixée `sha256=`,
   SHA256 calculé avec le **App Secret** de l'app sur « the payload ». La doc
   Instagram ne dit pas « corps brut » ; la doc Messenger précise que la
   signature est calculée sur une version **à unicode échappé, hexadécimal en
   minuscules** du message. **Déduction** : signer le corps brut reçu, sans le
   reparser ; un essai réel tranchera le cas des caractères non ASCII.

## 1 · Le contenu du message

Référence des webhooks Instagram, champ `story_insights` :

> « Notifies you when a story expires. »
> « Metrics with counts of less than 5 will be returned as `-1`. »

`value` porte `media_id` et des entiers `impressions`, `reach`,
`taps_forward`, `taps_back`, `exits`, `replies`. La page ne dit pas quel
mode de connexion ; la page Insights le dit : « Only available for Instagram
API with Facebook Login », et la référence Media Insights : « Insights
webhook for Instagram API with Instagram Login is not supported. »

Ce qui a bougé côté API, sans que la référence du webhook change :

- Changelog Instagram, 2023-09-12, « Deprecation of Media and User
  Insights », « Applies to v18.0+. Will apply to all versions on December
  11, 2023 » : `GET /{ig-media-id}/insights` perd `TAPS_FORWARD`, `TAPS_BACK`,
  `EXITS`, `ENGAGEMENT`. L'entrée ne mentionne pas les webhooks.
- Changelog, 2025-01-21 / Graph v22.0 : `views` introduite ;
  « `impressions` on media and user insights », « Applies to v22.0+. Will
  apply to all versions April 21, 2025 » ; « API requests made after April
  21, 2025 for media created on or after July 2, 2024 will return an error. »
- La référence Media Insights décrit à leur place `navigation` : « This is
  the total number of actions taken from your story. These are made up of
  metrics like exited, forward, back and next story », ventilée par
  `story_navigation_action_type` : `SWIPE_FORWARD` (story suivante),
  `TAP_BACK`, `TAP_EXIT`, `TAP_FORWARD`. `taps_forward`, `taps_back`, `exits`
  n'y figurent plus comme métriques.
- Seule entrée du changelog qui touche `story_insights` : 2019-05-09, « The
  `story_insights` field now requires the `instagram_manage_insights`
  permission instead of `instagram_manage_comments`. »

**Non documenté** : si le webhook rend encore `impressions` (média ≥
2024-07-02) et les trois taps, ou s'il les omet, les met à `-1`, ou les a
remplacés. **Déduction** : la référence du webhook n'a pas suivi les
dépréciations de l'API ; le contenu réel doit se lire sur une vraie
livraison, et le schéma de Pulse doit accepter un champ absent (absence ≠ 0,
§7). Si les taps arrivent, ils correspondent par leur nom à
`TAP_FORWARD`/`TAP_BACK`/`TAP_EXIT` de `navigation`, mais **sans
`SWIPE_FORWARD`** : leur somme n'est pas `navigation` (**déduction**).

La page d'exemples (`/documentation/instagram-platform/webhooks/examples`)
range sous « story_insights » un message de structure `messaging` /
`postback` : erreur de la doc. **Aucun exemple réel de `story_insights`
n'est publié.**

## 2 · Ce qu'il faut pour le recevoir

**Mode de l'app.** Guide de configuration Instagram : « Your app must be
published or **Live** to receive notifications for app users. » Webhooks
(Graph), généralités : « Apps in development mode can only receive test
notifications initiated through the app dashboard », plus les notifications
déclenchées par une personne ayant un rôle sur l'app. En Live : « your app
must have been granted relevant permissions to access those objects. »

**Revue.** « Webhooks does not require App Review », mais « it does respect
permissions » : la notification n'arrive que si l'app « has been approved for
the permission(s) that corresponds to that type of data ». Vue d'ensemble de
la plateforme : « Standard Access is the default access level for all apps and
limits the data your app can get » ; « Advanced Access is the access level
required if your app serves Instagram professional accounts » que l'on ne
possède ni ne gère ; « Your app must complete Meta App Review to be granted
Advanced Access. » Guide de configuration, ligne « Business verification » :
« Required for production access » (les trois modes de connexion). Page App
Review : « Your app must complete App Review before it can request permissions
with Advanced Access from any app user. » L'Advanced Access n'est écrit
obligatoire que pour `comments` et `live_comments` ; pour `story_insights`,
rien de plus précis. **Déduction** : Pulse sert les comptes de ses clients,
donc Advanced Access sur `instagram_manage_insights` et les permissions de
Page ci-dessous, donc App Review + vérification d'entreprise. Tant que l'app
est en Développement, seuls les comptes dont le propriétaire a un rôle sur
l'app (David) peuvent produire des notifications.

**Permissions** (matrice des champs, colonne Facebook Login, ligne
`story_insights`) : `instagram_basic`, `instagram_manage_insights`,
`pages_manage_metadata`, `pages_read_engagement`, `pages_show_list`.
Nos scopes : `ads_management`, `pages_show_list`, `instagram_basic`,
`instagram_manage_insights`, `business_management`. **Manquent
`pages_manage_metadata` et `pages_read_engagement`.** La référence
`POST /{page-id}/subscribed_apps` exige aussi `pages_manage_metadata` et
`pages_show_list`, avec « A Page access token requested by a person who can
perform CREATE_CONTENT, MANAGE, or MODERATE task on the Page ».

**Abonnement — deux étages.**
1. **App** : « In the App Dashboard, open Webhooks for your Instagram API
   setup » ; URL de rappel, Verify Token, vérification, choix des champs.
   « You cannot select fields for each app user account » : chaque compte
   reçoit tous les champs cochés.
2. **Par compte** : « For Facebook Login, use a Facebook Page access token.
   Send a `POST` request to the linked Page's `/subscribed_apps` edge. »
   Exemple : `POST https://graph.facebook.com/v27.0/<FACEBOOK_PAGE_ID>/subscribed_apps`
   avec `subscribed_fields=<WEBHOOK_FIELDS>` ; réponse `{"success": true}`.
   **Sur la Page, pas sur le compte Instagram** (l'abonnement sur
   `/{ig-user-id}/subscribed_apps` est réservé à Instagram Login et Unified
   Login).

**Contradiction dans la doc** : la référence Page `subscribed_apps` dit
« You cannot use the `subscribed_fields` parameter to configure or subscribe to
Webhooks for Instagram. You must use your app dashboard to subscribe to
Instagram Webhooks. », alors que le guide Instagram passe
`subscribed_fields` sur cette même arête. **Déduction** : l'appel par Page
active la livraison pour ce compte ; les champs Instagram se choisissent au
tableau de bord. Quelle valeur de `subscribed_fields` accepter dans l'appel
(un champ de Page obligatoire ?) : **non documenté** de façon cohérente — à
essayer.

Autres conditions : « The account that owns the media must be public » (écrit
dans les limitations générales ; la phrase suivante ne vise que commentaires
et mentions — applicabilité à `story_insights` **non documentée**). Le compte
Instagram doit être lié à une Page (« Requires the Instagram professional
account to be linked to a Facebook Page »).

## 3 · La livraison

- **Moment** : « Notifies you when a story expires. » Délai entre la fin des
  24 h et l'envoi : **non documenté**.
- **Couverture** : « `story_insights` notifications contain only the first 24
  hours of metrics », y compris pour une story mise à la une.
- **Réponse attendue** : « Your endpoint should respond to all Event
  Notifications with `200 OK HTTPS`. » Délai maximal de réponse pour
  Instagram : **non documenté** ; le guide conseille de répondre « before it
  starts slow work ». (Messenger, autre produit : « within 5 or less
  seconds ».)
- **Nouvelles tentatives** : « If any update sent to your server fails, we
  will retry immediately, then try a few more times with decreasing
  frequency over the next 36 hours. » « Unacknowledged responses will be
  dropped after 36 hours. » **Nombre d'essais et intervalles : non
  documentés.**
- **Doublons** : « Your server should handle deduplication in these cases. »
  La page d'ensemble : « handle duplicate deliveries » ; « Webhooks do not
  provide a historical notification store » (un message perdu au-delà de
  36 h ne se redemande pas).
- **Lots** : « Event Notifications are aggregated and sent in a batch with a
  **maximum** of 1000 updates. However batching cannot be guaranteed so be
  sure to adjust your servers to handle each Webhook individually. »
  « Multiple changes from different objects that are of the same type may be
  batched together. »
- **Forme** (gabarit Facebook Login / Unified Login) :
  ```
  { "object": "instagram",
    "entry": [ { "id": "<compte Instagram professionnel>",
                 "time": <heure d'envoi par Meta>,
                 "changes": [ { "field": "story_insights",
                                "value": { "media_id": …, "reach": …, … } } ] } ] }
  ```
  **Déduction** : `entry` et `changes` sont des tableaux, un message peut
  porter plusieurs comptes et plusieurs stories ; la route doit les parcourir
  tous. Taille maximale en octets : **non documentée**.

## 4 · `/{ig-user-id}/stories`

Référence IG User Stories :

- Exigences : jeton utilisateur Facebook avec `instagram_basic` et
  `pages_read_engagement` (+ `ads_management` ou `ads_read` si le rôle sur la
  Page vient du Business Manager). Même écart que la recherche du 2026-11-01 :
  `pages_read_engagement` manque à nos scopes ; seul l'essai réel (ticket 02)
  dit si notre jeton passe.
- Réponse d'exemple : le seul `id` par story. Les champs se demandent par
  `fields=` (**déduction** : règle générale du Graph ; la page ne le dit pas),
  parmi ceux de l'objet IG Media :
  - `media_type` : « Can be `CAROUSEL_ALBUM`, `IMAGE`, or `VIDEO` » ;
  - `media_product_type` : « Can be `AD`, `FEED`, `STORY` or `REELS` » ;
  - `media_url` : « The URL for the media. » Omis quand « The video contains
    copyrighted or licensed audio » (vaut pour « video stories ») ; « Treat
    `media_url` as an optional field in your app and fall back to `permalink`
    or `thumbnail_url` when it is absent. » **Durée de vie : non
    documentée** (la carte suppose qu'elle expire : à vérifier, mais le copier
    reste prudent puisque la story elle-même disparaît à 24 h) ;
  - `thumbnail_url` : « Only available on `VIDEO` media » ;
  - `permalink` : « Permanent URL to the media » ; comportement pour une
    story expirée **non documenté** ;
  - `timestamp` : « ISO 8601-formatted creation date in UTC ».
- Limitations : « Responses will not include Live Video stories. » ;
  « Stories are only available for 24 hours. » ; les stories créées par
  repartage d'une story ne sont pas rendues ; « Only one caption will be
  returned per Instagram story ».
- Changelog 2026-07-30 : l'omission de `media_url` pour l'audio sous droits
  s'applique à `GET /<IG_USER_ID>/stories`, toutes versions.
- **Pagination** : rien sur la page des stories. Règle générale du Graph
  (« Paginated Results ») : `paging.cursors.before/after`, `next`, `previous` ;
  `next` absent = dernière page ; `limit` est un maximum, une page plus courte
  ou vide n'est pas la fin — s'arrêter quand `next` disparaît.
- **Limites d'appels** : « All endpoints are subject to Instagram Business Use
  Case rate limiting » ; « Calls within 24 hours = 4800 * Number of
  Impressions », où les impressions sont le nombre de fois où un contenu du
  compte « has entered a person's screen » dans les dernières 24 h.
  **Déduction** : un passage par heure = 24 appels par jour et par compte (plus
  la lecture des chiffres à 22-23 h, une par story) ; très loin du plafond dès
  qu'un compte a une audience. Pour un compte à zéro impression sur 24 h, la
  formule donne 0 — comportement réel **non documenté**.

## 5 · La signature

Guide de configuration Instagram et « Getting Started » des webhooks Graph :

> « We sign all Event Notification payloads with a **SHA256** signature »
> — la signature arrive dans l'en-tête `X-Hub-Signature-256`, précédée de
> `sha256=` (paraphrase de la page).
> « Generate a **SHA256** signature using the payload and your app's **App
> Secret**. » puis comparer à la valeur après `sha256=`.
> « You don't have to validate the payload, but you should. »

Doc des webhooks Messenger (même mécanique Meta, autre produit) :

> « Please note that we generate the signature using an escaped unicode
> version of the payload, with lowercase hex digits. »

La doc Instagram ne dit ni « corps brut », ni rien de l'unicode échappé.
**Déduction** : calculer le HMAC-SHA256 sur les octets reçus tels quels
(jamais sur un JSON reparsé puis resérialisé), avec le secret de l'app Meta —
celui de l'app qui porte l'abonnement, pas un jeton. Si Meta envoie l'unicode
échappé (`é`), le corps brut le contient déjà ainsi. Le cas d'un
caractère non ASCII ne se tranche qu'à l'essai. Le `hub.verify_token` sert à
la seule vérification initiale (`hub.mode=subscribe`, renvoyer
`hub.challenge`), pas à signer.

## Non documenté — à trancher par l'essai réel

- Contenu effectif de `story_insights` aujourd'hui : présence et valeur
  d'`impressions`, `taps_forward`, `taps_back`, `exits` ; absence de `views`,
  `navigation`, `link_clicks`, `follows` (la référence n'en parle pas).
- Délai entre l'expiration et l'envoi.
- Nombre et intervalles des nouvelles tentatives (seuls « immediately », « a
  few more times », « 36 hours » sont écrits).
- Délai maximal de réponse de notre route (Instagram ne le donne pas).
- Taille maximale d'un message ; regroupement réel de plusieurs stories.
- Valeur de `subscribed_fields` à passer sur la Page (doc contradictoire).
- Durée de vie de `media_url` ; comportement de `permalink` après 24 h.
- Exigence de compte public pour `story_insights`.
- Plafond d'appels pour un compte sans impression sur 24 h.
- Si notre jeton (sans `pages_read_engagement`) lit `/stories` et les insights
  d'une story — ticket 02.

## Sources

- Référence des webhooks Instagram : https://developers.facebook.com/docs/graph-api/webhooks/reference/instagram
- Webhooks Instagram, vue d'ensemble : https://developers.facebook.com/documentation/instagram-platform/webhooks.md
- Configuration des webhooks Instagram (Live, limitations, abonnement, signature, nouvelles tentatives, lots) : https://developers.facebook.com/documentation/instagram-platform/webhooks/setup
- Champs et permissions des webhooks Instagram : https://developers.facebook.com/documentation/instagram-platform/webhooks/fields
- Exemples de messages : https://developers.facebook.com/documentation/instagram-platform/webhooks/examples
- Webhooks Graph (mode Développement, App Review) : https://developers.facebook.com/docs/graph-api/webhooks/?locale=en_US
- Webhooks Graph, Getting Started : https://developers.facebook.com/docs/graph-api/webhooks/getting-started
- Webhooks Messenger (unicode échappé, 5 s) : https://developers.facebook.com/documentation/business-messaging/messenger-platform/webhooks
- Référence Page `subscribed_apps` : https://developers.facebook.com/docs/graph-api/reference/page/subscribed_apps/?locale=en_US
- Insights, vue d'ensemble : https://developers.facebook.com/docs/instagram-platform/insights
- Référence Media Insights (`navigation`, 24 h, erreur 10) : https://developers.facebook.com/documentation/instagram-platform/reference/instagram-media/insights.md
- Référence IG User Stories : https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/stories
- Référence IG Media : https://developers.facebook.com/documentation/instagram-platform/reference/instagram-media.md
- Vue d'ensemble de la plateforme (limites BUC, niveaux d'accès) : https://developers.facebook.com/documentation/instagram-platform/overview.md
- App Review : https://developers.facebook.com/documentation/instagram-platform/app-review.md
- Pagination Graph : https://developers.facebook.com/docs/graph-api/results
- Changelog Instagram (2019-05-09, 2023-09-12, 2025-01-21, 2026-06-22, 2026-07-30) : https://developers.facebook.com/documentation/instagram-platform/changelog.md
- Changelog Graph v22.0 : https://developers.facebook.com/docs/graph-api/changelog/version22.0/
