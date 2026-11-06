# 08: Le Rattrapage par blocs

**What to build:** pour un compte payant, tous les posts que Meta rend, du
plus récent au plus ancien, un bloc par passage quotidien ; la page se remplit
à mesure et sa ligne de référence dit ce qu'elle couvre.

Spec : § La récolte — Ce qui s'ajoute, « Le Rattrapage » ; § Notes, « Dans le
brouillard ».

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] Le curseur de pagination de l'inventaire est gardé entre deux passages ;
      un passage reprend où le précédent s'est arrêté ; fini = plus de page.
- [ ] La taille du bloc est une constante nommée dont le commentaire dit
      qu'elle attend la durée mesurée du passage (journal de 04) — pas de
      seuil inventé présenté comme mesuré.
- [ ] Harnais : reprise du curseur, arrêt en fin d'inventaire, gratuit exclu.
- [ ] Le ticket reste needs-human jusqu'à ce que la taille du bloc soit fixée
      sur une durée mesurée en production.
