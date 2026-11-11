# 07: La Comparaison, variante A

**Status:** ready-for-agent

**Blocked by:** 04, 05

**What to build:** entre la Tendance et le Tableau, le client compare jusqu'à
quatre campagnes, groupes ou annonces. Au-dessus, trois réglages : Type de
campagne (Tous, ou un type présent), Niveau (Campagnes › Groupes › Annonces),
deux métriques de la vue. Dessous, côte à côte : le nuage de la période (taille
= coût, non cochées en gris) et la courbe jour par jour des cochées.

Spec : § Comparaison — la mécanique. Décision : ticket 16 de la carte
(prototype sur la branche jetable `prototype/comparaison`, référence visuelle
seulement). **La Comparaison de Meta ne change pas.**

- [ ] Niveau « Groupes » = groupes d'annonces et Groupes d'éléments ensemble, avec le repère de type ; « Annonces » absent quand PMax est seul ; sur « Tous », une phrase dit que PMax n'a pas d'annonces.
- [ ] La première métrique classe la liste (croissante pour un coût), « — » en bas ; choisir pour l'une la métrique de l'autre les échange.
- [ ] Liste sur deux colonnes, étiquette du type sur chaque ligne ; quatre cases au plus, la 5ᵉ se refuse visiblement ; changer de type ou de niveau repart du pré-cochage.
- [ ] La courbe bascule entre les deux métriques ; les noms qui se chevauchent dans le nuage ont une solution lisible (point laissé ouvert au ticket 16).
- [ ] Les annonces portent une cible « Lire » visible au repos (elle ouvrira le panneau au 08 ; d'ici là absente ou inerte, à dire dans le ticket).
- [ ] Réglages et cochées dans l'URL.
- [ ] Harnais page : niveaux par type, échange de métriques, plafond de quatre, pré-cochage.
- [ ] `tsc`, `build` verts, 18 routes ; vérifié dans Chrome (Tous, Search seul, PMax seul).
