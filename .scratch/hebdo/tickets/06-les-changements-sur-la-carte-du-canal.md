# 06: Les changements sur la carte du canal

**What to build:** à droite de la carte Meta, le client voit les changements
que la plateforme a enregistrés cette semaine, rangés par catégorie
(« Budget · 3 »…), avec pour chacun le jour, la campagne et le résumé. La
liste défile à la hauteur de la carte. Un lien « journal → » ouvre le
journal sur la même semaine. Il distingue « Meta n'a écrit aucun
changement cette semaine » de « Changements en cours de récupération ».

**Blocked by:** 03 (la couverture du journal), 05 (la carte)

**Status:** resolved

**Références :** [spec](../spec.md) — Le payload (`canaux.changements`),
tableau des états (journal non couvert, hors campagne) ; tickets de la
carte 05, 13 (points 8, 11), 14 (§5).

- [ ] Le `Lecteur` lit le journal des changements restreint à la semaine.
- [ ] Le payload porte `canaux[canal].changements[]` : `occurred_at` dans la
      semaine au fuseau de la ligne ; jour, catégorie (budget, enchère,
      audience, créatif, objectif, mot-clé, diffusion, calendrier, autre),
      `campaign_id`, nom de campagne, `objet`, `resume`.
- [ ] Hors campagne : « Compte publicitaire » au niveau du compte, sinon le
      nom de l'objet ; jamais « Hors campagne ».
- [ ] Journal non couvert → « Changements en cours de récupération », sans
      compte ; journal couvert et vide → « Meta n'a écrit aucun changement
      cette semaine ».
- [ ] La liste utilise le composant de liste défilante existant.
- [ ] L'ancien bloc des changements (déduits de la dépense) et la lecture
      séparée des changements par API quittent la page ; le module de
      lecture par API reste (les pages plateformes le lisent).
- [ ] Harnais : semaine avec changements, journal non couvert, vrai 0,
      changement de niveau compte.
- [ ] `tsc` et `build` verts, 18 routes ; visible en ligne après un passage
      du worker (`report_only`).

## Réponse (2026-11-01)

`blocs/changements.py` : changements de la semaine au fuseau de la ligne, catégories de la spec (`statut`/`creation` → `autre`, décision du coordinateur). `changements-canal.tsx` dans la liste défilante, « journal → » vers `/meta?from&to&panneau=changements`, « en cours de récupération » vs vrai 0. Ancien bloc et lecture par API quittent la page. Harnais 06. Note : « Compte publicitaire » ne peut pas se déclencher aujourd'hui (le CHECK `niveau` n'admet pas le compte).

Vérifié hors ligne sur la branche d'intégration `worktree-hebdo-carte` (870963f) : les 13 harnais de `.scratch/hebdo/harnais/` et les `rendu.js` 07/08 tiennent, `py_compile`, `tsc` et `build` verts, 18 routes. **Pas vu en ligne** : le contrôle après passage du worker est le ticket 11.
