# 16: Améliorer la Comparaison

Type: prototype
Status: resolved
Blocked by: —
Assignee: Claude (session 2026-11-11)

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

## Apport de « L'Analyse Search en maquette » (20, résolu)

David, 2026-11-11, devant la maquette de l'Analyse : la descente et le nuage
des campagnes appartiennent **à la Comparaison**. Ce qu'il décrit :

- **le choix au-dessus, les graphes dessous** — comme la Comparaison Meta
  (vérifié dans `components/meta/comparaison.tsx` : réglages, liste à cocher
  sur deux colonnes, puis deux graphes côte à côte pleine largeur) ;
- **à gauche, un nuage des campagnes sur toute la période choisie** (un point
  par campagne cochée ; trois mois filtrés = trois mois dans le nuage) ;
  **à droite, la courbe** jour par jour — un nuage remplace donc le premier des
  deux graphes de Meta ;
- **les deux suivent la même sélection** : filtrer une campagne la montre dans
  le nuage et dans la courbe ;
- **on descend d'un cran à la fois** : campagnes › groupes d'annonces ›
  annonces. **Les Éléments n'y vont pas** (« ce sera dans analyse »).

**La question devient : à quoi ressemble cette Comparaison, et tient-elle sur
Meta aussi ?** À maquetter sur la page Google validée (branche
`prototype/google-page`, `b19d03f`), avec la mécanique de Meta (quatre cases au
plus, deux métriques). À trancher avec David devant la maquette :
- les axes du nuage — ceux de la vue, comme l'Analyse du ticket 18
  (Notoriété : impressions × CPM ; Trafic : clics × CTR ; Conversion : coût ×
  conversions), ou les deux métriques choisies dans les réglages ;
- ce que montre le nuage pour les campagnes **non cochées** (gris, ou absentes) ;
- le chemin de la descente (un cran à la fois depuis une ligne cochée, ou le
  réglage « niveau » de Meta) ;
- **Meta** : ADR 0011, une amélioration vaut pour les deux pages — la
  maquette montre aussi ce que le nuage donne sur Meta (campagnes, ensembles
  de publicités).

## Answer

**Variante A · Réglages, validée par David le 2026-11-11.** « Il me semble
que c'est la seule qui est bonne, les autres, il y a trop d'informations.
J'aime bien, c'est assez simple. »

La Comparaison devient :

- **Au-dessus, une rangée de réglages** : le **Type de campagne** (Tous /
  Search / PMax), le **Niveau** (Campagnes › Groupes › Annonces) et les
  **deux métriques** de la vue, axe horizontal et axe vertical. La première
  classe la liste. Changer de type ou de niveau repart du pré-cochage, comme
  sur Meta aujourd'hui.
- **La liste à cocher sur deux colonnes**, comme sur Meta, avec **l'étiquette
  du type sur chaque ligne** (Search, PMax). David y tient : « t'as mis les
  petits labels, les styles de campagne […] j'aime bien ».
- **Dessous, côte à côte** : à gauche le **nuage sur toute la période**
  (axes = les deux métriques choisies, taille du point = coût, **lignes non
  cochées en gris**) ; à droite la **courbe jour par jour** des cochées, qui
  bascule entre les deux métriques. Quatre cases au plus.
- **On descend par le réglage Niveau** jusqu'aux annonces, et pas plus bas :
  les éléments (assets) restent dans l'Analyse (« ça sera en dessous »).
  PMax s'arrête au groupe d'éléments : « Annonces » disparaît quand PMax
  est seul.

Ce qui part : la descente depuis une ligne avec fil d'Ariane (B), le
mélange des niveaux (C), les axes figés par la vue (B, C).

Ce qui reste ouvert, pour la construction :
- **les noms qui se chevauchent dans le nuage** quand les points cochés se
  serrent (relevé au premier tour) ;
- **sur Meta** (ADR 0011 : même module, même rôle), la variante A ajoute un
  niveau Campagnes et un réglage Objectif à la place du Type. La maquette le
  montrait, mais David ne s'est pas prononcé sur Meta : c'est à confirmer
  avant d'y toucher (carte, « Not yet specified »).

Prototype conservé sur la branche jetable `prototype/comparaison`
(`4429609`). Il se lance par `/google?maquette=page&av=A#comparaison`.

## Comments

- 2026-11-11 — **Maquette, premier tour.** Branche jetable
  `prototype/comparaison` (`4429609`), partie du deuxième tour validé de la
  page (`b19d03f`) : seule la Comparaison change. Fichiers
  `saas/web/app/google/_prototype-page/comparaison.tsx` et `commutateur.tsx`.
  Ouverte en dev par `/google?maquette=page&av=A#comparaison` (`av=M|A|B|C`,
  ou flèches ← →) ; `M` = la Comparaison de Meta d'aujourd'hui, pour mémoire.
  Bouton « Maquette vue sur Google | Meta » dans l'en-tête du module (noms et
  niveaux de Meta — Objectif, Ensembles de pub, Publicités ; mêmes chiffres
  fictifs). Toutes : choix au-dessus, nuage de la période à gauche, courbe
  jour par jour à droite, quatre cases au plus, jamais d'éléments. Trois
  réponses aux quatre questions :

  | | A · Réglages | B · Descendre d'un cran | C · La liste se déplie |
  |---|---|---|---|
  | Axes du nuage | les deux métriques choisies (la 1re classe la liste) | ceux de la vue, rien à régler (Trafic : clics × CTR…) | ceux de la vue, « ⇄ échanger » |
  | Non cochées | en gris | absentes | en gris, groupes et annonces en cercles creux |
  | Descente | réglage « Niveau » (Campagnes / Groupes / Annonces), repart du pré-cochage | « Descendre ↓ » sur une ligne cochée, fil d'Ariane pour remonter ; on compare toujours des frères | on déplie sur place comme le Tableau, on coche à n'importe quel niveau (avertissement quand on mélange) |
  | Type de campagne | réglage en pastilles | onglets au-dessus | pastilles |

  Remarqué en vérifiant : quand les points cochés se serrent (Meta, vue
  Conversion, niveau Ensembles), **leurs noms se chevauchent** — la légende
  sous la courbe tient, celle du nuage non. PMax s'arrête au groupe
  d'éléments (A retire « Annonces » si PMax seul ; B affiche « fin · PMax ») ;
  sur Meta tout descend jusqu'aux publicités.
