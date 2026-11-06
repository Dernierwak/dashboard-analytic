# 12: Les Règles de lecture

**What to build:** le client retire les boostés ou les hors norme de la
métrique affichée ; la page dit quel filtre tourne et combien de posts il
écarte, avec un lien pour revenir aux règles standard. Un post boosté se
reconnaît partout.

Spec : § La page — Bandeau (« Règles de lecture »), ligne « Lu sans … »,
§ L'état de la page vit dans l'URL ; § La lecture, « sans les hors norme »,
« sans les boostés », « La mention sous 6 posts » ; User Stories 23 à 25, 28.

**Blocked by:** 10, 02

**Status:** ready-for-agent

- [ ] Deux filtres dans l'URL, jamais mémorisés ; compteur « · n ».
- [ ] Tukey en une passe sur la référence de la métrique affichée ; minimum 6
      jugé après le retrait ; raison gardée dans la mention sous 6.
- [ ] Écartés gris au nuage, grisés au Tableau avec leur raison, hors de la
      liste des 5.
- [ ] Anneau fin au nuage, étiquette « Boosté » à la liste, au Tableau, au
      Panneau (« Chiffres organiques, hors boost — Instagram les rend
      ainsi »), sans budget.
- [ ] « Revenir aux règles standard » ne retire que les deux filtres.
- [ ] Harnais : Tukey une passe, retrait des boostés, raison sous 6.
