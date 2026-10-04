# 13: La clé de la config de campagne passe à l'ID (étape B)

Type: task
Status: ready-for-human
Blocked by: 03

**What to build:** une campagne renommée dans Meta garde sa configuration au lieu
d'en perdre la trace. **Destructeur au sens de `CLAUDE.md` §7** : le SQL est
**proposé**, vérifié, et **joué par David**, une fois, après le rejeu des IDs
(ticket 03). Spec : § « L'identité par ID », étape B ; user story 59. SQL de
départ : ticket 07 de la carte.

- [x] Ce qui lit et écrit `meta_campaign_config` utilise `campaign_id` — l'écriture ;
      le seul lecteur (frise du rapport) rapproche par nom : ticket 19
- [x] Le SQL reporte l'ID seulement quand un nom désigne **une seule** campagne,
      puis **refuse de tourner** tant qu'une ligne n'a pas d'ID ; une campagne
      renommée fait refuser l'étape B — voulu, on la rattache à la main
- [x] Le nom réel de la contrainte est lu sur la base avant d'écrire le SQL final
- [x] Vérifié sur un PostgreSQL jetable : refus quand une ligne n'a pas d'ID,
      passage quand toutes en ont
- [x] `tsc --noEmit`, `npm run build` et `py_compile` verts
- [ ] David a joué le SQL ; le contrôle est recopié ici

## Comment

**2026-10-04 — écrit et vérifié hors ligne. Reste : merger, laisser passer le
worker, puis David joue la `997`.**

**Ce que la base a dit d'abord** (lecture seule, `supabase db query --linked`) :
la clé est `meta_campaign_config_pkey` = `PRIMARY KEY (user_id, campaign_name)`,
aucune FK ni vue ne dépend de la table, aucun nom d'insights ne désigne deux
campagnes. Et surtout : **197 lignes de config par compte, 0 avec un ID**, et le
report depuis les insights (le SQL du ticket 07) n'en atteint que **16** pour
`11043e9a`, **0** pour `0b83e564`. Les autres campagnes n'ont jamais dépensé :
elles n'ont aucune ligne d'insights. Le SQL seul aurait donc refusé pour
toujours — c'est le worker qui doit poser l'ID, depuis `/campaigns`.

Ce qui a changé :
- `saas/collecte/meta/fetch_meta_ads.py` : **`lignes_config_meta(user_id,
  campagnes)`**, le seam pur « /campaigns → lignes de config ». Une ligne par
  ID (deux homonymes restent deux lignes), campagne sans `id` écartée et
  comptée, statut absent → `None` au lieu de l'ancien `"UNKNOWN"` fabriqué
  (le seul lecteur, `channel-dash.tsx`, traite les deux pareil).
- `saas/collecte/automatisation/fetch_all.py` : `_meta_campagnes` demande `id`
  (même requête) ; le worker passe par le seam.
- `saas/commun/insert_data.py` : `upsert_campaign_statuses` écrit sur
  `(user_id, campaign_id)`. **Repli de transition** : avant l'étape B, cet
  upsert est refusé en `42P10` ; il retombe alors sur le nom en posant l'ID au
  passage, et saute les noms homonymes (en garder un serait choisir) — il rend
  leur nombre et le worker l'écrit au journal. Le retrait du repli est le
  ticket 20. `upsert_campaign_config` est parti : aucun appelant, clé par nom.
- `supabase/migrations/997_la_cle_de_config_meta_passe_a_l_id.sql` : l'étape B.
  Report depuis les insights (SQL du ticket 07), puis dans un `DO` : lit le nom
  de la PK, ne fait rien si elle est déjà sur l'ID, refuse si une ligne n'a pas
  d'ID **ou si deux lignes portent le même ID** (une renommée qui a gardé sa
  ligne à l'ancien nom), en listant les campagnes en cause. Le tout dans une
  transaction : un refus annule aussi le report.
- `000_run_me_all.sql` : une base **neuve** naît avec la clé par ID ; une base
  existante n'est pas touchée (`IF NOT EXISTS`).

**Vérifié** :
- harnais `.scratch/meta-ads/harnais/13-la-cle-de-config` : **12/12** (rouge
  avant l'implémentation) ; harnais 04 toujours vert ; `py_compile` sur les
  trois fichiers Python.
- PostgreSQL 15 jetable (Postgres.app), table à la forme réelle :
  1. une ligne sans ID → refus, **report annulé**, clé inchangée ✓
  2. un nom d'insights à deux IDs → pas reporté → refus ✓
  3. deux lignes au même ID → refus, les deux noms cités ✓
  4. toutes avec ID → `PRIMARY KEY (user_id, campaign_id)`, `campaign_id NOT
     NULL`, budget et statut intacts ✓
  5. rejouée → « rien à faire » ✓
  6. après B, upsert sur l'ID d'un nom changé → **une** ligne, budget gardé ;
     l'ancienne clé est refusée (42P10) ✓
  7. avant B, l'upsert sur l'ID lève 42P10, le repli par le nom pose l'ID, puis
     B passe ✓
  8. base vierge : la section Meta du `000` crée la clé par ID, la `997` dit
     « rien à faire » (le reste du `000` n'a pas été rejoué en entier : mes
     stubs de `profiles` étaient incomplets).
- Revue en deux axes. Retenus : repli rendu visible au journal, renommages,
  tickets 19 (la frise lit par nom) et 20 (retrait du repli).

- `tsc --noEmit` et `npm run build` verts, **19 routes** (prototype compris),
  sur une copie exacte du commit (`git archive`) — la worktree portait en même
  temps le travail non commité du ticket 12.

**Pas vérifié** : rien n'a tourné en écriture sur la vraie base, ni le worker
sur ce code.

**Pour David, dans l'ordre** :
1. Merger dans `main` (le code marche avant ET après la `997`).
2. Un passage du worker **pour chaque compte Meta** — le cron du Jour de
   travail, ou GitHub Actions → `weekly-fetch.yml` à la main avec `user_id`.
   Le journal dit « N campagne(s) déclarée(s) » ; il les écrit avec leur ID.
3. SQL editor → coller `997_la_cle_de_config_meta_passe_a_l_id.sql` → exécuter.
   S'il refuse, le message liste les campagnes : renommées ou supprimées dans
   Meta, à rattacher (poser leur `campaign_id`) ou supprimer à la main.
4. Recopier ici la ligne du CONTRÔLE (attendu : `PRIMARY KEY (user_id,
   campaign_id)`, `sans_id` = 0).
