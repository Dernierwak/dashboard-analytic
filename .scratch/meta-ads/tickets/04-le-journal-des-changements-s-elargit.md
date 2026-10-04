# 04: Le journal des changements s'élargit

Type: task
Status: ready-for-human
Blocked by: 03

**What to build:** le journal couvre ce que le client fait vraiment dans Ads
Manager, et chaque changement d'un groupe d'annonces ou d'une annonce sait à
quelle campagne il appartient. Spec : § « Le journal des changements » ; user
stories 25, 27. Décision d'origine : ticket 08 de la carte.

Seam de test : « réponse `/activities` → lignes à écrire ». Le ticket **écrit son
harnais**.

- [x] La récolte garde aussi les enchères (`update_ad_set_bidding`,
      `update_ad_set_bid_strategy`, `update_ad_bid_info`…), le statut des annonces
      (`update_ad_run_status`) et les créations (`create_campaign_group`,
      `create_ad_set`, `create_ad`). La revue de Meta n'est pas retenue
- [~] Chaque nouveau type a sa phrase, rédigée à partir d'un `extra_data` **réel** ;
      un type dont on n'a pas vu d'exemple n'a pas de phrase inventée (testé : un
      type connu rend sa phrase, un type inconnu ne rend rien)
- [x] La campagne parente d'un changement de groupe ou d'annonce se retrouve
      **par l'ID**, grâce à la hiérarchie que la récolte voit dans `/insights` ;
      absente quand l'ID est inconnu (testé)
- [x] `python3.12 -m py_compile` sur ce qui a été touché
- [ ] **Après un passage du worker** (`weekly-fetch.yml` lancé à la main) : des
      changements de groupe ou d'annonce portent leur campagne en base ; les
      `extra_data` des nouveaux types sont recopiés ici

## Comments

**2026-10-03 — construit, en attente du worker.** Commit sur la branche
`worktree-meta-ads-tickets-construction`.

- **Récolte** (`saas/collecte/meta/fetch_meta_ads.py`) : `_ACTIVITES` garde
  `update_ad_run_status`, `update_ad_set_bidding`, `update_ad_set_bid_strategy`,
  `update_ad_bid_info`, `create_campaign_group`, `create_ad_set`, `create_ad`.
  Le seam pur est `lignes_activites(actes, parents)` ; `fetch_activities` n'est
  plus que l'appel réseau autour.
- **Les phrases — écart à valider par David.** Aucun `extra_data` réel n'a pu
  être lu pour ces types (la sonde qui lisait un jeton client a été refusée,
  à raison). Plutôt que de ne rien rendre, chaque nouveau type a une phrase qui
  ne dit que ce que le **type d'événement** établit, sans aucune valeur :
  « l'enchère de l'ensemble "X" a été modifiée », « l'annonce "X" a été
  créée », « le statut de l'annonce "X" a été modifié ». Testé : une valeur
  glissée dans `extra_data` n'apparaît pas. Les valeurs (montant d'enchère,
  « mise en pause ») viendront une fois un `extra_data` réel recopié ici.
- **Catégorie `creation`** (choix de David) : la CHECK de `platform_changes`
  s'élargit dans le `000` (section 14) — `DROP CONSTRAINT IF EXISTS` + `ADD`,
  aucune ligne touchée. Le web la lit « création ».
- **La campagne parente par l'ID** : `hierarchie_depuis_insights` (pur) tire
  ensemble/annonce → campagne des lignes de `meta_ads_insights` que le ticket
  03 remplit ; `fetch_meta_hierarchie` les lit paginées, tout l'historique.
  ID inconnu → campagne absente. Colonnes absentes (42703) → rattachement
  sauté ; toute autre erreur saute le journal du passage plutôt que d'écrire
  des NULL. Un changement sans campagne n'envoie plus les colonnes campagne à
  l'upsert : un passage qui ne retrouve plus un ID n'efface pas un
  rattachement acquis (`lots_sans_effacer_la_campagne`).
- **Délai d'un passage** : la hiérarchie est lue avant les insights du jour ;
  un ensemble créé dans la semaine gagne sa campagne au passage suivant.

**Vérifié** : harnais `.scratch/meta-ads/harnais/04-le-journal/` (18 tests,
`python3.12 -m pytest .scratch/meta-ads/harnais/04-le-journal -q`) ;
`py_compile` des quatre fichiers Python ; requête PostgREST construite hors
réseau (`campaign_id=not.is.null`, tri `date_start,ad_id`) ; `000` joué deux
fois sur PostgreSQL 15 jetable chargé (ancien `000` + lignes) et deux fois
vierge : exit 0, lignes intactes, `creation` accepté, catégorie inconnue
refusée, contrôle 50 ✓ (le seul ✗ vient du stub sans RLS, identique avant) ;
`saas/web` : `tsc` et `build` verts, 19 routes.

**Pas vérifié** : la vraie base, et le comportement réel de Meta.

**Pour David, dans l'ordre** :
1. Jouer le `000` sur Supabase **avant** le prochain passage du worker. Sans
   ça, le premier passage qui rencontre une création voit tout son lot de
   changements Meta refusé.
2. Lancer `weekly-fetch.yml` à la main (onglet GitHub Actions) avec `force`,
   après le rejeu du ticket 03 (sinon la hiérarchie est vide).
3. Vérifier en base : `select categorie, campaign_id is not null, count(*)
   from platform_changes where channel='meta' group by 1,2`.
4. Recopier ici, anonymisé, un `extra_data` par nouveau type — à lire
   soi-même dans l'Explorateur de l'API Graph (`/act_<id>/activities?fields=
   event_type,extra_data`). Le journal du worker est public : ne pas l'y
   imprimer.

**Découvert en chemin (non traité)** : la hiérarchie relit tout l'historique
de `meta_ads_insights` à chaque passage (une ligne par annonce et par jour,
paginée par 1 000) pour en tirer un petit dictionnaire. Acceptable aujourd'hui ;
à surveiller sur un gros compte.
