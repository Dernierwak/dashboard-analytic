# L'annulation en bloc des étiquettes IA a perdu son déclencheur

Type: task
Status: open

## Question

**Trouvé en chemin par le ticket [15](15-le-client-ne-declenche-plus-rien.md),
devenu un ticket plutôt qu'un détour silencieux** (`CLAUDE.md` §4).

Le bouton « ✨ Étiqueter tout via l'IA » appliquait **directement, sans
validation préalable** — décision de David, et elle tenait à une contrepartie
écrite noir sur blanc dans
[`docs/adr/0001-revue-apres-coup-nouveaux-themes.md`](../../../docs/adr/0001-revue-apres-coup-nouveaux-themes.md) :

1. rien n'écrase un choix humain (garantie côté worker ET côté base) ;
2. **tout est annulable en bloc**, tant qu'on est sur la page ;
3. **les nouveaux thèmes inventés par l'IA se revoient un par un**, après coup.

Le ticket 15 a retiré le bouton. **Les garanties 2 et 3 sont parties avec lui**,
et pas par choix de forme : leur périmètre était borné par un `depuis` rendu par
`triggerClassify` et gardé dans le `sessionStorage` de l'onglet qui avait
cliqué. Sans clic, pas de `depuis` — donc rien à compter, rien à annuler, et
aucune liste « d'avant » à comparer à la liste « d'après ».

Les quatre actions serveur qui les portaient (`compterEtiquettesIA`,
`annulerEtiquettesIA`, `compterCategoriesIA`, `annulerCategoriesIA`) ont donc été
**supprimées** avec leurs composants : du code que plus aucun écran n'atteint
n'est pas une garantie, c'est un souvenir. La garantie 1, elle, n'a pas bougé —
elle vit côté worker et côté base.

### Pourquoi le besoin GRANDIT au lieu de disparaître

Avant, l'IA ne classait que sur clic : on savait quand, on regardait le
résultat, on annulait dans la minute. **Maintenant elle classe à chaque Jour de
travail, sans que personne ne le demande.** Le client ouvre Pulse le jeudi matin
et trouve quarante étiquettes qu'il n'a pas posées, plus, éventuellement, des
thèmes neufs dans son vocabulaire. C'est exactement le cas que l'ADR voulait
couvrir, et c'est le seul cas qui reste.

### Ce qu'il faudra trancher

- **Ce qui borne « ce que l'IA vient de poser »** maintenant qu'il n'y a plus de
  clic. La piste la plus courte est déjà en base et déjà lue par l'écran :
  `fetch_progress.run_id` est l'horodatage du dernier passage du worker, et
  `checkFetchProgress()` le rend déjà au navigateur. `label_at` (migration
  `labels_origine.sql`) borne les lignes du côté des étiquettes. Aucune colonne
  neuve n'est nécessaire *a priori* — à vérifier avant de l'affirmer.
- **Où ça se lit.** Sur `/labels`, sous le module de couverture, à la place
  qu'occupait le bouton ? Dans le module « À faire », comme une ligne qui se
  coche ? Les deux ont leur logique et ce n'est pas au code de choisir.
- **Combien de temps l'offre reste ouverte.** « Tant qu'on est sur la page »
  n'existe plus : un passage du worker dure jusqu'au suivant. Une semaine
  entière d'annulation possible, ou seulement jusqu'au premier geste du client ?
- **Ce qu'il advient de l'ADR 0001.** Sa décision — revue APRÈS coup, jamais
  avant — reste juste et se renforce. Sa description du mécanisme
  (`triggerClassify`, `classify-button.tsx`, `sessionStorage`) est **périmée** :
  soit l'ADR se met à jour, soit une ADR neuve le remplace en le citant.

### Ce qui n'est PAS ce ticket

- **Rouvrir le retrait des boutons.** Il est tranché par
  [refonte 08](../../refonte/issues/08-la-memoire-du-travail.md) point 7 et
  [refonte 13](../../refonte/issues/13-entre-deux-jours-de-travail.md) §6. Le
  remède n'est pas de rendre le bouton, c'est de rendre l'annulation
  indépendante d'un clic.
- **Toucher à la règle d'or.** L'IA ne remplit que le vide ; un thème posé à la
  main n'est jamais réécrit. Ça marche, et ce ticket n'y touche pas.

### Consigne de repli

Écrire ce qui borne le passage (la question la plus lourde, et celle dont tout
le reste dépend) plutôt qu'ouvrir la question de l'emplacement à l'écran.
