# Aller lire le texte d'un asset sans quitter Pulse

Type: prototype
Status: resolved
Blocked by: —

## Question

Demande explicite de David : « si une personne a créé plusieurs assets et
plusieurs assets en dessous, elle puisse aller voir ce qu'elle a mis comme texte.
Pas tout d'un coup switcher jusqu'à la plateforme s'il manque des informations. »
Et : « comment l'implémenter, ça, c'est une bonne question. Ça, on devrait
peut-être aller en phase de prototype. »

**La distinction qui commande tout le ticket** — elle a été tranchée en charte :
- **Lire le contenu d'un asset** (le texte, le titre, la description, l'image) est
  du **contenu**. Meta le donne toujours. C'est le besoin de David.
- **Mesurer un asset** (les impressions de *cette* image contre celle-là) est une
  **métrique**, et le ticket 03 dira si elle existe hors créa dynamique.

Ce prototype traite le premier. Il ne promet **jamais** le second avant que 03
ait répondu.

**La question de forme, qui est la vraie question**
Où vit cette lecture ? Le brief dit « au niveau asset : texte, description, titre,
image » comme un quatrième rang du tableau hiérarchique, et « sous les graphes :
aperçu visuel des créas comparées ». Ce sont deux endroits différents pour la même
matière, et il faut voir les deux avant de choisir. Pistes à maquetter :
- Un quatrième rang de drill-down dans le tableau.
- Un panneau latéral qui s'ouvre sur une annonce (le brief en utilise déjà un pour
  les changements — un seul mécanisme de panneau pour les deux vaut mieux que
  deux, à vérifier avec le ticket 08).
- Une vignette + le texte sous les courbes de comparaison, sans tableau du tout.

**Contrainte honnête** : un texte long ne se met pas dans une cellule de tableau.
Et en grille comme en flex, `min-width` vaut `auto` — un élément refuse de
rétrécir sans `min-w-0`, et le remède n'est **jamais** une police plus petite
(`CLAUDE.md` §8).

**Ce que le prototype doit rendre** : la maquette des pistes, et la
recommandation d'une seule, avec la raison.

## Ce que le ticket 03 a établi, et qui change ce ticket

Résolu le 2026-09-28 — il ne te bloque plus (rapport :
[`../recherche/metriques-par-asset.md`](../recherche/metriques-par-asset.md)).

- **Les breakdowns d'asset ne rendent que l'ID de l'asset, jamais son contenu.** Le
  texte, le titre et l'image que David veut lire viennent donc de l'endpoint des
  créas, pas des insights. Les deux besoins sont techniquement disjoints : tu peux
  construire la consultation du contenu sans rien savoir des métriques par asset.
- **Il n'y aura pas de métriques à côté du texte.** Le tableau s'arrête à
  l'annonce (décision inscrite sur la carte). Ne maquette donc pas une ligne
  « Asset » avec des colonnes de chiffres : c'est exactement l'écran qui mentirait.
  Ce qui reste, et qui est le besoin réel : **voir ce qui a été écrit**, sans partir
  sur Meta.
- **Sur un carrousel, Meta recolle les métriques des cartes 2..n sur la première.**
  Si ta maquette montre les cartes d'un carrousel, aucune ne porte de chiffre.

## Comments

### 2026-09-30 — les trois pistes existent, David doit choisir

**Où** : le prototype du ticket 05, `/meta/prototype-modules`, avec un nouveau
sélecteur « Lire une annonce » sous les cartes de catégorie (`?lecture=T|P|S`).
Mêmes données, trois endroits pour lire le contenu :
- **T — Dans le tableau** : ce qui avait été validé au 05. Le tableau se déplie
  jusqu'à un quatrième rang, qui liste les champs sous l'annonce.
- **P — Panneau latéral** : le tableau s'arrête à l'annonce. Un clic sur une
  annonce, dans le tableau ou dans la bande des créas comparées, ouvre **le
  même panneau que les changements**. On y trouve l'aperçu tel qu'il s'affiche
  dans le fil (texte, visuel ou cartes du carrousel, titre, description,
  bouton), puis chaque champ en entier, avec ses variantes numérotées.
- **S — Sous la comparaison** : le tableau s'arrête à l'annonce, et les créas
  des éléments cochés s'affichent sous les graphes avec leur texte à plat,
  sans clic.

Dans les trois, la bande « Les créas comparées » sous les graphes est ajoutée :
le brief la demandait et elle manquait au prototype du 05.

**Tenu dans les trois** : aucun chiffre à côté d'un texte, d'une carte ou d'une
variante (ticket 03), et la phrase qui le dit.

**Recommandation : P.** Un texte long ne tient pas dans une cellule de tableau.
Le panneau le montre en entier, lisible depuis la comparaison comme depuis le
tableau, et c'est **un seul mécanisme** avec les changements (répond au point 4
du ticket 08). T noie le tableau chiffré sous du texte. S rallonge la page à
chaque case cochée et ne sert pas celui qui part du tableau.

**Vérifié** : `tsc` est vert sur ces fichiers, et la page compile et répond 200
en `next dev`. **Pas vérifié à l'écran** : l'extension Chrome a décroché
(« Not attached to an active page »), donc aucune capture.

**2026-10-01 — réservation libérée.** La session qui l'avait prise ne tourne
plus. Le prototype (trois variantes P, T, S ; recommandation P, voir plus haut)
est construit mais **pas commité** : il vit dans la copie de travail de `main`,
`/Users/David.GILLIARD/DAVID/Moi_Hobbies/08_Data analyse/05_Mes Projets/03_Agence_Dashboard/saas/web/app/meta/prototype-modules/`. Ce qui reste est le côté humain
du ticket — que David regarde les trois variantes et tranche.

**2026-10-01 — David a regardé les trois variantes et tranche.** Ses mots :
« je le ferai directement si on clique sur les assets dans le module
Comparaison » ; « il manque un peu ce côté : je vois où je peux appuyer » ;
« je ne veux pas avoir les assets en dessous avec les images, alors qu'on peut
cliquer pour les voir » ; « oublie l'Excel […] c'est vraiment une table où on
exporte tout ».

## Answer

**On lit le contenu d'une annonce dans le panneau latéral (P), et on n'y entre
que par le module Comparaison.**

- **L'entrée unique est l'annonce dans le module Comparaison.** Un clic sur une
  annonce de la liste comparée ouvre le panneau latéral : l'aperçu tel qu'il
  s'affiche dans le fil, puis chaque champ en entier avec ses variantes
  numérotées. Aucun chiffre à côté (ticket 03).
- **Le clic doit se voir avant d'être tenté.** C'est la réserve de David sur le
  prototype : on doit savoir où appuyer. Contrainte pour la spec : dans le
  prototype, la ligne entière d'un élément comparé est déjà le bouton qui le
  coche (`prototype.tsx`, `c.basculer`). La lecture a donc besoin de **sa
  propre cible**, visible au repos et pas seulement au survol, distincte de la
  case à cocher. Sa forme exacte (vignette cliquable, libellé « Lire ») revient
  à la spec, pas à ce ticket.
- **La bande « Les créas comparées » sous les graphes ne se construit pas.** Le
  brief demandait un « aperçu visuel des créas comparées » : David préfère le
  clic aux images posées sous les courbes. S part avec elle.
- **Le tableau ne sert pas à lire.** C'est une table d'export de tout le
  détail : il s'arrête à l'annonce, sans quatrième rang (T part) et sans
  ouvrir le panneau. Le texte d'une annonce ne s'y lit pas.
- **Un seul panneau latéral** : celui-ci est le même que celui des changements
  (point 4 du ticket 08, tranché ici côté lecture).

Le prototype `/meta/prototype-modules` montre encore les trois variantes et la
bande : il n'a pas été retouché, la décision vit ici.
