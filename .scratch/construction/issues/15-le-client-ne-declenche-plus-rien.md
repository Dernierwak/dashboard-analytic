# Le client ne déclenche plus rien : les quatre boutons sortent

Type: task
Status: open

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
