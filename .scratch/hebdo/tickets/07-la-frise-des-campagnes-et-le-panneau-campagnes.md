# 07: La frise des campagnes et le panneau Campagnes

**What to build:** sous le module des canaux, le bloc « Ce qui a été fait ».
À gauche, la frise de l'année : les campagnes groupées par plateforme,
une barre par campagne sous son nom actuel, zoom Année · Mois (Mois à
l'ouverture). Le trait est plein jusqu'à la fin déclarée ; une campagne
vivante sans fin va en pointillés de la fin de la semaine du rapport
jusqu'au 31 décembre. Un filtre léger par statut garde tout visible par
défaut. La frise choisit la semaine (clic, ‹ ›, « revenir à la semaine
mesurée »). À droite, collant, le panneau de la semaine choisie, onglet
Campagnes : des cartes avec visuel ou « pas de visuel », nom, dates,
« lancée / terminée cette semaine » et dépense de la semaine au survol.

**Blocked by:** 01 (la semaine)

**Status:** resolved

**Références :** [spec](../spec.md) — Le payload (`frise.campagnes`, statut
d'une campagne), La page (« Ce qui a été fait »), tableau des états
(`WITH_ISSUES`, semaine vide) ; tickets de la carte 04, 08, 13 (points 9,
10), 14 (§6), 17.

- [ ] Le payload porte `frise.annee` (l'année de `semaine.fin`, une seule)
      et `frise.campagnes[]` : `id`, `plateforme`, `nom` actuel, `debut`,
      `fin`, `fin_declaree`, `statut`, `visuels` (créas des annonces par
      dépense décroissante, sans doublon, 4 au plus ; rien pour Google),
      `depense_par_semaine` (chaque semaine calée sur le Jour de travail).
- [ ] Identité par ID : harnais, deux homonymes → deux barres, une
      renommée → une barre.
- [ ] Entrée dans l'année : a dépensé dans l'année, ou ses dates déclarées
      la touchent ; une fin non déclarée seule ne suffit pas.
- [ ] Statut, dans cet ordre : `REMOVED` → `supprimee` ; fin déclarée
      passée → `terminee` ; `WITH_ISSUES` → `probleme` (« problème signalé
      par Meta ») ; `ACTIVE`/`ENABLED` → `en_cours` ; `PAUSED` →
      `en_pause` ; début déclaré futur → `prevue` ; non récolté → absent
      (« statut inconnu »). Une barre par campagne, sans pause dessinée.
- [ ] Fin d'une supprimée, ici : le dernier jour de dépense, sinon un
      repère au début (la date structurée vient au ticket 09).
- [ ] Le panneau a ses onglets Organique · Campagnes ; l'onglet Campagnes
      vide dit « Aucune campagne active cette semaine », « … en cours de
      récupération », ou « Meta n'était pas encore connecté » avant la
      connexion.
- [ ] L'ancienne frise de la semaine quitte la page ; la table des icônes
      de plateforme en sort d'abord, dans un module **sans** `"use
      client"`.
- [ ] Un payload sans `frise` à la nouvelle forme ne casse pas la page.
- [ ] `tsc` et `build` verts, 18 routes ; visible en ligne après un passage
      du worker (`report_only`).

## Réponse (2026-11-01)

`blocs/frise.py` : campagnes de l'année par ID, nom actuel, statut dans l'ordre de la spec, visuels ≤ 4, dépense par semaine ; plateformes débranchées exclues (revue). Frise Année·Mois, panneau collant, onglet Campagnes (`frise-et-panneau`, `frise-annee`, `panneau-semaine`, `panneau-campagnes`). Harnais 07 + `rendu.js`.

Vérifié hors ligne sur la branche d'intégration `worktree-hebdo-carte` (870963f) : les 13 harnais de `.scratch/hebdo/harnais/` et les `rendu.js` 07/08 tiennent, `py_compile`, `tsc` et `build` verts, 18 routes. **Pas vu en ligne** : le contrôle après passage du worker est le ticket 11.
