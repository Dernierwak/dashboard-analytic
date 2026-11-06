# Carte — La page Instagram organique

Label : `wayfinder:map`

## Destination

Une **spec de la page `/instagram`**, prête à remettre à la construction, sur
le modèle de la spec Meta Ads (`git show 1b05a92^:.scratch/meta-ads/spec.md`) :
ce qu'elle montre, dans quel ordre, sous quelle forme, ce que la récolte doit
aller chercher en plus et ce que le traitement doit calculer.

## Notes

- **Ce que David veut, dans ses mots (2026-11-01)**, de haut en bas :
  1. **la page** du compte ;
  2. **les moyennes dans le style de l'hebdo** — « voir que notre nouveau post
     est plus performant » ;
  3. **le carré** : « les 5 du haut que nous allons travailler », ou « les 5
     derniers », qu'on sélectionne, qu'on voit et dont on discute — en voyant
     que « 2 sont dans la moyenne, 2 sur les 50-75 %, 1 valeur aberrante » ;
  4. **l'aperçu du post**, comme celui d'une annonce Meta ;
  5. **format → abonnés** : « si je veux plus de followers, sur quel format me
     concentrer » ;
  6. **tous les posts** en dessous.
- **Le concept du chantier : le payant se lit dans le temps, l'organique se
  lit dans la foule.** Une campagne est une série continue : on suit peu
  d'éléments jour après jour (Tendance, Comparaison de courbes). Un post est un
  événement, il y en a beaucoup, et ils sont « plus aléatoires » (David) : on le
  lit face à la **distribution des posts du compte** — la moustache du rail des
  canaux de l'hebdo, appliquée post par post : **la place d'un post**
  (validé, voir le vocabulaire).
- **Tranché au cadrage (2026-11-01)** :
  - le livrable est la spec ;
  - le squelette de Meta (Bandeau de commandes, Tendance, Comparaison, Tableau
    détaillé, Panneau latéral — ADR 0011) est la référence ; un module ne reste
    que s'il a un sens en organique, chaque écart se justifie dans un ticket ;
  - **le groupe est le format** (Reel, Carrousel, Image — un fait rendu par
    Meta), jamais un thème ;
  - **récolter plus est dans le périmètre** dès que l'utilité est vue — chaque
    nouvelle métrique passe par une recherche puis un essai réel ;
  - un post neuf se compare **à âge égal** ; un post trop **jeune** est marqué
    et attend un seuil de maturité tiré de ce qu'Instagram documente, réglable
    par filtre ;
  - une **valeur aberrante est signalée par la mesure, jamais écartée seule** ;
    on peut l'écarter par un filtre, pour les moyennes comme pour « les 5
    meilleurs » (précisé par [Écarter un post](issues/08-ecarter-un-post.md) :
    deux filtres, pas de note à écrire) ;
  - les règles d'analyse se règlent en **mode « plus pro »** pour qui veut
    aller plus loin.
- **Faits relevés au cadrage** (code de `main`, `df48d2b`) :
  - la récolte **écrase** les chiffres d'un post à chaque passage (upsert
    `(user_id, post_id)`, `saas/data/supabase/source_data/meta.py`) : aucun
    historique, l'âge égal n'existe pas encore ;
  - un passage relit les nouveaux posts + jusqu'à 40 rafraîchis, parmi les 200
    derniers (payant) ou les **10** derniers (gratuit) —
    `saas/data/fetch_data/sources/meta/instagram/sync.py:_a_relire` ;
  - `follows` par post est **déjà demandé**, mais écrit `0` quand Meta ne le
    rend pas (`sync.py`, `m.get("follows", 0)`) — contraire à §7 ;
  - la page actuelle : `saas/web/app/instagram/page.tsx` (484 lignes d'un
    tenant), calcul dans `lib/channels.ts`, partagé avec Google ;
  - **« Tes formats » a déjà existé** et est parti le 2026-09-12 : il
    recalculait en TypeScript une réponse que deux autres moteurs posaient
    autrement. Le rouvrir exige de décider **où il se calcule, une seule fois**.
- **Pulse ne conseille rien** (`CLAUDE.md` §1) : « l'image rapporte plus
  d'abonnés » se mesure et s'affiche ; « concentre-toi sur les images » ne
  s'écrit jamais.
- **§7 partout** : aucun chiffre fabriqué, une absence n'est pas un zéro, le
  jour en cours est exclu. Des portées de posts ne s'additionnent pas
  (`.scratch/hebdo/issues/12-la-portee-organique-du-compte.md`).
- **Grilling : trois questions au plus par série** (David, 2026-10-31).
- Skills : `grilling` + `domain-modeling` pour les grillings, `prototype` pour
  les maquettes, `research` pour les recherches ; agents `vision-ux` (ordre et
  forme) et `vision-produit` (ce qui mérite d'exister).
- Pas de `CONTEXT.md` dans l'arbre : le vocabulaire tranché vit dans ces Notes,
  puis dans la spec.
  - **Objectif** (organique) : ce que le client veut lire — Portée, Engagement
    ou Abonnés —, choisi au Sélecteur de vue ; la métrique de toute la foule
    des posts. _À éviter_ : « vue » pour l'objectif lui-même (le Sélecteur de
    vue le porte).
  - **Sélection** : le carré, 3 à 5 posts côte à côte. _À éviter_ : « Top »,
    « SWOT ».
  - **Relevé** : la lecture datée du cumul d'un post ; il s'ajoute, il
    n'écrase jamais. _À éviter_ : « snapshot », « historique » pour un relevé.
  - **Âge d'un post** : heures écoulées entre la publication et le relevé ;
    « J+n » = au moins n × 24 h.
  - **Place d'un post** : sa bande parmi les posts de son format des 12
    derniers mois glissants, sur la métrique choisie — « en dessous », « bas de tes habitudes », « haut de
    tes habitudes », « au-dessus » ; un post de plus de 12 mois n'en a
    pas (« plus d'un an »). _À éviter_ : « rang », « score ».
  - **Post type** : la médiane de la foule. _À éviter_ : « moyenne ».
  - **Hors norme** : un post au-delà de 1,5 × l'écart interquartile, d'un
    côté ou de l'autre. _À éviter_ : « aberrant » à l'écran (sonne comme
    une erreur), « viral ».
  - **Écarté** : un post qu'un filtre de lecture (« sans les boostés »,
    « sans les hors norme ») sort de la foule et de la Sélection ; il reste
    visible, grisé, avec sa raison. _À éviter_ : « supprimé », « exclu »
    (sonnent définitifs), « masqué ».
  - **Rattrapage** : le premier chargement de tout l'historique d'un
    compte, du post le plus récent au plus ancien, par blocs. _À éviter_ :
    « backfill » à l'écran, « import ».
  - **Format** : Reel, Carrousel, Image ou Vidéo du fil — un fait rendu par
    Meta. _À éviter_ : « type » à l'écran, « thème ».
  - **Réactions fortes** : enregistrements et partages rapportés à la
    portée, face au « j'aime », réaction légère. _À éviter_ : « bon
    engagement ».
  - **Boosté** : un post dont Instagram a listé au moins une annonce hors
    erreur à un relevé ; il le reste après la fin du boost. Sans étiquette = aucun
    boost vu, jamais « pas boosté ». _À éviter_ : « sponsorisé »,
    « payant » pour le post.
  - **Règles de lecture** : les deux filtres « sans les boostés » et « sans
    les hors norme », rangés sous ce nom dans le Bandeau ; ils ne touchent
    que la foule des posts. _À éviter_ : « mode avancé », « mode pro »,
    « paramètres ».
- **Idée gardée, pas encore à faire** : relever les posts jeunes **heure par
  heure** pour voir comment ils démarrent (David, 2026-11-03) — notée au
  `BACKLOG.md`.

## Tickets

Format : un fichier par ticket sous `issues/`, en-tête `Type / Status /
Blocked by / Assignee`. Le frontier = `Status: open`, rien d'ouvert dans
`Blocked by`, pas d'`Assignee`.

| Ticket | Type | Bloqué par |
|---|---|---|
| [La structure de la page](issues/01-la-structure-de-la-page.md) | grilling ✓ | — |
| [Ce que l'API Instagram donne d'un post](issues/02-ce-que-l-api-donne-d-un-post.md) | research ✓ | — |
| [Quand les chiffres d'un post se figent](issues/03-quand-les-chiffres-d-un-post-se-figent.md) | research ✓ | — |
| [Ce que l'API Instagram donne du compte, jour par jour](issues/04-ce-que-l-api-donne-du-compte.md) | research ✓ | — |
| [Garder l'historique des chiffres d'un post](issues/05-garder-l-historique-d-un-post.md) | grilling ✓ | — |
| [La place d'un post](issues/06-la-place-d-un-post.md) | grilling ✓ | — |
| [L'âge d'un post](issues/07-l-age-d-un-post.md) | grilling ✓ | — |
| [Écarter un post de la lecture](issues/08-ecarter-un-post.md) | grilling ✓ | — |
| [Les formats et les abonnés](issues/09-les-formats-et-les-abonnes.md) | grilling ✓ | — |
| [Le compte dans le temps](issues/10-le-compte-dans-le-temps.md) | grilling ✓ | — |
| [Les règles d'analyse réglables](issues/11-les-regles-d-analyse-reglables.md) | grilling ✓ | — |
| [Le carré de sélection, en maquette](issues/12-le-carre-en-maquette.md) | prototype | Écarter un post |
| [La page entière, en maquette](issues/13-la-page-entiere-en-maquette.md) | prototype ✓ | — |
| [Ce que la récolte et le traitement doivent calculer](issues/14-ce-que-le-traitement-doit-calculer.md) | task ✓ | — |
| [La spec de la page Instagram](issues/15-la-spec-de-la-page-instagram.md) | task ✓ | — |
| [L'état des abonnés en base](issues/16-l-etat-des-abonnes-en-base.md) | task (HITL) ✓ | — |
| [L'essai réel des métriques Instagram](issues/17-l-essai-reel-des-metriques.md) | task (HITL) ✓ | — |
| [Le compte gratuit à 10 posts](issues/18-le-compte-gratuit-a-10-posts.md) | grilling ✓ | — |
| [Les posts boostés](issues/19-les-posts-boostes.md) | grilling ✓ | — |
| [La place d'un post hors de l'année](issues/20-la-place-d-un-post-hors-de-l-annee.md) | grilling ✓ | — |
| [La profondeur de l'historique des posts](issues/21-la-profondeur-de-l-historique.md) | grilling ✓ | — |
| [Ce que l'essai réel laisse à décider](issues/22-ce-que-l-essai-laisse-a-decider.md) | grilling ✓ | — |

## Decisions so far

<!-- une ligne par ticket clos : [titre](lien) : l'essentiel de la réponse -->

- [Quand les chiffres d'un post se figent](issues/03-quand-les-chiffres-d-un-post-se-figent.md) :
  l'API ne rend qu'un cumul `lifetime`, aucune série par jour ; aucun délai de
  maturité documenté, seule la latence de 48 h — l'âge égal et tout seuil
  au-delà de 48 h passent par nos propres relevés. Le Reel n'a pas de `follows`.
- [Ce que l'API Instagram donne d'un post](issues/02-ce-que-l-api-donne-d-un-post.md) :
  format = `media_product_type` (FEED / REELS / STORY) ; `follows` et
  `profile_visits` sur FEED et STORY, jamais REELS ; chiffres organiques hors
  boost ; absence = jeu vide ; deux défauts de récolte relevés (vidéo du fil
  sans `likes`, absence écrite 0).
- [Ce que l'API Instagram donne du compte, jour par jour](issues/04-ce-que-l-api-donne-du-compte.md) :
  seule `reach` se lit en série par jour ; `views`, interactions et
  `follows_and_unfollows` s'additionnent, `reach` non ; 90 jours
  d'historique ; gagnés/perdus et `follower_count` incertains ;
  `followers_history` n'a plus d'écrivain depuis septembre — d'où deux tâches
  nouvelles, l'état des abonnés en base et l'essai réel.
- [La structure de la page](issues/01-la-structure-de-la-page.md) : le fil
  conducteur est l'**objectif** (Portée, Engagement, Abonnés) — Bandeau →
  Tendance (le compte) → Sélecteur de vue → Comparaison (une moustache par
  format, qui absorbe « Formats ») → Sélection (le carré) → Tableau détaillé,
  plus le Panneau latéral ; Sélecteur sous la Tendance, écart à l'ADR 0011.
- [Garder l'historique des chiffres d'un post](issues/05-garder-l-historique-d-un-post.md) :
  oui, des relevés datés qui s'ajoutent — chaque jour pour tous les posts de
  J+0 à J+7 (passage léger, 2 appels par post), puis à chaque Jour de travail
  jusqu'à J+30 ; âge réel en heures ; aucun passé reconstitué ; la page montre
  le dernier relevé daté et explique l'écart avec l'hebdo.
- [La place d'un post](issues/06-la-place-d-un-post.md) : la bande d'un
  post parmi ceux **de son format** sur la période, lui compris, **sur la
  métrique choisie** — quartiles exclusifs de l'hebdo, médiane « post type »,
  « hors norme » à 1,5 × IQR (règle nouvelle), minimum 6 posts avec une
  mention en dessous ; une moustache par format qui change avec la
  métrique, choisie dans l'objectif ; un nuage date × métrique à juger en
  maquette.
- [L'âge d'un post](issues/07-l-age-d-un-post.md) : trois tranches fixes,
  tous formats — moins de 48 h (latence Meta) hors de la foule ; 48 h →
  7 jours placé à âge égal (même J+n, minimum 6) ; au-delà, la foule normale ;
  les posts antérieurs au relevé comptent comme plus de 7 jours. À l'écran,
  l'âge écrit avec une icône « peut encore changer », aucun nom d'état ;
  aucun réglage.
- [Écarter un post de la lecture](issues/08-ecarter-un-post.md) : deux
  filtres dans l'URL, jamais mémorisés — « sans les boostés » (toutes
  métriques) et « sans les hors norme » (métrique affichée, Tukey en une
  passe, désactivé par défaut) ; l'écarté sort de la moustache et de la
  Sélection, reste grisé avec sa raison au Tableau ; la page dit combien et
  pourquoi ; écarter à la main est au `BACKLOG.md`.
- [Les formats et les abonnés](issues/09-les-formats-et-les-abonnes.md) :
  la Comparaison en vue Abonnés, sur quatre formats (Reel, Carrousel, Image,
  Vidéo du fil) en ordre fixe, sans phrase de classement ; un bloc par
  format au-dessus des moustaches (post type, total seulement pour ce qui se
  compte, `n`) ; abonnés pour 1 000 comptes touchés et réactions fortes en
  plus ; le propre d'un format (visionnage du Reel) se lit au niveau du
  post ; un seul calcul de la foule, à la lecture, dans un dossier commun de
  `lib/` ; 0 si Instagram le rend, « – » sinon, l'existant nettoyé.
- [Le compte dans le temps](issues/10-le-compte-dans-le-temps.md) : le haut
  de la page montre **la page seule** — Portée, Interactions et Abonnés du
  compte (cumul + barres gagnés/perdus, ou net), période d'avant en
  pointillé, publications marquées, un trou pour un jour sans donnée ; un
  interrupteur Tout / Organique / Boosté conditionné à l'essai réel (la
  portée organique du compte ne se mesure pas) ; 90 jours lus au premier
  passage ; « Engagement du compte » et « Croissance 30 j » partent ; pas de
  table sous la Tendance, l'export Excel va au Tableau des posts.
- [Les règles d'analyse réglables](issues/11-les-regles-d-analyse-reglables.md) :
  pas de mode avancé, aucune règle de calcul réglable (Tukey 1,5 fixe) ; le
  « plus pro » = les **Règles de lecture**, les deux filtres discrets du
  Bandeau, sur la foule des posts seulement ; un filtre actif se voit au
  compteur du bouton et à une ligne au-dessus des moustaches, rien sinon ;
  portée ÷ abonnés devient une métrique de l'objectif Portée.
- [La page entière, en maquette](issues/13-la-page-entiere-en-maquette.md) :
  Bandeau → Tendance (**abonnés en grand à gauche**, portée et interactions
  à droite) → Sélecteur de vue → **un module « tes posts face à ton
  année »** — par format, le nuage de la période sur la bande 25-75 % de
  l'année, et ses moustaches pesées (12 mois la référence, 3 mois, dernier
  mois ; rien sous 6 posts) — avec **les 5 meilleurs de la période** en
  liste à droite → Tableau de **tous les posts** (Date triable, export
  Excel) ; Panneau avec le lecteur Instagram ; **la référence devient les
  12 derniers mois glissants**, plus la période.
- [Ce que la récolte et le traitement doivent calculer](issues/14-ce-que-le-traitement-doit-calculer.md) :
  la récolte se corrige (format par `media_product_type`, absence jamais
  écrite 0, `shares` en plus) ; trois ajouts en base — relevés des posts,
  un relevé du compte par jour, colonnes `shares` / `releve_a` — et une
  relecture unique de **tous** les posts en base par un drapeau dédié ; la
  foule, la place, l'âge égal et les filtres se calculent **une fois, à la
  lecture, dans `lib/instagram/`**, rien en Python. La sonde corrige le
  ticket 13 : `follows` est en base, mais à 0 sur les 124 vidéos.
- [La profondeur de l'historique des posts](issues/21-la-profondeur-de-l-historique.md) :
  **tout l'historique** en payant, chargé du plus récent au plus ancien par
  blocs sur le passage quotidien (la page se remplit à mesure) ; les posts de
  moins de 30 jours relus à chaque Jour de travail, **tous** les posts relus
  tous les 3 mois ; chaque chiffre porte sa date ; la référence écrit la
  période qu'elle couvre tant que l'année n'est pas chargée ; le gratuit reste
  à 10 posts.
- [La place d'un post hors de l'année](issues/20-la-place-d-un-post-hors-de-l-annee.md) :
  un post de plus de 12 mois reste au Tableau mais sort de tous les calculs
  (« plus d'un an ») ; la place se lit face aux 12 mois seulement ; les
  pastilles 3 mois et 1 mois se comparent au post type de l'année, l'écart
  toujours écrit avec son nombre de posts — le seuil de ±5 % part.
- [Le compte gratuit à 10 posts](issues/18-le-compte-gratuit-a-10-posts.md) :
  le gratuit, c'est le payant **sans le rattrapage** — 10 posts à l'arrivée,
  puis chaque nouveau post s'ajoute et rien ne s'efface ; relu comme le
  payant ; même page, mêmes règles, le minimum de 6 fait le tri ; la ligne
  de référence dit depuis quand ; aucun appel à l'achat sur la page (« où
  pousser le payant » va au `BACKLOG.md`).
- [Les posts boostés](issues/19-les-posts-boostes.md) : Pulse le sait par
  `boost_ads_list` d'Instagram, au relevé ; boosté une fois, boosté pour
  toujours (date du premier boost vu) ; aucune relecture de plus — un boost
  raté puis vu est marqué dès qu'il est vu ; un anneau autour du point au
  nuage, l'étiquette « Boosté » ailleurs, aucun budget ; l'absence veut dire
  « aucun boost vu », et deux cas restent à l'essai réel.
- [L'essai réel des métriques Instagram](issues/17-l-essai-reel-des-metriques.md) :
  nos scopes suffisent ; `follower_count` = gagnés par jour (30 jours au
  plus), gagnés / perdus = `FOLLOWER` / `NON_FOLLOWER` ; `follows` sur un
  Reel = erreur (→ null), 0 réel sur le fil ; `lifetime` = cumul ; portée
  dédoublonnée sur la période ; `AD` rendu — Organique mesurable pour les
  interactions, pas pour la portée ; `boost_ads_list` obtenu et garde les
  annonces terminées ; aucune vidéo du fil dans les 200 derniers posts.
- [Ce que l'essai réel laisse à décider](issues/22-ce-que-l-essai-laisse-a-decider.md) :
  boosté = au moins une annonce hors `error` ; la courbe des abonnés remonte
  30 jours au premier passage (total du jour − gagnés + perdus), un jour
  manquant l'arrête là.
- [L'état des abonnés en base](issues/16-l-etat-des-abonnes-en-base.md) :
  `followers_history` figée au 2026-09-04 (bug de production, au
  `BACKLOG.md`) ; son historique mesuré se garde, la courbe a un trou entre
  lui et la remontée de 30 jours.
- [La spec de la page Instagram](issues/15-la-spec-de-la-page-instagram.md) :
  **la destination est atteinte** — [`spec.md`](spec.md), ready-for-agent,
  avec onze arbitrages de David (taux à quatre termes, portée de la période,
  valeurs à l'ouverture, visionnage du Reel, format sans post, pastille en
  valeur, bornes de l'hebdo, stories hors chantier, « Ce qu'on ne mesure
  pas », les mots partagés avec l'hebdo, la Sélection amendable par le
  carré).

## Not yet specified

## Out of scope

- **Les labels / thèmes** : retirés le 2026-09-30 ; s'ils reviennent, ce sera
  une issue séparée (David, 2026-11-01).
- **Le dashboard Google Ads** et toute refonte de Meta.
- **Les stories** : non récoltées, lisibles 24 h, le webhook `story_insights`
  pour les garder — un chantier à part (David, 2026-11-06, arbitrages de
  [La spec de la page Instagram](issues/15-la-spec-de-la-page-instagram.md)) ;
  au `BACKLOG.md`.
