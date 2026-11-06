# 04: Le passage léger quotidien

**What to build:** un nouveau mode du worker au cron de 07:00 UTC qui passe
chaque jour sur **tous les comptes Instagram, Jour de travail ou non** :
relevé des posts de moins de 8 × 24 h, première page de l'inventaire et fiche
des posts neufs (un post du mardi a son premier relevé le mercredi). Il ne
touche pas au rapport.

Spec : § La récolte — Ce qui s'ajoute, « Le passage léger quotidien » et
« La relecture » (premier tiret : chaque jour de J+0 à J+7).

**Blocked by:** 01

**Status:** resolved

- [x] Le mode tourne pour tous les comptes Instagram ; `_due_today` continue
      de gouverner le passage complet et le rapport.
- [x] Posts de moins de 8 × 24 h relevés (2 appels, 1 pour un Reel) ;
      `/media?limit=25` et fiche des posts absents de la base.
- [x] Une ligne de journal donne la durée du passage par compte (elle fixera
      la taille d'un bloc du Rattrapage, 08).
- [x] Le rapport hebdo n'est ni construit ni publié par ce mode.
- [x] Harnais : quels posts sont relevés à quel âge ; un jour hors Jour de
      travail passe quand même.

## Réponse

**Ce qui est fait**

- `cockpit/scheduled_update.py` : dans la boucle des profils, `passage.leger`
  tourne pour **chaque** profil, chaque jour, avant le test `_due_today` (qui
  gouverne toujours le complet et le rapport). Le Jour de travail aussi : la
  relecture complète plafonne encore les posts relus (40, levé par 03/07), le
  léger garantit le relevé du jour. `--report-only` ne le lance pas (aucune
  plateforme appelée). `_due_today` prend une date injectable (et quitte
  `utcnow`, déprécié).
- `orchestration/account_sync.leger(sb, uid)` : ne garde que les lignes
  `meta_token` + `instagram_business_id` (aucun appel pour les autres),
  vérifie le jeton, réutilise `planifier` et `_marquer` (jeton mort → pas
  d'appel, ligne de journal, connexion marquée). **Ni `Suivi` ni rapport** :
  une ligne `fetch_progress` d'un léger ferait oublier l'échec Meta du Jour
  de travail (`fetch_canaux_muets` ne lit que le dernier `run_id`). Une ligne
  de journal par compte : `instagram léger en 12.3 s — insta léger: …`. Une
  panne d'un compte se journalise (`sans_jeton`) sans couper les suivants.
- `fetchers/posts.recents(acces, plus_jeune_que)` : `/media?limit=25` avec les
  champs de la fiche (`caption, media_type, media_url, thumbnail_url,
  permalink, media_product_type`) — le relevé d'un post coûte alors ses seuls
  appels insights, **2 (1 pour un Reel)**, sans `info_du_post`. La page
  suivante n'est lue que si la dernière est encore plus jeune que 8 × 24 h
  (compte à plus de 3 posts/jour), coupe-circuit 8 pages.
- `sync.posts_du_jour` (pur) : moins de 8 × 24 h, ou absent de la base quel
  que soit l'âge ; un post en base à date illisible n'est pas relevé.
- `sync.releve_quotidien` : lit en base les seuls posts de l'inventaire
  (`in_`, ≤ 200 lignes), relève, écrit fiches + relevés (fonctions du
  ticket 01), image seulement hors stockage. N'écrit **ni**
  `total_posts_id_instagram` **ni** la couverture (il ne voit que le haut de
  l'inventaire). Un compte **sans aucun post en base** est laissé au premier
  passage complet : le gratuit n'y prend que ses 10 plus récents (spec § Le
  compte gratuit), le léger en aurait importé 25.
- `saas/data/fetch_data/CLAUDE.md` et la docstring du cockpit le disent.

**Vérifié**

    python3.12 -I .scratch/instagram-construction/harnais/04-le-passage-leger/test_passage_leger.py
    → TOUT EST VERT (19 vérifications : âges 1/191/192/193 h, absent, date
      illisible ; pages lues ; 1 appel Reel / 2 fil / 0 vieux en base ; aucune
      fiche `/{media-id}` ; âges des relevés ; images ; aucune table hors
      posts ; compte jamais récolté ; inventaire refusé lève ; un mardi :
      léger pour tous, complet pour le seul compte du mardi ; report-only sans
      léger ; jeton mort ; panne isolée ; ligne de durée)
    python3.12 -I .scratch/instagram-construction/harnais/01-le-releve/test_releve.py → TOUT EST VERT
    python3.12 -m py_compile (sync.py, posts.py, account_sync.py, scheduled_update.py) → OK

**Ce qui ne se vérifie qu'en vrai** — au **cron suivant de 07:00 UTC** (ou un
lancement à la main depuis l'onglet GitHub Actions, `weekly-fetch.yml`, mode
`mise_a_jour` sans `user_id`) : les lignes `instagram léger en … s` du
journal, des relevés dans `instagram_post_releves` pour les posts de moins de
8 jours un jour qui n'est pas le Jour de travail (la table n'existe qu'après
la section 23), et que Meta rend bien `media_url`/`media_product_type` dans la
liste `/media` comme dans `/{media-id}` (documenté, non essayé avec notre
jeton). La durée relevée fixera le bloc du Rattrapage (08).

Pour les tickets suivants : le **relevé du compte** (05) et **un bloc du
Rattrapage** (08) s'ajoutent dans `account_sync.leger`, à côté de
`releve_quotidien`. Le marqueur de boost (02) ajoute `boost_ads_list` aux
champs de `posts.recents` (avec le repli si le champ est refusé).
