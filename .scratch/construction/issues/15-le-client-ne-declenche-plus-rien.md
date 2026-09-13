# Le client ne déclenche plus rien : les quatre boutons sortent

Type: task
Status: resolved

## Question

**Tranché par [08](../../refonte/issues/08-la-memoire-du-travail.md), avec sa
raison CORRIGÉE par [13](../../refonte/issues/13-entre-deux-jours-de-travail.md).**

Les **quatre** boutons de déclenchement sortent de l'app. Le déclenchement vit
dans **GitHub Actions**, et un prototype porte son propre bouton quand on
travaille un sujet.

### La raison — la vraie, pas celle de 08

08 disait : cliquer « ↻ Recharger » un samedi quand on a choisi jeudi **change
tous les écarts sans qu'aucune donnée n'ait bougé**. **13 a mesuré que c'était
trop large** : la fenêtre est ancrée sur **la dernière donnée**
(`build_report.py` l. 1734), pas sur le jour de fabrication. Seul « ↻ Mes
données » bougeait l'ancre, **parce qu'il récolte**.

**La décision tient, sa raison change** : ce qui se RÉCOLTE ou se RÉDIGE attend
le Jour de travail. Les recos IA, les priorités, l'objectif du compte et les
catégories de conversions **attendent le jour dit**, avec un message qui le date.

### Ce qui ne sort PAS, et c'est le piège du ticket

**08 tue le DÉCLENCHEUR, pas l'AFFICHEUR.** `checkFetchProgress` est **déjà de la
vérité serveur** et reste : une première récolte Instagram de **16 minutes
réussit** — elle se dit longue, **jamais cassée**. Retirer l'afficheur laisserait
un client devant un écran muet pendant un quart d'heure.

### Les décisions voisines à bâtir dans le même passage

- **Une source branchée en milieu de semaine récolte tout de suite** et entre au
  rapport le jour dit — **sans infrastructure neuve** : le cron tourne déjà tous
  les matins.
- **Le Jour de travail se choisit à la clôture du fil de démarrage ; la récolte
  part à la connexion** (10).
- **Aucun bouton de test dans l'app.** GitHub Actions, et le prototype porte le
  sien.

### Trois défauts mesurés en 13, à réparer ou à ticketer

- **`/couts` n'est jamais rafraîchi par un classement.**
- **`setPostLabel` ne rafraîchit pas le rapport.**
- **`setCampaignLabel` appelle `revalidatePath("/")`** avec un commentaire qui dit
  que le rapport regroupe par thème : **l'appel est un no-op documenté comme s'il
  marchait.** C'est le vrai trou, et il se referme avec la vue SQL du ticket
  **04** — pas ici, sauf si 04 est en service.

### Ce que ça change pour la vérification

`CLAUDE.md` §9 impose de dire, à chaque correction, qu'elle ne se voit qu'après
« ↻ Recharger mes conseils » ou « ↻ Mes données ». **Ce ticket retire ces
boutons : §9 doit être mis à jour dans le même passage**, sinon la consigne
survit à son objet.

### Consigne de repli

Retirer les boutons **sans** toucher `checkFetchProgress`, et le dire. Confondre
les deux est l'erreur que ce ticket existe pour éviter.

## Answer

**Les quatre boutons sont sortis, l'afficheur est resté, et la récolte a changé
de déclencheur au lieu de disparaître.** Le piège nommé par le ticket était le
bon : tout le travail a consisté à séparer, ligne par ligne, ce qui DÉCLENCHE de
ce qui MONTRE.

### Ce qui est parti

- **Les quatre composants** — `fetch-button.tsx` (590 l.),
  `reload-recos-button.tsx` (124 l.), `classify-button.tsx` (380 l.),
  `classify-conversions-button.tsx` (236 l.).
- **Les quatre actions serveur** — `triggerFetch`, `triggerClassify`,
  `triggerCategorize`, `triggerReport`.
- **Leurs traces à l'écran** : la ligne de titre de la section 2 du rapport, le
  bloc « Étiqueter tout » de `/labels`, le geste IA de l'étape 2 de la mise en
  place, le bouton de `/conversions`, le lien « récolter maintenant ↓ » du
  module Jour de récolte, et cinq phrases qui nommaient un bouton — dont un
  **constat publié par `insights.py`** (« Clique « ✨ Classer mes contenus » »)
  et les deux messages de `kpi-focus.tsx`.

### Ce qui est resté, entier

**`checkFetchProgress` n'a pas bougé d'une ligne.** `checkFetchStatus` non plus
dans son comportement, mais son corps a déménagé dans `lib/github-workflow.ts`
(`etatDernierRun`) et l'action serveur n'en est plus que l'enveloppe — c'est un
déplacement, pas une réécriture : le module qui parle à GitHub est le même pour
le lecteur et pour l'amorçage.
`fetch-button.tsx` est devenu **`components/suivi-recolte.tsx`** : le même
panneau, la même vérité serveur, le même refus d'inventer un pourcentage —
moins le lanceur. Deux places au lieu de deux ancrages :

- **`flux`** (colonne, tiroir, page Connexions) : le panneau dans le flux. Le
  flottement `absolute right-0 top-full` était une conséquence du bouton — il
  pendait SOUS lui ; sans bouton la boîte `relative` mesure zéro. Le retirer
  fait disparaître d'elles-mêmes les deux coupes mesurées (29 px hors écran à
  gauche, 34 px sous la fenêtre) ;
- **`compact`** (en-tête du téléphone, 52 px) : une pastille « ◌ récolte », rien
  de plus. Le détail est à un tap, dans le tiroir, qui rend le même module en
  `flux`.

**Il ne rend RIEN quand rien ne tourne** — c'est la différence de fond avec le
bouton qu'il remplace. Le seul geste qu'il propose encore est « ✓ Données prêtes
— recharger », qui recharge la page affichée et ne part vers aucun serveur.

### Ce qu'il a fallu ajouter, et qui n'était pas dans le ticket

**Une veille d'une minute.** Tant que la récolte partait d'un clic, le clic
faisait passer l'écran en « ◌ récolte ». Maintenant les deux départs sont
ailleurs, et GitHub met quelques secondes à publier un run : la lecture du
montage tombe encore sur l'ANCIEN, terminé. Sans veille, quelqu'un qui vient de
brancher sa Page resterait devant un écran muet jusqu'à ce qu'il pense à
recharger — le défaut même que le ticket interdit. Elle n'appelle que
`checkFetchStatus`, et **pas** dans un onglet en arrière-plan (la barre latérale
est rendue deux fois, et `/comptes` en pose une troisième).

### Les décisions voisines, bâties

**1 · Une source branchée récolte tout de suite.** `connecterMeta`,
`choisirCompteGoogle` et `choisirProprieteGa4` lancent le workflow, avec le
dispatch que les boutons utilisaient — déplacé dans **`lib/github-workflow.ts`**
parce qu'un fichier `"use server"` ne peut exporter que des fonctions
asynchrones. La récolte part au CHOIX du compte, pas au retour d'OAuth : une
autorisation Google accordée ne récolte rien tant que le compte publicitaire et
la propriété ne sont pas désignés. Un amorçage qui rate ne fait pas rater le
branchement, et se dit dans le message de retour.

**Une conséquence que le ticket n'avait pas vue, et qui a demandé une garde** :
choisir son compte Google Ads puis sa propriété Analytics fait partir **deux**
récoltes à quelques secondes d'intervalle. Deux workers sur le même compte
écriraient `fetch_progress` en même temps et publieraient le rapport deux fois.
`weekly-fetch.yml` gagne donc un `concurrency: recolte-${{ inputs.user_id }}`,
`cancel-in-progress: false` — on ne coupe jamais une récolte en cours, elle peut
être à sa quinzième minute d'Instagram.

**2 · Le Jour de travail se choisit à la clôture du fil de démarrage.** Les sept
jours ont quitté `jour-recolte.tsx` pour **`components/choix-jour.tsx`**, leur
unique écriture, et `SetupWizard` ferme maintenant sur « Quel jour veux-tu être
servi ? ». **Elle ne se rejoue pas** : `fetch_schedule` vaut `'Monday'` par
DÉFAUT en base (`fetch_schedule_default.sql`), donc rien ne distingue un défaut
d'un choix — rouvrir l'étape plus tard redemanderait un choix déjà fait. C'est
la raison pour laquelle cette clôture vit en état local, et pas en base.

**3 · Les trois réglages différés sont datés.** Priorités de thèmes, objectif du
compte, catégories de conversions : le geste s'enregistre à la seconde, et le
message dit le jour — « Enregistré — tes conseils en tiennent compte le jeudi
17 septembre ». Une seule formulation (`prisEnCompteLe`, `lib/jour-de-travail.ts`),
une seule lecture de la date (`lib/jour-compte.ts`, **le compte REGARDÉ**, comme
les trois dates du rapport). Sur l'étoile, l'avertissement du serveur passe
avant la date : la quatrième étoile a quelque chose de plus important à dire.

**4 · Aucun bouton de test dans l'app.** Les cinq entrées `workflow_dispatch`
restent ; leurs descriptions ne nomment plus des boutons qui n'existent plus.

### Les trois défauts de 13

- **`/couts` est rafraîchi** par `setCampaignLabel` — c'est la page des coûts
  PAR THÈME, et elle se recalcule à la lecture.
- **`setPostLabel` rafraîchit `/`** : un post compte dans la couverture
  exactement comme une campagne.
- **Le commentaire qui mentait est corrigé, l'appel est gardé.** `revalidatePath("/")`
  n'est **pas** un no-op : il rafraîchit la couverture, l'alerte de couverture et
  l'étape 2 de la mise en place, toutes trois lues en direct. Ce qu'il ne peut
  pas faire — rendre les blocs par thème du rapport, qui sortent du JSON figé —
  est maintenant écrit à côté, avec le ticket qui le refermera (**04**, la vue
  SQL). **04 n'est pas en service** : le ticket disait « pas ici, sauf si 04 est
  en service », on n'a donc pas touché au payload.

### Ce que ça a fait naître

[39 · L'annulation en bloc des étiquettes IA a perdu son déclencheur](39-l-annulation-des-etiquettes-ia-a-perdu-son-declencheur.md).
Les garanties 2 et 3 de l'**ADR 0001** (annuler en bloc, revoir les thèmes
neufs un par un) bornaient leur périmètre par un `depuis` gardé dans le
`sessionStorage` de l'onglet qui avait cliqué : **sans clic, plus rien à
compter**. Les quatre actions qui les portaient ont été supprimées — du code que
plus aucun écran n'atteint n'est pas une garantie, c'est un souvenir. Le besoin,
lui, grandit : l'IA classe désormais sans que personne ne le demande. L'ADR 0001
porte une note de statut qui dit que sa décision tient et que son mécanisme est
parti.

### `CLAUDE.md` §9, mis à jour dans le même passage

La consigne ne peut plus renvoyer à des boutons qui n'existent plus. Elle dit
maintenant qu'une correction du traitement ou de la récolte **ne se voit
qu'après un passage du worker** — le cron du Jour de travail, ou un lancement à
la main depuis GitHub Actions — et qu'il faut nommer lequel des deux. La note de
vérification de `map.md` et celle de `spec.md` suivent.

### Vérification

`rm -rf .next tsconfig.tsbuildinfo`, `npx tsc --noEmit` **vert**,
`npm run build` **vert**, **19 routes**. `python3.12 -m py_compile` sur les trois
fichiers Python touchés. `git grep` propre sur les quatre libellés retirés.

**Ce qui n'a PAS été vérifié, et doit être dit** : `saas/web` n'a aucun runner de
test (décision de David, ticket 16), donc **rien de ce travail n'est couvert par
un test** — ni la veille, ni l'amorçage, ni la clôture du fil. **Aucun clic n'a
été joué, aucun run GitHub n'a été déclenché, aucune écriture n'a été relue en
base.** Trois points ne peuvent se vérifier qu'en service, et David est le seul à
pouvoir le faire : que le dispatch d'amorçage parte vraiment au branchement, que
la garde de concurrence fasse bien attendre la seconde récolte, et que la veille
fasse apparaître le panneau dans la minute.
