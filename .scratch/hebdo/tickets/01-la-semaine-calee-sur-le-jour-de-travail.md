# 01: La semaine calée sur le Jour de travail

**What to build:** le client lit en titre « Semaine du 21 au 27 octobre », la
mention que le jour en cours n'est jamais compté, et en ligne discrète la
date de publication et celle du prochain passage. La semaine est la même
quel que soit le jour où le rapport est recalculé : 7 jours pleins qui
finissent la veille du dernier Jour de travail. Un compte neuf, sans
rapport encore, voit une seule carte « Ton premier rapport arrive le
<date>. Il portera sur la semaine du <début> au <fin>. »

C'est aussi le **refactoring préalable** du chantier : les blocs neufs du
payload s'écrivent en fonctions séparées, dans un module à côté du
monolithe `build_payload`, qui les assemble. Les anciennes clés restent
jusqu'au ticket 10.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Références :** [spec](../spec.md) — Règles qui valent partout, Le payload
(`semaine`), Le `Lecteur`, tableau des états (compte neuf) ; tickets de la
carte 02 (point 6) et 13 (point 12).

- [ ] Le `Lecteur` rend le Jour de travail du profil (lundi par défaut).
- [ ] Le payload porte `semaine.debut`, `semaine.fin`, `semaine.numero` ;
      `fin` = dernier Jour de travail ≤ aujourd'hui, moins un jour, jamais
      la dernière donnée. La clé d'écriture `week_start` suit la nouvelle
      `fin`.
- [ ] Le harnais du ticket 14 est repris : son constat « refait le samedi,
      la semaine glisse » s'inverse ; celui du jeudi reste vrai.
- [ ] La page écrit son titre depuis `semaine` et absorbe les trois dates
      (le composant actuel des trois dates part de la page).
- [ ] Un payload publié avant ce ticket (sans `semaine`) ne casse pas la
      page.
- [ ] Compte neuf : la carte unique s'affiche, ses dates sortent du Jour
      de travail.
- [ ] `python3.12 -m py_compile` sur ce qui est touché ; `tsc` et `build`
      verts, 18 routes.
- [ ] Visible en ligne après un passage du worker (`report_only`).
