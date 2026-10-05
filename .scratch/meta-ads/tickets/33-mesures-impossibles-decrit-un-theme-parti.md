# `docs/mesures-impossibles.md` décrit un thème qui n'existe plus

Type: task
Status: resolved
Blocked by: —
Venu de : la carte `.scratch/meta-ads/` — trouvé le 2026-10-01 par « La migration qui retire le thème de la base ».
Rangé dans `meta-ads/tickets/` le 2026-10-05 (depuis `.scratch/corrections/`, supprimé).

## Question

La section « Une conversion ou un revenu sur un thème purement organique » de
`docs/mesures-impossibles.md` prouve son affirmation par trois endroits du code :
la CTE `campagnes` de `theme_regroupement.sql`, `_theme_series` dans
`build_report.py`, et `theme-card.tsx`. Le premier fichier est supprimé par
`998_supprimer_le_theme.sql`, le dernier par le ticket 01 de la carte
`meta-ads` ; le document les cite comme vivants.

Le fond reste vrai — un post Instagram n'a pas de `utm_campaign`, il ne se
rattache à aucun revenu GA4 — mais il n'est plus porté par un thème. À
trancher en le reprenant : la section se réécrit (« un post organique ne
porte aucune conversion GA4 ») ou elle part, puisque Instagram est hors du
périmètre actuel. Dans les deux cas, plus aucune preuve ne doit pointer vers
un fichier absent : `git grep` sur chaque nom cité doit répondre.

## Answer

Réécrit le 2026-10-05. Dans `docs/mesures-impossibles.md` :
- la section devient « Une conversion ou un revenu sur une publication
  organique », et cite ce qui vit : `_revenu_semaine` (`build_report.py`), qui
  ne garde du `ga4_insights` que les `medium` payants (`cpc`, `ppc`, `paid`) —
  lu dans le code ;
- la section « Le revenu d'un thème dont les UTM… » est partie : la part muette
  et la vue `theme_regroupement` n'existent plus ;
- les paragraphes « par thème » de la fin aussi.

`git grep` sur chaque nom encore cité (`_revenu_semaine`, `_f_roas`,
`_pub_semaine`, `build_matrix`, `fetch_campaign_changes`, `_EVENEMENTS`,
`ETATS_DEFINITIFS`, `build_ga4_context`, `ga4_insights_uq2`,
`fetch_ga4_insights`, `fetch_ga4_events`, `object_story_spec`) trouve un
fichier. `theme_deux_regies` reste cité, comme règle **partie** — c'est
l'histoire, pas une preuve. La date « vérifiée le 2026-09-21 » en tête n'a
pas été changée : seuls les noms ont été revérifiés, pas toutes les
affirmations.
