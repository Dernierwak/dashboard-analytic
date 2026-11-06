# 05: Le relevé du compte

**What to build:** chaque passage léger écrit la journée d'hier du compte dans
`instagram_compte_jours` : portée, interactions, gagnés et perdus, total
d'abonnés (R5) et la part boostée (`AD`) de la portée et des interactions.
Plus la portée **dédoublonnée sur 7 jours** que rend Instagram, pour que la
Tendance (14) l'affiche sans jamais sommer des jours.

Spec : § La récolte — Ce qui se corrige R5 ; § Ce qui s'ajoute, « Le relevé
du compte, pour hier » ; § La page, Tendance (« la portée de la période …
`total_value` »).

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] `reach` (`period=day`), `total_interactions` (un appel par jour),
      `follows_and_unfollows` par `follow_type`, `followers_count` du passage,
      part `AD` via `breakdown=media_product_type`. Le jour en cours n'est
      jamais écrit.
- [ ] Une métrique non rendue reste `NULL` ; un jour non lu n'a pas de ligne.
- [ ] **Décision de construction** (la spec veut la portée `total_value` d'une
      période libre, que la base ne peut pas reconstituer à partir des jours) :
      chaque passage enregistre la portée `total_value` des 7 jours finissant
      hier, en ajout seul, dans une petite table `instagram_compte_periodes
      (user_id, debut, fin, reach)` (section 23, RLS comme le reste). La
      période par défaut de la page (7 jours finissant la veille du Jour de
      travail) s'y trouve donc ; une autre période écrit pourquoi elle n'a pas
      ce chiffre.
- [ ] Harnais « réponse Graph → ligne du jour » : `AD` absent → `NULL`.
