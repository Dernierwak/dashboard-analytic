# 11: Les 5 meilleurs et le Panneau « lire un post »

**What to build:** à droite du module, la liste collante des 5 meilleurs posts
de la période sur la métrique choisie ; un clic (liste, nuage, Tableau) ouvre
le Panneau latéral `?post=` qui lit le post dans Pulse.

Spec : § La page — « Tes posts face à ton année », dernier point (la liste) ;
§ Panneau latéral ; § La lecture, « les 5 meilleurs » ; § Notes, « La forme de
la Sélection reste amendable ».

**Blocked by:** 10

**Status:** ready-for-agent

- [ ] Liste : vignette, valeur, place, mini-moustache, légende, « Lire le
      post » ; numéros reportés sur le nuage ; sans les moins de 48 h ni les
      sans valeur.
- [ ] Panneau : lecteur public Instagram depuis `permalink` (rien sans lui),
      légende, lien, valeur et moustache, place sur **chaque** métrique,
      temps de visionnage pour un Reel.
- [ ] La phrase de l'écart avec l'hebdo quand un rapport a lu ce post.
- [ ] Le lien `?post=` ne change que `post` et garde le reste de l'URL.
- [ ] `tsc` et `build` verts.
