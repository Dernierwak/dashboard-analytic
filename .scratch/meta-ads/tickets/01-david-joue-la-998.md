# 01: David joue la `998` sur Supabase

Type: task
Status: resolved
Blocked by: None (can start immediately)

**What to build:** la base de production perd le thème, comme le reste du produit
l'a déjà perdu. La spec l'exige avant tout ce qui touche au `000` (spec, « Ordre
de construction suggéré », point 1). La migration est écrite et vérifiée sur un
PostgreSQL jetable : ticket 02 de la carte,
`.scratch/meta-ads/issues/02-la-migration-qui-retire-le-theme-de-la-base.md`,
§ « Quand la jouer ».

Si elle est déjà jouée, ce ticket se ferme en le disant.

- [x] Vercel a déployé le `main` qui ne lit plus le thème, et un passage du
      worker a tourné dessus (cron du Jour de travail, ou `weekly-fetch.yml`
      lancé à la main)
- [x] SQL editor → `998` collée → exécutée
- [x] Le bloc CONTRÔLE, joué seul, dit ✓ sur toutes ses lignes

## Comments

**2026-10-03 — déjà jouée.** Constaté en lecture seule sur la base de
production (CLI Supabase, `supabase db query --linked`) : `theme_regroupement`,
`theme_ga4_events`, `insight_feedback` absentes ; `meta_campaign_config.label`,
`landing_url` et `profiles.labels` absentes ; aucune ligne `fetch_progress` du
canal `labels`. Rien n'a été rejoué. Le ticket se ferme en le disant.
