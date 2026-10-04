# 11: Les changements posés sur la Tendance

Type: task
Status: ready-for-human
Blocked by: 04, 06

**What to build:** le client relie une variation de la courbe à ce qu'il a changé
dans son compte : un petit point les jours où quelque chose a bougé, et un clic qui
ouvre, dans le Panneau latéral, tous les changements de ce jour. Ce ticket
construit le **Panneau latéral** que le ticket 12 réutilisera. Spec : § « Le
journal des changements », § « L'état de la page vit dans l'URL » ; user stories
22 à 26, 44 à 46.

- [x] Un point par jour (pas par changement), discret et de couleur, sur la courbe
      principale ; il grossit au survol
- [x] Un clic ouvre le Panneau latéral : les changements du jour rangés par
      campagne, chacun avec son heure, sa nature, sa phrase et l'élément touché
- [x] Sous un filtre campagne, points et panneau ne montrent que cette campagne,
      ses groupes et ses annonces compris (testé) ; un élément dont la campagne est
      inconnue n'apparaît que sans filtre, et le panneau filtré le compte en une ligne
- [x] L'info-bulle « ⓘ » de la légende dit ce que le journal ne couvre pas — et
      nulle part ailleurs
- [x] Un seul panneau à droite ; le jour ouvert vit dans l'URL (`jour`) ; un jour
      hors de la période ne s'ouvre pas ; « retour » referme
- [x] `tsc --noEmit` et `npm run build` verts, 19 routes

## Comments

**2026-10-03 — construit et vérifié hors ligne. Reste à le voir sur la vraie
base.** Commits `27e1c05` puis la correction de revue, branche
`worktree-meta-ads-tickets-construction`.

Ce qui a été fait :
- `saas/web/lib/meta/changements.ts` — le seam, pur : `changementDe` (ligne de
  `platform_changes` → changement, jour et heure en UTC), `joursMarques` (un
  point par jour, filtré par l'ID), `jourOuvertDe` (le `jour` de l'URL, s'il
  est dans la période), `panneauDuJour` (rangé par campagne dans l'ordre du
  Bandeau, sous le nom le plus récent ; la campagne non retrouvée en dernier ;
  sous filtre, les non rattachés comptés).
- `lib/meta/donnees.ts` lit `platform_changes` (canal `meta`, la période
  seulement, paginé, ordre total `occurred_at, change_id`). Une lecture en
  échec rend `null`, et la légende dit « le journal n'a pas pu être lu »
  plutôt que de montrer une courbe sans point.
- `components/courbe.tsx` (brique neutre) gagne des **repères** : un point
  orange posé sur la série principale (sur l'axe un jour vide, comme au
  prototype), de vrais boutons pour le clavier, cliquables sur toute la
  hauteur du jour, qui grossissent au survol ; la bulle dit « 4 changements ·
  clique pour les voir ».
- `components/meta/panneau.tsx` — **le Panneau latéral**, sans état à lui :
  il existe tant que l'URL porte `jour`. Ouvrir est un `push` (« retour »
  referme), fermer un `replace` ; Échap et le voile ferment. Le ticket 12 le
  réutilise avec `annonce` et doit écrire `jour: null` en l'ouvrant.
  `components/meta/journal-du-jour.tsx` en est le contenu d'un jour.
- La légende de la Tendance porte « ● Un changement dans ton compte ⓘ » ; le
  « ⓘ » est un bouton qui déplie le texte (clavier et toucher), seul endroit
  où la couverture du journal est dite. Sa liste suit `_ACTIVITES` de la
  récolte et doit changer avec elle.

**L'élément touché** n'a pas de colonne dans `platform_changes` : c'est la
phrase qui le nomme (« le budget de l'ensemble "Acheteurs" … »), et
`_traduire_meta` n'écrit aucune ligne sans nom d'objet. Le panneau n'ajoute
donc pas de ligne « élément » qui répéterait la phrase.

**L'orange du point** : celui du prototype (`#ff7a45`) échoue au validateur
`dataviz` (2,52:1 sur fond blanc) ; `#e8590c` passe les six contrôles à côté
du bleu. Il vit dans `lib/palette.ts` (`ORANGE_REPERE`).

**Harnais** : `.scratch/meta-ads/harnais/11-les-changements/changements.test.ts`,
14 tests, lancé par
`node --import ./.scratch/meta-ads/harnais/09-le-tableau/resoudre.mjs --test .scratch/meta-ads/harnais/11-les-changements/changements.test.ts`.
Dont : UTC quel que soit l'offset écrit, un point par jour qui compte ses
changements, hors période → aucun point, filtre = changements de groupe et
d'annonce de la campagne, campagne inconnue visible seulement sans filtre et
comptée sous filtre, clé `sans-id:` qui n'attrape rien par le nom, nom le plus
récent et pastille du Bandeau, jour hors période / jour en cours / 30 février
refusés, lien qui ne touche que `jour` et retire `annonce`. Les cinq harnais
Meta (06, 07, 08, 09, 11) : 103 tests verts. `tsc --noEmit` et `npm run build`
verts, **19 routes**.

**Vu dans Chrome** sur une page de contrôle temporaire nourrie de lignes
fabriquées (supprimée, `git grep controle-` propre) : les trois points, le
point sur l'axe un jour vide, le point qui grossit et la bulle, le panneau sans
filtre (trois campagnes, « Campagne non retrouvée » en dernier) et filtré (une
campagne, la ligne qui compte l'autre), jour hors période et date illisible qui
n'ouvrent rien. **Pas vu** : le clic qui navigue vers `/meta?jour=…` et
« retour » (la page de contrôle n'a pas de session ; la logique est le lien
testé + `push`/`replace`), la largeur téléphone, de vraies données.

Revue `/code-review` (deux axes) : corrigés — l'orange recopié en dur dans la
légende, la fermeture du panneau écrite deux fois, la nature « Mot-clé » qui
n'existe pas chez Meta, le « ⓘ » réservé à la souris. Laissés, en le sachant :
- fermer par la croix puis faire « retour » laisse une entrée d'historique
  identique (sans effet visible) ;
- sous un filtre, un jour qui n'a que des changements non rattachés ne porte
  pas de point : le compte n'apparaît qu'en ouvrant ce jour.

**Trouvé en chemin** → ticket **16** (les phrases disent « l'ensemble », pas
« groupe d'annonces ») et ticket **17** (les jours sont découpés en UTC ; les
insights sont au fuseau du compte : un geste fait entre minuit et 2 h à Zurich
se pose la veille. L'écran écrit « UTC » en attendant).

**Pour David** : aucun passage du worker n'est nécessaire — les changements
Meta sont déjà en base (`platform_changes`). Une fois la branche déployée,
ouvrir `/meta`, cliquer un point orange, faire « retour ». Les changements de
groupe ou d'annonce ne se rangent sous leur campagne (et ne passent le filtre)
qu'après le passage du ticket 04.
