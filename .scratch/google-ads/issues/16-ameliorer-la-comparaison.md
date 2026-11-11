# 16: Améliorer la Comparaison

Type: grilling
Status: open
Blocked by: —
Assignee: —

## Question

La page Google reprend la **Comparaison de Meta telle quelle**
([La page Google en maquette](11-la-page-google-en-maquette.md)). David veut
l'avoir en tête pour l'améliorer ensuite, sans savoir encore comment
(2026-11-10 : « ce truc de comparaison, il faut qu'on l'ait en tête pour
qu'on puisse l'améliorer après »).

**Qu'est-ce qui ne va pas dans la Comparaison, et que doit-elle devenir ?**
D'abord nommer ce qui gêne, sur Meta comme sur Google ; ensuite seulement,
une forme. Une amélioration vaut pour les deux pages (ADR 0011 : même module,
même rôle) : elle se décide une fois, pour les deux.

Matière : la Comparaison de Meta (`components/meta/comparaison.tsx`, spec
`.scratch/meta-ads/spec.md`), la maquette du ticket 08 rejetée (elle
détaillait les types), et la question restée ouverte au 08 : que vaut un
classement de campagnes de types différents (Search et PMax n'ont pas le même
coût par clic) ? Celle-ci peut aussi revenir par le
[ticket 15](15-ce-qu-on-montre-par-type.md).

## Apport de « Ce qu'on montre pour chaque type de campagne » (15, résolu)

David, 2026-11-11 : la Comparaison reste celle de Meta — « on peut peut-être
prendre un type de campagne, une métrique et comparer comme sur Meta. Ça, je
laisserai comme ça. » À poser ici : le **type de campagne comme réglage** de
la Comparaison (à côté du niveau et des métriques), qui répond aussi au
classement de campagnes de types différents. Sur Meta, l'équivalent serait
l'objectif de campagne — une amélioration vaut pour les deux pages.
