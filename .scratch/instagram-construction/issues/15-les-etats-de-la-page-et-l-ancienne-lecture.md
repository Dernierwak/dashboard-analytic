# 15: Les états de la page et le départ de l'ancienne lecture

**What to build:** la page tient dans ses trois états — compte neuf, jeton
mort, compte gratuit — et l'ancienne lecture Instagram quitte l'arbre.

Spec : § La page — Les états de la page ; § La lecture, « Ce qui part de la
lecture actuelle » ; § Testing Decisions, « Ce qui ne se vérifie qu'en vrai » ;
User Stories 30, 31.

**Blocked by:** 11, 12, 13, 14

**Status:** ready-for-agent

- [ ] Compte neuf : un seul encart. Jeton mort : grand encart en tête,
      « figé au … », ce qui reste juste, ce qui manque, « Reconnecter
      Instagram », page grisée. Gratuit : aucun mode à part, aucun appel à
      l'achat.
- [ ] Partent de `getInstaDash` tous les champs listés par la spec et
      `FORMAT_LABEL`, sans casser Google ni l'hebdo ; plus aucun appelant.
- [ ] Les dossiers `_prototype-*` ne sont pas dans l'arbre ; `git grep`
      propre.
- [ ] `rm -rf .next tsconfig.tsbuildinfo`, `tsc` et `build` verts, 18 routes.
