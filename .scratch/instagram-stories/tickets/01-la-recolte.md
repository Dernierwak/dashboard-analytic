# 01: La récolte des stories

Type: task
Status: resolved
Blocked by: —

## À faire

Spec `../spec.md` § La récolte et § La base, à la lettre :
- section 27 du `000_run_me_all.sql` (table, deux colonnes, bucket, RLS,
  lignes du CONTRÔLE) ;
- le job horaire (fetcher sous `sources/meta/instagram/`, écriture sous
  `saas/data/supabase/source_data/`, commande `cockpit/instagram_stories.py`)
  et son workflow ;
- `reach_story` / `interactions_story` dans le relevé quotidien ;
- les trois lignes de `docs/mesures-impossibles.md`.

## Vérification

Harnais hors ligne sous `.scratch/instagram-stories/harnais/` (API Meta et
Supabase simulées) : story nouvelle, story de 21 h relue, métrique en erreur
→ NULL, vidéo sans `media_url`, jeton absent de toute sortie, `reach_story`
écrit depuis une réponse ventilée. `python3.12 -m py_compile` sur tout fichier
touché.

## Answer

Construit le 2026-11-25 : section 27 du `000`, `fetchers/stories.py`,
`instagram/stories.py`, `source_data/instagram_stories.py`,
`cockpit/instagram_stories.py`, `.github/workflows/instagram-stories.yml`,
`reach_story` / `interactions_story` dans le relevé quotidien, trois lignes de
`docs/mesures-impossibles.md`, Pillow. Harnais `harnais/test_recolte.py` :
42 contrôles, aucun échec ; `py_compile` vert ; jeton absent des sorties.
Écarts gardés : un relevé refusé en entier n'écrase pas le précédent (code 10
excepté) ; une vignette ratée est retentée ; le job ne sort en erreur que si
tout échoue. **Non vérifié** : SQL jamais exécuté (pas de Postgres local),
workflow jamais lancé.
