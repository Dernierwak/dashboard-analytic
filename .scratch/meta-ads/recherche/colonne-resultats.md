# Quel champ de l'API Meta rend la colonne « Résultats » d'Ads Manager

Recherche du ticket
[15](../issues/15-quel-champ-de-l-api-rend-la-colonne-resultats.md).
Lue le 2026-10-01. **Aucun appel à l'API Meta n'a été fait**, aucun secret lu :
c'est de la lecture de documentation et de code source publiés par Meta.

Elle prolonge [`champs-api-meta.md`](champs-api-meta.md) (recherche 04) sans
la refaire. Ce que celle-ci a établi (la forme `AdsActionStats`, l'emboîtement
des `action_type`, la bascule d'attribution du 10 juin 2025) est repris par
renvoi, pas re-sourcé.

Règle appliquée : une affirmation sans citation porte la mention
**« non établi »**.

## Les sources

| # | Source | Ce qu'elle tranche ici |
|---|---|---|
| R1 | https://developers.facebook.com/docs/marketing-api/reference/ad-account/insights/ (page rendue en `v25.0`/`v26.0`) et sa version brute https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-account/insights.md | la liste des champs `*result*` de `/insights`, leurs types, leurs descriptions |
| R2 | https://www.facebook.com/business/help/611432918970668 (Meta Business Help Center, article « Results ») | la définition de la métrique « Résultats » d'Ads Manager, et son lien à l'attribution |
| R3 | https://www.facebook.com/business/help/460276478298895 (« About attribution settings and models ») | les fenêtres d'attribution de l'ad set, la mise en garde sur la comparaison |
| R4 | SDK officiel Python, `facebook_business/adobjects/adsinsights.py`, aux tags `21.0.0` … `24.0.0` — https://github.com/facebook/facebook-python-business-sdk | à partir de quelle version le champ `results` existe |
| R5 | Spécification générée par Meta, `api_specs/specs/AdsInsights.json` — https://github.com/facebook/facebook-business-sdk-codegen | le type déclaré des champs `*result*` côté générateur |
| R6 | Changelogs Marketing API v21.0 → v24.0 — https://developers.facebook.com/docs/marketing-api/marketing-api-changelog/version21.0 (et `version22.0`, `version23.0`, `version24.0`) | ce que le changelog dit (ou ne dit pas) de ces champs |
| S3 | https://developers.facebook.com/docs/marketing-api/insights/best-practices/ (déjà citée en recherche 04) | la bascule d'attribution du 10 juin 2025 |

---

# 1 · Le champ : `results`

## Ce que la doc dit, mot pour mot

R1 liste, dans les champs de `/insights` :

| Champ | Type (R1) | Description, mot pour mot (R1) |
|---|---|---|
| **`results`** | `list<AdsInsightsResult>` | « The number of times your ad achieved an outcome, based on the objective and settings you selected. » |
| `cost_per_result` | `list<AdsInsightsResult>` | « The average cost per result from your ads. » |
| `result_rate` | `list<AdsInsightsResult>` | « The percentage of results you received out of all the views of your ads. » |
| `objective_results` | `list<AdsInsightsResult>` | « The number of responses you wanted to achieve from your ad campaign, based on your selected objective. For example, if you selected promote your Page as your campaign objective, this metric shows the number of Page likes that happened as a result of your ads. » |
| `cost_per_objective_result` | `list<AdsInsightsResult>` | « The average cost per objective result from your ads. Objective results are what you're trying to get the most of in your ad campaign, based on the objective you selected. » |
| `objective_result_rate` | `list<AdsInsightsResult>` | « The number of objective results you received divided by the number of impressions. » |
| `result_values_performance_indicator` | `string` | aucune description — la ligne répète le nom du champ |
| `dda_results` | `list<AdsInsightsDdaResult>` | aucune description — la ligne répète le nom du champ |
| `actions_results` | `AdsActionStats` | « The number of actions as a result of your ad. The results you see here are based on your objective. » |
| `cost_per_action_result` | `AdsActionStats` | « The average you paid for each action associated with your objective. » (déjà relevé en recherche 04) |

**Il n'existe pas de champ `result_type`** dans R1 ni dans R5 : vérifié sur la
liste complète. La piste du ticket est fausse sous ce nom.

## Pourquoi `results` et pas un autre

La description de `results` dans R1 est **mot pour mot** la définition que le
centre d'aide de Meta donne de la métrique « Results » d'Ads Manager (R2) :

> The number of times your ad achieved an outcome, based on the objective and
> settings you selected.

R2 précise ensuite (« How it's calculated ») :

> This metric counts the number of results you received based on your selected
> objective and ad settings.

Aucun autre champ ne porte cette phrase. `objective_results` parle de
l'**objectif** seul (« based on your selected objective ») ; `results` parle de
l'objectif **et des réglages** (« objective and settings ») — c'est-à-dire,
selon R2, de l'objectif et des réglages d'ad set, dont l'attribution (point 3).

**Ce que ça établit** : `results` est le champ que Meta documente avec la
définition de la colonne « Résultats ». **Ce que ça n'établit pas** : que le
nombre rendu égale, à l'unité, le chiffre affiché dans Ads Manager pour une
annonce un jour donné. Aucune page de Meta ne l'affirme en ces termes — voir
« Non établi » et l'appel qui le trancherait.

`objective_results` reste une colonne distincte dont la doc ne dit pas en quoi
elle diffère de `results` sur un cas concret : **non établi**.

---

# 2 · Sa forme exacte

## Le type déclaré

- R1 : `list<AdsInsightsResult>` — une **liste**, comme `conversions`, pas un
  nombre.
- R5 (la spécification d'où Meta génère ses SDK) : `{'name': 'results', 'type':
  'list<Object>'}`. Même chose pour `objective_results`, `cost_per_result`,
  `result_rate`, `cost_per_objective_result`, `objective_result_rate`.
- R4 (SDK Python, `_field_types`) : `'results': 'list<Object>'`.

## La structure d'un élément : **non établi**

`AdsInsightsResult` **n'a pas de page de référence** :

- R1 cite le type sans lien (vérifié dans le HTML brut de la page : aucune
  ancre vers une page `ads-insights-result`) ;
- `https://developers.facebook.com/docs/marketing-api/reference/ads-insights-result/`
  et `https://developers.facebook.com/docs/graph-api/reference/ads-insights-result/`
  → **404** ;
- `https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ads-insights-result`
  → une coquille « Meta for Developers » sans contenu ;
- R5 ne contient **pas** de `AdsInsightsResult.json` (404), et déclare le champ
  `list<Object>` — le générateur lui-même ne connaît pas la forme de
  l'élément ;
- **aucun exemple de réponse JSON** contenant `results` n'existe dans R1, ni
  dans la page générale `/docs/marketing-api/insights/`.

La forme d'un élément (quelles clés : un indicateur, une liste de valeurs, une
valeur par fenêtre d'attribution ?) est donc **non établie**. Le champ voisin
`result_values_performance_indicator` (`string`, sans description) laisse
deviner qu'un « indicateur » nomme le type de résultat — **ce n'est qu'une
lecture du nom, pas un fait documenté.**

Pourquoi une **liste** et pas un nombre : la doc ne le dit pas (**non
établi**). Une hypothèse plausible et non vérifiée est qu'au niveau campagne ou
compte, plusieurs ad sets peuvent viser des résultats différents. Au niveau
`ad`, une annonce appartient à un seul ad set ; qu'on reçoive alors toujours un
seul élément est **non établi**.

---

# 3 · Dépend-il de la fenêtre d'attribution ?

**Oui, de celle de l'ad set** — c'est la doc d'Ads Manager qui le dit, et la
bascule de juin 2025 qui l'applique à l'API.

R2, mot pour mot :

> Meta uses a default attribution setting of 7-day click, 1-day view and 1-day
> engagement conversion. If you select a different attribution setting, your
> results will be counted based on the attribution setting you selected.
>
> In some cases where results cannot be measured directly due to partial or
> missing data, statistical modeling may be used for some results.

R3 : les réglages d'attribution se choisissent **au niveau de l'ad set**
(« at the ad set level »), et :

> Results cannot be compared in the Campaign Overview table across ad sets with
> different attribution models. Each attribution model uses different counting
> mechanisms, and comparing across different attribution models will lead to
> inaccurate conclusions.

Côté API, S3 (déjà citée en recherche 04) : depuis le 10 juin 2025,
`use_unified_attribution_setting` et `action_report_time` sont ignorés et
« API responses will mimic Ads Manager settings: Attributed `value`s will be
based on ad set level attribution settings ». R1 garde, sur
`use_unified_attribution_setting`, la note : « Please set this to `true` to get
the same behavior as in the Ads Manager. »

Trois points à ne pas confondre :

1. **Le défaut d'Ads Manager (R2) n'est pas celui du paramètre de l'API (R1).**
   R2 : « 7-day click, 1-day view and 1-day engagement conversion ». R1,
   paramètre `action_attribution_windows` : « The `default` option means
   `["7d_click","1d_view"]` » — sans « engagement ». Et R1 se contredit dans sa
   propre section « Creating », qui écrit `["7d_view","1d_click"]`. Le champ
   `attribution_setting` de la réponse est donc la seule source fiable de la
   fenêtre réellement appliquée (proposition déjà faite en recherche 04, §7).
2. **Si `action_attribution_windows` agit sur `results`** (ou seulement sur les
   listes `AdsActionStats`, qui portent une clé par fenêtre — `1d_click`,
   `7d_click`… — cf. recherche 04 §2) : **non établi**. La doc ne le dit pas.
3. **La valeur bouge après coup** : « Insights … do not change after 28 days »
   (S3) vaut pour tous les insights ; R2 ajoute la modélisation statistique.
   Un `results` d'hier n'est pas définitif — même règle de recouvrement que les
   conversions (recherche 04 §3, ticket 09).

---

# 4 · Une campagne de notoriété : absent ou zéro ?

**Non établi.** Aucune source primaire lue ne dit ce que `results` rend pour une
campagne d'objectif notoriété (`OUTCOME_AWARENESS`).

Ce qu'on peut dire sans inventer :

- R2 définit un résultat selon « the objective and settings you selected » : une
  campagne de notoriété a un objectif et un `optimization_goal` (R1 :
  `optimization_goal`, « The optimization goal you selected for your ad or ad
  set »), donc elle a, par définition, *un* type de résultat. Que ce type soit
  la couverture, les impressions ou le souvenir publicitaire estimé, la doc
  primaire lue ne le dit pas.
- Les seuls textes trouvés qui l'affirment (« for Brand Awareness campaigns…
  reach, ad recall lift ») sont des blogs tiers — exclus.
- Ce que rend le champ quand l'annonce a dépensé sans produire de résultat :
  champ absent, liste vide, élément à `"0"` — **non établi**. C'est la même
  question que `link_clicks` absent devenu `0` (recherche 04, « Un ticket à
  ouvrir ») : tant qu'elle n'est pas tranchée par un appel réel, un `results`
  absent s'enregistre `NULL`, jamais `0` (`CLAUDE.md` §7).

Conséquence à garder en tête pour le produit : si `results` d'une campagne de
notoriété rend la **couverture**, la colonne « Résultats » mélange alors des
personnes touchées et des achats d'une ligne à l'autre. R3 met déjà en garde
contre la comparaison entre attributions différentes ; additionner des
`results` de types différents est la même faute. **Le type du résultat doit
voyager avec le nombre** — d'où l'importance de la forme de l'élément (§2),
non établie.

---

# 5 · Depuis quelle version d'API ?

- **Le changelog officiel ne l'annonce pas.** Les pages R6 v21.0 (2 octobre
  2024), v22.0, v23.0 (29 mai 2025) et v24.0 (8 octobre 2025) ne mentionnent ni
  `results`, ni `objective_results`, ni `cost_per_result`, ni
  `AdsInsightsResult` (lues ; la v23.0 vérifiée aussi dans le HTML brut : zéro
  occurrence).
- **Le SDK officiel le date** (R4) : le champ `results` (avec
  `objective_results`, `cost_per_result`, `result_rate`,
  `cost_per_objective_result`, `objective_result_rate`,
  `result_values_performance_indicator`) est **absent** de `adsinsights.py` à
  tous les tags `21.0.0` → `22.0.5`, et **présent** dès `23.0.0`, puis à
  `24.0.0`. Le SDK est régénéré à chaque version d'API à partir de R5.
- Les pages de référence versionnées (`.../insights/v19.0`, `.../v22.0`)
  redirigent vers la version courante (`v26.0`) : elles ne prouvent rien sur
  l'historique.

**Conclusion** : le champ est apparu **au plus tard avec la v23.0** (mai 2025)
selon le SDK, ce qui couvre la `v24.0` utilisée par le code (`_GRAPH`, cf.
recherche 04). Qu'il ait existé côté serveur **avant** la v23.0 sans être dans
le SDK : **non établi**.

---

# Non établi — et l'appel qui le trancherait

1. **Que `results` égale à l'unité la colonne « Résultats »** d'Ads Manager, par
   annonce et par jour.
2. **La structure JSON d'un élément `AdsInsightsResult`.**
3. **Ce que rend `results` pour une campagne de notoriété**, et pour une annonce
   qui a dépensé sans résultat (absent / `[]` / `"0"`).
4. **Si `action_attribution_windows` modifie `results`**, ou si seule la fenêtre
   de l'ad set compte.
5. **En quoi `objective_results` diffère de `results`** sur un cas réel.
6. **Si une ligne `level=ad` peut porter plus d'un élément** dans `results`.

Un seul appel, sur un compte branché, avec un jeton lu par le worker (jamais
dans la conversation) :

```
GET https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/insights
  ?level=ad
  &time_increment=1
  &time_range={"since":"<J-8>","until":"<J-1>"}
  &fields=ad_id,adset_id,campaign_id,objective,optimization_goal,
          attribution_setting,results,objective_results,cost_per_result,
          result_values_performance_indicator,actions,conversions,
          spend,impressions,reach
```

- `until` = la veille : le jour en cours est exclu (`CLAUDE.md` §7).
- Le compte doit porter **au moins** : une campagne de ventes ou de prospects
  avec pixel, une campagne **notoriété** (`OUTCOME_AWARENESS`), et idéalement un
  ad set dont l'attribution n'est pas celle par défaut (`attribution_setting`
  le dira).
- **Comparer** chaque ligne `(ad_id, date_start)` à un export Ads Manager au
  niveau annonce, ventilé par jour, colonne « Résultats », même période — cela
  tranche 1, 2, 3, 5 et 6.
- **Rejouer** le même appel en ajoutant
  `&action_attribution_windows=["1d_click"]` : si `results` ne bouge pas alors
  que `actions[].value` bouge, `results` suit l'ad set et pas le paramètre —
  cela tranche 4.

Lancement : à la main, depuis l'onglet **GitHub Actions** (`weekly-fetch.yml`)
une fois l'appel ajouté à la récolte, ou par David dans l'explorateur Graph API
de Meta. Rien de cela ne se vérifie en cliquant dans l'app.
