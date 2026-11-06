# 02: Le marqueur de boost

**What to build:** à chaque relevé d'un post, Pulse sait s'il a été boosté —
au moins une annonce hors `error` listée par Instagram — et le garde pour
toujours (`booste_vu_le`), sans aucun chiffre payant.

Spec : § La récolte — Ce qui s'ajoute, « Le marqueur de boost » ; vocabulaire
« Boosté » ; § Testing Decisions, seam 1.

**Blocked by:** 01, 04 (mêmes fichiers de récolte que 04 — en série)

**Status:** resolved

- [x] `boost_ads_list` lu au même appel que les métriques, aucune relecture
      de plus ; dédoublonné par `ad_id`, statuts en minuscules.
- [x] Boosté = au moins une annonce hors `error` ; le booléen du moment va
      dans le relevé ; `booste_vu_le` prend la date la première fois et ne se
      vide jamais.
- [x] Harnais : une annonce `error` seule ne marque pas ; `booste_vu_le`
      jamais vidé par un relevé sans annonce.

## Réponse

**Ce qui est fait**

- `fetchers/boost.py` (nouveau) : `est_booste(media)` — au moins une annonce
  hors `error`, dédoublonnée par `ad_id`, statuts en minuscules → `True` ;
  aucune → `False` ; champ non obtenu → `None` (inconnu, jamais « non
  boosté »). `obtenu(media)` pose une liste vide quand le champ a été demandé
  et accepté mais que Meta ne l'écrit pas : seule l'absence née d'un repli se
  lit « inconnu ».
- `boost_ads_list` demandé **au même appel que la fiche** — la fiche du post
  et ses métriques viennent du même passage, le champ ne peut pas aller dans
  l'appel `/insights` (c'est un champ du média, pas une métrique) : dans
  `post_metrics.info_du_post` (passage complet) et dans `posts.recents`
  (passage léger ; les pages suivantes suivent `next`, qui garde les champs).
  Aucun appel de plus. Si le champ est refusé (toute la requête échoue, cf.
  l'essai), la fiche / la page se relit sans lui : boost inconnu ce jour-là,
  rien d'autre perdu. Un appel de plus seulement quand Meta refuse (y compris
  pour un post supprimé ou un jeton mort, qui échouent deux fois).
- `sync.lignes_du_post(..., booste_vu_le=)` : le relevé porte `booste`
  (booléen du moment, `None` si inconnu) ; la fiche reçoit `booste_vu_le` =
  date (UTC) du relevé **à la première vue seulement**, et ne l'envoie jamais
  sinon — l'upsert ne peut donc ni la déplacer ni la vider. Lu avec la fiche,
  il se pose même si les métriques ont été refusées.
- `sync._en_base` : la lecture des posts en base (celle de l'image) lit aussi
  `booste_vu_le` ; base sans la section 23 (42703) → relue sans la colonne, le
  passage continue et le dit. Employée par `recolter` (`_a_relire`) et
  `releve_quotidien`. La lecture complète reste non paginée comme avant
  (piège 4 de la note de récolte, tickets 03/07).
- `source_data/meta.py` : commentaire de `COLONNES_SECTION_23` à jour (le
  repli « colonne absente » couvrait déjà `booste_vu_le`). Aucun changement
  SQL : la colonne `booste` du relevé existe déjà dans la section 23.

**Vérifié**

    python3.12 -I .scratch/instagram-construction/harnais/02-le-marqueur-de-boost/test_boost.py
    → TOUT EST VERT (23 vérifications : `error` seule / répétée ne marque pas,
      terminée marque, majuscules, liste vide, champ refusé = None ; date à la
      première vue, jamais renvoyée ensuite, jamais vidée par un relevé sans
      annonce ; un seul appel fiche, repli sans le champ ; inventaire du jour
      avec et sans le champ ; passage léger : booléens, dates en base
      intactes, base sans la 23)
    python3.12 -I .scratch/instagram-construction/harnais/01-le-releve/test_releve.py → TOUT EST VERT
    python3.12 -I .scratch/instagram-construction/harnais/04-le-passage-leger/test_passage_leger.py → TOUT EST VERT
    python3.12 -m py_compile (sync.py, fetchers/*.py, source_data/meta.py, check_data_collection.py) → OK

**Ce qui ne se vérifie qu'en vrai** — au **cron suivant de 07:00 UTC** (le
passage léger tourne chaque jour), ou par un lancement à la main depuis
l'onglet GitHub Actions (`weekly-fetch.yml`, avec `user_id` pour un passage
complet) : que Meta rende `boost_ads_list` sur `/{media-id}` comme sur
`/media` (l'essai l'a lu sur `/media`), des `booste` dans
`instagram_post_releves` et des `booste_vu_le` posés — après la section 23.
Les vieux posts hors relevés ne reçoivent leur date qu'à la relecture unique
(ticket 03).
