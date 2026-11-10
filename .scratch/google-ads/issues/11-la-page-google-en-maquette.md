# 11: La page Google en maquette

Type: prototype
Status: claimed
Blocked by: —
Assignee: Dernierwak

## Question

À quoi ressemble la page `/google` avec l'axe tranché (04) — et **la moustache
par type tient-elle sa place** sous les cartes du Sélecteur ?

Une maquette grossière, sur données plausibles calquées sur les comptes réels
(Search + PMax, ticket 03), qui montre :
- le Bandeau de commandes avec le filtre **Type de campagne** (« Tous les
  types » par défaut, seulement les types présents) ;
- les trois cartes Notoriété / Trafic / Conversion, avec la **moustache** :
  parts pour ce qui s'additionne, valeurs côte à côte pour les taux ;
- la Tendance qui se resserre quand on filtre sur un type ;
- la Comparaison et le Tableau esquissés, un repère de type par ligne.

À faire réagir David : la moustache est-elle lisible ou du bruit (il la juge
« limite ») ? le filtre se trouve-t-il ? manque-t-il quelque chose qu'on
attendait d'une « vue dédiée » ? Les réponses nourrissent 05, 08 et 09 — la
maquette ne les tranche pas.

Pas bloqué : David veut un prototype tôt (2026-11-10). Agent utile :
`vision-ux`.

## Apport de la Comparaison (08, résolu)

La Comparaison s'esquisse avec la mécanique de Meta, **sans spécialité par
type** — les moustaches portent la lecture par type. À faire réagir David :
sur « Tous les types », des campagnes de types différents se classent-elles
ensemble ? Une première maquette, centrée sur ce seul module, a été rejetée
pour avoir déroulé toutes les spécialités par type
(`issues/08-la-comparaison.md`, réponse) : **montrer la page, pas un catalogue
de variantes.**

## Premier tour, rejeté (2026-11-10)

Maquette dans l'app, `/google?maquette=page`, chiffres fictifs, branche jetable
`prototype/google-page` (`1a2a683`) : filtre Type de campagne au Bandeau,
moustaches par type (avec ou sans), 2 ou 4 types, Comparaison qui classe
Search et PMax ensemble, Tableau dépliant jusqu'au Groupe d'éléments.

David : « on veut pas pour l'instant aller dans les détails pour les search
pmax etc. » — ce qui a été proposé « c'est pas du tout dans les normes de ce
que j'aimerais. Donc ça on le laisse. » Les questions posées sur la moustache
et sur le classement mélangé des types partaient dans ce détail.

**Ce qui en sort** : ce qu'on montre pour chaque type (PMax, Search…) quitte
ce ticket pour [Ce qu'on montre pour chaque type de campagne](15-ce-qu-on-montre-par-type.md).
La maquette est à refaire, sans détail par type ; ce qu'elle montre à la
place reste à préciser avec David.
