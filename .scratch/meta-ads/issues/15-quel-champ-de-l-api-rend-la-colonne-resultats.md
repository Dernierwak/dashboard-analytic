# Quel champ de l'API Meta rend la colonne « Résultats » d'Ads Manager

Type: research
Status: resolved
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

## Answer

Résolu le 2026-10-01. Rapport complet, sources citées :
[`../recherche/colonne-resultats.md`](../recherche/colonne-resultats.md).

- **Le champ est `results`** — sa description dans la référence `/insights`
  reprend mot pour mot la définition « Results » du centre d'aide Ads Manager
  (« The number of times your ad achieved an outcome, based on the objective
  and settings you selected »). `result_type` n'existe pas ; `objective_results`
  est un champ distinct dont la différence avec `results` n'est pas documentée.
- **Sa forme : `list<AdsInsightsResult>`, une liste, pas un nombre.** La
  structure d'un élément n'est **pas établie** : la page `AdsInsightsResult`
  rend 404, la spec codegen de Meta le déclare `list<Object>`, aucun exemple.
- **Notoriété : non établi.** Aucune source primaire ne dit si une annonce
  sans résultat rend un champ absent, `[]` ou `"0"`.
- **Attribution : `results` suit le réglage de l'ensemble de publicités**
  (centre d'aide + bascule Meta du 10 juin 2025). Non établi : si
  `action_attribution_windows` agit dessus.
- **Version** : présent dans le SDK Python officiel dès `23.0.0`, absent
  jusqu'à `22.0.5` — donc au plus tard v23.0, couvert par la v24.0 du code.

**La doc ne tranche pas l'égalité à l'unité.** Ce qui la tranchera : l'appel
réel décrit dans le rapport, porté par
[L'appel réel qui donne la forme de `results`](16-l-appel-reel-qui-donne-la-forme-de-results.md).
