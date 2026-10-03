# 11: Les changements posés sur la Tendance

Type: task
Status: ready-for-agent
Blocked by: 04, 06

**What to build:** le client relie une variation de la courbe à ce qu'il a changé
dans son compte : un petit point les jours où quelque chose a bougé, et un clic qui
ouvre, dans le Panneau latéral, tous les changements de ce jour. Ce ticket
construit le **Panneau latéral** que le ticket 12 réutilisera. Spec : § « Le
journal des changements », § « L'état de la page vit dans l'URL » ; user stories
22 à 26, 44 à 46.

- [ ] Un point par jour (pas par changement), discret et de couleur, sur la courbe
      principale ; il grossit au survol
- [ ] Un clic ouvre le Panneau latéral : les changements du jour rangés par
      campagne, chacun avec son heure, sa nature, sa phrase et l'élément touché
- [ ] Sous un filtre campagne, points et panneau ne montrent que cette campagne,
      ses groupes et ses annonces compris (testé) ; un élément dont la campagne est
      inconnue n'apparaît que sans filtre, et le panneau filtré le compte en une ligne
- [ ] L'info-bulle « ⓘ » de la légende dit ce que le journal ne couvre pas — et
      nulle part ailleurs
- [ ] Un seul panneau à droite ; le jour ouvert vit dans l'URL (`jour`) ; un jour
      hors de la période ne s'ouvre pas ; « retour » referme
- [ ] `tsc --noEmit` et `npm run build` verts, 19 routes
