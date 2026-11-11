# 04: Le Tableau détaillé

**Status:** ready-for-agent

**Blocked by:** 02

**What to build:** sous la Tendance, le client retrouve le Tableau détaillé de
Meta : ligne Total, chaque campagne avec son repère de type, dépliable en
Groupes d'annonces puis en Annonces (Search, Display, Vidéo, Demand Gen, et les
Autres types quand Google leur donne des groupes). Les colonnes suivent la vue
active ; il exporte le tableau tel qu'il le voit. PMax reste une ligne seule
jusqu'au 05.

Spec : § Tableau détaillé. Décision : ticket 09 de la carte. Lit les données
d'annonces déjà récoltées.

- [ ] Profondeur décidée par le type dans la lecture, testée au harnais (Search → annonce ; PMax → campagne seule en attendant le 05 ; Autres types → jusqu'où les données existent).
- [ ] Ratios recalculés par ligne : une ligne parent n'est jamais la moyenne de ses enfants (harnais).
- [ ] Une métrique sans objet pour une ligne s'écrit « — » avec sa raison au survol, jamais 0 ni vide.
- [ ] Deux annonces de même nom restent deux lignes (identité par ID).
- [ ] Export CSV tel qu'affiché, « — » compris, avec une colonne « Type de campagne » (vrai type Google pour Autres types).
- [ ] Le dépliage reste hors de l'URL, comme sur Meta ; la lecture pagine au-delà de 1 000 lignes.
- [ ] `tsc`, `build` verts, 18 routes ; vérifié dans Chrome sur une campagne Search dépliée.
