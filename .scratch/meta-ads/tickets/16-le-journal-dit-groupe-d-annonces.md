# 16: Le journal dit « groupe d'annonces », pas « ensemble »

Type: task
Status: ready-for-human
Blocked by: 04

Trouvé en construisant le ticket 11. Les phrases que la récolte rédige
(`saas/collecte/meta/fetch_meta_ads.py`, `_traduire_meta` et
`_PHRASES_SANS_VALEUR`) disent « l'ensemble "X" » ; le Panneau latéral les
affiche telles quelles. `CONTEXT.md`, **Groupe d'annonces** : un seul mot pour
l'ad set — « groupe d'annonces ». La spec (user story 4) le redit.

**What to build:** les phrases du journal Meta disent « le groupe d'annonces
"X" » partout où elles disent « l'ensemble "X" ».

- [x] Les phrases rédigées par la récolte emploient « groupe d'annonces »
      (accords compris : « le groupe d'annonces "X" a été mis en pause »)
- [x] Le harnais `.scratch/meta-ads/harnais/04-le-journal/` suit
- [ ] Après un passage du worker (`weekly-fetch.yml` à la main) : les lignes
      déjà écrites sont réécrites — `change_id` ne hache pas la phrase, l'upsert
      remplace `resume` (à vérifier en base, pas à supposer)

## Answer

Construit sur `worktree-meta-ads-tickets-construction`.

- **Les phrases.** Les six phrases de groupe d'annonces disent « du groupe
  d'annonces "X" » ou « le groupe d'annonces "X" » : enchère, stratégie
  d'enchère, création, budget, statut et ciblage. Deux accords étaient en jeu :
  - « de » + « le groupe » se contracte en « du ». Le complément s'écrit donc
    entier par niveau (`du_objet`) au lieu d'accoler « de » à l'objet.
  - `_ETATS_META` porte désormais le couple (féminin, masculin). L'ancienne
    phrase était déjà fausse : « l'ensemble "X" a été mise en pause ». La
    campagne garde son féminin.
- **Le harnais 04** passe ses attentes à « groupe d'annonces ». Il gagne cinq
  tests : budget « du groupe », mis en pause au masculin, campagne toujours au
  féminin, ciblage, et aucune phrase de groupe d'annonces ne dit « ensemble ».
  Il donne 23 verts. Le harnais 11 a vu sa donnée d'exemple suivre ; les
  harnais TS donnent 150 verts. tsc et le build sont verts, 18 routes.
- **La réécriture en base est possible dans le code.** `_cle_meta` hache
  (canal, horodatage, type, objet), sans la phrase. `upsert_platform_changes`
  fait un upsert sur `user_id,channel,change_id`, et
  `lots_sans_effacer_la_campagne` ne retire du lot que `campaign_id` et
  `campaign_name` : `resume` passe dans les deux lots. Chaque passage relit
  180 jours de journal Meta. Une ligne plus ancienne que cette fenêtre garde
  donc « ensemble ».

**Reste à David — la 3e case.** Après le merge sur `main`, lancer
`weekly-fetch.yml` à la main depuis l'onglet GitHub Actions (récolte complète,
pas `report_only`). Puis vérifier en base qu'aucune phrase ne dit plus
« ensemble » :

```sql
select count(*) from platform_changes
where channel = 'meta' and resume ilike '%ensemble%';
```

Le résultat attendu est 0, hors lignes de plus de 180 jours. Le ticket passe à
`resolved` une fois ce 0 lu.
