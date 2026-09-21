# Un conseil ne naît que sur un thème prioritaire

> **⚠️ CADUQUE — 2026-09-21.** Pulse ne conseille plus rien du tout : le moteur
> entier a été retiré du produit. Cette fiche reste au dépôt parce qu'une
> décision et sa raison ne s'effacent pas — elle dit pourquoi on refusait que
> Pulse arbitre entre les thèmes.
>
> **Ce qui survit : les thèmes prioritaires.** Les étoiles
> (`insight_feedback`, clé `priority_label:<nom>`) décident encore des cartes
> affichées en tête du rapport. Elles ne commandent simplement plus aucun
> conseil, puisqu'il n'y en a plus.

Pulse rend deux choses de nature différente. Le **point de vue de la semaine**
— ce qui a bougé sur les campagnes et les publications — existe pour tout le
monde, sans rien classer. Le **conseil**, lui, ne sort que sur les thèmes que le
client a lui-même désignés comme prioritaires (trois au maximum, étoilés dans
`insight_feedback`). Un thème classé mais non étoilé a ses chiffres et son
bilan ; il n'a pas de conseil. **Pulse n'arbitre donc jamais entre les thèmes** :
le client dit où il travaille, Pulse conseille dedans.

L'alternative évidente était de conseiller sur tout le compte : le chemin
déterministe existe encore dans le code (`build_recos`, `build_report.py`
l. 2048) et n'a jamais été retiré. Il reste débranché **exprès**, parce que
conseiller sur le compte entier oblige Pulse à désigner lui-même le sujet sur
lequel le client devrait travailler — c'est précisément l'arbitrage que le
produit refuse de faire. Le thème prioritaire est la façon dont le client dit
« c'est là que je travaille » ; hors de lui, Pulse n'a aucun mandat pour choisir
à sa place.

**Ce raisonnement a été révisé le 2026-09-11 (ticket
[24](../../.scratch/refonte/issues/24-conseils-payants-manquants.md)) — la
décision n'a pas bougé, sa justification si.** La première version tenait sur un
autre argument : Google Ads, Meta (Opportunity Score) et GA4 livrant déjà
gratuitement des recommandations priorisées *dans l'écran où on les applique en
un clic* (ticket
[02](../../.scratch/refonte/issues/02-sur-quoi-se-differencient-les-autres.md)),
redire la même chose ne vaudrait rien. **David a renversé ce point** : *« les
dashboards montrent des données Meta et Google, mais l'hebdomadaire, ces recos,
les personnes ne les voient pas seules ; ceux qui ne connaissent pas ne les
voient jamais, ceux qui connaissent ont le travail prémâché. »* La gratuité d'un
conseil ailleurs **n'est donc plus un motif de refus** : la valeur de Pulse est
qu'un seul endroit rassemble tout, chaque semaine, et qu'il n'a rien à vendre —
là où l'Opportunity Score de Meta pousse à dépenser plus sur Meta. Conséquence
directe : `_rule_gaspillage` et `_rule_scaler`, supprimés au ticket
[11](../../.scratch/refonte/issues/11-d-ou-viennent-les-conseils.md) pour ce seul
motif, sont réhabilités — à l'échelle du thème.

Ce que 02 a mesuré reste vrai et reste l'axe le plus fort : l'arbitrage **entre
canaux** n'existe que par le thème, et aucun concurrent mono-régie ne peut le
dire. Ce n'est simplement plus le *critère d'admission* d'un conseil.

Deux conséquences à ne pas « corriger » plus tard en croyant réparer un bug.
**Le tri ne suffit pas, il faut un filtre** : `build_report.py` l. 442 met
`is_priority` en tête mais laisse sortir les autres plus bas — ces lignes-là
disparaissent. Et **les cinq conseils par semaine sont un plafond, jamais un
quota** : un compte à un seul thème prioritaire en reçoit moins, et on ne
complète pas avec du non-prioritaire. À zéro priorité, le module de conseils est
**visible et verrouillé**, il dit ce qu'une étoile débloque — jamais vide, jamais
rempli de décor.

Tranché par David le 2026-09-10 (*« les labels sont les recos pour les labels
prio. Fin. »*), au ticket
[21](../../.scratch/refonte/issues/21-le-document-de-refonte.md) ; le raisonnement
complet est au §1 et §5 de `.scratch/refonte/plan-de-refonte.md`.
Justification révisée le 2026-09-11 au ticket
[24](../../.scratch/refonte/issues/24-conseils-payants-manquants.md) ; David a
re-confirmé la décision elle-même à cette occasion.
