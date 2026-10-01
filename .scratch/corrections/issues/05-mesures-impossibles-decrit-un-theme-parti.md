# `docs/mesures-impossibles.md` décrit un thème qui n'existe plus

Type: task
Status: open
Blocked by: —
Venu de : la carte `.scratch/meta-ads/` — trouvé le 2026-10-01 par « La migration qui retire le thème de la base ».

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

## Comments
