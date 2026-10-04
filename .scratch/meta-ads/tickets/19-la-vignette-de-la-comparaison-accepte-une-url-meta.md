# 19: La vignette de la Comparaison accepte une URL de Meta

Type: task
Status: needs-triage
Blocked by: 05

**Trouvé en revue du ticket 12 (2026-10-04).** Deux règles disent « quel
visuel montrer » pour une même annonce, et elles divergent :

- le Panneau latéral (`lib/meta/annonce.ts`, `visuelDe` + `depuisStorage`) ne
  montre qu'une image du Storage **public** de Pulse ; une URL de Meta, qui
  expire, devient « Visuel pas encore copié dans Pulse » ;
- la vignette de la Comparaison (`lib/meta/donnees.ts`, `lireVignettes`) prend
  `vignette_url ?? image_url` **sans filtre** : si la récolte du ticket 05
  écrit dans `vignette_url` l'URL de Meta (la vignette d'une vidéo, par
  exemple), la liste l'affiche, puis l'image casse quand elle expire.

**À faire, une fois le 05 construit** : regarder ce que la récolte écrit
vraiment dans `vignette_url`, puis faire passer la vignette par la même règle
que le Panneau (une seule fonction, testée).

- [ ] La vignette de la Comparaison et le visuel du Panneau suivent une seule
      règle (testé)
- [ ] Aucune URL de Meta n'est affichée dans la Comparaison
