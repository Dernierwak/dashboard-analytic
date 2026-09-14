# Trente écritures qui ne relisent jamais ce qu'elles ont écrit

Type: task
Status: resolved

## Question

**Trouvé en réalisant [02](02-garde-de-collision-resolveaction.md)**, qui
demandait de *« chercher le même défaut sur les voisines »*. Le voisinage est
plus large que prévu, et il déborde de la collision.

`app/actions.ts` compte **30 écritures dont le résultat n'est même pas
capturé** — `await supabase.from(…).update/delete/upsert(…)` sans `const r =`.
Ces appels ne peuvent pas voir une erreur, encore moins un compte de lignes :
la fonction rend `{ ok: true }` par construction, et l'écran répond
« enregistré ». C'est le piège de `CLAUDE.md` §8 posé 30 fois.

Trois familles, par gravité décroissante.

**1 · Une collision possible, comme 02.** Un `update`/`delete` visant une ligne
existante par son `id`, qu'un autre membre « Peut agir » peut avoir déplacée ou
supprimée entre-temps :

- `deleteNote` (l. 325) — `delete … eq(id) eq(user_id) eq(kind,'note')`, erreur
  lue mais pas le compte. **Ticket [05](05-migration-deux-colonnes.md) y touche
  déjà** pour `author_id` : à traiter d'un seul geste, pas deux fois.
- `changerRoleMembre` (l. 1862) et `revoquerMembre` (l. 1878) —
  `eq(id) eq(owner_id, compte.moi)`, erreur lue, compte non lu. Un membre déjà
  révoqué par l'autre propriétaire répond « c'est fait ».

**2 · Un refus RLS invisible.** `saveObjectif` (l. 517) écrit sur `profiles` en
jetant tout le résultat : un invité dont la RLS refuse l'écriture sur le profil
du propriétaire reçoit « enregistré » sans qu'une ligne bouge. `saveObjectif`
est appelée depuis deux écrans (le rapport et `/conversions`).

**3 · Une cascade qui peut s'arrêter au milieu.** `renameLabel` (l. 860-924) et
`deleteLabel` (l. 925-973) propagent un thème sur **six tables** en enchaînant
des `await` nus (l. 891-951). Si la troisième échoue, les deux premières restent
écrites, la fonction rend `{ ok: true }`, et le compte se retrouve avec un thème
à moitié renommé — sans un mot. C'est la plus coûteuse des trois : elle produit
un état incohérent, pas seulement un silence.

### Ce qu'il faut faire

- **Ne pas tout convertir mécaniquement.** Un `upsert` écrit toujours une ligne :
  y ajouter un compte n'apprend rien. Le compte de lignes n'a de sens que sur un
  `update`/`delete` **ciblé**, là où zéro ligne veut dire quelque chose.
- Décider ce que dit l'écran dans chaque cas — la famille 1 a son patron dans
  `resolveAction` (ADR 0004 : on nomme l'état, jamais une personne) ; les
  familles 2 et 3 n'ont pas de message aujourd'hui.
- La famille 3 pose une vraie question d'architecture : six écritures qui
  doivent tenir ensemble sont une **transaction**, pas six appels PostgREST. Une
  fonction SQL `SECURITY DEFINER` la ferait d'un coup. À trancher avant de
  coder.

### Ce qui n'est PAS dans ce ticket

La garde de collision de `resolveAction` — [02](02-garde-de-collision-resolveaction.md),
faite. La suppression d'une note par son auteur —
[05](05-migration-deux-colonnes.md), qui porte `author_id`.

### Consigne de repli

Livrer la famille 1 seule, vérifiée, plutôt que d'ouvrir la cascade de thèmes à
moitié : la famille 3 change la forme du code, pas seulement sa vigilance.


## Answer

**Les trois familles sont livrées, y compris la cascade — et l'écran aussi, ce
que le ticket ne disait pas encore.** Sur les **30** écritures nues mesurées par
le ticket, il en reste **2**, et ce sont les deux dont le code écrit désormais la
raison. `tsc` et `npm run build` verts, **19 routes**. **117 + 23 vérifications
neuves**, 639 rejouées. **Rien n'a été joué en base.**

### 0 · Le défaut avait une seconde moitié, et elle rendait la première inutile

Les écrans **jetaient la réponse** : `await changerRoleMembre(…)`,
`await revoquerMembre(…)`, `await saveObjectif(…)`, `await deleteLabel(…)`,
`await deleteConversionCategory(…)` — sans rien en faire. `budget-editor.tsx`
affichait littéralement `setSaved(true)` **après** un appel qu'il ne regardait
pas : la phrase du ticket, « l'écran répond enregistré », était écrite dans le
code au mot près.

Corriger les actions sans toucher aux écrans n'aurait donc **rien** changé pour
le client. Les six appels lisent maintenant leur réponse, et chaque écran a de
quoi montrer un échec.

### 1 · La cascade a été ouverte — l'arbitrage est écrit, et il est à toi

Le ticket demandait de trancher **fonction SQL `SECURITY DEFINER` contre
séquence** avant de coder. J'ai tranché pour la séquence, et voici pourquoi
plutôt que l'inverse :

- **La transaction reste la bonne réponse**, et elle n'est pas prenable
  aujourd'hui. Elle demande une migration, et **aucune migration ne peut être
  jouée** (03, 04 et 05 attendent déjà). Un `actions.ts` qui appellerait une
  fonction inexistante ne rendrait pas le renommage silencieux : il le rendrait
  **cassé en production**. On ne remplace pas un mensonge par une panne.
- **Le patron de la séquence était déjà tranché dans ce fichier** :
  `_fusionnerLabels` l'applique depuis longtemps — arrêt à la première panne,
  nom de l'étape, **liste maîtresse en dernier pour qu'un arrêt soit
  relançable**. Il n'y avait pas une architecture à inventer, il y en avait une
  à étendre aux trois autres chemins qui ne l'avaient pas.

C'est un arbitrage : **si tu préfères la fonction SQL, elle se pose par-dessus**
— `lib/cascade.ts` est le seul endroit à remplacer, et sa condition d'entrée est
écrite dans son en-tête (une base joignable). Rien d'autre ne bouge.

**`lib/cascade.ts`** est un module **pur** : aucune directive, aucun import,
aucune trace de Supabase. Ce n'est pas de l'élégance, c'est ce qui le rend
**jouable hors ligne** — `actions.ts` porte `"use server"` et ouvre une connexion
au chargement, donc rien de ce fichier ne peut tourner dans un harnais. La
propriété qui porte tout le ticket est donc **exécutée**, pas racontée.

**Quatre** cascades y passent, pas deux : `renameLabel`, `deleteLabel`, et —
trouvées au passage, même défaut, même fichier, et le code disait lui-même
« MÊME PATRON QUE createLabel/renameLabel/deleteLabel » — `renameConversionCategory`
et `deleteConversionCategory`.

**Un défaut de plus, corrigé dans le même geste, et il était pire que le
silence** : `renameLabel` et `deleteLabel` construisaient l'écriture de
`profiles.labels` sur une lecture **non vérifiée**. `_labels` replie un SELECT
en échec sur `[]` — un `[].map(…)` ou `[].filter(…)` reste `[]`, donc une
lecture ratée **effaçait tous les thèmes du compte** en croyant en renommer un.
La liste est maintenant relue, vérifiée, **dans l'étape qui l'écrit**.

**Et l'ordre de `renameConversionCategory` était à l'envers** : la liste
maîtresse d'abord, la propagation ensuite. Un arrêt y était
**irrattrapable** — plus aucune ligne ne répondait à `name = oldName`, donc
relancer ne pouvait plus finir le travail. Les événements passent devant.

### 2 · Famille 1 — le compte de lignes

`changerRoleMembre` et `revoquerMembre` portent la garde de
[02](02-garde-de-collision-resolveaction.md) : `.select("id")` **et** le
traitement du zéro ligne. Les deux vont ensemble — c'est la leçon déjà écrite
en 02, `.in(…)` sans `.select(…)` remplace un écrasement silencieux par un refus
silencieux.

Le message **nomme l'état, jamais une personne** (ADR 0004) et ne l'invente pas :
zéro ligne sur une invitation visée par son identifiant veut dire qu'elle n'est
plus là, c'est tout ce qui est affirmé. Sur un retrait d'accès, le résultat voulu
EST atteint — on le dit quand même (« Cet accès avait déjà été retiré »), parce
que s'en attribuer le mérite laisserait la liste à l'écran fausse sans un mot.

**`deleteNote` n'a pas été touchée** : [12](12-le-carnet-et-la-mort-de-preuve.md)
l'a déjà faite, avec `filtreAuteur`, `.select("id")` et `pourquoiRien`. Le ticket
demandait de la traiter « d'un seul geste, pas deux fois » — c'est respecté en ne
la retouchant pas.

**`startTracking` (toggle off) s'est ajoutée à la famille** : un `delete` ciblé
dont le résultat n'était pas capturé. Elle **relit** avant de parler et
**réutilise la table `DEJA` de 02** ; et quand la ligne a simplement disparu —
l'état voulu est atteint — elle répond `ok` au lieu de se plaindre.

### 3 · Famille 2 — le refus invisible

`saveObjectif` compte ses lignes, et `profilMuet` **relit** pour dire lequel des
deux cas s'est produit : `partage_select` ouvre `profiles` à tout membre
(`a_acces`) quand `partage_update` réserve l'écriture aux « Peut agir »
(`peut_editer`) — un profil **lisible mais non écrit** est un refus d'écriture,
un profil **illisible** est un compte qu'on ne regarde plus. Les deux se lisent,
ils ne se devinent pas (§7).

`compte.peutEditer`, juste au-dessus, ne suffisait pas : il lit **l'écran**, pas
la base. Les deux divergent dès qu'un rôle change pendant qu'une page est
ouverte, ou si la section 15 du SQL n'est pas jouée sur ce projet.

**`createLabel` l'a rejointe** : même table, même mensonge, une ligne pour le
corriger — et la même lecture non vérifiée que `renameLabel`, qui aurait réduit
la liste des thèmes au seul qu'on venait de créer.

### 4 · Ce que le ticket demandait de ne PAS faire, et qui n'a pas été fait

**« Ne pas tout convertir mécaniquement. »** Aucun compte de lignes n'a été
ajouté sur un `upsert` : il en écrit toujours une, le compte n'y apprend rien.
Ce qui a été ajouté là, c'est la lecture de l'**erreur** — un refus RLS sur une
**insertion**, lui, lève bien une erreur, contrairement à l'UPDATE du §8, et
`saveBudget` affichait « ✓ enregistré » par-dessus.

**Les replis ne mentent plus non plus.** **Six** secondes chances étaient nues —
`saveRecoFeedback` (deux), `saveComment`, `setCampaignLabel` (deux),
`setPostLabel` : les **deux** tentatives pouvaient rater et l'action répondait
`{ ok: true }`.

**Le compte des 30, réparti** : 7 dans `renameLabel`, 6 dans `deleteLabel`, 6
replis, 2 dans `saveInsightFeedback` (elle n'avait **aucun** repli et ne
regardait rien du tout), et une chacune dans `startTracking`,
`togglePriorityLabel`, `saveObjectif`, `saveBudget`, `createLabel`,
`renameConversionCategory` et `deleteConversionCategory`. **28 converties, 2
restantes.**

### 5 · Les deux écritures nues qui restent, et pourquoi

Elles ne sont pas un reste de travail : elles sont **écrites comme telles dans le
code**, pour que personne ne les « répare » en croyant bien faire.

- **Le repli de `marquerApplique`.** Le geste du client — « c'est fait » — est
  **déjà enregistré** dans `suivi_actions` quand on y arrive ; cette ligne ne
  fait que le répéter à l'IA. La faire échouer rendrait `{ ok: false }` sur une
  action bel et bien prise, et le client recliquerait sur un geste déjà écrit. Ce
  qui se perd est réel — l'IA ignorera ce conseil-là — mais moins cher qu'un
  « ça n'a pas marché » qui serait faux.
- **L'amorce de persona de l'onboarding.** Le profil déclaré est déjà écrit
  au-dessus, avec son erreur lue. Cette amorce est écrasée dès le premier persona
  appris : la perdre ne fait rater aucune inscription, rendre l'onboarding rouge
  pour elle en ferait rater.

Le harnais **épingle ce chiffre à 2** et vérifie que ce sont ces deux-là : c'est
ce qui empêche une trente et unième d'arriver en silence.

### 6 · Ce que la revue a trouvé, et que la relecture avait manqué

**Le dernier maillon de chaque cascade portait encore le piège à lui seul.**
L'étape qui écrit la liste maîtresse ne rendait que son `.error` : un refus RLS
sur `profiles` touche zéro ligne **sans erreur**, donc `enchainer` voyait sept
étapes vertes et l'écran disait « renommé partout » alors que la liste n'avait
pas bougé. Le défaut que ce ticket existe pour corriger, survivant **dans sa
propre correction** — et invisible à la relecture parce que le bloc *avait* l'air
soigné (il vérifiait déjà la lecture, il manquait le compte de l'écriture).

Les **quatre** étapes maîtresses comptent maintenant leurs lignes, et le refus
se dit **autrement qu'un arrêt technique** — ce que seul l'ordre des étapes
permet : la liste maîtresse étant la dernière, **tout le reste EST écrit** quand
on arrive là, et le message le dit au lieu de faire relancer une cascade déjà
faite aux trois quarts.

**Et les deux cascades de catégories pouvaient être des no-op complets** :
`renameConversionCategory` visant une catégorie qu'un autre onglet venait de
renommer touchait zéro ligne à chaque étape, sans erreur, et répondait
« Renommée en « X » partout ». `categorieMuette` **relit** pour distinguer
« aucune catégorie ne s'appelle plus comme ça » de « l'écriture a été refusée » —
les deux n'appellent pas le même geste, et aucun des deux ne se devine (§7).

**Quatre autres défauts trouvés par la même revue ne sont PAS de ce ticket** :
ils vivent dans du travail **non commité** porté par un autre chantier
(`lib/couts.ts`, `bandeau-commandes.tsx`, `prototype-switcher.tsx`). Ils ne sont
pas corrigés — on ne travaille pas à deux sur les mêmes fichiers (§5) — mais ils
sont écrits : ticket **[46](46-la-periode-de-couts-peut-s-inverser.md)**, dont
le premier affiche une courbe vide et des totaux à zéro sur une fenêtre à
l'envers.

### 7 · Ce qui a été trouvé et qui n'est PAS corrigé ici

**Renommer un thème lui fait perdre son étoile** → ticket
**[45](45-renommer-un-theme-lui-fait-perdre-son-etoile.md)**, ouvert avec la
mesure. L'étoile est une **clé** `priority_label:<nom>` : le renommage simple ne
la propage pas (la fusion, si), et la suppression ne la retire pas. Deux
conséquences qui touchent `CLAUDE.md` §1 — un thème renommé **perd ses
conseils**, un thème effacé **consomme en silence une des trois places**. Ça
n'entre pas ici : c'est un comportement qui change, pas une vigilance qu'on
ajoute.

### 8 · Vérifié, et non vérifié

**Vérifié** : `rm -rf .next tsconfig.tsbuildinfo`, `npx tsc --noEmit` (aucune
sortie), `npm run build` vert, **19 routes**, `git grep controle-` propre.
Harnais [19-ecritures](../harnais/19-ecritures/LISEZMOI.md) : **117** contrôles
de structure + **23** joués pour de bon sur `lib/cascade.ts` importé tel quel.
**Trois d'entre eux mis à l'épreuve par mutation** — remettre la liste maîtresse
en tête de `deleteLabel`, retirer le `.select("id")` de `revoquerMembre`, retirer
le compte de lignes de l'étape maîtresse de `renameConversionCategory` : chacun
fait rougir le harnais. Rejoués verts : 12 (178), 13 (77), 16 (301), 17 (47),
18 (18), 43 (18).

**Non vérifié — et c'est la limite qui compte.** Aucune collision réelle, aucun
refus RLS réel, aucune cascade réellement interrompue.

**Le risque propre à ce ticket, nommé et écarté sur pièce.** Ajouter
`.select(…)` à un `update`/`delete` fait appliquer la politique de **SELECT** aux
lignes visées : une politique de SELECT plus étroite que celle d'UPDATE
**empêcherait** une écriture qui passait avant — ma correction casserait ce
qu'elle prétend surveiller. Ce n'est pas le cas ici, et c'est **lu dans le SQL**
(§12 de `000_run_me_all.sql`) : `peut_editer(cible)` est **exactement**
`a_acces(cible)` plus `AND m.role = 'editor'`, donc sur `profiles` tout ce qui
passe `partage_update` passe `partage_select` ; et sur `dashboard_members`,
`dm_delete`/`dm_update` visent `owner_id = auth.uid()`, que `dm_select` couvre.
**Aucune des deux requêtes n'a été jouée pour autant.** Ça se mesure à deux
onglets connectés, et seulement comme ça.

**Rien de tout ceci ne se voit en cliquant sans passage du worker ?** Si, au
contraire, et c'est l'exception : ces corrections sont **entièrement côté web**.
Elles se voient **tout de suite**, au prochain déploiement — aucun passage de
`weekly-fetch.yml` n'est nécessaire, ni cron ni lancement à la main.
