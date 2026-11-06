# 01: Un post se relève sans mentir

**What to build:** chaque lecture des métriques d'un post écrit la vérité en
base : les métriques demandées selon le format, une métrique que Meta ne rend
pas reste `NULL` (jamais 0), et la lecture ajoute un **Relevé** daté avec son
âge réel au lieu d'écraser. La base reçoit tout ce que la spec ajoute.

Spec : § La base (entière, section 23), § La récolte — Ce qui se corrige
(R1 à R4, temps de visionnage du Reel compris), § La récolte — Ce qui s'ajoute,
premier point (« Le relevé d'un post »), § Testing Decisions, seam 1.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Section 23 de la migration, en ajout seul : colonnes `shares`,
      `profile_visits`, `releve_a`, `booste_vu_le` (et le temps de visionnage
      du Reel) sur la fiche du post ; tables `instagram_post_releves` et
      `instagram_compte_jours` ; RLS en lecture au propriétaire comme
      `couverture_recolte`. Aucun `DROP`, `DELETE`, `TRUNCATE`.
- [ ] R1 : métriques choisies par `media_product_type` (REELS / FEED ; FEED
      seul ajoute `follows`, `profile_visits` ; REELS ajoute le temps de
      visionnage moyen, nom relevé dans la doc Media Insights).
- [ ] R2, R3 : plus aucun `or 0` ni `get(k, 0)` ; erreur 100 de `follows` sur
      un Reel → `NULL` ; 0 sur un post du fil reste 0.
- [ ] R4 : `media_product_type` passe de la fiche aux métriques ; sans lui,
      `FEED` sans `follows`.
- [ ] Chaque lecture ajoute une ligne de relevé (clé user/post/`releve_a`,
      `age_heures` réel) et met à jour le dernier relevé de la fiche.
- [ ] Harnais « réponse Graph → lignes » hors réseau couvrant les cas
      ci-dessus ; `python3.12 -m py_compile` sur ce qui est touché.
- [ ] Ce qui ne se vérifie qu'en vrai est écrit dans la réponse (migration
      non essayée sur PostgreSQL, premier relevé au cron suivant).
