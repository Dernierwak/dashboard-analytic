# 07: La relecture sans plafond et le compte gratuit qui grandit

**What to build:** la cadence de relecture de la spec — chaque jour de J+0 à
J+7 (déjà par 04), à chaque Jour de travail les posts de moins de 30 jours,
tous les 3 mois tous les posts en base (le chemin de 03). Le payant perd son
plafond de 200 posts et sa reprise à 40. Le gratuit garde ses 10 premiers puis
grandit : tout post absent s'ajoute, rien ne s'efface.

Spec : § La récolte — Ce qui s'ajoute, « La relecture » et « Le compte
gratuit ».

**Blocked by:** 03, 04

**Status:** ready-for-agent

- [ ] `_a_relire` suit la cadence ; plus de plafond 200 ni de reprise à 40
      pour le payant.
- [ ] Le gratuit n'est plus tronqué à 10 après sa première récolte ; pas de
      Rattrapage (`is_paid`).
- [ ] Le trimestriel se déclenche tout seul tous les 3 mois, sur une date de
      dernier passage complet lue en base, pas devinée.
- [ ] Harnais : la liste à relire pour un payant et un gratuit à des dates
      données.
