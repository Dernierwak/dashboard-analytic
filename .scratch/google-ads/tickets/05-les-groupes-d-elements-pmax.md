# 05: Les Groupes d'éléments PMax

**Status:** ready-for-agent

**Blocked by:** 04

**What to build:** une campagne Performance Max se déplie dans le Tableau en ses
**Groupes d'éléments**, avec leurs chiffres jour par jour, et rien en dessous.
Le client voit enfin comment son PMax est organisé, sans fausses annonces.

Spec : § Les colonnes et tables nouvelles (Groupes d'éléments), § Tableau
détaillé. Google ne rend aucune ligne PMax dans `ad_group_ad`, sans erreur
(tickets 01, 10 de la carte).

- [ ] Table additive Groupe d'éléments × jour (campagne, ID et nom du groupe, impressions, clics, coût, conversions, valeur), RLS `*_own`, recouvrement de 30 jours comme les autres tables par jour.
- [ ] Harnais récolte : chaque groupe rattaché à sa campagne par l'ID ; un jour omis n'est pas écrit à 0.
- [ ] Le Tableau déplie PMax en Groupes d'éléments, sans niveau en dessous ; harnais page mis à jour.
- [ ] Le vocabulaire « Groupe d'éléments » (`CONTEXT.md`) est celui de l'écran.
- [ ] `py_compile`, `tsc`, `build` verts, 18 routes. Visible après un passage du worker (`force`) — le dire.
