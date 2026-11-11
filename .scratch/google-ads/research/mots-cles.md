# Mots-clés et termes de recherche dans l'API Google Ads v26

Recherche pour le ticket 17 (`issues/17-mots-cles-et-termes-dans-l-api.md`),
au service de l'Analyse Search (ticket 18). Lu le 2026-11-11, **aucun appel
réel à l'API** : tout vient de la référence v26 et des guides de
developers.google.com, et de l'aide Google Ads (support.google.com).

Les listes de champs « utilisables quand la ressource est dans le FROM » ont
été lues dans le HTML des pages de référence : chaque champ y porte un
marqueur qui pilote le filtre « Is X specified in the FROM clause? → Yes, it
is ». Un champ sans ce marqueur est listé sur la page mais **refusé** quand la
ressource est dans le `FROM`.

Pages de référence (v26) :
[keyword_view](https://developers.google.com/google-ads/api/fields/v26/keyword_view) ·
[ad_group_criterion](https://developers.google.com/google-ads/api/fields/v26/ad_group_criterion) ·
[search_term_view](https://developers.google.com/google-ads/api/fields/v26/search_term_view) ·
[campaign_search_term_view](https://developers.google.com/google-ads/api/fields/v26/campaign_search_term_view) ·
[campaign_criterion](https://developers.google.com/google-ads/api/fields/v26/campaign_criterion) ·
[shared_set](https://developers.google.com/google-ads/api/fields/v26/shared_set) ·
[shared_criterion](https://developers.google.com/google-ads/api/fields/v26/shared_criterion) ·
[campaign_shared_set](https://developers.google.com/google-ads/api/fields/v26/campaign_shared_set) ·
[customer_negative_criterion](https://developers.google.com/google-ads/api/fields/v26/customer_negative_criterion) ·
[campaign_search_term_insight](https://developers.google.com/google-ads/api/fields/v26/campaign_search_term_insight)

---

## 1 · Mots-clés : `keyword_view` + `ad_group_criterion`

**Forme.** `keyword_view` ne porte qu'un champ propre, `resource_name` ; tout
le reste vient des ressources attribuées (`ad_group_criterion`, `ad_group`,
`campaign`, `customer`, stratégies d'enchères), dont les champs « will not
segment metrics » ([keyword_view](https://developers.google.com/google-ads/api/fields/v26/keyword_view)).
Le guide le confirme : `keyword_view` se joint à `ad_group_criterion`
([Criteria metrics](https://developers.google.com/google-ads/api/docs/reporting/criteria-metrics)).

**Les mots-clés exclus ne sont pas dans `keyword_view`.** « Criteria that
received zero impressions during the specified date range, as well as negative
criteria (such as negative keywords or excluded locations), don't generate
metrics and are excluded from these views »
([Criteria metrics](https://developers.google.com/google-ads/api/docs/reporting/criteria-metrics)).
Un mot-clé à 0 impression sur la période n'apparaît donc pas non plus : la
liste complète des mots-clés posés se lit dans `ad_group_criterion` (sans
métriques).

**Attributs utiles (`ad_group_criterion.*`)** — ce sont des états **actuels**,
non segmentables par date ([ad_group_criterion](https://developers.google.com/google-ads/api/fields/v26/ad_group_criterion)) :

| Champ | Ce qu'il rend |
|---|---|
| `keyword.text` | texte du mot-clé, « at most 80 characters and 10 words » |
| `keyword.match_type` | `BROAD`, `EXACT`, `PHRASE` |
| `status` | `ENABLED`, `PAUSED`, `REMOVED` — statut posé par le client ; la doc prévient que l'interface peut intégrer d'autres informations |
| `negative` | `true` = exclusion (immuable) |
| `primary_status` / `primary_status_reasons` | `ELIGIBLE`, `NOT_ELIGIBLE`, `PAUSED`, `PENDING`, `REMOVED` ; raisons dont `AD_GROUP_CRITERION_LOW_QUALITY`, `…_RARELY_SERVED`, `…_BELOW_FIRST_PAGE_BID`, `CAMPAIGN_CRITERION_NEGATIVE` |
| `system_serving_status` | `ELIGIBLE`, `RARELY_SERVED` |
| `approval_status` | `APPROVED`, `DISAPPROVED`, `PENDING_REVIEW`, `UNDER_REVIEW` |
| `quality_info.quality_score` | entier ; « may not be populated if Google does not have enough information to determine a value » |
| `quality_info.creative_quality_score` | composante pertinence de l'annonce : `ABOVE_AVERAGE` / `AVERAGE` / `BELOW_AVERAGE` |
| `quality_info.post_click_quality_score` | composante page de destination, mêmes trois valeurs |
| `quality_info.search_predicted_ctr` | composante CTR attendu, mêmes trois valeurs |
| `position_estimates.*` | `first_page_cpc_micros`, `first_position_cpc_micros`, `top_of_page_cpc_micros`, `estimated_add_clicks_at_first_position_cpc`, `estimated_add_cost_at_first_position_cpc` |

**Métriques sur `keyword_view`, toutes compatibles avec `segments.date`**
(lu sur la fiche de chaque métrique, liste « Selectable with », et marqueur
FROM) ([keyword_view](https://developers.google.com/google-ads/api/fields/v26/keyword_view)) :

- volume et argent : `impressions`, `clicks`, `cost_micros`, `ctr`,
  `average_cpc`, `conversions`, `conversions_value`, `all_conversions`,
  `cost_per_conversion`, `conversions_value_per_cost`… ;
- part d'impressions : `search_impression_share`, `search_rank_lost_impression_share`,
  `search_top_impression_share`, `search_absolute_top_impression_share`,
  `search_exact_match_impression_share`, `search_click_share`,
  `search_budget_lost_top_impression_share`, `search_budget_lost_absolute_top_impression_share`,
  `search_rank_lost_top_impression_share`, `search_rank_lost_absolute_top_impression_share`,
  `top_impression_percentage`, `absolute_top_impression_percentage` ;
- niveau de qualité **historique** : `historical_quality_score` (INT64),
  `historical_creative_quality_score`, `historical_landing_page_quality_score`,
  `historical_search_predicted_ctr` (enum `QualityScoreBucket`). Leur liste
  « Selectable with » contient `segments.date`, `segments.week`,
  `segments.month` — mais **pas** `segments.device`, `segments.ad_network_type`,
  `segments.match_type`, `segments.conversion_action` ni `segments.day_of_week`.

**Exception : `metrics.search_budget_lost_impression_share` est listée sur la
page `keyword_view` mais n'est pas utilisable quand `keyword_view` est dans le
FROM** (pas de marqueur « Yes, it is »). Idem pour
`current_model_attributed_conversions_from_interactions_rate`,
`…_value_per_interaction`, `…_value_per_cost` et le segment
`conversion_attribution_event_type`. La part perdue (budget) au niveau
mot-clé n'est donc pas disponible ; la part perdue (classement) l'est.

**Bornes des parts d'impressions.** « Search impression share is reported in
the range of 0.1 to 1. Any value below 0.1 is reported as 0.0999 » ; les parts
perdues « in the range of 0 to 0.9. Any value above 0.9 is reported as
0.9001 » (descriptions des métriques,
[keyword_view](https://developers.google.com/google-ads/api/fields/v26/keyword_view)).
0.0999 et 0.9001 sont des plafonds, pas des valeurs mesurées.

**Ce que l'interface dit du niveau de qualité**
([About Quality Score for Search campaigns](https://support.google.com/google-ads/answer/6167118?hl=en)) :
échelle 1-10 « available at the keyword level », trois composantes notées
« Above average / Average / Below average » ; un « — » signifie « there aren't
enough searches that exactly match your keywords to determine » une note ;
comparaison aux annonceurs « over the last 90 days ». Les colonnes « (hist.) »
montrent « past Quality Score stats for the reporting period », et « You can
view the change in daily scores by segmenting your table by day ». **Non
trouvé** : quelle valeur une colonne « (hist.) » rend quand la période n'est
pas segmentée (dernière valeur connue ? autre ?).

**Segment de type de correspondance sur `keyword_view`.** Le segment
compatible est `segments.match_type` (`AI_MAX`, `BROAD`, `EXACT`, `PHRASE`) ;
`segments.search_term_match_type` n'est **pas** compatible avec `keyword_view`
(absent de la page et de sa liste « Selectable with »). Les deux descriptions
de la référence se contredisent pourtant : chacune dit « This segment is for
use with keyword_view » ([keyword_view](https://developers.google.com/google-ads/api/fields/v26/keyword_view),
[search_term_view](https://developers.google.com/google-ads/api/fields/v26/search_term_view)).
Ce sont les listes de compatibilité qui ont été retenues ici.

**L'écran « Mots-clés » de l'interface** se reproduit par cette requête du
[Query cookbook](https://developers.google.com/google-ads/api/docs/query/cookbook)
(« default Search keywords overview screen ») : `keyword.text`, `campaign.name`,
`ad_group.name`, `system_serving_status`, `keyword.match_type`,
`approval_status`, `final_urls`, `clicks`, `impressions`, `ctr`,
`average_cpc`, `cost_micros`, `FROM keyword_view`, `status != 'REMOVED'`.

---

## 2 · Termes de recherche : `search_term_view`

**Grain.** « A search term view with metrics aggregated by search term at the
ad group level. This view does not include Performance Max data »
([search_term_view](https://developers.google.com/google-ads/api/fields/v26/search_term_view)).
Clé : `customers/{customer_id}/searchTermViews/{campaign_id}~{ad_group_id}~{URL-base64_search_term}`.
Ressource segmentante : `ad_group_ad` (ses champs segmentent les métriques).

**Attributs propres** : `search_term` (STRING), `ad_group`, `status`.

**Statut du terme** (`search_term_view.status`, enum `SearchTermTargetingStatus`,
« currently » = état actuel, pas à la date de la ligne)
([enum](https://developers.google.com/google-ads/api/reference/rpc/v26/SearchTermTargetingStatusEnum.SearchTermTargetingStatus)) :
`ADDED` « added to targeted keywords », `EXCLUDED` « matches a negative
keyword », `ADDED_EXCLUDED` « both added and excluded », `NONE` « neither
targeted nor excluded ».

**Segments compatibles** (marqueur FROM) : `date`, `week`, `month`,
`quarter`, `year`, `day_of_week`, `device`, `ad_network_type`,
`ad_sub_network_type`, `conversion_action`(`_category`, `_name`),
`external_conversion_source`, **`keyword.ad_group_criterion`**,
**`keyword.info.text`**, **`keyword.info.match_type`**,
**`search_term_match_type`**, **`search_term_match_source`**.

- `segments.keyword.info.text` / `.match_type` : le **mot-clé déclencheur**
  et **son** type (`BROAD`, `EXACT`, `PHRASE`) ;
  `segments.keyword.ad_group_criterion` : le nom de ressource du critère, pour
  joindre à `ad_group_criterion`.
- `segments.search_term_match_type` : le type d'appariement **du terme**,
  avec les variantes : `EXACT`, `NEAR_EXACT` (« Exact match (close variant) »),
  `PHRASE`, `NEAR_PHRASE` (« Phrase match (close variant) »), `BROAD`,
  `AI_MAX`, `PERFORMANCE_MAX`
  ([enum](https://developers.google.com/google-ads/api/reference/rpc/v26/SearchTermMatchTypeEnum.SearchTermMatchType)).
- `segments.search_term_match_source` : `ADVERTISER_PROVIDED_KEYWORD`,
  `AI_MAX_BROAD_MATCH`, `AI_MAX_KEYWORDLESS`, `DYNAMIC_SEARCH_ADS`,
  `PERFORMANCE_MAX`, `VERTICAL_ADS_DATA_FEED` — « reveals the type of ad
  campaign responsible ».
- `segments.search_term_targeting_status` **n'est pas** compatible avec
  `search_term_view` (on y lit l'attribut `status`).

**Métriques compatibles** : `impressions`, `clicks`, `cost_micros`, `ctr`,
`average_cpc`, `average_cost`, `average_cpm`, `conversions`,
`conversions_value`, `all_conversions`, `all_conversions_value`,
`cost_per_conversion`, `conversions_from_interactions_rate`,
`conversions_value_per_cost`, `value_per_conversion`,
`view_through_conversions`, `interactions`, `top_impression_percentage`,
`absolute_top_impression_percentage`, métriques vidéo et engagement.
**Absentes** : toute part d'impressions (`search_impression_share` et
dérivées), tout niveau de qualité (`historical_*`).

**L'écran « Termes de recherche » de l'interface** se reproduit par la
requête du [Query cookbook](https://developers.google.com/google-ads/api/docs/query/cookbook)
(« default Search terms overview screen ») : `search_term`,
`segments.keyword.info.match_type`, `search_term_view.status`,
`campaign.name`, `ad_group.name`, `clicks`, `impressions`, `ctr`,
`average_cpc`, `cost_micros`, `campaign.advertising_channel_type`.
Côté interface, « The "Keyword" column doesn't show by default »
([About the search terms report](https://support.google.com/google-ads/answer/2472708?hl=en)).

**Types de correspondance vus dans l'interface**
([About the search terms report](https://support.google.com/google-ads/answer/2472708?hl=en)) :
« Exact match », « Exact match (close variant) » (« same meaning and
intent » ; les variantes « can include singular and plural forms, acronyms,
stem words »), « Phrase match », « Broad match ». Pour les annonces dynamiques
et Shopping, le champ affiche « Exact ».

**Texte du terme.** La référence dit seulement « The search term » (STRING).
**Non trouvé** : ni la référence ni l'aide ne disent si la casse, les accents
ou la langue sont conservés tels que tapés ou normalisés. À vérifier sur un
essai réel (hors périmètre de cette recherche).

---

## 3 · Le seuil de confidentialité

- Aide Google Ads : des termes « are omitted from the search terms report in
  order to keep with our standards on data privacy » ; les « search terms
  insights » en tiennent compte en les groupant par sous-thème ou en les
  agrégeant en « other queries », « without exposing the queries themselves »
  ([About the search terms report](https://support.google.com/google-ads/answer/2472708?hl=en)).
- Guide API : « Some search terms that do not have enough query activity are
  omitted from the search terms report to maintain our standards on data
  privacy. Clicks from these "hidden" terms are included in the campaign total
  but are excluded from the search term reports (`search_term_view` and
  `ai_max_search_term_ad_combination_view`) »
  ([Reports for AI Max for Search campaigns](https://developers.google.com/google-ads/api/docs/campaigns/ai-max-for-search-campaigns/ai-max-reporting)).
  La somme des termes est donc **inférieure** au total de la campagne ; la
  part masquée = total campagne − somme des termes, calculable par Pulse sur
  la même fenêtre et les mêmes métriques.
- Interface : l'aide AI Max mentionne une catégorie « Other search terms »
  dans le rapport des termes (« This filter doesn't consider "Other search
  terms" ») ([About reporting in AI Max for Search campaigns](https://support.google.com/google-ads/answer/16470459?hl=en)).
  **Non trouvé** : une page qui décrive cette ligne (libellé exact, place
  dans le tableau, métriques qu'elle porte) ; et **non trouvé** : un seuil
  chiffré (nombre de recherches) sous lequel un terme est masqué.
- `campaign_search_term_insight` (catégories de termes) inclut les termes
  masqués : les regroupements considèrent les termes « not exposed in the
  search terms report due to privacy reasons » ; « other search terms »
  regroupe ceux à « lower conversions or clicks » ou non cherchés par « a
  significant number of people »
  ([About search terms insights](https://support.google.com/google-ads/answer/11386930?hl=en)).
  Métriques de la ressource : `clicks`, `conversions`,
  `conversions_from_interactions_rate`, `conversions_value`, `ctr`,
  `impressions`, `search_volume` — **pas de coût** ; données depuis mars 2023
  ([campaign_search_term_insight](https://developers.google.com/google-ads/api/fields/v26/campaign_search_term_insight)).

---

## 4 · PMax : `campaign_search_term_view`

- « This report provides granular performance data, including cost metrics,
  for each individual search term that triggered your ads. If keyword-related
  segments are used, Performance Max data will be excluded from the results »
  ([campaign_search_term_view](https://developers.google.com/google-ads/api/fields/v26/campaign_search_term_view)).
- Le guide PMax : ce rapport couvre « both Performance Max and search network
  campaigns aggregated at the campaign level » ; « If you use any
  keyword-related segments, such as `keyword.info.text` […] that will filter
  out all Performance Max data »
  ([Campaign criterion performance](https://developers.google.com/google-ads/api/performance-max/campaign-criterion-reporting)).
- Attributs : `campaign`, `search_term`, `resource_name` — **pas d'attribut
  `status`** ; le statut se lit par le segment
  `segments.search_term_targeting_status` (compatible ici). Mêmes métriques
  que `search_term_view` (pas de part d'impressions, pas de niveau de
  qualité). `segments.date` compatible.
- Aide Google Ads : « Data for the Performance Max search terms report is
  available starting from March 2023 »
  ([About the search terms report in Performance Max](https://support.google.com/google-ads/answer/16327396?hl=en)).
- Ce rapport contient aussi les campagnes Search : additionner
  `campaign_search_term_view` et `search_term_view` compterait deux fois les
  termes Search (déduit des deux descriptions ci-dessus, pas écrit tel quel
  par Google).

---

## 5 · Les mots-clés à exclure déjà posés

| Niveau | Où le lire | Champs |
|---|---|---|
| Groupe d'annonces | `ad_group_criterion` avec `negative = true`, `type = KEYWORD` | `keyword.text`, `keyword.match_type`, `status` |
| Campagne | `campaign_criterion` avec `negative = true` | `keyword.text`, `keyword.match_type`, `status` |
| Liste partagée (campagne) | `shared_set` (`type = NEGATIVE_KEYWORDS`) → `shared_criterion` (le contenu) → `campaign_shared_set` (le lien à la campagne, `status`) | `shared_criterion.keyword.text`, `.keyword.match_type` ; `shared_set.name`, `member_count`, `reference_count`, `status` |
| Compte | `shared_set` (`type = ACCOUNT_LEVEL_NEGATIVE_KEYWORDS`) rattaché par `customer_negative_criterion.negative_keyword_list.shared_set` | contenu dans `shared_criterion` |

Sources : [ad_group_criterion](https://developers.google.com/google-ads/api/fields/v26/ad_group_criterion),
[campaign_criterion](https://developers.google.com/google-ads/api/fields/v26/campaign_criterion),
[shared_set](https://developers.google.com/google-ads/api/fields/v26/shared_set),
[shared_criterion](https://developers.google.com/google-ads/api/fields/v26/shared_criterion),
[campaign_shared_set](https://developers.google.com/google-ads/api/fields/v26/campaign_shared_set),
[customer_negative_criterion](https://developers.google.com/google-ads/api/fields/v26/customer_negative_criterion),
[Shared sets](https://developers.google.com/google-ads/api/docs/targeting/shared-sets).

Précisions du guide [Shared sets](https://developers.google.com/google-ads/api/docs/targeting/shared-sets) :
`NEGATIVE_KEYWORDS` est « supported on Search, Display, Shopping,
MULTI_CHANNEL App, and LOCAL campaigns » et se rattache par
`CampaignSharedSet` ; les exclusions de campagne « automatically apply to all
ad groups within that campaign » ; un seul `ACCOUNT_LEVEL_NEGATIVE_KEYWORDS`
« can be attached per account ». Une liste peut appartenir au compte
**manager** : `campaign_shared_set.shared_set` « may be a negative keyword
shared set of another customer » — sans lien manager, le rattachement
« will exist but have no serving effect » ([campaign_shared_set](https://developers.google.com/google-ads/api/fields/v26/campaign_shared_set)).
Lire le contenu d'une liste manager depuis le compte client : **non trouvé**.

Comment une exclusion s'applique
([About negative keywords](https://support.google.com/google-ads/answer/2453972?hl=en)) :
« Negative keywords won't match to close variants or other expansions » ;
« you'll need to add synonyms and singular or plural versions » ; mais
« Negative keywords automatically account for casing and misspellings ».
Exclusion large : la recherche contient tous les mots, dans n'importe quel
ordre ; expression : les mots dans le même ordre ; exacte : les mots dans le
même ordre « without extra words ». La liste de compte « applies negative
keywords across all search and shopping inventory ».

Pour la question « ce terme est-il déjà exclu ? », `search_term_view.status`
(`EXCLUDED`, `ADDED_EXCLUDED`) la tranche directement, sans que Pulse
reproduise les règles d'appariement — dans la mesure où ce statut couvre tous
les niveaux d'exclusion : **non trouvé** (l'enum dit seulement « matches a
negative keyword »).

---

## 6 · Les limites qui rejettent ou tronquent

- **Lignes à zéro omises.** « Rows whose selected metrics are all zero won't
  be returned when segmenting » — exemple donné sur `keyword_view` avec
  `segments.date` ; sans segment, des lignes à zéro peuvent revenir (entités
  « ineligible for display » ou « paused within the report's date range »)
  ([Zero metrics](https://developers.google.com/google-ads/api/docs/reporting/zero-metrics)).
- **Profondeur historique.** `segments.date` / `week` / `hour` : 37 mois ;
  au-delà, `DateRangeError.REQUESTED_DATE_GRANULARITY_NOT_SUPPORTED` (v24+) —
  la requête est **rejetée**, pas tronquée. `month` / `quarter` / `year` ou
  sans segment : 11 ans
  ([Date ranges](https://developers.google.com/google-ads/api/docs/query/date-ranges)).
- **PMax search terms : depuis mars 2023** (voir §4) ; insights : depuis
  mars 2023.
- **Pagination.** `GoogleAdsService.Search` rend des pages fixes de
  10 000 lignes (v19+), `page_size` renvoie `RequestError.PAGE_SIZE_NOT_SUPPORTED` ;
  `SearchStream` évite les jetons de page
  ([Page through results](https://developers.google.com/google-ads/api/docs/reporting/paging)).
  Aucune troncature silencieuse documentée : les pages suivent par
  `next_page_token`.
- **Fenêtre maximale propre aux termes ou aux mots-clés** (comme les 30 jours
  de `change_event`) : **non trouvé** — aucune n'est documentée sur les pages
  lues.
- **Quotas / `RESOURCE_EXHAUSTED`** : documenté seulement pour les insights
  (« request the `customer_search_term_insight` data first ») dans
  [Campaign criterion performance](https://developers.google.com/google-ads/api/performance-max/campaign-criterion-reporting).
- Volumes déjà mesurés (ticket 10) : 8 363 lignes mot-clé × jour et 8 685
  termes `search_term_view`, 20 820 termes PMax, 90 jours, compte principal.

---

## 7 · Tableau : champ × par jour / par période / jamais

« Par jour » = compatible avec `segments.date` dans la ressource indiquée.
« Période » = ne se lit que comme un état ou une valeur sans date.
« Jamais » = non disponible à ce niveau en v26.

| Champ | Ressource | Par jour | Par période seulement | Jamais |
|---|---|---|---|---|
| impressions, clics, coût, conversions, valeur, CTR, CPC | `keyword_view` | oui | — | — |
| idem | `search_term_view`, `campaign_search_term_view` | oui | — | — |
| texte et type de correspondance du mot-clé | `ad_group_criterion` | — | état actuel | — |
| statut du mot-clé (`status`, `primary_status`, `system_serving_status`, `approval_status`) | `ad_group_criterion` | — | état actuel | — |
| niveau de qualité + 3 composantes (`quality_info.*`) | `ad_group_criterion` | — | état actuel | — |
| niveau de qualité historique + 3 composantes (`historical_*`) | `keyword_view` | oui (pas avec appareil, réseau, type de correspondance, conversion) | — | `search_term_view`, `campaign_search_term_view` |
| part d'impressions, part perdue (classement), haut de page, correspondance exacte, part de clics | `keyword_view` | oui | — | `search_term_view`, `campaign_search_term_view` |
| part perdue (budget) `search_budget_lost_impression_share` | `keyword_view` | — | — | refusée quand `keyword_view` est dans le FROM |
| `top_impression_percentage`, `absolute_top_impression_percentage` | les trois vues | oui | — | — |
| texte du terme | `search_term_view`, `campaign_search_term_view` | oui (clé de la ligne) | — | — |
| mot-clé déclencheur (`segments.keyword.info.text`, `.match_type`, `.ad_group_criterion`) | `search_term_view` | oui | — | PMax (le segment exclut PMax de `campaign_search_term_view`) |
| type d'appariement du terme (`segments.search_term_match_type`) | `search_term_view`, `campaign_search_term_view` | oui | — | `keyword_view` |
| source d'appariement (`segments.search_term_match_source`) | `search_term_view`, `campaign_search_term_view` | oui | — | — |
| statut du terme | `search_term_view.status` | — | état actuel (« currently ») | — |
| statut du terme | `segments.search_term_targeting_status` | segment compatible avec `segments.date` sur `campaign_search_term_view` ; valeur par jour ou actuelle : **non trouvé** | — | `search_term_view` |
| mots-clés à exclure | `ad_group_criterion`, `campaign_criterion`, `shared_criterion` | — | état actuel | dans `keyword_view` (« negative criteria […] are excluded ») |
| catégories de termes (masqués compris) | `campaign_search_term_insight` | `segments.date` présent | — | coût |

---

## 8 · Ce que ça permet pour l'Analyse Search (ticket 18)

Factuel, sans choix d'écran.

- **Nuage de points des mots-clés.** Tout axe tiré de `impressions`,
  `clicks`, `cost_micros`, `conversions`, `conversions_value` et de leurs
  ratios existe par jour sur `keyword_view`, donc agrégeable sur la période
  du Bandeau ; la couleur par campagne vient de `campaign.*` (attribut, ne
  segmente pas). La part d'impressions et la part perdue (classement) existent
  aussi par jour ; la part perdue (budget) n'existe pas au niveau mot-clé.
  Les parts plafonnées (0.0999, 0.9001) ne sont pas des mesures exactes.
- **Un mot-clé sans impression sur la période n'est pas dans `keyword_view`** :
  le montrer demande `ad_group_criterion` en plus, et il s'affichera sans
  chiffres, pas avec des zéros.
- **Niveau de qualité.** Deux sources : l'état actuel
  (`ad_group_criterion.quality_info.*`, peut être vide) et l'historique par
  jour (`metrics.historical_*`). Comment résumer l'historique sur une période
  (dernière valeur ? autre ?) n'est pas documenté.
- **« Déclenché tout seul ».** Par terme, on dispose du texte du terme, du
  texte du mot-clé déclencheur et de deux types : celui du mot-clé
  (`keyword.info.match_type`) et celui de l'appariement
  (`search_term_match_type`, qui distingue `EXACT` de `NEAR_EXACT`). Les deux
  mesures possibles — égalité de texte terme = mot-clé, ou appariement
  `EXACT` — sont toutes deux calculables ; elles ne donnent pas forcément le
  même résultat (une variante proche est `NEAR_EXACT`).
- **Part masquée par le seuil de confidentialité.** Elle n'est pas rendue
  par l'API, mais se calcule : total campagne (ou groupe) − somme des termes,
  sur la même fenêtre. Pas de seuil chiffré publié.
- **Termes « qui ne rapportent rien ».** Coût et conversions existent par
  jour et par terme : « X CHF, 0 conversion » sur une fenêtre est calculable.
  Les lignes où toutes les métriques demandées valent 0 n'existent pas ; un
  terme absent n'est pas un terme à zéro.
- **Déjà exclu ?** `search_term_view.status` (`EXCLUDED`, `ADDED_EXCLUDED`)
  le dit pour chaque terme, état actuel. Pour un **mot récurrent** découpé par
  Pulse (« gratuit »), il n'y a pas de statut : il faudrait le comparer aux
  exclusions posées (groupe, campagne, listes, compte — §5), en sachant
  qu'une exclusion ne couvre pas les variantes proches mais couvre casse et
  fautes d'orthographe.
- **Découpage en mots.** Le texte est rendu en STRING ; la conservation de la
  casse et des accents n'est pas documentée.
- **PMax.** Les termes PMax se lisent dans `campaign_search_term_view`, au
  niveau campagne, sans mot-clé déclencheur (le segment mot-clé retire PMax),
  depuis mars 2023 ; ce rapport inclut aussi les campagnes Search.
- **Volume.** Ordre de grandeur du compte principal sur 90 jours (ticket 10) :
  ~8 400 lignes mot-clé × jour, ~8 700 termes — pagination par 10 000.

## Ce qui reste incertain

1. Valeur rendue par `historical_quality_score` sur une période non
   segmentée.
2. Casse / accents / langue du texte du terme.
3. Libellé et contenu de la ligne « Other search terms » de l'interface, et
   seuil de masquage chiffré.
4. Si `search_term_view.status = EXCLUDED` couvre les listes partagées et la
   liste du compte, et si `segments.search_term_targeting_status` est un état
   par jour ou actuel.
5. Lecture d'une liste d'exclusion appartenant au compte manager depuis le
   compte client.
6. La contradiction des descriptions `segments.match_type` /
   `segments.search_term_match_type` (« for use with keyword_view ») — tranchée
   ici par les listes de compatibilité ; un essai réel la confirmerait.
