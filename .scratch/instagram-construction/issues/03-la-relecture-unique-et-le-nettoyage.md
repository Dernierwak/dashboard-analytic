# 03: La relecture unique et le nettoyage

**What to build:** un drapeau dédié de `weekly-fetch.yml` relit tous les posts
en base (sans image), ce qui remplit `media_product_type`, `permalink`,
`shares`, `profile_visits`, `booste_vu_le`, les j'aime des vidéos et vide
`follows` des Reels. Le même drapeau servira au trimestriel (07). Puis le
nettoyage des faux zéros restants, **validé par David**.

Spec : § La récolte — Ce qui s'ajoute, « La relecture unique » ; § La base,
« Le nettoyage » ; § Testing Decisions, « Ce qui ne se vérifie qu'en vrai ».

**Blocked by:** 01, 02

**Status:** needs-human — la relecture se lance à la main (GitHub Actions, `relecture_instagram`), puis la sonde, puis le nettoyage validé par David.

- [x] Le drapeau s'ajoute au workflow sans interpolation shell d'une entrée
      libre (même garde que les entrées existantes).
- [x] La relecture passe par le même chemin que le relevé (01, 02), 2 à 3
      appels par post, sans image.
- [x] Le `SELECT count(*)` et l'`UPDATE … SET follows = NULL, likes = NULL`
      sont écrits dans ce ticket, **pas dans la migration**, et pas exécutés :
      David lance le workflow, fait le comptage, valide, puis exécute.
- [x] Harnais : le mode relit tous les posts en base et seulement eux.
- [ ] Le ticket reste ouvert (Status: needs-human) tant que David n'a pas
      lancé la relecture et rejoué la sonde.

## Réponse

**Ce qui est fait**

- `sync.relire_tous(sb, uid, acces)` : lit **tous** les posts du compte en
  base, paginé par 1 000 sur un ordre total `post_id` (`_all_pages`,
  `CLAUDE.md` §8 — le piège signalé par 02), et seulement eux : aucun
  inventaire `/media`. Chaque post passe par le chemin du relevé (01, 02) :
  `info_du_post` (avec `boost_ads_list`) puis `metriques_du_post` → 2 appels
  pour un Reel, 3 pour le fil ; un post supprimé coûte 2 fiches (repli sans
  `boost_ads_list` du ticket 02) et n'écrit rien. **Sans image** : rien de
  téléversé, `media_url` jamais envoyée. Fiches + relevés écrits **tous les
  100 posts** : un job coupé ne perd que le lot en cours. Une exception
  réseau sur une fiche compte le post refusé au lieu d'arrêter la relecture.
  Ni couverture, ni `total_posts_id_instagram`, ni `fetch_progress`.
- `cockpit/instagram_reread.py` (`--user UID` facultatif) : chaque compte
  Instagram au jeton valide (`planifier`), un jeton mort marqué « à
  reconnecter » comme son journal l'annonce, une panne d'un compte ne coupe
  pas les suivants et rend la run rouge (`sans_jeton` sur le message). Une
  ligne de journal par compte avec sa durée. Ni rapport ni `fetch_progress`.
  N'importe rien de privé de `account_sync.py` (ticket 06).
- `weekly-fetch.yml` : entrée `relecture_instagram` (booléen, défaut
  `false` — le web dispatche sans elle), passée par `env: RELECTURE_IG`,
  comparée à `"true"`, testée en premier dans le `if` ; avec `user_id`, ce
  compte seul. Aucune interpolation `${{ }}` dans le script.
- `saas/data/fetch_data/CLAUDE.md` : la quatrième commande du cockpit.

**Vérifié**

    python3.12 -I .scratch/instagram-construction/harnais/03-la-relecture-unique/test_relecture.py
    → TOUT EST VERT (24 vérifications : seuls les posts du compte en base, aucun
      /media ; 3 / 2 / 2 appels ; aucune image ; supprimé sans écriture ;
      media_product_type, permalink, shares, profile_visits ; Reel : likes lus,
      follows None ; booste_vu_le posé une fois, jamais renvoyé, pas pour
      `error` seule ; âge réel ; 2 501 posts relus une fois chacun, lecture en
      3 tranches de 1 000, écriture par lots ; mode : tous / --user / jeton
      mort marqué / panne isolée et run rouge / aucune table de suivi ;
      workflow : booléen faux par défaut, env, pas de `${{` dans le script)
    harnais 01, 02, 04, 05 → TOUT EST VERT
    python3.12 -m py_compile sync.py cockpit/instagram_reread.py → OK
    bash -n sur le script de l'étape « Run fetch worker » → OK

**Ce qui ne se vérifie qu'en vrai — à faire par David, dans cet ordre**

1. Jouer la section 23 de `000_run_me_all.sql` (si ce n'est pas fait), puis
   son bloc CONTRÔLE.
2. **Lancement à la main depuis l'onglet GitHub Actions** (`weekly-fetch.yml`,
   case `relecture_instagram` cochée, `user_id` vide pour les deux comptes) —
   pas le cron. Durée attendue : de l'ordre de 3 appels × ~470 posts, bien
   sous le plafond de 6 h ; la ligne `instagram relecture en … s` la donne.
   Rien ne l'a encore exécutée contre Meta.
3. Rejouer la sonde (`.scratch/instagram/issues/14-…md`, § 0), lecture seule :

```sql
SELECT count(*)                                   AS posts,
       count(*) FILTER (WHERE releve_a IS NULL)   AS jamais_relus,
       count(media_product_type)                  AS avec_produit,
       count(permalink)                           AS avec_lien,
       count(shares)                              AS avec_partages,
       count(booste_vu_le)                        AS boostes_vus,
       count(*) FILTER (WHERE media_product_type = 'REELS' AND follows IS NOT NULL) AS reels_avec_follows,
       count(*) FILTER (WHERE type = 'VIDEO' AND likes = 0) AS videos_a_0_jaime
FROM public.instagram_organic_posts;
```

   Attendu : `reels_avec_follows` = 0 ; `jamais_relus` = les posts que Meta
   a refusés (supprimés) — le journal en donne le nombre (« N refusé(s) »).

4. **Le nettoyage — compter, montrer, valider, PUIS exécuter** (écriture
   qui efface, `CLAUDE.md` §7 ; hors de la migration rejouable, qui « ne met
   rien qui efface ») :

```sql
-- a. Comptage (lecture seule) — même condition que l'UPDATE.
SELECT user_id, count(*)
FROM public.instagram_organic_posts
WHERE type = 'VIDEO' AND media_product_type IS NULL
GROUP BY user_id;

-- b. Après validation seulement. Le « UPDATE n » affiché doit égaler la
--    somme du comptage ; sinon ROLLBACK.
BEGIN;
UPDATE public.instagram_organic_posts
SET follows = NULL, likes = NULL
WHERE type = 'VIDEO' AND media_product_type IS NULL;
COMMIT;
```

   Pourquoi cette condition : un `VIDEO` que la relecture a relu porte
   désormais son `media_product_type` ; ceux qui en restent privés sont ceux
   que Meta n'a pas rendus, et leurs `follows`/`likes` à 0 sont les faux
   zéros de l'ancien défaut `"REEL"` (sonde du 2026-11-06 : 124 vidéos,
   toutes à 0).

**Critères**

- [x] Le drapeau s'ajoute au workflow sans interpolation shell d'une entrée
      libre (même garde que les entrées existantes).
- [x] La relecture passe par le même chemin que le relevé (01, 02), 2 à 3
      appels par post, sans image.
- [x] Le `SELECT count(*)` et l'`UPDATE … SET follows = NULL, likes = NULL`
      sont écrits dans ce ticket, pas dans la migration, et pas exécutés.
- [x] Harnais : le mode relit tous les posts en base et seulement eux.
- [ ] David a lancé la relecture et rejoué la sonde — d'où `needs-human`.
