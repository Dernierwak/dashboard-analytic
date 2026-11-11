# 05: La récolte des créas

Type: task
Status: ready-for-human
Blocked by: 02

**What to build:** Pulse garde le contenu de chaque annonce — texte, titre,
description, bouton, visuel, adresse de destination, variantes et cartes de
carrousel — et ses visuels restent lisibles dans six mois. Spec : § « Les créas » ;
user stories 37 à 43. Décisions d'origine : tickets 04, 06 et 14 de la carte.

Seam de test : « réponse de l'endpoint des créas → lignes à écrire ». Le ticket
**écrit son harnais**.

**Décision ouverte, à poser à David avant de construire** : le bucket des visuels
d'annonces est-il **public** comme `post-images` (les visuels sont déjà diffusés
publiquement par Meta, mais une annonce en pause ou jamais diffusée devient
lisible par URL), ou **privé** avec URL signées à la lecture ? La réponse s'écrit
ici.

**Réponse de David (2026-10-05) : public.** Bucket `ad-creatives`, créé par le
`000` (section 0bis), fichiers rangés sous `<user_id>/<image_hash>`.

- [x] Le contenu se lit **une requête par page d'annonces**, pas une par annonce
- [x] Les trois montages (`flat`, `object_story`, `asset_feed`) et le carrousel
      donnent chacun leurs lignes (testé)
- [x] Une adresse de destination absente reste vide — rien ne se fabrique (testé)
- [x] Les images sont téléversées dans Supabase Storage, repérées par
      `image_hash` : la même image n'est jamais téléversée deux fois (patron : le
      téléversement de la récolte Instagram)
- [x] Aucun chiffre par asset n'est récolté (ticket 03 de la carte)
- [x] L'appel de la récolte des créas dans l'orchestration ne marche pas sur la
      partie que le ticket 03 touche (les deux peuvent tourner de front)
- [x] `python3.12 -m py_compile` sur ce qui a été touché
- [ ] **Après un passage du worker** (`weekly-fetch.yml` lancé à la main) : les
      tables de créas sont remplies, un visuel s'ouvre depuis Storage ; ce qui
      diffère de la doc Meta est recopié ici

## Comment

**2026-10-03 — trouvé en revue du ticket 02.** `meta_ads_creative_assets` a pour
clé `(user_id, ad_id, provenance, asset_kind, rang)`. Un upsert ne retire donc
rien : une annonce qui passe de 5 textes à 3, ou du carrousel à `asset_feed`,
garderait ses anciennes lignes, et le Panneau montrerait des textes que Meta ne
diffuse plus. La récolte doit **remplacer tous les assets d'une annonce** à
chaque passage : effacer ceux de `(user_id, ad_id)`, puis insérer. Ce `DELETE`
est borné à l'annonce relue. Rien ne lie non plus ces assets à
`meta_ads_creatives` par une clé étrangère.

**2026-10-05 — construit, en attente du worker.** Branche
`worktree-meta-ads-tickets-construction`.

- **Récolte** (`saas/collecte/meta/fetch_meta_ads.py`) :
  `fetch_annonces_creas` fait un `GET /act_<id>/ads?fields=id,creative{…}` par
  page de 100 annonces. Le seam pur est `lignes_creas(user_id, annonces,
  stockees)`. Il produit une ligne `meta_ads_creatives` par annonce et les
  assets (`asset_feed` : body/title/description/image/video/link_url/
  call_to_action ; carrousel : une ligne `carousel_card` par carte, plus une
  ligne `description` au même rang quand la carte en a une — la table n'a
  qu'une colonne `texte`).
- **Quatrième montage, `publication`** (trouvé en revue). Une créa qui pointe
  un post existant (`object_story_id`, le post boosté) n'a ni spec ni texte.
  La ranger en `flat` aurait fait lire « créa vide ». Le schéma n'a pas de
  CHECK, rien à migrer. **Son texte n'est pas lu**, il vit dans le post : à
  décider si le Panneau doit aller le chercher.
- **Images** : `hashes_des_creas` dit ce qui doit être en stockage. Le bucket
  est listé (`fetch_images_creas_stockees`, paginé), et seuls les hashes
  absents passent par `/adimages?hashes=[…]` (un appel par lot de 50), puis
  par le téléchargement et l'envoi. **Une image non téléversée s'écrit sans
  URL, jamais avec celle de Meta**, qui expire. C'est un écart volontaire au
  patron Instagram. Le hash reste, et le passage suivant réessaie.
- **Écriture** (`remplacer_creas`, `saas/commun/insert_data.py`) : upsert des
  créas, puis `DELETE` des assets `(user_id, ad_id ∈ annonces relues)`, puis
  insert. Une annonce qui n'a plus aucun asset perd aussi les siens (testé).
  **Pas atomique** : si l'insert échoue après le delete, ces annonces n'ont
  plus d'assets jusqu'au passage suivant. C'est accepté en best-effort, et
  l'échec s'imprime.
- **Orchestration** : `_creas_meta` (best-effort, `try` global) est appelée
  dans `_fetch_meta` après le journal des changements, **avant** le
  garde-fou des insights. Les lignes du ticket 03 ne sont pas touchées.

**Vérifié** : harnais `.scratch/meta-ads/harnais/05-les-creas/` (19 tests :
`python3.12 -m pytest .scratch/meta-ads/harnais/05-les-creas -q`). Tous les
harnais Python de l'arbre passent (73). `py_compile` passe sur les quatre
fichiers. Revue de code sur deux axes (standards, spec), corrections
appliquées.
**Non vérifié** : l'`INSERT INTO storage.buckets` du `000` n'a été joué sur
aucun PostgreSQL. Aucun n'était disponible sur la machine.

**À faire par David, dans l'ordre** :
1. Rejouer `supabase/migrations/000_run_me_all.sql`. Sans ce rejeu, le bucket
   `ad-creatives` n'existe pas : la liste du bucket échoue et l'étape créas
   s'imprime `KO` sans rien écrire.
2. Lancer `weekly-fetch.yml` à la main depuis l'onglet GitHub Actions
   (`user_id` du compte de test ; `force` n'est pas nécessaire, les créas se
   relisent à chaque passage). Le journal doit afficher une ligne
   `créas meta : N annonce(s), M asset(s), X image(s) téléversée(s), Y
   restée(s) sans visuel`.

**À regarder au premier passage, et à recopier ici** :
- si l'expansion `creative{…}` sur `/ads` est acceptée (réserve S25 de la
  recherche § 4) ;
- si les vignettes vidéo (`thumbnail_hash`, `video_data.image_hash`) sont
  rendues par `/adimages`. Sinon elles resteront « sans visuel » ;
- si `/ads` sans filtre `effective_status` rend les annonces archivées ou
  supprimées. Probablement non, ce qui n'est pas vérifié ; un compte connecté
  tard n'aurait alors pas les créas de ses vieilles annonces ;
- une vidéo sans aucun hash de vignette (créa `flat` avec `video_id`) n'a
  pas de vignette. `thumbnail_url` expire et n'est pas stockée.

**2026-10-07 — `000` rejoué par Claude** (`supabase db query --linked`), 50 contrôles verts, bucket `ad-creatives` créé ; rien de détruit (`reco_news` et les colonnes de `profiles` étaient déjà parties). Reste : le passage du worker, puis la vérification en base.
