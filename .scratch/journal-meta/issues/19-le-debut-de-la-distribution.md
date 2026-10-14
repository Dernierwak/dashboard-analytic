# 19: Le jour où une annonce commence à diffuser

Type: task
Status: resolved
Blocked by: None

## Le constat

David, le 2026-10-14, en comparant l'historique d'Ads Manager d'une annonce
avec le panneau de Pulse : Ads Manager montre « Publicité distribuée — Début
de la distribution » (le 27 août, par « Meta »), et Pulse ne le montre pas.
Les cinq autres événements de cette annonce sont en base, avec les mêmes
heures et le même avant → après.

## Pourquoi il manquait

La récolte ne garde qu'une liste fermée de types (`_ACTIVITES`,
`saas/data/fetch_data/sources/meta/ads/fetchers/activities.py`), faite des
gestes du client. Le début de la distribution est écrit par Meta.

## Le type, vérifié sur un vrai compte — 2026-10-14

Lecture seule de `/activities` du 26 au 29 août 2026, sur les deux connexions
(script hors du dépôt). Le type est **`first_delivery_event`** :

- 19 des 88 activités de la fenêtre, une par annonce qui démarre ;
- acteur « Meta », `object_type` ADGROUP (l'annonce, dans le vocabulaire
  interne de Meta — `recherche/activities.md`, O2) ;
- `translated_event_type` « Publicité distribuée » / « Werbeanzeige
  ausgeliefert » selon la langue du jeton ;
- `extra_data`, IDs remplacés :

      {"campaign_id": <ID du groupe, en nombre>, "old_value": null,
       "new_value": "Début de la distribution", "type": "delivery_event"}

  `new_value` vaut « Auslieferung gestartet » sur l'autre connexion.

Au passage : `ad_account_billing_charge` (le compte facturé, acteur Meta)
existe aussi. Non retenu — personne ne l'a demandé.

## Décisions — David, 2026-10-14

- **On le montre.** C'est un fait de la plateforme qui dit quand la dépense
  d'une annonce démarre, et il ne se répète pas. La revue (`ad_review_*`)
  reste écartée.
- **Nouvelle catégorie `diffusion`.** Phrase de la récolte : « l'annonce "…" a
  commencé à diffuser » ; la carte affiche une rubrique « Diffusion » avec la
  valeur de Meta, sans avant.

## Ce qui est construit

- Récolte : `first_delivery_event` → `diffusion`, niveau `annonce` (son nom
  n'a pas de préfixe `_NIVEAUX`), groupe lu dans `extra_data.campaign_id`
  comme pour `create_ad`.
- Schéma : `diffusion` ajouté à la CHECK de `platform_changes.categorie` dans
  le `000` — remplacement de contrainte, aucune ligne touchée.
- Écran : `lireExtra("diffusion")` (rubrique « Diffusion »), nature
  « Diffusion », mot « diffusion » dans le fil, catégorie connue de
  `changements-api.ts`, et la phrase « ce que le journal ne couvre pas » de la
  Tendance.
- Harnais `harnais/19/` : `verifier.py` 15/15 (récolte, sur la forme réelle
  dans les deux langues) et `diffusion.test.ts` 3/3 (lecture à l'écran).
  Harnais 12, 13 et 18 toujours verts. `tsc` et `build` verts, 18 routes.

## Acceptance criteria

- [x] Le nom du type vérifié sur un vrai compte.
- [x] La récolte garde `first_delivery_event` sous `diffusion`, au niveau
      annonce, rangé sous son groupe et sa campagne.
- [x] La carte du panneau dit « Diffusion » et la valeur de Meta, sans la
      traduire.
- [x] **Le `000` appliqué en base AVANT le passage du worker** — sinon la CHECK
      refuse tout le lot de changements Meta du compte, pas seulement ces
      lignes.
- [ ] *(non vérifié — voir la résolution)* Après fusion sur `main` et un passage du worker lancé à la main
      (`weekly-fetch.yml` : `mode` = `mise_a_jour`, `force` coché, `user_id`
      du compte, comme au ticket 16 — la récolte relit 180 jours de
      changements), les lignes `diffusion` du 27 août sont en base et visibles
      sur `/meta`.

## Résolution — 2026-10-14

**Accepté par David sur la foi des harnais**, comme le ticket 18. Le `000` est
appliqué en base par David. La récolte n'a pas encore tourné avec ce code :
il n'est pas sur `main` (PR #7, fusion reportée) et un passage du worker prend
environ deux heures. **Les lignes `diffusion` n'ont donc été vues ni en base ni
sur `/meta`.** Rien ne se perd en attendant : la récolte relit 180 jours de
changements, et le 27 août reste à portée jusqu'à fin février 2027. Le premier
passage après la fusion les écrira ; un écart vu alors rouvre ce ticket.
