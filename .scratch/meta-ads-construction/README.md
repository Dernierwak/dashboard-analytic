# Construction — le dashboard Meta Ads refondu

Ce chantier **construit** ce que la carte `.scratch/meta-ads/` a décidé. Il ne
décide rien : chaque ticket renvoie à la spec, et la spec renvoie aux tickets
clos de la carte.

- **La spec** : [`../meta-ads/spec.md`](../meta-ads/spec.md) — elle seule fait foi,
  pas le prototype `/meta/prototype-modules`.
- **Les tickets** : `issues/01` à `issues/14`, numérotés dans l'ordre des
  dépendances. Mêmes conventions que partout (`docs/agents/issue-tracker.md`).
- **La frontière** : un ticket se prend quand tous ceux de sa ligne `Blocked by`
  sont `resolved`. Trois agents au plus en parallèle, jamais deux sur les mêmes
  fichiers.
- **`ready-for-human`** : une action que seul David peut faire (jouer une
  migration sur Supabase, lancer `weekly-fetch.yml`).

## L'ordre

```
01 (David : la 998) → 02 schéma
02 → 03 récolte insights → 04 journal élargi → 11 changements sur la Tendance
02 → 05 récolte des créas
02 → 06 page neuve → 07 Bandeau
                   → 08 Comparaison
                   → 09 Tableau
03 + 08 + 09       → 10 vue Conversion
05 + 08 + 11       → 12 lire une annonce
03 (après le rejeu) → 13 clé de config par ID (David joue l'étape B)
07 … 13            → 14 le prototype part, recette Chrome
```

Après 02, trois tickets peuvent avancer de front : **03**, **05** et **06**.

## Ce qui ne se vérifie qu'après un passage du worker

Les tickets de récolte (03, 04, 05) ne sont `resolved` qu'une fois la base lue
**après** un passage : un lancement à la main de `weekly-fetch.yml` depuis
l'onglet GitHub Actions. Chaque ticket dit quels paramètres.
