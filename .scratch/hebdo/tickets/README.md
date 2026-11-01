# Tickets de construction — La page hebdomadaire

Découpage de la [spec](../spec.md), approuvé par David le 2026-11-01. Ces
tickets construisent ; les tickets de décision de la carte vivent dans
`../issues/` (numérotation distincte).

**Stratégie** : expand–contract. Chaque bloc neuf du payload s'écrit à côté
de l'ancien monolithe (ouvert au 01) ; chaque ticket de page remplace
l'ancien bloc qu'il couvre et tolère un payload publié avant lui ; le 10
retire l'ancien payload. Le seul point de test est `build_payload(Lecteur)`
hors ligne, en partant du harnais du ticket 14 de la carte.

## Ordre de construction

| # | Ticket | Bloqué par | Couches |
|---|---|---|---|
| 01 | [La semaine calée sur le Jour de travail](01-la-semaine-calee-sur-le-jour-de-travail.md) | — | traitement, page |
| 02 | [Le jeton mort marqué par la récolte](02-le-jeton-mort-marque-par-la-recolte.md) | — | récolte |
| 03 | [La couverture par source et par flux](03-la-couverture-par-source-et-par-flux.md) | — | schéma, récolte |
| 04 | [L'état des sources et le bandeau des totaux](04-l-etat-des-sources-et-le-bandeau-des-totaux.md) | 01, 03 | traitement, page |
| 05 | [La carte Meta du module des canaux](05-la-carte-meta-du-module-des-canaux.md) | 04 | traitement, page |
| 06 | [Les changements sur la carte du canal](06-les-changements-sur-la-carte-du-canal.md) | 03, 05 | traitement, page |
| 07 | [La frise des campagnes et le panneau Campagnes](07-la-frise-des-campagnes-et-le-panneau-campagnes.md) | 01 | traitement, page |
| 08 | [Les posts dans la frise et le panneau Organique](08-les-posts-dans-la-frise-et-le-panneau-organique.md) | 07 | schéma, récolte, traitement, page |
| 09 | [La fin d'une campagne Google supprimée](09-la-fin-d-une-campagne-google-supprimee.md) | 07 | récolte, traitement |
| 10 | [Retirer l'ancien payload](10-retirer-l-ancien-payload.md) | 04, 05, 06, 07, 08 | traitement, page |
| 11 | [Contrôle bout à bout après passage du worker](11-controle-bout-a-bout-apres-passage-du-worker.md) | tous | vérification |

**Frontier de départ** : 01, 02, 03. Trois agents au plus en parallèle, jamais
deux sur les mêmes fichiers : 01 (traitement + page) et 02 / 03 (récolte)
ne se croisent pas, mais 02 et 03 passent probablement tous deux par
l'orchestration de la récolte (plan et synchronisation par compte, non
vérifié ligne à ligne) — les enchaîner ou les confier au même agent.
