# 13: La clé de la config de campagne passe à l'ID (étape B)

Type: task
Status: ready-for-agent
Blocked by: 03

**What to build:** une campagne renommée dans Meta garde sa configuration au lieu
d'en perdre la trace. **Destructeur au sens de `CLAUDE.md` §7** : le SQL est
**proposé**, vérifié, et **joué par David**, une fois, après le rejeu des IDs
(ticket 03). Spec : § « L'identité par ID », étape B ; user story 59. SQL de
départ : ticket 07 de la carte.

- [ ] Ce qui lit et écrit `meta_campaign_config` utilise `campaign_id`
- [ ] Le SQL reporte l'ID seulement quand un nom désigne **une seule** campagne,
      puis **refuse de tourner** tant qu'une ligne n'a pas d'ID ; une campagne
      renommée fait refuser l'étape B — voulu, on la rattache à la main
- [ ] Le nom réel de la contrainte est lu sur la base avant d'écrire le SQL final
- [ ] Vérifié sur un PostgreSQL jetable : refus quand une ligne n'a pas d'ID,
      passage quand toutes en ont
- [ ] `tsc --noEmit`, `npm run build` et `py_compile` verts
- [ ] David a joué le SQL ; le contrôle est recopié ici
