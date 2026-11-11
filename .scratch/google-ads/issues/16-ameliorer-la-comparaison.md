# 16: Améliorer la Comparaison

Type: prototype
Status: claimed
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
