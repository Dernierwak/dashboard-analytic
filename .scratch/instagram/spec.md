# Spec — La page Instagram organique

Status: brouillon — passe à ready-for-agent quand « Ce qui reste ouvert » est vide
Carte : [`map.md`](map.md) · ADR 0008, 0010, 0011 — retirées de l'arbre au
commit `1b05a92`, à lire dans l'historique : `git show 1b05a92^:docs/adr/<fichier>`
(`git ls-tree --name-only 1b05a92^ docs/adr/` les liste) · Mesures
impossibles : même chose, `git show 1b05a92^:docs/mesures-impossibles.md`

Écrite le 2026-11-06 à partir des tickets clos de la carte (01 à 11, 13, 14,
16 à 22). Rien n'y est inventé : chaque décision renvoie à son ticket. Quand
deux tickets se contredisent, le plus récent l'emporte, et la spec le dit
(§ Notes). Ce qu'aucun ticket ne tranche est listé à la fin, sans être comblé
(§ Ce qui reste ouvert).

---

## Problem Statement

Le client ouvre `/instagram` pour savoir **si son nouveau post fait mieux que
d'habitude**, et **sur quel format** il gagne des abonnés. La page actuelle ne
peut pas le lui dire.

Un post n'est pas une campagne. Une campagne est une série continue, qu'on suit
jour après jour. Un post est un événement : il y en a beaucoup, et ils sont
« plus aléatoires » (David). **Le payant se lit dans le temps, l'organique se
lit dans la foule** ([carte](map.md), Notes). La page actuelle lit ses posts
comme une campagne : une courbe d'« évolution des posts », une moyenne qu'un
seul post tire, un top 3.

Pire, elle **ment sans le dire** :
- le chiffre d'abonnés est **figé au 2026-09-04** : plus rien n'écrit
  `followers_history` ([L'état des abonnés en base][16]) ;
- la récolte écrit **0 quand Meta ne rend rien** : les 124 vidéos portent un
  `follows` à 0 alors qu'Instagram ne le donne jamais pour un Reel, et un
  `likes` à 0 par un mauvais test de format ([Ce que la récolte et le
  traitement doivent calculer][14], § 0) ;
- un Reel est rangé `VIDEO`, confondu avec une vidéo du fil ([Les formats et
  les abonnés][09]) ;
- la récolte **écrase** les chiffres d'un post à chaque passage : impossible
  de comparer deux posts au même âge ([Garder l'historique][05]) ;
- la base porte **233 posts sur 1 839** : rien au-delà des 200 derniers
  ([La profondeur de l'historique][21]) ;
- la portée et les interactions **du compte** n'ont jamais été récoltées
  ([La page entière, en maquette][13]).

## Solution

Une page `/instagram` dont le **fil conducteur est l'Objectif** — Portée,
Engagement ou Abonnés : le compte → la foule par format → les posts → tout le
détail ([La structure de la page][01]). De haut en bas
([La page entière, en maquette][13]) :

1. **Bandeau de commandes** — la période et les **Règles de lecture**.
2. **Tendance** (« Ta page ») — le compte seul : les abonnés en grand à
   gauche, la portée et les interactions du compte empilées à droite.
3. **Sélecteur de vue** — l'Objectif et ses métriques. Placé *sous* la
   Tendance : écart à l'ADR 0011, justifié par [La structure de la page][01]
   (le compte est le cadre, l'Objectif ne gouverne que la foule).
4. **« Tes posts face à ton année »** — un seul module qui réunit la
   Comparaison et la Sélection : une rangée par format, le nuage des posts de
   la période posé sur l'année, les moustaches pesées à droite, et la liste
   des 5 meilleurs posts de la période dans une colonne collante.
5. **Tableau détaillé** (« Tous tes posts ») — tout l'historique, triable,
   exportable.

Et le **Panneau latéral** « lire un post », ouvert depuis un module.

Chaque chiffre est celui d'Instagram, daté par son dernier Relevé. Un post se
lit **face à ses pareils des 12 derniers mois glissants**, jamais face à une
moyenne. Ce qu'Instagram ne rend pas s'écrit « – », jamais 0. Pulse mesure et
affiche ; il ne classe pas les formats et ne conseille rien (`CLAUDE.md` §1).

---

## Vocabulaire

Le vocabulaire tranché de la carte. Le mot de droite ne s'emploie pas.

| Mot | Sens | À éviter |
|---|---|---|
| **Objectif** | Ce que le client veut lire — Portée, Engagement ou Abonnés —, choisi au Sélecteur de vue ; la métrique de toute la foule. | « vue » pour l'objectif lui-même |
| **Format** | Reel, Carrousel, Image ou Vidéo du fil — un fait rendu par Meta. | « type » à l'écran, « thème » |
| **Relevé** | La lecture datée du cumul d'un post ; il s'ajoute, il n'écrase jamais. | « snapshot », « historique » |
| **Âge d'un post** | Heures entre la publication et le relevé ; « J+n » = au moins n × 24 h. | — |
| **Place d'un post** | Sa bande parmi les posts de son format des 12 derniers mois glissants, sur la métrique choisie : « en dessous », « bas de tes habitudes », « haut de tes habitudes », « au-dessus » ; « plus d'un an » au-delà. | « rang », « score » |
| **Post type** | La médiane de la foule. | « moyenne » |
| **Hors norme** | Au-delà de 1,5 × l'écart interquartile, d'un côté ou de l'autre. | « aberrant » à l'écran, « viral » |
| **Écarté** | Sorti de la foule et de la Sélection par une Règle de lecture ; reste visible, grisé, avec sa raison. | « supprimé », « exclu », « masqué » |
| **Règles de lecture** | Les deux filtres « sans les boostés » et « sans les hors norme », dans le Bandeau. | « mode avancé », « mode pro », « paramètres » |
| **Boosté** | Instagram a listé au moins une annonce hors erreur à un relevé ; il le reste. Sans étiquette = aucun boost vu. | « sponsorisé », « payant » |
| **Réactions fortes** | Enregistrements et partages rapportés à la portée. | « bon engagement » |
| **Sélection** | Le carré : 3 à 5 posts côte à côte. | « Top », « SWOT » |
| **Rattrapage** | Le premier chargement de tout l'historique, du plus récent au plus ancien, par blocs. | « backfill » à l'écran, « import » |

---

## User Stories

### Lire la page

1. En tant que client, je veux que chaque chiffre porte la date de son dernier relevé, afin de comprendre pourquoi il diffère de l'appli Instagram ou du rapport hebdo ([Garder l'historique][05], [La profondeur de l'historique][21]).
2. En tant que client, je veux qu'un chiffre qu'Instagram ne rend pas s'écrive « – » et qu'un vrai 0 s'écrive 0, afin de ne jamais lire une absence comme un échec ([Les formats et les abonnés][09]).
3. En tant que client, je veux que le jour en cours ne compte jamais, afin de ne pas lire une journée incomplète comme une chute ([Le compte dans le temps][10]).
4. En tant que client, je veux qu'aucune phrase ne me dise quel format choisir, afin de décider moi-même sur des faits ([Les formats et les abonnés][09]).
5. En tant que membre invité, je veux voir la même page que le propriétaire, filtres compris quand il me partage un lien, sans jamais subir un filtre que je n'ai pas choisi ([Écarter un post][08]).

### Tendance — le compte

6. En tant que client, je veux voir mes abonnés en grand : le total en courbe, et dessous des barres gagnés vers le haut, perdus vers le bas, afin de voir quand je perds du monde ([La page entière, en maquette][13], [L'essai réel][17]).
7. En tant que client, je veux voir la portée et les interactions du compte jour par jour, la période d'avant en pointillé, afin de savoir comment ma page vit, hors de mes posts ([Le compte dans le temps][10]).
8. En tant que client, je veux que les jours où j'ai publié soient marqués sous l'axe et ouvrent le post, afin de relier un pic à une publication ([Le compte dans le temps][10]).
9. En tant que client, je veux qu'un jour sans donnée soit un trou, afin de ne pas lire une panne de récolte comme une chute ([Le compte dans le temps][10]).
10. En tant que client qui booste, je veux basculer Tout / Organique / Boosté, et que l'écran me dise pourquoi la portée organique du compte n'existe pas, afin de voir ce que je dois au boost ([Le compte dans le temps][10], [L'essai réel][17]).

### Objectif et métriques

11. En tant que client, je veux choisir un Objectif — Portée, Engagement, Abonnés — puis une métrique de cet objectif, afin de travailler un aspect à la fois ([La structure de la page][01], [La place d'un post][06]).
12. En tant que client, je veux en Engagement le taux, mais aussi les j'aime, commentaires, partages, enregistrements et réactions fortes, chacun séparément, afin de ne pas tout lire à travers un seul taux ([La place d'un post][06], [Les formats et les abonnés][09]).
13. En tant que client, je veux voir chaque métrique définie en une ligne au-dessus des graphes, afin de savoir ce que « post type 0,6 % » veut dire ([La page entière, en maquette][13]).
14. En tant que client, je veux qu'un format sans la métrique reçoive une phrase et non une moustache à zéro (« Instagram ne donne pas les abonnés gagnés pour les Reels »), afin de ne pas croire mes Reels nuls ([La place d'un post][06]).

### Tes posts face à ton année

15. En tant que client, je veux chaque post situé contre **mes 12 derniers mois** du même format, afin de savoir s'il fait mieux que d'habitude sans l'effet « Noël tout haut, janvier tout bas » ([La page entière, en maquette][13]).
16. En tant que client, je veux que changer la période déplace les points sans jamais bouger les moustaches, et que l'écran le dise, afin de ne pas confondre la période lue et la référence ([La page entière, en maquette][13]).
17. En tant que client, je veux voir si mes derniers posts sont plus haut que mon année — 3 derniers mois, dernier mois —, chaque écart écrit avec son nombre de posts, afin de juger moi-même ce qu'il vaut ([La place d'un post hors de l'année][20]).
18. En tant que client, je veux qu'une moustache faite de peu de posts se voie plus fine et plus pâle, et qu'aucune ne se dessine sous 6 posts, afin de ne pas lire un hasard comme une tendance ([La page entière, en maquette][13], [La place d'un post][06]).
19. En tant que client, je veux voir les 5 meilleurs posts de la période sur ma métrique, avec leur vignette, leur place et leur légende, afin de voir à quoi ressemble ce qui marche ([La page entière, en maquette][13]).
20. En tant que client, je veux qu'un post de moins de 7 jours porte son âge et une icône « peut encore changer », afin de ne pas juger trop tôt ([L'âge d'un post][07]).
21. En tant que client, je veux qu'un post neuf se compare aux autres posts **au même âge**, afin qu'un post de 3 jours ne soit pas jugé face à des posts finis ([L'âge d'un post][07]).
22. En tant que client, tant que mon année n'est pas chargée, je veux lire sur quoi porte la référence (« tes posts du 3 août au 5 novembre 2026 (42) »), afin qu'un mois ne se fasse pas passer pour une année ([La profondeur de l'historique][21]).

### Règles de lecture

23. En tant que client, je veux retirer les posts boostés, ou les hors norme de la métrique affichée, afin de voir mes habitudes sans un post qui écrase les autres ([Écarter un post][08]).
24. En tant que client, je veux que la page dise quel filtre tourne et combien de posts il écarte, avec un lien pour revenir aux règles standard, afin qu'un chiffre filtré ne se lise jamais comme le chiffre par défaut ([Les règles d'analyse réglables][11]).
25. En tant que client, je veux qu'un post boosté se reconnaisse partout, sans budget ni chiffre payant, afin de savoir lequel a reçu de l'aide ([Les posts boostés][19]).

### Tableau et Panneau

26. En tant que client, je veux tous mes posts dans un tableau, triable par date et par métrique, afin de retrouver mes meilleurs posts de tous les temps ([La page entière, en maquette][13]).
27. En tant que client, je veux exporter ce tableau vers Excel, date comprise, afin de le retravailler ([Le compte dans le temps][10], [La page entière, en maquette][13]).
28. En tant que client, je veux qu'un post écarté reste au tableau, grisé, avec sa raison, afin que rien ne disparaisse sans trace ([Écarter un post][08]).
29. En tant que client, je veux lire un post dans Pulse — sa vidéo, sa légende, sa place sur chaque métrique —, afin de ne pas retourner sur Instagram ([La page entière, en maquette][13]).

### Les états de la page

30. En tant que client dont le jeton est mort, je veux un grand encart en tête qui dit à quelle date mes chiffres sont figés, ce qui reste juste et ce qui manque, et un bouton « Reconnecter Instagram » ([La page entière, en maquette][13]).
31. En tant que client gratuit, je veux la même page que le payant, qui grandit à chaque post publié, sans appel à l'achat ([Le compte gratuit à 10 posts][18]).

### Ceux qui maintiennent Pulse

32. En tant que David, je veux qu'une métrique non rendue soit écrite `NULL`, jamais 0, afin que la base dise la vérité avant l'écran ([Ce que la récolte et le traitement doivent calculer][14]).
33. En tant que David, je veux que la foule se calcule **une seule fois**, dans `lib/instagram/`, afin que « Tes formats » ne meure pas une deuxième fois de deux calculs qui divergent ([Les formats et les abonnés][09]).

---

## Implementation Decisions — la page

### Bandeau de commandes

- La **période** ; elle choisit les points posés sur le nuage, la Tendance et
  « les 5 meilleurs », **jamais la référence** ([La page entière, en maquette][13]).
- Le bouton discret **« Règles de lecture »**, compteur « · n » quand un filtre
  est coché ([Les règles d'analyse réglables][11]).

### Tendance — « Ta page » ([Le compte dans le temps][10], amendé par [La page entière, en maquette][13])

- **Le compte seul**, lu dans `/{ig-user-id}/insights`, jamais une somme de
  posts. L'Objectif ne la gouverne pas, les Règles de lecture non plus
  ([Les règles d'analyse réglables][11]).
- **À gauche, en grand, les abonnés** : le total en courbe ; dessous, sur le
  même axe des jours, des barres — gagnés (`FOLLOWER`) vers le haut, perdus
  (`NON_FOLLOWER`) vers le bas ([L'essai réel][17]). Jamais de double axe.
- **À droite, empilées** : la **portée** du compte par jour (`reach` en
  `time_series`), avec au-dessus **la portée de la période** que rend
  Instagram (`total_value`, chaque compte compté une fois) — « 65 980 comptes
  touchés sur la période, chacun compté une fois », la période d'avant à côté ;
  jamais la somme des jours, qui compte deux fois ([L'essai réel][17], [arbitrage du 2026-11-06][15]) ;
  les **interactions** du compte par jour (`total_interactions`).
- Sur chaque courbe : trait plein = période, **pointillé = période d'avant** ;
  **jours de publication marqués** sous l'axe, cliquables vers le Panneau —
  le seul pont vers les posts ; **un jour sans donnée est un trou** ; le jour
  en cours exclu ; les 48 dernières heures portent l'icône « peut encore
  changer ». Les valeurs sont dans l'infobulle : **pas de table** sous la
  Tendance.
- **La courbe des abonnés a trois sources mesurées** : `followers_history`
  jusqu'au 2026-09-04 ([L'état des abonnés en base][16]) ; la remontée de
  30 jours au premier passage ; le relevé du compte ensuite
  ([Ce que l'essai réel laisse à décider][22]). **Un trou** entre la première
  et la deuxième. Un jour manquant dans la remontée l'arrête là.
- **Interrupteur Tout / Organique / Boosté**, petit, dans l'en-tête
  ([L'essai réel][17], point 8) :
  - Interactions : Organique = total − `AD`, Boosté = `AD` ;
  - Portée : Boosté = `AD` ; **Organique grisé avec sa raison** — la
    ventilation est dédoublonnée par produit, pas entre produits (somme
    83 519 > total 65 980) ; tout moins boosté compterait deux fois ;
  - Abonnés : sans effet, Meta ne les ventile pas ;
  - aucun lien avec « sans les boostés ».
- **La portée organique du compte** entre à `docs/mesures-impossibles.md` :
  cette spec le demande ([Le compte dans le temps][10]).
- **Retirés** : « Engagement du compte » (une statistique de la foule, lue
  dans le module des posts en Engagement) et « Croissance 30 j » (remplacée
  par la courbe et les barres).

### Sélecteur de vue — l'Objectif et ses métriques ([La place d'un post][06], [Les formats et les abonnés][09], [Les règles d'analyse réglables][11])

| Objectif | Métriques, chacune séparément |
|---|---|
| Portée | **portée (par défaut)** ; vues ; portée ÷ abonnés du jour de publication |
| Engagement | **taux (par défaut)** ; j'aime ; commentaires ; partages ; enregistrements ; réactions fortes |
| Abonnés | **abonnés gagnés pour 1 000 comptes touchés (par défaut)** ; abonnés gagnés (`follows`) ; visites de profil |

- **À l'ouverture** ([arbitrage du 2026-11-06][15]) : Objectif **Engagement** (le taux se compare
  d'un post à l'autre quelle que soit sa portée) ; interrupteur de la Tendance
  sur **Tout** ; Tableau trié par **date, du plus récent au plus ancien** ;
  période du Bandeau **comme Meta** — les 7 jours qui finissent la veille du
  dernier Jour de travail (`saas/web/lib/meta/lecture.ts`, `periodeDe`).
- L'Objectif donne la métrique par défaut ; le module offre ensuite les
  métriques de cet objectif. **Une place à la fois, sur la métrique choisie** :
  le module, la liste et le Tableau la suivent ([La place d'un post][06]).
- **Le Reel n'a ni `follows` ni visites de profil** ([Ce que l'API Instagram
  donne d'un post][02]) : en Abonnés, sa rangée reçoit une phrase, jamais une
  moustache à zéro.
- Une métrique pas encore en base reste **grisée avec sa raison**
  ([La page entière, en maquette][13]).
- Réactions fortes : jamais par défaut. Abonnés pour 1 000 : par défaut en
  Abonnés ([arbitrage du 2026-11-06][15]) — il compare des posts de portées différentes. Les deux vides
  sans portée ([Les formats et les abonnés][09]). Portée ÷ abonnés : « – » quand l'abonné
  du jour manque, aucune estimation ([Les règles d'analyse réglables][11],
  [L'état des abonnés en base][16]).

### « Tes posts face à ton année » ([La page entière, en maquette][13])

Un seul module : il tranche « Comparaison et Sélection, un module ou deux »
de [La structure de la page][01]. **Peu de texte** au-dessus des graphes.

**Au-dessus des rangées, une ligne** : la référence (« tes 12 derniers mois,
format par format — elle ne bouge pas avec la période ») et la définition de
la métrique. Tant que les 12 mois ne sont pas couverts, la référence écrit ce
qu'elle couvre : « référence : tes posts du 3 août au 5 novembre 2026 (42) »
— la même ligne pendant le Rattrapage et pour un compte gratuit, sans mot
propre au gratuit ([La profondeur de l'historique][21],
[Le compte gratuit à 10 posts][18]). Quand une Règle de lecture tourne, une
seconde ligne : « Lu sans les boostés — 4 posts écartés. Revenir aux règles
standard » ([Les règles d'analyse réglables][11]).

**Une rangée par format**, en ordre fixe — Reel, Carrousel, Image, Vidéo du
fil —, jamais trié par valeur, aucune phrase qui les classe
([Les formats et les abonnés][09]). Un format **sans aucun post sur les 12
mois** n'a pas de rangée (la vidéo du fil, chez le compte de l'essai) ; un
format qui en a dans l'année mais **aucun sur la période** garde sa rangée :
sa bande de l'année, et « aucun post sur la période » à la place du nuage
([arbitrage du 2026-11-06][15]).

- **En tête de rangée** : « post type de l'année » et son `n` ; le **total**
  seulement pour ce qui se compte (`follows`, j'aime, commentaires, partages,
  enregistrements, vues, visites de profil), jamais pour la portée ni un
  taux ; « 11 images sur 12 ont ce chiffre » quand des valeurs manquent
  ([Les formats et les abonnés][09]). Puis **deux pastilles d'évolution** :
  « 3 mois +9 % · 15 posts », « 1 mois −12 % · 6 posts » — le post type de la
  fenêtre face au post type des 12 mois, jamais entre elles ; l'écart toujours
  écrit, signé, avec son nombre de posts ; **aucun « ≈ »** ; sous 6 posts,
  pas de pastille ([La place d'un post hors de l'année][20]). **Post type des
  12 mois à 0** : un % n'existe pas (§7) ; la pastille écrit l'écart en
  valeur — « 3 mois : 2 abonnés de plus · 15 posts » ([arbitrage du 2026-11-06][15]).
- **À gauche, le nuage** : les posts de la période, date × métrique, couleur
  du format, posés sur **la bande 25-75 % et la ligne du post type de
  l'année** ; les 5 meilleurs y sont numérotés. Un post de moins de 48 h est
  un point vide ([L'âge d'un post][07]) ; un écarté est gris
  ([Écarter un post][08]) ; un boosté porte un **anneau fin** de sa propre
  couleur, « Boosté » dans l'infobulle ([Les posts boostés][19]).
- **À droite, les moustaches pesées**, même axe : **12 mois** (« la
  référence », large et pleine), **3 derniers mois** (« à lire avec
  prudence »), **dernier mois** (« encore mince ») ; la largeur et l'encre
  d'une boîte suivent son nombre de posts ; la ligne du post type de l'année
  traverse les trois ; **sous 6 posts, pas de moustache**, « 5 / 6 posts » à
  la place. La moustache est détaillée : valeurs du haut de la boîte, du post
  type et du bas écrites, petits points des posts qui la font, moustaches
  arrêtées à la limite hors norme ; un hors norme n'étire pas l'axe, il est
  compté (« ▲ 1 hors norme plus haut ») ([La page entière, en maquette][13],
  deuxième tour). Le coefficient 1,5 est écrit dans l'infobulle de « hors
  norme » ([Les règles d'analyse réglables][11]).
- **À droite du module, la liste des 5 meilleurs posts de la période**,
  collante, qui défile : vignette, valeur, place, mini-moustache « parmi tes
  Reels des 12 derniers mois », légende, étiquette « Boosté » s'il y a lieu
  ([Les posts boostés][19]), « Lire le post ». Aucun filtre propre. Sans les
  écartés ; un post sans valeur ou de moins de 48 h n'y entre pas
  ([Ce que la récolte et le traitement doivent calculer][14], § 4).

### Tableau détaillé — « Tous tes posts » ([La page entière, en maquette][13])

- **Tout l'historique en base**, sans filtre de période. Les meilleurs de tous
  les temps s'y trouvent en triant.
- Colonne **Date** triable dans les deux sens ; chaque métrique triable ;
  colonne **Place** sur la métrique choisie ; la date du dernier relevé
  ([La profondeur de l'historique][21]) ; l'étiquette « Boosté » à côté du
  format ([Les posts boostés][19]).
- Colonne **temps de visionnage moyen**, remplie pour les Reels, « – »
  ailleurs ([arbitrage du 2026-11-06][15]).
- Un post de plus de 12 mois : Place = **« plus d'un an »**, triable sur sa
  valeur brute, hors de tout calcul ([La place d'un post hors de l'année][20]).
- Un écarté reste, **grisé, avec sa raison** : « écarté : hors norme sur les
  j'aime », « écarté : boosté » ([Écarter un post][08]).
- **Export `.csv` pour Excel** : point-virgule, Date en première colonne, une
  absence = cellule vide, jamais 0 ([La page entière, en maquette][13],
  [Ce que la récolte et le traitement doivent calculer][14]).

### Panneau latéral — « lire un post » ([La page entière, en maquette][13])

- Ouvert par `?post=` depuis le nuage, la liste, le Tableau ou un jour de
  publication de la Tendance.
- **Le lecteur public d'Instagram** pour un Reel ou une vidéo, à partir du
  `permalink` : Pulse ne garde que l'image, et le lien vidéo de Meta expire.
  Sans `permalink`, ni lecteur ni lien.
- La légende, le lien public, l'âge et son icône, la valeur et la moustache
  sur la métrique choisie, et **sa place sur chaque métrique**.
- Pour un boosté : l'étiquette et la ligne « Chiffres organiques, hors boost —
  Instagram les rend ainsi » ([Les posts boostés][19]).
- Pour un Reel : **le temps de visionnage moyen** ; « – » pour les autres
  formats ([Les formats et les abonnés][09], [arbitrage du 2026-11-06][15]).
- Absents : le carrousel entier, les commentaires.

### Les états de la page ([La page entière, en maquette][13])

- **Compte neuf** : un seul encart qui dit ce que le premier passage du worker
  lira.
- **Jeton mort** : un grand encart en tête, pleine largeur — « Tes chiffres
  Instagram sont figés au … », ce qui reste juste, ce qui manque,
  « Reconnecter Instagram » ; la page grisée dessous, badge « figé au … ».
- **Compte gratuit** : aucun mode à part. La même page, les mêmes règles ; le
  minimum de 6 par format fait le tri, la page le dit ; **aucun appel à
  l'achat** ([Le compte gratuit à 10 posts][18]).

### L'état de la page vit dans l'URL

Les deux Règles de lecture, jamais mémorisées, rien d'écrit en base
([Écarter un post][08]) ; le post ouvert (`?post=`). Le lien « Revenir aux
règles standard » ne retire que les deux filtres et garde le reste
(`CLAUDE.md` §8, [Les règles d'analyse réglables][11]).

---

## Implementation Decisions — la lecture (`lib/instagram/`)

**Un seul calcul de la foule, à la lecture**, dans un dossier commun qui sert
le module, la liste, le Tableau, le Panneau et l'export — la période est libre
et les filtres sont dans l'URL, donc rien ne se calcule d'avance. **Rien dans
le traitement Python** : `build_payload` ne touche pas à la page Instagram
([Les formats et les abonnés][09], [Ce que la récolte et le traitement doivent
calculer][14]). Fonctions pures, sans `"use client"` (`CLAUDE.md` §8).

| Valeur | Calcul |
|---|---|
| **format** | `REELS` → Reel ; `FEED` + `VIDEO` → Vidéo du fil ; `CAROUSEL_ALBUM` → Carrousel ; `IMAGE` → Image. `media_product_type` vide + `VIDEO` → **format inconnu**, hors des quatre foules. |
| **métriques brutes** | Le dernier relevé, lu tel quel : **null reste null** (aujourd'hui `Number(p.x) \|\| 0` refait des zéros). |
| **taux d'engagement** | (j'aime + commentaires + enregistrements + partages) ÷ portée × 100 ; vide si la portée est vide ou nulle, ou si un terme manque. Les partages s'ajoutent aux trois termes de l'ADR 0008, qui reprenait la formule en place quand ils n'étaient pas récoltés ; le chiffre affiché bouge, et le dit ([arbitrage du 2026-11-06][15]). |
| **réactions fortes** | (enregistrements + partages) ÷ portée ; même règle du vide. |
| **abonnés pour 1 000** | `follows` ÷ portée × 1 000 ; vide sur un Reel. |
| **portée ÷ abonnés** | portée ÷ abonnés du jour de publication ; vide si ce jour n'a pas d'abonnés mesurés. |
| **âge** | `releve_a − date`, en heures. < 48 h : hors de la foule, aucune place. 48 h → 7 jours : place à âge égal. Au-delà : la référence. Sans `releve_a` : plus de 7 jours. 48 h = la seule latence que Meta documente ([Quand les chiffres d'un post se figent][03], [L'âge d'un post][07]). |
| **la référence** | Les posts du format, **12 mois glissants**, âge > 48 h, valeur non vide, le post lui-même compris. Quartiles **exclusifs** — ceux de `statistics.quantiles(method="exclusive")`, contrôle [1…6] → 1,75 / 3,5 / 5,25 ; médiane = post type ; `n` et « x sur n » ; **rien sous 6** ([La place d'un post][06], [La page entière, en maquette][13]). |
| **3 mois, 1 mois** | Mêmes quartiles sur les fenêtres plus courtes, minimum 6 ; écart de leur médiane à celle des 12 mois, en %. Aucune place calculée contre elles ([La place d'un post hors de l'année][20]). |
| **la place** | Sous q1 « en dessous » ; q1 → médiane « bas de tes habitudes » ; médiane → q3 « haut de tes habitudes » ; au-delà de q3 « au-dessus ». **Hors norme** hors de [q1 − 1,5 × IQR ; q3 + 1,5 × IQR]. Les bornes exactes : § Ce qui reste ouvert. |
| **place à âge égal** | Pour un post à J+n (n = ⌊âge ÷ 24⌋, 2 ≤ n ≤ 7) : de chaque autre post du format sur 12 mois, son **premier** relevé tombé dans [n × 24 ; (n+1) × 24) h ; mêmes quartiles ; minimum 6, sinon pas de place et une mention ([L'âge d'un post][07], [Ce que la récolte et le traitement doivent calculer][14]). |
| **« sans les hors norme »** | Bornes de Tukey calculées **une fois** sur la référence de la métrique affichée, posts au-delà retirés, quartiles refaits sur le reste, **sans recommencer** ; minimum 6 jugé après le retrait ; nombre d'écartés et raison. Désactivé par défaut ([Écarter un post][08]). |
| **« sans les boostés »** | Retire les boostés (`booste_vu_le` non null) de toutes les foules, toutes métriques ; même comptage ([Écarter un post][08], [Les posts boostés][19]). |
| **totaux d'un format** | Somme des valeurs non vides, avec « x sur n » ; jamais portée ni taux. |
| **les 5 meilleurs** | Posts de la période, âge > 48 h, sans les écartés, valeur non vide ; tri décroissant sur la métrique choisie. |
| **plus de 12 mois** | Aucune place, hors de toute foule, de toute moustache, de toute pastille ([La place d'un post hors de l'année][20]). |
| **la Tendance** | Séries par jour de `instagram_compte_jours` (et `followers_history` pour les abonnés d'avant le 2026-09-04), période et période d'avant ; jours de publication = dates des posts. |

**La mention sous 6 posts** garde sa raison quand un filtre en est la cause :
« 5 Reels, il en faut 6 — 1 est écarté par ton filtre » ([Écarter un post][08]).

**Pagination** : posts et relevés dépassent vite 1 000 lignes —
`lireToutesLesPages` partout (`CLAUDE.md` §8).

**Ce qui part de la lecture actuelle** (`lib/channels.ts:getInstaDash`) :
`followers`, `followersDelta`, `growth30`, `avgEng`, `histReach`,
`followersSeries`, `topPosts` / `scope`, `postsEng`, `comparaison`
(`batirComparaison`) et `FORMAT_LABEL` (qui fait d'une `VIDEO` un Reel). La
lecture ajoute `permalink`, en base mais ignoré aujourd'hui. Les prototypes
`app/instagram/_prototype-page/` et `_prototype-selection/` (dont
`calcul.ts`) sont jetables : `lib/instagram/` s'écrit neuf, avec son contrôle
[1…6] ([Ce que la récolte et le traitement doivent calculer][14], § 5).

---

## Implementation Decisions — la récolte

### Ce qui se corrige ([Ce que la récolte et le traitement doivent calculer][14], § 1 ; [L'essai réel][17])

- **R1** — `post_metrics.py` choisit ses métriques par `media_product_type` :
  `REELS` et `FEED` demandent `reach, views, likes, comments, saved, shares` ;
  `FEED` seul ajoute `follows, profile_visits`. La vidéo du fil retrouve ses
  j'aime. `REELS` ajoute **le temps de visionnage moyen** ([arbitrage du 2026-11-06][15]) — rendu pour
  les seuls Reels d'après [Ce que l'API Instagram donne d'un post][02] ; son
  nom exact se relève dans la doc Media Insights à la construction ; non
  essayé avec notre jeton : vérifié au premier passage du worker, grisé
  avec sa raison s'il ne revient pas.
- **R2, R3** — une métrique non rendue **reste absente** : plus de `val or 0`,
  plus de `follows = 0` en cas d'exception ; `m.get(k)` au lieu de
  `m.get(k, 0)`. `follows` sur un Reel rend une **erreur 100** → null ; sur un
  post du fil, 0 est un vrai 0 (essai : 4 posts sur 15).
- **R4** — `media_product_type` de `info_du_post` passe à
  `metriques_du_post` ; un post sans `media_product_type` prend `FEED` sans
  `follows`.
- **R5** — `followers_count`, lu puis jeté par `sync.py`, s'écrit dans le
  relevé du compte.
- Les scopes actuels suffisent, sans `pages_read_engagement` ([L'essai
  réel][17], point 1).

### Ce qui s'ajoute

- **Le relevé d'un post** : chaque lecture des métriques ajoute une ligne,
  avec son âge **réel** — un passage manqué donne un J+8, jamais un faux J+7.
  Rien ne s'écrase, rien ne se reconstitue ([Garder l'historique][05]).
- **Le passage léger quotidien**, nouveau mode du worker au cron de 07:00 UTC,
  **tous les comptes Instagram, Jour de travail ou non** (`_due_today` écarte
  aujourd'hui les autres jours) : relevé des posts de moins de 8 × 24 h
  (2 appels, 1 pour un Reel) ; première page de l'inventaire
  (`/media?limit=25`) et fiche des posts neufs — sinon un post du mardi
  attendrait le Jour de travail pour son premier relevé ; relevé du compte ;
  un bloc du Rattrapage. Il ne touche pas au rapport ([Garder
  l'historique][05], [Ce que la récolte et le traitement doivent
  calculer][14], § 2.2).
- **La relecture** : chaque jour de J+0 à J+7 ; à chaque Jour de travail, les
  posts de moins de 30 jours ; **tous les 3 mois, tous les posts en base**
  (2 à 3 appels, sans image). `_a_relire` perd, pour le payant, son plafond de
  200 posts et sa reprise à 40 ([La profondeur de l'historique][21]).
- **Le Rattrapage** (payant) : tous les posts que Meta rend, du plus récent au
  plus ancien, un bloc par passage quotidien ; la page se remplit à mesure ;
  la taille du bloc se fixe sur la durée mesurée d'un passage ([La profondeur
  de l'historique][21]).
- **Le compte gratuit** : les 10 plus récents à l'arrivée, puis tout post
  absent de la base s'ajoute, rien ne s'efface, relu comme le payant ;
  `_a_relire` cesse de tronquer à `df["id"][:10]` après la première récolte ;
  pas de Rattrapage (`is_paid`) ([Le compte gratuit à 10 posts][18]).
- **Le relevé du compte, pour hier** : `reach` (`period=day`),
  `total_interactions` (un appel par jour, [Ce que l'API Instagram donne du
  compte][04]), `follows_and_unfollows` par `follow_type`, `followers_count`
  du passage, et la part `AD` de `reach` et `total_interactions`
  (`breakdown=media_product_type`) ([Le compte dans le temps][10],
  [L'essai réel][17]).
- **Au premier passage d'un compte** : 90 jours de portée (1 appel) et
  d'interactions (~90 appels) ; la **remontée des abonnés sur 30 jours** —
  total d'un jour passé = total du jour − gagnés + perdus des jours suivants,
  `follows_and_unfollows` jour par jour (~30 appels, **non essayé**) ; un
  jour manquant arrête la courbe ([Ce que l'essai réel laisse à décider][22]).
- **Le marqueur de boost** : `boost_ads_list` lu à chaque relevé, au même
  appel ; dédoublonné par `ad_id`, statuts en minuscules ; **boosté = au moins
  une annonce hors `error`** ; `booste_vu_le` prend la date la première fois
  et ne se vide plus ; les annonces terminées restent listées ; aucune
  relecture de plus ([Les posts boostés][19], [L'essai réel][17],
  [Ce que l'essai réel laisse à décider][22]).
- **La relecture unique de tous les posts en base**, premier grand passage :
  remplit `media_product_type`, `permalink`, `shares`, `profile_visits`,
  `booste_vu_le`, les j'aime des vidéos, vide `follows` des Reels. Un
  **drapeau dédié** de `weekly-fetch.yml`, qui sert ensuite au trimestriel,
  lancé à la main après la migration ([Ce que la récolte et le traitement
  doivent calculer][14], § 2.5 ; [La profondeur de l'historique][21]).

---

## Implementation Decisions — la base

Tout en **ajout seul**, une section 23 de `000_run_me_all.sql`, RLS en lecture
au propriétaire comme `couverture_recolte` ([Ce que la récolte et le
traitement doivent calculer][14], § 3). Les noms sont proposés : la
construction peut les renommer, pas en changer le sens.

- **`instagram_organic_posts`** reste la fiche du post et son dernier relevé.
  Colonnes en plus : `shares` (int, null), `profile_visits` (int, null),
  `releve_a` (timestamptz, null = antérieur au relevé), `booste_vu_le` (date,
  null = aucun boost vu).
- **`instagram_post_releves`** (nouvelle), clé `(user_id, post_id,
  releve_a)` : `age_heures` (numérique, réel), `reach, views, likes,
  comments, saved, shares, follows, profile_visits` tous nullables, `booste`
  (booléen du moment). Index `(user_id, age_heures)`.
- **`instagram_compte_jours`** (nouvelle), clé `(user_id, jour)` : `reach`,
  `total_interactions`, `abonnes`, `gagnes`, `perdus`, `reach_ad`,
  `interactions_ad`. Un jour sans ligne est un trou.
- **`followers_history`** se garde : ses 176 lignes mesurées (jusqu'au
  2026-09-04) sont le premier morceau de la courbe des abonnés
  ([L'état des abonnés en base][16]).
- **Le nettoyage, à faire valider par David** (`CLAUDE.md` §7 : une écriture
  qui efface) : après la relecture unique, les posts qu'elle n'a pas pu relire
  gardent leurs faux zéros. `UPDATE … SET follows = NULL, likes = NULL WHERE
  type = 'VIDEO' AND media_product_type IS NULL`, **compté avant** par un
  `SELECT count(*)` sur la même condition et montré à David.

---

## Testing Decisions

**Un bon test** donne une entrée écrite à la main (une réponse Graph, des
lignes de base) et vérifie ce que le client lira : un nombre, un « – », une
place, une moustache absente. Deux seams, comme la spec Meta ; `saas/web` n'a
pas de lanceur, chaque ticket **écrit son harnais** et le dit (`CLAUDE.md` §9).

1. **Récolte — « réponse Graph → lignes à écrire »**, sans réseau : erreur
   100 de `follows` sur un Reel → null ; 0 sur le fil → 0 ; métriques
   choisies par `media_product_type` ; une annonce `error` seule ne marque
   pas ; `booste_vu_le` ne se vide jamais ; la remontée des abonnés et son
   arrêt ; l'âge réel d'un relevé.
2. **Page — « lignes de base + URL → contenu des modules »**, les fonctions
   de `lib/instagram/` : [1…6] → 1,75 / 3,5 / 5,25 ; null jamais compté 0 ;
   rien sous 6, et la raison d'un filtre ; Tukey en une passe ; aucun total de
   portée ni de taux ; plus de 12 mois et moins de 48 h hors de la foule ;
   l'âge égal sur le premier relevé du bon J+n ; format inconnu hors des
   foules ; la période ne change pas les quartiles ; l'export.

**Ce qui ne se vérifie qu'en vrai** — rien ne se voit en cliquant :
- `rm -rf .next tsconfig.tsbuildinfo`, `npx tsc --noEmit`, `npm run build`
  verts, **18 routes**, les deux dossiers `_prototype-*` partis.
- **La relecture unique** : lancement à la main depuis l'onglet GitHub
  Actions (`weekly-fetch.yml`, drapeau dédié), puis la sonde de [Ce que la
  récolte et le traitement doivent calculer][14] (§ 0) rejouée.
- **Le premier relevé** du passage léger et du compte : au **cron suivant**
  (07:00 UTC). L'âge égal : des semaines de relevés.
- La migration sur un PostgreSQL jetable avant d'être donnée à David.

---

## Out of Scope

- **Les thèmes et les labels** ; **Google Ads** et toute refonte de Meta (carte).
- **Un mode avancé**, tout paramètre de calcul réglable
  ([Les règles d'analyse réglables][11], [L'âge d'un post][07]).
- Au `BACKLOG.md` : **écarter un post à la main** ([Écarter un post][08]),
  **les relevés heure par heure** ([Garder l'historique][05]), **où pousser
  le payant** ([Le compte gratuit à 10 posts][18]), **le bug de production**
  de `followers_history` ([L'état des abonnés en base][16]).
- **Un budget ou un chiffre payant** sur un boosté ([Les posts boostés][19]).
- **Une table sous la Tendance** ([Le compte dans le temps][10]) ;
  **« Évolution des posts »** ([La structure de la page][01]).

---

## Notes

### Contradictions tranchées par l'ordre chronologique

Le plus récent fait foi ; l'ancien porte souvent déjà un encadré « Amendé par ».

| Sujet | Avant | Fait foi |
|---|---|---|
| La référence | la période ([La place d'un post][06]), puis les X derniers posts | 12 mois glissants ([La page entière, en maquette][13], [La place d'un post hors de l'année][20]) |
| La mention sous 6 posts | « une période plus longue en contiendrait assez » ([La place d'un post][06]) | « 5 / 6 posts » ([La page entière, en maquette][13]) |
| Le seuil de ±5 % | posé ([La page entière, en maquette][13]) | retiré ([La place d'un post hors de l'année][20]) |
| « Boosts vus seulement quand ils tournaient » | prévue ([Les posts boostés][19]) | tombée ([L'essai réel][17]) |
| Boosté | au moins une annonce ([Les posts boostés][19]) | hors `error` ([Ce que l'essai réel laisse à décider][22]) |
| L'ordre de la Tendance | Portée → Interactions → Abonnés ([Le compte dans le temps][10]) | abonnés en grand à gauche ([La page entière, en maquette][13]) |
| Le départ des abonnés | au premier relevé ([Le compte dans le temps][10]) ; la lecture quitte `followers_history` ([Ce que la récolte et le traitement doivent calculer][14], § 3.5) | remontée de 30 jours ([Ce que l'essai réel laisse à décider][22]) ; `followers_history` se garde ([L'état des abonnés en base][16]) |
| Gagnés / perdus ou net | les deux issues ([Le compte dans le temps][10]) | gagnés / perdus ([L'essai réel][17]) |
| Comparaison et Sélection | deux modules ([La structure de la page][01]) | un seul ([La page entière, en maquette][13]) |
| La relecture | J+30, plafond 40, 200 / 10 posts ([Garder l'historique][05]) | [La profondeur de l'historique][21], [Le compte gratuit à 10 posts][18] |
| `follows` en base | absent ([La page entière, en maquette][13]) | présent, faux zéros sur les vidéos ([Ce que la récolte et le traitement doivent calculer][14]) |
| Le taux d'engagement | trois termes ([La page entière, en maquette][13]) | quatre ([Ce que la récolte et le traitement doivent calculer][14]), au-delà de l'ADR 0008 — [arbitrage du 2026-11-06][15] |
| Une place à la fois | partout ([La place d'un post][06], point 9) | sauf au Panneau, « sa place sur chaque métrique » ([La page entière, en maquette][13]) |

**`profile_visits`** : [Ce que la récolte et le traitement doivent
calculer][14] le dit « à retirer si la spec ne lui donne pas de place ».
[La place d'un post][06] (point 7) et [Les formats et les abonnés][09] lui en
donnent une — métrique de l'objectif Abonnés, comptée dans les totaux. Il
reste récolté.

### La forme de la Sélection attend son ticket

[Le carré de sélection, en maquette][12] est **encore ouvert**, tenu par une
autre session. Cette spec suit [La page entière, en maquette][13] : les 5
meilleurs de la période, en liste à droite, sans choix de mode. [Le
carré][12] peut encore changer cette forme ; le reste de la spec n'en dépend
pas.

### Ordre de construction suggéré ([Ce que la récolte et le traitement doivent calculer][14], § 6)

1. R1 à R5, la migration, la relecture unique (drapeau dédié), puis le
   comptage et le nettoyage validé par David.
2. Le passage léger, le relevé du compte, le premier passage (90 jours,
   remontée des abonnés), le marqueur de boost.
3. Le Rattrapage par blocs, après la mesure de la durée d'un passage ; la
   relecture trimestrielle.
4. `lib/instagram/` et la page ; l'entrée de `docs/mesures-impossibles.md`.

### Dans le brouillard, sans bloquer

Le poids des images stockées (1 Go au plan gratuit) n'est pas mesuré ; la
durée d'un passage, donc la taille d'un bloc, se mesure à l'essai ([La
profondeur de l'historique][21]).

---

## Ce qui reste ouvert

Rien ici n'est comblé par la spec : chaque point attend une décision de David.

1. **Les stories** : non récoltées ; lisibles 24 h, les garder exige le
   webhook `story_insights` — utiles ou non, à voir avec la structure de la
   page (carte, Not yet specified ; [Ce que l'API Instagram donne d'un
   post][02]).
2. **La cohérence avec l'hebdo** : l'onglet Organique de la frise et la page
   Instagram doivent parler des mêmes posts avec les mêmes mots (carte, Not
   yet specified). Y tient aussi **la phrase qui explique l'écart** entre le
   dernier relevé et le rapport hebdo, figé au jour de sa publication :
   [Garder l'historique][05] en renvoyait le texte à la maquette, et
   [La page entière, en maquette][13] ne l'a pas écrit.
3. **La forme de la Sélection** — [Le carré de sélection, en maquette][12],
   ouvert : « 5 meilleurs » seulement ([La page entière, en maquette][13]) ou
   aussi « 5 plus récents » et « à la main » ([La structure de la page][01],
   [Le carré][12]) ; et **le lien qui garde la sélection** (posts choisis et
   objectif), demandé par [La structure de la page][01], que [La page
   entière, en maquette][13] ne reprend pas.
4. **Les bornes exactes des bandes** (≤ ou < à q1, à la médiane, à q3, aux
   limites de Tukey) : [Ce que la récolte et le traitement doivent
   calculer][14] dit qu'elles « s'écrivent une fois, dans la spec » ; aucun
   ticket ne les fixe.
5. **`docs/mesures-impossibles.md` n'existe plus** : tout `docs/` a quitté
   l'arbre au commit `1b05a92`, sur `main` aussi. [Le compte dans le
   temps][10] y fait entrer la portée organique du compte : recréer le
   fichier, ou dire ailleurs ce qu'on ne mesure pas.

[01]: issues/01-la-structure-de-la-page.md
[02]: issues/02-ce-que-l-api-donne-d-un-post.md
[03]: issues/03-quand-les-chiffres-d-un-post-se-figent.md
[04]: issues/04-ce-que-l-api-donne-du-compte.md
[05]: issues/05-garder-l-historique-d-un-post.md
[06]: issues/06-la-place-d-un-post.md
[07]: issues/07-l-age-d-un-post.md
[08]: issues/08-ecarter-un-post.md
[09]: issues/09-les-formats-et-les-abonnes.md
[10]: issues/10-le-compte-dans-le-temps.md
[11]: issues/11-les-regles-d-analyse-reglables.md
[12]: issues/12-le-carre-en-maquette.md
[13]: issues/13-la-page-entiere-en-maquette.md
[14]: issues/14-ce-que-le-traitement-doit-calculer.md
[15]: issues/15-la-spec-de-la-page-instagram.md
[16]: issues/16-l-etat-des-abonnes-en-base.md
[17]: issues/17-l-essai-reel-des-metriques.md
[18]: issues/18-le-compte-gratuit-a-10-posts.md
[19]: issues/19-les-posts-boostes.md
[20]: issues/20-la-place-d-un-post-hors-de-l-annee.md
[21]: issues/21-la-profondeur-de-l-historique.md
[22]: issues/22-ce-que-l-essai-laisse-a-decider.md
