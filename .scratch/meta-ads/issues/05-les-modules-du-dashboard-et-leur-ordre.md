# Les 3-4 modules du dashboard, et leur ordre

Type: prototype
Status: resolved
Blocked by: —

## Question

C'est le ticket central, et le vrai sujet de la demande de David : **quels sont
les 3-4 modules du dashboard Meta Ads, dans quel ordre, et que montre chacun ?**

Ce n'est pas une question de décoration. David : « des modules, des blocs de
composantes, qui sont réutilisables ou qui devraient avoir la même structure sur
d'autres ». La réponse est donc un **inventaire ordonné** que Google Ads reprendra
tel quel, avec ses propres chiffres.

**Le point de départ, pas le résultat.** Le brief propose : vue d'ensemble
(courbes par campagne) → comparaison (une métrique, plusieurs ad sets ou
annonces, avec l'aperçu des créas) → tableau hiérarchique (Campagne > Ad set >
Annonce > Asset). Trois modules. À challenger, pas à recopier — le brief est
« une idée de base ».

**Les contraintes qui pèsent sur la réponse**
- **Trois modules de bascule, pas de filtre.** Notoriété / Trafic / Conversion
  reconfigurent ce qu'on voit ; **toutes les campagnes sont présentes dans
  chacun**. Une campagne sans conversion affiche « — », jamais « 0 ».
- **La grammaire de module existe déjà** : neuf rangs, le rang 3 est LE chiffre,
  aucune forme graphique avant lui. Référence unique :
  `saas/web/components/jour-recolte.tsx`, dont la tête de fichier commente l'écran
  rang par rang (`CLAUDE.md` § conventions). Chaque module du prototype se pose
  dans cette grammaire.
- **Les données bougent une fois par semaine.** Le Jour de travail est le seul
  moment où Pulse récolte. Un dashboard qui donne l'impression du temps réel
  mentirait sur sa fraîcheur.
- **Le client ne déclenche rien** : ce prototype se juge à l'écran, avec des
  données figées, pas en attendant un passage du worker.

**Ce que le prototype doit rendre**
Une maquette jetable — code UI rugueux, données en dur — qui montre les modules
dans leur ordre, à la largeur d'un écran réel, pour que David réagisse dessus.
Puis, écrit noir sur blanc : la liste ordonnée des modules, ce que chacun répond
comme question, et **pour chacun, ce qui change et ce qui ne change pas quand on
passe de Meta à Google Ads.**

**Ce qui n'appartient pas à ce ticket** : les changements posés sur les courbes
(ticket 08), la consultation des textes d'assets (ticket 06), la barre de filtres
sticky (encore dans le brouillard, elle suivra).

## Ce que le ticket 03 a établi, et qui contraint ce ticket

Résolu le 2026-09-28 (rapport :
[`../recherche/metriques-par-asset.md`](../recherche/metriques-par-asset.md)).

- **Le tableau hiérarchique s'arrête à l'annonce.** Campagne > Ad set > Annonce, et
  c'est tout. Le quatrième rang « Asset » du brief est hors périmètre : Meta ne
  documente aucune ventilation par asset pour une annonce à créa unique, donc la
  ligne serait vide pour le cas le plus courant.
- **Une contrainte qui pèse sur la période.** Depuis le 10 juin 2025, `reach` n'est
  plus rendu avec un breakdown au-delà de 13 mois, sauf job asynchrone plafonné à
  10/jour/compte. `/meta` propose aujourd'hui une période « Tout » : si un module de
  Notoriété affiche la portée sur tout l'historique, il faut savoir que la donnée a
  une frontière à 13 mois. Un module qui affiche une portée manquante comme un creux
  mentirait (`CLAUDE.md` §7).

## Ce que le ticket 04 impose à ces modules

Résolu le 2026-09-28 (rapport :
[`../recherche/champs-api-meta.md`](../recherche/champs-api-meta.md)).

- **Il n'existe aucun « taux de conversion » chez Meta.** On le calcule, donc son
  dénominateur est un choix produit (`clicks` ou `inline_link_clicks`) qui doit être
  **écrit à l'écran**. Un « 3,2 % » sans dire de quoi n'est pas une métrique, c'est
  une affirmation.
- **Ne jamais sommer les types d'action** : `link_click` ⊂ `post_engagement` ⊂
  `page_engagement`. Un module qui affiche « total des actions » compte le même clic
  plusieurs fois.
- **Les 28 derniers jours de conversions sont provisoires par construction** (Meta
  révise jusqu'à 28 jours). Le module Conversion doit le dire, ou ne pas afficher
  ces jours comme définitifs — voir le ticket 09, qui tranche la règle.

## Comments

### 2026-09-30 — le prototype existe, David doit réagir

**Où** : `saas/web/app/meta/prototype-modules/` (déplacé depuis `login/controle-modules/`) (deux fichiers, données
inventées, en dur). Rangé sous `/login/controle-*` parce que c'est le seul chemin
servi sans session : **l'ouvrir dans une fenêtre privée** (connecté, le
middleware renvoie vers `/`). `npm run dev`, puis
`http://localhost:3000/login/controle-modules?variant=A&prisme=notoriete`.
Flèches ← → ou la barre noire du bas pour changer de variante, les trois
boutons en haut pour changer de prisme. **À supprimer avant tout commit**
(`CLAUDE.md` §7), avec `git grep controle-modules` vide.

**Les trois variantes** (même semaine, mêmes données, trois ordres) :
- **A — Le brief, ordonné** (4 modules) : le chiffre de la semaine → courbes
  jour par jour, une par campagne → les annonces côte à côte sur une métrique,
  avec leur vignette et leur coût → le tableau Campagne › Ad set › Annonce.
- **B — Ce qui a bougé, d'abord** (4 modules) : un verdict en phrase → les 3
  annonces en hausse et les 3 en baisse → huit barres, une par semaine → le
  tableau, replié.
- **C — Une ligne par campagne** (2 modules) : le chiffre → une liste où chaque
  campagne a sa petite courbe sur huit semaines, et se déplie jusqu'à l'annonce.
  Courbes, comparaison et tableau fusionnent.

**Fixé dans les trois, et qui n'est PAS en discussion** : le prisme ne filtre
pas, toutes les campagnes sont là ; « — » pour ce que Meta ne rend pas
(la campagne de notoriété en Conversion) ; le taux de conversion écrit son
dénominateur (« achats ÷ clics sur le lien ») ; la semaine mesurée marquée
provisoire en Conversion, jusqu'au 25 oct. ; le détail s'arrête à l'annonce.

**Les questions à trancher par David en regardant**
1. Quelle variante, ou quel mélange (« le verdict de B avec la liste de C ») ?
2. Jour par jour (A) ou semaine par semaine (B, C) ? Pulse ne récolte qu'une fois
   par semaine : une courbe quotidienne est vraie, mais elle suggère un suivi au
   jour que le produit ne fait pas.
3. Le chiffre principal de chaque prisme : **impressions** (Notoriété), **clics
   sur le lien** (Trafic), **achats** (Conversion). Pour Notoriété, la portée
   serait plus parlante, mais elle ne s'additionne pas (voir « La portée
   s'additionne jour par jour, et compte deux fois la même personne »).
4. Sous 20 unités, le prototype écrit l'écart brut (« +2 ») et pas un
   pourcentage (« +200 % » pour 1 → 3 achats). À garder comme règle ?
5. Quel type d'action compte comme « conversion » : un seul (achats), ou
   un choix du client ? Le prototype suppose « achats ».

**Vu en chemin, devenu tickets** : « La portée s'additionne jour par jour, et
compte deux fois la même personne » et « `/meta` demande 12 000 lignes et n'en
reçoit que 1 000 ».

**Pas vérifié** : l'extension Chrome n'était pas connectée, donc pas de capture
d'écran. Le rendu est vérifié par le HTML du serveur (les 9 combinaisons variante
× prisme rendent leur texte, les chiffres se tiennent entre modules) et
`tsc` est vert sur ces fichiers. Le reste de `saas/web` ne compile pas en ce
moment : c'est la purge du thème en cours (« Le thème et le label quittent l'écran
et le code »), pas ce prototype.

### 2026-09-30 — deuxième passage, après le retour de David

**Le retour** : les trois variantes sont rejetées en bloc — pas jolies, métriques
trop petites, on ne sait pas où sont les annonces, aucun clic sur les
modifications, ordres incompréhensibles. Seule la courbe en tête, avec les
informations dessous, est gardée.

**Ce qui a raté, pour ne pas le refaire** : j'ai suivi la règle « pas de
finition » du prototype contre la note de cette carte (« rendre quelque chose de
fini ») ; ni `dataviz` ni `frontend-design` chargés avant de dessiner ; les
changements cliquables écartés alors que le brief en fait la fonctionnalité clé.

**Le prototype est désormais UNE version**, sous `/meta/prototype-modules`
(connecté, dans l'app, avec la colonne latérale). L'ordre :
1. **La barre collante** : prisme Notoriété / Trafic / Conversion + campagne.
2. **Les quatre chiffres de la semaine**, en gros (40 px), qui sont des onglets :
   cliquer sur l'un le trace dessous.
3. **La courbe par campagne**, jour par jour, 8 semaines, la semaine mesurée
   surlignée, le nom au bout de chaque courbe, infobulle au survol. **Un rail de
   repères sous l'axe, un par jour de changement**, qui ouvre un panneau latéral
   avec ce qui a changé ce jour-là (filtré par la campagne choisie).
4. **Les annonces**, présentées comme des créas (visuel, format, accroche), classées par
   la métrique choisie ; un clic ouvre le même panneau avec le texte, le titre,
   le bouton et les chiffres de l'annonce.
5. **Le tableau** Campagne › Ad set › Annonce, dépliable.

Couleurs des courbes validées par `validate_palette.js` (CVD ΔE ≥ 9,1).

**Vérifié dans Chrome** : les trois prismes, le filtre campagne, le panneau
des changements, celui d'une annonce. `tsc` vert sur ces fichiers.

### 2026-09-30 — troisième passage : le brief, bloc par bloc

**Le retour de David sur le deuxième** : plus joli, mais ce n'est pas ce qui
était demandé. Il manquait les blocs du brief (vue d'ensemble, comparaison,
tableau hiérarchique, historique) ; la vue d'ensemble doit montrer **tout**, et
se resserrer ensuite par le filtre campagne ; les métriques ne doivent pas être
séparées en onglets.

**La cause** : le brief n'était nulle part dans le dépôt. Les deux premiers
passages sont partis des résumés des tickets. Il est désormais dans
[`../brief.md`](../brief.md), et la carte y renvoie.

**Le prototype suit maintenant le brief, dans son ordre** (`/meta/prototype-modules`) :
- **Barre de filtres collante** : catégorie, campagne, période ; elle se
  resserre et prend une ombre au défilement.
- **Bloc 1 — Vue d'ensemble** : une courbe par métrique de la catégorie
  (Notoriété : impressions, CPM, portée, fréquence ; Trafic : clics, CTR, CPC ;
  Conversion : conversions, coût par conversion, taux), une ligne par campagne
  dans chacune, toutes affichées d'un coup. Pas deux échelles sur un même graphe :
  c'est pour ça qu'il y a un graphe par métrique plutôt qu'un seul.
- **Historique des changements** : un point discret sur la courbe de la campagne
  concernée, au jour du changement ; un clic ouvre la liste du jour à droite,
  limitée à la campagne filtrée.
- **Bloc 2 — Comparaison** : Ad sets ou Annonces, une métrique, jusqu'à 4
  éléments, une courbe par élément ; « + un second graphe côte à côte » ouvre
  une deuxième métrique sur les mêmes éléments ; les créas comparées dessous.
- **Bloc 3 — Tableau hiérarchique** : Campagne › Ad set › Annonce › Asset ; au
  niveau asset, le contenu (visuels, texte principal, titre, description), sans
  chiffres — et la ligne dit pourquoi.

**Mes interprétations, que David doit confirmer ou corriger**
1. « Un ou deux line plots côte à côte » : j'ai compris le second graphe comme
   les mêmes éléments sur une **deuxième métrique**. Autre lecture possible : ad
   sets à gauche, annonces à droite.
2. La période propose 7 jours, 4 semaines, 8 semaines, comparées à la période
   précédente de même durée.
3. Le bloc 2 ne compare pas au niveau asset : pas de métrique par asset
   (ticket 03).

**Vérifié dans Chrome** : les trois catégories, le filtre campagne, la barre qui
se resserre, le point de changement → le panneau, le tableau déplié jusqu'à
l'asset. `tsc` vert sur ces fichiers.

### 2026-09-30 — quatrième passage

**Le retour de David sur le troisième**
- Vue d'ensemble : les métriques du **total**, pas une ligne par campagne ni par
  ad set. Le filtre campagne sert à resserrer.
- Comparaison : il veut **trois variantes** pour juger. Le « + 2ᵉ métrique » est
  une bonne base.
- Catégories : trois boutons dont on ne comprend pas qu'ils se cliquent, ni
  qu'ils changent toute la vue.
- Filtres : pas intuitifs, pas modernes, sans effet ; le choix des dates est
  jugé nul.

**Ce qui a été fait** (`/meta/prototype-modules`)
- **Catégories** : trois cartes (icône, question, chiffre principal, écart),
  l'active en noir avec « Vue active ». Au défilement, elles se replient en un
  sélecteur compact dans la barre, avec un curseur qui glisse.
- **Barre** : elle se détache en pilule flottante (flou, ombre) dès que les
  cartes sortent de l'écran. **Menu campagne** : recherche, pastille de couleur,
  dépense sur 4 semaines, coche. **Menu dates** : raccourcis à gauche,
  calendrier sur deux mois à droite, période sur mesure en deux clics.
- **Vue d'ensemble** : le total filtré, un graphe par métrique ; la métrique
  principale en grand, les autres à côté ; courbe lissée (monotone, sans pic
  inventé), aire en dégradé, **période d'avant en pointillé** ; les changements
  sont des pastilles ✎ sur la courbe principale.
- **Comparaison, `?comparaison=A|B|C`** : A courbes superposées (+ 2ᵉ
  métrique, créas dessous) ; B une carte par élément, même échelle pour toutes ;
  C classement avec barres à gauche, coché → courbe à droite.
- Chiffres qui défilent jusqu'à leur nouvelle valeur au changement de vue ;
  courbes qui se tracent. Rien pour qui a réduit les animations.

**Vérifié dans Chrome** : les trois vues, la barre détachée, les deux menus,
les trois variantes de comparaison. `tsc` vert sur ces fichiers.

### 2026-09-30 — cinquième passage : la comparaison part de C

**Le retour de David** : « on a déjà une bien meilleure base ». Pour la
comparaison, il garde **C** (la liste classée où l'on coche, et la courbe
apparaît), avec **deux métriques distinctes** qui s'imposent, en deux variantes
de mise en page.

**Ce qui a été fait** : A et B sont retirés. Deux variantes, `?comparaison=C1|C2` :
- **C1, graphes à droite** : la liste à gauche, les deux graphes empilés à droite.
- **C2, graphes en dessous** : la liste en haut sur deux colonnes (1 à 4 à
  gauche, 5 à 8 à droite, lues de haut en bas), les deux graphes côte à côte
  dessous.
Dans les deux : deux rangées de puces, « 1 » et « 2 ». La métrique 1 classe la
liste et trace le premier graphe, la métrique 2 trace le second. Choisir pour
l'une la métrique de l'autre les échange, pour qu'elles restent distinctes. La
liste montre les deux valeurs de chaque élément.

**Vérifié dans Chrome** : C1 et C2, en Notoriété et en Trafic. `tsc` vert sur
ces fichiers.

## Answer

Validé par David le 2026-09-30 (« top, j'aime cette structure »), sur le
prototype `saas/web/app/meta/prototype-modules/`. La structure suit le brief
([`../brief.md`](../brief.md)), dans son ordre.

**L'ordre de la page**
0. **L'en-tête et la barre collante.** Le titre de la plateforme, le dernier jour
   complet, le menu campagne (recherche, dépense, coche) et le menu période
   (raccourcis de 7 jours à 12 semaines, calendrier sur deux mois, période sur
   mesure ; toujours comparée à la période d'avant de même durée). Au défilement,
   la barre se détache en pilule flottante et la catégorie s'y replie.
1. **Le choix de la vue** : trois cartes, Notoriété / Trafic / Conversion.
   Chacune porte son icône, sa question, son chiffre principal et son écart. Elles
   reconfigurent tout ce qui suit, et toutes les campagnes sont présentes dans
   chacune.
2. **Vue d'ensemble** : le TOTAL filtré, un graphe par métrique de la vue. La
   principale est en grand, les autres à côté. La période d'avant est en
   pointillé. Les jours de changement sont des pastilles sur la courbe
   principale, et un clic ouvre le panneau latéral du jour.
3. **Comparaison** : une liste classée (ad sets ou annonces, avec leur créa, une
   barre et les valeurs des deux métriques). On coche jusqu'à 4 éléments, qui
   apparaissent dans **deux graphes, un par métrique**, et les deux métriques
   sont toujours distinctes. **Reste à choisir la mise en page, C1 ou C2.**
4. **Tableau détaillé** : Campagne › Ad set › Annonce › Asset. Les colonnes
   suivent la vue. Au niveau asset, on montre le contenu, sans chiffres.

**Les métriques par vue** (celles du brief)

> **Modifié par le ticket 07 (2026-10-01)** : la vue Notoriété perd portée et
> fréquence (impressions, CPM seulement) ; la vue Trafic prend **tous les clics**,
> pas les clics sur le lien, et le taux de conversion divise par ce même clic.
> Les modules ont désormais des noms : voir `CONTEXT.md`, entrée **Module** (la
> « Vue d'ensemble » s'appelle **Tendance**).

| Vue | Métriques |
|---|---|
| Notoriété | impressions, CPM, portée, fréquence |
| Trafic | clics sur le lien, CTR, CPC |
| Conversion | conversions, coût par conversion, taux (conversions ÷ clics sur le lien, dénominateur écrit) |

**Ce qui change et ce qui ne change pas pour Google Ads**
- **Ne change pas** : l'ordre des blocs, la barre, les trois vues, la
  mécanique de la comparaison et du panneau latéral, le tableau dépliable.
- **Change** :
  - Le deuxième niveau s'appelle « groupe d'annonces ».
  - Portée et fréquence ne valent que pour certaines campagnes (vidéo, display).
    **À vérifier au contrat de données**, et ailleurs la case affiche « — »,
    jamais 0.
  - Les changements Google (`change_event`) ne remontent qu'à **30 jours**
    (`CLAUDE.md` §8) : au-delà, la courbe n'a pas de pastilles, et l'écran doit
    le dire.
  - Google fournit peut-être son propre taux de conversion : **à vérifier**
    avant de choisir le dénominateur.

**Ce que ce prototype a fait avancer sur d'autres tickets, sans les clore**
- « Les changements posés sur les courbes » : un repère par jour, pas par
  changement ; un seul panneau latéral ; la mention « l'absence de point ne
  prouve pas que rien n'a bougé ».
- « Aller lire le texte d'un asset sans quitter Pulse » : le contenu se lit en
  dépliant le tableau jusqu'à l'asset.
