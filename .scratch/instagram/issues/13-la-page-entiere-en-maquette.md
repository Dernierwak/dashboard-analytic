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
