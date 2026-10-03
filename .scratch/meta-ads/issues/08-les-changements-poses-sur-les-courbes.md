# Les changements posés sur les courbes

Type: prototype
Status: resolved
Blocked by: 05

## Question

Le brief appelle ça « la fonctionnalité clé » : les modifications faites sur les
campagnes (budget, enchères, audience, créas, statut) apparaissent en petits
points sur les courbes, aux dates concernées ; un clic ouvre un panneau latéral
avec tous les changements de ce jour-là ; si un filtre campagne est actif, le
panneau ne montre que cette campagne.

**Bonne nouvelle, et c'est le point de départ du ticket : la récolte existe
déjà.**
- La table `platform_changes` est en place (`supabase/migrations/platform_changes.sql`,
  section 14 du `000_run_me_all.sql` : « ce que les plateformes déclarent avoir
  changé »).
- `saas/collecte/meta/fetch_meta_ads.py::fetch_activities` récolte l'endpoint
  `activities` de Meta (`event_type, event_time, object_id, object_name,
  extra_data`) et **traduit déjà** les types en langage produit
  (`update_ad_creative` → `creatif`, etc.).
- Le composant `saas/web/components/changements.tsx` existe, avec
  `trierChangements`, et `lib/changements-api.ts` les lit. Ils sont utilisés sur la
  page `/` aujourd'hui.

Donc rien à récolter. Ce qui reste est une question de **forme et de vérité**.

**Ce qu'il faut décider**
1. **Un point par jour ou un point par changement ?** Une journée où le client a
   touché huit ad sets ne peut pas porter huit points lisibles sur une courbe.
2. **À quoi le point se rattache.** `platform_changes` porte `object_id` et
   `object_name` : un changement d'ad set se pose-t-il sur la courbe de la
   campagne parente ? Si oui, il faut le lien ad set → campagne, et ce lien passe
   par le contrat du ticket 07 (d'où la dépendance à vérifier : ce ticket peut
   commencer sur 05 seul, mais il pourrait devoir attendre 07 pour cette partie —
   le dire dans la réponse plutôt que de le contourner).
3. **Ce qui n'a pas de point.** Meta ne déclare pas tout. Un changement fait hors
   de l'interface, ou un type que `_traduire_meta` ne connaît pas, n'apparaît
   nulle part. Un dashboard qui laisse croire que « pas de point = rien n'a
   changé » ment. Comment le dire à l'écran ?
4. **Le panneau latéral est-il le même que celui des assets** (ticket 06) ? Un seul
   mécanisme de panneau vaut mieux que deux.
5. **Le lien qui ouvre un jour.** `CLAUDE.md` §8 : un lien énumère ce qu'il
   CHANGE, jamais ce qu'il garde — sinon il perd par construction tout paramètre
   ajouté après lui, en produisant une URL valide. Le dashboard aura une bascule
   de module, un filtre campagne et une période : le lien vers un jour doit les
   préserver sans les énumérer.

**Ce que le prototype doit rendre** : la maquette des points et du panneau sur une
courbe réelle, et les réponses écrites aux cinq points ci-dessus.

## Comments

**2026-10-01 — le point 4 a sa moitié de réponse.** Le ticket 06 a choisi le
panneau latéral pour lire une annonce, ouvert depuis le module Comparaison
(voir son `## Answer`). Le panneau des changements doit donc être **le même
mécanisme** : ce ticket décide seulement ce qu'il montre pour un jour, pas s'il
en faut un second.

**2026-10-01 — les points 1 et 2 sont tranchés par David.**
- **Point 1.** Un seul point par jour sur la courbe : petit, léger, de couleur,
  sans crayon ni nombre — il grossit au survol pour qu'on comprenne qu'il se
  clique. Un clic ouvre le panneau latéral avec les changements de ce jour-là.
  « Un point par changement » et « le nombre dedans » sont écartés.
- **Point 2.** Sans filtre, le panneau montre tous les changements du jour.
  Avec un filtre campagne, les points et le panneau ne montrent que la campagne
  filtrée, **ses ensembles et ses annonces compris**. Conséquence pour la
  construction : `platform_changes.campaign_id` n'est rempli aujourd'hui que
  pour un changement fait au niveau campagne (`fetch_meta_ads.py`,
  `_NIVEAU_CAMPAGNE`) ; la récolte devra retrouver la campagne parente d'un
  ensemble ou d'une annonce **par l'ID** (clé du ticket 07). Un élément dont
  Meta ne rend plus la campagne n'apparaît que sans filtre, et le panneau
  filtré le compte en une ligne.

**2026-10-01 — le point 3 change de nature (correction soulevée par David).**
« Meta ne déclare pas tout » était faux pour l'essentiel : l'endpoint
`/activities` documente 119 `event_type`, dont les enchères
(`update_ad_set_bidding`, `update_ad_set_bid_strategy`, `update_ad_bid_info`…),
les créations (`create_ad`, `create_ad_set`, `create_campaign_group`), le
statut d'une annonce (`update_ad_run_status`) et la revue
(`ad_review_declined`). Source :
https://developers.facebook.com/docs/marketing-api/reference/ad-activity/ —
« one week's data by default ». C'est **la récolte** qui écarte tout ce que
`_ACTIVITES` ne connaît pas (six types). La question devient donc : quelles
familles récolter. Le prototype montre Enchère, Création et Revue.

## Answer

Tranché avec David le 2026-10-01, sur le prototype
`saas/web/app/meta/prototype-modules/prototype.tsx` (`/meta/prototype-modules`).

1. **Un point par jour.** Petit, léger, de couleur, sans crayon ni nombre ; il
   grossit au survol pour dire qu'il se clique. Un clic ouvre le panneau avec
   les changements de ce jour, rangés par campagne, chacun avec son heure, sa
   nature, sa phrase et l'élément touché (campagne, ensemble, annonce).
2. **Le rattachement suit le filtre.** Sans filtre : tous les changements du
   jour. Avec un filtre campagne : les points et le panneau ne montrent que la
   campagne filtrée, ses ensembles et ses annonces compris. **À construire** :
   la récolte retrouve la campagne parente d'un ensemble ou d'une annonce par
   l'ID (clé du ticket 07) — aujourd'hui `campaign_id` n'est rempli qu'au
   niveau campagne. Un élément dont Meta ne rend plus la campagne n'apparaît
   que sans filtre ; le panneau filtré le compte en une ligne.
3. **Ce qu'on récolte, et ce qu'on avoue.** Meta déclare bien plus que ce que
   la récolte garde. **À construire** : `_ACTIVITES` s'élargit aux enchères
   (`update_ad_set_bidding`, `update_ad_set_bid_strategy`, `update_ad_bid_info`…),
   au statut des annonces (`update_ad_run_status`) et aux créations
   (`create_campaign_group`, `create_ad_set`, `create_ad`). La revue de Meta
   n'est pas retenue. Ce que le journal ne couvre pas se dit dans une
   info-bulle « ⓘ » sur la légende, et nulle part ailleurs — ni ligne sous la
   courbe, ni pied de panneau.
4. **Le même panneau que la lecture d'une annonce** (ticket 06) ; ouvrir l'un
   ferme l'autre.
5. **Le jour ouvert vit dans l'URL** (`?jour=`), comme l'annonce lue
   (`?annonce=`). Le lien ne change que `jour` et `annonce` ; filtre, période
   et module sont gardés sans être énumérés (`CLAUDE.md` §8). Un jour hors de
   la période choisie ne s'ouvre pas.

Les phrases en français sont des propositions du prototype : la rédaction
exacte de chaque nouveau type se fera à la construction, à partir de
`extra_data` réel.
