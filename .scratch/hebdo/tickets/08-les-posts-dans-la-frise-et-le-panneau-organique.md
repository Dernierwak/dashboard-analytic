# 08: Les posts dans la frise et le panneau Organique

**What to build:** le client voit le rythme de ses posts Instagram en points
sous les mois de la frise. Dans l'onglet Organique du panneau, les posts
de la semaine choisie apparaissent en grille de deux colonnes : visuel
4:5, format (« Reel » quand c'en est un), jour et lien vers le post —
**aucun chiffre**.

**Blocked by:** 07 (la frise et le panneau)

**Status:** ready-for-agent

**Références :** [spec](../spec.md) — La récolte, à construire d'abord
(point 3), Le payload (`frise.posts`), tableau des états (semaine vide) ;
tickets de la carte 04, 13 (point 9), 14 (§6, §7 point 3).

- [ ] La récolte Instagram écrit `permalink` et `media_product_type` (deux
      colonnes ajoutées par ajout seul, même permission, aucun
      re-consentement).
- [ ] Le payload porte `frise.posts[]` de l'année : `plateforme`, `date`,
      `format`, `visuel`, `lien` ; aucune métrique.
- [ ] Un `VIDEO` ne se dit « Reel » que si `media_product_type` le dit ;
      sans lui, on n'invente pas le format.
- [ ] Harnais : visuel et lien sur chaque post, une seule année.
- [ ] L'onglet Organique vide dit « Aucun post publié cette semaine »,
      « … en cours de récupération », ou « … n'était pas encore connecté »
      avant la connexion.
- [ ] `python3.12 -m py_compile` ; `tsc` et `build` verts, 18 routes.
- [ ] Visible en ligne après un passage du worker **avec `force`** (la
      récolte doit remplir les deux colonnes).
