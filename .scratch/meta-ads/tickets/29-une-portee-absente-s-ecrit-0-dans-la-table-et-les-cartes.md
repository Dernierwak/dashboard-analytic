# 29: Une portée absente s'écrit « 0 » dans la table et les cartes

Type: task
Status: needs-triage
Blocked by: —

**Trouvé en chemin** du ticket 28, pas demandé — `CLAUDE.md` §4.4.

Le 28 a tranché qu'une portée de 0 sur une publication est une mesure absente
(`porteeRelevee`, `saas/web/lib/channels.ts` : la récolte écrit 0 pour ce que
l'API n'a pas rendu). La moyenne en tient compte ; l'affichage, non :

- `PostsTable` (`app/instagram/page.tsx`) écrit `fmtCHF(p.reach)` → « 0 »,
  alors que la colonne Vues voisine écrit « — » pour le même cas ;
- les cartes du top 3 écrivent « 0 portée » ;
- le tri par portée range une portée absente comme la plus faible au lieu de
  la mettre en fin (`trierDecroissant` sait le faire si `valeurDe` rend `null`).

À regarder aussi : les sommes de la Comparaison et de la frise Instagram
additionnent ce 0 — sans effet sur le total, mais une fenêtre dont aucune
publication n'a de portée relevée affiche une portée de 0 mesurée.

- [ ] Une portée absente s'écrit « — » et se range en fin de tri
- [ ] `tsc` et build verts, 18 routes
