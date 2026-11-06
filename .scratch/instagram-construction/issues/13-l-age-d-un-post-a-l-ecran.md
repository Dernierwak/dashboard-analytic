# 13: L'âge d'un post à l'écran

**What to build:** un post trop jeune ne se juge pas trop tôt : sous 48 h il
est un point vide hors de la foule ; sous 7 jours il porte son âge et l'icône
« peut encore changer » et se compare aux autres posts **au même âge**, à
partir de leurs relevés.

Spec : § La lecture, lignes « âge » et « place à âge égal » ; § La page, nuage
et Panneau ; User Stories 20, 21.

**Blocked by:** 10, 01

**Status:** ready-for-agent

- [ ] Lecture paginée des relevés ; place à âge égal sur le **premier**
      relevé tombé dans [n × 24 ; (n+1) × 24) h ; minimum 6, sinon une
      mention.
- [ ] Point vide sous 48 h, icône et âge sous 7 jours, partout où le post
      paraît.
- [ ] Harnais : l'âge égal sur le premier relevé du bon J+n ; sans
      `releve_a` = plus de 7 jours.
- [ ] Dit dans la réponse : l'âge égal n'aura de matière qu'après des
      semaines de relevés.
