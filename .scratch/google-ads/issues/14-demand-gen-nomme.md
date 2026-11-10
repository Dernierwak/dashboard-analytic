# 14: Demand Gen, cinquième type nommé ?

Type: grilling
Status: resolved
Blocked by: 15 (levé par David, qui a tranché sans attendre)
Assignee: David

## Question

[Regrouper, garder ou reporter les types secondaires](06-les-types-secondaires.md)
a rangé Demand Gen sous **Autres types**, au vu de 90 jours sans aucune
impression (ticket 03). Il serait nommé, disait-il, « quand un compte réel y
dépensera ».

L'essai réel ([ticket 10](10-l-essai-reel.md)) a lu **36 mois** : le compte A
a dépensé ≈ 50 900 CHF en Demand Gen (53 M d'impressions, plus que ses
34 200 CHF de PMax), et le compte B ≈ 14 600 CHF. Dès que la page montrera
l'historique repris, « Autres types » sera, sur ces périodes, le deuxième
poste du compte A, sans nom.

**Demand Gen devient-il un cinquième type nommé du filtre et de la moustache,
ou reste-t-il sous Autres types ?** Et dans le premier cas, quelles
spécialités porte-t-il ? L'essai a trouvé, sur Demand Gen : conversions après
affichage et impressions Active View remplies, vues TrueView à 0, taux de vue
et CPV absents, quartiles absents sur 5 campagnes sur 6.

## Answer

Grilling avec David, le 2026-11-10 : « oui aux deux ».

**Demand Gen devient un cinquième type nommé**, à côté de Search, PMax,
Display et Vidéo. « Autres types » ne garde que ce qui reste (Shopping, App,
Local, Hotel…). Ce qui a tranché : quand l'historique sera repris,
Demand Gen sera la deuxième dépense du compte A (≈ 50 900 CHF sur 36 mois,
plus que PMax, ticket 10). Sous « Autres types », ce poste n'aurait pas
de nom. Cela révise [Regrouper, garder ou reporter les types secondaires](06-les-types-secondaires.md),
qui attendait justement « qu'un compte réel y dépense ».

**Rien ne change à l'écran aujourd'hui** : la page n'affiche pas encore les
types (filtre et moustache suspendus par la maquette, ticket 11). La décision
vaut pour le moment où [Ce qu'on montre pour chaque type de campagne](15-ce-qu-on-montre-par-type.md)
les fera revenir : la liste de ce ticket compte désormais cinq types.

**Demand Gen ne porte que les chiffres de base** : impressions, clics, coût,
conversions, valeur. Pas de chiffres vidéo (vues, CPV, quartiles) : Demand
Gen diffuse aussi des images sur Discover et Gmail, donc ses vues seraient
partielles. Son 0 de vues TrueView n'est pas une mesure (« — » avec sa raison,
règle du 10). Les conversions après affichage et les impressions Active View,
que l'essai a trouvées remplies, ne sont pas retenues : elles relèvent de
l'analyse par type, hors de la carte (08).

`CONTEXT.md` mis à jour (« Type de campagne » : cinq types). Pas d'ADR, la
décision est réversible : une entrée de filtre en plus ou en moins ne casse rien.
