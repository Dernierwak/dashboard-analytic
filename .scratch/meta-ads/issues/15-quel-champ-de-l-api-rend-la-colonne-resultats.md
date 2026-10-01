# Quel champ de l'API Meta rend la colonne « Résultats » d'Ads Manager

Type: research
Status: open
Blocked by: —

## Question

Le ticket 07 a tranché : les conversions affichées sont **celles qu'Ads Manager
affiche**, la colonne « Résultats », sans règle maison. Reste un fait : **quel
champ (ou quelle combinaison) de `/insights` rend exactement ce nombre**, par
annonce et par jour ?

Ce qu'on sait déjà (recherche 04, [`../recherche/champs-api-meta.md`](../recherche/champs-api-meta.md)) :
- `conversions` est une `list<AdsActionStats>` « based on your objective » — une
  liste de types d'action, pas un nombre ;
- `cost_per_action_result` est un seul `AdsActionStats`, « associated with your
  objective » ;
- `result_rate`, `objective_result_rate`, `cost_per_objective_result` sont des
  `list<AdsInsightsResult>`, dont la page de référence rendait 404 ;
- les `action_type` s'emboîtent : sommer une liste compte plusieurs fois.

À établir, sources primaires seulement : le champ qui égale « Résultats », sa
forme exacte, ce qu'il rend pour une campagne de notoriété (absent ≠ zéro), et
s'il dépend de la fenêtre d'attribution du compte. Si la doc ne tranche pas, le
dire, et dire quel appel réel sur un compte branché le trancherait.
