# Ce que l'API Google Ads donne, type de campagne par type

Recherche du ticket `issues/01-ce-que-l-api-donne-par-type.md` (carte
`.scratch/google-ads/map.md`). Version courante de l'API : **v26**, sortie le
2026-10-14 ; la récolte tourne en **v25** (fin de vie en août 2027) [S1].

Toutes les sources ont été lues les **2026-11-08 et 2026-11-09**. Seules des
sources primaires de Google sont citées. Pour les pages « fields » (trop
grandes pour WebFetch), le HTML de la v26 a été téléchargé puis analysé : la
liste « Selectable with » de chaque métrique a été extraite telle quelle.

## Ce qu'il faut savoir avant de lire les tableaux

**L'API vérifie la compatibilité par ressource, pas par type de campagne.** La
liste « Selectable with » d'une métrique donne les ressources (`FROM …`) avec
lesquelles elle peut être demandée [S4]. Une métrique compatible avec
`campaign` ne sera donc **jamais rejetée** parce que la campagne est Search
plutôt que Vidéo : elle reviendra dans la même ligne que les autres. Ce que
vaut une métrique vidéo sur une campagne Search (0, ou rien du tout), **la doc
ne le dit nulle part**. Il n'existe que trois cas où Google écrit noir sur
blanc qu'une métrique ou un segment ne sert qu'à certains types :

- `segments.ad_using_video` et `segments.ad_using_product_data` : « only
  available for PMax campaigns and will not return data when any other
  campaign type is selected » [S5] ;
- `metrics.unique_users` / `average_impression_frequency_per_user` :
  « available for following campaign types - Display, Video, Discovery and
  App » [S4] ;
- `segments.ad_sub_network_type` : « Currently only available for ads running
  as part of DemandGen campaigns on YouTube » [S5].

Dans les tableaux, **« rejetée »** veut donc dire que la ressource refuse la
métrique (erreur de requête), **« doc : non applicable »** que Google écrit
que la métrique ne vaut pas pour ce type, et **« ? »** que la doc ne dit rien
(une valeur 0 est probable, mais **elle n'est pas prouvée**). Les cellules « ? »
sont à trancher par l'essai réel (ticket 10).

Autre règle générale, qui pèse sur §7 : « Rows where all metrics are zero …
won't be returned » [S20]. **Une ligne qui manque n'est pas un zéro écrit par
Google** : c'est une ligne que Google n'a pas renvoyée.

## 1 · Le type lui-même

`campaign.advertising_channel_type` (v26) [S2] : `SEARCH` (« Includes display
bundled, and Search+ campaigns »), `DISPLAY`, `SHOPPING`, `VIDEO`,
`MULTI_CHANNEL` (campagnes App), `PERFORMANCE_MAX`, `DEMAND_GEN`, `SMART`,
`LOCAL`, `LOCAL_SERVICES`, `HOTEL`, `TRAVEL`, plus `UNKNOWN` / `UNSPECIFIED`.

`campaign.advertising_channel_sub_type` (v26) [S3] — les sous-types vidéo :
`VIDEO_ACTION` (« Video TrueView for Action »), `VIDEO_NON_SKIPPABLE`,
`VIDEO_REACH_TARGET_FREQUENCY`, `VIDEO_SEQUENCE`, `YOUTUBE_AUDIO`. Les autres
sous-types utiles : `APP_CAMPAIGN`, `APP_CAMPAIGN_FOR_ENGAGEMENT`,
`APP_CAMPAIGN_FOR_PRE_REGISTRATION`, `DISPLAY_GMAIL_AD`, `DISPLAY_MOBILE_APP`,
`DISPLAY_SMART_CAMPAIGN`, `SHOPPING_COMPARISON_LISTING_ADS`,
`SHOPPING_SMART_ADS`, `SMART_CAMPAIGN`, `LOCAL_CAMPAIGN`, etc.

**Comment se classent les vidéos :**
- **Demand Gen n'est pas un type vidéo** : c'est `DEMAND_GEN`, un type à part
  entière. Il diffuse sur « YouTube (including Shorts), Discover, Gmail,
  Google Maps, and the Google Display Network » [S18].
- **Il n'existe pas de sous-type « in-stream » ni « bumper ».** Le format se
  lit par `segments.ad_format_type` [S21] : `INSTREAM_SKIPPABLE`,
  `INSTREAM_NON_SKIPPABLE`, `BUMPER` (« Short (<7 secs) in-stream
  non-skippable »), `INFEED`, `SHORTS`, `OUTSTREAM`, `MASTHEAD`, `AUDIO`,
  `PAUSE`, `UNSEGMENTED` (« Value assigned for Video TrueView for Action
  campaigns statistics »), `OTHER`, `TEXT` (Search uniquement). Depuis la v25,
  `segments.ad_sub_format_type` découpe les non-skippables par durée et doit
  être demandé avec `ad_format_type` [S15, S17].
- *Incertain* : une campagne vidéo « classique » (skippable in-stream sans
  ciblage de fréquence) n'a aucun sous-type listé. Elle revient probablement
  avec un sous-type `UNSPECIFIED`, mais **la doc ne le dit pas**.
- **L'API ne sait que lire les campagnes Vidéo** : « Video campaigns cannot be
  created or mutated using the Google Ads API » [S17]. Pulse ne fait que lire,
  donc cela ne le gêne pas.

## 2 · Tableau métrique × type de campagne (niveau `FROM campaign`)

Légende : **✓** rendue · **rejetée** · **doc : n/a** = Google écrit qu'elle
ne vaut pas pour ce type · **?** = la doc ne dit rien (0 probable, non prouvé).

| Métrique (v26) | Search | PMax | Display | Vidéo | Shopping | Demand Gen | App | Source |
|---|---|---|---|---|---|---|---|---|
| `impressions`, `clicks`, `cost_micros`, `ctr`, `average_cpc` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | S4, S12, S18 |
| `conversions`, `conversions_value`, `all_conversions` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | S4, S12 |
| `conversions_by_conversion_date` (+ `_value_`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | S4 |
| `view_through_conversions` | ? (définie pour « image or rich media ad ») | ✓ (listée sur `asset_group`) | ✓ | ? | ? | ✓ (option d'optimisation v24) | ✓ (idem) | S4, S6, S15 |
| `interactions`, `engagements` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | S4 |
| `video_trueview_views`, `video_trueview_view_rate`, `trueview_average_cpv` | ? | ✓ au niveau élément, **rejetée** sur `asset_group` | ? | ✓ | ? | ? | ? | S4, S6, S7, S17 |
| `video_quartile_p25/p50/p75/p100_rate` | ? | **rejetée** sur `asset_group` et `asset_group_asset` ; ? sur `campaign` | ? | ✓ | ? | ? | ? | S4, S17 |
| `video_watch_time_duration_millis` | ? | ? | ? | ✓ | ? | ? | ? | S4 |
| `youtube_likes / comments / shares` (Shorts, v26) | ? | ? | ? | ✓ | ? | ? | ? | S4, S15 |
| `unique_users`, `average_impression_frequency_per_user`, `unique_users_two_plus…ten_plus` | doc : n/a | doc : n/a | ✓ | ✓ | doc : n/a | ✓ (« Discovery ») | ✓ | S4, S17 |
| `search_impression_share` | ✓ | ? (non sélectionnable sur `asset_group`) | doc : n/a (« Search Network ») | doc : n/a | ✓ | doc : n/a | ? | S4 |
| `active_view_impressions` | ? | ? | ✓ | ? | ? | ? | ? | S4 |

Les noms qui n'existent plus en v26 : `metrics.video_views`,
`metrics.video_view_rate` et `metrics.average_cpv` sont **absents** de la
page metrics v26 [S4] — ils sont remplacés par `video_trueview_*` et
`trueview_average_cpv`. Une requête qui les demanderait serait rejetée.

**Portée et fréquence (`unique_users`)** : elle n'est sélectionnable qu'avec
`FROM campaign` [S4]. « This metric **cannot be aggregated**, and can only be
requested for date ranges of **92 days or less** » [S4]. Depuis la v26, les
champs `_info` donnent un état de suppression : `PRIVACY_SUPPRESSION`,
`QUALITY_SUPPRESSION`, `LOW_QUALITY`, `DATE_RANGE_BEYOND_RETENTION` [S17].
**Conséquence pour Pulse** : la portée de la semaine se demande **sur la
semaine**. Elle ne se reconstruit pas en additionnant sept jours, et elle peut
revenir supprimée — à afficher « — » avec la raison, jamais 0. Elle ne se
segmente pas par `ad_network_type` [S4].

## 3 · Tableau niveau × type de campagne

| Niveau (`FROM …`) | Search | PMax | Display | Vidéo | Shopping | Demand Gen | App | Source |
|---|---|---|---|---|---|---|---|---|
| `campaign` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | S2, S12 |
| `ad_group` / `ad_group_ad` | ✓ | **aucune donnée** | ✓ | ✓ (lecture seule) | ✓ | ✓ | ✓ | S11, S17, S18 |
| `ad_group_ad_asset_view` (éléments d'une annonce) | ✓ | — | ✓ (RDA depuis v23) | ? | — | ? | ✓ | S4, S15 |
| `asset_group` (groupe d'éléments) | — | ✓ métriques complètes, sans vidéo | — | — | — | — | — | S6, S13 |
| `asset_group_asset` (élément) | — | ✓ métriques (clics, impressions, conversions, `video_trueview_views` depuis v23) | — | — | — | — | — | S7, S14, S15 |
| `asset_group_top_combination_view` | — | combinaisons d'éléments, **aucune métrique** | — | — | — | — | — | S14 |
| `performance_max_placement_view` | — | **impressions seules** | — | — | — | — | — | S4, S10, S12 |
| `keyword_view` (mots-clés) | ✓ | — (pas de mots-clés) | ✓ si ciblage par mots-clés | ✓ (métriques vidéo sélectionnables) | — | ? | — | S4 |
| `search_term_view` (termes, par groupe d'annonces) | ✓ | **exclu** (« does not include Performance Max data ») | — | — | ✓ | — | — | S8 |
| `campaign_search_term_view` (termes, par campagne) | ✓ | ✓, sauf si un segment de mot-clé est demandé | — | — | ✓ | — | — | S9, S11 |
| `video` (vidéo YouTube rattachée) | — | ? | — | ✓ (quartiles, durée de visionnage, likes) | — | ? | ? | S4 |
| `managed_placement_view` (emplacements YouTube) | — | — | ✓ | ✓ | — | — | — | S17 |
| `shopping_performance_view` | — | ✓ (retail) | — | — | ✓ | — | — | S11 |

Phrases clés :
- PMax : « querying resources such as `ad_group` or `ad_group_ad` **won't
  return any data** for your Performance Max campaigns » [S11]. Rien n'est
  rejeté : la requête réussit, mais sans aucune ligne PMax. **Le `ad_group_ad`
  actuel de Pulse perd donc PMax sans le dire.**
- Annonces PMax : « it's not possible to view individual ad performance »,
  parce que les annonces sont assemblées à la volée [S13].
- Libellé de performance : « Aggregate asset performance label metrics are
  removed » (v23) [S15]. `asset_group_asset.performance_label` n'apparaît plus
  dans les champs de la ressource en v26 [S7]. Les éléments ont désormais de
  vraies métriques — « Full performance statistics (such as clicks,
  impressions, and conversions) are now available at the asset level » [S14] —
  plus `primary_status` [S14].
- Termes PMax : `campaign_search_term_view` « provides granular performance
  data, including cost metrics … If keyword-related segments are used,
  Performance Max data will be excluded » [S9].

## 4 · PMax : la ventilation par réseau

- **Depuis la v23** : « Ad network type breakdown is enabled for Performance
  Max campaigns » [S15]. Avant, le segment ne renvoyait que `MIXED`
  (« Cross-network ») [S16].
- **Champ** : `segments.ad_network_type`, à ajouter à `FROM campaign` ou
  `FROM asset_group` [S12, S13]. Il se combine avec `segments.ad_using_video`
  et `segments.ad_using_product_data` [S12].
- **Valeurs (v26)** [S16] : `SEARCH`, `SEARCH_PARTNERS`, `CONTENT` (Display),
  `YOUTUBE`, `DISCOVER`, `GMAIL`, `MAPS`, `GOOGLE_TV`, `MIXED`, plus
  `GOOGLE_OWNED_CHANNELS`, qui ne vaut que pour l'historique Demand Gen
  d'avant la v20.
- **Métriques** : l'exemple officiel ventile `impressions`, `clicks`,
  `conversions` et `cost_micros` par réseau [S12]. La liste « Selectable with »
  de `conversions_value`, `view_through_conversions` et `video_trueview_views`
  inclut aussi `segments.ad_network_type` [S4].
- **Emplacements** : `performance_max_placement_view` est « A view with
  impression metrics » [S10]. `clicks` et `cost_micros` ne figurent pas dans
  sa compatibilité [S4] : les emplacements PMax ne donnent **que des
  impressions**. Ils se segmentent par réseau depuis la v24.2 [S15].
- *Incertain* : **la date à partir de laquelle la ventilation existe**. La doc
  Google ne la donne pas. Des sources tierces avancent le 1er juin 2025 (non
  vérifié, donc non retenu ici). On ne sait pas non plus si la somme des
  réseaux égale exactement le total de la campagne : à vérifier à l'essai
  réel.

## 5 · La date d'attribution des conversions

- `segments.date` : « Date to which metrics apply » [S5]. La phrase ne
  précise pas s'il s'agit de la date du clic ou de celle de la conversion.
- `metrics.conversions_by_conversion_date` : « When this column is selected
  with date, the values in date column means **the conversion date** » [S4].
  C'est l'équivalent API de la colonne « Conversions (by conv. time) » de
  l'interface [S20]. Elle existe avec `campaign`, `ad_group`, `ad_group_ad`,
  `asset_group`, `keyword_view`, `customer`, `shopping_performance_view` et
  `geographic_view`. Elle **n'existe pas** avec `search_term_view`,
  `campaign_search_term_view`, `asset_group_asset`, `ad_group_ad_asset_view`
  ni `video` [S4].
- **Ce qu'on en déduit** (inférence, pas une phrase de Google) : si Google
  prend soin de préciser que cette colonne est datée par la conversion, c'est
  que `metrics.conversions` ne l'est pas. Elle est donc rattachée à la date de
  l'interaction (le clic ou la vue). Les conversions d'une semaine passée
  peuvent alors continuer d'augmenter après coup.
- **Délai de stabilisation** : non trouvé. La page des conversions renvoie à
  un guide de fraîcheur (« performance data isn't available instantly »)
  [S20], dont l'URL attendue
  (`/docs/reporting/data-freshness`) répond 404. **Aucun chiffre de délai
  n'est donc retenu.**

## 6 · Profondeur d'historique et plafonds qui rejettent une requête

| Plafond | Effet | Source |
|---|---|---|
| Segmentation `segments.date` / `week` / `hour`, ou fenêtre infra-mensuelle : **37 mois** | requête **rejetée** : `DateRangeError.REQUESTED_DATE_GRANULARITY_NOT_SUPPORTED` (v24+), `UNKNOWN` en v23 | S19, S15 (v24.1) |
| Par mois / trimestre / an, ou sans segment de date : **11 ans** | la fenêtre doit commencer le 1er du mois et finir le dernier jour du mois | S19 |
| `unique_users` et famille : **92 jours** au plus | fenêtre plus large : non accepté (le mode de refus n'est pas précisé) ; état `DATE_RANGE_BEYOND_RETENTION` en v26 | S4, S17 |
| `change_event` : 30 jours, `LIMIT` obligatoire et plafonné à 10 000 | requête entière rejetée | `CLAUDE.md` §8 et commentaire de `changes.py` — **non relu dans la doc pour cette recherche** |
| Fuseau horaire | toute fenêtre s'évalue dans `customer.time_zone` | S19 |

## 7 · Ce que la récolte actuelle demande, et ce qui manque

Le code lu est celui d'`origin/main` (la branche de la carte précède la
réorganisation du dépôt), dans `saas/data/fetch_data/sources/google/ads/fetchers/`.
Il appelle l'API en **v25** (`_query.py`). La docstring de ce fichier parle
encore de `/v17` : elle est périmée.

**Ce qui est demandé :**
- `campaigns.py` (`FROM campaign`, par jour) : `impressions`, `clicks`,
  `cost_micros`, `conversions`, `ctr`, `average_cpc` →
  `google_ads_insights` ;
- `ads.py` (`FROM ad_group_ad`, par jour, `impressions > 0`) : la même chose
  sans les taux → `google_ads_ad_insights`. **PMax n'y apparaît jamais** [S11]
  — la docstring le dit déjà ;
- le coût du compte `FROM customer`, les statuts, les budgets et
  `change_event`.

**Ce qui manque pour la structure de la carte :**
1. `campaign.advertising_channel_type` et `advertising_channel_sub_type` :
   sans eux, aucun regroupement par type n'est possible ;
2. `conversions_value`, `all_conversions`, `view_through_conversions` ;
3. pour la vidéo : `video_trueview_views`, `video_trueview_view_rate`,
   `trueview_average_cpv`, quartiles, `video_watch_time_duration_millis`, et
   `segments.ad_format_type` pour séparer in-stream, bumper et Shorts ;
4. la portée et la fréquence (`unique_users…`), demandée **par fenêtre** et non
   par jour, avec son état de suppression ;
5. pour PMax : `asset_group` et `asset_group_asset`, puisque le deuxième niveau
   PMax n'est pas le groupe d'annonces, et `segments.ad_network_type` sur
   `campaign` ;
6. `keyword_view` et les termes de recherche, déjà reportés au `BACKLOG.md` ;
7. s'il faut une date de conversion : `conversions_by_conversion_date`.

## 8 · Constats qui pèsent sur la structure

1. **Le socle commun à tous les types** : impressions, clics, coût, CTR, CPC
   moyen, conversions, valeur de conversion, toutes conversions, interactions.
   C'est le seul jeu qu'une vue générale peut additionner sans « ? ».
2. **Ce qui est propre à la vidéo** : vues TrueView, taux de vue, CPV,
   quartiles, durée de visionnage, likes Shorts. Les quartiles et la durée ne
   descendent ni sous `asset_group` ni sous `asset_group_asset`. La portée et
   la fréquence sont doc-réservées à Display, Vidéo, Demand Gen et App ; elles
   ne s'additionnent pas et se limitent à 92 jours.
3. **Ce que PMax ne rend pas** : ni groupe d'annonces ni annonce (aucune
   donnée, sans erreur) ; pas de performance par annonce ; pas de quartiles ;
   des emplacements limités aux impressions ; des termes de recherche
   seulement via `campaign_search_term_view`. **Ce qu'il rend** : des groupes
   et des éléments avec de vraies métriques, et une ventilation par réseau
   depuis la v23.
4. **Demand Gen est un type distinct de Vidéo.** Il a des groupes d'annonces
   et des annonces, et sa sous-ventilation YouTube (In-stream, In-feed,
   Shorts) passe par `ad_sub_network_type`.
5. **L'API n'écrit pas les 0 et ne refuse pas par type.** Afficher « — » pour
   une métrique non applicable relève donc d'une table de règles côté Pulse
   (ce tableau), à confirmer par l'essai réel. Rien ne viendra de l'API.

## Incertitudes (à lever au ticket 10, essai réel)

- La valeur que rend une métrique vidéo sur une campagne Search, Display ou
  PMax (0 ou absente) — toutes les cellules « ? ».
- Le sous-type d'une campagne vidéo skippable classique (probablement
  `UNSPECIFIED`).
- La date de début de la ventilation PMax par réseau, et si les réseaux
  s'additionnent exactement au total de la campagne.
- La date d'attribution de `metrics.conversions` (clic supposé, déduit de
  [S4]) et son délai de stabilisation — aucune source primaire lue ne le
  chiffre.
- Ce que renvoie `unique_users` sur Search ou PMax (0, suppression, ou rien).
- Si la ressource `video` couvre aussi les vidéos de Demand Gen et de PMax.

## Sources (lues les 2026-11-08 et 2026-11-09)

- [S1] https://developers.google.com/google-ads/api/docs/sunset-dates
- [S2] https://developers.google.com/google-ads/api/reference/rpc/latest/AdvertisingChannelTypeEnum.AdvertisingChannelType (v26)
- [S3] https://developers.google.com/google-ads/api/reference/rpc/latest/AdvertisingChannelSubTypeEnum.AdvertisingChannelSubType (v26) ; recoupé dans https://developers.google.com/google-ads/api/fields/v26/campaign
- [S4] https://developers.google.com/google-ads/api/fields/v26/metrics (« Selectable with » extrait du HTML)
- [S5] https://developers.google.com/google-ads/api/fields/v26/segments
- [S6] https://developers.google.com/google-ads/api/fields/v26/asset_group
- [S7] https://developers.google.com/google-ads/api/fields/v26/asset_group_asset
- [S8] https://developers.google.com/google-ads/api/fields/v26/search_term_view
- [S9] https://developers.google.com/google-ads/api/fields/v26/campaign_search_term_view
- [S10] https://developers.google.com/google-ads/api/reference/rpc/v26/PerformanceMaxPlacementView
- [S11] https://developers.google.com/google-ads/api/docs/performance-max/reporting
- [S12] https://developers.google.com/google-ads/api/performance-max/campaign-reporting
- [S13] https://developers.google.com/google-ads/api/performance-max/asset-group-reporting
- [S14] https://developers.google.com/google-ads/api/performance-max/asset-reporting
- [S15] https://developers.google.com/google-ads/api/docs/release-notes (v23 à v26.1)
- [S16] https://developers.google.com/google-ads/api/reference/rpc/latest/AdNetworkTypeEnum.AdNetworkType
- [S17] https://developers.google.com/google-ads/api/docs/video/overview
- [S18] https://developers.google.com/google-ads/api/docs/demand-gen/overview
- [S19] https://developers.google.com/google-ads/api/docs/query/date-ranges
- [S20] https://developers.google.com/google-ads/api/docs/conversions/reporting
- [S21] https://developers.google.com/google-ads/api/reference/rpc/v26/AdFormatTypeEnum.AdFormatType
