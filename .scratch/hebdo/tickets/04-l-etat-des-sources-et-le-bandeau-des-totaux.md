# 04: L'état des sources et le bandeau des totaux

**What to build:** le client voit sa dépense et ses impressions de la
semaine, en deux colonnes séparées par un filet : le grand chiffre, puis
chaque canal en petit avec sa pastille. Si une source n'a pas répondu, le
total additionne celles qui ont répondu et une note nomme l'absente ;
jamais un 0 à la place d'une absence. Une source pas branchée n'apparaît
nulle part.

**Blocked by:** 01 (la semaine), 03 (la couverture)

**Status:** ready-for-agent

**Références :** [spec](../spec.md) — Le payload (`sources`, `totaux`, état
d'une source), Le `Lecteur`, La page (bandeau), tableau des états (jeton
mort, panne) ; tickets de la carte 13 (points 1–5), 14 (§3, §4), 16.

- [ ] Le `Lecteur` rend l'état de connexion par canal (date « à reconnecter
      depuis », date de connexion) et la couverture par flux.
- [ ] Le payload porte `sources[canal]` pour chaque source **connectée**
      seulement : `etat` (`jeton_mort` si marqué ; sinon `panne` si la
      couverture des insights n'atteint pas `semaine.fin` ; sinon
      `recolte`), `connecte_le`, `journal` (`couvert` / `non_couvert`).
- [ ] Le payload porte `totaux.depense` et `totaux.impressions` par source,
      `null` si `etat ≠ recolte`. Pas de `totaux.portee`.
- [ ] La page montre le bandeau à deux colonnes ; ni barre, ni anneau, ni
      colonne portée. Grand chiffre et note de la source absente se
      calculent à l'affichage.
- [ ] Harnais : jeton mort, panne, semaine récoltée en partie, source pas
      branchée — chaque cas rend le payload attendu.
- [ ] Un payload sans `sources` ni `totaux` (publié avant) ne casse pas la
      page.
- [ ] `tsc` et `build` verts, 18 routes ; visible en ligne après un passage
      du worker (`report_only` si 02 et 03 sont passés).
