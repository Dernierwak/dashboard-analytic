# 05: La récolte des créas

Type: task
Status: ready-for-agent
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

- [ ] Le contenu se lit **une requête par page d'annonces**, pas une par annonce
- [ ] Les trois montages (`flat`, `object_story`, `asset_feed`) et le carrousel
      donnent chacun leurs lignes (testé)
- [ ] Une adresse de destination absente reste vide — rien ne se fabrique (testé)
- [ ] Les images sont téléversées dans Supabase Storage, repérées par
      `image_hash` : la même image n'est jamais téléversée deux fois (patron : le
      téléversement de la récolte Instagram)
- [ ] Aucun chiffre par asset n'est récolté (ticket 03 de la carte)
- [ ] L'appel de la récolte des créas dans l'orchestration ne marche pas sur la
      partie que le ticket 03 touche (les deux peuvent tourner de front)
- [ ] `python3.12 -m py_compile` sur ce qui a été touché
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
