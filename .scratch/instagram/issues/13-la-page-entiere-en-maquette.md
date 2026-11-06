# 13: La page entière, en maquette

Type: prototype
Status: resolved
Blocked by: 12
Assignee: David (session Claude, 2026-11-06)

## Question

**La page `/instagram` entière se lit-elle bien, de haut en bas ?** Une
maquette jetable qui assemble la structure tranchée
([La structure de la page](01-la-structure-de-la-page.md)), le compte dans le
temps, le carré, les formats et les abonnés, l'aperçu d'un post et la liste de
tous les posts — pour juger l'ordre, le poids de chaque bloc, et ce qui fait
doublon une fois tout posé côte à côte. Elle fixe aussi le Panneau latéral
« lire un post » (fog de la carte) et les états de la page (compte à 10 posts,
compte neuf, jeton mort).

> **Éclairé par [La place d'un post](06-la-place-d-un-post.md) (2026-11-03)** :
> à juger ici — **le nuage date × métrique** à côté de la moustache (couleur
> par format, posts jeunes en creux), et la **réserve de David** : la
> Comparaison compare des formats, le nuage montre des posts, deux niveaux
> dans un module. Aussi : le choix de métrique dans l'objectif, la phrase qui
> remplace la moustache d'un format sans la métrique, la mention « pas assez
> de posts » et son mobile.

> **Éclairé par [Les formats et les abonnés](09-les-formats-et-les-abonnes.md)
> (2026-11-03)** : quatre formats en ordre fixe (Reel, Carrousel, Image,
> Vidéo du fil) ; **un bloc par format au-dessus des moustaches** — post
> type, total (seulement pour ce qui se compte), `n`, « x sur n » ; aucune
> phrase de classement ; le temps de visionnage du Reel se montre au niveau
> du post (Sélection, Panneau latéral, Tableau), pas dans la Comparaison.

> **Repris de [Le compte dans le temps](10-le-compte-dans-le-temps.md)
> (2026-11-05)** : la Tendance montre la page seule — trois courbes de
> compte (Portée, Interactions, Abonnés en cumul + barres gagnés/perdus),
> période d'avant en pointillé, publications marquées, un petit filtre
> Tout / Organique / Boosté dans son en-tête ; pas de table sous elle. Le
> Tableau des posts **s'exporte vers Excel** (David, 2026-11-04).

> **Éclairé par [Les règles d'analyse réglables](11-les-regles-d-analyse-reglables.md)
> (2026-11-05)** : le Bandeau porte « Règles de lecture » (les deux filtres,
> désactivés par défaut, compteur « · n ») ; ils ne touchent que la foule
> des posts — l'interrupteur Tout / Organique / Boosté de la Tendance reste
> à part. La métrique « portée ÷ abonnés » figure dans l'objectif Portée.

## Prototype (2026-11-06)

Monté dans la vraie page `/instagram` (hors production seulement), sur les
posts réels du compte, derrière `?maquette=page` :
`saas/web/app/instagram/_prototype-page/` (`maquette.tsx`, `switcher.tsx`).
Le calcul de la foule est **celui du carré** (`_prototype-selection/calcul.ts`,
[Le carré de sélection, en maquette](12-le-carre-en-maquette.md)) : une seule
copie des règles tranchées. Capturé sur la branche jetable
`prototype/instagram-page` (avec le prototype du carré, dont il dépend),
jamais sur `main`.

Lancer : `cd saas/web && npm run dev`, puis ouvrir
`/instagram?maquette=page&d=90&pv=A` ; ← → basculent entre les pages.
`?etat=gratuit|neuf|jeton` simule les états (pastilles dans le bandeau de la
maquette).

**Hypothèse de départ** : le carré n'a pas encore son verdict. Plutôt que
d'attendre, chaque page embarque **sa** forme de Sélection — les juger en
contexte aide à trancher « un module ou deux » du ticket 12, sans le résoudre
ici.

- **A · Le squelette** : l'ordre de [La structure de la page](01-la-structure-de-la-page.md)
  au mot près — Ta page (trois courbes) → Sélecteur de vue collant
  (objectif + métrique + Règles de lecture) → Comparaison (un bloc par
  format, moustaches sur une échelle commune) → Sélection (5 cartes) → Tous
  tes posts (Tableau, colonne Place, coches, « Exporter vers Excel »).
  Panneau latéral en surimpression (`?post=`).
- **B · La foule en un module** : la Tendance compacte, puis **un seul
  module** « Tes posts dans la foule » — blocs de format, **le nuage date ×
  métrique** (couleur = format, creux = moins de 48 h / peut encore changer
  / écarté, triangle = au-delà de l'axe) et, à sa droite, **une moustache
  verticale par format sur le même axe** ; la Sélection y est numérotée et
  rappelée en bande de vignettes. Puis le Tableau. C'est le test de la
  réserve de David (« formats et posts, deux niveaux dans un module »).
- **C · Le fil d'abord** : la Tendance en bande, les blocs de format
  cliquables (ils filtrent la liste, `?pf=`), puis deux colonnes — **le
  Tableau comme colonne vertébrale** (on coche pour composer la Sélection)
  et, à droite, un **Panneau collant** : la Sélection sur les moustaches tant
  qu'aucun post n'est ouvert, le post lu dès qu'on en clique un. Sélection et
  Panneau latéral fusionnent dans cette colonne.

Communs aux trois : l'objectif (Portée / Engagement / Abonnés) et ses
métriques, celles absentes de la base **grisées avec leur raison** (portée ÷
abonnés, partages, tout l'objectif Abonnés) ; la phrase des écartés ; le
Panneau « lire un post » — image, légende, lien public (`permalink` en base,
pas encore lu), la valeur et la moustache sur la métrique choisie, **sa place
sur chaque métrique**, et une ligne « à trancher » pour la vidéo, le
carrousel entier, les commentaires et le temps de visionnage.

Ce que la maquette a déjà montré (90 jours, 31 posts) :
- **Le haut de la page est vide aujourd'hui** : ni la portée ni les
  interactions du compte ne sont en base. Seuls les jours de publication
  (réels, cliquables) peuplent les deux cadres.
- **Le seul grand chiffre du haut ment par son âge** : « Abonnés 76 517 »
  vient du dernier relevé de `followers_history`, le **2026-09-04** — deux
  mois. La page doit dire l'âge d'un relevé dès qu'il dépasse un passage
  (fog « Les états de la page »).
- **L'objectif Abonnés n'a aucun chiffre par post** : ni `follows` ni
  `shares` dans `instagram_organic_posts`. Le troisième objectif dépend
  entièrement de [Ce que la récolte et le traitement doivent calculer](14-ce-que-le-traitement-doit-calculer.md).
- **Sur 90 jours, 2 formats sur 4 ont une moustache** : Reel (15) et
  Carrousel (11) ; Image en a 5 (« il en faut 6 ») ; la Vidéo du fil n'a
  aucun post et la maquette **cache son bloc** — alors que
  [Les formats et les abonnés](09-les-formats-et-les-abonnes.md) dit « quatre
  formats en ordre fixe ». À trancher : un bloc vide se montre-t-il ?
- **En J'aime, le Reel lit « 0 sur 15 mesurés »** : le défaut de récolte du
  ticket 02, visible dès qu'on touche l'objectif Engagement.
- **Un Carrousel de J+5 est placé « au-dessus » face à toute la foule** :
  l'âge égal n'existe pas encore (pas de relevés) ; la maquette ne le simule
  pas, l'icône ◔ seule le signale.
- **Compte gratuit (10 posts)** : plus aucune moustache, chaque format sous
  6 — la page n'est alors plus qu'un Tableau ; à porter à
  [Le compte gratuit à 10 posts](18-le-compte-gratuit-a-10-posts.md).
- **Doublon vu en A** : la Sélection « 5 meilleurs » répète les cinq
  premières lignes du Tableau trié sur la même métrique. B et C l'évitent,
  chacune à sa façon.

### Pour trancher (David)

1. **Quelle page** — A, B, C, ou un assemblage (« la Tendance de B, la
   colonne de C… ») ?
2. **Le nuage** (B) : garde-t-on les posts dans le même module que les
   formats, ou la réserve tient-elle ?
3. **Le Panneau latéral** : surimpression (A, B) ou colonne collante qui
   absorbe la Sélection (C) ?

## Réaction de David (2026-11-06)

- **La page B est retenue** : le nuage des posts et, à sa droite, les
  moustaches des formats, côte à côte — « on voit les posts ». Mais **sur
  toute la largeur**.
- Sous le nuage, **les posts choisis** (« les 5 meilleurs », vus directement
  dans le nuage), chacun avec **la petite moustache de la page A** qui dit
  où il se situe, ses chiffres, et **le texte du post** (« autumn,
  machin… »). **Lire la vidéo** si possible.
- **Expliquer chaque chiffre** : « post type 0,6 % », c'est quoi ? Et la
  moustache, plus de détails.
- **Décision nouvelle — la moustache se calcule sur les X derniers posts du
  format, pas sur la période** : « qu'on comprenne que si on change la date,
  ça ne change pas mes moustaches, parce que c'est pris sur les X derniers
  posts » — et que ce soit bien écrit à l'écran. **Cela remplace « parmi
  ceux de son format sur la période »** de [La place d'un post](06-la-place-d-un-post.md) :
  à reporter dans sa réponse et dans la carte quand ce ticket se résout.
- **La Tendance** : il veut voir comment Portée, Interactions et Abonnés du
  compte fonctionneront, pas trois cadres vides.
- **Compte gratuit** et **compte neuf** : bien. **Jeton mort** : « super »,
  mais plus joli et plus présent sur la page — « assez important ».
- Puis : refaire B avec tout cela, et **d'autres versions bâties sur B**.

## Prototype, deuxième tour (2026-11-06)

Même adresse, `/instagram?maquette=page&d=90&pv=A`. Trois versions de la
page « nuage + moustaches » :

- **A · Côte à côte** — la B corrigée : nuage et moustaches sur toute la
  largeur, une légende dessinée à droite (post type, boîte, moustaches, hors
  norme), puis les 5 posts choisis en cartes : média (▶ sur un Reel),
  date et âge, valeur, place, **mini-moustache « parmi tes 20 derniers
  Reels »**, trois lignes de légende, les six chiffres du post.
- **B · Un nuage par format** — une ligne par format : son post type écrit
  en phrase à gauche, son nuage et sa moustache sur **sa propre échelle**
  (un Reel se lit contre tes Reels), puis les mêmes cartes.
- **C · Les cartes à côté** — le nuage à gauche, les 5 posts en colonne
  collante à droite, en cartes compactes ; la vidéo s'ouvre dans le Panneau.

Ce qui a changé, pour les trois :
- **La foule = les N derniers posts du format** (de plus de 48 h), tout
  l'historique confondu ; la période ne choisit que les posts posés dessus.
  Un bandeau le dit en tête du module : « Changer la date déplace les
  points, jamais les moustaches ». La maquette laisse choisir 12 / 20 / 30
  pour juger X (`?pn=`) ; **20 par défaut**.
- **Chaque chiffre en phrase** : « post type en portée : la moitié de tes
  20 derniers Reels fait plus, l'autre moins — sur 20 posts, du 7 juil. au
  1er nov. » ; la définition de la métrique au-dessus (« Engagement =
  (j'aime + commentaires + enregistrements) ÷ portée — sur 100 comptes
  touchés, combien ont réagi »).
- **La moustache détaillée** : valeurs du haut de la boîte, du post type et
  du bas écrites à côté, les petits points des posts qui la font, des
  moustaches arrêtées à la limite hors norme (Tukey) ; un hors norme de la
  référence n'étire plus l'axe, il est compté en haut (« ▲ 1 hors norme
  plus haut »).
- **La vidéo** : la récolte ne garde que l'image (`_image_du_post`,
  `sync.py`) et le lien vidéo de Meta expire. La maquette ouvre donc **le
  lecteur public d'Instagram** à partir du `permalink` du post (en base,
  lu par la maquette elle-même, pas par `getInstaDash`) — dans la carte et
  dans le Panneau. Vérifié : il joue. À porter au ticket du traitement :
  lire `permalink` ; quelques Reels n'en ont pas (pas de ▶).
- **La Tendance d'exemple** : Portée, Interactions et Abonnés avec une
  **série inventée**, marquée « exemple inventé » sur chaque courbe — les
  jours de publication, eux, sont réels. Seule exception à « aucun chiffre
  fabriqué », confinée à la maquette, pour juger la forme ; le bandeau de la
  maquette rebascule sur la base réelle (vide).
- **Le jeton mort** en tête de page, pleine largeur : « Tes chiffres
  Instagram sont figés au 1 nov. 2026 », ce qui reste juste / ce qui
  manque, « Reconnecter Instagram » ; le reste de la page grisé, badge
  « figé au … ».

Vu au passage : **avec 20 derniers posts, l'Image a sa moustache** (post
type 7 252, du 9 janv. au 28 oct.) alors qu'elle n'en avait pas sur
90 jours (5 posts) — la règle de David règle aussi le « pas assez de
posts » des petites périodes.

### Pour trancher (David)

1. **Quelle version** — A, B ou C (ou un mélange) ?
2. **X** : 20 derniers posts, ou 12 / 30 ? Et un format qui n'a pas X posts
   dans tout son historique : moustache sur ce qu'il a (dès 6), comme
   aujourd'hui ?
3. **Le lecteur Instagram** dans la carte, ou seulement dans le Panneau ?

## Réaction de David, deuxième tour (2026-11-06)

- **La B** (un nuage par format, les moustaches à droite) est préférée.
- **La référence devient l'année**, plus les X derniers posts : « ça prend
  vraiment tous les posts », sans l'effet « ceux de Noël, tout est haut ;
  janvier, tout est bas ». **Remplace la décision du tour précédent** (X
  derniers posts) — et donc toujours « sur la période » du ticket 06.
- **L'évolution manque** : « est-ce que nos derniers posts sont en général un
  peu plus haut ? » → **deux ou trois moustaches côte à côte** — l'année,
  puis les derniers mois.
- **Moitié nuage, moitié moustaches** : « là c'est tout coincé à droite ».
- **De la C : la liste des posts qui défile à droite**, avec la métrique
  analysée, « plus clean que de nouveau un truc en bas », tout dans un
  module.
- Le message s'arrête sur « et puis ça serait… » : la suite est à demander.

## Prototype, troisième tour (2026-11-06)

`/instagram?maquette=page&d=90` ouvre maintenant **D · Ton année, et la
liste à droite** (A, B, C du tour 2 restent derrière ← →) :

- **Un module** : à gauche, une rangée par format — en tête, « post type de
  l'année » en phrase, puis l'écart des derniers mois écrit (« 3 derniers
  mois : post type 12 506 sur 15 posts — +9 % sur ton année ») ; dessous,
  **moitié nuage** (les posts de la période) et **moitié moustaches** :
  **12 mois** (boîte pleine, la référence), **3 derniers mois** et
  **dernier mois** (boîtes en pointillé), même axe, valeurs écrites, petits
  points des posts qui les font. À droite, **une colonne collante qui
  défile** : la sélection (5 meilleurs…) ou **tous les posts** du meilleur
  au moins bon, en cartes compactes avec la mini-moustache « parmi tes
  Reels des 12 derniers mois ».
- **La référence = 12 mois glissants**, pas l'année civile : janvier ne
  remet rien à zéro. La place de chaque post (nuage, cartes, Tableau,
  Panneau) se lit contre elle.
- L'écart d'une moustache courte à l'année = l'écart de leurs post types ;
  sous **±5 %**, « comme ton année » (deux médianes de quelques posts ne
  disent pas un sens) ; sous 6 posts, pas de moustache et la raison.

Ce que les vrais chiffres montrent déjà (portée, 2026-11-06) : Reels
**+9 %** sur 3 mois mais **−12 %** le dernier mois ; Carrousels **−10 %**
et **−25 %** ; l'Image n'a que 5 posts en 3 mois et 2 le dernier mois — ses
moustaches courtes ne se dessinent pas.

### Pour trancher (David)

1. **La suite de ton message** (« et puis ça serait… »).
2. **Les moustaches d'évolution** : 3 mois + 1 mois, ou d'autres durées ?
   Le dernier mois a souvent moins de 6 posts par format.
3. **±5 %** pour « comme ton année » : le garder, ou toujours écrire
   l'écart ?

## Réaction de David, troisième tour (2026-11-06)

- **La Tendance** : à gauche l'évolution de la page (la portée) en grand, à
  droite les deux autres courbes l'une sous l'autre.
- **On garde la D seule** ; A, B, C partent. **Peu de texte** au-dessus des
  graphes.
- **Les moustaches d'évolution ne convainquent pas encore** : « on ne voit
  pas forcément l'évolution, c'est dur de voir quel format est mieux » ;
  « comparer 6 posts avec 12 posts, dur à dire ». Il faut faire comprendre
  que **12 mois est la référence**, que **3 mois se lit avec prudence**, et
  qu'au **dernier mois il manque encore des données** — mais que l'ensemble
  donne une évolution. Une ou deux variantes demandées.
- Le nuage plaît : on y voit les meilleurs et les pires posts de la
  période.
- **Question ouverte de David** : voir aussi **les meilleurs posts de tout
  l'historique** — dans la liste, ou tout en bas dans le Tableau.

## Prototype, quatrième tour (2026-11-06)

`/instagram?maquette=page&d=90&pv=1` ; A, B, C ont quitté le code (ils
restent dans l'historique de la branche jetable).

- **Tendance** : la portée du compte en grand à gauche, interactions et
  abonnés empilés à droite (série d'exemple, toujours marquée).
- **Une seule ligne** au-dessus des graphes : la référence (« tes 12
  derniers mois, format par format — elle ne bouge pas avec la période ») et
  la définition de la métrique. L'évolution d'un format tient en deux
  pastilles à côté de son nom : « 3 mois **+9 %** · 15 posts », « 1 mois
  **−12 %** · 6 posts ».
- **L'année est dessinée derrière le nuage** : la bande de ses habitudes et
  la ligne « post type de l'année » — chaque post se lit contre elle sans
  quitter le nuage.

Trois façons de montrer l'évolution (`?pv=`) :

1. **Les moustaches, pesées** — à droite du nuage, 12 mois / 3 derniers
   mois / dernier mois ; **la largeur et l'encre d'une boîte suivent son
   nombre de posts** (42 → large et pleine ; 6 → fine et pâle), et chacune
   porte son statut écrit : « la référence », « à lire avec prudence »,
   « encore mince ». La ligne du post type de l'année traverse les trois.
2. **La pente** — **un graphe pour tous les formats**, au-dessus des
   rangées : le post type de l'année → des 3 derniers mois → du dernier
   mois. La hauteur dit quel format porte le plus, la pente s'il monte ; le
   rayon du point suit le nombre de posts, le dernier segment est en
   pointillé, un format sous 6 posts n'a pas de point (« Image : 5/6
   posts »). Le nuage prend alors toute la largeur.
3. **Mois par mois** — à droite du nuage, le post type **glissant** : à la
   fin de chacun des 12 derniers mois, la médiane des 3 mois qui précèdent,
   sur la bande de l'année ; le rayon suit le nombre de posts, un mois sous
   6 posts est un trou avec « 5/6 ».

**Les meilleurs de tout l'historique** : la liste de droite a une portée —
**La période / 12 mois / Tout** — et « 5 / Tous » ; le Tableau du bas a
**La période / Tout l'historique** (235 posts). Vérifié : « Tout » ouvre
sur un Carrousel du 3 juillet 2025 (63 606) et une Image du 9 janvier 2026
(63 438), deux hors norme.

Ce que la pente montre sur les vrais chiffres (portée) : les Reels portent
plus que les Carrousels toute l'année (11 506 contre 10 021), montent sur
3 mois (12 506) et redescendent le dernier mois (10 103, 6 posts) ; les
Carrousels baissent des deux côtés (9 040, puis 7 500).

### Pour trancher (David)

1. **Laquelle des trois** montre le mieux l'évolution — ou un mélange (la
   pente en tête, les moustaches pesées dans les rangées) ?
2. **Un vieux post dans « Tout »** est placé contre **ton année actuelle**,
   pas contre la sienne : le Carrousel de juillet 2025 est « hors norme »
   face aux Carrousels de 2026. Garder, ou le placer contre ses 12 mois à
   lui ?
3. **La suite de ton message du tour 3** (« et puis ça serait… ») et le
   seuil de ±5 %, toujours ouverts.

## Réaction de David, quatrième tour (2026-11-06) — « part avec ça »

- **La version 1 (moustaches pesées) est retenue** : « nickel ». 12 mois
  est la référence, les 3 derniers mois suivent, et une moustache sans
  assez de posts ne se dessine pas — « ça fait sens ». La bande 25-75 % de
  l'année derrière le nuage et les 5 meilleurs numérotés dedans : gardés.
- **Tendance** : **les abonnés en grand à gauche**, portée et interactions
  à droite.
- **La liste de droite ne montre que les 5 meilleurs de la période**, sans
  filtre. Les meilleurs de tout l'historique se trouvent **dans le
  Tableau**, en le triant.
- **Le Tableau porte toujours tous les posts**, sans filtre de période ;
  **une colonne Date triable** (le premier post, les derniers) ; **la date
  dans l'export Excel**.

Fait dans la maquette avant de clore : versions 2 et 3 retirées du code,
Tendance retournée, liste sans filtre, Tableau de tous les posts (235)
avec la Date triable dans les deux sens, **export réel** en `.csv` pour
Excel (point-virgule, une absence = cellule vide, date en première colonne,
236 lignes vérifiées). `tsc` et `npm run build` verts, 18 routes. Capturé
sur `prototype/instagram-page`.

## Answer

**La page `/instagram` se lit de haut en bas ainsi** (maquette retenue :
branche jetable `prototype/instagram-page`,
`saas/web/app/instagram/_prototype-page/maquette.tsx`, ouverte par
`/instagram?maquette=page`) :

1. **Bandeau** — période, et « Règles de lecture » ([ticket 11](11-les-regles-d-analyse-reglables.md)).
2. **Ta page (la Tendance)** — **les abonnés en grand à gauche** (cumul +
   barres gagnés / perdus), **portée et interactions du compte empilées à
   droite** (trait plein = période, pointillé = période d'avant, jours de
   publication cliquables, un trou pour un jour sans donnée). Remplace
   l'ordre Portée → Interactions → Abonnés de [Le compte dans le temps](10-le-compte-dans-le-temps.md),
   qui garde tout le reste.
3. **Le Sélecteur de vue** — objectif (Portée / Engagement / Abonnés) et
   ses métriques ; une métrique pas en base reste grisée avec sa raison.
4. **« Tes posts face à ton année » — un seul module** : une ligne de
   texte (la référence, la définition de la métrique), puis **une rangée
   par format** :
   - en tête, « post type de l'année » et son nombre de posts, et deux
     pastilles d'évolution — « 3 mois +9 % · 15 posts », « 1 mois −12 % ·
     6 posts » (sous ±5 %, « ≈ ») ;
   - **à gauche, le nuage** des posts de la période (date × métrique),
     posé sur **la bande 25-75 % et la ligne du post type de l'année** ;
     les 5 meilleurs y sont numérotés ;
   - **à droite, les moustaches pesées** sur le même axe : **12 mois** (la
     référence, large et pleine), **3 derniers mois** (« à lire avec
     prudence ») et **dernier mois** (« encore mince ») ; la largeur et
     l'encre d'une boîte suivent son nombre de posts ; **sous 6 posts, pas
     de moustache**, « 5 / 6 posts » à la place.
   - **À droite du module, la liste des 5 meilleurs posts de la période**,
     collante, qui défile : vignette, valeur, place, mini-moustache « parmi
     tes Reels des 12 derniers mois », légende, « Lire le post ». Aucun
     filtre. Cela tranche « Comparaison et Sélection, un module ou deux » :
     **un seul**.
5. **Tous tes posts (le Tableau)** — **tout l'historique**, sans filtre de
   période ; colonne **Date** triable dans les deux sens ; chaque métrique
   triable ; colonne Place ; **export Excel** avec la date.
6. **Le Panneau « lire un post »** (`?post=`) — **le lecteur public
   d'Instagram** pour un Reel ou une vidéo (à partir du `permalink` : Pulse
   ne garde pas la vidéo), la légende, le lien public, la valeur et la
   moustache sur la métrique choisie, **sa place sur chaque métrique**.
   Carrousel entier, commentaires, temps de visionnage : absents.

**La référence change** : la place d'un post se lit contre **ses pareils
des 12 derniers mois glissants** (plus de 48 h), plus contre ceux de la
période — « ça prend vraiment tous les posts », sans l'effet Noël puis
janvier ; changer la période déplace les points, jamais les moustaches.
**Remplace « sur la période »** de [La place d'un post](06-la-place-d-un-post.md)
(minimum 6, quartiles exclusifs, Tukey 1,5 : inchangés).

**Les états** : *compte neuf* — un seul encart qui dit ce que le premier
passage du worker lira ; *jeton mort* — un grand encart en tête (« Tes
chiffres Instagram sont figés au … », ce qui reste juste / ce qui manque,
« Reconnecter Instagram »), la page grisée dessous, badge « figé au … » ;
*compte gratuit (10 posts)* — les moustaches disparaissent faute de 6
posts, la page le dit.

**Ce que la maquette a montré pour la suite** :
- le haut de page n'a **aucune donnée** aujourd'hui (portée et interactions
  du compte jamais récoltées ; abonnés figés au 2026-09-04) — la maquette
  dessine une **série inventée, marquée « exemple »** : rien de cela n'ira
  en production ;
- _Corrigé par [Ce que la récolte et le traitement doivent calculer](14-ce-que-le-traitement-doit-calculer.md)
  (sonde du 2026-11-06) : `follows` **est** en base, mais à 0 sur les 124
  vidéos (faux zéros) ; seul `shares` manque._
- **l'objectif Abonnés n'a aucun chiffre par post** (`follows`, `shares`
  absents de la table) ; les **Reels n'ont aucun j'aime** en base ;
- `permalink` est en base mais `getInstaDash` ne le lit pas ; quelques
  posts n'en ont pas (pas de lecteur).

**Reste ouvert, porté ailleurs** :
- **un post plus vieux que 12 mois** (Tableau) est placé contre l'année
  **actuelle** — garder ou le placer contre la sienne → nouveau ticket
  [La place d'un post hors de l'année](20-la-place-d-un-post-hors-de-l-annee.md),
  avec le seuil de ±5 % des pastilles ;
- le carré : [Le carré de sélection, en maquette](12-le-carre-en-maquette.md)
  est **répondu par cette page** (un module ; les 5 meilleurs de la
  période, sans choix de mode) — à clore par la session qui le tient.
