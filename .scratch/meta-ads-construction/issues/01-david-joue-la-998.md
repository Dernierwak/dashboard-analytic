# 01: David joue la `998` sur Supabase

Type: task
Status: ready-for-human
Blocked by: None (can start immediately)

**What to build:** la base de production perd le thème, comme le reste du produit
l'a déjà perdu. La spec l'exige avant tout ce qui touche au `000` (spec, « Ordre
de construction suggéré », point 1). La migration est écrite et vérifiée sur un
PostgreSQL jetable : ticket 02 de la carte,
`.scratch/meta-ads/issues/02-la-migration-qui-retire-le-theme-de-la-base.md`,
§ « Quand la jouer ».

Si elle est déjà jouée, ce ticket se ferme en le disant.

- [ ] Vercel a déployé le `main` qui ne lit plus le thème, et un passage du
      worker a tourné dessus (cron du Jour de travail, ou `weekly-fetch.yml`
      lancé à la main)
- [ ] SQL editor → `998` collée → exécutée
- [ ] Le bloc CONTRÔLE, joué seul, dit ✓ sur toutes ses lignes
