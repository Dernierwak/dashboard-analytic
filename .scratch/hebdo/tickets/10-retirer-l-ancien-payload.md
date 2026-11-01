# 10: Retirer l'ancien payload (contract)

**What to build:** le rapport ne calcule plus rien que la page ne montre. Les
anciennes clés, les lectures qui ne servaient qu'à elles et les
composants devenus morts quittent l'arbre. C'est la fin de
l'expand–contract ouvert au ticket 01.

**Blocked by:** 04, 05, 06, 07, 08

**Status:** ready-for-agent

**Références :** [spec](../spec.md) — Le payload (« Sortent »), La page
(« Ce qui part de la page ») ; ticket 14 de la carte, §1.

- [ ] Le payload perd `verdict`, `verdict_pct`, `verdict_metric`,
      `verdict_tone`, `kpi_focus`, `metrics_read`, `metrics_prev`,
      `metrics_series`, `kpis`, les `changements` déduits, `canaux_muets`,
      l'ancienne `frise` et `week_label`.
- [ ] Le `Lecteur` et le builder perdent les lectures qui ne servaient
      qu'à elles (objectif, GA4, abonnés, agrégats Instagram) ; ce qui
      reste de l'ancien monolithe est retiré.
- [ ] Ce que le reporting d'erreurs de la récolte lit encore
      (`semaines_muettes` et ce qui le nourrit) est conservé ou déplacé
      sans casser : il appartient au chantier de la remontée des erreurs.
- [ ] Les composants qui ne servaient qu'à l'hebdo sont supprimés après
      avoir été ouverts et vérifiés sans autre lecteur ; restent
      l'avertissement de trou de récolte, la pente, le fil de mise en
      place, la liste défilante et le module de lecture des changements
      par API.
- [ ] `git grep` propre des noms retirés ; `python3.12 -m py_compile` ;
      `rm -rf .next tsconfig.tsbuildinfo`, `tsc` et `build` verts, 18
      routes.
- [ ] Le harnais passe : aucune clé sortante dans le payload.
