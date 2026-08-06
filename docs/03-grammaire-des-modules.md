# La grammaire d'un module Pulse

Issue d'une revue de sept produits de référence — Levers Labs, Kitchen, Be.run,
Projector, Intelly, NIKITIN, Fenco — croisée avec nos dix-sept modules.

Le constat qui a tout déclenché : **le chiffre précède toujours le graphe.
Zéro contre-exemple sur les sept.** Le graphe ne dit jamais la valeur, il dit la
forme — il est donc toujours le dernier élément du module. Huit de nos dix-sept
modules faisaient l'inverse. Ce n'était pas huit problèmes différents, c'était
un seul, répété : on construisait en partant de la forme et on posait le chiffre
où il restait de la place.

Ce document renverse l'ordre. Il s'applique à tout module nouveau, sans
redemander.

---

## Les neuf rangs

Jamais dans un autre ordre.

### 1 · L'identité — *obligatoire*

Deux formes, **une seule par module** :

| Forme | Quand | Style |
|---|---|---|
| **Titre de lecture** | un module qu'on LIT | serif 17-21 px, filet `brand` de 3 px |
| **Surtitre** | une tuile qu'on SCANNE | 10 px, majuscules, `tracking-widest`, `faint`, bold |

*Interdit* : les deux ensemble. *Interdit* : aucune des deux.

C'est la distinction qui manquait le plus : Pulse n'avait qu'une grammaire — le
surtitre — et la mettait partout, y compris sur des modules qui se lisent.

### 2 · La sortie — *optionnelle*, à droite du rang 1

Le lien qui **quitte** le module, ou le compteur de contexte (« 38 campagnes »).
Jamais en bas. À distinguer du rang 8.

### 3 · Le chiffre — *obligatoire si le module en a un*

Mono, **22 px minimum**. C'est le rang qui porte tout le reste.

> **Aucune forme graphique ne peut apparaître avant lui.**

Si la valeur est un taux, dire « en moyenne » ; si elle s'additionne, dire « au
total ». Une valeur sans son mot est ambiguë.

### 4 · Le verdict — *optionnel, et c'est lui qui fait la différence*

Une pastille **en mots**, recette maison `color: X` / `background: X + "14"`.
Trois familles :

- **la zone** — « sain », « tu peux scaler » ;
- **la pente** — « ▼ en baisse de 23 % » ;
- **le rythme** — « 62 % de l'enveloppe pour 45 % du mois ».

Trois mots remplacent dix secondes de lecture de courbe. Et c'est la **seule**
forme de tendance lisible sur un téléphone, où une frise fait 74 px.

Règle de couleur : le verdict est coloré par le **sens**, pas par le signe. Un
CPC qui baisse est une bonne nouvelle.

### 5 · Le delta — *optionnel*

11 à 12,5 px, coloré par le sens, avec sa base entre parenthèses
(« vs la semaine dernière (1,4 %) »). **Immédiatement sous le chiffre**, jamais
ailleurs.

### 6 · La forme — *optionnelle*, **une seule par module**

Jauge, barre, anneau, courbe ou frise.

> **Si elle porte une cible, la cible est écrite dessus.** Bornes chiffrées aux
> extrémités, seuil nommé, total au centre. Une jauge sans sa cible écrite est
> du décor.

Choix de la forme :

- **n ≤ 12 points** → barres, parce qu'on peut étiqueter chaque unité ;
- **au-delà** → courbe ;
- **dénombrable et n ≤ 15** → autant d'unités que d'éléments (9/12 se dessine en
  douze traits, pas en une barre à 75 % qui ment sur la granularité).

### 7 · Le détail — *optionnel*

Liste, table, légende. Scroll interne au-delà de ~8 lignes. `<details>` replié
si ce n'est pas ce qu'on vient chercher.

### 8 · Le pilotage — *optionnel*, **en bas**

Les pastilles qui changent **ce que le module montre**.

La règle n'est pas « l'action en haut », c'est : *ce qui sort va en haut, ce qui
pilote va en bas*. Un sélecteur au-dessus de son chiffre, c'est la télécommande
avant l'écran.

### 9 · Le pied — *optionnel*, **un seul, jamais deux**, ≤ 2 lignes

Réservé à ce qui rend le module **honnête** : une limite de mesure, une
convention de lecture. Jamais un résumé de ce qu'on vient de voir.

Si le pied serait identique sous chaque élément d'une liste de modules, il
monte au niveau de la section.

---

## Les interdits, en toutes lettres

- un graphe avant son chiffre ;
- deux chiffres de même taille qui se disputent le module — sauf comparaison
  explicite, même ligne, même unité (le cas de `Quotidien` : budget/jour contre
  moyenne réelle) ;
- deux pieds ;
- une jauge, une barre ou un anneau sans sa valeur ou sa cible écrite ;
- un sélecteur au-dessus du chiffre qu'il pilote ;
- un module qui rend un composant déjà rendu ailleurs sur la même page ;
- un bloc vide affiché pour dire qu'il est vide — **une exception** : quand le
  vide enseigne le mécanisme (`action-top` explique comment une action arrive
  dans la liste, et c'est le bon moment pour l'apprendre).

---

## Deux règles de fond qui priment sur l'esthétique

**Aucun chiffre non mesuré présenté comme mesuré.** Quand une valeur n'est pas
mesurable, on le dit dans un `note` — on n'affiche pas 0,0. C'est pour ça que
l'anneau (le réel) et la répartition budgétaire (le prévu) ne fusionnent pas.

**Toute comparaison exclut le jour en cours.** Les fenêtres s'ancrent sur le
dernier jour plein.

---

## Où on en est

**Conformes sans retouche** — c'est sur eux qu'on s'appuie :
`action-top`, `CampaignTable`, `ByLabelTable`, `Repartition`, `apprentissage`,
`reco-card`, et `frise-semaine` hors son pied.

**Corrigés lors de l'établissement de cette grammaire :**

| Module | Écart | Correction |
|---|---|---|
| `theme-timeline` | aucun chiffre avant le graphe ; pied répété 3× | valeur courante en 24 px + pastille de pente ; pied monté au niveau de la section |
| `theme-donut` | total du module en 11,5 px de texte gris | total en 26 px au centre de l'anneau |
| `MetricChart` | aucun chiffre ; sélecteur au-dessus du graphe | cumul en 34 px + pente ; sélecteur descendu sous la courbe |
| `CourbeJournaliere` | aucun chiffre (le total était deux blocs plus haut) | cumul du mois en 34 px + le pic nommé |
| `vision-card`, `trajectoire`, `lib/mission` | jamais rendus | supprimés (519 lignes) |
| `theme-focus-card` | bilan en phrase | six chiffres alignés sous leur libellé |
| `Tuile` + `AdsKpis` | le même objet écrit deux fois | `components/chiffre.tsx` partagé — les deux pages gagnent delta coloré et sparkline |
| `kpi-focus` | jauge sans bornes ; deux pieds | bornes chiffrées sous la jauge ; le `repere` devient l'info-bulle de la jauge qu'il commente |
| `top-recos` | même `RecoCard` rendue deux fois sur la page | onglets-compteurs, un seul panneau rendu à la fois |

**Reste à traiter :**

- `tracking-section` — deux comptages de même poids au rang 3. Un seul rang de
  compteurs (`suivi_actions`), et `reco_feedback` replié en pied de section.
- `AdsKpis` — le hero n'a toujours pas de forme (rang 6).

---

## Trois fusions à ne PAS faire

Elles se ressemblent, elles ne disent pas la même chose :

- **`theme-donut` et `Repartition`** — l'un montre le réel, l'autre le prévu ;
- **`frise-semaine` et `theme-timeline`** — l'une porte du temps, l'autre une
  métrique ; aucune n'est un cas particulier de l'autre ;
- **`action-top` et `tracking-section`** — le vivant et la trace. `action-top`
  est en haut parce qu'on y agit ; le descendre rendrait l'app rétrospective.

---

## Journal

**4 août 2026** — Établissement de la grammaire. Corrections du rang 3 sur
`theme-timeline`, `theme-donut`, `MetricChart`, `CourbeJournaliere`.
Suppression de trois fichiers morts.

**6 août 2026** — `frise-semaine` passe de douze à vingt-quatre mois (janvier de
l'année précédente → 31 décembre de l'année en cours). La fenêtre glissante
coupait les campagnes démarrées début 2025 et interdisait de regarder vers
l'avant, alors que des campagnes courent jusqu'à fin 2026.

Deux points de grammaire en sont sortis, et ils valent au-delà de ce module :

- **Une bande de contexte se borne à ce qu'elle désigne.** La bande « cette
  semaine » courait jusqu'au bord droit du cadre — juste tant que le cadre
  s'arrêtait au dernier jour récolté. Sur une fenêtre qui va jusqu'au 31
  décembre, elle aurait teinté cinq mois. Elle fait sept jours parce que la
  semaine fait sept jours.
- **Le futur n'est pas une donnée manquante.** Ce qui suit la dernière récolte
  est hachuré et nommé « à venir ». Sans ça, cinq mois vides se lisent comme une
  panne de collecte — et l'avertissement « pas de données après le … », qui
  compare chaque canal aux autres, se serait déclenché pour tout le monde tous
  les jours.
