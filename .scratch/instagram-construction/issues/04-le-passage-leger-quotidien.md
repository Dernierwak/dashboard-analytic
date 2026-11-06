# 04: Le passage léger quotidien

**What to build:** un nouveau mode du worker au cron de 07:00 UTC qui passe
chaque jour sur **tous les comptes Instagram, Jour de travail ou non** :
relevé des posts de moins de 8 × 24 h, première page de l'inventaire et fiche
des posts neufs (un post du mardi a son premier relevé le mercredi). Il ne
touche pas au rapport.

Spec : § La récolte — Ce qui s'ajoute, « Le passage léger quotidien » et
« La relecture » (premier tiret : chaque jour de J+0 à J+7).

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Le mode tourne pour tous les comptes Instagram ; `_due_today` continue
      de gouverner le passage complet et le rapport.
- [ ] Posts de moins de 8 × 24 h relevés (2 appels, 1 pour un Reel) ;
      `/media?limit=25` et fiche des posts absents de la base.
- [ ] Une ligne de journal donne la durée du passage par compte (elle fixera
      la taille d'un bloc du Rattrapage, 08).
- [ ] Le rapport hebdo n'est ni construit ni publié par ce mode.
- [ ] Harnais : quels posts sont relevés à quel âge ; un jour hors Jour de
      travail passe quand même.
