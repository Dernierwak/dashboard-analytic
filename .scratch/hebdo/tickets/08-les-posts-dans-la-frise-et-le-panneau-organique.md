# 08: Les posts dans la frise et le panneau Organique

**What to build:** le client voit le rythme de ses posts Instagram en points
sous les mois de la frise. Dans l'onglet Organique du panneau, les posts
de la semaine choisie apparaissent en grille de deux colonnes : visuel
4:5, format (« Reel » quand c'en est un), jour et lien vers le post —
**aucun chiffre**.

**Blocked by:** 07 (la frise et le panneau)

**Status:** resolved

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

## Réponse (2026-11-01)

Récolte Instagram : `permalink` et `media_product_type` (section 22 de la migration, ajout seul, **non appliquée** ; la récolte tolère la colonne absente). `blocs/posts.py` : posts de l'année sans chiffre, « Reel » seulement si `media_product_type` le dit. Points dans la frise, grille 4:5 dans `panneau-organique.tsx`. Harnais 08. Les anciens posts ne sont relus qu'en partie : ils resteront sans lien ni « Reel ».

Vérifié hors ligne sur la branche d'intégration `worktree-hebdo-carte` (870963f) : les 13 harnais de `.scratch/hebdo/harnais/` et les `rendu.js` 07/08 tiennent, `py_compile`, `tsc` et `build` verts, 18 routes. **Pas vu en ligne** : le contrôle après passage du worker est le ticket 11.
