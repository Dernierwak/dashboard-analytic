# Spec — Le dashboard Meta Ads refondu

Status: ready-for-agent
Carte : [`map.md`](map.md) · Brief d'origine : [`brief.md`](brief.md) ·
ADR : `docs/adr/0010`, `docs/adr/0011` · Vocabulaire : `CONTEXT.md`

Écrite le 2026-10-03 à partir des tickets clos 01 à 16 de la carte. Rien n'y est
inventé : chaque décision renvoie à son ticket. Les trois choix que la carte
laissait ouverts sont tranchés **par défaut** et signalés comme tels (§ Notes) —
David peut les renverser sans toucher au reste.

---

## Problem Statement

Le client de Pulse ouvre la page Meta Ads et ne peut pas répondre aux trois
questions qu'il se pose en sortant d'Ads Manager : *mes campagnes touchent-elles
du monde, font-elles cliquer, font-elles convertir ?* La page actuelle est l'héritage
de l'ancienne app Streamlit : une métrique à la fois, aucune conversion (la base
n'en récolte pas), aucun moyen de comparer deux annonces sur la durée, et les
changements faits dans le compte vivent sur une autre page, loin des courbes
qu'ils expliquent.

Pire, elle peut **mentir sans le dire** :
- une campagne renommée dans Meta devient une campagne neuve, son historique
  coupé en deux (la clé est le nom) ;
- au-delà de 1 000 lignes, la lecture est tronquée en silence ;
- un jour récolté n'est relu que pendant 7 jours alors que Meta le corrige
  pendant 28 — le chiffre se fige avant d'être celui d'Ads Manager ;
- pour lire le texte d'une annonce, il faut quitter Pulse et retourner sur Meta.

## Solution

Une page Meta Ads faite de **cinq modules nommés**, dans l'ordre du brief, qui
seront les mêmes — nom, rôle, place — sur Google Ads (ADR 0011) :

1. **Bandeau de commandes** — collant, il porte le titre, la date à laquelle Pulse
   a lu Meta, le choix de la campagne et de la période ; au défilement il se
   détache en pilule flottante et le Sélecteur de vue s'y replie.
2. **Sélecteur de vue** — trois cartes, Notoriété / Trafic / Conversion. Elles
   reconfigurent tout ce qui suit ; elles ne filtrent rien, toutes les campagnes
   sont dans chacune.
3. **Tendance** — le total filtré, un graphe par métrique de la vue, la période
   d'avant en pointillé, et un petit point par jour de changement qui ouvre le
   Panneau latéral.
4. **Comparaison** — une liste classée de groupes d'annonces ou d'annonces ; on
   en coche jusqu'à quatre, qui se tracent dans deux graphes, un par métrique.
   Chaque annonce a une cible visible « Lire » qui ouvre son contenu dans le
   Panneau latéral.
5. **Tableau détaillé** — Campagne › Groupe d'annonces › Annonce, colonnes de la
   vue, à exporter.

Et le **Panneau latéral**, un seul, qui s'ouvre soit sur un jour (ses
changements), soit sur une annonce (son contenu et la page vers laquelle elle
envoie).

Tous les chiffres sont ceux de Meta, recopiés : les conversions sont la colonne
« Résultats » d'Ads Manager, le clic est « Clics (tous) », les ratios sont
recalculés total ÷ total comme Ads Manager le fait, et l'écran dit **à quelle date
Pulse a lu Meta**. Ce qui ne se mesure pas s'affiche « — », jamais « 0 ».

---

## User Stories

### Lire la page

1. En tant que client, je veux voir en haut de la page la date à laquelle Pulse a lu Meta (« Chiffres Meta au <Jour de travail>, 07:00 »), afin de comprendre tout seul pourquoi un chiffre diffère d'Ads Manager consulté plus tard.
2. En tant que client, je veux que les chiffres d'un jour de plus de 28 jours soient identiques à mon Ads Manager, afin de faire confiance à Pulse sans tout revérifier.
3. En tant que client, je veux que le jour en cours ne soit jamais compté, afin de ne pas lire une journée incomplète comme une chute.
4. En tant que client, je veux que tous les intitulés soient en français et dans le vocabulaire de Pulse (« groupe d'annonces », jamais « ad set »), afin de ne pas lire du jargon de régie.
5. En tant que membre invité, je veux voir exactement la même page que le propriétaire, afin de travailler sur les mêmes chiffres — sans jamais avoir accès aux jetons Meta.

### Bandeau de commandes

6. En tant que client, je veux choisir une campagne dans un menu avec recherche, pastille de couleur et dépense de la période, afin de retrouver vite celle dont je parle.
7. En tant que client, je veux que le choix d'une campagne resserre toute la page — Sélecteur, Tendance, points de changement, Comparaison, Tableau — afin de lire une campagne d'un bout à l'autre.
8. En tant que client, je veux choisir la période par des raccourcis (7 jours à 12 semaines) ou par un calendrier sur deux mois, afin de lire la durée qui m'intéresse.
9. En tant que client, je veux que toute période soit comparée à la période d'avant de même durée, afin de savoir si ça monte ou si ça baisse.
10. En tant que client, je veux que le bandeau reste visible quand je descends dans la page, et qu'il se replie en pilule avec la vue active dedans, afin de ne jamais perdre de vue ce que je regarde.
11. En tant que client, je veux qu'un lien partagé rouvre la page exactement dans l'état où je l'ai vue (vue, campagne, période, jour ou annonce ouverts), afin de pouvoir l'envoyer à mon patron.

### Sélecteur de vue

12. En tant que client, je veux trois cartes Notoriété / Trafic / Conversion qui portent chacune une icône, la question à laquelle elles répondent, leur chiffre principal et son écart, afin de voir les trois réponses avant même de cliquer.
13. En tant que client, je veux comprendre au premier regard que ces cartes se cliquent et qu'elles changent toute la page, afin de ne pas les prendre pour des tuiles décoratives.
14. En tant que client, je veux que la vue Notoriété montre impressions et CPM, afin de savoir combien de fois on m'a vu et à quel prix.
15. En tant que client, je veux que la vue Trafic montre clics, CTR et CPC, tous calculés sur « tous les clics », et que l'écran le dise, afin de retrouver les chiffres de mon Ads Manager.
16. En tant que client, je veux que la vue Conversion montre les résultats, le coût par résultat et le taux de conversion (résultats ÷ clics, dénominateur écrit), afin de savoir ce que mes campagnes rapportent en actions.
17. En tant que client, je veux que toutes mes campagnes restent présentes quelle que soit la vue, afin de ne pas perdre une campagne parce que son objectif déclaré est différent.
18. En tant que client, je veux qu'une campagne de notoriété affiche « — » dans la vue Conversion, jamais « 0 », afin de ne pas croire qu'elle a échoué à quelque chose qu'elle ne cherchait pas.

### Tendance

19. En tant que client, je veux voir le total de la sélection jour par jour, un graphe par métrique de la vue, afin de voir comment l'ensemble évolue.
20. En tant que client, je veux que la métrique principale soit en grand et les autres à côté, afin de savoir où regarder d'abord.
21. En tant que client, je veux la période d'avant en pointillé sur le même graphe, afin de comparer sans calcul.
22. En tant que client, je veux un petit point discret, de couleur, sur la courbe principale chaque jour où quelque chose a changé dans mon compte, afin de relier une variation à une modification.
23. En tant que client, je veux que ce point grossisse au survol, afin de comprendre qu'il se clique.
24. En tant que client, je veux qu'un clic sur ce point ouvre le Panneau latéral avec tous les changements de ce jour, rangés par campagne, chacun avec son heure, sa nature, sa phrase et l'élément touché, afin de comprendre ce qui a bougé.
25. En tant que client qui a filtré une campagne, je veux que les points et le panneau ne montrent que cette campagne — ses groupes et ses annonces compris — afin de ne pas être noyé par les autres.
26. En tant que client, je veux qu'une info-bulle « ⓘ » sur la légende me dise ce que le journal des changements ne couvre pas, afin de ne pas conclure qu'un jour sans point est un jour où rien n'a changé.
27. En tant que client, je veux voir les changements de budget, de statut, de ciblage, de visuel, d'enchère, et les créations de campagnes, groupes et annonces, afin que le journal couvre ce que je fais réellement dans Ads Manager.
28. En tant que client, je veux qu'un jour vide de données s'affiche comme un trou, pas comme un zéro, afin de ne pas lire une panne de récolte comme une chute.

### Comparaison

29. En tant que client, je veux basculer la Comparaison entre groupes d'annonces et annonces, afin de comparer au niveau où je prends mes décisions.
30. En tant que client, je veux une liste classée par la métrique 1, avec pour chaque élément sa vignette (pour une annonce), une barre et les valeurs des deux métriques, afin de voir d'un coup qui fait mieux que qui.
31. En tant que client, je veux cocher jusqu'à quatre éléments, qui se tracent alors dans deux graphes côte à côte, un par métrique, afin de suivre leur évolution dans le temps.
32. En tant que client, je veux choisir la métrique 1 et la métrique 2 parmi celles de la vue, et que choisir pour l'une la métrique de l'autre les échange, afin que les deux graphes montrent toujours deux choses différentes.
33. En tant que client, je veux qu'une cinquième case se refuse de manière visible plutôt que d'en décocher une en silence, afin de garder le contrôle de ce que je compare.
34. En tant que client, je veux voir sur chaque annonce une cible « Lire » visible au repos, distincte de la case qui coche, afin de savoir où appuyer pour lire son contenu.
35. En tant que client, je veux que deux annonces portant le même nom restent deux lignes distinctes, afin de ne pas mélanger leurs chiffres.
36. En tant que client, je veux que l'élément sans valeur pour la métrique de classement se range en bas avec « — », afin qu'il ne soit ni caché ni classé comme nul.

### Panneau latéral — lire une annonce

37. En tant que client, je veux lire dans Pulse le texte, le titre, la description, le bouton et le visuel d'une annonce, tels qu'ils s'affichent dans le fil, afin de ne pas devoir retourner sur Meta.
38. En tant que client qui a monté une annonce à plusieurs textes ou plusieurs visuels, je veux voir chaque variante en entier, numérotée, afin de savoir ce que j'ai mis en ligne.
39. En tant que client qui a un carrousel, je veux voir chaque carte du carrousel, afin de relire toute l'annonce.
40. En tant que client, je veux un lien sortant « l'annonce envoie vers… » lu dans l'annonce elle-même, afin de vérifier la page d'arrivée sans la taper nulle part.
41. En tant que client, je veux qu'une annonce sans adresse dans sa créa n'affiche pas de lien plutôt qu'un lien inventé, afin de ne pas être envoyé au mauvais endroit.
42. En tant que client, je ne veux aucun chiffre à côté d'un texte, d'un visuel ou d'une variante, et une phrase qui dit pourquoi, afin de ne pas croire que Pulse mesure ce que Meta ne mesure pas.
43. En tant que client, je veux que les visuels s'affichent encore dans six mois, afin que l'historique de mes annonces reste lisible.

### Panneau latéral — commun

44. En tant que client, je veux un seul panneau à droite, qui se ferme quand j'en ouvre un autre, afin de ne jamais avoir deux couches ouvertes.
45. En tant que client, je veux que le jour ou l'annonce ouverts soient dans l'adresse de la page, afin que « retour » et un lien partagé les rouvrent.
46. En tant que client, je veux qu'un jour en dehors de la période choisie ne s'ouvre pas, afin de ne pas lire des changements sans les chiffres qui vont avec.

### Tableau détaillé

47. En tant que client, je veux un tableau Campagne › Groupe d'annonces › Annonce, dépliable, afin de retrouver tout le détail.
48. En tant que client, je veux que les colonnes suivent la vue active, afin de lire dans le tableau les mêmes métriques qu'au-dessus.
49. En tant que client, je veux que les ratios de chaque ligne soient recalculés sur la ligne (total ÷ total), afin qu'une ligne parent ne soit jamais la moyenne de ses enfants.
50. En tant que client, je veux exporter le tableau tel que je le vois, afin de le retravailler dans mon tableur.
51. En tant que client, je veux qu'une campagne renommée dans Meta reste une seule ligne, sous son nom le plus récent, afin de ne pas voir son historique coupé en deux.

### Conversions et honnêteté

52. En tant que client, je veux que mes conversions soient celles de la colonne « Résultats » d'Ads Manager, sans règle maison, afin de lire le même nombre aux deux endroits.
53. En tant que client, je veux qu'une info-bulle « ⓘ » des conversions me dise selon quel réglage d'attribution elles sont comptées (« 7 j après clic, 1 j après vue »), afin de savoir ce que le nombre veut dire.
54. En tant que client dont les groupes d'annonces ont des réglages d'attribution différents, je veux que l'écran le dise à l'endroit du chiffre, afin de ne pas comparer des choses qui ne se comparent pas.
55. En tant que client dont la sélection mélange des résultats de natures différentes (achats et prospects), je veux que le total ne les additionne pas, afin de ne pas lire un nombre qui ne veut rien dire.
56. En tant que client, je veux qu'un ratio dont le diviseur est nul ou absent s'affiche « — », et qu'aucun écart ne s'écrive « +∞ % », afin de ne jamais lire un chiffre fabriqué.

### Ceux qui maintiennent Pulse

57. En tant que David, je veux que la récolte relise les 28 derniers jours à chaque passage, afin que Pulse recopie Meta jusqu'à ce que Meta cesse de corriger.
58. En tant que David, je veux que la récolte stocke `results` brut, `NULL` quand le champ manque, afin de lire sa forme réelle dans la base avant de décider de son affichage.
59. En tant que David, je veux que la migration qui change la clé de la config de campagne refuse de tourner tant qu'une campagne n'a pas d'ID, afin de ne rien perdre en silence.
60. En tant que développeur qui construira Google Ads, je veux retrouver les cinq mêmes modules sous les mêmes noms, afin de savoir quoi construire sans redécider.

---

## Implementation Decisions

### La structure (ADR 0011)

- **Le socle est la liste des modules, pas une forme de données.** Bandeau de
  commandes, Sélecteur de vue, Tendance, Comparaison, Tableau détaillé, plus le
  Panneau latéral. Chaque module Meta est **son propre code** ; seules des briques
  visuelles neutres (carte, graphe en courbe, panneau, bandeau, menu) se partagent
  et ne savent rien de la plateforme. Pas de vue SQL commune, pas de type unique
  rempli par Meta et Google.
- **La page `/meta` actuelle est remplacée**, pas complétée. Le prototype
  `/meta/prototype-modules` sert de référence visuelle validée (ticket 05) et
  **part avec sa route** quand la page est construite : le compte de routes
  revient à **18**.
- Le prototype contient encore des variantes rejetées (lecture T et S, bande
  « créas comparées », comparaison A/B) : **seules les décisions de cette spec
  font foi**, pas le prototype.

### Les vues et leurs métriques (tickets 05, 07)

| Vue | Chiffre principal | Métriques |
|---|---|---|
| Notoriété | impressions | impressions, CPM |
| Trafic | clics | clics, CTR, CPC |
| Conversion | résultats | résultats, coût par résultat, taux de conversion |

- **Clic = tous les clics** (champ `clicks`, « Clics (tous) »), partout : métrique
  Trafic, CTR, CPC, diviseur du taux de conversion. L'écran écrit « tous les
  clics » là où il en affiche un.
- **Ratios recalculés sur la période, total ÷ total**, jamais stockés, jamais
  moyennés : CPM = dépense ÷ impressions × 1 000 ; CTR = clics ÷ impressions ×
  100 ; CPC = dépense ÷ clics ; coût par résultat = dépense ÷ résultats ; taux =
  résultats ÷ clics × 100. Diviseur nul ou absent → « — ».
- **Portée et fréquence ne s'affichent pas** (ticket 07 ; au `BACKLOG.md`).
- **Écart** contre la période d'avant de même durée ; une base absente ou nulle
  rend « — », jamais « +∞ % ».
- **La vue ne filtre pas** : toutes les campagnes sont dans chacune. Le tri par
  objectif déclaré est hors périmètre.

### Les conversions (tickets 07, 09, 15, 16)

- **Conversion = la colonne « Résultats » d'Ads Manager = le champ `results`** de
  `/insights`, une liste. La récolte le **stocke brut**, tel que Meta le rend ;
  champ absent → `NULL`, liste vide → liste vide, jamais `0`.
- **L'affichage du module Conversion se fixe après le premier passage du worker
  qui récolte `results`** : sa forme d'élément, le cas notoriété et l'effet de la
  fenêtre d'attribution se lisent dans la base, pas dans la doc. Ce n'est pas une
  option : le ticket de construction de la vue Conversion est **bloqué** par ce
  passage.
- Règles qui tiennent quelle que soit la forme : le type du résultat voyage avec
  son nombre ; des résultats de types différents **ne s'additionnent pas** (le
  total affiche « — » et l'info-bulle dit pourquoi) ; une annonce sans résultat
  rendu affiche « — ».
- **`attribution_setting` est stocké** et dit dans l'info-bulle « ⓘ » des
  conversions. Une sélection qui mélange plusieurs réglages l'écrit à l'endroit
  du chiffre.
- Aucune jointure GA4, aucun chiffre d'une autre plateforme (ADR 0010).

### La fraîcheur (ticket 09)

- **Le recouvrement Meta passe de 7 à 28 jours.** Le commentaire du recouvrement
  est réécrit avec la vraie raison (Meta corrige jusqu'à 28 jours ;
  `action_report_time=mixed`), l'ancien (« conversion au jour du CLIC ») étant
  périmé.
- Le Bandeau écrit **« Chiffres Meta au <Jour de travail>, 07:00 »** (formulation
  exacte à la construction), lu dans la date du dernier passage réussi.
- **Aucune zone « provisoire »**, et la règle « on exclut le jour en cours » ne
  s'élargit pas.
- L'appel en direct à Meta depuis l'app est écarté.

### L'identité par ID (ticket 07)

- Campagne, groupe d'annonces et annonce sont **identifiés par leur ID Meta** ; le
  nom affiché est le plus récent. Les regroupements, filtres, liens (`?campagne=`)
  et clés de liste utilisent l'ID.
- **Migration, étape A (sans risque, dans le `000`)** : `campaign_id` et
  `adset_id` nullables sur `meta_ads_insights`, `campaign_id` nullable sur
  `meta_campaign_config`. La récolte demande `campaign_id,adset_id` dans la même
  requête `/insights` (zéro appel de plus). Les lignes anciennes se remplissent
  par un **rejeu** (`weekly-fetch.yml`, `meta_since` à la plus vieille date en
  base), **jamais** par une jointure sur le nom.
- **Migration, étape B (destructive au sens de `CLAUDE.md` §7 — proposée, jouée
  par David, une fois, après le rejeu)** : la clé de `meta_campaign_config` passe
  de `(user_id, campaign_name)` à `(user_id, campaign_id)`. Le SQL est au ticket 07 ;
  il reporte l'ID seulement quand un nom désigne une seule campagne, puis
  **refuse de tourner** tant qu'une ligne n'a pas d'ID. Le nom de la contrainte
  est à vérifier sur la base avant de jouer. Une campagne renommée fera refuser
  l'étape B : voulu, on la rattache à la main.
- Tant que l'étape B n'est pas jouée, la page lit l'ID quand il est là ; une ligne
  sans ID n'est **jamais** rattachée par son nom à une autre.

### Les colonnes et tables nouvelles

Toutes additives, dans le `000`, RLS `*_own` et déclencheur `set_updated_at` sur
le patron de `meta_ads_insights` :

- `meta_ads_insights` : `campaign_id`, `adset_id`, `attribution_setting` (text,
  nullable), `results` (jsonb, nullable — la liste brute).
- `meta_ads_creatives` — une ligne par annonce : montage (`flat` /
  `object_story` / `asset_feed`), titre, texte, description, bouton, adresse de
  destination, `image_hash`, URL de l'image **dans Supabase Storage**, vidéo et
  vignette. Forme détaillée : recherche 04, § « Le SQL proposé » (c).
- `meta_ads_creative_assets` — les variantes d'une annonce multi-assets et les
  cartes d'un carrousel, clé = `(annonce, provenance, nature, rang)` ; aucun
  `asset_id`, Meta n'en documente pas. Forme détaillée : recherche 04 (d).
- **Ne se construisent pas** : `meta_ads_actions` (les conversions viennent de
  `results`, pas de la liste `actions` ; le choix du type d'action par le client
  est au `BACKLOG.md`), `inline_link_clicks` et `date_stop` (rien ne les lit).

### Les créas (tickets 04, 06, 14)

- Contenu lu à l'endpoint des créas, **une requête par page d'annonces**, pas une
  par annonce. Le champ du texte et de l'adresse dépend du montage :
  `object_story_spec.link_data` / `video_data`, `call_to_action.value.link`,
  `asset_feed_spec` (bodies, titles, descriptions, images, videos, link_urls),
  `child_attachments` pour le carrousel. **Non vérifié sur un appel réel** : le
  premier passage le confirme ; un champ absent reste vide, rien ne se fabrique.
- **Les images sont téléversées dans Supabase Storage**, repérées par
  `image_hash` pour ne jamais téléverser deux fois la même — les URL de Meta
  expirent. Patron : le téléversement de `fetch_instagram.py`, dont le bucket
  `post-images` est **public** (URL publique, pas de RLS de lecture). Le même
  choix pour les visuels d'annonces se défend — ils sont déjà diffusés
  publiquement par Meta — mais il rend lisible par URL le visuel d'une annonce
  **en pause ou jamais diffusée**. À confirmer par David au ticket de
  construction ; sinon, bucket privé et URL signées à la lecture.
- **Aucun chiffre par asset** (ticket 03). Le Panneau le dit en une phrase.

### Le journal des changements (ticket 08)

- La récolte de `/activities` existe ; elle **s'élargit** aux enchères
  (`update_ad_set_bidding`, `update_ad_set_bid_strategy`, `update_ad_bid_info`…),
  au statut des annonces (`update_ad_run_status`) et aux créations
  (`create_campaign_group`, `create_ad_set`, `create_ad`). La revue de Meta n'est
  pas retenue. Chaque nouveau type a sa phrase, rédigée à partir d'`extra_data`
  réel ; un type sans phrase sûre n'est pas inventé.
- **La campagne parente se retrouve par l'ID** pour un changement de groupe ou
  d'annonce (aujourd'hui elle n'est remplie qu'au niveau campagne), à partir de la
  hiérarchie d'IDs que la récolte voit déjà dans `/insights`. Un élément dont on
  ne retrouve pas la campagne n'apparaît que **sans filtre** ; le panneau filtré
  le compte en une ligne.
- **Un point par jour**, pas par changement, posé sur la courbe principale de la
  Tendance. Ce que le journal ne couvre pas se dit dans l'info-bulle « ⓘ » de la
  légende, et nulle part ailleurs.

### L'état de la page vit dans l'URL

Paramètres : la vue, la campagne (par ID), la période (`from`/`to` et ceux du
Bandeau actuel), le niveau et les deux métriques de la Comparaison, les éléments
cochés, le jour ouvert (`jour`), l'annonce lue (`annonce`, par ID).

- **Un lien énumère ce qu'il change, jamais ce qu'il garde** (`CLAUDE.md` §8) :
  ouvrir un jour ne touche que `jour` et retire `annonce`, et inversement ; tout le
  reste est gardé sans être nommé.
- Un jour hors de la période ne s'ouvre pas. Une annonce inconnue ne s'ouvre pas.

### Comparaison — la mécanique (tickets 05, 06)

- Basculer entre **groupes d'annonces** et **annonces** ; liste classée par la
  métrique 1, décroissante (croissante pour un coût) ; valeurs « — » en bas.
- Jusqu'à **4 éléments cochés** ; la 5ᵉ case se refuse visiblement.
- **Deux graphes, un par métrique**, toujours distinctes : choisir pour l'une la
  métrique de l'autre les échange.
- La ligne d'un élément coche ; **la lecture a sa propre cible**, « Lire » ou la
  vignette marquée comme cliquable, visible au repos. Les groupes d'annonces n'en
  ont pas.
- **La bande « créas comparées » sous les graphes ne se construit pas.**

### La lecture des données côté web

- Une couche de lecture **propre à Meta** lit les lignes de la période et de la
  période d'avant, **paginées au-delà de 1 000** (patron de pagination déjà présent
  dans la lecture des coûts), puis en tire le contenu de chaque module. Les
  agrégations et ratios y vivent dans des fonctions **pures**, sans directive
  `"use client"` (`CLAUDE.md` §8), pour être testées hors Supabase.
- La lecture ne déclenche aucun appel à Meta : le client ne déclenche rien.

### La grammaire

- Chaque module se pose dans la grammaire de module existante (référence en tête
  de `components/jour-recolte.tsx`) : le chiffre en premier, le plus gros, aucune
  forme graphique avant lui.
- Avant de dessiner : skills `dataviz` et `frontend-design` (la cause du rejet des
  deux premiers prototypes, ticket 05). Couleurs des séries validées par le
  validateur de palette.
- `min-w-0` / `min-h-0` sur les enfants de grille et de flex ; jamais une police
  plus petite (`CLAUDE.md` §8).
- Les animations (chiffres qui défilent, courbes qui se tracent, barre qui se
  détache) se coupent pour qui a réduit les animations.

---

## Testing Decisions

**Ce qu'est un bon test ici** : il donne une entrée qu'on peut écrire à la main
(une réponse Meta, des lignes de base) et vérifie ce que l'utilisateur lira — un
nombre, un « — », une ligne présente ou absente. Il ne vérifie jamais comment le
code y arrive. Les cas qui comptent sont ceux de `CLAUDE.md` §7 : l'absence qui
devient zéro, la somme qui compte deux fois, le ratio moyenné, le jour en cours.

**Deux seams, qui se rejoignent au schéma.** La base sépare la récolte (Python,
nocturne) de la page (TypeScript, à la demande) ; un seul seam traverserait
Supabase et le worker, ce qui n'est pas testable hors ligne. Chaque seam est le
plus haut possible de son côté :

1. **Récolte — « réponse Meta → lignes à écrire ».** Les fonctions qui
   transforment le JSON de `/insights`, des créas et de `/activities` en lignes de
   base, sans appel réseau. Précédent direct : `_traduire_meta`, déjà pur.
   À couvrir : `results` absent → `NULL`, liste vide conservée ; les trois
   montages de créa et le carrousel ; une adresse absente reste vide ; un
   `event_type` nouveau rend sa phrase, un type inconnu rend rien ; la campagne
   parente retrouvée par l'ID, et absente quand l'ID est inconnu ; deux annonces
   homonymes restent deux lignes.
2. **Page — « lignes de base + commandes → contenu des modules ».** Les fonctions
   pures de la couche de lecture Meta. À couvrir : les ratios total ÷ total (une
   ligne parent n'est pas la moyenne de ses enfants) ; diviseur nul → « — » ; pas
   de « +∞ % » ; la campagne de notoriété en vue Conversion → « — » ; des résultats
   de types différents ne s'additionnent pas ; une campagne renommée reste une
   ligne ; le filtre campagne garde ses groupes et annonces dans les changements ;
   plus de 1 000 lignes lues entières ; le jour en cours exclu.

**Prior art** : les harnais de seam du traitement (`test_le_seam.py`,
`test_chiffres_du_payload.py`, le `Lecteur` hors ligne) pour le style — un faux
fournisseur de données, des assertions sur ce qui sort. `saas/web` n'a pas de
lanceur de tests : chaque ticket de construction **écrit son harnais** plutôt que
d'en supposer un (`CLAUDE.md` §9), et le dit.

**Ce qui ne se teste qu'en vrai** :
- `tsc --noEmit` et `npm run build` verts, **18 routes** une fois le prototype parti.
- La forme réelle de `results`, des créas et d'`extra_data` : **après un passage
  du worker** — un lancement à la main de `weekly-fetch.yml` (`force`, pour
  réécrire tout de suite les 28 jours ; `meta_since` pour le rejeu des IDs), ou
  le cron du Jour de travail. Le ticket le dit et dit lequel.
- Les deux migrations sur un PostgreSQL jetable avant d'être données à David
  (précédent : la `998`, ticket 02).
- L'écran dans Chrome : les trois vues, le filtre, la barre détachée, le point →
  le panneau du jour, « Lire » → le panneau d'une annonce, un lien partagé qui
  rouvre le même état.

---

## Out of Scope

- **Le dashboard organique / Instagram** (la moitié « Dashboard 2 » du brief).
- **La construction du dashboard Google Ads.** Ce qu'il met dans chaque module est
  noté plus bas, pour qu'il ne redécide rien.
- **L'abstraction TikTok / Pinterest.**
- **Toute jointure GA4** (ADR 0010), donc aucun revenu.
- **La refonte du rapport hebdo**, qui se refait ailleurs.
- **Les métriques par asset** (ticket 03) ; le **contenu** des assets, lui, est dedans.
- **La portée et la fréquence** (ticket 07, au `BACKLOG.md`).
- **Le tri des campagnes par objectif déclaré**, et **le choix par le client du
  type d'action qui compte comme conversion** (`BACKLOG.md`).
- **Le filtre par statut** du Bandeau actuel : le prototype validé ne le porte pas.
- **Le thème et le label**, sous aucune forme.
- **Les réparations du `/meta` actuel** (`.scratch/corrections/` 01 à 03) : elles
  meurent avec la page remplacée, mais leurs pièges — `link_click` absent compté
  zéro, portée additionnée, troncature à 1 000 lignes — sont des cas de test de la
  nouvelle.

---

## Further Notes

### Trois choix tranchés par défaut — David peut les renverser

La carte les laissait ouverts ; la spec en a besoin pour être exécutable.

1. **Comparaison en mise en page C2** (la liste en haut sur deux colonnes, les deux
   graphes côte à côte dessous). Raison : le brief dit « un ou deux line plots côte
   à côte », et C2 est la seule des deux qui les pose côte à côte à pleine largeur.
2. **Pas de période « Tout »**, et la période par défaut est **la semaine mesurée**
   — les sept jours pleins avant le dernier Jour de travail, comparés aux sept
   d'avant. Raison : c'est la Fenêtre que tout le reste de Pulse lit
   (`CONTEXT.md`, **Jour de travail**). « Tout » n'a pas de période d'avant à
   comparer, et la frontière des 13 mois ne joue plus depuis le retrait de la portée.
3. **Le Tableau s'exporte en CSV**, tel qu'il est affiché (vue, filtre, période).
   Raison : `CONTEXT.md`, **Module** — « tout le détail, à exporter » — et David,
   ticket 06 : « une table où on exporte tout ».

### Ce qui reste dans le brouillard, et ne bloque pas

- **Le coût du stockage des images** dans Supabase Storage n'est pas mesuré ; les
  quotas de l'API, eux, le sont (2,4 % du plafond standard). La déduplication par
  `image_hash` est la seule mesure d'économie décidée.
- **Le tier d'accès de l'app Pulse chez Meta** est inconnu.

### Ce que Google Ads met dans chaque module (pour sa propre spec)

- **Ne change pas** : les noms, l'ordre, le Bandeau, les trois vues, la mécanique
  de la Comparaison, le Panneau latéral, le Tableau dépliable, les ratios total ÷
  total, « — » pour l'absent.
- **Change** : le deuxième niveau est le groupe d'annonces Google ; la dépense est
  en `cost_micros` ; les conversions sont un nombre (`conversions`), et Google
  rend peut-être son propre taux — **à vérifier avant de choisir le dénominateur** ;
  `change_event` ne remonte qu'à **30 jours** et rejette la requête au-delà
  (`CLAUDE.md` §8) : avant, la courbe n'a pas de points et l'écran le dit ; le
  contenu d'une annonce vient de la ressource `ad_group_ad`, à rechercher.

### Ordre de construction suggéré

La découpe en tickets se fait à part (`/to-issues`). Les dépendances dures :
1. La `998` jouée sur Supabase (ticket 02) avant tout ce qui touche au `000`.
2. Récolte : IDs + `results` + `attribution_setting` + recouvrement 28 j +
   activités élargies + créas → **passage du worker** → rejeu des IDs.
3. Lecture de la forme de `results` dans la base → affichage de la vue Conversion.
4. Étape B de la migration, après le rejeu, jouée par David.
5. La page peut se construire en parallèle de 2, sur les vues Notoriété et Trafic.
