# 10: Les Groupes de termes, mode Clusters Google

**Status:** ready-for-agent

**Blocked by:** 09

**What to build:** un sélecteur **Mots-clés | Clusters Google** en tête du
module. En mode Clusters, les mêmes termes se rangent sous les groupes que
Google forme ; le coût s'écrit « — » et le réglage de taille Coût est barré.
« Sans cluster » et « N petits clusters » (≤ 5 clics) sont hachurés, en
dernier, avec leur raison.

Spec : § Les colonnes et tables nouvelles (clusters), § Groupes de termes,
§ Further Notes 1 et 2 (choix par défaut). Faits d'API : ticket 19 de la carte.

- [ ] Récolte par campagne Search (`campaign_search_term_insight`, une campagne par requête) et au niveau compte (`customer_search_term_insight`), **fenêtre agrégée des 90 derniers jours pleins**, sans `segments.date`, relue en entier à chaque passage ; cluster (`id`, libellé), impressions, clics, conversions, termes listés.
- [ ] Harnais récolte : aucun coût écrit ; fourre-tout au libellé vide conservé.
- [ ] Le module écrit sa fenêtre de 90 jours quand elle diffère de la période du Bandeau.
- [ ] « Toutes les campagnes » lit le niveau compte et dit qu'il mêle Search et PMax, sans comparaison avec le mode Mots-clés.
- [ ] Un terme rangé dans deux clusters relie les deux grappes ; part masquée = total du cluster − termes listés ; une phrase dit qu'un sujet peut faire un cluster par langue.
- [ ] Harnais page : coût « — », petits clusters regroupés, fourre-tout, terme dans deux grappes.
- [ ] `py_compile`, `tsc`, `build` verts, 18 routes. Visible après un passage du worker — le dire.
