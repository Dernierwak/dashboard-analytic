# L'appel réel qui donne la forme de `results`

Type: task
Status: resolved
Blocked by: 15

## Question

La recherche « Quel champ de l'API Meta rend la colonne Résultats » a désigné
`results`, mais la documentation ne dit ni la **forme** d'un élément
`AdsInsightsResult`, ni ce que rend une campagne de **notoriété** (absent,
`[]` ou `"0"`), ni si `action_attribution_windows` agit dessus. Sans ces trois
faits, la table de stockage des conversions ne peut pas être écrite sans
deviner — et deviner « absent = 0 » est exactement ce que `CLAUDE.md` §7
interdit.

**HITL** : l'appel demande un jeton d'un compte branché, que la conversation
ne voit jamais (§7). David le lance ; l'agent fournit la commande et lit la
réponse **anonymisée** (IDs et montants peuvent être masqués, la structure non).

L'appel, tel que le rapport le décrit
([`../recherche/colonne-resultats.md`](../recherche/colonne-resultats.md), § appel) :
`GET /v24.0/act_<ID>/insights`, `level=ad`, `time_increment=1`, une plage
qui s'arrête à J-1, `fields` incluant `attribution_setting,results,
objective_results,cost_per_result,actions`. Comparer à un export Ads Manager
par jour, puis rejouer avec `action_attribution_windows=["1d_click"]`.
Le compte doit avoir une campagne de ventes avec pixel **et** une campagne de
notoriété.

Résolu quand les trois faits sont écrits ici, avec un extrait de réponse.

## Answer

Résolu le 2026-10-03, **sans appel**. David : « je sais pas pourquoi tu veux
me faire un appel API ». La question n'a pas besoin d'être tranchée avant la
construction : il suffit que la récolte n'interprète rien.

- **La récolte stocke `results` tel que Meta le rend** — la liste brute, sans
  la réduire à un nombre. Aucune forme d'élément n'est supposée.
- **Champ absent → `NULL`**, jamais `0` (`CLAUDE.md` §7). Une liste vide reste
  une liste vide : les deux ne se confondent pas.
- **Le type du résultat voyage avec le nombre**, puisqu'il est dans la liste
  brute : on n'additionnera pas des achats et une couverture sans le voir.
- **La forme exacte, le cas notoriété et l'effet de
  `action_attribution_windows` se liront dans la base** après le premier
  passage du worker qui récolte `results` — un lancement à la main de
  `weekly-fetch.yml` ou le cron du Jour de travail. C'est là que l'affichage
  du module Conversion fixera comment lire la liste.
