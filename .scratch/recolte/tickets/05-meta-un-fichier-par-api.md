# 05: Meta — un fichier par API, l'écriture à part

Type: task
Status: resolved
Blocked by: 02

**What to build:** `saas/collecte/meta/` rangé selon `../map.md`. Chaque
fichier d'API expose `recuperer(jeton, fenetre, limite=None) -> (lignes,
trous)` et **ne touche pas Supabase**. Les upserts Meta vont dans
`collecte/ecriture/meta.py`. **Aucun comportement ne change.**

- `meta/graph.py` : UNE pagination Graph (curseur suivi au bout, plafond
  coupe-circuit, erreur rendue). Elle remplace `_meta_chunk`, `_meta_campagnes`,
  `_pages`, la boucle de `fetch_activities` et celle d'Instagram.
- `meta/ads/` : comptes, insights, campagnes, budgets, activites, creas, images.
- `meta/organique/instagram/` : compte, posts, metriques.
- Le code Meta de `fetch_all.py` (`_meta_chunk`, `_meta_campagnes`,
  `_creas_meta`, `_hierarchie_meta`, `_fetch_meta`) le rejoint.

- [x] `limite` respecté par chaque fichier (s'arrête après N éléments)
- [x] `fetch_all.py` ne contient plus aucun appel à `graph.facebook.com`
- [ ] `git grep` des anciens chemins propre (`saas/web/legal/` compris, numéros
      de ligne mis à jour)
- [x] `python3.12 -m py_compile` — [ ] **Essai (ticket 08)** sur un vrai compte : mêmes lignes Meta
      et Instagram

## Comment

**2026-10-07 — construit et vérifié hors ligne. L'Essai (08) reste à passer ;
les références dans `saas/web/` restent à corriger (hors de mon périmètre).**

La forme :
```
meta/graph.py                AccesMeta, lire(), pages() — LA pagination Graph
meta/ads/comptes.py          /me/adaccounts, compte_et_fuseau
meta/ads/budgets.py          /campaigns + /adsets, centimes()
meta/ads/activites.py        /activities + traduction (lignes_activites, hierarchie)
meta/ads/creas.py            /ads?fields=creative{…} + lignes_creas, hashes_des_creas
meta/ads/images.py           /adimages
meta/ads/insights.py         /insights par tranche + lignes_meta_ads
meta/ads/campagnes.py        /campaigns déclarées + lignes_config_meta
meta/ads/recolte.py          l'ordre des appels + écritures (ex _fetch_meta)
meta/organique/instagram/    posts.py · compte.py · metriques.py · recolte.py
ecriture/meta.py             upserts Meta + Instagram + téléversements
ecriture/plateformes.py      platform_budgets, platform_changes (Meta et Google)
```
Contrat d'un fichier d'API : `recuperer(acces, fenetre=None, limite=None) ->
(lignes, trous)`, lecture seule. Deux exceptions documentées dans leur
docstring : `images.recuperer(acces, hashes, limite)` et
`metriques.recuperer(acces, post_ids, limite)` lisent ce que les créas et
l'inventaire ont nommé. `meta/fetch_meta_ads.py` et `meta/fetch_instagram.py`
sont supprimés ; `saas/commun/insert_data.py` a perdu les écritures Meta et
partagées (les fonctions mortes y restent, `saas/commun/CLAUDE.md`).
`fetch_all.py` garde `_recolter_meta` (la note de l'écriture sautée vit là où
vit l'ensemble rouge) et un adaptateur `_en_trous` pour Google jusqu'au 06.

Ce qui change, tout petit, et pourquoi :
- La pagination unique arrête toute liste sur une page VIDE qui porte encore
  un `next` (c'était déjà le cas pour activités, créas, Instagram ; c'est
  désormais aussi le cas pour insights, budgets et campagnes).
- Une pagination interrompue se DIT là où elle était silencieuse : ad sets et
  campagnes des budgets (une ligne de journal, l'écriture reste la même),
  inventaire Instagram (une erreur de page 2+ ne lève plus : la liste lue
  s'écrit et la troncature s'imprime, comme le plafond de 60 pages).
- Plafond des campagnes déclarées : 50 pages au total (51 avant).
- Une erreur Graph en page 2+ des insights devient un trou nommé (avant, elle
  était lue comme une page vide).

Vérifié :
- `python3.12 -m py_compile` sur tout `saas/collecte`, `saas/commun`,
  `saas/traitement` ; `pyflakes saas/collecte` sans remarque.
- `harnais/05_meta.py` → `TOUT VERT` : pagination (curseur, page vide,
  plafond, erreur en page 2, erreur en page 1, `limite` sans page de trop,
  JSON non-objet) ; `limite` de chaque fichier d'API ; récolte Meta Ads de bout
  en bout contre un faux Graph et une fausse base (insights, config, budgets
  avec ad sets, changement traduit avec fuseau, créas + téléversement) ;
  schéma en retard → `SchemaEnRetard` après budgets et changements ; récolte
  Instagram de bout en bout (post connu en entier côté base, image pas
  re-téléversée, `total_posts`) ; inventaire refusé → `ValueError` comme avant.
- `harnais/01_trous.py`, `harnais/02_socle.py` → `TOUT VERT`.
- Les harnais de `.scratch/meta-ads/harnais/` 04, 05 et 13 (seams purs du
  journal, des créas, de la config) : imports mis à jour, **60 passed**.

Pas fait — références dans `saas/web/`, interdit à ce ticket (consigne du
coordinateur) :
- `saas/web/legal/META_APP_REVIEW.md` l. 24-28, 98, 110 — nouveaux
  emplacements : insights `saas/collecte/meta/ads/insights.py` l. 40 ;
  `/campaigns` `meta/ads/budgets.py` l. 73 et `meta/ads/campagnes.py` l. 35 ;
  `/adsets` `meta/ads/budgets.py` l. 40 ; `/activities`
  `meta/ads/activites.py` l. 184 ; `/media`
  `meta/organique/instagram/posts.py` l. 39 ; `/<post_id>` et
  `/<post_id>/insights` `meta/organique/instagram/metriques.py` l. 16 et 25 ;
  `followers_count` `meta/organique/instagram/compte.py` l. 11.
- Commentaires : `saas/web/components/meta/tendance.tsx` l. 34,
  `saas/web/components/suivi-recolte.tsx` l. 114, `saas/web/lib/channels.ts`
  l. 819-821.
- `.scratch/meta-ads/` (tickets, recherche) : historique, laissé tel quel.

Pas vérifié : contre les vraies API (Essai, ticket 08).
