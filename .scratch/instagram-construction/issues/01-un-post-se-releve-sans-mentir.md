# 01: Un post se relève sans mentir

**What to build:** chaque lecture des métriques d'un post écrit la vérité en
base : les métriques demandées selon le format, une métrique que Meta ne rend
pas reste `NULL` (jamais 0), et la lecture ajoute un **Relevé** daté avec son
âge réel au lieu d'écraser. La base reçoit tout ce que la spec ajoute.

Spec : § La base (entière, section 23), § La récolte — Ce qui se corrige
(R1 à R4, temps de visionnage du Reel compris), § La récolte — Ce qui s'ajoute,
premier point (« Le relevé d'un post »), § Testing Decisions, seam 1.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Section 23 de la migration, en ajout seul : colonnes `shares`,
      `profile_visits`, `releve_a`, `booste_vu_le` (et le temps de visionnage
      du Reel) sur la fiche du post ; tables `instagram_post_releves` et
      `instagram_compte_jours` ; RLS en lecture au propriétaire comme
      `couverture_recolte`. Aucun `DROP`, `DELETE`, `TRUNCATE`.
      *(RLS par `a_acces(user_id)` et non propriétaire seul — arbitrage
      rendu du chantier : l'invité voit la même page, US 5.)*
- [x] R1 : métriques choisies par `media_product_type` (REELS / FEED ; FEED
      seul ajoute `follows`, `profile_visits` ; REELS ajoute le temps de
      visionnage moyen, nom relevé dans la doc Media Insights).
- [x] R2, R3 : plus aucun `or 0` ni `get(k, 0)` ; erreur 100 de `follows` sur
      un Reel → `NULL` ; 0 sur un post du fil reste 0.
- [x] R4 : `media_product_type` passe de la fiche aux métriques ; sans lui,
      `FEED` sans `follows`.
- [x] Chaque lecture ajoute une ligne de relevé (clé user/post/`releve_a`,
      `age_heures` réel) et met à jour le dernier relevé de la fiche.
- [x] Harnais « réponse Graph → lignes » hors réseau couvrant les cas
      ci-dessus ; `python3.12 -m py_compile` sur ce qui est touché.
- [x] Ce qui ne se vérifie qu'en vrai est écrit dans la réponse (migration
      non essayée sur PostgreSQL, premier relevé au cron suivant).

## Réponse

**Fait.**
- `000_run_me_all.sql` § 23 (ajout seul, aucun `DROP`/`DELETE`/`TRUNCATE`) :
  sur `instagram_organic_posts`, `shares`, `profile_visits`, `avg_watch_time`
  (temps de visionnage du Reel, `numeric`), `releve_a`, `booste_vu_le` ;
  tables `instagram_post_releves` (clé `user_id, post_id, releve_a`, index
  `user_id, age_heures`, colonne `booste` laissée au ticket 02) et
  `instagram_compte_jours` (clé `user_id, jour`). RLS : lecture par
  `a_acces(user_id)`, aucune politique d'écriture, hors liste 15.1, politiques
  hors `partage_*` pour ne pas fausser le contrôle A. Pas de clé étrangère
  vers la fiche (son unicité a été posée à la main, § 21). Lignes ajoutées au
  sommaire et au CONTRÔLE.
- `post_metrics.metriques_du_post(acces, post_id, media_product_type)` :
  REELS → un appel `reach,views,likes,comments,saved,shares,ig_reels_avg_watch_time`
  (repli sans le temps de visionnage sur une erreur 100, pour qu'il n'emporte
  pas la portée) ; FEED → le même sans temps de visionnage + un appel
  `follows,profile_visits` ; sans `media_product_type` → FEED sans follows.
  Plus aucun `or 0` : absence = `None`, 0 rendu = 0. Erreur 100 du second
  appel → `follows`/`profile_visits` à `None` ; toute autre erreur (ou
  exception réseau) → la lecture rend `None` en entier.
- `sync.lignes_du_post` (pur) : fiche + relevé (`age_heures` réel, arrondi au
  centième) ; lecture refusée → fiche sans métriques ni `releve_a`, aucun
  relevé ; fiche refusée (`{"error"}`) → rien d'écrit (avant : une ligne
  « IMAGE » fausse). `recolter` l'emploie et ajoute les relevés.
- `source_data/meta.py` : `insert_instagram_releves` (insert, jamais upsert ;
  table absente → le dit et continue) ; le repli « colonne absente » retire
  d'abord les colonnes de la 23, puis celles de la 22.
- `check_data_collection.py` inchangé et compatible (`recuperer` passe
  désormais `media_product_type`).

**Vérifié.**
- `python3.12 -I .scratch/instagram-construction/harnais/01-le-releve/test_releve.py`
  → 25 ✓, « TOUT EST VERT » (R1, R2/R3, R4, pannes, âge réel, fiche en
  erreur, écriture sur une base sans la 23).
- `python3.12 -m py_compile` sur `sync.py`, `post_metrics.py`,
  `source_data/meta.py`, `cockpit/check_data_collection.py` → OK.
- La section 23 et le fichier entier passent le parseur de PostgreSQL
  (`pglast.parse_sql` : 7 instructions dans la 23, 251 au total) — syntaxe
  seulement, rien d'exécuté.

**Ne se vérifie qu'en vrai.**
- La migration n'a tourné sur aucun PostgreSQL (aucun sur la machine) : à
  jouer par David dans Supabase, puis le bloc CONTRÔLE.
- Le nom `ig_reels_avg_watch_time` et son unité (ms d'après la doc) n'ont
  jamais été essayés avec notre jeton : le premier passage dira s'il revient
  (sinon la colonne reste `NULL`, la portée n'est pas perdue).
- Le premier relevé ne s'écrit qu'au prochain passage complet du worker — le
  cron de 07:00 UTC un Jour de travail (le passage léger quotidien est le
  ticket 04), ou un lancement à la main depuis l'onglet GitHub Actions
  (`weekly-fetch.yml`, avec `user_id`).
