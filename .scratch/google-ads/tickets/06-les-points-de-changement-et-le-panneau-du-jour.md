# 06: Les points de changement et le Panneau du jour

**Status:** ready-for-agent

**Blocked by:** 01

**What to build:** sur la courbe principale de la Tendance, un petit point marque
chaque jour où quelque chose a changé dans le compte Google Ads. Un clic ouvre
le Panneau latéral avec les changements du jour, rangés par campagne. Une « ⓘ »
sur la légende dit depuis quand le journal existe et ce qu'il garde.

Spec : § Panneau latéral (le jour), § La récolte (journal). Décision : ticket
12 de la carte. Le journal `change_event` est déjà récolté dans
`platform_changes`.

- [ ] Un point par jour (pas par changement), qui grossit au survol ; clic → panneau du jour ; jour dans l'URL ; un jour hors période ne s'ouvre pas.
- [ ] Filtré par campagne quand le Bandeau en a une, groupes et annonces compris ; un élément dont la campagne est inconnue n'apparaît que sans filtre.
- [ ] La liste des catégories gardées pour Google est écrite à côté de la récolte et reprise mot pour mot par la « ⓘ », avec la date de début du journal (première récolte − 30 jours).
- [ ] Un seul panneau à la fois ; ouvrir un jour retire l'annonce de l'URL, rien d'autre.
- [ ] Harnais page : points par jour, filtre campagne, jour hors période refusé.
- [ ] `tsc`, `build` verts, 18 routes ; vérifié dans Chrome.
