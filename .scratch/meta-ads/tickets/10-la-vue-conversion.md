# 10: La vue Conversion

Type: task
Status: ready-for-agent
Blocked by: 03, 08, 09

**What to build:** le client sait ce que ses campagnes rapportent en actions — le
même nombre que la colonne « Résultats » de son Ads Manager — et ne lit jamais un
total qui additionne des choses différentes. La troisième carte du Sélecteur
apparaît, et la Tendance, la Comparaison et le Tableau se reconfigurent avec elle.
Spec : § « Les conversions » ; user stories 16, 18, 52 à 56.

**Ce ticket part de la base, pas de la doc** : la forme réelle de `results`
(recopiée au ticket 03), ce qu'il rend pour une campagne de notoriété, et l'effet
de la fenêtre d'attribution se lisent dans les lignes récoltées avant d'écrire
l'affichage.

- [ ] Vue Conversion : résultats, coût par résultat, taux de conversion
      (résultats ÷ **tous les clics** × 100, dénominateur écrit à l'écran)
- [ ] Une campagne de notoriété affiche « — », jamais « 0 » (testé)
- [ ] Le type du résultat voyage avec son nombre ; des types différents ne
      s'additionnent pas — le total affiche « — » et l'info-bulle dit pourquoi (testé)
- [ ] Une annonce sans résultat rendu affiche « — » (testé)
- [ ] L'info-bulle « ⓘ » des conversions dit le réglage d'attribution ; une
      sélection qui en mélange plusieurs l'écrit à l'endroit du chiffre
- [ ] Toutes les campagnes restent présentes dans la vue
- [ ] Aucune jointure GA4, aucun chiffre d'une autre plateforme (ADR 0010)
- [ ] `tsc --noEmit` et `npm run build` verts, 19 routes
