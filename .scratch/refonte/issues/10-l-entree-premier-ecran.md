# L'entrée : le premier écran, pour celui qui arrive et celui qui revient

Type: grilling
Status: resolved
Blocked by: 08

## Question

Gradué par [06](06-le-parcours-comment-les-pages-se-parlent.md). Deux personnes
ouvrent la même page et n'ont pas la même question : **le nouveau venu** demande
« par où je commence ? », **celui qui revient le jeudi** demande « ma semaine a
été bonne ? ». Aujourd'hui ils reçoivent le même écran, dans le même ordre.

### Le fait

`SetupWizard` est rendu **en bas de page** (`app/page.tsx` l. 641), après les
deux sections du rapport. C'est le fil de démarrage — profil → classement →
priorités, état déduit des données, quittable et reprenable — et il est sous
deux écrans de défilement.

Le code montre qu'on a déjà fait ce raisonnement pour un autre bloc : un
commentaire voisin (l. 636-638) explique qu'un module *« occupait une bande
pleine largeur en bas de page, après tout le reste, alors qu'il contient des
actions qui bloquent le plafond des trois chantiers sans qu'on sache
pourquoi »* — et il a été remonté dans la section 1.

`SetupWizard` lui-même est bon : il affiche la récompense du classement à
l'endroit où il demande l'effort (l. 169, `depenseParTheme`). C'est exactement
ce que [02](02-sur-quoi-se-differencient-les-autres.md) dit que le marché ne
fait pas — **ne pas le casser en le déplaçant.**

### Ce qu'il faut trancher

- **Ce que voit un compte neuf**, dans l'ordre, avant d'avoir classé quoi que ce
  soit. 02 : personne ne promet la valeur à la minute 1, tous **publient leur
  plancher d'éligibilité avant l'essai** (30 jours d'historique chez Optmyzr,
  « first report Monday » chez GoodMorning). Est-ce que Pulse annonce le sien ?
- **Ce que voit celui qui revient**, le jour qu'il a choisi
  (`profiles.fetch_schedule`, déjà construit) : qu'est-ce qui est visible avant
  le premier défilement, sur un téléphone de 390 px ?
- **Si les deux écrans sont le même**, piloté par l'état des données — comme
  `SetupWizard` l'est déjà — ou deux écrans distincts.
- **Où va le fil de démarrage** une fois les 3 étapes finies : il disparaît, ou
  il devient autre chose ?

### Pourquoi ce ticket est bloqué

Le premier écran **compose** ce que [08](08-la-memoire-du-travail.md) et
[11](11-d-ou-viennent-les-conseils.md) auront décidé. Le dessiner avant, c'est
remettre des blocs sur des blocs — exactement ce que David reproche au produit
actuel.

### Consigne de conduite

Ticket **HITL**. Skills : `ux` (les quatre états, et le téléphone d'abord),
`hebdo` (l'ordre des blocs), `vision-ux`, puis `grilling`.

## Answer

Le ticket demandait où placer `SetupWizard`. La lecture du code a déplacé la
question : **le fil de démarrage ne demande pas ce qu'il faut pour démarrer.**

### Ce que le code disait, contre ce que le ticket supposait

- **La connexion des régies n'est pas une étape du fil.** `SetupWizard` fait
  profil → thèmes → priorités ; brancher Meta / Google / GA4 n'existe que comme
  entrée de menu « ⚯ Connexions » (`side-nav.tsx` l. 97), réservée au
  propriétaire. Conséquence mesurable : sans connexion `couverture.total = 0`,
  donc `needLabels` est faux, `needPriorities` aussi — **le fil rend `null`**.
  Le compte neuf ne voit ni fil ni rapport, seulement « Pas encore de données
  ici ». Le ticket disait « il est sous deux écrans de défilement » ; en réalité
  **pour le compte le plus neuf il n'est pas là du tout**.
- **Cet état vide envoie vers un bouton que [08](08-la-memoire-du-travail.md)
  vient de tuer** : *« Lance ↻ Mes données en haut »* (`page.tsx` l. 653).
- **Le plancher de Pulse n'est pas celui du marché.** La première récolte part
  du **1er janvier de l'année en cours** (`fetch_all.py` , `_depart_recolte`) —
  huit mois d'historique à la minute 1, là où
  [02](02-sur-quoi-se-differencient-les-autres.md) a mesuré 30 jours d'attente
  chez Optmyzr et « first report Monday » chez GoodMorning. Mais le **rapport**
  n'existe qu'au passage du worker : **deux horloges, pas une.**
- **Le suivi de récolte existe déjà, et sa vérité est sur GitHub** —
  `checkFetchStatus` / `checkFetchProgress` (`fetch-button.tsx`), reconstruits au
  montage à partir du dernier run, survivant au changement de page et au second
  onglet. Il est aussi écrit dans ce fichier qu'une première récolte Instagram
  peut prendre **16 minutes et réussir** : une récolte longue se signale comme
  longue, jamais comme cassée. 08 retire le **déclencheur**, pas l'**afficheur**.
- **Le fil revient tout seul, plus tard, et il ment quand il revient.**
  `needLabels = couverture.total > 0 && couverture.sansTheme > 0` redevient vrai
  dès qu'une campagne non classée arrive. Un compte de huit mois se voit alors
  annoncer « Mise en place — encore 2 étapes » avec une barre à 2/3.

### Ce qui est tranché

**1. Le fil passe à quatre étapes, la connexion en deuxième, en gate dur.**
profil → **connexions** → thèmes → priorités. Le profil reste en tête : 30
secondes au clic, et il calibre le ton de tout ce qui suit ; le faire précéder
d'une redirection OAuth, c'est perdre la moitié des gens chez Google avant
d'avoir un profil. La connexion devient un gate dur sur le patron déjà écrit
dans `docs/adr/0002-onboarding-gate-theme-minimum.md` — on ne « plus tard » pas
l'étape sans laquelle les deux suivantes n'ont pas d'objet.

**2. Un seul écran, piloté par les données — mais l'ordre s'inverse.**
Pas deux routes : l'état est entièrement déductible (profil rempli ? une
connexion ? contenus classés ? priorités posées ?), et deux routes, ce sont deux
endroits où la règle peut diverger. Ce qui change, c'est la **place** : tant
qu'une étape est ouverte, **le fil est le premier bloc de la page** et le
rapport passe dessous ; dès que les quatre sont franchies, le fil s'efface et le
verdict reprend la tête. C'est le même raisonnement que le commentaire des
l. 636-638 sur `HorsTheme` — un bloc qui porte l'action bloquante ne vit pas
sous deux écrans de défilement.

**3. Le fil ne revient jamais — et ça ne coûte aucune migration.**
Condition d'affichage : **aucun rapport publié** *et* une étape ouverte. Dès
qu'une ligne existe dans `weekly_reports`, le fil est éteint définitivement.
La mise en place est un **événement**, pas un état récurrent. Ce qui arrive
ensuite — des campagnes non classées qui tombent en semaine 30 — est l'affaire
d'`AlerteThemes`, qui existe déjà, qui est posée à la charnière section 1 /
section 2, et qui se vide d'elle-même. Elle compte des francs non rattachés ;
elle ne prétend pas qu'on est en train de s'installer.

**4. On annonce les deux horloges, à la connexion.**
*« Tes chiffres publicitaires depuis le 1er janvier arrivent dans quelques
minutes. Ton premier rapport : jeudi. »* C'est le seul endroit de la carte où
Pulse est **au-dessus** du plancher du marché au lieu d'en dessous, et 02 a
montré que tous les concurrents publient le leur. Le taire, c'est se faire
passer pour eux. Deux gardes-fous §7 : la phrase dit **ce qu'elle couvre** — le
1er janvier vaut pour la pub, pas pour les abonnés Instagram, dont l'historique
commence à la première récolte ; et le jour nommé est celui que le client vient
de choisir, jamais un délai estimé.

**5. Le Jour de travail se choisit à la clôture du fil ; la première récolte
part à la connexion.** (Point atterri depuis 08.) La récolte ne l'attend pas :
un client qui branche un vendredi resterait six jours devant un écran vide alors
que ses données existent déjà. Le jour choisi ne gouverne que **la suite**. Et
il se choisit **après** les priorités, pas dans le profil : c'est un
rendez-vous, on ne le fixe pas avant d'avoir vu ce qu'on y reçoit. Il clôt le
fil et lui donne sa dernière phrase : *« C'est en place. Chaque jeudi matin,
Pulse récolte, recalcule et publie. »*

**6. L'ordre du premier écran de celui qui revient, à 390 px.**
Aujourd'hui : libellé de semaine + raccourci + **Verdict** (calculé) + **résumé
IA** en prose nue, qui mange tout l'écran restant. Nouvel ordre :

1. le **Verdict** — « ma semaine a été bonne ? », inchangé, il est bon ;
2. le **bilan du carnet** décidé en 08 — *« ce mois-ci : 6 actions jugées, 4 ont
   marché »*, un comptage de `suivi_actions.verdict` déjà persisté, zéro mesure
   nouvelle ;
3. le **rail des chantiers en cours** — la règle « une action décidée vit en
   haut jusqu'à être faite » était déjà tranchée, elle n'était pas appliquée ici ;
4. le **résumé IA**, replié derrière « Lire le résumé ».

Raison : 08 a fait du carnet **le** mécanisme de rétention, absent des dix
produits lus en 02, et il est aujourd'hui enfermé dans le tiers droit d'une
carte de thème à deux écrans de là. La prose IA est à l'inverse ce qu'il y a de
moins vérifiable sur la page, et elle occupe les pixels les plus chers. Contre
la trame du lundi matin (skill `hebdo`) : ①  verdict ✓, ⑤ ce que la dernière
fois a donné ✓, ④ je fais quoi ✓ — et ② « pourquoi » descend d'un cran, dans le
résumé replié puis la section 1. C'est l'ordre juste : le « pourquoi » ne se lit
que si le verdict a inquiété.

**7. Les quatre états de l'écran d'entrée.**

- **Vide** (connecté, rien n'est encore revenu) — l'écran devient le **suivi de
  la première récolte**, en lecture seule : on réutilise `checkFetchProgress`,
  qui est déjà de la vérité serveur et survit à la navigation. Le texte perd
  l'ordre « Lance ↻ Mes données », qui désigne un bouton mort depuis 08.
- **Chargement** — il est **long et c'est normal** : jusqu'à 16 minutes mesurées
  sur un premier chargement Instagram. L'écran le dit et dit qu'on peut fermer.
  Aucun couperet, aucun échec annoncé une minute avant la victoire.
- **Erreur** — une connexion qui ne répond plus se dit **au-dessus du verdict**,
  pas dans un coin : tout ce qui est en dessous devient partiel, et §7 interdit
  de présenter une fenêtre trouée comme une mesure. C'est la même obligation que
  08 a posée côté worker (« si les données s'arrêtent avant l'ancre, on le dit »).
- **Plein** — c'est l'ordre du point 6.

### Ce que ce ticket ne tranche pas

Où vit l'afficheur de récolte une fois que [12](12-module-de-commandes.md) aura
décidé s'il existe un module unique posé sur toutes les pages : c'est un
candidat naturel pour y entrer, mais c'est 12 qui le dit. Et ce que voit le
client qui agit **entre** deux Jours de travail reste
[13](13-entre-deux-jours-de-travail.md).

### Le vocabulaire

**Mise en place** entre dans `CONTEXT.md` : les quatre étapes franchies une
seule fois — profil, connexions, thèmes, priorités. Le mot était **déjà à
l'écran** (« Mise en place — encore 2 étapes ») sans être défini, et ce ticket
lui donne sa frontière dure : elle se termine et ne recommence pas.

## Comments

**2026-09-10, précisions apportées par [21](21-le-document-de-refonte.md)** —
deux points, après que David a redécrit la Mise en place de mémoire :

- **Le gate dur reste, et il est le seul.** David : *« le user peut faire ce
  qu'il veut dans l'ordre qu'il veut »*. La connexion garde son gate (la passer
  donne l'écran mort mesuré ici) ; profil, thèmes et priorités deviennent
  franchissables **dans le désordre** — le fil dit ce qu'il reste, il ne
  l'impose pas.
- **L'étape « thèmes » se valide sur un thème POSÉ sur au moins une campagne**,
  pas sur un thème créé. Un thème vide ne déverrouille aucun module, et le
  déverrouillage est la récompense annoncée ([04](04-ce-qui-doit-etre-valide-en-premier.md)).
