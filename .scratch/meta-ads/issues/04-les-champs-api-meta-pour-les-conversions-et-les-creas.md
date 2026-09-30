# Les champs API Meta pour les conversions et le contenu des créas

Type: research
Status: resolved
Blocked by: —

## Question

`meta_ads_insights` porte aujourd'hui `impressions, clicks, reach, link_clicks,
spend` — et rien d'autre. Il manque **toute la catégorie Conversion** et **tout le
contenu des créas**. Décision déjà prise : ça vient de l'API Meta, jamais de GA4
(`docs/adr/0010`).

À établir, sources primaires seulement :

**Les conversions**
1. Quels champs de `/insights` portent les conversions : `actions`,
   `action_values`, `conversions`, `cost_per_action_type`,
   `cost_per_conversion` ? Lequel est le bon pour « conversions, coût par
   conversion, taux de conversion » ?
2. Ces champs arrivent comme des **listes de types d'action**, pas comme un
   nombre. Quels types existent, et lequel est « la » conversion pour un client
   qui ne configure rien ? C'est une question de produit autant que d'API —
   ramener les faits, pas trancher.
3. La fenêtre d'attribution : Meta attribue à la date du **clic**, pas de la
   conversion. Conséquence directe sur « toute comparaison exclut le jour en
   cours » (`CLAUDE.md` §7) et sur le recouvrement de récolte
   (`_RECOUVREMENT_JOURS_META = 7`) : une conversion peut apparaître sur une date
   déjà récoltée. Documenter le comportement exact.

**Le contenu des créas**
4. Quel chemin donne l'image, la vignette, la vidéo, le titre, le texte et la
   description d'une annonce : `/{ad-id}?fields=creative{...}`,
   `/{ad-id}/adcreatives`, `object_story_spec`, `asset_feed_spec` ? Lequel couvre
   le cas de plusieurs assets sous une annonce ?
5. Les URL d'image de Meta **expirent**-elles ? Si oui, il faut les téléverser
   dans Supabase Storage — le précédent existe :
   `saas/collecte/meta/fetch_instagram.py::_upload_image_to_storage`.

**Le coût**
6. Combien d'appels supplémentaires par passage de récolte, et où sont les limites
   de débit ? `fetch_instagram.py` documente déjà « un post relu = 3 appels
   Graph » : le même calcul, pour les annonces.

**Livrable** : `.scratch/meta-ads/recherche/champs-api-meta.md` — les champs
exacts, la forme de ce qu'ils renvoient (un exemple de réponse JSON vaut dix
phrases), et la liste des colonnes à ajouter.

## Answer

Rapport complet, 1195 lignes, 38 références à developers.facebook.com, aucun appel
API réel : [`.scratch/meta-ads/recherche/champs-api-meta.md`](../recherche/champs-api-meta.md).

### Les conversions ne coûtent aucun appel de plus

Ce sont des **champs de la requête `/insights` que `_meta_chunk` fait déjà** :
`action_values, cost_per_action_type, conversions, cost_per_conversion,
inline_link_clicks, attribution_setting, date_stop`. C'est la bonne nouvelle du
ticket.

**Les cinq candidats sont TOUS des `list<AdsActionStats>`, jamais un nombre.** Le
choix reste à David ; le fait qui l'éclaire : `conversions` est le seul champ dont
la doc dit « The results you see here are based on your objective » — donc le seul
qui donne quelque chose sans que le client configure quoi que ce soit.

**Il n'existe AUCUN champ « taux de conversion » chez Meta.** Il se calcule chez
nous, et le dénominateur est un choix produit (`clicks` ou `inline_link_clicks`) :
il devra être **écrit à l'écran**, pas supposé.

**PIÈGE MAJEUR — les `action_type` s'emboîtent** : `link_click` ⊂
`post_engagement` ⊂ `page_engagement`. **Ne jamais sommer la liste** : on
compterait le même clic trois fois. Contrainte pour les tickets 05 et 07.

### L'attribution : la prémisse du ticket était périmée

Depuis le 10 juin 2025, `action_report_time` est **ignoré** et tout passe en
`mixed` : les actions on-Meta (`link_click`) tombent sur la date de
l'**impression**, les actions off-Meta (achats pixel) sur la date de la
**conversion**.

- Oui, une action peut retomber sur une date déjà récoltée — les on-Meta, jusqu'à
  7 jours en arrière par défaut (`["7d_click","1d_view"]`), plus loin selon le
  réglage de l'ad set, qui pilote désormais.
- **Plus rattrapable au-delà de 28 jours** : « Insights refresh every 15 minutes and
  do not change after 28 days of being reported ».
- **Donc `_RECOUVREMENT_JOURS_META = 7` laisse un trou de 21 jours.** Ticket 09
  ouvert là-dessus.

### Les créas : `GET /{ad-id}?fields=creative{...}`, pas `/adcreatives`

Trois montages à lire **tous les trois**, parce qu'une annonce n'en utilise qu'un :
champs plats · `object_story_spec` (titre = `link_data.name`, texte = `message`) ·
`asset_feed_spec` (le multi-assets : ≤10 images, ≤5 titres, ≤5 textes), plus
`child_attachments` pour le carrousel classique.

**Les URL d'image expirent.** `AdImage.url` est « a temporary URL », seul
`permalink_url` est « a permanent URL », et la doc dit noir sur blanc « You should
not use image URLs returned from the FB CDN ». Donc téléversement dans Supabase
Storage, sur le modèle de `fetch_instagram.py::_upload_image_to_storage`, et on
garde `image_hash` — **seule clé stable** d'une image.

### Le coût est supportable, et ce n'est pas le quota qui coûte

7 appels Graph par passage pour 20 annonces (1 `/ads` avec expansion, 1
`/adimages?hashes=[]`, 1 par vidéo), 26 si l'expansion ne passe pas sur `creative`.
Contre 1 100/h en Ads Management standard : **2,4 %**. **Le poste cher est le
stockage des images, pas l'API.**

### Les colonnes : 3 ajouts et 3 tables neuves

Sur `meta_ads_insights` : `date_stop`, `attribution_setting`, `inline_link_clicks`.
Puis `meta_ads_actions` (une ligne par `action_type`), `meta_ads_creatives` (une
ligne par annonce, **pas** par jour), `meta_ads_creative_assets` (clé = le rang,
aucun `asset_id` n'étant documenté hors mesure).

**La raison de ne PAS faire une colonne unique** est la bonne : elle figerait dans
l'historique le choix du type d'action qui compte comme « la » conversion, et un
type absent deviendrait `0`. À valider au ticket 07, qui tient le contrat.

### Ce qui reste ouvert, et qui est dit honnêtement

- **Aucun exemple JSON avec `actions` n'existe sur developers.facebook.com** (8
  pages vérifiées) : la forme donnée dans le rapport est **déduite des types**, pas
  copiée d'un exemple. À confirmer au premier appel réel.
- `AdsInsightsResult` est introuvable (404), alors que `objective_result_rate` est
  peut-être la meilleure réponse à « quelle est LA conversion ».
- `cost_per_conversion` n'a pas de description dans la doc.
- La fenêtre d'attribution par défaut d'un ad set neuf n'est pas documentée.
- Le tier d'accès de l'app Pulse est inconnu (change le plafond de quota).
- L'expansion de champs sur `creative` n'est vérifiable qu'avec un jeton.
