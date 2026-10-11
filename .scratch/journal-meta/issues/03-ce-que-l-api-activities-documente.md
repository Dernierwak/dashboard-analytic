# 03: Ce que l'API `/activities` documente

Type: research
Status: resolved

## Question

Champs, paramètres et forme documentée de `extra_data` sur
`GET /act_<id>/activities`.

## Answer

Détail et sources : [`../recherche/activities.md`](../recherche/activities.md).

- Les champs `object_type`, `date_time_in_timezone`, `translated_event_type`
  existent. `object_type` **ne sert pas** à dire le niveau (un changement de
  groupe y est « CAMPAIGN ») : le préfixe de `event_type` reste la règle.
- `category` (STATUS, TARGETING, BID, BUDGET, AD…) existe dans le SDK officiel,
  pas sur la page de doc ; il a bien filtré lors des essais de David.
- Meta ne documente de `extra_data` que « JSON encoded extra information ».
  Aucune source publique pour les enchères ni pour les codes `"action"`.
