# Meta Marketing API — `GET /act_<id>/activities` (Ad Activity)

Recherche du 2026-10-10. Trois niveaux de preuve, toujours séparés :
- **[META]** documenté par Meta (doc développeur ou SDK officiel généré par Meta) ;
- **[OBSERVÉ]** vu dans des réponses réelles publiées par des tiers (fixtures, enregistrements) ;
- **[TIERS-CODE]** supposé par du code tiers sans réponse réelle à l'appui (fiabilité faible) ;
- **non documenté** : rien de primaire trouvé.

Sources principales :
- S1 Doc Ad Activity : https://developers.facebook.com/docs/marketing-api/reference/ad-activity/
- S2 Doc edge : https://developers.facebook.com/docs/marketing-api/reference/ad-account/activities/
- S3 SDK Python, objet : https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adactivity.py
- S4 SDK Python, `AdAccount.get_activities` : https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adaccount.py (l. ~397)
- S5 Spec codegen Meta : https://github.com/facebook/facebook-business-sdk-codegen/blob/main/api_specs/specs/AdActivity.json
- O1 Fixture de réponses réelles (« Real Graph API responses … read on 2026-09-27 and trimmed ») : https://github.com/olera-care/olera-web/blob/main/scripts/fixtures/meta-hoop-2026-09-27.json
- O2 Enregistrement réel Airbyte (tests d'intégration du connecteur, compte Airbyte) : https://github.com/dinhphuc-dan/airbyte-custom/blob/main/airbyte-integrations/connectors/source-facebook-marketing/integration_tests/expected_records.jsonl (fork de airbytehq/airbyte)
- O3 coddi-changelog (outil en prod sur un compte réel, tests écrits « Values are the literal strings Meta returns ») : https://github.com/MohannadAshraf/coddi-changelog (src/transform.js, test/transform.test.js, README.md)
- O4 mgs-agent (tests) : https://github.com/mattei2005/mgs-agent/blob/main/tests/test_ares_meta_account_activity_monitor.py
- O5 xyla-io/almacen : https://github.com/xyla-io/almacen/blob/master/fetching/fetch_facebook.py
- T1 One-Scale (code spéculatif) : https://github.com/meowliker/One-Scale/blob/main/src/app/api/meta/activities/route.ts
- T2 OmniAds : https://github.com/emrahbilaloglu-ui/OmniAds/blob/main/lib/meta/activity-history.ts

---

## 1 · Champs d'un Ad Activity

**[META]** S1 + S3 + S5. Les 13 champs :

| Champ | Type (S3/S5) | Description Meta (S1) |
|---|---|---|
| `actor_id` | string (numérique) | Actor ID |
| `actor_name` | string | Actor Name |
| `application_id` | string | Application ID |
| `application_name` | string | Application Name |
| `date_time_in_timezone` | string | « Date/Time string in account timezone » |
| `event_time` | datetime | Timestamp — **champ par défaut** |
| `event_type` | enum `AdActivity_event_type` | **champ par défaut** |
| `extra_data` | string | « JSON encoded extra information » |
| `object_id` | string (numérique) | Object ID |
| `object_name` | string | Object Name |
| `object_type` | string | « Object Type » — **aucune énumération documentée** |
| `tool` | string | présent dans S3/S5, **absent de S1**, non décrit |
| `translated_event_type` | string | « Translated event type » |

Tous les champs demandés sont **confirmés** : `object_type`, `object_id`, `object_name`, `date_time_in_timezone`, `translated_event_type`, `event_type`, `extra_data`, `actor_id`, `actor_name`. Seuls `event_time` et `event_type` sont renvoyés par défaut (S1) — les autres doivent être demandés dans `fields`.

**Pas de champ `category`** sur l'objet (S1). Un MCP tiers liste un champ `changed_data` (https://github.com/hashcott/meta-ads-mcp-server/blob/main/src/tools/activities.ts) : **absent de S1/S3/S5**, à considérer comme inexistant.

### Valeurs de `object_type`
- **[META]** non documenté (simple string, pas d'enum dans S1, S3, S5).
- **[OBSERVÉ]** O2 : un événement `update_ad_set_target_spec` (traduit « Ad set targeting updated ») porte `"object_type":"CAMPAIGN"`. **Piège** : dans le vocabulaire interne historique de Meta, « campaign » = ensemble de publicités (et « campaign group » = campagne ; cf. les codes `create_campaign_group`, `update_campaign_group_spend_cap`). Ne **pas** déduire le niveau de l'objet de `object_type` sans vérification ; l'`event_type` (`update_ad_set_*`, `update_campaign_*`, `update_ad_*`) est plus sûr.
- **[TIERS-CODE]** hashcott/meta-ads-mcp-server annonce « AD, ADSET, CAMPAIGN, ACCOUNT, IMAGE, REPORT, etc. » — sans source.
- Conclusion : liste exhaustive **non documentée** ; seule `CAMPAIGN` est observée dans une réponse réelle, et pour un ensemble de publicités.

### `translated_event_type`
**[OBSERVÉ]** Libellé localisé dans la langue du jeton/utilisateur : « Campaign status updated », « Campaign budget updated », « Ad status updated », « Ad created », « Ad set targeting updated », « Campaign created » (O1). O3 note que la casse n'est pas stable (« …finishes ad review » vs « …finishes Ad Review ») et recommande de matcher sur `event_type`.

### `date_time_in_timezone`
**[OBSERVÉ]** O2 : `"date_time_in_timezone":"03/21/2023 at 2:20 PM"` pour `"event_time":"2023-03-21T21:20:39+0000"` — chaîne d'affichage, pas un format ISO ; préférer `event_time`.

---

## 2 · Paramètres de l'edge

**[META, doc]** S2 dit textuellement : « This endpoint doesn't have any parameters. » — la doc publique est donc **muette**.

**[META, SDK]** Le SDK officiel (S4, généré depuis la spec interne de Meta) déclare ces paramètres pour `AdAccount.get_activities` :

```python
param_types = {
    'add_children': 'bool',
    'after': 'string',
    'business_id': 'string',
    'category': 'category_enum',
    'data_source': 'data_source_enum',
    'extra_oids': 'list<string>',
    'limit': 'int',
    'oid': 'string',
    'since': 'datetime',
    'uid': 'int',
    'until': 'datetime',
}
```

- `category` — enum `AdActivity.Category` (S3) : `ACCOUNT, AD, AD_KEYWORDS, AD_SET, AUDIENCE, BID, BUDGET, CAMPAIGN, DATE, STATUS, TARGETING`. **Confirmé**. Correspondance catégorie → event_types : la doc S1 regroupe les `event_type` sous ces mêmes titres (voir § 2 bis).
- `data_source` — enum `CALYPSO, TAO, TAO_AD_ACCOUNT, TAO_AD_STATUS` (S3). Sémantique **non documentée**.
- `oid` — string. Sémantique **non documentée** (le nom suggère « object id » : filtrer sur un objet ; `extra_oids` : objets supplémentaires ; `add_children` : inclure les enfants). Non vérifié.
- `uid` — int ; un MCP tiers le décrit comme filtre sur l'acteur (https://github.com/serkanhaslak/meta-mcp/blob/main/src/tools/activities.ts) — **[TIERS-CODE]**.
- `since` / `until` — type `datetime` dans le SDK. Sémantique (inclusif/exclusif, fuseau) **non documentée** par Meta. **[OBSERVÉ]** les intégrations en prod passent des timestamps Unix en secondes (O3 `since: String(since)` en secondes ; T1 `Math.floor(... / 1000)`) ; d'autres passent `YYYY-MM-DD` (hashcott). Le filtre porte vraisemblablement sur `event_time`, non vérifié.
- Pagination : `limit` + `after` (curseur) ; réponse `{data:[...], paging:{...}}` (S2).

### 2 bis · Regroupement documenté des event_types (S1)
- STATUS : ad_account_update_status, update_ad_run_status, update_ad_run_status_to_be_set_after_review, update_ad_set_run_status, update_campaign_run_status
- TARGETING : update_ad_set_target_spec, update_ad_targets_spec
- BID : update_ad_bid_info, update_ad_bid_type, update_ad_set_bidding, update_ad_set_bid_strategy, update_ad_set_bid_adjustments
- BUDGET : (facturation compte…), update_ad_set_budget, update_campaign_budget, update_campaign_group_spend_cap
- AD : ad_review_approved, ad_review_declined, create_ad, update_ad_creative, update_ad_friendly_name, update_ad_run_status, update_ad_run_status_to_be_set_after_review
- AD_SET : create_ad_set, update_ad_set_bidding, update_ad_set_bid_strategy, update_ad_set_budget, update_ad_set_duration, update_ad_set_name, update_ad_set_run_status, update_ad_set_target_spec, update_ad_set_ad_keywords
- CAMPAIGN : create_campaign_legacy, create_campaign_group, update_campaign_duration, update_campaign_name, update_campaign_run_status
- DATE : update_campaign_duration, update_ad_set_duration
- Beaucoup d'event_types de l'enum (ex. `update_ad_set_optimization_goal`, `edit_and_update_ad_creative`, `update_campaign_budget_split`, `first_delivery_event`, `campaign_ended`…) ne sont rangés sous **aucune** catégorie dans S1 — un filtre `category=` les exclurait probablement (non vérifié).

---

## 3 · Forme de `extra_data`

**[META]** Seulement : « JSON encoded extra information » (S1). **Aucun schéma documenté**, pour aucun event_type.

Tout ce qui suit est **[OBSERVÉ]** dans des réponses réelles, sauf mention.

### Enveloppe commune
`{"old_value": …, "new_value": …, "type": "<discriminant>"}` — le champ `type` (string) indique la forme des valeurs. Discriminants observés : `run_status`, `composite_data`, `targets_spec`.
Optionnel : `rule_info` quand le changement vient d'une règle automatisée — O3 : `extra.rule_info = { rule_name, rule_latest_name }` ; O4 : `'rule_info': {'id': 'r1'}` (fixture).

### Statuts : `update_ad_run_status`, `update_ad_set_run_status`, `update_campaign_run_status`
**Texte, libellés d'affichage — pas des codes API (`PAUSED`/`ACTIVE`), pas des numériques.** Verbatim O1 :

```
"{\"old_value\":\"Pending process\",\"new_value\":\"Active\",\"type\":\"run_status\"}"
"{\"old_value\":\"Active\",\"new_value\":\"Pending process\",\"type\":\"run_status\"}"
"{\"old_value\":\"Pending Review\",\"new_value\":\"Inactive\",\"type\":\"run_status\"}"   (actor_name: "Meta")
"{\"old_value\":\"Pending process\",\"new_value\":\"Inactive\",\"type\":\"run_status\"}"
```

- Valeurs observées : `Active`, `Inactive` (= mis en pause), `Pending process`, `Pending Review`. Casse instable (« Pending process » O1 vs « Pending Process » O3).
- O3 (README) : une mise en pause produit **plusieurs** événements bruts : « Active → Pending Process → Inactive », plus un doublon `update_ad_run_status_to_be_set_after_review` (`{"old_value":"Active","new_value":"Inactive"}`, sans `type`).
- O3 (README) : le journal est **incomplet** — « ad `120252068912490136` was paused on 2026-09-08 and the log contained no event for it in the following 30 days ».
- Ces libellés sont vraisemblablement **localisés** comme `translated_event_type` (non vérifié : aucune réponse non anglaise trouvée).
- **[TIERS-CODE]** T1 traite aussi `'PAUSED'`, `'ACTIVE'`, `'1'`, `'2'`, `'3'`, `'4'` — aucune réponse réelle ne montre ces formes ; à considérer comme spéculatif.

### Budgets : `update_campaign_budget`, `update_ad_set_budget` — `type: "composite_data"`
Verbatim O1 (`update_campaign_budget`, « Campaign budget updated ») :

```
"{\"old_value\":{\"type\":\"payment_amount\",\"currency\":\"USD\",\"old_value\":1000,\"additional_type\":\"status_string\",\"additional_value\":\"\"},\"new_value\":{\"type\":\"payment_amount\",\"currency\":\"USD\",\"new_value\":2000,\"additional_type\":\"status_string\",\"additional_value\":\"Per day\"},\"type\":\"composite_data\"}"
```

- Montant en **unité mineure** (centimes) et **numérique** : 1000 = 10,00 USD ; le `daily_budget` de la campagne dans la même fixture vaut `"2000"`. O3 confirme pour l'EGP (« Meta reports budgets in piastres »).
- Le montant est imbriqué : `old_value.old_value`, `new_value.new_value` (clé interne différente de chaque côté).
- `additional_value` : « Per day » (budget quotidien) ; probablement « Lifetime… » pour un budget total — **non observé**. Côté `old_value`, `additional_value` peut être vide.
- `create_campaign_group` (« Campaign created ») porte aussi un `composite_data` avec seulement `new_value` (O1).
- `update_ad_set_budget` : même forme selon O3/O4 (`{'type': 'payment_amount', 'currency': 'USD', 'old_value': 2500}`) — fixture de test, **pas** de réponse brute publiée.

### Ciblage : `update_ad_set_target_spec` — `type: "targets_spec"`
**Liste de lignes lisibles (libellés localisés), pas le `targeting` JSON de l'API.** Verbatim O2 (raccourci aux deux premières entrées) :

```
"{\"old_value\":[{\"content\":\"Custom audience:\",\"children\":[\"Web Traffic [ALL] - _copy\"]},{\"content\":\"Location:\",\"children\":[\"United States\"]}, …,{\"content\":\"Advantage custom audience:\",\"children\":[\"Off\"]}],\"new_value\":[ … {\"content\":\"Advantage custom audience:\",\"children\":[\"On\"]}],\"type\":\"targets_spec\"}"
```

Clés `content` observées : « Custom audience: », « Location: », « Age: », « Placements: », « Advantage custom audience: ». Les listes donnent l'état **complet** avant/après, pas un diff : il faut comparer soi-même. Création : `"old_value":[]` (O1).

### Création d'annonce : `create_ad`
Verbatim O1 : `"{\"campaign_id\":{\"mutation_input\":120251590364710487,\"new\":120251590364710487}}"` — pas d'enveloppe old/new/type ; `campaign_id` est ici l'**ID de l'ensemble de publicités** (encore le vocabulaire interne « campaign » = ad set).

### Enchères : `update_ad_set_bidding`, `update_ad_set_bid_strategy`, `update_ad_bid_info`
**Non documenté et non observé** : aucune réponse réelle trouvée. **[TIERS-CODE]** T1 suppose `old_value`/`new_value` numériques en centimes — sans preuve.

### Clés `"action": 67`, `"type": 4` numériques
**Non documenté, non observé** dans aucune source publique trouvée. Dans toutes les réponses réelles vues, `type` est une **chaîne** (`run_status`, `composite_data`, `targets_spec`, `payment_amount`, `status_string`). Un `type` numérique et un `action` numérique viennent donc d'une forme non répertoriée publiquement — leur sens est **inconnu** ; ne pas l'interpréter sans échantillon complémentaire (event_type associé, plusieurs occurrences).

---

## 4 · `update_ad_creative` : quelle partie a changé ?

- **[META]** non documenté. S1 décrit seulement l'event_type (« update ad creative ») ; il existe aussi `edit_and_update_ad_creative` dans l'enum, non décrit.
- **[OBSERVÉ, indirect]** O5 (outil de reporting en prod) lit `extra_data` de `update_ad_creative` ainsi :
  ```python
  creative_ids = creative_ids.union({d['old_value'][-1] for d in extra_data})
  creative_ids = creative_ids.union({d['new_value'][-1] for d in extra_data})
  ```
  → `old_value` / `new_value` sont des **listes** dont le **dernier élément est un ID de creative**.
- Le même dépôt, côté traitement (https://github.com/xyla-io/almacen/blob/main/processing/process_facebook.py, dernier commit 2020-10-14), précise :
  ```python
  historical_values = {
    'image_url': historical_values_array[0],
    'title': historical_values_array[1],
    'body': historical_values_array[2],
    'id': historical_values_array[3],
  } if len(historical_values_array) == 4 else {
    'id': historical_values_array[-1],
  }
  ```
  → forme observée (vers 2020) : soit `[image_url, title, body, creative_id]`, soit une liste plus courte finissant par l'ID. Ce sont des **instantanés** avant/après, **pas** un indicateur « la partie X a changé » ; pas de vidéo, pas de lien dans cette forme. Ancienne (2020), non revérifiée aujourd'hui.
- Conclusion : **aucune source** ne montre un champ disant quelle partie (image, vidéo, texte, lien) a changé. Pour le savoir : comparer les éléments de `old_value`/`new_value` quand la liste en a 4, sinon récupérer les deux creatives (`/<creative_id>?fields=…`) et les comparer, ce que fait O5. Sans échantillon récent, c'est **non documenté**.

---

## Ce qui reste inconnu (aucune source primaire)
- Liste exhaustive de `object_type`.
- Sémantique exacte de `since`/`until` (bornes, fuseau, champ filtré), de `oid`, `extra_oids`, `add_children`, `data_source`, `uid`, `business_id`.
- `extra_data` pour les enchères et la stratégie d'enchère.
- Sens de clés numériques `action`/`type` (ex. `"action":67,"type":4`).
- Localisation des libellés de statut (`Active`/`Inactive`) selon la langue de l'utilisateur du jeton.
- Contenu complet des listes `old_value`/`new_value` de `update_ad_creative`.
