# 05: La carte Meta du module des canaux : volumes, ratios, moustache

**What to build:** le client voit, dans un rail, une carte par canal — Meta
seul aujourd'hui. À gauche : dépense, impressions et clics de la semaine,
puis CTR, CPC et CPM placés sur la moustache de ses 12 dernières semaines.
La bande « tes habitudes » (q1 → q3) et la « semaine type » (médiane) y
sont nommées. La semaine regardée est un gros point vert doux, rouge doux
ou gris, et le mieux est toujours à droite. La carte dit sur combien de
semaines porte la comparaison. Le nom du canal mène à sa page.

**Blocked by:** 04 (l'état des sources)

**Status:** resolved

**Références :** [spec](../spec.md) — Le payload (`canaux.volumes`,
`canaux.ratios`, ratios, quartiles), La page (rail, moustache), tableau
des états (jeton mort, panne, historique < 6) ; tickets de la carte 02,
03, 08 (point 3), 13 (points 3–6).

- [ ] Le payload porte `canaux[canal].volumes` (0 si la source a répondu
      sans diffusion, `null` si `etat ≠ recolte`) et `canaux[canal].ratios`
      pour CTR, CPC, CPM : `valeur`, les 12 semaines précédentes (chacune
      calée sur le Jour de travail, sur ses propres totaux), `n`,
      `mediane`, `q1`, `q3` (`null` si `n < 6`), `etat`.
- [ ] Ratio `null` quand son dénominateur vaut 0.
- [ ] Quartiles en méthode « exclusive » ; harnais : [1…6] → q1 = 1,75,
      q3 = 5,25.
- [ ] La page montre le rail (carte à 90 %, la suivante dépasse, ‹ › ou
      glisser) et la moustache, l'axe inversé pour CPC et CPM.
- [ ] États : jeton mort → alerte et lien vers Connexions ; panne → « — »
      partout, sans moustache, la phrase « Une erreur est survenue pendant
      la récolte de Meta. Nous la relançons dès que possible. », sans
      bouton ; historique < 6 → valeur sans couleur et « Semaine type dès 6
      semaines d'historique — encore N ».
- [ ] Le verdict, la carte du focus KPI et l'alerte « canal muet » quittent
      la page.
- [ ] Un payload sans `canaux` ne casse pas la page.
- [ ] `tsc` et `build` verts, 18 routes ; visible en ligne après un passage
      du worker (`report_only`).

## Réponse (2026-11-01)

`blocs/canaux.py` : volumes, ratios CTR/CPC/CPM, 12 semaines calées sur le Jour de travail, quartiles `statistics.quantiles(method="exclusive")` ([1…6] → 1,75 / 5,25), `null` sous 6. Rail, carte et moustache (`rail-canaux`, `carte-canal`, `moustache`, `rail-defilant`) ; axe inversé CPC/CPM ; états jeton mort / panne / < 6. Verdict, focus KPI et canal muet quittent la page. Harnais 05.

Vérifié hors ligne sur la branche d'intégration `worktree-hebdo-carte` (870963f) : les 13 harnais de `.scratch/hebdo/harnais/` et les `rendu.js` 07/08 tiennent, `py_compile`, `tsc` et `build` verts, 18 routes. **Pas vu en ligne** : le contrôle après passage du worker est le ticket 11.
