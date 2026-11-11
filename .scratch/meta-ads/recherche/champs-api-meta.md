# Les champs API Meta pour les conversions et le contenu des créas

Recherche du ticket
[04](../issues/04-les-champs-api-meta-pour-les-conversions-et-les-creas.md).
Lue le 2026-09-28, sur `developers.facebook.com` uniquement. **Aucun appel à
l'API Meta n'a été fait** — c'est de la lecture de documentation.

Règle appliquée partout : une affirmation sans citation n'entre pas dans ce
fichier. Ce que la doc ne dit pas est rangé sous **« Pas encore établi »** à la
fin, et signalé sur place par « la doc ne le dit pas ».

Version en cours dans le code : `v24.0` (`_GRAPH` dans
`saas/collecte/automatisation/fetch_all.py` et `saas/collecte/meta/fetch_meta_ads.py`).
Les pages de référence lues sont non versionnées ou en `v25.0`/`v26.0` ; rien
dans ce qui suit ne dépend d'une version postérieure à `v24.0` **sauf** la
bascule du 10 juin 2025 décrite au point 3, qui est un changement de
comportement du service, pas de version d'API.

## Les sources

| # | Page | Ce qu'elle tranche ici |
|---|---|---|
| S1 | https://developers.facebook.com/docs/marketing-api/reference/ad-account/insights/ | la liste des champs de `/insights` et des paramètres |
| S2 | https://developers.facebook.com/docs/marketing-api/reference/ads-action-stats/ | la forme d'un élément de `actions` et la liste des `action_type` |
| S3 | https://developers.facebook.com/docs/marketing-api/insights/best-practices/ | la bascule du 10 juin 2025, la fraîcheur des données |
| S4 | https://developers.facebook.com/docs/marketing-api/insights/breakdowns/ | la hiérarchie des types d'action |
| S5 | https://developers.facebook.com/docs/marketing-api/insights/ | les exemples de réponse `/insights` |
| S6 | https://developers.facebook.com/docs/marketing-api/reference/ad-creative/ | les champs d'une créa |
| S7 | https://developers.facebook.com/docs/marketing-api/reference/ad-creative-object-story-spec/ | `object_story_spec` |
| S8 | https://developers.facebook.com/docs/marketing-api/reference/ad-creative-link-data/ | titre / texte / description d'une créa de lien |
| S9 | https://developers.facebook.com/docs/marketing-api/reference/ad-creative-video-data/ | idem pour une créa vidéo |
| S10 | https://developers.facebook.com/docs/marketing-api/reference/ad-creative-photo-data/ | idem pour une créa photo |
| S11 | https://developers.facebook.com/docs/marketing-api/reference/ad-asset-feed-spec/ | `asset_feed_spec` — plusieurs assets sous une annonce |
| S12 | https://developers.facebook.com/docs/marketing-api/reference/ad-asset-feed-spec-image/ | un asset image |
| S13 | https://developers.facebook.com/docs/marketing-api/reference/ad-asset-feed-spec-body/ | un asset « texte » |
| S14 | https://developers.facebook.com/docs/marketing-api/reference/ad-asset-feed-spec-title/ | un asset « titre » |
| S15 | https://developers.facebook.com/docs/marketing-api/reference/ad-asset-feed-spec-description/ | un asset « description » |
| S16 | https://developers.facebook.com/docs/marketing-api/reference/ad-asset-feed-spec-video/ | un asset vidéo |
| S17 | https://developers.facebook.com/docs/marketing-api/ad-creative/asset-feed-spec/insights/ | les ventilations par asset, **et deux vrais exemples JSON** |
| S18 | https://developers.facebook.com/docs/marketing-api/dynamic-creative/asset-feed-spec/ | les plafonds d'assets par annonce |
| S19 | https://developers.facebook.com/docs/marketing-api/reference/ad-image/ | `url` temporaire vs `permalink_url` permanent |
| S20 | https://developers.facebook.com/docs/graph-api/reference/video/ | `source` et `picture` d'une vidéo |
| S21 | https://developers.facebook.com/docs/marketing-api/reference/adgroup/ | le champ `creative` d'une annonce, et ses edges |
| S22 | https://developers.facebook.com/docs/marketing-api/reference/adgroup/adcreatives/ | l'edge `/{ad-id}/adcreatives` |
| S23 | https://developers.facebook.com/docs/marketing-api/reference/ad-account/adimages/ | le filtre `hashes` |
| S24 | https://developers.facebook.com/docs/graph-api/overview/rate-limiting/ | les quotas |
| S25 | https://developers.facebook.com/docs/graph-api/guides/field-expansion | l'expansion de champs, et sa réserve sur la Marketing API |
| S26 | https://developers.facebook.com/docs/marketing-api/creative/ | « readable fields are the same as those specified when you created the object » |
| S27 | https://developers.facebook.com/docs/marketing-api/reference/ad-campaign/ | `attribution_spec` de l'ad set |

---

# 1 · Quels champs de `/insights` portent les conversions

Tous ces champs sont des champs du **même appel** `/insights` que
`_meta_chunk` fait déjà. Aucun n'ouvre un nouvel endpoint.

| Champ | Type (S1) | Description, **mot pour mot** (S1) |
|---|---|---|
| `actions` | `list<AdsActionStats>` | « The total number of actions Accounts Center accounts took that are attributed to your ads. Actions may include engagement, clicks or conversions. » |
| `action_values` | `list<AdsActionStats>` | « The total value of all conversions attributed to your ads. » |
| `conversions` | `list<AdsActionStats>` | « The number of actions as a result of your ad. The results you see here are based on your objective. » |
| `conversion_values` | `list<AdsActionStats>` | « The total value of all conversions from your catalog segment attributed to your ads. » |
| `cost_per_action_type` | `list<AdsActionStats>` | « The average cost of a relevant action. » |
| `cost_per_conversion` | `list<AdsActionStats>` | **aucune description dans la doc** — la ligne ne porte que le nom et le type |
| `cost_per_unique_action_type` | `list<AdsActionStats>` | « The average cost of each unique action. This metric is estimated. » |
| `cost_per_unique_conversion` | `list<AdsActionStats>` | aucune description dans la doc |
| `cost_per_action_result` | `AdsActionStats` (pas une liste) | « The average you paid for each action associated with your objective. » |
| `purchase_roas` | `list<AdsActionStats>` | « The total return on ad spend (ROAS) from purchases. This is based on information received from one or more of your connected Facebook Business Tools and attributed to your ads. » |
| `website_purchase_roas` | `list<AdsActionStats>` | « The total return on ad spend (ROAS) from website purchases. This is based on the value of all conversions recorded by the Facebook pixel on your website and attributed to your ads. » |
| `outbound_clicks` | `list<AdsActionStats>` | « The number of clicks on links that take Accounts Center accounts off Facebook-owned properties. » |
| `inline_link_clicks` | `numeric string` | « The number of clicks on links to select destinations or experiences, on or off Facebook-owned properties. **Inline link clicks use a fixed 1-day-click attribution window.** » |
| `attribution_setting` | `string` | « The default attribution window to be used when attribution result is calculated… The attribution setting for campaign or account is calculated based on existing ad sets. » |
| `objective` | `string` | « The objective reflecting the goal you want to achieve with your advertising. It may be different from the selected objective of the campaign in some cases. » |
| `result_rate` | `list<AdsInsightsResult>` | « The percentage of results you received out of all the views of your ads. » |
| `objective_result_rate` | `list<AdsInsightsResult>` | « The number of objective results you received divided by the number of impressions. » |
| `cost_per_objective_result` | `list<AdsInsightsResult>` | « The average cost per objective result from your ads. » |

## Lequel est « le bon » — les faits, pas la décision

**Il n'y a pas de champ « nombre de conversions ».** Les cinq candidats
(`actions`, `conversions`, `action_values`, `cost_per_action_type`,
`cost_per_conversion`) rendent **tous** une liste `list<AdsActionStats>`, donc
un tableau de types d'action, jamais un nombre. Voir le point 2.

Ce que la doc dit de la différence entre les deux familles :

- `actions` = **tout** ce que les gens ont fait : « Actions may include
  engagement, clicks or conversions » (S1). Un `like`, un `post_reaction` et un
  achat y cohabitent.
- `conversions` = « The number of actions as a result of your ad. **The results
  you see here are based on your objective.** » (S1). C'est le seul des cinq
  dont la doc dise qu'il se règle sur l'**objectif** de la campagne, donc sur
  quelque chose que le client a déjà choisi en créant sa campagne, sans rien
  configurer de plus.
- `cost_per_action_type` = « The average cost of a relevant action » (S1). Le
  pendant coût de `actions`.
- `cost_per_conversion` : **la doc ne donne aucune description.** On ne peut
  donc pas affirmer qu'il est le pendant coût de `conversions` — c'est
  vraisemblable, ce n'est pas écrit.
- `action_values` = « The total value of all conversions attributed to your
  ads » (S1) : c'est de l'**argent**, pas un compte. À ne pas mettre dans la
  même colonne qu'un nombre d'actions.

**Il n'existe aucun champ « taux de conversion ».** J'ai passé en revue tous
les champs de S1 dont le nom contient `rate`, `ranking`, `conversion` ou
`cost_per`. Les seuls taux existants sont : `ctr`, `inline_link_click_ctr`,
`outbound_clicks_ctr`, `actions_per_impression` (« Total number of actions
divided by the number of impessions », coquille d'origine comprise),
`dwell_rate`, `result_rate`, `objective_result_rate`. **Aucun** ne divise des
conversions par des clics. Le taux de conversion devra donc se **calculer**
chez nous — et `CLAUDE.md` §7 impose alors de dire par quoi on divise, parce
que « conversions / clics » et « conversions / impressions » ne sont pas la
même chose et Meta n'arbitre pas.

Attention sur le dénominateur : `clicks` = « The number of clicks on your ads »
(S1, tous les clics, y compris un clic sur le nom de la page), tandis que
`inline_link_clicks` = clics sur les liens, avec « a fixed 1-day-click
attribution window » (S1). Deux dénominateurs légitimes, deux résultats
différents.

---

# 2 · La forme des listes, et les types d'action

## La forme d'un élément — `AdsActionStats` (S2)

Chaque élément d'une de ces listes porte :

| Champ | Type (S2) | Description, mot pour mot (S2) |
|---|---|---|
| `action_type` | `string` | « The kind of actions taken on your ad, Page, app or event after your ad was served to someone, even if they didn't click on it. Action types include Page likes, app installs, conversions, event responses and more. » |
| `value` | `numeric string` | « Metric value of default attribution window » |
| `1d_click` | `numeric string` | « Metric value of attribution window '1 day after clicking the ad' » |
| `7d_click` | `numeric string` | « Metric value of attribution window '7 days after clicking the ad' » |
| `28d_click` | `numeric string` | « Metric value of attribution window '28 days after clicking the ad' » |
| `1d_view` | `numeric string` | « Metric value of attribution window '1 day after viewing the ad' » |
| `7d_view` | `numeric string` | « Metric value of attribution window '7 days after viewing the ad' » |
| `28d_view` | `numeric string` | « Metric value of attribution window '28 days after viewing the ad' » |
| `dda` | `numeric string` | « Data driven model attribution window » |
| `inline` | `numeric string` | « Attribution occurring on the ad itself » |
| `incrementality` | `numeric string` | « Incremental Attribution window value » |

Et des clés de ventilation, présentes seulement si on les demande via
`action_breakdowns` : `action_device`, `action_destination`, `action_target_id`,
`action_reaction`, `action_carousel_card_id`, `action_carousel_card_name`,
`action_canvas_component_name`, `action_video_sound`, `action_video_type` (S2).

**Deux conséquences directes :**

1. Les valeurs sont des **chaînes**, pas des nombres. Même piège que
   `_centimes` dans `fetch_meta_ads.py` : un `int()` / `float()` explicite est
   obligatoire.
2. `value` est la valeur de la **fenêtre par défaut**, et la fenêtre par défaut
   n'est plus la nôtre depuis juin 2025 — voir le point 3. `inline` ne sera
   plus rendu du tout (S3).

## Un exemple de réponse

**Ce que la doc donne réellement pour `/insights`** (S5, mot pour mot) :

```json
{
  "data": [
    {
      "account_id": "<AD_ACCOUNT_ID>",
      "campaign_id": "<CAMPAIGN_ID>",
      "date_start": "2025-03-14",
      "date_stop": "2025-04-12",
      "impressions": "361324",
      "spend": "5339.5"
    }
  ],
  "paging": {
    "cursors": {
      "before": "MAZDZD",
      "after": "MAZDZD"
    }
  }
}
```

**Et c'est tout.** J'ai cherché un exemple de réponse contenant un tableau
`actions` sur S1, S2, S4, S5, la page « Limits & Best Practices » (S3), le
miroir `developers.facebook.com/documentation/ads-commerce/marketing-api/insights`,
les versions archivées `insights/v2.3`, `insights/v2.7`,
`insights/breakdowns/v2.7`, et la page « Shared Creative Insights ». **Aucune
page de `developers.facebook.com` lue aujourd'hui ne montre un exemple de
réponse avec `actions`, `action_type`, `cost_per_action_type`, `1d_click` ou
`7d_click`.** C'est un trou de la doc, pas un oubli de ma part : je ne le
comble pas avec un exemple trouvé sur un blog.

La forme **déduite des types de S1 et S2** — à lire comme un schéma, pas comme
une réponse copiée :

```json
{
  "data": [
    {
      "ad_id": "<AD_ID>",
      "ad_name": "<AD_NAME>",
      "date_start": "2026-09-21",
      "date_stop": "2026-09-21",
      "spend": "42.17",
      "actions": [
        { "action_type": "link_click",  "value": "31", "1d_click": "30", "1d_view": "1" },
        { "action_type": "post_engagement", "value": "58" },
        { "action_type": "offsite_conversion.fb_pixel_purchase", "value": "3", "7d_click": "2", "1d_view": "1" }
      ],
      "action_values": [
        { "action_type": "offsite_conversion.fb_pixel_purchase", "value": "289.90" }
      ],
      "cost_per_action_type": [
        { "action_type": "link_click", "value": "1.36" },
        { "action_type": "offsite_conversion.fb_pixel_purchase", "value": "14.06" }
      ],
      "attribution_setting": "7d_click_1d_view"
    }
  ],
  "paging": { "cursors": { "before": "MAZDZD", "after": "MAZDZD" } }
}
```

Deux choses que ce schéma dit et qu'il faut retenir : **un `action_type` absent
est une clé absente, pas un zéro** (exactement ce que `CLAUDE.md` §7 exige), et
la valeur de `attribution_setting` ci-dessus est une invention de forme — la
doc donne la description du champ, jamais un exemple de sa valeur.

## Les seuls exemples JSON réels que la doc donne sur des listes de ce genre

Ils viennent des ventilations par asset (S17) — et ils comptent pour le point 4
autant que pour ici, parce qu'ils montrent qu'un élément de liste porte bien
`{ id, texte ou hash, url }` :

```json
{
  "data": [
    {
      "impressions": "8801",
      "date_start": "2016-04-29",
      "date_stop": "2016-05-13",
      "body_asset": {
        "text": "Test text",
        "id": "6051732675652"
      }
    },
    {
      "impressions": "7558",
      "date_start": "2016-04-29",
      "date_stop": "2016-05-13",
      "body_asset": {
        "text": "Test ext new",
        "id": "6051732676452"
      }
    }
  ],
  "paging": { "cursors": { "before": "MAZDZD", "after": "MgZDZD" } }
}
```

```json
{
  "data": [
    {
      "impressions": "5497",
      "date_start": "2016-04-29",
      "date_stop": "2016-05-13",
      "image_asset": {
        "hash": "<HASH>",
        "url": "<URL>",
        "id": "6051732672052"
      }
    }
  ],
  "paging": { "cursors": { "before": "MAZDZD", "after": "MwZDZD" } }
}
```

(les `hash` et `url` sont anonymisés dans ma restitution ; la doc y met des
valeurs réelles d'un compte de démo.)

## Les types d'action existants (S2, liste complète)

`app_custom_event.fb_mobile_achievement_unlocked`,
`app_custom_event.fb_mobile_activate_app`,
`app_custom_event.fb_mobile_add_payment_info`,
`app_custom_event.fb_mobile_add_to_cart`,
`app_custom_event.fb_mobile_add_to_wishlist`,
`app_custom_event.fb_mobile_complete_registration`,
`app_custom_event.fb_mobile_content_view`,
`app_custom_event.fb_mobile_initiated_checkout`,
`app_custom_event.fb_mobile_level_achieved`,
`app_custom_event.fb_mobile_purchase`, `app_custom_event.fb_mobile_rate`,
`app_custom_event.fb_mobile_search`, `app_custom_event.fb_mobile_spent_credits`,
`app_custom_event.fb_mobile_tutorial_completion`, `app_custom_event.other`,
`app_install`, `app_use`, `checkin`, `comment`, `credit_spent`, `games.plays`,
**`landing_page_view`**, `like`, **`link_click`**, `mobile_app_install`,
**`offsite_conversion.custom.<custom_conv_id>`**,
`offsite_conversion.fb_pixel_add_payment_info`,
`offsite_conversion.fb_pixel_add_to_cart`,
`offsite_conversion.fb_pixel_add_to_wishlist`,
`offsite_conversion.fb_pixel_complete_registration`,
`offsite_conversion.fb_pixel_custom`,
`offsite_conversion.fb_pixel_initiate_checkout`,
**`offsite_conversion.fb_pixel_lead`**,
**`offsite_conversion.fb_pixel_purchase`**,
`offsite_conversion.fb_pixel_search`,
`offsite_conversion.fb_pixel_view_content`, `onsite_conversion.flow_complete`,
`onsite_conversion.messaging_block`,
`onsite_conversion.messaging_conversation_started_7d`,
`onsite_conversion.messaging_first_reply`,
`onsite_conversion.messaging_user_subscribed`, `onsite_conversion.post_save`,
`onsite_conversion.purchase`, **`outbound_click`**, `photo_view`, `post`,
`post_reaction`, `rsvp`, `video_view`, `contact_total`, `contact_website`,
`contact_mobile_app`, `contact_offline`, `customize_product_total`,
`customize_product_website`, `customize_product_mobile_app`,
`customize_product_offline`, `donate_total`, `donate_website`,
`donate_on_facebook`, `donate_mobile_app`, `donate_offline`,
`find_location_total`, `find_location_website`, `find_location_mobile_app`,
`find_location_offline`, `schedule_total`, `schedule_website`,
`schedule_mobile_app`, `schedule_offline`, `start_trial_total`,
`start_trial_website`, `start_trial_mobile_app`, `start_trial_offline`,
`submit_application_total`, `submit_application_website`,
`submit_application_mobile_app`, `submit_application_offline`,
`submit_application_on_facebook`, `subscribe_total`, `subscribe_website`,
`subscribe_mobile_app`, `subscribe_offline`,
`recurring_subscription_payment_total`,
`recurring_subscription_payment_website`,
`recurring_subscription_payment_mobile_app`,
`recurring_subscription_payment_offline`, `cancel_subscription_total`,
`cancel_subscription_website`, `cancel_subscription_mobile_app`,
`cancel_subscription_offline`, `ad_click_mobile_app`,
`ad_impression_mobile_app`, `click_to_call_call_confirm`,
`click_to_call_native_call_placed`, `click_to_call_native_20s_call_connect`,
`click_to_call_native_60s_call_connect`, **`page_engagement`**,
**`post_engagement`**, `onsite_conversion.lead_grouped`, **`lead`**,
`leadgen_grouped`, `omni_app_install`, **`omni_purchase`**, `omni_add_to_cart`,
`omni_complete_registration`, `omni_view_content`, `omni_search`,
`omni_initiated_checkout`, `omni_achievement_unlocked`, `omni_activate_app`,
`omni_level_achieved`, `omni_rate`, `omni_spend_credits`,
`omni_tutorial_completion`, `omni_custom`.

(le gras est de moi : ce sont ceux qu'un compte Meta suisse « site web + pixel »
a le plus de chances de produire. Ce n'est pas une affirmation de la doc.)

## LE PIÈGE : ces types s'EMBOÎTENT, on ne les additionne jamais

S4 donne ce schéma, mot pour mot :

```
total_actions - 33
    page_engagement - 10
        post_engagement - 10
            link_click - 2
            comment - 3
            post_reaction - 3
            like - 2
    mobile_app_install - 12
    app_custom_event - 11
        app_custom_event.fb_mobile_activate_app - 6
        app_custom_event.other - 5
```

Un `link_click` est **déjà compté** dans `post_engagement`, lui-même déjà
compté dans `page_engagement`. Faire `SUM(value)` sur le tableau `actions`
donne ici 33 + 10 + 10 + 2 + 3 + 3 + 2 + 12 + 11 + 6 + 5 au lieu de 33. C'est
exactement la forme d'erreur de `CLAUDE.md` §7 : un chiffre fabriqué qui ne
lève rien. **Toute colonne ou tout écran qui agrège doit nommer le type
d'action**, jamais sommer la liste.

S4 précise aussi : « If `action_breakdowns` parameter is not specified,
`action_type` is implicitly added » — donc on obtient bien une ligne par type
sans rien demander de plus. Et S1 : « Note: you must also include `actions`
field whenever `action_breakdowns` is specified. »

## Pour un client qui ne configure rien — les faits

Le ticket demande de ne pas trancher. Voici les trois faits qui pèsent, et
rien de plus :

1. `conversions` est le seul champ dont la doc dise qu'il suit l'**objectif**
   de la campagne : « The results you see here are based on your objective »
   (S1). Un client qui ne configure rien a quand même choisi un objectif.
2. Un client **sans pixel** ne produira jamais un
   `offsite_conversion.fb_pixel_*`. Et la carte dit déjà : « Une campagne de
   notoriété dans le module Conversion affiche « — », jamais « 0 ». » Une
   colonne unique « conversions » fondée sur un type pixel affichera donc `NULL`
   pour une partie des comptes, ce qui est le comportement correct — à
   condition qu'elle affiche `—`.
3. Les champs `result_rate`, `objective_result_rate` et
   `cost_per_objective_result` sont de type `list<AdsInsightsResult>` et non
   `AdsActionStats`. **Je n'ai pas trouvé la page de référence
   `AdsInsightsResult`** (404 sur `.../reference/ads-insights-result/`), donc
   je ne sais pas ce que porte un de ses éléments. C'est une piste, pas une
   option chiffrée. Voir « Pas encore établi ».

**La décision appartient à David.** Le schéma proposé au point 7 est fait pour
qu'elle puisse être prise *après* la récolte, et changée, sans re-récolter.

---

# 3 · La fenêtre d'attribution, et le recouvrement de 7 jours

## Ce que la doc dit, mot pour mot

**La fenêtre par défaut** (S1, paramètre `action_attribution_windows`) :

> **Default value:** `default`
> The attribution window for the actions. The attribution window determines the
> window (e.g. 7d) and engagement type (e.g click) that's used as a filter to
> report actions… The `default` option means `["7d_click","1d_view"]`.

Valeurs acceptées (S1) : `1d_view`, `7d_view`, `28d_view`, `1d_click`,
`7d_click`, `28d_click`, `1d_ev`, `dda`, `default`,
`7d_view_first_conversion`, `28d_view_first_conversion`,
`7d_view_all_conversions`, `28d_view_all_conversions`, `skan_view`,
`skan_click`, et les variantes `skan_*_second/third_postback`.

**À quelle DATE une action se pose** (S1, paramètre `action_report_time`) :

> Determines the report time of action stats. For example, if a person saw the
> ad on Jan 1st but converted on Jan 2nd, when you query the API with
> `action_report_time=impression`, you see a conversion on Jan 1st. When you
> query the API with `action_report_time=conversion`, you see a conversion on
> Jan 2nd.

**LE CHANGEMENT QUI MODIFIE LA PRÉMISSE DU TICKET** (S3, mot pour mot) :

> Beginning June 10, 2025, to reduce discrepancies with Meta Ads Manager, the
> `use_unified_attribution_setting` and `action_report_time` parameters will be
> disregarded and API responses will mimic Ads Manager settings: Attributed
> `value`s will be based on ad set level attribution settings (similar to
> `use_unified_attribution_setting=true`), and inline/on-ad actions will be
> included in `1d_click` or `1d_view` attribution window data. After this
> change, standalone `inline` attribution window data will no longer be
> returned. Actions will be reported using `action_report_time=mixed`: on-Meta
> actions (e.g., Link Clicks) will use impression-based reporting time; whereas
> off-Meta actions (e.g., Web Purchases) will leverage conversion-based
> reporting time.

**La fraîcheur des données** (S3, mot pour mot — la page les présente comme
trois puces de bonnes pratiques) :

> Insights refresh every 15 minutes and do not change after 28 days of being
> reported
> Insights metrics may continue to update for a couple of days after an ad has
> completed

## Ce que ça donne pour Pulse

Le ticket et le commentaire de `_RECOUVREMENT_JOURS_META` posent « Meta attribue
à la date du **clic** ». **Depuis le 10 juin 2025, ce n'est vrai que pour la
moitié des actions** (S3) :

| Famille d'action | Date sur laquelle l'action se pose | Exemples donnés par la doc |
|---|---|---|
| **on-Meta** — « impression-based reporting time » | la date de l'**impression** | « Link Clicks » (S3) |
| **off-Meta** — « conversion-based reporting time » | la date de la **conversion** | « Web Purchases » (S3) |

**Réponse 1 — une conversion peut-elle apparaître sur une date déjà
récoltée ? OUI, et pour les actions on-Meta seulement.**

- Une action **on-Meta** (`link_click`, `post_engagement`, `video_view`, les
  `onsite_conversion.*`) qui survient aujourd'hui se pose sur la date de
  l'impression, donc **jusqu'à 7 jours en arrière** avec la fenêtre par défaut
  `["7d_click","1d_view"]` (S1) — et plus loin si l'ad set du client est réglé
  plus large, puisque depuis juin 2025 c'est le réglage de l'ad set qui pilote
  (S3). Le recouvrement de 7 jours couvre **exactement** la fenêtre par défaut,
  et rien au-delà.
- Une action **off-Meta** (un achat pixel, un `offsite_conversion.fb_pixel_lead`)
  se pose sur la date à laquelle elle a eu lieu, donc sur une date récente que
  le recouvrement réécrit de toute façon. Pour celles-là, ce n'est pas la
  fenêtre d'attribution qui menace la récolte.

Un corollaire à ne pas manquer : la fenêtre de l'ad set est **lisible**, via le
champ d'insights `attribution_setting` (S1) ou via `attribution_spec` sur l'ad
set (S27 : « Conversion attribution spec used for attributing conversions for
optimization. Supported window lengths differ by optimization goal and campaign
objective », `event_type` ∈ {`CLICK_THROUGH`, `VIEW_THROUGH`,
`ENGAGED_VIDEO_VIEW`}, `window_days` int64). Autrement dit : plutôt que de
supposer 7 jours, on peut **mesurer** la fenêtre du client. C'est la raison de
la colonne `attribution_setting` proposée au point 7.

**Réponse 2 — au-delà de quel délai ce n'est plus rattrapable ?**

Le seul chiffre que la doc donne est **28 jours** : « Insights refresh every 15
minutes and **do not change after 28 days of being reported** » (S3). Lu
littéralement : les chiffres d'une date peuvent bouger pendant 28 jours après
avoir été rapportés, et plus après. Donc :

- **Avant 28 jours** : une réécriture rattrape le changement, à condition que la
  fenêtre de recouvrement atteigne la date concernée.
- **Après 28 jours** : plus rien ne bouge côté Meta. Une valeur fausse en base
  au-delà de ce délai n'est plus rattrapable par un simple recouvrement — il
  faut un rejeu explicite (`--meta-since`, déjà outillé).
- **Aujourd'hui, avec `_RECOUVREMENT_JOURS_META = 7`** : il reste une fenêtre de
  **21 jours** (du 8e au 28e jour) pendant laquelle un chiffre peut encore
  changer chez Meta sans qu'aucun passage ne vienne le relire. Ce n'est pas une
  hypothèse sur un bug, c'est la soustraction de deux nombres de la doc.
- La doc **ne dit pas** quelle part des changements survient après le 7e jour.
  On ne peut donc pas dire si ce trou de 21 jours coûte 0,1 % ou 10 % d'un
  chiffre. C'est une inconnue, pas un risque chiffré.

**Ce que ça coûterait de passer à 28** : rien en appels tant que la plage tient
dans une tranche de 90 jours (`_CHUNK`) — la note « CE QUE ÇA COÛTE » de
`fetch_all.py` l'établit déjà pour le passage de 7 à 37 jours côté Google. Le
seul effet mesurable est le nombre de lignes : 20 pubs × 28 jours = 560 lignes,
soit **2 pages au lieu d'une** avec `limit=500`, donc **un appel de plus par
passage**. Décision à David ; le fait est chiffré.

**Un défaut existant, trouvé en chemin** (ticket à ouvrir, pas corrigé ici) :
`fetch_all.py:886-887` fait

```python
lc = next((it for it in row.get("actions", []) if it.get("action_type") == "link_click"), None)
row["link_clicks"] = int(lc.get("value", 0)) if lc else 0
```

Un `link_click` absent du tableau devient **0**, pas `NULL`. C'est
littéralement « une absence de donnée n'est pas un zéro » (`CLAUDE.md` §7), et
la colonne `link_clicks` est nullable exprès. Le même `else 0` ne doit pas être
reproduit sur les conversions.

---

# 4 · Le contenu des créas : quel chemin

## Le chemin, et pourquoi celui-là

L'annonce porte un champ `creative` de type `AdCreative` (S21 : « The ID or
creative spec of the ad creative to be used by this ad »). Elle porte **aussi**
un edge `adcreatives` (S21, S22). Les deux existent, ils ne servent pas à la
même chose :

- `GET /{ad-id}?fields=creative{...}` — **le chemin à prendre.** C'est un
  champ, donc l'expansion de champs s'applique (S25 : « The field expansion
  feature of the Graph API allows you to effectively nest multiple graph queries
  into a single call », syntaxe `?fields=<LEVEL_ONE>{<LEVEL_TWO>}`). Il rend **la
  créa de cette annonce**, une seule.
- `GET /{ad-id}/adcreatives` — S22 rend « A list of AdCreative nodes », donc
  une **collection**, et il faut la paginer. Pour lire le contenu affiché par
  une annonce, c'est une indirection de plus sans rien gagner.

Et surtout, à faire en un seul appel pour tout le compte :

```
GET /act_<AD_ACCOUNT_ID>/ads
    ?fields=id,name,adset_id,campaign_id,effective_status,
            creative{id,name,object_type,effective_object_story_id,
                     title,body,image_url,image_hash,thumbnail_url,video_id,
                     link_url,url_tags,call_to_action_type,status,
                     object_story_spec{page_id,instagram_user_id,
                         link_data{message,name,description,caption,link,
                                   picture,image_hash,
                                   child_attachments{name,description,link,
                                                     image_hash,picture}},
                         photo_data{url,image_hash,caption},
                         video_data{video_id,title,message,link_description,
                                    image_url,image_hash}},
                     asset_feed_spec{ad_formats,optimization_type,
                         images{hash,url},videos{video_id,thumbnail_url,thumbnail_hash},
                         bodies{text},titles{text},descriptions{text},
                         link_urls{website_url},call_to_action_types}}
    &limit=200
```

Réserve à porter au dossier, elle est dans la doc : S25 dit « Certain
resources, including **most of Marketing API**, are unable to utilize field
expansion on some or all connections. » `creative` est un **champ** et non une
connexion, donc l'expansion devrait s'appliquer ; **la doc ne le garantit pas
nommément pour ce champ**, et je n'ai pas de jeton pour l'essayer. Le repli
est `GET /{ad-id}?fields=creative{...}` annonce par annonce — même données, un
appel par annonce (chiffré au point 6).

## Où vit chaque morceau de contenu

Il y a **trois montages possibles**, et une annonce n'en utilise qu'un. Il faut
les lire tous les trois, parce qu'on ne sait pas d'avance lequel le client a
choisi.

### a) Les champs plats de la créa (S6)

| Champ | Type | Description, mot pour mot (S6) |
|---|---|---|
| `title` | `string` | « Title for link ad, which does not belong to a page. » |
| `body` | `string` | « The body of the ad. Not supported for video post creatives » |
| `image_url` | `string` | « A URL for the image for this creative. We save the image at this URL to the ad account's image library. If provided, do not include `image_hash`. » |
| `image_hash` | `string` | « Image hash for ad creative. If provided, do not add `image_url`. » |
| `thumbnail_url` | `string` | « URL for a thumbnail image for this ad creative. You can provide dimensions for this with `thumbnail_width` and `thumbnail_height`. » |
| `video_id` | `numeric string` | « Facebook object ID for video in this ad creative. » |
| `object_story_spec` | `AdCreativeObjectStorySpec` | « Use if you want to create a new unpublished page post and turn the post into an ad. » |
| `object_story_id` | Post ID | « ID of a Facebook Page post to use in an ad. » |
| `effective_object_story_id` | Post ID | « The ID of a page post to use in an ad, regardless of whether it's an organic or unpublished page post » |
| `asset_feed_spec` | `AdAssetFeedSpec` | « Used for Dynamic Creative to automatically experiment and deliver different variations of an ad's creative. » |
| `object_type` | `enum` | « The type of Facebook object you want to advertise. » |
| `status` | `enum {ACTIVE, IN_PROCESS, WITH_ISSUES, DELETED}` | « The status of the creative. » |

**Piège documenté** : `title`, `body` et `image_url` sont décrits comme des
champs d'**entrée** (« If provided, do not include `image_hash` »). Et S26 dit
que les champs lisibles d'une créa « are the same as those specified when you
created the object, plus `id` ». Donc **une créa construite depuis
`object_story_spec` ne rendra pas `title`/`body`/`image_url` au niveau
racine** : le contenu est dans `object_story_spec`. C'est pour ça qu'il faut
demander les trois montages et prendre le premier qui répond, pas se fier à
`body`.

`object_type` sert à savoir lequel on lit ; à défaut, la présence de
`object_story_spec.link_data` / `photo_data` / `video_data` suffit.

### b) `object_story_spec` — le montage courant (S7)

Champs (S7) : `link_data` (`AdCreativeLinkData`, « The spec for a link page
post or carousel ad »), `photo_data` (`AdCreativePhotoData`, « The spec for a
photo page post »), `video_data` (`AdCreativeVideoData`, « The spec for a video
page post »), `text_data`, `template_data` (« as used in Dynamic Product Ads »),
`product_data`, `page_id` (« ID of a Facebook page. An unpublished page post
will be created on this page »), `instagram_user_id` (« The Instagram user
account that the ad will be posted to »).

**`link_data`** (S8) — c'est là que vivent titre et texte :

| Champ | Description, mot pour mot (S8) | Ce que c'est pour nous |
|---|---|---|
| `message` | « The main body of the post. » | **le texte principal** |
| `name` | « Name of the link. Overwrite the title of the link when you preview the ad. » | **le titre / accroche** |
| `description` | « Link description. Overwrites the description in the link when your ad displays. » | **la description** |
| `caption` | « Link caption. Overwrites the caption under the title in the link. » | la légende sous le titre |
| `link` | « Link url. This url is required to be the same as the CTA link url. » | la destination |
| `picture` | « URL of a picture to use in the post. Specify this field or `image_hash`. » | **l'image, en URL** |
| `image_hash` | « Hash of an image in your ad account's image library. » | **l'image, en hash** |
| `child_attachments` | « A 2-5 element array of link objects required for carousel ads. » | **le carrousel : 2 à 5 cartes** |
| `call_to_action` | « An optional call to action button. » | le bouton |

Noter que le titre s'appelle `name`, pas `title` — le contraire de ce qu'on
suppose. C'est une source de bug garantie si on ne le note pas.

**`photo_data`** (S10) : `image_hash` (« Hash of an image in your image library
with Facebook. Specify this field or `url` but not both. »), `url` (« URL of an
image to use in the ad. Specify this field or `image_hash` but not both. »),
`caption` (« The description of the image »). **Pas de champ titre.**

**`video_data`** (S9) : `video_id` (« ID of video that user has permission to or
a video in ad account video library »), `title` (« The title of the video »),
`message` (« The main body of the video post »), `link_description` (« Link
description of the video »), `image_hash` (« Hash of an image in your image
library with Facebook to use as thumbnail »), `image_url` (« URL of image to use
as thumbnail. **You should not use image URLs returned from the FB CDN** »).

Cette dernière phrase est la citation la plus nette de toute la doc sur la
durabilité des URL de CDN. Voir le point 5.

### c) `asset_feed_spec` — PLUSIEURS assets sous UNE annonce (S11)

C'est la réponse à « y compris quand plusieurs assets vivent sous une
annonce ». `asset_feed_spec` est décrit par S6 comme « Used for Dynamic
Creative to automatically experiment and deliver different variations of an
ad's creative. »

Ses champs (S11, mot pour mot) :

| Champ | Type | Description (S11) |
|---|---|---|
| `images` | `list<AdAssetFeedSpecImage>` | « Ad image asset spec in asset feed spec » |
| `videos` | `list<AdAssetFeedSpecVideo>` | « Ad video asset spec in asset feed spec » |
| `bodies` | `list<AdAssetFeedSpecBody>` | « Ad body asset spec in asset feed spec » |
| `titles` | `list<AdAssetFeedSpecTitle>` | « Ad title asset spec in asset feed spec » |
| `descriptions` | `list<AdAssetFeedSpecDescription>` | « Ad description asset spec in asset feed spec » |
| `link_urls` | `list<AdAssetFeedSpecLinkURL>` | « Ad link urls asset spec in asset feed spec » |
| `call_to_action_types` | `list<enum>` | « Ad call to action spec in asset feed spec » |
| `ad_formats` | `list<enum>` | « Ad format spec in asset feed spec » |
| `captions` | `list<AdAssetFeedSpecCaption>` | « Ad caption asset spec in asset feed spec » |
| `asset_customization_rules` | `list<…AssetCustomizationRule>` | « Target rules spec in asset feed spec » |
| `groups` | `list<AdAssetFeedSpecGroupRule>` | « Groups spec in asset feed spec » |
| `optimization_type` | `enum` | valeurs : `ASSET_CUSTOMIZATION`, `LANGUAGE`, `PLACEMENT`, `REGULAR`, `FORMAT_AUTOMATION` |
| `additional_data` | `AdAssetFeedAdditionalData` | « Additional data for the asset feed » |

Et le contenu de chaque asset :

- `AdAssetFeedSpecImage` (S12) : `hash` (« Hash of the image used for your
  ad »), **`url`** (« URL of the image used for your ad »), `image_crops`,
  `url_tags`, `adlabels`.
- `AdAssetFeedSpecVideo` (S16) : `video_id` (« Id of the video used for your
  ad »), `thumbnail_url` (« Thumbnail url for the video used for your ad »),
  `thumbnail_hash`, `caption_ids`, `url_tags`, `adlabels`.
- `AdAssetFeedSpecBody` (S13) : **`text`** (« Text used as body for your ad »),
  `url_tags`, `adlabels`.
- `AdAssetFeedSpecTitle` (S14) : **`text`** (« Text of the title used for your
  ad »), `url_tags`, `adlabels`.
- `AdAssetFeedSpecDescription` (S15) : **`text`** (« Text of the description
  used for your ad »), `url_tags`, `adlabels`.

**Plafonds par annonce** (S18, mot pour mot) : « Total number of images: <= 10.
Total number of videos: <= 10 », « Total number of bodies: <= 5 », « Total
number of titles: <= 5 ». Pour `CAROUSEL_IMAGE`, « you must provide at least 2
images ».

**Un fait important pour la clé de la table** : aucun de ces cinq types d'asset
ne porte un champ `id` dans sa page de référence (S12 à S16). L'`id` d'un asset
n'apparaît que dans les **ventilations d'insights** (`body_asset: {text, id}`,
`image_asset: {hash, url, id}` — S17, exemples cités au point 2). Autrement
dit : lire le CONTENU via `asset_feed_spec` ne donne pas d'identifiant stable,
seulement une position dans une liste. C'est exactement la distinction que la
carte a déjà posée — « Lire le texte d'un asset ≠ mesurer un asset » — et elle
a une conséquence de schéma : la clé d'un asset est son **rang** dans la liste,
pas un `asset_id`, tant qu'on ne passe pas par la mesure (ticket 03).

Pour mémoire sur le ticket 03, puisque S17 le donne : les ventilations
existantes sont `body_asset`, `description_asset`, `image_asset`,
`title_asset`, `call_to_action_asset`, `link_url_asset`, `video_asset`,
`ad_format_asset`, avec la limite « For Dynamic Creative, we currently show
only creative-asset level breakdowns such as metrics by image, title, body,
video. »

### d) Le carrousel sans Dynamic Creative

Un carrousel classique n'utilise pas `asset_feed_spec` : ses cartes sont dans
`object_story_spec.link_data.child_attachments`, « A 2-5 element array of link
objects required for carousel ads » (S8). Il faut donc lire **les deux**
chemins pour couvrir « plusieurs assets sous une annonce ».

---

# 5 · Les URL d'image de Meta expirent-elles ?

## Ce que la doc dit, mot pour mot

- `AdImage.url` (S19) : « **A temporary URL** which the image can be retrieved
  at. **Do not use this URL in ad creative creation**. »
- `AdImage.permalink_url` (S19) : « **A permanent URL** of the image to use in
  story creatives. »
- `AdImage.url_128` (S19) : « **A temporary URL** pointing to a version of the
  image resized to fit within a 128x128 pixel box »
- `AdCreativeVideoData.image_url` (S9) : « URL of image to use as thumbnail.
  **You should not use image URLs returned from the FB CDN** »
- `Video.source` (S20) : « A URL to the raw, playable video file. » — **la doc
  ne dit pas** si elle expire.
- `Video.picture` (S20) : « The URL for the thumbnail picture of the video. » —
  **la doc ne dit pas** si elle expire.
- `AdCreative.image_url` (S6), `AdCreative.thumbnail_url` (S6),
  `AdAssetFeedSpecImage.url` (S12), `AdAssetFeedSpecVideo.thumbnail_url` (S16),
  `AdCreativeLinkData.picture` (S8) : **aucune de ces pages ne dit si l'URL
  expire.**

## La conclusion, et sa part d'inconnu

La doc établit **explicitement** que les URL du côté `AdImage` sont
temporaires, et qu'un seul champ est permanent : `permalink_url`. Elle
**n'établit pas** la durée de vie des URL rendues par une créa ou par un asset
feed — elle dit seulement, pour la vignette vidéo, de ne pas réutiliser une URL
venant du CDN Facebook (S9).

Donc : **oui, il faut téléverser dans Supabase Storage**, et la raison n'est
pas une supposition. Elle tient en trois points, dont deux sont sourcés :

1. La doc qualifie de « temporary » toute URL d'image du côté `AdImage` et
   n'offre qu'un seul champ « permanent » (S19).
2. La doc dit de ne pas se servir des URL du CDN Facebook pour une vignette
   (S9).
3. Le précédent maison : `_dans_le_stockage` dans
   `saas/collecte/meta/fetch_instagram.py` écrit « Une URL de CDN Instagram
   expire au bout de quelques jours — c'est la raison d'être de
   `_upload_image_to_storage`. » C'est une mesure du dépôt, pas une lecture de
   la doc, et c'est le même CDN.

**Le chemin le moins coûteux et le plus sourcé** : ne pas enregistrer l'URL
rendue par la créa, mais **enregistrer le `image_hash`**, puis résoudre les
hashes en `permalink_url` par un seul appel :

```
GET /act_<AD_ACCOUNT_ID>/adimages
    ?hashes=["<hash1>","<hash2>",…]
    &fields=hash,permalink_url,url,width,height,name
```

S23 confirme le paramètre de lecture `hashes` (`list<string>`, « Hash of the
image. »), un appel pour plusieurs hashes, réponse `{data:[AdImage], paging:{},
summary:{total_count}}`.

Deux façons de faire, à trancher par David :

- **A — stocker `permalink_url`** : un appel `adimages` par passage, aucun
  téléchargement, aucun envoi de fichier, aucun octet chez nous. Le lien est
  « permanent » selon S19. Mais il reste servi par Meta : si le client supprime
  l'image de sa bibliothèque, l'historique de Pulse perd son visuel.
- **B — téléverser chez nous**, comme Instagram le fait déjà : un
  téléchargement + un envoi par image **nouvelle** seulement (le garde-fou
  `_dans_le_stockage` existe déjà et évite de refaire le trajet). Coûteux une
  fois, définitif ensuite, et c'est le seul montage qui survit à la suppression
  côté client.

Recommandation de la recherche : **B pour l'image affichée**, et garder
`image_hash` en base de toute façon — c'est la seule clé stable, `url` et
`permalink_url` ne le sont pas. Un bucket séparé, `ad-creatives`, plutôt que le
`post-images` d'Instagram : les deux récoltes n'ont ni la même clé de fichier
ni le même cycle de vie.

Pour la **vidéo** : `Video.source` est « A URL to the raw, playable video file »
(S20) — on ne téléverse pas une vidéo, on affiche la **vignette**
(`thumbnail_url` de l'asset, ou `picture` de la vidéo), qui suit le même
traitement que l'image.

---

# 6 · Combien d'appels en plus, et où sont les limites

## Les quotas, mot pour mot (S24)

- **Ads Insights**, accès standard : « Calls within one hour = 600 + 400 *
  Number of Active ads - 0.001 * User Errors ». Accès avancé : « 190000 + 400 *
  … ».
- **Ads Management**, accès standard : « Calls within one hour = 300 + 40 *
  Number of Active ads ». Accès avancé : « 100000 + 40 * … ».
- Les applications sont par défaut en `development_access` ; l'accès avancé à
  « Ads Management standard access » passe par l'app review et donne
  `standard_access` (S24).
- En-tête `X-Business-Use-Case-Usage` : `call_count`, `total_cputime`,
  `total_time`, `estimated_time_to_regain_access` (« minutes until throttling
  lifts »), `ads_api_access_tier` (S24).
- Côté Insights, S3 donne aussi `app_id_util_pct` (« The percentage of
  allocated capacity for the associated app_id has consumed ») et
  `acc_id_util_pct` (« … for the associated ad account_id … »).
- Pour mémoire, la formule Instagram que le code cite déjà : « Calls within 24
  hours = 4800 * Number of Impressions » (S24).

**Point à trancher côté projet** : la lecture des créas est de l'**Ads
Management**, pas de l'Ads Insights — donc elle tape dans le plafond le plus
bas des deux. Pour un compte à **20 pubs actives** en accès standard, ça fait
**300 + 40 × 20 = 1 100 appels par heure**. Je ne sais pas dans quel tier est
l'app de Pulse : ça ne se lit pas dans la doc (voir « Pas encore établi »).

## Le décompte, sur le modèle de `fetch_instagram.py`

Un post Instagram relu = 3 appels Graph. **Voici le même calcul pour les
annonces.**

### Les conversions : ZÉRO appel de plus

`actions`, `action_values`, `conversions`, `cost_per_action_type`,
`cost_per_conversion`, `attribution_setting` sont des **champs** de la requête
`/insights` que `_meta_chunk` envoie déjà. Les ajouter à la chaîne `fields`
n'ajoute **aucun appel** — exactement ce que la note « CE QUE ÇA COÛTE » de
`fetch_all.py` avait anticipé pour le recouvrement.

Ce qui grossit, c'est la **réponse** : chaque ligne porte jusqu'à cinq tableaux
au lieu d'un. S3 prévient : « Use `batch requests` for multiple sync calls and
async to query for large volume of data to avoid timeouts. Try sync calls first
and then use async calls in cases where sync calls timeout ». Le `timeout=60`
actuel de `_meta_chunk` est donc le vrai risque, pas le quota. Si une tranche
de 90 jours commence à expirer, le contrat `(lignes, erreur)` de `_meta_chunk`
le dira déjà — c'est le filet qui existe.

### Les créas : 1 appel par page d'annonces, pas 1 par annonce

Une créa **ne change pas d'un jour à l'autre** : elle se relit par annonce, pas
par annonce × jour. Pour un compte à **20 pubs actives**, une par passage
hebdomadaire :

| Étape | Appels | Source |
|---|---|---|
| `GET /act_<id>/ads?fields=…creative{…}&limit=200` | **1** (1 page pour 20 pubs) | S25, expansion de champs |
| `GET /act_<id>/adimages?hashes=[…]&fields=hash,permalink_url` | **1** (un appel pour tous les hashes) | S23 |
| `GET /{video-id}?fields=source,picture` par vidéo distincte | **n** (0 si le compte n'a pas de vidéo) | S20 |
| téléchargement d'image **nouvelle** | 1 par image nouvelle, 0 ensuite | `_dans_le_stockage` |
| envoi Supabase Storage | 1 par image nouvelle, 0 ensuite | `_upload_image_to_storage` |

**Pire cas plausible, 20 pubs / 20 images distinctes / 5 vidéos :**

- **Premier passage** : 1 + 1 + 5 = **7 appels Graph**, plus 20 téléchargements
  et 20 envois Supabase.
- **Passages suivants** : **7 appels Graph**, 0 téléchargement, 0 envoi — les
  images sont déjà en stockage.
- **Si l'expansion de champs ne passe pas** sur `creative` (la réserve de S25),
  le repli coûte 1 appel par annonce : 20 + 1 + 5 = **26 appels Graph**.

**Face au quota** : 26 appels contre 1 100/heure en accès standard pour 20 pubs
actives, soit **2,4 %**. Ce n'est pas un mur. Mais le calcul se refait pour un
compte d'agence : 200 pubs actives → plafond 300 + 40 × 200 = 8 300/h, et le
repli sans expansion coûte 200 + 1 + n appels, soit ~2,5 % encore. Le coût
croît **linéairement** avec le nombre de pubs dans le repli, et **pas du tout**
avec l'expansion — c'est ce qui décide s'il faut la vérifier avec un jeton
avant de construire.

**Le vrai poste cher reste le stockage des images**, comme sur Instagram : il
faut reprendre le garde-fou `_dans_le_stockage` tel quel, sinon 20 allers-retours
de fichier reviennent à chaque passage.

**Plafonds de pagination à poser** : le même piège que
`_ACTIVITES_PAGES_MAX` / `_MEDIA_PAGES_MAX` existe ici — le Graph API sait
rendre un `paging.next` sur une page vide. Toute nouvelle boucle sur
`/act_<id>/ads` doit porter son plafond de pages et s'arrêter sur un lot vide.

---

# 7 · Les colonnes à ajouter — conclusion

La conclusion est **une table nouvelle pour les conversions, deux pour les
créas, et trois colonnes seulement sur `meta_ads_insights`**. Voici pourquoi,
puis le SQL.

## Pourquoi PAS des colonnes de conversion sur `meta_ads_insights`

`meta_ads_insights` est « une ligne par annonce × jour » avec unicité
`(user_id, date_start, ad_id)`. Y ajouter `conversions numeric` obligerait à
choisir **maintenant** quel `action_type` compte, et à l'écrire dans le code de
récolte. Trois conséquences, toutes mauvaises :

1. **La décision se fige dans la donnée récoltée.** Changer d'avis
   obligerait à rejouer 37 mois d'historique. Avec une table par type d'action,
   le choix se fait **à la lecture** et se change en une requête.
2. **Un client avec une conversion personnalisée
   (`offsite_conversion.custom.<id>`) aurait `NULL` pour toujours** — et on ne
   saurait pas la nommer, puisque son identifiant est propre au compte.
3. **Le tableau `actions` est hiérarchique** (S4). Une colonne unique invite à
   sommer, et sommer double-compte. Une table qui garde le `action_type` rend le
   double comptage visible.

À l'inverse, une table par `(annonce, jour, type d'action)` respecte la règle
la plus dure du projet sans effort : **un type d'action absent est une ligne
absente**, jamais un `0`.

## Le SQL proposé

⚠ Rien de destructeur : trois `CREATE TABLE IF NOT EXISTS` et trois
`ADD COLUMN IF NOT EXISTS`. Aucun `DROP`, aucun `DELETE`, aucune contrainte
déplacée. À jouer par David, comme le veut la carte.

### a) Trois colonnes sur `meta_ads_insights`

```sql
ALTER TABLE public.meta_ads_insights
    ADD COLUMN IF NOT EXISTS date_stop           date,
    ADD COLUMN IF NOT EXISTS attribution_setting text,
    ADD COLUMN IF NOT EXISTS inline_link_clicks  integer;
```

- `date_stop` : Meta le rend déjà dans chaque ligne (S5) et on le jette. Avec
  `time_increment=1` il égale `date_start`, mais le jour où une lecture change
  de granularité, l'absence de cette colonne rend la ligne ambiguë.
- `attribution_setting` : **la colonne qui rend le point 3 vérifiable.** Sans
  elle, le recouvrement de 7 jours est un pari sur la fenêtre du client ; avec
  elle, on peut mesurer combien de comptes sont réglés plus large que
  `7d_click/1d_view` et décider sur un fait. `text`, nullable — un compte qui ne
  le rend pas ne doit pas lire « 7 jours » par défaut.
- `inline_link_clicks` : le seul compte de clics sur lien dont la doc donne la
  fenêtre (« a fixed 1-day-click attribution window », S1), donc le seul
  insensible au réglage du client. À garder **à côté** de `link_clicks`, pas à
  la place : ce ne sont pas les mêmes chiffres et celui du client dans Ads
  Manager est l'un des deux.

**Ce que je recommande de NE PAS ajouter**, et pourquoi : `ctr`, `cpc`, `cpm`,
`cpp`, `frequency`, `actions_per_impression`. Tous se recalculent exactement
depuis `impressions`, `clicks`, `spend`, `reach` qui sont déjà en base. Les
stocker crée deux sources de vérité pour un même nombre, et la première
divergence est invisible. `objective` n'est pas ajouté non plus : la carte a
décidé qu'on ne filtre pas sur l'objectif déclaré, et l'ajouter maintenant
inviterait à le faire.

### b) `meta_ads_actions` — les conversions, sans trancher

```sql
-- POURQUOI UNE TABLE ET PAS DES COLONNES : /insights rend `actions`,
-- `action_values` et `cost_per_action_type` comme des LISTES de types d'action
-- (list<AdsActionStats>), jamais comme un nombre. Le type qui compte comme
-- « la » conversion dépend du pixel du client, et une conversion personnalisée
-- s'appelle offsite_conversion.custom.<id> — un identifiant propre au compte,
-- impossible à mettre en nom de colonne.
-- Réf. https://developers.facebook.com/docs/marketing-api/reference/ad-account/insights/
--      https://developers.facebook.com/docs/marketing-api/reference/ads-action-stats/
--
-- ⚠ NE JAMAIS SOMMER SUR action_type. Les types s'emboîtent : un link_click est
-- déjà compté dans post_engagement, lui-même dans page_engagement.
-- Réf. https://developers.facebook.com/docs/marketing-api/insights/breakdowns/
CREATE TABLE IF NOT EXISTS public.meta_ads_actions (
    user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date_start   date NOT NULL,
    ad_id        text NOT NULL,
    action_type  text NOT NULL,
    -- `actions[].value` — un COMPTE. numeric et pas integer : la doc donne
    -- « numeric string », et les valeurs modélisées de Meta ne sont pas entières.
    actions      numeric(14, 4),
    -- `action_values[].value` — de l'ARGENT, dans la devise du compte. Pas de
    -- division par 100 ici : contrairement aux budgets de campagne, /insights
    -- rend `spend` en unités (voir `_centimes` — le piège est ailleurs).
    action_value numeric(14, 4),
    -- `cost_per_action_type[].value`
    cost_per_action numeric(14, 4),
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT meta_ads_actions_uq
        UNIQUE (user_id, date_start, ad_id, action_type)
);

CREATE INDEX IF NOT EXISTS idx_meta_ads_actions_user_date
    ON public.meta_ads_actions (user_id, date_start DESC);
CREATE INDEX IF NOT EXISTS idx_meta_ads_actions_type
    ON public.meta_ads_actions (user_id, action_type, date_start DESC);
```

La clé d'unicité reprend celle de `meta_ads_insights` plus `action_type`, donc
le **même** recouvrement réécrit les mêmes lignes, sans doublon. Les trois
colonnes de valeur sont **nullables** : un type présent dans `actions` peut être
absent de `cost_per_action_type`, et ça ne vaut pas 0.

`purchase_roas` et `website_purchase_roas` ne sont pas stockés : ils se
recalculent depuis `action_value / spend`. Si David veut le chiffre de Meta
plutôt que le nôtre, ils entreront comme deux `action_type` de plus dans cette
même table — c'est un avantage de la forme.

### c) `meta_ads_creatives` — le contenu, une ligne par annonce

```sql
-- POURQUOI PAS DANS meta_ads_insights : cette table est une ligne par annonce
-- × JOUR. Le texte d'une annonce ne change pas d'un jour à l'autre ; l'y mettre
-- le recopierait sur chaque journée et ferait d'un changement de texte une
-- réécriture de tout l'historique.
CREATE TABLE IF NOT EXISTS public.meta_ads_creatives (
    user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ad_id          text NOT NULL,
    creative_id    text,
    creative_name  text,
    -- Lequel des trois montages a répondu : 'flat' | 'object_story' |
    -- 'asset_feed'. Sans lui, un champ vide et un montage absent se confondent.
    -- Réf. https://developers.facebook.com/docs/marketing-api/creative/ :
    -- « readable fields are the same as those specified when you created the
    -- object, plus id » — une créa bâtie sur object_story_spec ne rend PAS
    -- title/body/image_url au niveau racine.
    montage        text,
    object_type    text,
    -- link_data.name / video_data.title / creative.title
    titre          text,
    -- link_data.message / video_data.message / creative.body
    texte          text,
    -- link_data.description / video_data.link_description / photo_data.caption
    description    text,
    lien_url       text,
    call_to_action text,
    -- La SEULE clé stable d'une image chez Meta. `url` et `permalink_url` ne le
    -- sont pas : AdImage.url est « a temporary URL », permalink_url est « a
    -- permanent URL » mais reste servi par Meta.
    -- Réf. https://developers.facebook.com/docs/marketing-api/reference/ad-image/
    image_hash     text,
    -- URL Supabase Storage (bucket ad-creatives), écrite par un
    -- _upload_image_to_storage calqué sur fetch_instagram.py. Une URL de CDN
    -- Meta ne s'écrit ici qu'en cas d'échec d'envoi, et le repérage
    -- « est-ce déjà chez nous » se fait comme _dans_le_stockage.
    image_url      text,
    video_id       text,
    vignette_url   text,
    recolte_le     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT meta_ads_creatives_uq UNIQUE (user_id, ad_id)
);
```

### d) `meta_ads_creative_assets` — plusieurs assets sous une annonce

```sql
-- Couvre les DEUX montages multi-assets :
--  · asset_feed_spec (Dynamic Creative) — images/videos/bodies/titles/
--    descriptions, plafonnés à 10 images, 10 vidéos, 5 textes, 5 titres.
--    Réf. https://developers.facebook.com/docs/marketing-api/dynamic-creative/asset-feed-spec/
--  · object_story_spec.link_data.child_attachments — le carrousel classique,
--    « A 2-5 element array of link objects required for carousel ads ».
--    Réf. https://developers.facebook.com/docs/marketing-api/reference/ad-creative-link-data/
--
-- LA CLÉ EST LE RANG, PAS UN asset_id. Aucune des pages de référence des
-- assets (AdAssetFeedSpecImage/Video/Body/Title/Description) ne documente un
-- champ `id` : l'identifiant d'un asset n'apparaît que dans les ventilations
-- d'INSIGHTS (body_asset:{text,id}, image_asset:{hash,url,id}), qui sont de la
-- MESURE — ticket 03, pas ici. Stocker un asset_id qu'on n'a pas serait un
-- chiffre fabriqué.
CREATE TABLE IF NOT EXISTS public.meta_ads_creative_assets (
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ad_id       text NOT NULL,
    -- 'image' | 'video' | 'body' | 'title' | 'description' | 'link_url'
    -- | 'call_to_action' | 'carousel_card'
    asset_kind  text NOT NULL,
    -- Position dans la liste rendue par Meta, 0-based. Le seul identifiant
    -- qu'on ait — voir le commentaire ci-dessus.
    rang        integer NOT NULL,
    -- 'asset_feed' | 'child_attachment' : deux montages, deux significations
    -- du rang. Les confondre mélangerait un variant A/B et une carte de
    -- carrousel, qui ne veulent pas dire la même chose.
    provenance  text NOT NULL,
    texte       text,
    image_hash  text,
    image_url   text,
    video_id    text,
    vignette_url text,
    lien_url    text,
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT meta_ads_creative_assets_uq
        UNIQUE (user_id, ad_id, provenance, asset_kind, rang)
);
```

Chaque table prend les quatre politiques RLS `*_own` sur `auth.uid() = user_id`
et le déclencheur `set_updated_at`, sur le patron exact de
`meta_ads_insights` dans `000_run_me_all.sql`.

## Les champs à ajouter à la requête `/insights`

Dans `_meta_chunk` (`saas/collecte/automatisation/fetch_all.py:362`), la chaîne
`fields` passe de

```
campaign_name,adset_name,ad_name,ad_id,impressions,clicks,reach,spend,actions,date_start
```

à

```
campaign_name,adset_name,ad_name,ad_id,impressions,clicks,reach,spend,
actions,action_values,cost_per_action_type,conversions,cost_per_conversion,
inline_link_clicks,attribution_setting,date_start,date_stop
```

`conversions` et `cost_per_conversion` sont demandés **en plus** de
`actions`/`cost_per_action_type`, pas à leur place : ils portent la lecture
« selon l'objectif » (S1) que les autres n'ont pas, et ils coûtent zéro appel.
Les deux se rangent dans la même table, distingués par leur provenance — ce
qui demande une colonne `source text NOT NULL DEFAULT 'actions'` sur
`meta_ads_actions` si David veut garder les deux familles séparées. **À
trancher avec lui** : c'est la seule question de schéma que cette recherche ne
peut pas fermer sans sa décision sur le point 2.

---

# Pas encore établi

Ce que je n'ai pas pu établir sur des sources primaires. Aucune de ces lignes
n'est un comportement deviné : ce sont des trous.

1. **Aucun exemple de réponse `/insights` avec un tableau `actions` n'existe sur
   `developers.facebook.com`** — vérifié sur huit pages, dont trois versions
   archivées. La forme donnée au point 2 est **déduite** des types `AdsActionStats`
   et `list<AdsActionStats>`, pas copiée. Un seul appel réel avec un jeton la
   confirmerait ou la corrigerait ; ce n'était pas le mandat de ce ticket.
2. **`AdsInsightsResult`** : la page de référence est introuvable (404 sur
   `.../reference/ads-insights-result/`). Je ne sais donc pas ce que portent
   `result_rate`, `objective_result_rate` et `cost_per_objective_result`, qui
   sont peut-être la réponse la plus propre à « la conversion d'un client qui ne
   configure rien ». À rouvrir si le point 2 reste bloqué.
3. **`cost_per_conversion` n'a aucune description dans la doc.** Qu'il soit le
   pendant coût de `conversions` est vraisemblable et non écrit.
4. **La fenêtre d'attribution par défaut d'un ad set neuf.** S27 dit seulement
   « Supported window lengths differ by optimization goal and campaign
   objective » et ne donne ni tableau des combinaisons ni valeur par défaut ni
   maximum. Le `default` de l'API (`["7d_click","1d_view"]`, S1) est le défaut
   du **paramètre de requête**, et depuis juin 2025 ce paramètre est supplanté
   par le réglage de l'ad set (S3) — donc on ne peut pas en déduire la fenêtre
   réellement appliquée. C'est précisément ce que la colonne
   `attribution_setting` permettra de mesurer au lieu de le supposer.
5. **Quelle part des changements d'insights survient après le 7e jour.** La doc
   borne le mouvement à 28 jours (S3) mais ne donne aucune distribution. Passer
   `_RECOUVREMENT_JOURS_META` de 7 à 28 se justifie par la borne, pas par une
   mesure de gain.
6. **Le tier d'accès de l'application Pulse** (`development_access` /
   `standard_access` / advanced). Il décide du plafond horaire et ne se lit pas
   dans la doc ; il se lit dans l'en-tête `ads_api_access_tier` d'une réponse
   réelle (S24), ou dans le tableau de bord de l'app. Les chiffres du point 6
   supposent **standard**, et le disent.
7. **La formule de quota du tier `development_access`** : S24 donne les formules
   standard et avancée, je n'ai pas relevé celle du tier de développement.
8. **Si l'expansion de champs marche sur `creative`.** S25 prévient que « most
   of Marketing API » ne la supporte pas sur certaines connexions. `creative`
   est un champ, pas une connexion, mais rien ne le garantit nommément. C'est
   l'écart entre 7 et 26 appels par passage : à vérifier avec un jeton avant de
   construire.
9. **La durée de vie exacte des URL rendues par `AdCreative.image_url`,
   `AdCreative.thumbnail_url`, `AdAssetFeedSpecImage.url`,
   `AdAssetFeedSpecVideo.thumbnail_url`, `Video.source`, `Video.picture`.** La
   doc ne le dit pour aucun de ces champs. Seul `AdImage.url` est qualifié de
   « temporary » et seul `AdImage.permalink_url` de « permanent » (S19).
10. **La taille maximale de page (`limit`) sur `/act_<id>/ads`.** Même situation
    que celle documentée dans `fetch_instagram.py` pour `/media` : non
    fermement documentée. Une boucle qui s'arrête sur l'absence de `next` (et
    sur un lot vide) est sans risque ; un `limit` supposé ne l'est pas.
11. **`_lots_par_date` et le volume d'écriture.** `upsert_meta_ads` envoie tout
    en un appel PostgREST, et la note « profondeur d'historique » de
    `fetch_all.py` prévient déjà que 22 500 lignes n'ont jamais été essayées.
    `meta_ads_actions` **multiplie les lignes par le nombre de types d'action**
    — trois à dix fois plus que `meta_ads_insights`. Le plafond de 1 000 lignes
    de PostgREST (`CLAUDE.md` §8) devient une contrainte de conception, pas une
    note de bas de page. Ce n'est pas un trou de doc, c'est un point de
    construction à ne pas oublier.

# Un ticket à ouvrir, trouvé en chemin

`saas/collecte/automatisation/fetch_all.py:887` — `row["link_clicks"] =
int(lc.get("value", 0)) if lc else 0`. Un `link_click` absent du tableau
`actions` devient **0** alors que la colonne est nullable. C'est « une absence
de donnée n'est pas un zéro » (`CLAUDE.md` §7) sur une colonne déjà en
production, et c'est le patron qu'il ne faut surtout pas recopier pour les
conversions.
