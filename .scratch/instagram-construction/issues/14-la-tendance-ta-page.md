# 14: La Tendance « Ta page »

**What to build:** en tête, le compte seul : les abonnés en grand (courbe du
total, barres gagnés vers le haut, perdus vers le bas), la portée et les
interactions du compte jour par jour, la période d'avant en pointillé, les
jours de publication marqués et cliquables, un interrupteur Tout / Organique /
Boosté.

Spec : § La page — Tendance ; § La lecture, ligne « la Tendance » ; § Ce
qu'on ne mesure pas (portée organique du compte) ; User Stories 6 à 10.

**Blocked by:** 09, 05

**Status:** ready-for-agent

- [ ] Trois sources des abonnés (`followers_history` jusqu'au 2026-09-04, la
      remontée, le relevé), un trou entre la première et la deuxième ; un
      jour sans donnée est un trou ; jour en cours exclu ; 48 dernières
      heures avec l'icône.
- [ ] Portée de la période = `instagram_compte_periodes` (05) quand la
      période y est, sinon une phrase qui dit pourquoi ; jamais la somme des
      jours.
- [ ] Interrupteur : Interactions total − `AD` / `AD` ; Portée boostée = `AD`,
      Organique grisé avec sa raison ; Abonnés sans effet.
- [ ] Jours de publication sous l'axe ouvrent `?post=` ; pas de table sous la
      Tendance ; l'Objectif et les Règles de lecture ne la touchent pas.
- [ ] Harnais : séries avec trous, période d'avant, interrupteur.
- [ ] `tsc` et `build` verts.
