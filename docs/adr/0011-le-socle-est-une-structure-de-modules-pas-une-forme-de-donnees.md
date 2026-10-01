# Le socle commun aux plateformes est une structure de modules, pas une forme de données

La carte `meta-ads` promettait un dashboard Meta « posé sur un socle que Google
Ads reprendra sans refonte ». La lecture attendue d'un développeur est une forme
de données commune — une vue SQL ou un type unique que Meta et Google
remplissent, et que des modules partagés affichent. Le ticket 07 de la carte
était écrit ainsi.

**On ne la fait pas.** Le socle, c'est une **liste de modules nommés** —
Bandeau de commandes, Sélecteur de vue, Tendance, Comparaison, Tableau détaillé,
plus le Panneau latéral — qui ont le même nom, le même rôle et la même place sur
chaque plateforme (`CONTEXT.md`, entrée **Module**). Chaque plateforme a **son
propre code** pour chaque module ; seules des briques visuelles neutres (carte,
graphe, panneau, bandeau) se partagent.

## Pourquoi

David, le 2026-10-01 : « que le code ne soit pas un code qui s'applique pour
tous » — et, dans le même souffle, « si on change de plateforme, que ça ne soit
pas complètement un truc complètement différent ». Les deux tiennent ensemble si
ce qui est commun est la **hiérarchie**, pas les données.

Les données ne se prêtent pas à une forme commune, et le dépôt le montre déjà :
- Google stocke en `cost_micros`, Meta en unités ;
- Meta rend ses conversions comme une liste de types d'action emboîtés, Google
  comme un nombre (`google_ads_insights.conversions`) ;
- Meta a un niveau « ad set », Google un « groupe d'annonces », et les
  métriques valides diffèrent par type de campagne.

Une forme commune aurait dû soit perdre ces différences, soit les porter toutes
en colonnes optionnelles — et un module partagé aurait alors grandi d'un `if`
par plateforme, jusqu'à ce qu'une retouche sur Google casse Meta. L'ADR 0010
(« une plateforme se lit avec ses propres chiffres ») pousse dans le même sens :
une vue qui unit les deux plateformes invite à les additionner.

## Ce que ça coûte

Le module Tendance de Google s'écrira, il ne se branchera pas. Le gain promis
« ne repart pas de zéro » porte sur **ce qu'il faut décider** (quoi montrer, où,
dans quel ordre, quel panneau), pas sur le code. Si une troisième plateforme
arrive et que les fichiers par plateforme se ressemblent à 90 %, c'est le moment
de revenir sur cette fiche — pas avant.
