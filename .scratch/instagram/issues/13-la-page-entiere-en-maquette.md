# 13: La page entière, en maquette

Type: prototype
Status: open
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
