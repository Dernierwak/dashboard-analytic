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

---

## Réponse — 2026-09-17

Les trois étapes sont posées, et elles ne sont écrites qu'**une fois** :
`saas/web/lib/deplacer-theme.ts` porte `deplacerEtoile`,
`deplacerRetoursConseils` et `retirerEtoile`, et les **trois** appelants
(`renameLabel`, `deleteLabel`, `_fusionnerLabels`) passent par lui. La fusion a
donc perdu ses deux blocs recopiés : c'est la duplication entre les deux chemins
qui avait produit ce défaut, la refaire aurait préparé le suivant.

- **Renommage simple** : « retours sur les conseils » puis « priorité du thème »
  entrent dans l'`enchainer` de 19, à la place qu'elles ont dans la fusion —
  après l'objectif, **avant** la liste maîtresse, pour qu'un arrêt reste
  relançable.
- **Suppression** : « priorité du thème » retire la clé, au même endroit.
- **Par UPDATE**, jamais delete + insert : `created_at` porte le rang de
  l'étoile. Le harnais le vérifie sur la ligne — même `id`, même `created_at`.

### Quatre choses trouvées en le faisant, qui n'étaient pas dans le ticket

**1 · Le renommage simple PEUT collisionner.** Le ticket dit le contraire, et son
raisonnement ne tient que sur `profiles.labels` : `renameLabel` route vers la
fusion quand un THÈME porte déjà le nom d'arrivée. Mais une LIGNE survit à son
thème — c'est le défaut n° 2 de ce ticket même, et ces orphelines sont déjà en
base. Un UPDATE aveugle heurte alors la contrainte d'unicité, la cascade s'arrête
là, et **relancer échoue à l'identique** : le thème resterait renommé à moitié
pour toujours. Les trois fonctions traitent donc le conflit comme la fusion le
faisait déjà. Vérifié par contre-épreuve : la version aveugle décrite par le
ticket fait échouer quatre cas du harnais.

**2 · `de === vers` effaçait tout.** `renameLabel` **trime** le nouveau nom :
« Soldes » renommé en « Soldes  » (une espace en trop) passe le garde de l'écran,
qui compare les noms AVANT le trim, et descend par le chemin simple avec les deux
noms devenus identiques. La ligne de départ était alors sa propre ligne
d'arrivée : le code de conflit la voyait « déjà prise » et l'**effaçait** —
l'étoile du thème et **tous** ses retours de conseils, pour une faute de frappe.
Trouvé en relisant le correctif, pas en l'écrivant ; corrigé par un retour sec en
tête des deux fonctions, et gardé par trois cas qui échouent si le garde saute.

### Deux autres, venues de `/code-review`

**3 · La lecture des retours se pagine.** Elle était nue. PostgREST plafonne à
1 000 lignes et **tronque en silence** (`CLAUDE.md` §8) : au-delà, les retours de
la deuxième page seraient restés sur l'ancien nom — le défaut de ce ticket même,
revenu en silence et seulement chez les comptes qui ont assez d'historique. Et la
liste d'arrivée tronquée aurait laissé passer une collision vers l'UPDATE, donc
un arrêt de cascade non rattrapable.

**4 · L'étoile relit ce qu'elle vient d'écrire.** Un refus RLS sur un update ne
lève rien : il touche zéro ligne (`CLAUDE.md` §8), et sans `.select("id")`
PostgREST ne dit même pas combien. La ligne existe — on vient de la lire — donc
zéro ligne écrite est un refus, pas un « rien à faire ». L'étape le dit
maintenant, au lieu de laisser la cascade se déclarer verte sur une étoile restée
à l'ancien nom.

**Une cinquième remarque de la revue a été écartée, vérifiée fausse.** Elle
annonçait que `insight_feedback` et `reco_feedback` sont en RLS « own rows »
seulement, donc qu'un membre invité renommerait un thème sans jamais toucher
l'étoile du propriétaire. Les deux tables sont bien dans la boucle de partage
(`000_run_me_all.sql` §15.1, et `equipe_partage.sql`) : elles reçoivent
`partage_select`/`update`/`delete` sur `a_acces()` / `peut_editer()`, et
PostgreSQL combine les policies d'une même commande **en OU**. La revue n'avait lu
que les policies « own rows » de la section 8. Rien à corriger.

### Vérifié

- `.scratch/construction/harnais/45-l-etoile-du-renommage/` — **48 cas exécutés**
  (`lib/deplacer-theme.ts` joué tel quel contre une fausse base qui reproduit les
  deux contraintes d'unicité de la migration, les tranches `.range()` et le refus
  RLS qui touche zéro ligne sans lever ; cas témoin compris) et **29
  vérifications de câblage** lues dans `actions.ts`.
- Les quatre correctifs sont **contre-éprouvés**, chacun en cassant le code
  exprès : version aveugle du ticket → 4 cas rouges ; garde `de === vers`
  retiré → 3 rouges ; boucle de pagination coupée → 3 rouges ; relecture de
  l'écriture retirée → 1 rouge.
- `19-ecritures` toujours vert (117/117 + 23/23) — le refactor de
  `_fusionnerLabels` n'a rien cassé de ce qu'il tenait.
- `jouer_tout.py` : tout passe **sauf** les deux harnais de
  `31-la-cible-des-regles`, déjà rouges avant ce ticket (travail en cours non
  commité sur `reco_engine.py` / `regles_payantes.py` / `build_report.py`, sans
  rapport — ces fichiers ne sont pas touchés ici et restent hors du commit).
- `saas/web` : `rm -rf .next tsconfig.tsbuildinfo`, `npx tsc --noEmit` vert,
  `npm run build` vert, **19 routes**.

### Ce qui n'a PAS été vérifié

- **Rien en base.** Aucun accès : tout est joué contre une fausse base.
- **Rien à l'écran, et ça ne se clique pas.** Un thème qui garde son étoile ne se
  voit qu'au **passage du worker** (`CLAUDE.md` §9) — le cron du Jour de travail
  (07:00 UTC) ou un lancement à la main depuis **GitHub Actions**
  (`weekly-fetch.yml`, `report_only` suffit).

### Resté ouvert, volontairement

**Les étoiles orphelines déjà en base** — la quatrième puce du ticket. Les
compter demande un accès à la base ; les effacer est destructeur, donc ça se
propose (`CLAUDE.md` §7). Ce correctif empêche d'en créer de nouvelles, il n'en
répare aucune. Un thème renommé il y a trois semaines a peut-être déjà perdu ses
conseils.

**Noté en chemin, hors périmètre** : `deleteLabel` ne nettoie pas `reco_feedback`
alors qu'il nettoie `theme_ga4_events` et `theme_objectifs` pour une raison qu'il
écrit lui-même — un thème recréé sous le même nom récupérerait des « pas pour
moi » que personne n'a donnés sur lui. Ticket
[63](63-supprimer-un-theme-laisse-ses-retours-de-conseils-derriere.md).
