# 03: La valeur de conversion et le ROAS

**Status:** ready-for-agent

**Blocked by:** 02

**What to build:** la vue Conversion gagne la **valeur de conversion** et le
**ROAS**, déclarés par Google. Quand toutes les actions qui ont converti sur la
période et la campagne choisies n'ont qu'une valeur imposée à 0 ou à 1, le
client lit « — » avec la raison (« aucune valeur de conversion déclarée dans
Google Ads ») ; quand le compte mélange, il lit le total de Google avec une
« ⓘ » qui dit qu'une partie n'est qu'un comptage.

Spec : § Les conversions et leur valeur, § Les colonnes et tables nouvelles
(actions de conversion, conversions par action). Décision : ticket 13 de la
carte.

- [ ] Table des actions de conversion (ID, nom, catégorie, statut, `always_use_default_value`, valeur par défaut, devise), relue à chaque passage.
- [ ] Table des conversions par action × campagne × jour (`segments.conversion_action`, métriques de conversion seules — l'API refuse impressions et coût dans la même requête).
- [ ] Harnais récolte : réglages lus tels quels ; la somme par action égale `metrics.conversions` sur un exemple.
- [ ] Harnais page : toutes sans valeur → « — » sur valeur et ROAS ; mélange → `conversions_value` de Google, jamais recomposé, avec drapeau « ⓘ » ; la règle se recalcule au filtre campagne ; ROAS = valeur ÷ coût sur les totaux, coût nul → « — ».
- [ ] La limite « par événement sans montant → défaut 1, invisible dans les réglages » est écrite dans `docs/mesures-impossibles.md`.
- [ ] Aucune jointure GA4.
- [ ] `py_compile`, `tsc`, `build` verts, 18 routes. Visible **après un passage du worker** (lancement à la main `force`, ou cron du Jour de travail) — le dire.
