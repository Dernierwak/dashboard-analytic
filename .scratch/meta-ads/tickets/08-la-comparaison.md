# 08: La Comparaison

Type: task
Status: ready-for-agent
Blocked by: 06

**What to build:** le client compare ses groupes d'annonces ou ses annonces entre
eux — qui fait mieux que qui, et comment ça évolue. Mise en page **C2** : la liste
en haut sur deux colonnes, les deux graphes côte à côte dessous (choix par défaut
de la spec, que David peut renverser). Spec : § « Comparaison — la mécanique » ;
user stories 29 à 33, 35, 36.

La cible « Lire » n'est **pas** dans ce ticket (ticket 12). La bande « créas
comparées » ne se construit pas.

- [ ] Bascule entre groupes d'annonces et annonces
- [ ] Liste classée par la métrique 1 — décroissante, croissante pour un coût ;
      vignette pour une annonce, une barre et les deux valeurs
- [ ] L'élément sans valeur pour la métrique de classement se range en bas avec
      « — » (testé)
- [ ] Jusqu'à 4 éléments cochés, tracés dans deux graphes, un par métrique ; la
      5ᵉ case se refuse **visiblement**, sans en décocher une autre
- [ ] Choisir pour une métrique celle de l'autre les échange
- [ ] Deux annonces homonymes restent deux lignes (testé)
- [ ] Niveau, métriques et éléments cochés vivent dans l'URL
- [ ] `tsc --noEmit` et `npm run build` verts, 19 routes
