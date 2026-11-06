# 10: L'Objectif et « Tes posts face à ton année »

**What to build:** le client choisit une période et un Objectif (Portée,
Engagement, Abonnés) puis une métrique, et voit chaque format en rangée : le
nuage des posts de la période posé sur la bande 25-75 % de ses 12 derniers
mois, les moustaches pesées 12 / 3 / 1 mois, les pastilles d'évolution.

Spec : § La page — Bandeau de commandes (la période), Sélecteur de vue,
« Tes posts face à ton année » (sauf la liste des 5 meilleurs, 11) ; § La
lecture, lignes « 3 mois, 1 mois » ; User Stories 11 à 18 et 22.

**Blocked by:** 09

**Status:** ready-for-agent

- [ ] Valeurs à l'ouverture : Engagement / taux, période comme Meta
      (`periodeDe`).
- [ ] Rangées en ordre fixe ; format sans post sur 12 mois → pas de rangée ;
      sans post sur la période → bande et « aucun post sur la période ».
- [ ] En-tête : post type et `n`, total pour ce qui se compte, « x sur n » ;
      pastilles 3 mois / 1 mois signées avec leur nombre de posts, aucune
      sous 6, en valeur quand le post type des 12 mois vaut 0.
- [ ] Moustaches pesées (largeur et encre selon `n`), valeurs écrites,
      hors norme comptés sans étirer l'axe, « 5 / 6 posts » sous 6 ; le Reel
      en Abonnés reçoit une phrase, jamais une moustache à zéro.
- [ ] La ligne de référence, et sa version partielle (« tes posts du … au …
      (n) ») ; changer la période ne bouge pas les quartiles (harnais).
- [ ] Une métrique pas encore en base est grisée avec sa raison.
- [ ] `tsc` et `build` verts.
