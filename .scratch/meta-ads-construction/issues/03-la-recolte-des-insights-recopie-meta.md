# 03: La récolte des insights recopie Meta

Type: task
Status: ready-for-agent
Blocked by: 02

**What to build:** chaque ligne d'insights récoltée porte l'identité Meta de sa
campagne et de son groupe d'annonces, la colonne « Résultats » d'Ads Manager telle
que Meta la rend, et son réglage d'attribution ; et un jour récolté est relu tant
que Meta le corrige. Spec : § « Les conversions », § « La fraîcheur »,
§ « L'identité par ID » ; user stories 2, 52, 57, 58.

Seam de test : « réponse Meta → lignes à écrire », sans appel réseau. Le ticket
**écrit son harnais** (prior art : `_traduire_meta`, déjà pur ; style des harnais
du traitement, dans l'historique git).

- [ ] La requête `/insights` demande `campaign_id`, `adset_id`, `results` et
      `attribution_setting` — zéro appel de plus
- [ ] `results` absent → `NULL` ; liste vide → liste vide ; jamais `0` (testé)
- [ ] Deux annonces homonymes restent deux lignes (testé)
- [ ] Le recouvrement Meta passe de 7 à 28 jours ; son commentaire dit la vraie
      raison (Meta corrige jusqu'à 28 jours, `action_report_time=mixed`) et l'ancien
      (« conversion au jour du CLIC ») disparaît
- [ ] `python3.12 -m py_compile` sur ce qui a été touché
- [ ] **Après un passage du worker** — `weekly-fetch.yml` lancé à la main avec
      `force` : les 28 derniers jours portent IDs, `results` et attribution dans la
      base ; la forme réelle d'un élément de `results` est recopiée dans ce ticket
      (elle fixe le ticket 10)
- [ ] **Rejeu** — `weekly-fetch.yml` avec `meta_since` à la plus vieille date en
      base : les lignes anciennes ont leurs IDs. Aucune n'est remplie par une
      jointure sur le nom. Le nombre de lignes encore sans ID est écrit ici
