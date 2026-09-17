# Renommer un thème lui fait perdre son étoile — et le supprimer en laisse une qui ne désigne rien

Type: task
Status: resolved

## Question

**Trouvé en réécrivant la cascade de [19](19-ecritures-qui-ne-se-relisent-pas.md)**,
en comparant ses étapes à celles de `_fusionnerLabels` : la FUSION propage sur
huit tables, le RENOMMAGE simple sur six, et les deux qui manquent sont
exactement celles qui décident de ce que Pulse conseille.

L'étoile « thème prioritaire » n'est pas une colonne : c'est une ligne
`insight_feedback` dont la CLÉ porte le nom du thème —
`priority_label:<nom>` (`app/actions.ts`, `togglePriorityLabel`). Elle est lue
sous cette forme à cinq endroits, dont `saas/traitement/build_report.py`
(`priority_labels`) et `saas/web/app/page.tsx`.

Conséquences, les deux mesurées à la lecture du code, aucune en base :

**1 · Renommer un thème étoilé lui retire son étoile sans un mot.** La ligne
reste sur `priority_label:<ancien nom>`, que plus aucun thème ne porte. Le thème
renommé redevient ordinaire — et `CLAUDE.md` §1 dit que **Pulse ne conseille que
dans les thèmes prioritaires** : le client perd les conseils de ce thème-là en
croyant l'avoir seulement renommé. Le rang (l'ordre d'ancienneté des étoiles) se
perd avec.

**2 · Supprimer un thème étoilé laisse son étoile derrière.** Rien ne retire
`priority_label:<nom>` dans `deleteLabel`. La clé survit au thème, et
`build_report.py` la compte parmi les trois que l'IA rédige : **un thème effacé
consomme en silence une des trois places**, et le client ne comprend pas
pourquoi son troisième thème n'a pas de conseils.

**3 · `reco_feedback.theme` dérive au renommage.** La clé d'unicité
`reco_feedback_uq2` porte `theme` (TASK-025) : un « pas pour moi » est muselé par
(reco_key, thème). Après un renommage, ces lignes gardent l'ancien nom — le
musellement ne s'applique plus, et le conseil écarté revient.

`_fusionnerLabels` traite les trois correctement, avec la gestion de conflit qui
va avec (une ligne peut DÉJÀ exister sous la cible). Le renommage simple, lui, ne
peut pas collisionner : il n'y a pas de cible préexistante — c'est justement ce
qui fait qu'il n'y avait pas de raison de l'oublier.

### Ce qu'il faut faire

- Ajouter à `renameLabel` (chemin simple) les deux étapes qui manquent —
  `reco_feedback.theme` et la clé `priority_label:` — **par UPDATE et non
  delete+insert** : `created_at` porte le rang de l'étoile, le recréer la
  renverrait en dernière position (la raison est déjà écrite dans
  `_fusionnerLabels`).
- Ajouter à `deleteLabel` l'étape qui retire `priority_label:<nom>`.
- Elles entrent dans l'`enchainer` posé par 19 (`lib/cascade.ts`), **avant** la
  liste maîtresse, comme toutes les autres.
- **Décider ce qu'on fait des étoiles orphelines déjà en base.** Les compter est
  possible à la lecture ; les effacer est un geste destructeur, donc il se
  propose (§7). Un thème renommé il y a trois semaines a peut-être déjà perdu
  ses conseils sans que personne l'ait vu.

### Ce qui n'est PAS dans ce ticket

L'enchaînement lui-même et son message d'arrêt — [19](19-ecritures-qui-ne-se-relisent-pas.md),
fait. La fusion, qui traite déjà les trois cas.

### Consigne de repli

Livrer les deux étapes du renommage, vérifiées, plutôt que d'ouvrir en plus la
question des lignes orphelines déjà écrites : celle-là touche des données
existantes et se décide avec David.

## Answer

Les trois propagations manquantes sont livrées dans les cascades existantes,
avant les posts Instagram et la liste maîtresse :

- le renommage met à jour `reco_feedback.theme` ;
- il met à jour la clé `insight_feedback.insight_key` de
  `priority_label:<ancien>` vers `priority_label:<nouveau>`, sans recréer la
  ligne : son `created_at`, donc le rang de la priorité, reste intact ;
- la suppression retire la ligne `priority_label:<nom>` avant de retirer le
  thème de `profiles.labels`.

Chaque étape passe par `enchainer` et expose son nom si elle échoue. Le chemin
de fusion n'a pas été modifié : il traitait déjà les collisions.

Vérification : `npx tsc --noEmit` et `npm run build` verts (19 routes). Le
dépôt ne contient aucun harnais de tests TypeScript ; `npm run lint` ne peut
pas tourner sans interaction car ESLint n'est pas encore configuré.

**Les priorités orphelines déjà présentes en base n'ont été ni comptées ni
supprimées.** Leur nettoyage reste une décision explicite de David, car il
touche des données existantes.
