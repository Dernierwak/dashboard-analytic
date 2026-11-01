# 06: Les changements sur la carte du canal

**What to build:** à droite de la carte Meta, le client voit les changements
que la plateforme a enregistrés cette semaine, rangés par catégorie
(« Budget · 3 »…), avec pour chacun le jour, la campagne et le résumé. La
liste défile à la hauteur de la carte. Un lien « journal → » ouvre le
journal sur la même semaine. Il distingue « Meta n'a écrit aucun
changement cette semaine » de « Changements en cours de récupération ».

**Blocked by:** 03 (la couverture du journal), 05 (la carte)

**Status:** ready-for-agent

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
