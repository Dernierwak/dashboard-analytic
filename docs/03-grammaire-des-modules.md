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
- deux chiffres de même taille qui se disputent le module. **L'exception qu'on
  s'était accordée est tombée** : `Quotidien` opposait budget/jour et moyenne
  réelle comme s'il s'agissait d'une comparaison, alors que le rapport des deux
  vaut *exactement* `ratio du mois / part du mois écoulée` — déjà écrit dans la
  tuile « Reste » et déjà dessiné par la barre. Une identité algébrique n'est
  pas une comparaison ; le module a été supprimé, l'interdit n'a plus
  d'exception ;
- deux pieds ;
- une jauge, une barre ou un anneau sans sa valeur ou sa cible écrite ;
- un sélecteur au-dessus du chiffre qu'il pilote ;
- **une pente jugée sur un indicateur qui ne se juge pas.** La dépense en est
  le cas type : dépenser moins n'est ni une victoire ni un échec tant qu'on ne
  sait pas ce que ça rapporte. Sa pastille reste grise, son filet reste gris,
  et elle ne peut pas servir à classer des thèmes entre eux — sinon « celui qui
  décroche » désigne celui qui a simplement coupé une campagne ;
- un module qui rend un composant déjà rendu ailleurs sur la même page —
  **une exception, et une seule** : un même GESTE peut avoir deux points
  d'entrée s'ils écrivent la même ligne par la même server action, et si les
  deux vues sont re-rendues depuis la même source. L'interdit vise deux
  mécanismes concurrents, pas deux boutons sur un même état. Corollaire
  technique, non négociable : chaque vue est montée avec une `key` qui dépend
  de l'état — sinon l'état local d'un composant client survit à
  `revalidatePath` et les deux vues divergent jusqu'au rechargement ;
- un bloc vide affiché pour dire qu'il est vide — **une exception** : quand le
  vide enseigne le mécanisme (le rail d'une carte de thème explique comment une
  action y arrive, et c'est le bon moment pour l'apprendre ; l'exemple d'origine
  était `action-top`, supprimé depuis, la règle lui a survécu).

---

## Les règles de fond, qui priment sur l'esthétique

**Aucun chiffre non mesuré présenté comme mesuré.** Quand une valeur n'est pas
mesurable, on le dit dans un `note` — on n'affiche pas 0,0. C'est pour ça qu'une
dépense constatée et un budget promis ne partagent jamais la même forme : un
anneau dont les parts mélangeraient les deux serait illisible et faux.

**Une limite de mesure se vérifie contre les chiffres affichés à côté d'elle.**
Un `note` est une affirmation comme une autre, et rien ne la vérifiait : la
carte « Audio Tour » écrivait « 820 CHF revenu · 0,2 ROAS » puis, deux lignes
plus bas, « le ROAS de ce thème n'est pas mesurable ». C'est le pied du module
qui ment, et il ment plus gravement qu'un chiffre — parce qu'on le lit comme la
phrase honnête du module. L'affichage tient donc la note pour une hypothèse à
confronter, jamais pour un texte à recopier : `noteSerie()` la supprime dès que
le thème porte un revenu. Un producteur de données qu'on ne peut pas corriger
tout de suite (ici le worker, dont le rapport ne se régénère qu'à la demande) ne
dispense pas d'afficher juste aujourd'hui.

**Toute comparaison exclut le jour en cours.** Les fenêtres s'ancrent sur le
dernier jour plein.

**Toute valeur porte sa fenêtre dès qu'elle diffère de celle du module.** La
carte de thème l'a appris à ses dépens : « 103 CHF cette semaine » voisinait
« 4 520 dépensé · ROAS 0,2 » sans que rien ne dise que le second couvre tout
l'historique depuis janvier. Deux fenêtres collées et muettes se lisent comme
une seule — c'est un chiffre présenté pour autre chose que ce qu'il mesure.

**Un nombre dérivé dit d'où il vient, à l'endroit où il s'affiche.** Le défaut
fondateur de la page Coûts : un compte qui avait réglé 2 000 sur Meta et 1 000
sur Google lisait « enveloppe : 3 000 CHF », un montant qu'il n'avait jamais
tapé, produit par une règle de préséance que rien n'écrivait. Toute valeur
calculée par défaut porte donc sa provenance en pied (`sourceBudgetAnnuel`,
`sourceBudgetMois`), et le texte CHANGE avec la branche empruntée — une phrase
générique du genre « calculé automatiquement » ne vaut rien.

**Un seuil ne survit pas à un filtre qui ne le concerne pas.** Dès qu'on
restreint la courbe des coûts à deux thèmes, le trait du budget disparaît : il
porte sur tout le compte, et le laisser ferait passer n'importe quel
sous-ensemble pour vertueux. Le module écrit alors pourquoi il n'y a plus de
trait, au lieu de le laisser manquer en silence.

**Une agrégation dit ce qu'elle a agrégé d'incomplet.** Une série hebdomadaire
finit sur la semaine en cours, mécaniquement plus basse : sans un mot, elle se
lit comme un effondrement de la dépense. Même famille que « toute comparaison
exclut le jour en cours », appliquée à la forme plutôt qu'au delta.

---

## Le graphe : la géométrie en SVG, les caractères en HTML

Règle de fabrication, pas de goût, et elle vient d'un défaut mesuré. Un
`viewBox="0 0 720 150"` en `w-full` sans hauteur laisse le navigateur mettre
**tout** à l'échelle de la largeur : sur un téléphone (≈ 327 px de conteneur) le
facteur vaut 0,45, et une date écrite `fontSize="10"` se rendait à **4,5 px**.
Sur un écran de bureau, le même texte faisait 17 px. Aucun caractère de nos
courbes n'avait de taille décidée.

La correction n'est pas de régler les tailles une par une : c'est de **sortir le
texte du SVG**. Le SVG s'étire librement pour remplir une boîte dont la hauteur
est en pixels CSS ; dates, étiquettes, noms de zones et info-bulles sont posés
par-dessus en HTML absolu, positionnés en pourcentages calculés avec la même
arithmétique. Les deux couches coïncident au pixel près.

Trois conséquences qui tiennent lieu de règles :

- **les points sont des ronds HTML** — un cercle SVG étiré sans rapport d'aspect
  uniforme donne un œuf ;
- **l'info-bulle est une vraie bulle**, immédiate, et non le `<title>` natif qui
  met une seconde à venir et n'existe pas au doigt ;
- **une étiquette peut enfin être arrondie et lisible sur la courbe** — c'est ce
  qui transforme un pointillé muet en `action · sem. du 22 jul`.

**Une colonne d'une carte n'est pas un module.** Elle n'a pas son propre rang 1
en titre de lecture, elle hérite du rang 3 de la carte : son chiffre est donc un
chiffre de bilan, au moins 1,7 fois plus petit que le chiffre de tête (34 → 20
px). Et **un ratio ne s'affiche qu'à partir de deux verdicts** — sur n = 1,
« 0/1 » n'est pas une mesure, c'est un accident qui condamne.

**Un bilan de trois à cinq chiffres est autorisé sous le chiffre de tête** s'il
est au moins 1,7 fois plus petit et partage **un seul fond** (pas un cadre par
chiffre). L'interdit visé par « deux chiffres de même taille » est la
concurrence, pas la densité : 34 px puis 19 px se lisent comme un titre et sa
suite, pas comme deux titres.

---

## Le lexique des signes

Un signe qui dit trois choses ne dit plus rien. Le `▲` servait à la hausse, au
repère d'action sur un graphe et au verdict « pas d'effet » — dix-huit endroits,
trois sens. Attribution arrêtée, elle ne se renégocie pas module par module :

| Sens | Signe | Règle |
|---|---|---|
| la pente | `▲` `▼` | **exclusif**. Jamais sans un nombre à côté. Coloré par le SENS, jamais par le signe |
| ce qu'on a décidé, et qui sera jugé | pastille **ronde** de 7 px | creuse = ça court · pleine = c'est jugé · barrée = abandonné. Elle ne se clique pas ; les gestes sont des boutons SOUS l'entrée |
| ce qui s'est produit sur une plateforme | le **glyphe du canal** (▣ Meta, ◆ Google) | un fait daté, pas une décision : ni verdict, ni bouton |
| d'où vient un chiffre | le **glyphe de la source**, dans sa couleur — ▣ Meta, ◆ Google, ◎ Instagram, ◇ Google Analytics | table `SOURCE` de `components/etat-action.tsx`, jamais recopiée. Le losange CREUX d'Analytics contre le plein d'Ads : même famille, régie différente. Chaque source porte un `surSombre`, parce qu'une cellule sélectionnée s'inverse et que #1a56ff sur fond encre ne se lit pas |
| ce que tu as noté toi-même | `✎` | ni indicateur ni échéance — rien à juger. Le seul geste qu'une note accepte, c'est disparaître |
| un repère d'action sur un graphe | trait vertical pointillé + **point de 7 px** en encre, nommé **au survol** | plus de plafond : tous les repères s'affichent. Deux points côte à côte se touchent, deux pastilles de texte se coupaient. La bulle s'ouvre aussi sur `focus-within` — au doigt, un `tap` la révèle |
| verdict « pas d'effet » | la flèche du **delta réel**, en `text-neg` | ce n'est plus un sens à part, c'est le premier correctement employé |

Le triangle est **dessiné** (`components/pente.tsx`), pas tapé : le caractère se
cale mal sur la ligne de base selon la plateforme, et il doit tenir de 11 px
(une tuile) à 68 px (le hero). Ses dimensions sont en `em`.

**Le rond est réservé à ce qui sera mesuré.** C'est la règle qui permet aux
trois voix du fil — les conseils de Pulse, les plateformes, et toi — de tenir
sur un même rail sans se confondre. Un fait n'a pas de verdict, donc pas de
pastille : lui en donner une ferait croire que le produit a mesuré quelque
chose.

Un repère d'action est un **fait daté, pas un jugement** : il est en encre. Il
était bleu sur une courbe (la couleur de la courbe elle-même — invisible) et
vert sur une autre (ce qui préjuge du résultat avant que le verdict existe).

**Ce qui est calculé peut être encadré ; ce qui est rédigé reste nu.** Le hero
en est le cas type : le verdict chiffré est en carte, le résumé écrit par l'IA
est posé à même la page. Un cadre donnerait au second l'autorité du premier.

---

## Où on en est

**Conformes sans retouche** — c'est sur eux qu'on s'appuie :
`apprentissage`, `reco-card`, et `frise-semaine` hors son pied.
(`CampaignTable` et `ByLabelTable` figuraient ici : elles ont gagné une colonne
d'écart et un pied — voir plus bas.)

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
| `tracking-section` | deux comptages de même poids au rang 3 | un seul chiffre — `X/Y` actions jugées qui ont bougé la métrique ; `reco_feedback` replié en pied de section ; la liste devient un fil vertical |
| `kpi-focus` (jauge) | noms de paliers en `justify-between` sur des bandes proportionnelles | chaque nom occupe la largeur de sa bande |
| huit blocs de delta recopiés | trois seuils de « stable » différents | `components/pente.tsx` — un seul composant, un seul seuil |

| `PostsMetricChart` (Instagram) | aucun chiffre avant le graphe ; sélecteur au-dessus | même forme que `MetricChart` : total ou moyenne en 34 px + pente, sélecteur sous la courbe |

| `action-top` | aucun chiffre — la section ouvrait sur un titre puis une liste | rang 3 : la part des actions jugées qui ont bougé la métrique, remontée de la section 18 |

| `line-chart` | tout le texte à l'échelle de la largeur : 4,5 px sur téléphone, 17 px sur écran | géométrie en SVG, caractères en HTML ; hauteur en pixels CSS ; info-bulle immédiate à la place du `<title>` natif |
| `kpi-focus` | **deux formes** — une jauge de zones puis une courbe | la jauge est supprimée, les zones passent en fond de courbe : elles disent « où tu es ET depuis quand ». Le seuil courant remonte dans la pastille (`excellent · au-dessus de 5 %`), le `repere` sort du `title=` et devient un `<details>` |
| `kpi-focus` (sélecteur) | neuf pastilles muettes — il fallait cliquer neuf fois pour savoir laquelle regarder | grille de neuf cellules portant nom, valeur et pente, groupées **par terrain** (`Ta pub` / `Ton Instagram` / `Ton site`) et non par source : cinq des neuf agrègent Meta ET Google, une pastille « Google Ads » sur le CTR ferait couper Google à qui croit lire Google |
| `theme-timeline` → `theme-card` | une frise nue, sans bilan, sans lien vers l'action | une carte par thème : bilan avec sa fenêtre, courbe, ligne-ancre vers les actions en cours, repli lecture seule de ce qui a été fait |
| `theme-focus-card` | seconde carte du même thème, 900 px plus bas | **supprimé** — ses conseils et ses campagnes rejoignent la carte de thème |
| `top-recos` | trois `RecoCard` déjà rendues dans leur thème | **supprimé** — remplacé par trois liens vers les thèmes concernés |
| `tracking-section` | le lexique des états vivait dans le module | extrait en `components/etat-action.tsx`, partagé avec la carte de thème |
| `action-top` + `tracking-section` | deux sections pour un objet qui appartient au thème ; le conseil et son résultat à 900 px | **supprimés (615 lignes)** — le cycle de vie entier passe dans la colonne droite de `theme-card` (`rail-actions` + `action-vivante`), avec un filet « hors thème » pour les actions qu'aucune carte ne prend |
| toute boîte en `overflow-y-auto` | aucun signal de défilement ; sur macOS la barre est invisible au repos, un contenu coupé se lit comme un contenu fini | `.defile` dans `globals.css` — ombres de défilement en CSS pur (elles s'éteignent seules quand rien ne déborde) + barre rendue permanente |
| toute rangée en `overflow-x-auto` | une rangée coupée à droite ne se devine pas — elle se lit comme une mise en page ratée, pas comme une invitation à glisser | `.defile-x`, le même mécanisme tourné d'un quart de tour |
| `theme-card` (les conseils) | `sm:grid-cols-2` : trois conseils faisaient deux lignes dont la seconde à moitié vide, et le troisième passait sous la ligne de flottaison de la carte | une rangée unique en `.defile-x`, largeur fixe et hauteur commune, `scroll-snap` par carte — trois conseils s'alignent donc se comparent |
| filet « hors de tes thèmes » → `HorsTheme` | bande pleine largeur en bas de page, sans rang 3, saturée de vingt lignes « est programmée — aucune dépense encore » | module en colonne à GAUCHE de « Ta boussole » : la courbe qui bouge et l'explication de pourquoi elle bouge dans le même écran. Rang 3 = ce qui S'EST PASSÉ ; les « programmée » sont un ÉTAT, pas un événement — repliées en une ligne sous le rail |
| `rail-actions` | une seule voix de plateforme, celle qu'on DÉDUIT de la dépense — aveugle à tout ce qui ne bouge pas le budget du jour | les changements DÉCLARÉS par les API le rejoignent, et priment : même jour + même canal + même campagne, le déclaré efface le déduit. Il nomme la cause, le déduit ne constate que la conséquence |
| `kpi-focus` (la grille des neuf) | `PROVENANCE` n'existait qu'en infobulle ; les trois groupes n'étaient séparés que par six pixels sous un mot gris, donc les neuf cellules se lisaient comme une seule liste | chaque cellule porte les glyphes de ses sources en couleur (cinq sur neuf en portent deux), et chaque groupe devient un bloc encadré avec sa provenance écrite en toutes lettres |
| `EnveloppeAnnee` | le budget FIXÉ en 15 px gris, à peine plus lisible qu'une unité, alors que c'est le second terme de la question posée par la page | 20 px encre et son mot (« 72 000 CHF fixés pour 2026ˮ) ; bilan de trois chiffres en 19 px sur un seul fond : reste de l'enveloppe, posé sur les campagnes, réparti par thème |
| page Coûts (« où ça part ») | un seul anneau, par thème — la répartition par RÉGIE n'avait aucune réponse sur la page | deux anneaux, même filtre et même total : plateforme à gauche (la découpe la plus grossière), thème à droite. `ThemeDonut` gagne `teintes` (forcer les couleurs de canal) et `etroit`, pas un second composant |
| page Coûts (réglages) | un dépliant qui demandait douze nombres pour en produire un, dont le premier primait silencieusement sur l'enveloppe d'année | supprimé ; `budget-year-table` supprimé avec lui ; le mois n'a plus qu'une source (annuel ÷ 12) — un montant qui gouverne une page et qu'aucun écran ne peut plus atteindre est pire qu'un montant faux |
| `LigneTheme` | on posait un budget par thème sans voir l'enveloppe totale, ce qu'il en reste, ni sur quelle plateforme le thème dépense | l'enveloppe et le reste à répartir sous le champ ; la ventilation Meta / Google du thème ; ce qui est posé sur ses campagnes. Liste en trois colonnes, toujours défilante |
| `theme-card` (la note du ROAS) | « 820 CHF revenu · 0,2 ROAS » et, deux lignes plus bas, « le ROAS de ce thème n'est pas mesurable » | `noteSerie(serie, revenu)` — la note ne s'affiche que si le thème n'a AUCUN revenu. Le juge est le revenu, pas la présence d'un ROAS calculé |
| `objectif-select` → `objectif-theme` | un `<details>` écrit à même la page, flottant sous le résumé, à 600 px des cartes qu'il pondère | module à part, posé au-dessus de la première carte de thème ; il prend son thème et son objectif en PROPS, jamais un état global — un objectif par thème se branchera sans le toucher |
| `line-chart` (repères) | deux étiquettes de texte se chevauchaient et se coupaient en haut du graphe ; le plafond de deux repères payait la lisibilité en information | le repère devient un point de 7 px, nommé au survol (bulle immédiate, `focus-within` pour le doigt) — plafond et comptage en pied supprimés |
| page Coûts (les modules) | tous écrits dans `app/couts/page.tsx`, donc invisibles hors session connectée et invérifiables autrement qu'en production | extraits en `components/couts-modules.tsx` ; la page compose, elle ne dessine plus rien |
| `Repartition` | une barre empilée de budgets PRÉVUS, là où la question posée est « combien a été dépensé par thème » | **supprimée** — l'anneau prend sa place pour le réel, et le prévu redescend dans la liste des thèmes (une enveloppe par thème) plus une ligne de réconciliation dans le module de l'année |
| `theme-donut` | typé sur `ThemeRow`, donc réservé au rapport hebdomadaire | prend `{label, spend}[]` — `ThemeRow` le satisfait sans rien changer, et la page Coûts s'en sert sans fabriquer de faux revenu à zéro. Sur téléphone la légende passe SOUS l'anneau : à côté, il lui restait 150 px et « Audio Tour » s'écrivait « Aud… » |
| `EnveloppeAnnee` (page Coûts) | le total annuel s'affichait sans dire d'où il venait | provenance écrite en pied, et le texte change avec la branche empruntée — *entrée périmée le 13 août 2026 : il n'y a plus de branche à nommer, voir ci-dessous* |
| `Tuile` « Dépensé / Enveloppe / Reste » | trois lectures du même mois, dont deux dérivées l'une de l'autre | trois cadrages qui ne se déduisent pas : budget annuel, budget mensuel, moyenne quotidienne réelle — deux promesses et un fait |
| `EnveloppeAnnee` (scindé) | un module pleine largeur portait DEUX gestes de fréquence opposée : décider l'enveloppe (une fois l'an) et surveiller la dépense (chaque semaine). Le champ qui commande toute la page finissait sous une barre, trois bilans et deux plateformes | scindé en deux. `EnveloppeAnnee` prend 1/3 à gauche : rang 3 = l'enveloppe fixée en 34 px, le seul nombre dont le mois, le jour, les alertes et toutes les barres descendent. **Aucune forme** — la rangée n'en porte qu'une, et elle appartient au voisin. Le champ passe au rang 8, collé en bas par `mt-auto` pour que les deux cartes finissent à la même ligne |
| `DepenseAnnee` | *(nouveau, issu du même découpage)* | 2/3 à droite. Rang 3 = le dépensé depuis janvier en 34 px, **sans dénominateur collé** : l'enveloppe est déjà en 34 px à gauche, la répéter donnerait deux fois le même nombre sur une rangée. Une seule forme, la barre + son trait de calendrier, encadrée de ses deux bornes écrites — le pourcentage à gauche, `sur X CHF` à droite |
| `lib/couts` (la préséance) | l'annuel avait trois branches — saisi, somme des deux plateformes, somme des douze mensuels — et les éditeurs des deux dernières ont été supprimés de l'écran | **plus aucune préséance** : `budgetAnnuel` vaut ce qui a été tapé, ou zéro. Même règle par thème. Ce qui reste en base n'est pas détruit et l'écran le DIT (`budgetAnnuelHerite`, `budgetYearHerite`) — un réglage qu'on abandonne se raconte, il ne s'efface pas en silence |
| `LigneTheme` (le dénominateur) | un thème dont le champ Enveloppe affichait 0 se voyait quand même reprocher « 61 % de l'enveloppe » : le budget d'année retombait sur la somme de ses douze mensuels. Seuls les thèmes ayant un vieux mensuel étaient touchés — la page semblait juger certains thèmes et pas d'autres, sur un nombre que personne n'avait tapé | **aucune enveloppe estimée**. Une enveloppe est saisie ou absente ; sans elle, un thème affiche sa dépense et se tait — ni barre, ni pourcentage, ni dénominateur. Soit on juge tout le monde, soit personne |
| `LigneTheme` (les cartes) | trois colonnes séparées par un seul filet partagé (`gap-px bg-line`) qui ne courait pas sur les quatre côtés : deux cartes voisines se lisaient comme une seule zone | bordure complète, arrondi et air autour de chaque carte. Le fond du contenu reste TRANSPARENT — `.defile` peint ses ombres derrière lui, un fond opaque les éteindrait |
| `LigneTheme` (le pied) | « Tes budgets mensuels ne font plus une enveloppe » posé au rang 9, SOUS le champ : les deux cartes qui le portaient voyaient leur champ remonter de 114 px, dans un module dont le rang 8 dit que des champs à trois hauteurs différentes se cherchent | la phrase est un fait sur la DONNÉE du thème, pas une convention de lecture : elle fond dans celle du rang 7. Le module n'a plus de rang 9. **Règle générale : `mt-auto` ne tient sa promesse que s'il pousse un élément SEUL** |
| page Coûts (le zéro) | « 0 CHF » écrit là où rien n'avait été relevé, et là où rien n'est réglé — le même signe pour une ignorance et pour un constat | un vide se dit en toutes lettres, et les deux vides n'ont pas le même mot : « au prochain relevé » quand la mesure n'a pas eu lieu, « rien de réglé en ce moment » quand elle a eu lieu et vaut zéro. Un zéro non mesuré présenté comme mesuré est un chiffre faux |
| `alerte-themes` | *(nouveau)* le rapport ne disait nulle part qu'une partie de l'argent n'entre dans aucun bilan par thème — les cartes de thème sont muettes sur ce qu'elles ne voient pas | version courte de `labels-couverture`, posée ENTRE la section 1 et la section 2 : la section 1 ne filtre rien, la section 2 filtre tout par thème, et c'est exactement là que le trou apparaît. Le chiffre vient de `getCouverture()`, la fonction de la page Thèmes — pas d'un second calcul « à peu près pareil ». Aucune forme : un module dont la vertu est d'être court n'ajoute pas une barre. **Il disparaît quand rien n'échappe** — un bloc qui dit « tout va bien » chaque lundi s'apprend par cœur en trois semaines |
| `theme-card` (le pli) | trois cartes font un rapport, quinze font un couloir de 14 000 px où le douzième thème n'est jamais lu | au-delà de trois cartes, les suivantes ARRIVENT fermées — jamais supprimées : quand une forme ne tient pas à plusieurs, on change la forme, pas le nombre d'éléments. **Une carte repliée garde ses rangs 1 à 5** (nom, chiffre de tête, pente, bilan) ; seuls la forme et le détail attendent un clic. Exception : un thème qui porte une action vivante ne se replie jamais, sinon le raccourci du hero atterrit sur un bloc fermé et se lit comme un lien cassé — *entrée périmée le 15 août 2026 : le pli est supprimé avec l'empilement, voir `themes-carrousel` plus bas* |
| `theme-card` (sans pistes IA) | un thème au-delà de la troisième étoile n'a pas de conseil rédigé par l'IA — un vide non expliqué se lit comme une panne, ou pire comme « rien à signaler » | à la place exacte où les pistes auraient été, une phrase grise (jamais rouge : rien n'a échoué) qui dit POURQUOI et QUOI FAIRE — retirer une étoile posée avant. Le payload porte `ia_redigee`, et son ABSENCE vaut « oui » : un rapport publié avant ne se voit pas coller une explication qui n'a rien à y faire |
| `site-client` | *(nouveau)* le site du client n'était saisissable qu'à l'onboarding — un réglage qu'on ne pose qu'une fois devient faux le jour où le client change de domaine | module sur `/comptes`. Rang 3 = **le domaine lui-même**, et le vide s'y écrit en toutes lettres. Rang 7 = à quoi il sert, APRÈS le chiffre — sans cette phrase, un champ « ton site » sur une page de connexions ressemble à un réglage sans objet. Rang 9 = la limite : on stocke l'adresse, on ne la visite pas. **Le rang 3 n'affiche que ce que le serveur a renvoyé** — « boutique.ch » se stocke « https://boutique.ch/ », afficher la saisie montrerait une valeur que la base ne contient pas |
| `OnboardingCard` (l'échec) | l'action jetait sans session : la frontière d'erreur démontait le TOUT PREMIER écran du produit, et les réponses partaient avec — sans un mot | l'action REND `{ok, message}` au lieu de jeter. **Règle : une action appelée depuis un écran qui porte de la saisie non enregistrée ne jette jamais** — jeter, c'est effacer sans le dire. Deux natures d'erreur, deux traitements : un refus d'ADRESSE colore le champ, un échec de SESSION ne le colore pas (accuser le champ envoie corriger ce qui est juste) et commence par ce qui rassure — les réponses sont toujours là |
| `DepenseAnnee` (le détail) | deux lignes fermaient le module (« ▣ Meta 29 % », « ◆ Google 71 % ») pendant qu'un anneau de la même page disait la même chose — et elles lisaient l'ANNÉE quand l'anneau obéit au filtre : sur une période filtrée, la page affichait deux partages contradictoires | supprimées, et le calcul avec (`ChannelCout` n'existe plus) — un calcul qu'on garde sans l'afficher se remet à diverger en silence. **Règle : une même information ne se dessine pas deux fois sur une page ; entre une liste et une forme, c'est la forme qui reste** |
| page `/labels` | aucun module, aucun rang 3 : une liste de thèmes et un compteur d'usage, rien qui montre ce qui n'a PAS de thème | trois modules extraits en `components/labels-*.tsx` — la page compose. Rang 3 = **le budget qui échappe aux thèmes**, jamais le compte de lignes : douze campagnes peuvent être douze essais à 4 CHF, un montant fait ouvrir la liste. Le comptage descend au rang 7 |
| `labels-couverture` (Instagram, et le vide) | une publication organique ne coûte rien : l'additionner au montant, c'est ajouter zéro en prétendant mesurer ; et un compte sans dépense relevée aurait lu « 0 CHF ne sont rattachés à aucun thème », vrai et parfaitement trompeur | l'organique est une troisième colonne en NOMBRE et le pied écrit l'asymétrie ; `mesurable: false` bascule le rang 3 sur un comptage et la barre disparaît — une barre sur un dénominateur nul est du décor |
| geste de masse IA | le bouton étiquetait sans validation ET sans retour en arrière | l'annulation est bornée par une DATE (posée par un trigger Postgres, pas par l'application — trois programmes écrivent ces labels) et non par la source : « tout ce qui porte IA » aurait emporté ce qui était gardé depuis trois semaines. **Règle : une action de masse se borne par le moment où on l'a lancée, jamais par sa signature** |
| `setCampaignLabel` / `setPostLabel` | retirer un thème posait la marque « choix humain » sur une ligne VIDE — la campagne devenait invisible à l'IA pour toujours | la marque protège un CHOIX, pas un vide : elle repart à `null` avec le label |
| `side-nav` | huit entrées à plat : le rapport hebdomadaire, la page du lundi matin, ouvrait une liste où « Équipe » pesait autant que lui ; le repli vivait dans `localStorage`, donc la colonne se peignait à 240 px puis sautait à 64 px à CHAQUE navigation | le rapport sort de la liste, seul en tête et sans en-tête — ce qui est seul n'a pas besoin d'être nommé ; trois groupes qui répondent chacun à une question (`Où va l'argent`, `Tes canaux`, `Réglages`), rangés par fréquence d'usage. « Où on en est » disparaît : ses informations descendent SOUS l'entrée qu'elles qualifient. Sur téléphone un tiroir remplace la frise — une frise n'a pas de sections |
| `jour-recolte` | *(nouveau)* le jour de récolte n'avait aucun écran dans Pulse | rang 3 = le jour SERVI, en français avec sa date (« lundi 17 août »), pas la valeur stockée (`Monday`) ; aucune forme — les sept jours cliquables sont le rang 8. Le pied dit la limite qui rend le réglage honnête : la récolte tourne à heure fixe, on choisit un jour, pas une minute |
| `MoyenneMensuelle` (pages canal) | *(nouveau)* | la moyenne d'un mois posée AVANT la courbe, sur les trois canaux. Deux natures de chiffre : le mois d'un total est une SOMME, celui d'un taux un RAPPORT calculé sur les totaux du mois — moyenner trente taux quotidiens donnerait au dimanche à 12 impressions le poids du mardi à 4 000. Un mois sans dénominateur vaut `null`, jamais 0 |
| `line-chart` (le socle) | l'axe partait toujours de zéro — juste pour un flux, faux pour un CUMUL : 4 120 → 4 244 abonnés est un trait plat | `socle="bas"` : axe tronqué, **les deux bornes écrites aux coins**, et l'aplat supprimé (une aire sur un socle arbitraire exagère ce qu'elle remplit). Verrouillé dès qu'il y a une bande ou un seuil — ceux-là portent déjà l'échelle |
| `frise-semaine` (les publications) | UNE bande d'un seul rang : deux publications le même jour se fondaient en « ×2 », le module montrait un NOMBRE là où on vient chercher des objets datés | quatre à six rangs, les publications s'empilent, le compteur ne sert plus que de débordement, et la bande porte son titre à l'intérieur |
| `CampaignTable` (Google) | une campagne sans détail restait dépliable : curseur de main, fond au survol, clic, ouverture SUR RIEN — et un pied qui promettait le geste | sans détail, la ligne redevient une ligne, et le pied dit pourquoi. **Un geste promis qui ne peut pas aboutir se lit comme une panne, pas comme une absence de donnée** |
| `HorsTheme` | module dessiné à l'intérieur de `app/page.tsx` — donc invérifiable autrement qu'en production, la page étant derrière `middleware.ts` et lisant un vrai compte | extrait en `components/hors-theme.tsx` ; une page compose, elle ne dessine pas (même raison que `couts-modules`) |
| `HorsTheme` (la liste) | liste rendue en entier : la colonne s'allongeait sans limite | `.defile` posé sur le SEUL rail — l'en-tête (surtitre, chiffre, phrase) et le pied restent fixes. Un module dont l'en-tête défile perd ce qui nomme son nombre |
| rangée « boussole + hors-thème » | `items-start` : chaque carte finissait où elle voulait, un vide sous la plus courte | `items-stretch`, et la carte du filet SORT DU FLUX de sa cellule (`lg:absolute lg:inset-0`) — sans quoi c'est son contenu, non son voisin, qui fixe la hauteur de la rangée : 27 lignes réclamaient 2 000 px et la boussole flottait dedans. Sous `lg` il n'y a plus de rangée dont hériter : flux normal et plafond en `vh` |
| `HorsTheme` (le vide) | hauteur imposée par la rangée + `flex-1` sur la zone défilante = 800 px de blanc **entre** la liste et le pied, celui-ci plaqué au bas de la carte | `flex-initial min-h-0` : la zone prend *au plus* la place restante, jamais *exactement*. **Règle : une carte dont la hauteur est imposée par sa rangée laisse son vide SOUS le dernier rang, jamais entre deux rangs** — au milieu, il se lit comme un contenu manquant ; en bas, comme de la respiration |
| `kpi-focus` (les deux « confondus ») | l'en-tête « Meta et Google confondus » basculait dès qu'UNE cellule du groupe portait une clé nue — sur un rapport ancien qui porte aussi le ROAS, le ROAS se retrouvait sous « ↻ Recharger mes conseils les sépare », une promesse fausse : aucun rechargement ne séparera un revenu que GA4 donne pour tout le compte | deux groupes au lieu d'un drapeau. Le ROAS est confondu PAR NATURE, une clé nue l'est PAR ANCIENNETÉ : `G_DEUX_ANCIEN` devient un vrai groupe rendu par `terrain()`, prend sa place dans `ORDRE_GROUPES` (du plus séparé au moins séparé) et sa phrase dans `PROVENANCE` — `provenance()` perd son exception |
| `fetch-button` (le panneau de récolte) | le panneau était figé à `w-64` et FLOTTAIT `right-0 top-full` dans une colonne qui n'offrait que 215 px : il commençait à x = −29 et finissait 34 px sous la fenêtre. Ces deux coupes étaient définitives — `scrollWidth` valait `clientWidth`, et la colonne étant `sticky`, aucun défilement ne les rattrapait. « Classement des contenus par l'IA » se lisait « ssement des contenus par l'IA » | **la largeur du module vient d'une MESURE, pas d'un arrondi** : sa rangée la plus large (l'étape la plus longue 184,4 px + gouttière 8 + chrono 31,5 + cadre 26) réclame 249,9 px, d'où une colonne de 280 px. Et le panneau se range DANS LE FLUX (`w-full`, placé avant le bouton) au lieu de flotter : en flux il ne peut par construction ni sortir à gauche ni passer sous la fenêtre, et il ne recouvre plus le sélecteur de compte pendant les seize minutes d'une première récolte. **Règle : un module qui vit dans une colonne prend la largeur de sa colonne ; ce qui flotte doit prouver qu'il a la place des deux côtés** |
| `fetch-button` (le bouton) | quatre libellés, quatre largeurs — 108,3 px au repos, 33,2 px pendant l'envoi, 95,2 puis 101,4 px quand le pourcentage passait à deux chiffres, 189,2 px à l'arrivée. Le bouton fondait et regonflait pendant la récolte, et tirait à lui tout ce qui l'entourait | une seule boîte pour toutes les phases (`w-full` en colonne, plancher de 112 px ailleurs) et **le chiffre quitte le bouton pour rejoindre la forme qu'il décrit** : le pourcentage se pose au bout de la barre de progression, où la barre `flex-1` absorbe seule l'écart entre 4 % et 92 %. Le bouton se contente de « ◌ récolte ». **Règle : un chiffre se pose contre la forme qui le représente, pas dans le déclencheur ; et un libellé qui change ne doit jamais changer la boîte** |
| `side-nav` (la largeur) | 240 px justifiés par deux raisonnements faux : « le bloc du bas cesse d'être compressé » (il l'était déjà — la rangée pastille + sélecteur réclame 276,9 px et n'en recevait que 215) et « au-dessus de 1 024 px de contenu la rangée boussole + hors-thème se replie » (1 024 px est le point de rupture `lg` de Tailwind, donc une largeur de FENÊTRE ; la colonne étant elle-même `hidden lg:flex`, aucune largeur de barre ne peut le déclencher) | 280 px sur écran ET dans le tiroir, un seul nombre issu de la mesure ci-dessus. Le coût est écrit dans le code : 1 040 → 1 000 px de contenu à 1 280. **Règle : une largeur se justifie par une mesure et s'accompagne de ce qu'elle coûte — un seuil invoqué de mémoire se vérifie avant d'être invoqué** |
| `triggerFetch` / `triggerClassify` / `triggerReport` / `checkFetchStatus` | quatre copies du même bloc, et un seul message pour tout ce qui n'est pas 204 : « GitHub a répondu 401 — vérifie le token ». Un code HTTP n'est pas un message : on ne « vérifie » pas un jeton révoqué, on en refait un, et 401, 403 et 404 demandent trois gestes dans trois endroits différents | un `lancerWorkflow()` unique et un `messageGitHub()` qui traduit chaque code en son geste. **Règle : un message d'erreur nomme la VARIABLE, jamais sa valeur** — il part vers le navigateur et finit dans une capture d'écran |
| `themes-carrousel` | *(nouveau)* les cartes de thème étaient empilées, et une carte mesure 894 px pleine contre 296 px vide (mesuré à 1 280 × 800) : cinq thèmes faisaient un couloir de plusieurs milliers de pixels. Le PLI — les cartes au-delà de la troisième arrivant fermées — ne répondait pas à la question : replier ne dit pas qu'on lit le thème 2 sur 5, et une carte fermée quatre écrans plus bas reste une carte qu'on ne va pas chercher | **une carte à la fois.** Le SOMMAIRE qui existait déjà devient la barre d'onglets (`role="tablist"` / `role="tab"` / `role="tabpanel"`, `tabindex` glissant, ← → Home End) plutôt qu'un troisième dispositif à côté ; flèches précédent/suivant avec `aria-label` nommant le thème visé, et « 2 / 5 » entre elles. **Pas de bouclage** — sur une liste courte et ORDONNÉE, la seule question est « ai-je tout vu », et un anneau est justement la réponse qu'on ne veut pas ; le clavier suit la même règle, le motif ARIA laissant le bouclage optionnel. **La hauteur suit chaque carte** : l'écart de 598 px entre deux voisines est entièrement sous la ligne de flottaison d'une fenêtre de 800 px, verrouiller n'achèterait aucune stabilité visible et ouvrirait autant de blanc en pied. Les panneaux restent dans le DOM (`hidden`, pas démontés) — une note à moitié tapée survit au changement d'onglet et les ancres `#theme-…` restent résolvables. `OUVERTES`, `estReplie`, la prop `replie` et le `▾` du sommaire disparaissent avec le pli |
| section « Tes thèmes prioritaires » | deux étoiles posées, **trois cartes à l'écran** : le worker ajoutait à `theme_list` le thème d'une campagne lancée depuis moins de 14 jours, même jamais étoilé. Le rapport affirmait une priorité que le client n'avait pas choisie | le bloc est retiré du worker. **Règle : sous un titre qui dit ce que le client a choisi, il n'y a que ce que le client a choisi.** Le signal n'est pas perdu et n'avait jamais eu besoin de ce bloc : `changements` parcourt TOUTES les campagnes et un fait dont le thème n'a pas de carte tombe par construction dans le filet « Ce qu'aucun thème ne prend » — le doublon sortait simplement sous le mauvais titre. Un garde-fou d'affichage rattrape les payloads déjà publiés (même procédé que les « est programmée » de `rail-actions`), en se réglant sur la liste VIVANTE des étoiles : `ObjectifTheme` l'affiche 40 px au-dessus des cartes, les deux doivent dire la même chose |
| `theme-card` (les conseils) | sous « COMMENT L'AMÉLIORER CETTE SEMAINE », une seule phrase : « Rien d'urgent sur ce thème cette semaine — il tourne dans ses normes ». Un module qui s'annule lui-même, et une affirmation fausse une fois sur deux. **Mesuré** : 3 cartes vides sur 18 dans les rapports déjà publiés, et 17 sur 120 au rejeu de 12 semaines sur 2 comptes réels — une carte sur sept. Sur ces 17, onze étaient un thème MORT depuis dix semaines et six un thème à 300-1 100 CHF par semaine sur un compte sans GA4. Aucun des deux ne « tourne dans ses normes » | le vide se comble **dans le worker**, pas par une phrase de repli : `_reco_theme_arret` (le thème pub qui s'arrête — le pendant de `_rule_silence`, qui n'existait que pour l'organique) et `_reco_theme_calme`, un filet qui passe APRÈS les règles et après l'IA, donc sans jamais prendre une place. **Ce sont des veilles, pas des conseils** : clé `veille_…`, donc pas de « ▶ Je le teste », pas de `PROOF_KPI`, aucune promesse de mesure sur une décision qu'on n'a pas prise. **Règle : une carte ne dit jamais « rien » — elle dit ce qu'elle regarde, entre quelles bornes, et ce qui manque pour en dire plus.** Et elle ne peut pas resservir trois lundis de suite : quatre textes, choisis par le nombre de rapports consécutifs sans conseil, dont le dernier pousse à retirer l'étoile |

| `MoyenneMensuelle` → `Moyennes` (pages canal) | le module était mensuel EN TOUTES CIRCONSTANCES. Sur « 7 jours » il n'avait aucun mois entier à moyenner et écrivait qu'il n'avait rien à dire : **le filtre le vidait au lieu de le déplacer** — le défaut déjà corrigé sur les formats et les thèmes d'Instagram, où un filtre qui ne change rien à l'écran a l'air cassé. Sur Instagram il ne suivait même pas le filtre : il lisait `allPosts` et une fenêtre « premier post → hier » écrite en dur | **l'unité suit la fenêtre**, et la règle tient en une phrase : *on moyenne ce qui se répète au moins deux fois dans la fenêtre*. Deux mois entiers ou plus → le MOIS ; sinon l'unité descend d'un cran, au JOUR pour la publicité, à la PUBLICATION pour Instagram. Un seul mois entier ne fait pas une moyenne, c'est ce mois-là — le module ne l'écrit plus, il change d'unité. **Le dénominateur est dans le titre et la fenêtre juste après** (« Tes moyennes par jour · 7 jours · 11 aoû → 17 aoû 2026 ») : les deux bougent avec le filtre, et une moyenne dont la fenêtre change sans le dire se lit comme la même qu'avant. Le test du mois entier ne bouge pas d'un iota. **Zéro n'est jamais écrit à la place d'un vide** : sans publication dans la fenêtre, le rang 3 disparaît au profit d'une phrase — et le rang 9 se tait avec lui, « moyenne des 0 publication » reprenant d'une main ce que le vide donnait de l'autre. La branche mensuelle d'Instagram, elle, DIT que ses zéros sont mesurés quand rien n'a été publié. Enfin le module lit `dailyComplet`, non plafonné : `daily` est bornée à 120 points pour rester lisible en graphe, et une moyenne calculée sur 120 jours sous un titre qui dit « Tout » est un chiffre présenté pour autre chose que ce qu'il mesure |
| module « Tes moyennes par post » (Instagram) | **deux boîtes « Tes moyennes » l'une sur l'autre** — six chiffres à plat sur tout l'historique, puis la moyenne mensuelle. Elles ne se distinguaient que par leur DÉNOMINATEUR, jamais écrit ailleurs que dans un surtitre | **supprimé**, et ses quatre agrégats (`avgLikes`, `avgComments`, `avgSaved`, `avgViews`) avec lui — un chiffre qu'on continue de produire sans l'afficher se remet à diverger en silence. `histReach` et `avgEng` restent : ils servent le seuil « au-dessus de ton post moyen » et la tuile « Engagement du compte », deux lectures d'historique assumées. Le module qui reste répond aux deux questions, puisque son unité suit désormais la fenêtre |
| `Comparer` | *(nouveau)* aucune page canal ne pouvait mettre deux périodes en regard : les tuiles portaient un « vs période préc. » et rien ne permettait ni d'en changer, ni de VOIR ce que l'écart recouvrait | un module partagé sur les trois canaux, à `components/comparaison.tsx`. Rang 3 = la métrique de tête sur la période affichée, rang 4 le verdict, puis un bilan des autres métriques, **puis** la forme. **La forme est une frise : les deux périodes sur le même axe** — « +18 % » ne dit pas si la hausse vient d'un pic de deux jours ou d'un niveau tenu quinze, et ce sont deux nouvelles opposées. Le chiffre dit COMBIEN, la frise dit COMMENT, dans cet ordre. **L'alignement se fait PAR LA FIN, pas par les dates** : les deux fenêtres sont à des dates différentes par construction, un axe de dates réelles donnerait deux tracés qui ne se comparent pas — le dernier jour de chaque fenêtre est mis en face de l'autre et l'axe porte le rang du jour (« −13 j », puis « fin »). La fenêtre courte démarre plus loin sur l'axe, complétée de `null` : rien n'est étiré, rien n'est interpolé. Forme écartée : deux barres appariées par métrique — elle redisait le pourcentage en plus gros, là où le jour par jour n'existe nulle part ailleurs sur la page. **Quatre refus explicites plutôt que quatre approximations** : une référence qui déborde de la couverture des données, une référence qui CHEVAUCHE la période affichée (les journées communes seraient comparées à elles-mêmes), une référence sans aucune ligne relevée, et un dénominateur nul — `pct()` rend `null`, on écrit le mot, jamais « +∞ % ». **Longueurs inégales : tout ce qui s'additionne est ramené au jour**, les taux ne bougent pas, et le prix est écrit au rang 9 ; refuser était l'autre option, écartée parce que le client vient de choisir ces deux plages. « L'an dernier » recule de **52 semaines pile**, pas de 365 jours — un lundi doit retomber sur un lundi. Ce qu'il ne compare pas est au rang 7, replié : pas de comparaison par campagne (`by_campaign` n'est pas daté), pas de revenu ni de ROAS (GA4 rend le revenu au niveau du COMPTE) |
| `customWindow` | la période sur mesure prenait la date tapée telle quelle : « du 1er au 17 août » choisi le 17 août comparait dix-sept jours dont un incomplet à dix-sept jours pleins. **La règle de la maison tombait exactement là où l'utilisateur avait choisi ses bornes lui-même** | rognage au dernier jour plein, comme `makeWindow`, et le libellé porte « · jour en cours exclu » quand il a mordu. Une fenêtre qu'on raccourcit sans le dire est pire qu'une fenêtre fausse |
| six constructeurs de liens → `lib/liens.ts` | le réglage de comparaison ne survivait pas à un clic sur la période, la métrique ou un filtre : on posait « l'an dernier », on ajustait la métrique, et la page revenait à « période précédente » **sans que rien ne l'annonce**. Rien de faux à l'écran, une URL parfaitement valide, et deux périodes que personne n'avait demandées — la pire catégorie de défaut, silencieuse et plausible. Le même mécanisme faisait perdre au sélecteur de métrique d'Instagram le tri ET la période sur mesure, depuis bien avant | **le défaut n'était pas qu'ils étaient six, c'est qu'ils énuméraient ce qu'ils GARDENT.** `qs()` + `keepFilters()` listaient statut, campagne et thème ; les trois constructeurs d'Instagram listaient `m` et `s`. Un lien bâti ainsi perd par construction tout paramètre ajouté après lui. **Règle : un lien énumère ce qu'il CHANGE, jamais ce qu'il garde** — un septième paramètre ajouté demain traversera les six liens sans qu'on y pense, et c'est la seule forme de correction qui ne se redéfait pas. Les paramètres d'URL voyagent donc avec le dashboard (`ChannelDash.params` / `InstaDash.params`) pour que chaque module reparte de l'état COMPLET. Une seule exception codée explicitement : `d` et `from`/`to` désignent la même chose et se chassent l'un l'autre — les laisser cohabiter rendrait les pastilles de période inertes, `customWindow` primant sur `makeWindow`. **Et un réglage conservé qui ne s'applique plus dit les DEUX choses** : les états de refus de `Comparer` écrivent maintenant « ton choix est conservé — il est toujours sélectionné ci-dessous », parce qu'un utilisateur qui lit un refus sous une pastille allumée croit sinon avoir perdu son choix |
| `DateRange` | un seul jeu de paramètres (`from`/`to`) et un `q.delete("d")` en dur — le module de comparaison avait besoin du même objet sur d'autres noms | `champs`, `efface`, `pose` et `etiquette` en props, valeurs par défaut inchangées. **Un second sélecteur de dates aurait divergé sur le détail qui compte** : ici le refus silencieux quand la fin précède le début |
| `ByLabelTable` · `CampaignTable` · `ByLabelInsta` (l'écart en ligne) | le module `Comparer` mettait deux périodes en regard **pour le compte entier**, et les deux tables posées juste dessous continuaient de ne montrer que la période affichée. La question qui vient après « le compte a baissé de 18 % » est « QUI a baissé » — et la page n'avait aucune réponse : il fallait changer la période à la main, relire la table, et retenir les chiffres | **une couche, pas une refonte** : sans comparaison, les trois tables sont identiques au pixel près. Avec, une **colonne d'écart en fin de ligne**, sur la métrique qui pilote déjà la page. Formes écartées : une colonne par métrique (elle double une table qui défile déjà, et répond sept fois « combien » quand on demande « qui ») et une seconde valeur sous chaque chiffre (elle allonge toutes les lignes, et une cellule qui doit parfois écrire « 1re donnée 14 aoû » casse la colonne de chiffres où elle vit). **Aucune règle de comparaison n'est réécrite** : `batirComparaison` rend une `ventilation` par table, et la met à `null` dès qu'un des quatre refus s'applique — les tables n'ont donc rien à tester, un second exemplaire de cette liste aurait divergé comme les six constructeurs de liens avant elle. **Une ligne présente d'un seul côté n'a pas d'écart, et les deux absences ne se disent pas pareil** : *naissance* (« 1re donnée 14 aoû » — la date est mesurée, donc vérifiable) quand rien n'existe avant la fin de la référence, *silence* (« rien sur la réf. ») quand la ligne existait et n'a rien porté. Ni « +100 % », ni « nouveau » posé sans preuve. Les lignes DISPARUES ne sont pas ajoutées à la table — elle liste la période affichée — mais comptées et **nommées** en pied. **Le tri par écart suit la variation en VALEUR, jamais le pourcentage** : un thème passé de 2 à 20 CHF fait « +900 % » et n'explique rien, un tri par pourcentage est une machine à mettre le bruit en tête. Les lignes sans écart ferment la liste, classées entre elles. Il voyage par `tri=ecart` dans `lienDash`. **Une table de POSTS ne peut pas porter d'écart** : une publication appartient à la seule période où elle a été publiée, la colonne n'aurait que des naissances — c'est écrit en pied. Et `by_campaign` interdisait le revenu par campagne, pas la dépense : `meta_ads_insights` et `google_ads_insights` sont datées par campagne, la limite portait sur le REVENU et les confondre aurait interdit une comparaison que les données portent. `ByLabelInsta` sort au passage d'`app/instagram/page.tsx` — dessiné dans une page protégée, il n'était vérifiable qu'en production. Et `CampaignTable` tire enfin sa largeur minimale de ses colonnes : le `min-w-[820px]` écrit à la main était SOUS la somme réelle des pistes (940 px), la grille débordait de son cadre sans le faire défiler — `scrollWidth` valait `clientWidth`, la dernière colonne était coupée et inatteignable |
| `theme-evenements` | *(nouveau)* le funnel GA4 était **six noms d'événements écrits en dur** dans `google_script/fetch_ga4.py` (`view_item`, `add_to_cart`, `begin_checkout`, `add_payment_info`, `purchase`, `generate_lead`), devinés pour un e-commerce standard. Un site qui nomme ses conversions autrement ne remontait RIEN, et aucun écran ne le disait — on devinait les noms d'un tiers à sa place, et son rapport était muet sans qu'il sache pourquoi | un module sur `/labels` où le client coche, thème par thème, des événements pris dans **sa** vraie liste (dimension `eventName` sans filtre, une ligne par nom — quelques dizaines, contre une table `ga4_events` déjà paginée à des dizaines de milliers de lignes avec six noms : le CATALOGUE et le DÉTAIL QUOTIDIEN sont deux besoins, un seul coûte cher). Rang 3 = **les thèmes qui portent des campagnes sans savoir ce qu'ils comptent**, jamais le nombre d'événements disponibles : une liste de conversions ne fait rien faire à personne, un thème qui dépense sans verdict fait ouvrir la liste. **Principal / secondaire est un CHOIX, pas un import** : GA4 ne connaît qu'un booléen (`properties.keyEvents` n'a pas de champ de rang, la dimension `isKeyEvent` est binaire), le couple vient de Google Ads et de `primary_for_goal`. Fabriquer un import aurait été inventer une donnée que la plateforme ne donne pas — et le choix est plus juste : `purchase` porte le verdict d'un thème de vente et situe seulement un thème de notoriété. **Cinq vides, cinq phrases** (pas de propriété · jamais récolté · propriété muette · aucun thème · tout est réglé) — écrites en une seule version, elles affichaient « thèmes portent des campagnes mais aucun événement principal » sous un « 0 » dont la pastille disait « tous tes thèmes savent quoi compter ». **Règle : un thème purement organique se NOMME, il ne s'affiche pas en zéro** — une publication n'a pas de lien tagué, le pont passe par `utm_campaign` et rien d'autre, donc la conversion y est impossible et non pas manquante |
| `objectif-par-theme` | *(nouveau)* `objectif-theme.tsx` l'annonçait déjà dans son en-tête : « un seul objectif pour l'instant, partagé par tes N thèmes — c'est ici que ça se réglera quand chaque thème aura le sien ». Deux thèmes prioritaires n'ont pourtant pas la même vocation, et `profiles.objectif` restait unique par compte, forçant tous les thèmes au même indicateur | un module sur `/labels`, juste au-dessus de `theme-evenements` dont il compose la lecture (`getThemeEvenements`, inchangée) sans jamais la modifier — table `theme_objectifs`, même patron que `theme_ga4_events` : l'ABSENCE de ligne est le « hérite », pas un troisième état stocké. **Rang 3/4 sans ton d'alarme** : contrairement au module voisin, hériter n'est pas un manque à combler — c'est le réglage tel qu'il a toujours été pour tout compte qui n'y touche pas, donc le rang 4 reste gris tant que rien n'est choisi, jamais rouge. **Objectif et conversions dans le même bloc** : choisir « plus de ventes » sans dire quel événement GA4 porte ce verdict ne dirait encore rien, donc un sélecteur de conversions équivalent à celui de `theme-evenements` est redessiné pour le seul sous-ensemble étoilé — même geste, même server action (`setThemeEvent`), donc pas une seconde vérité (l'exception documentée plus haut : « un même geste peut avoir deux points d'entrée s'ils écrivent la même ligne par la même server action »). **Uniquement les thèmes étoilés** : le reste du rapport suit l'objectif du compte sans exception, et ce module ne montre que ce sous-ensemble, filtré sur `insight_feedback` |
| `objectif-theme` | l'arrivée d'`objectif-par-theme` (ci-dessus) a rendu deux phrases FAUSSES sans y toucher : le résumé affichait « commun à tes N thèmes » et le pied promettait « c'est ici que ça se réglera quand chaque thème aura le sien » — alors que le réglage existe déjà, ailleurs, et que « commun » ne l'est plus dès qu'un thème a le sien. Un module qui affirme une limite qu'il vient de perdre ment plus qu'il n'informe | le module compare désormais l'objectif EFFECTIF de chaque carte affichée (`t.objectif`, écrit par le worker — le sien s'il en a un, sinon celui du compte), pas `profiles.objectif` seul. `commun` (calculé par l'appelant, `app/page.tsx`) tranche entre trois affichages : un seul thème → « pour {thème} » (+ « objectif propre » s'il en a un) ; plusieurs et vraiment communs → « commun à tes N thèmes » (texte inchangé, condition vérifiée) ; plusieurs et pas communs → « X sur N ont leur propre objectif ». Le pied suit la même bascule et nomme enfin où ça se règle réellement (`/labels`, lien `◫ Thèmes →`) au lieu de promettre un « un jour » révolu. **Absence rétrocompatible** : `t.objectif` manque sur les payloads publiés avant cette fonctionnalité, et retombe alors sur `data.objectif` (le compte) — le comportement d'avant, à l'identique. **Deux défauts supplémentaires trouvés à la relecture, corrigés dans la foulée** : (1) la première correction avait fait porter `t.objectif` (effectif d'un thème) à LA MÊME prop que celle lue par `<ObjectifSelect>`, qui écrit `profiles.objectif` — le sélecteur affichait alors une valeur que son propre `onChange` n'écrirait pas dès que le thème en tête avait son objectif propre. Scindé en deux props, `objectifCompte` (toujours `profiles.objectif`, pour le sélecteur) et `objectifEffectif` (pour le mot du résumé) — un sélecteur qui ÉCRIT une valeur ne peut jamais AFFICHER une autre valeur que celle-là ; (2) le pied écrivait « tant qu'aucun n'a le sien » dès que `commun` était vrai, mais `commun` compare des VALEURS, pas des SOURCES — deux thèmes peuvent converger sur le même objectif alors que l'un l'a choisi explicitement. Le pied vérifie maintenant `nbPropre` en plus de `commun`, avec un troisième texte pour ce cas exact (« vous suivez tous le même, mais X l'ont choisi »). **Un 3e défaut trouvé à une relecture suivante** : la branche « pas commun » restante disait toujours « les autres restent sur celui du compte », écrite en supposant qu'il reste toujours des thèmes hérités — faux dès que TOUS les thèmes affichés ont leur propre objectif avec des valeurs différentes (`nbPropre === nbThemes`, `!commun` — l'aboutissement normal de la fonctionnalité, pas un cas limite). Quatrième branche ajoutée, sans « les autres », pour ce cas précis ; accord singulier/pluriel du résumé (« a »/« ont », « son »/« leur ») aligné sur le reste du fichier au passage |
| `theme-evenements` / `objectif-par-theme` → `/conversions` | les deux modules ci-dessus vivaient sur `/labels`, une page qui ne devait porter que le VOCABULAIRE des thèmes (créer, renommer, étoiler) — la sélection et la catégorisation des conversions GA4 y avaient dérivé faute de page dédiée. Un thème n'avait par ailleurs qu'UN SEUL événement « principal » (étoile exclusive), sans aucun moyen de dire à quel GENRE de conversion il appartenait (vente, contact…) | **déplacés, pas réécrits** : `getThemeEvenements`/`getThemeObjectifs` (`lib/channels.ts`) et `setThemeEvent`/`saveThemeObjectif` (server actions) sont INCHANGÉS — seule la composition change de page (`app/conversions/page.tsx`) et de forme (`components/conversions-themes.tsx`, module « Nos thèmes principaux » : des cartes en défilement horizontal, `.defile-x`, même patron que les conseils d'un thème sur `theme-card.tsx`, au lieu d'un accordéon vertical). **La sélection devient un choix binaire** — coché/décoché — au lieu du couple principal/secondaire à étoile exclusive : en base ça reste la même ligne `theme_ga4_events` (`rang='principal'` ou absence de ligne), le worker (`_theme_ga4`) agrégeait déjà TOUS les événements principaux d'un thème, jamais un seul — aucune migration de données n'était nécessaire pour ce changement. **Nouveau : une catégorie par événement** (`ga4_event_categories`, table par NOM D'ÉVÉNEMENT et non par couple thème/événement — un `purchase` veut dire la même chose quel que soit le thème qui le suit), gérée par le module 2 de la même page (`components/category-manager.tsx`, CRUD façon `label-manager.tsx`) et sa classification IA (`components/classify-conversions-button.tsx` + `saas/worker/categorizing.py`, même mécanisme que `labeling.py` — voir l'en-tête de `triggerClassify` pour pourquoi un second classifieur IA, sur un contenu différent, ne contredit pas « une seule classification IA »). **Volontairement restreint aux thèmes prioritaires en v1** : `getThemeEvenements` couvre déjà TOUS les thèmes (l'architecture n'a pas besoin de changer pour ouvrir un jour cette sélection aux thèmes non-prioritaires), mais l'UI de `/conversions` n'en expose que le sous-ensemble étoilé — comme avant. **`objectif-theme.tsx` (la carte globale du rapport) est SUPPRIMÉE**, pas juste repointée : elle mélangeait un sélecteur `<ObjectifSelect>` ÉDITABLE (`profiles.objectif`) et un résumé des thèmes prioritaires, alors que le rapport doit être une LECTURE — l'objectif du compte se règle désormais sur `/conversions` (un petit réglage posé juste au-dessus des objectifs par thème, dans `conversions-themes.tsx`, « un seul endroit pour tous les réglages d'objectif »), et l'objectif de CHAQUE thème s'affiche en lecture seule DANS sa propre carte (`components/theme-objectif-mini.tsx`, rendu par `theme-card.tsx` entre le bilan chiffré — « Ce bilan couvre tout… » — et la courbe, avec la liste de ses conversions et un lien `◈ Conversions →`). **Une instance par carte n'est pas un doublon de module** : chaque `<ThemeObjectifMini>` montre les données d'UN thème différent, contrairement à l'ancienne carte globale qui répétait le même résumé pour tous |
| `conversions-themes` / `category-manager` (retour d'usage sur `/conversions`) | le sélecteur de catégorie ne vivait QUE dans la carte d'un thème étoilé, à droite de chaque conversion déjà cochée — impossible donc de catégoriser tout le reste du catalogue, celui qui n'est encore suivi par aucun thème. Et le camembert du haut sommait le VOLUME d'événements par catégorie : une conversion déclenchée 10 000 fois pesait dix mille fois plus qu'une déclenchée une fois, alors que la catégorie ne juge rien de leur fréquence | **catégoriser sort de la carte de thème et devient un module à part**, `components/conversions-catalogue.tsx` (module 3, entre « Nos thèmes principaux » et « Les catégories ») — même patron que `labels-listes.tsx` (Sans catégorie / Déjà catégorisé, sélecteur inline `ConversionCategorySelect` calqué sur `CampaignLabelSelect`), sur TOUT `evenements.catalogue`, indépendamment de toute sélection de thème. `conversions-themes.tsx` perd son sélecteur et regroupe désormais ses conversions PAR CATÉGORIE dans chaque carte (`<details>` repliables — ouvertes par défaut si elles portent déjà une sélection —, un bouton « tout sélectionner »/« tout désélectionner » coche la catégorie entière en un clic, une catégorie sans conversion dans ce catalogue n'apparaît pas) : la catégorie y redevient une LECTURE, elle se change dans le nouveau module. **Le camembert compte des TYPES, pas des occurrences** : une catégorie vaut désormais `nombre de noms d'événements distincts qui la portent / nombre total de conversions du compte` (même périmètre de « conversion » qu'avant — catégorisé ou marqué clé par GA4, jamais tout le catalogue brut) — sur un catalogue de 20 conversions dont 3 catégorisées « Ventes », la part vaut 3/20 = 15 %, que l'une des trois pèse 1 déclenchement ou 10 000 |

**Reste à traiter :**

- `AdsKpis` — le hero n'a toujours pas de forme (rang 6).
- `MetricChart` (pages canal) — même sélecteur muet que l'ancienne boussole, et
  pas de zones sur le CTR alors que c'est la même métrique avec les mêmes seuils
  `_BANDES`.

---

## Une fusion à ne PAS faire

- **`frise-semaine` et la courbe d'une carte de thème** — l'une porte du temps,
  l'autre une métrique ; aucune n'est un cas particulier de l'autre ;

*(Une deuxième figurait ici — `theme-donut` et `Repartition`, « le réel et le
prévu ». Elle n'a pas été enfreinte : `Repartition` a été supprimée le 12 août
2026, et la fusion n'a pas eu lieu pour autant. Le RÉEL prend la forme de
l'anneau ; le PRÉVU descend d'un cran, dans la liste des thèmes où chaque
enveloppe se règle, plus une ligne de réconciliation en pied du module de
l'année. La règle protégeait deux natures de nombre, pas deux composants : elle
tient encore, elle a seulement changé de support. Ce qui l'aurait enfreinte,
c'est un anneau dont les parts auraient mélangé dépense et budget.)*

*(Une troisième figurait ici — `action-top` et `tracking-section`, « le vivant
et la trace ». Elle est tombée le 11 août 2026. La règle tenait tant qu'une
action était un objet du COMPTE ; elle tombe le jour où elle devient un objet du
THÈME. Les séparer obligeait à traverser 900 px pour relier un conseil à ce
qu'il a donné, et « Ce que tu dois faire » était devenu une quatrième copie du
même thème. Ce que la règle protégeait est conservé sous une autre forme : **le
rail garde ses pastilles de 7 px qu'on ne clique pas ; les gestes sont des
boutons posés SOUS l'entrée** — une cible de 44 px ne tient de toute façon pas
dans une gouttière de 24 px sans percuter le trait. La distinction n'était pas
entre deux modules, elle était entre deux formes ; elle survit à la fusion.)*

---

## Ce qu'on gamifie, et ce qu'on ne gamifie jamais

Une seule règle, et elle est technique avant d'être morale :

> **On ne récompense que ce que le système peut vérifier.**

Dans Pulse, il y a exactement deux choses de ce genre : **le mouvement mesuré
d'une métrique**, et **le fait d'être là le jour où un verdict tombe**. Tout le
reste est déclaratif.

Pourquoi ce n'est pas un débat de goût : cocher « fait » écrit `done_at`,
`check_at` et une baseline dans `suivi_actions`, et pose un `reco_feedback`
« done ». Un compteur d'actions appliquées, une série de semaines, un badge
« 10 actions » récompensent donc un geste qui **fabrique une mesure**. Cocher
pour faire monter le compteur produit un verdict faux quatorze jours plus tard,
qui repondère les conseils suivants. Le risque n'est pas cosmétique, il est
dans les données.

Ce qu'on fait à la place, et qui tient la même promesse :

- **le compteur d'effet** — « 1 de tes 2 actions sur CE thème a bougé l'indicateur ».
  Calculé par le worker, pas par le clic ;
- **le rendez-vous** — « prochain verdict le 24 août ». On revient pour un
  résultat en suspens, pas pour un badge. Une app hebdomadaire ne se fait pas
  ouvrir par une série ;
- **le point d'étape** — à sept jours, « ça penche dans le bon sens, +50 % ;
  rien n'est joué, le verdict tombe le 26 ». Calculé, jamais déclaré.

*(Le **pari** figurait ici — avant d'agir, cocher « monter / ne rien changer /
baisser », et découvrir quatorze jours plus tard si on avait vu juste. Retiré le
12 août 2026, sur demande de David, et la demande était juste : le sens se
DÉDUIT des chiffres, à sept jours puis à quatorze, donc le demander à
l'utilisateur lui faisait taper une information que le produit possède déjà.
Une récompense qui ne se triche pas ne vaut pas qu'on ajoute un geste par
conseil. Ce qu'on perd est réel et il faut l'écrire : c'était la seule mesure
d'APPRENTISSAGE du produit — « tu avais vu juste » disait ce que l'utilisateur
avait compris, là où « ça a marché » ne dit que ce que les chiffres ont fait. Si
on veut la retrouver un jour, ce sera sans un clic de plus dans le parcours.)*

Le classement entre comptes reste refusé tant qu'il n'y a pas (a) une cohorte
comparable, (b) un plancher de n, et (c) une clause de contrat. Comparer un
hôtel et un e-commerce sur le nombre d'actions cochées ne mesure que la
disponibilité du gérant.

---

## Journal

**15 août 2026 (2)** — **Une navigation ne s'ajoute pas à côté de celle qui
existe : c'est la même qui change de nature.**

Les cartes de thème passent d'un empilement à une carte à la fois. Le réflexe
était d'ajouter des flèches et un « 2 / 5 » au-dessus de la pile — donc un
troisième dispositif à côté du SOMMAIRE, qui listait déjà tous les noms avec
leur étoile. C'était le sommaire l'onglet ; il ne lui manquait que de changer de
carte au lieu de faire défiler.

Trois arbitrages, tous tranchés par une mesure ou par une règle déjà écrite.

**La hauteur suit chaque carte.** 894 px pleine contre 296 px vide à
1 280 × 800 : 598 px d'écart, entièrement sous la ligne de flottaison d'une
fenêtre de 800 px. La raison habituelle de verrouiller une hauteur — que les
commandes ne bougent pas sous le curseur — ne s'applique pas ici, les commandes
étant AU-DESSUS du panneau. Et verrouiller demanderait de mesurer des cartes en
`display: none`, donc de les rendre toutes visibles : le couloir qu'on retire.

**Pas de bouclage.** La liste est courte et ORDONNÉE (les étoilés d'abord, dans
l'ordre où ils ont été posés). Sur une liste pareille, la seule question est
« est-ce que j'ai tout vu » — un anneau est exactement la réponse qu'on ne veut
pas. Le clavier suit la même règle : le motif ARIA laisse le bouclage optionnel,
et deux règles opposées dans un même dispositif seraient un piège.

**Rien n'est démonté.** Les panneaux inactifs portent `hidden` : une note à
moitié tapée survit au changement d'onglet, et les ancres `#theme-…` restent
résolvables — le raccourci du hero, « Si tu ne fais que trois choses » et les
liens du rapport hebdomadaire par e-mail en dépendent tous.

Corollaire trouvé au clavier : **une commande qui se désactive sous le doigt
emporte le focus avec elle.** La flèche « suivant » disparaît en bout de liste
et le focus retombe sur le `<body>` : la touche d'après ne fait plus rien. Il est
donc passé à l'onglet du thème qu'on vient d'ouvrir, d'où ← et → repartent.

**15 août 2026** — **Sous un titre qui dit ce que le client a choisi, il n'y a
que ce que le client a choisi.**

Deux thèmes étoilés, trois cartes sous « Tes thèmes prioritaires ». Le worker
ajoutait le thème d'une campagne lancée dans les quatorze jours, même jamais
étoilé, au motif — juste — que c'est la seule chose du rapport qui ne sera plus
vraie dans quinze jours. L'intention était bonne, la sortie était fausse : un
titre qui affirme une priorité que personne n'a posée.

Ce qui rend la correction facile, c'est que le signal N'AVAIT JAMAIS BESOIN de ce
bloc. `changements` parcourt toutes les campagnes, pas celles des thèmes
retenus, et le filet « Ce qu'aucun thème ne prend » est le complément EXACT des
cartes : retirer une carte y déplace mécaniquement ce qui la concernait. Le bloc
retiré doublait donc un signal déjà émis, et le doublon sortait sous le mauvais
titre. **Quand un signal apparaît au mauvais endroit, chercher d'abord s'il
n'est pas déjà émis au bon.**

Le garde-fou d'affichage se règle sur la liste VIVANTE des étoiles, pas sur le
`is_priority` figé dans le payload, et la raison est visuelle : `ObjectifTheme`
affiche cette liste quarante pixels au-dessus des cartes. Deux comptes d'étoiles
qui se contredisent à quarante pixels d'écart ne se lisent pas comme deux
mesures, ils se lisent comme une erreur. Il ne vide jamais la section : sans
étoile, ou avec des étoiles qui ne désignent aucune carte, on ne cache rien.

**14 août 2026 (5)** — **Réduire ce qu'on montre n'est pas une mise en page,
c'est une censure ; replier en est une.**

Un rapport à quinze thèmes ne tient pas. La tentation est de n'en afficher que
trois — et la grammaire l'interdit depuis le 12 août : quand une forme ne tient
pas à plusieurs, on change la forme, pas le nombre d'éléments affichés.

Le pli est le bon changement de forme parce qu'il ne coupe rien au-dessus du
rang 5. Une carte fermée garde son nom, son chiffre de tête, sa pente et son
bilan : elle se lit comme une tuile, jamais comme un titre nu.

Mais le plafond de trois n'était pas une affaire de mise en page, et c'est la
vraie découverte : **chaque thème coûte jusqu'à deux appels d'IA par rapport.**
Quinze thèmes, ce sont trente appels par compte et par semaine. Le plafond
payait un coût réel — et il confondait deux choses : combien on peut TRAVAILLER,
et combien on veut VOIR. Étoiler un quatrième thème, c'est demander à le voir.

D'où la règle retenue : tous les thèmes étoilés ont leur carte, les trois
premiers seuls ont des pistes rédigées. Et « les trois premiers » se lit dans
l'ORDRE D'ÉTOILAGE, pas dans le poids en dépense — **parce que la carte doit
dire quoi faire pour en avoir.** Sous le poids, la réponse serait « dépense plus
sur ce thème » : un conseil absurde, et qui nous arrange.

Corollaire trouvé à l'écran : **un marqueur d'état ne se met jamais dans la
partie tronquée.** Le `▾` du sommaire, posé après le nom du thème, se faisait
effacer par l'`overflow-hidden` sur un nom de soixante-dix caractères. La seule
pastille dont il fallait savoir qu'elle est repliée était la seule qui ne le
disait plus. Le nom se coupe, les signes qui l'encadrent jamais.

**14 août 2026 (4)** — **Une action appelée depuis un écran qui porte de la
saisie non enregistrée ne jette jamais.**

`saveOnboarding` appelait `getCompteActif()`, qui déréférence l'utilisateur sans
filet. Sans session elle jetait, la frontière d'erreur démontait le TOUT PREMIER
écran du produit, et les six réponses partaient avec — sans un mot. Jeter, sur
un écran pareil, c'est effacer sans le dire.

Deux natures d'erreur ne se traitent pas au même endroit : un refus d'ADRESSE
colore le champ ; un échec de SESSION ne le colore pas — accuser le champ envoie
corriger la seule chose qui est juste — et s'affiche à part, en commençant par
ce qui rassure : les réponses sont toujours là.

Deux dettes découvertes en passant, non corrigées et donc écrites ici : vingt-
deux autres actions du même fichier ont le même défaut, et la pire fait tomber
une page entière parce qu'elle est appelée depuis un composant serveur. Et sous
Supabase, **un refus de droits sur un `update` ne remonte aucune erreur** — il
touche zéro ligne. Une action peut donc répondre « enregistré » sans avoir rien
écrit.

**14 août 2026 (3)** — **Une constante exportée depuis un module « use client »
n'est pas une constante côté serveur.**

Le repli de la barre latérale passe de `localStorage` à un cookie, pour une
raison mécanique : le serveur ne lit pas `localStorage`, donc la colonne se
rendait dépliée puis sautait à sa vraie largeur après hydratation — à chaque
navigation, pas seulement au premier chargement.

Le piège était ailleurs. `COOKIE_NAV` était d'abord exporté par `side-nav.tsx`,
qui porte « use client ». Côté serveur, TOUS les exports d'un tel module — y
compris une simple chaîne — sont remplacés par une référence client :
`cookies().get(COOKIE_NAV)` recevait un proxy, jamais « pulse_nav ». Le cookie
était bien écrit, bien envoyé, bien reçu, et la barre se rendait quand même
toujours dépliée. **Rien ne plantait, TypeScript passait, et le seul témoin
était le HTML servi, qui écrivait `$8` là où on attendait le nom.** Une valeur
partagée entre serveur et client vit dans un module SANS directive.

Le corollaire de vérification compte autant que la règle : ce défaut ne se
voyait ni à l'écran ni au type. Il s'est vu en comparant le HTML servi pour deux
cookies différents.

**14 août 2026 (2)** — **Une moyenne sans sa fenêtre n'est pas un chiffre, et le
mois en cours n'est pas un mois.**

Treize jours d'août pesés comme un mois plein tirent toute une moyenne annuelle
vers le bas, et rien à l'écran ne le dit. C'est la règle des deltas — « toute
comparaison exclut le jour en cours » — appliquée d'un cran plus haut, et le
test n'a pas besoin de connaître « aujourd'hui » : **un mois compte s'il est
entièrement couvert par la fenêtre affichée.** Le mois en cours y échoue
mécaniquement, et le premier mois tronqué aussi — un mois observé à partir du 12
est incomplet par l'autre bout.

La décision est ÉCRITE, pas commentée : le titre porte le compte et les bornes,
le pied nomme le mois écarté et dit ce qu'il aurait faussé. Quand aucun mois
n'est complet, on écrit le vide et où aller — zéro serait un chiffre faux.

Sortie de la même passe : **un axe à zéro est juste pour un flux et faux pour un
cumul.** 40 CHF contre 20 la veille, c'est le double, et la hauteur doit le
dire ; 4 120 → 4 244 abonnés sur le même axe est un trait plat. L'axe tronqué
est permis à condition d'écrire ses deux bornes et de perdre son aplat — même
exigence que « une jauge sans sa cible écrite est du décor ».

**14 août 2026** — **Le bon chiffre d'un module de couverture est un montant,
pas un compte.**

« 12 campagnes sans thème » ne fait rien faire à personne : douze campagnes,
c'est peut-être douze essais à 4 CHF arrêtés en mars. Ce qu'on perd quand une
campagne n'a pas de thème, ce n'est pas une ligne dans un tableau, c'est de
l'argent sorti du compte qu'aucun bilan ne sait rattacher à quoi que ce soit. Le
compte de lignes descend au rang 7, où il dit la répartition du montant.

Corollaire trouvé en écrivant l'annulation du geste de masse : **une action
qu'on applique sans validation doit se borner par le MOMENT où on l'a lancée,
pas par sa signature.** Annuler « tout ce que l'IA a posé » aurait emporté les
étiquettes acceptées depuis trois semaines. C'est une date qui découpe le
passage, et elle est posée par un trigger Postgres, non par l'application —
trois programmes écrivent ces labels, en tenir trois d'accord garantit l'oubli.

Et un défaut voisin, trouvé en tirant le fil : retirer un thème posait la marque
« choix humain » sur une ligne VIDE. Le worker saute tout ce qui la porte — donc
corriger une étiquette fausse en la supprimant condamnait la campagne à ne plus
jamais en recevoir. Silencieusement. **La marque protège un choix, pas un
vide.**

**13 août 2026 (2)** — **Un nombre qu'on abandonne se raconte, il ne s'efface
pas en silence.**

Trois montants estimés gouvernaient la page Coûts sans que personne les ait
jamais tapés : l'enveloppe de l'année, déduite de la somme des deux plateformes
ou des douze mensuels ; l'enveloppe d'un thème, déduite de ses douze mensuels ;
et le budget du mois. Tous trois étaient nés d'une bonne intention — remplir un
écran plutôt que le laisser vide. David a tranché : **« soit tu fais partout,
soit pas du tout »**. Comme aucune estimation n'était possible partout, aucune
ne reste.

La conséquence dépassait la phrase qui l'annonçait, et il fallait le lui dire :
retirer la mention retirait aussi le **dénominateur**. Un thème comme e-bike
lisait « 61 % de l'enveloppe » sur un champ Enveloppe à zéro, et seuls les
thèmes ayant un vieux mensuel étaient jugés — la page avait l'air de choisir ses
victimes. Un thème sans enveloppe saisie affiche maintenant sa dépense et se
tait.

Reste ce qui est en base. On ne le détruit pas, et on ne le fait pas disparaître
sans un mot : `budgetAnnuelHerite` et `budgetYearHerite` ne servent qu'à écrire
« ces montants ne comptent plus ». **La règle : la préséance d'un montant meurt
avec le champ qui permettait de le corriger.** Un montant qui gouverne une page
et qu'aucun écran ne peut plus atteindre est pire qu'un montant faux — trois
suppressions successives sur cette page obéissent toutes à cette seule phrase.

Deux corollaires de forme, trouvés à l'écran et pas dans le code. Un module qui
mélange **décider** (une fois l'an) et **surveiller** (chaque semaine) enterre
son champ de saisie sous le bilan qu'il commande : d'où le découpage en 1/3 –
2/3. Et `mt-auto` ne tient sa promesse d'alignement que s'il pousse un élément
**seul** — un pied glissé sous le champ faisait remonter celui-ci de 114 px sur
les deux seules cartes qui le portaient, dans un module dont le commentaire dit
mot pour mot que des champs à trois hauteurs différentes se cherchent.

**13 août 2026** — **Confondu par nature, confondu par ancienneté : deux vides
qui ne portent pas le même mot.**

La boussole sépare Meta et Google depuis le 12 août. Un rapport publié avant
porte des clés nues (`ctr` au lieu de `ctr:meta`), et l'écran basculait alors
tout le groupe en « Meta et Google confondus · recharge tes conseils ». Sauf que
ce groupe contient aussi le **ROAS**, qui est confondu *par nature* — son revenu
vient de GA4, qui ne dit jamais quelle régie l'a produit. On lui promettait une
séparation qui n'arrivera jamais.

Un drapeau posé sur un groupe mixte est presque toujours le signe qu'il manque
un groupe. Deux groupes distincts, et `provenance()` perd son exception :
chaque indicateur hérite de la phrase de son groupe, sans cas particulier.

**La même règle a produit la même correction ailleurs le même jour** : « 0 CHF »
servait à la fois pour « on n'a pas encore relevé » et pour « on a relevé, il
n'y a rien ». Deux vides de nature opposée sous un seul signe. L'un est une
ignorance, l'autre un constat — « au prochain relevé » et « rien de réglé en ce
moment ». **Un zéro non mesuré présenté comme mesuré est un chiffre faux**, et
c'est le nombre le plus facile à confondre avec une mesure.

Côté récolte, la même erreur de symétrie : une constante de 30 jours bornait
Meta *et* Google. Les 30 jours sont une limite **écrite** de `change_event`
(et une fenêtre plus large fait rejeter la requête entière, pas la tronquer) ;
Meta n'a jamais rien demandé de tel. Les deux fenêtres sont découplées, et
l'élargissement a révélé une pagination Meta sans borne — un curseur `next` sur
une page vide pouvait faire tourner la boucle indéfiniment et manger le passage
hebdomadaire de tous les autres comptes.

**12 août 2026 (7)** — **Un mot qui promet le futur ne se pose pas sur le passé.**

Le fil affichait vingt lignes « est programmée — aucune dépense encore », dont
une campagne de Noël 2025 lue en août 2026. David a dit « il me semble que ce
n'est pas juste », et il avait raison sur les deux plans : ce type de changement
était le **seul à échapper à la fenêtre de 60 jours** qui borne tous les autres,
et son test ne regardait pas la date — seulement « déclarée, et n'a jamais
dépensé ».

Trois cas là où il n'y en avait qu'un : début **à venir** → « est programmée » ;
début **passé, moins de 60 jours** → « devait démarrer, et n'a rien dépensé » ;
au-delà → **rien**. Le deuxième n'est pas une variante de politesse du premier :
une campagne qu'on croyait lancée et qui ne tourne pas est un problème, pas une
annonce. Elle ne se replie donc pas avec les programmées.

**La règle : un état ne se raconte pas, un fait daté se raconte.** Et quand un
type de fait échappe à la fenêtre commune, c'est presque toujours qu'il n'a
jamais été relu depuis qu'on l'a écrit.

Corollaire de fabrication, vérifié ici : le worker corrigé ne suffit pas, parce
qu'un rapport ne se régénère qu'à la demande. Pulse **rattrape à l'affichage**
avec exactement la même règle, et le rattrapage porte la date à laquelle on
pourra le retirer.

**12 août 2026 (6 bis)** — **On ne renonce pas à séparer : on cesse d'agréger.**

La boussole groupait ses neuf indicateurs par TERRAIN — « Ta pub », « Ton
Instagram », « Ton site » — au motif que quatre d'entre eux additionnaient Meta
ET Google, et qu'une pastille « Google Ads » sur un CTR mélangé ferait couper
Google à qui croit lire Google. L'argument était juste. La conclusion était
fausse.

Sur un compte réel : CTR **2,1 % chez Meta, 15,4 % chez Google**. Le chiffre
groupé affichait 9,8 % — une moyenne qui ne décrit aucune des deux et qui cache
exactement ce qu'on vient chercher : laquelle des deux régies il faut aller
regarder. La bonne réponse n'était pas de renoncer au groupement par plateforme,
c'était de **ne plus additionner** : les deux régies vivent dans deux tables
distinctes, séparer ne demandait aucune donnée de plus.

**Le ROAS reste commun, et c'est écrit à l'écran.** Son revenu vient de GA4, qui
le donne pour tout le compte sans dire quelle régie l'a produit : un « ROAS
Meta » diviserait le revenu total par la seule dépense Meta. Faux, et flatteur.
Un groupe « Tes deux régies » existe donc uniquement pour lui, avec la raison en
toutes lettres à côté de son nom.

La clé porte sa régie (`ctr:meta`), jamais le titre : un rapport publié avant
cette date n'a que des clés nues, il retombe dans « Tes deux régies » et
s'affiche entièrement. **Une taxonomie qui change doit pouvoir lire l'ancienne.**

**12 août 2026 (7)** — **Le déclaré prime sur le déduit, et un état n'est pas un
événement.**

Deux règles sorties du même bloc, « hors de tes thèmes », qui sur le rapport de
David affichait vingt lignes identiques : « est programmée — aucune dépense
encore ».

**Une campagne programmée est un ÉTAT, pas un événement.** Elle n'a pas de date
à laquelle quelque chose s'est produit ; elle décrit une situation qui dure. La
poser vingt fois dans une chronologie enterre les trois faits qui, eux, se sont
produits. Elle ne vaut qu'en nombre : une ligne repliable sous le rail, et le
rang 3 du module ne la compte pas.

**Le déclaré prime sur le déduit.** Nos cinq faits de plateforme sont déduits de
la dépense quotidienne : robustes, mais aveugles — ils constatent une
conséquence sans jamais nommer la cause. Les API tiennent le vrai journal.
Quand les deux racontent le même fait le même jour sur la même campagne, on
garde celui qui nomme. La clé de rapprochement est volontairement grossière —
jour + canal + campagne, **sans** la catégorie : un budget déclaré et une
dépense qui bouge le même jour SONT le même événement vu de deux côtés, et
exiger que les catégories concordent ferait réapparaître le doublon qu'on veut
supprimer.

Le bloc lui-même monte à gauche de « Ta boussole ». Il était en bas de page,
après tout le reste, alors qu'il contient des actions qui bloquent le plafond
des trois chantiers. Contre la courbe du compte, il cesse d'être un repêchage :
c'est le registre de ce qui a bougé pendant que la courbe bougeait.

**12 août 2026 (6)** — **La page Coûts : trois natures de nombre, et un
réglage qu'on ne peut plus atteindre.**

Le budget FIXÉ s'écrivait en 15 px gris derrière une barre oblique. C'est le
second terme de la seule question que pose la page — « est-ce que je tiens mon
budget ? » — et il avait la taille d'une unité. Il passe en 20 px encre avec son
mot. **Un nombre qui répond à la question du module ne peut pas être plus petit
que sa décoration.**

Un troisième nombre entre : ce qui est **POSÉ** sur les campagnes, relevé chez
Meta et Google. Il ne se déduit ni du dépensé ni du fixé, et il répond à ce
qu'aucune barre ne montre : une enveloppe de 72 000 avec 18 000 posés, c'est un
compte qui ne dépensera pas son budget — et la barre « dépensé / fixé » rassure
au lieu d'alerter. Quand aucun relevé n'existe, on écrit que le relevé n'a pas
eu lieu ; **jamais « 0 CHF planifié », qui se lit « rien de prévu »**.

Deux anneaux plutôt qu'un : par plateforme (à gauche, la découpe la plus
grossière) et par thème. Même filtre, même total au centre — c'est ce qui les
fait lire comme deux découpes d'un seul gâteau. `ThemeDonut` gagne deux props
(`teintes`, `etroit`) au lieu d'un second composant : `teinteLabel` indexe sur
la liste des thèmes et aurait pu sortir Google en bleu, la couleur de Meta dans
dix-huit autres endroits.

Le dépliant « ⚙ Réglages du budget » est supprimé, et il en sort une règle qui
vaut au-delà de cette page : **un montant qui gouverne un écran et qu'aucun
écran ne permet plus de corriger est pire qu'un montant faux.** L'éditeur du
mois disparaissait ; laisser un mensuel déjà saisi continuer de primer sur
l'enveloppe d'année aurait figé, chez les comptes anciens, un nombre
intouchable. Le mois n'a donc plus qu'une source — l'annuel ÷ 12 — et il
continue de l'écrire là où il s'affiche. Rien n'est perdu : faute d'enveloppe
d'année, la somme des douze mensuels devient l'annuel.

**12 août 2026 (5)** — **L'étiquette permanente devient un point qu'on survole.**

Sur les captures de David, deux repères d'action se chevauchaient et se
coupaient en haut de la courbe : « Tes conversions te coûtent 28… » posée sur
la suivante. La parade en vigueur était un plafond — au-delà de deux repères,
plus aucune étiquette, et un pied qui écrivait « 5 actions » sans dire
lesquelles ni quand. **On payait la lisibilité en information.**

Le repère est maintenant un point de 7 px sur la ligne du haut, en encre, et son
nom n'apparaît qu'au survol dans la même bulle que les colonnes. Deux points
côte à côte se touchent au pire ; deux pastilles de texte se coupaient. Le
plafond tombe, le comptage en pied disparaît de `theme-card` et de `kpi-focus`,
et dix repères s'affichent tous nommés.

La règle générale qui en sort : **quand une forme ne tient pas à plusieurs, on
change la forme, pas le nombre d'éléments affichés.** Réduire ce qu'on montre
pour sauver une mise en page, c'est laisser la mise en page décider de ce que
l'utilisateur a le droit de savoir.

Corollaire technique, valable pour toute bulle de survol dans un composant
serveur : `group-hover` seul n'existe pas au doigt. Le déclencheur est un vrai
`<button>` et la bulle s'ouvre aussi sur `group-focus-within` — un `tap` donne
le focus, un `tap` ailleurs le retire. Toujours aucun JavaScript.

Deuxième sortie de la même passe, sur l'axe X : `.defile-x`. Une colonne coupée
en bas se devine, une **rangée** coupée à droite ne se devine pas. Les trois
conseils d'une carte de thème passent en rangée unique, largeur fixe et hauteur
commune — ils s'alignent, donc ils se comparent, ce qui est la seule chose qu'on
fait avec trois conseils.

**12 août 2026 (4)** — **Le pari s'en va, parce que la machine sait répondre.**

« À ton avis, le ROAS va monter, ne rien changer, ou baisser ? » — trois boutons
sous chaque conseil pris. Retirés. Le raisonnement de David tient en une ligne :
*ça se fait automatiquement*. Le point d'étape à sept jours et le verdict à
quatorze produisent exactement ce sens-là, à partir des chiffres. Demander à
l'utilisateur de saisir une donnée que le produit calcule, c'est un geste par
conseil pour rien.

La règle générale qui en sort : **on ne demande jamais une information qu'on
sait dériver.** Elle prime sur l'argument qui avait fait naître le pari (une
récompense non trichable), parce qu'un parcours se juge d'abord au nombre de
gestes qu'il exige. Ce qui disparaît est noté dans « Ce qu'on gamifie » : c'était
la seule mesure d'apprentissage du produit.

**12 août 2026 (3)** — **La page Coûts se range sur l'ANNÉE.**

Elle pilotait le mois. C'était le mauvais niveau : une enveloppe publicitaire se
décide une fois — un exercice, une saison, un salon — et le reste du temps on
vérifie qu'on la tient. Le mois et le jour deviennent des LECTURES de l'année.

Le gain n'est pas théorique, il se compte en champs de saisie : quand aucun
budget mensuel n'est posé, le mois se déduit de l'annuel (÷ 12) au lieu de
valoir zéro. **Un seul nombre à taper fait vivre le mois, le jour, les alertes
et toutes les barres de la page.**

Trois lectures, et pas une de plus : tenir l'année (trois cadrages qui ne se
déduisent pas l'un de l'autre — budget annuel, budget mensuel, moyenne
quotidienne réelle — puis la barre dépensé/promis avec le trait du calendrier) ;
où ça part (filtrable par période et par thèmes : l'anneau dit la répartition,
la courbe dit le rythme) ; par thème (une enveloppe d'année par thème, et c'est
la seule décision de la page).

Quatre règles en sortent, toutes déjà remontées dans « Deux règles de fond » :
un nombre dérivé dit d'où il vient **à l'endroit où il s'affiche**, et la phrase
change avec la branche empruntée ; un seuil ne survit pas à un filtre qui ne le
concerne pas (le trait du budget disparaît dès qu'on restreint à deux thèmes, et
le module écrit pourquoi) ; une agrégation dit ce qu'elle a agrégé d'incomplet
(la dernière semaine est en cours, donc plus basse) ; et les modules d'une page
protégée par une session vivent dans `components/`, pas dans la page — sinon ils
ne sont vérifiables qu'en production.

**12 août 2026 (2)** — **Une action est enfin mesurée là où elle a eu lieu.**

Depuis le premier jour du suivi, le verdict comparait la baseline d'une action
au chiffre du COMPTE ENTIER. Une action prise sur « Audio Tour » était donc
jugée sur le ROAS de tous les thèmes confondus — c'est-à-dire sur le bruit des
autres. `_kpis_window` accepte maintenant un thème : les campagnes filtrées par
leur étiquette, les posts par leurs labels, le revenu GA4 par les campagnes du
thème. Quand rien n'est rattachable au thème, on ne sait pas et **on se tait**,
plutôt que d'attribuer au thème le revenu du compte.

Une règle en sort, qui vaut pour tout changement de mesure : **une action
finit comme elle a commencé.** Les actions décidées avant la bascule gardent la
mesure sur laquelle leur baseline a été photographiée ; les mesurer aujourd'hui
sur leur thème comparerait deux échelles et rendrait un verdict faux — qui
repondèrerait ensuite les conseils sur ce faux.

**Le point d'étape à sept jours.** Attendre quatorze jours pour découvrir qu'on
part dans le mur, c'est deux semaines de budget perdues. À mi-parcours, on dit
ce qu'on voit — sous trois conditions strictes, parce qu'un signal précoce qui
contredit le verdict final ruine le verdict : l'action est faite depuis 7 jours
pleins, le mouvement dépasse **10 %** (sous ce seuil, sept jours ne distinguent
pas un effet d'un lundi calme), et **on ne prononce jamais « ça a marché »** —
seulement « ça penche dans le bon sens », suivi de la date du vrai verdict.

**12 août 2026** — **Le fil devient le registre de tout.** Il ne montrait que ce
qu'on décide DANS Pulse ; il racontait donc un tiers de l'histoire, et quand la
courbe bougeait, rien n'expliquait pourquoi. Deux voix le rejoignent.

**Les plateformes.** Cinq faits déduits de la dépense quotidienne — lancée,
arrêtée, reprise, programmée, dépense changée. **Aucun champ d'API ne dit « le
budget a changé le 2 août »** : le budget n'est récolté nulle part, vérifié dans
les deux scripts. On écrit donc ce qu'on OBSERVE (« la dépense est passée de 30
à 75 CHF par jour »), pas ce qu'on suppose. C'est plus prudent et c'est plus
utile : c'est la dépense qui compte, pas le réglage.

Deux garde-fous qui valent au-delà de ce module : un arrêt n'est annoncé que si
**le canal a des données plus récentes** — sans ça, Google qui prend deux jours
de retard « arrêterait » toutes les campagnes du compte le même matin ; et une
campagne en pointillé ne produit qu'une reprise, la dernière.

**Toi.** Une note manuelle — « refait les visuels », « un concurrent a lancé une
promo ». Ce n'est pas un journal (on ne tient pas un journal) : c'est un repère
qui se plante à SA date sur la même frise, pour qu'une courbe qui bondit ait une
explication trois semaines plus tard.

D'où la règle de forme ci-dessus, qui est la vraie sortie de cette passe : **le
rond est réservé à ce qui sera mesuré.** Un glyphe de canal pour ce qui s'est
produit, un `✎` pour ce que tu as écrit. Trois voix, trois signes, un seul rail.

**11 août 2026 (3)** — **La boucle entière dans la carte de thème.** Le conseil
était dans la carte, la case à cocher dans « Ce que tu dois faire », le verdict
dans « Ton historique d'actions » : trois endroits pour un même objet, et
cliquer « ▶ Je le teste » faisait apparaître une section ailleurs sur la page.

Sous la courbe, deux colonnes : les conseils sur **2/3** (avec un nombre impair,
le dernier prend toute la largeur — un conseil seul n'occupait qu'une
demi-colonne et la moitié de la carte restait blanche), et sur **1/3** le rail
des actions du thème, avec ses pastilles, ses boutons et le mouvement réel de
l'indicateur suivi.

Trois choses apprises en le construisant :

- **Le conseil disparaît, l'action reste.** Le worker republie chaque semaine un
  rapport où le conseil appliqué n'est plus : si les gestes ne vivaient que dans
  sa carte, l'action serait bloquée en `running` à vie tout en occupant une
  place au plafond des trois chantiers. Le rail est la maison de référence, la
  carte du conseil en est le miroir.
- **Une action sans thème existe, et c'est certain** — tout conseil pris depuis
  « Réglages de base » a `theme = null`. S'y ajoutent les thèmes sortis des
  priorités et les thèmes renommés. Sans filet, trois actions de réglage
  bloquaient toute la page sans aucun moyen de débloquer. Le bloc « hors
  thème » est le complément EXACT du filtre des cartes : ni doublon, ni trou.
  Et `renameLabel` propage désormais le nouveau nom sur `suivi_actions`.
- **Le pari se pose au moment où l'on décide**, dans la carte du conseil. Le
  déplacer dans l'historique, c'eût été parier après coup.

**11 août 2026 (2)** — **Une fusion qu'il FALLAIT faire, elle.** La page portait
deux cartes pour le même thème, à 900 px d'écart : l'une en section 2 (bilan et
courbe), l'autre en section 3 (campagnes et conseils). Même titre, même étoile,
même thème — et le lecteur devait relier lui-même « voilà la courbe » et
« voilà quoi faire ».

Une seule carte désormais, et son ordre suit la question qu'on se pose : où
j'en suis (le bilan), ce que ça donne dans le temps (la courbe), puis **deux
colonnes** — à gauche ce qui peut la faire bouger (les conseils du thème), à
droite ce qui a déjà essayé (les actions passées, leur verdict, et l'indicateur
qu'elles suivaient avec son mouvement réel : `CTR 3,1 → 5,8 ▲ +87 %`). La
boucle conseil → action → effet tient dans un écran ; elle était éclatée sur
trois sections qui ne se regardaient pas.

Deux règles en sortent :

- **Le verdict décide du sens, pas le delta brut.** Un verdict « stable » à côté
  d'un « ▲ +1 % » se contredit à l'œil. Le worker a son seuil ; l'affichage n'en
  invente pas un second — quand c'est stable, on montre les deux valeurs et on
  se tait sur la flèche.
- **Une sélection qui désigne des modules rendus ailleurs sur la page se fait
  en LIENS, pas en cartes.** « Si tu ne fais que trois choses » listait trois
  `RecoCard` déjà rendues plus bas ; ce sont maintenant trois titres cliquables
  qui mènent à leur thème. La sélection garde son rôle, l'interdit du doublon
  est respecté, et le pilotage cross-thème ne coûte plus une seconde lecture.

`theme-focus-card` et `top-recos` supprimés (269 lignes). Les onglets de la
section conseils disparaissent avec elle : il n'y a plus qu'un panneau.

**11 août 2026** — Trois doublons vus par David sur son propre rapport, et une
règle qui en sort.

**Une section qui n'a rien à faire n'existe pas.** « Ce que tu dois faire »
s'affichait avec son titre de niveau 1, son numéro et son bloc teinté pour dire
qu'il n'y avait rien à faire — et elle écrivait la même échéance trois fois :
dans le comptage, dans la ligne de rendez-vous, puis dans une ligne « ✓ fait …
verdict le 16 aoû ». Quand il n'y a ni action à faire ni action à juger, elle se
réduit à une ligne, et elle ne prend plus de numéro de section.

**Le rappel du bilan de thème est retiré quand le thème a sa carte.** Le pari
était que les onglets rendraient les deux rarement visibles ensemble ; avec un
seul thème prioritaire, ils tiennent dans le même écran. Le rappel ne subsiste
que pour un thème sans courbe — là, il n'est pas un doublon, c'est le seul
endroit où ces chiffres existent.

**Deux colonnes sous une courbe doivent porter des ensembles disjoints.** À
gauche ce qui court, à droite ce qui est clos. Une action « faite mais pas
encore jugée » figurait des deux côtés : elle reste à gauche, en observation —
« en cours » et « en observation » ne sont pas la même chose, la première
attend un geste, la seconde attend une date.

**10 août 2026 (2)** — Refonte de « Ta boussole » et de « Tes thèmes
prioritaires », d'après deux maquettes de David passées au banc d'essai.

Le point de départ n'était pas dans les maquettes : **aucun texte de nos courbes
n'avait de taille décidée** (4,5 px sur téléphone, 17 px sur écran). D'où la
règle du graphe ci-dessus, faite une fois dans `line-chart` et qui retombe sur
les cinq pages qui l'utilisent.

Trois demandes des maquettes ont été **refusées**, et la raison compte :

- **grouper les indicateurs par source connectée** — faux pour cinq des neuf.
  Le regroupement se fait par terrain, et chaque terrain écrit sa provenance
  sous le chiffre (`Meta + Google confondus`) ;
- **des pastilles TikTok / LinkedIn / Pinterest** — aucune de ces sources
  n'existe dans Pulse. On n'affiche pas l'emplacement d'une fonction qu'on ne
  vend pas ;
- **une troisième liste d'actions dans la section 2**, avec un état « encore à
  valider » — cet état n'existe pas en base (`running / done / archived /
  dropped`), et un état d'interface sans état en base disparaît au
  rechargement. On donne une ligne-ancre, pas une colonne.

Une décision a été prise **contre** l'avis initial, après l'avoir vue à l'écran :
l'échelle commune entre les trois thèmes. Elle est juste en principe — trois
courbes ne devraient pas monter pareil quand l'une pèse 4 500 CHF et l'autre 90
— mais elle écrase le petit thème en une ligne plate au ras de l'axe, et une
carte de thème est d'abord là pour montrer la tendance de *ce* thème. Le poids
est donc **écrit** (chiffre de tête en 34 px, haut de l'échelle sur le graphe)
au lieu d'être subi.

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

**10 août 2026** — `action-top` gagne son rang 3 et la section « Ce que tu dois
faire » gagne sa boucle : compteur d'effet, prochain rendez-vous, et le pari.
Établissement de la règle de gamification ci-dessus. La maquette à badges et
séries a été refusée pour la raison écrite là-haut.

`Quotidien` (page Coûts) supprimé : ses deux chiffres étaient une identité
algébrique de la barre du dessus. L'exception qu'on lui avait accordée dans les
interdits tombe avec lui.

**6 août 2026 (2)** — Passe sur les maquettes du kit de composants.
Établissement du **lexique des signes** ci-dessus et de `components/pente.tsx`
(huit blocs de delta recopiés, trois seuils de « stable » différents → un seul).
`tracking-section` devient un fil vertical et gagne son rang 3. Le hero passe en
carte — le calculé dedans, le rédigé dehors. Les noms de paliers de la boussole
deviennent proportionnels à leurs bandes.

Trois demandes des maquettes ont été **refusées**, et la raison compte autant
que la décision :

- **quatre habillages de `Chiffre`** (fonds jaune, noir, bleu) — `action-top`
  est le seul bloc teinté du rapport, et c'est ce qui dit « ici, on agit » sans
  qu'on ait à lire un titre. Quatre tuiles colorées effacent ce signal ;
- **histogramme *ou* sparkline comme variantes** — ce n'est pas un habillage
  mais la règle du rang 6, calculable depuis `serie.length` ;
- **le verdict « Zone scalable » sur une tuile quelconque** — il n'existe que
  pour les métriques qui ont une table de bandes (`roas`, `ctr`, `eng` dans
  `_BANDES`, `saas/worker/build_report.py`). Sur un CPC ou une portée, il serait
  écrit à la main. Un verdict non calculé tombe sous la même règle qu'un chiffre
  non mesuré.
