# 29: Une portée absente s'écrit « 0 » dans la table et les cartes

Type: task
Status: resolved
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

- [x] Une portée absente s'écrit « — » et se range en fin de tri
- [x] `tsc` et build verts, 18 routes

## Réponse

`LECTURES_INSTA.reach` passe par `porteeRelevee` : `valeurDe` rend `null` pour
une portée absente, donc le tri de la table et le top 3 la rangent en fin
(`trierDecroissant`), et le graphe « un par un » n'en trace pas la barre. La
table et la carte du top 3 écrivent « — » (`fmtCompte(porteeRelevee(p))`).

Laissé tel quel : les sommes de la Comparaison, de la frise et de « Tes
moyennes ». Un 0 n'y change pas le total ; seule une fenêtre où AUCUNE
publication n'a de portée y lirait 0 au lieu de « — ».

Vérifié : `tsc --noEmit` et `npm run build` verts, 18 routes. Non vérifié à
l'écran : aucune donnée de démo n'a de publication sans portée. Affichage
seul, visible au prochain déploiement Vercel.
