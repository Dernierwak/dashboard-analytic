# 02: Les exemples réels de `extra_data`

Type: task
Status: resolved

## Question

À quoi ressemble `extra_data` pour chaque type d'événement que Pulse récolte,
sur un vrai compte ?

## Answer

David a lancé `/act_<ID>/activities?fields=event_type,event_time,object_name,extra_data&since=…&until=…&limit=100`
dans l'Explorateur de l'API Graph (v25.0) les 2026-10-10 et 11, sur le
30 septembre et les 26-27 août. Sans dates, Meta ne rend que les tout derniers
événements (créations d'audience, facturation). Formes observées, noms
remplacés :

- **Statut** (`update_ad_run_status`, `update_ad_set_run_status`) :
  `{"old_value":"Actif","new_value":"En attente de traitement","run_status":{"old_value":1,"new_value":17},"type":"run_status"}`.
  Le libellé est **dans la langue de l'utilisateur du jeton** ; le code chiffré
  ne dépend pas de la langue (vus : 1 = Actif, 9 = En attente d'examen,
  17 = En attente de traitement ; aucune pause vue). Chaque modification
  d'annonce produit la chaîne Actif → 17 → 9 → Actif.
- **Ciblage** (`update_ad_set_target_spec`, et **`update_ad_targets_spec`** au
  niveau annonce, non récolté aujourd'hui) : `old_value` et `new_value` sont des
  listes `{"content":"Lieu :","children":["…"]}`, déjà rédigées. Souvent
  identiques avant et après quand c'est l'annonce voisine qu'on a touchée.
  Un groupe neuf a `old_value: []`.
- **Créa** (`update_ad_creative`) : listes `[url_image?, titre?, texte?, id_créa]`,
  de longueur variable (2, 3 ou 4). L'URL de la même image change d'un appel à
  l'autre (paramètres signés) ; le nom de fichier reste. Vu : trois créas
  « modifiées » où seul `id_créa` change.
- **Objectif** (`update_ad_set_optimization_goal`, non récolté) :
  `{"new_value":"Vues de page de destination","old_value":null,"type":"optimization_goal"}`.
- **Stratégie d'enchère** (`update_ad_set_bid_strategy`) :
  `{"new_value":"LOWEST_COST_BID_STRATEGY","additional_value":{"currency":"CHF","type":"payment_amount",…},"type":"bid_type"}`
  — un code Meta, pas un libellé.
- **Création d'un groupe** (`create_ad_set`) :
  `{"new_value":{"type":"payment_amount","currency":"CHF","new_value":20000,"additional_value":"Budget global"},"type":"composite_data"}`
  — centimes.
- **Création d'une annonce** (`create_ad`) : `{"campaign_id":{"new":<ID>}}`.
- **Calendrier** (`update_ad_set_duration`, non récolté) :
  `{"old_value":{"time_start":"août 27, 2026, 11:00 AM","time_stop":"…"},"new_value":{…},"type":"duration"}`.

**Le `campaign_id` d'un changement d'annonce est l'ID du groupe d'annonces**
(vérifié dans `meta_ads_insights` le 2026-10-10 : il égale `adset_id`, pas
`campaign_id`). Meta appelle « campaign » le groupe en interne.

Écartés car ce ne sont pas des gestes du client : `ad_account_billing_charge`
(c'est lui qui portait `"action":67`), `first_delivery_event`, `add_images`,
`edit_images`, `create_audience`, `update_campaign_budget_scheduling_state`.

**Ce que le code fait de faux aujourd'hui** (`activities.py`) : un statut de
campagne ou de groupe en libellé français est jeté (`return None`, il attend
`PAUSED`/`ACTIVE`) ; le budget lit `old_value` au premier niveau alors qu'il est
dans `composite_data`.
