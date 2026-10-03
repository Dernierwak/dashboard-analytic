# 16: Le journal dit « groupe d'annonces », pas « ensemble »

Type: task
Status: needs-triage
Blocked by: 04

Trouvé en construisant le ticket 11. Les phrases que la récolte rédige
(`saas/collecte/meta/fetch_meta_ads.py`, `_traduire_meta` et
`_PHRASES_SANS_VALEUR`) disent « l'ensemble "X" » ; le Panneau latéral les
affiche telles quelles. `CONTEXT.md`, **Groupe d'annonces** : un seul mot pour
l'ad set — « groupe d'annonces ». La spec (user story 4) le redit.

**What to build:** les phrases du journal Meta disent « le groupe d'annonces
"X" » partout où elles disent « l'ensemble "X" ».

- [ ] Les phrases rédigées par la récolte emploient « groupe d'annonces »
      (accords compris : « le groupe d'annonces "X" a été mis en pause »)
- [ ] Le harnais `.scratch/meta-ads/harnais/04-le-journal/` suit
- [ ] Après un passage du worker (`weekly-fetch.yml` à la main) : les lignes
      déjà écrites sont réécrites — `change_id` ne hache pas la phrase, l'upsert
      remplace `resume` (à vérifier en base, pas à supposer)
