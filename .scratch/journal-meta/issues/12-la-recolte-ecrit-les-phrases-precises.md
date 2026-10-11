# 12: La récolte écrit les phrases précises

Type: task
Status: open
Blocked by: 10, 11

## Question

Construire dans `activities.py` ce que les tickets 01 à 08 ont tranché, et
l'éprouver sur les formes du ticket 02 avant le premier passage du worker.

- Logique sur `run_status` et `event_type`, jamais sur un libellé (04) ;
  aucune ligne jetée sans rien dire.
- Statut regroupé par élément et par jour (05).
- Types ajoutés : `update_ad_set_optimization_goal`, `update_ad_targets_spec`,
  `update_ad_set_duration` (02).
- Budget lu dans `composite_data`, sinon « budget modifié » ; dit non testé (07).
- Le groupe d'une annonce lu dans `extra_data.campaign_id` (02).
- Un harnais écrit pour le ticket, sur les formes du ticket 02 (`CLAUDE.md` §9).
