# 09: Les Groupes de termes, mode Mots-clés

**Status:** ready-for-agent

**Blocked by:** 02

**What to build:** en bas de la page, le client voit ce que les gens ont tapé
avant de voir ses annonces Search : les termes de recherche en **graphe en
grappes**, rangés sous leur Mot-clé déclencheur, avec clics, impressions,
conversions et coût. Il filtre par campagne Search, ouvre la fiche d'une grappe
terme par terme et voit la part des clics masquée par Google.

Spec : § Les colonnes et tables nouvelles (termes de recherche), § Groupes de
termes. Décision : ticket 21 de la carte (prototype sur la branche jetable
`prototype/groupes-de-termes`, `87a4b5c`, référence visuelle seulement).

- [ ] Table additive Terme de recherche × jour (campagne, groupe d'annonces, terme, mot-clé déclencheur et son type de correspondance, type d'appariement, impressions, clics, coût, conversions), lue dans `search_term_view`, pagination au-delà de 10 000 ; aucune normalisation maison des termes.
- [ ] Le mode suit la période du Bandeau ; une campagne Search choisie au Bandeau préremplit le filtre ; « Toutes les campagnes » compris.
- [ ] Graphe : un rond par mot-clé, ses termes reliés autour ; 8 couleurs aux plus gros, le reste gris ; taille au choix, clics par défaut.
- [ ] Toujours plusieurs métriques : ligne de totaux, fiche de la grappe avec « Masqués par Google », classement clics · conversions · coût.
- [ ] Part masquée = total de la campagne (`google_ads_insights`) − somme des termes ; harnais page.
- [ ] Aucun « mauvais », aucun « à supprimer ». Sans campagne Search, une phrase remplace le module.
- [ ] Mode, campagne et taille dans l'URL.
- [ ] `py_compile`, `tsc`, `build` verts, 18 routes. Visible après un passage du worker (`force`) — le dire.
