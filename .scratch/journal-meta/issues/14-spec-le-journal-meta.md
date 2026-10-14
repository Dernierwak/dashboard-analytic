# 14: Spec — le journal Meta qui dit ce qui a changé

Type: spec
Status: open
Label: ready-for-agent
Synthèse de la carte et des tickets 01 à 13, écrite le 2026-10-14.

## Problem Statement

Sur `/meta`, le journal des changements dit « le ciblage du groupe
d'annonces X a été modifié » sans dire **quoi**. David voit qu'un chiffre a
bougé un jour où quelque chose a changé, mais il ne peut pas savoir quel
élément a été touché, ce qui a été fait, ni de quoi à quoi. Une annonce
mise en pause n'est rangée sous aucun groupe ; un statut écrit en français
par Meta était jeté ; un examen de Meta produit trois lignes de statut dans
la même minute. Et les graphiques de la Comparaison ne disent pas quelle
ligne a changé quel jour.

## Solution

Chaque changement Meta dit **quel élément** (campagne, groupe d'annonces ou
annonce, avec son nom), **ce qui a été fait** et **de quoi à quoi** quand Meta
le donne — sinon, au minimum, « modifié ». La récolte garde l'élément touché
et ce que Meta envoie, tel quel ; l'écran le lit à l'affichage, sans rien
traduire. Les changements se lisent depuis chaque point de la Tendance,
depuis chaque ligne de la Comparaison, et depuis un onglet « Changements »
qui montre tous ceux de la période, filtrés comme la page — filtre « Groupe
d'annonces » compris.

## User Stories

1. En tant que client, je veux que chaque changement Meta nomme l'élément touché (campagne, groupe d'annonces ou annonce), pour savoir où regarder.
2. En tant que client, je veux voir le nom de l'élément, et son ID quand Meta ne donne pas de nom, pour qu'aucun changement ne disparaisse faute de nom.
3. En tant que client, je veux savoir ce qui a été fait (statut, ciblage, enchère, objectif, budget, créa, calendrier, création), pour relier un geste à un mouvement de chiffre.
4. En tant que client, je veux voir la valeur avant et la valeur après quand Meta les donne, pour comprendre l'ampleur du changement.
5. En tant que client, je veux lire « modifié » quand Meta ne donne pas de détail, plutôt qu'une ligne absente ou une valeur inventée.
6. En tant que client, je veux voir les valeurs dans la langue où Meta les envoie, sans traduction approximative de Pulse.
7. En tant que client, je veux voir un code brut de Meta (une stratégie d'enchère, par exemple) tel quel, plutôt qu'un libellé deviné.
8. En tant que client, je veux qu'un statut écrit en français par Meta soit gardé, pour ne pas perdre une mise en pause.
9. En tant que client, je veux une seule ligne de statut par élément et par jour, qui montre le chemin et les heures (« Actif → En attente d'examen 16:25 → Actif 16:27 »), pour ne pas compter trois changements là où il n'y en a qu'un.
10. En tant que client, je veux que le statut regroupé compte pour un seul changement dans le nombre de l'onglet.
11. En tant que client, je veux voir sous chaque modification « Actuel : » avec les seules rubriques qui ont changé et leur nouvelle valeur, pour lire l'essentiel d'un coup d'œil.
12. En tant que client, je veux ouvrir un petit tableau « avant / après » (rubrique | avant | après), avec les lignes changées mises en évidence, pour vérifier le détail.
13. En tant que client, je veux qu'une modification où Meta envoie un avant et un après identiques le dise (« avant et après sont identiques selon Meta »), plutôt qu'elle soit cachée.
14. En tant que client, je veux voir « retiré » quand une rubrique disparaît après le changement.
15. En tant que client, je veux un changement de budget qui dise les montants et la devise envoyés par Meta, ou « budget modifié » quand ils manquent, sans devise supposée.
16. En tant que client, je veux voir chaque changement comme une petite carte (sa nature en gras, l'heure à droite, le détail plus discret), pour distinguer les niveaux d'information.
17. En tant que client, je veux un panneau rangé campagne › groupe d'annonces › annonce, chaque niveau dépliable et tout ouvert par défaut, trié par heure, pour retrouver un élément.
18. En tant que client, je veux que le statut vienne d'abord sous chaque élément, avant ses autres modifications.
19. En tant que client, je veux qu'une annonce soit rangée sous son groupe d'annonces même quand le changement de Meta ne le dit pas (mise en pause), pour ne pas la voir flotter hors de sa hiérarchie.
20. En tant que client, je veux un filtre « Groupe d'annonces » à côté de « Campagne », qui filtre toute la page (courbes, Comparaison, journal).
21. En tant que client, quand je choisis un groupe d'annonces, je veux que la Comparaison compare ses annonces, sans les boutons « Groupes d'annonces | Annonces ».
22. En tant que client, je veux un onglet « Changements » sur le bord droit, avec son nombre, qui ouvre tous les changements de la période filtrés comme la page.
23. En tant que client, je veux un onglet « Aperçus » qui montre le dernier visuel et le dernier texte de chaque annonce.
24. En tant que client, je veux qu'un second clic sur l'onglet actif referme le panneau, y compris quand le panneau a été ouvert depuis un point.
25. En tant que client, je veux un point orange sur la Tendance chaque jour où quelque chose a changé (dans la portée filtrée), pour relier une courbe à un geste.
26. En tant que client, je veux qu'un jour sans valeur sur la courbe (rien dépensé) pose son point sur l'axe, pour ne pas perdre un changement fait un jour à l'arrêt.
27. En tant que client, je veux cliquer un point de la Tendance pour ouvrir le panneau sur ce jour.
28. En tant que client, je veux sur chaque ligne de la Comparaison des points creux aux jours où cet élément a changé, de la couleur de la ligne, pour ne pas cliquer un point qui parle d'un autre élément.
29. En tant que client, je veux qu'une ligne de groupe d'annonces compte aussi les changements de ses annonces.
30. En tant que client, je veux qu'au survol d'une ligne de la Comparaison une bulle dise son nom seul.
31. En tant que client, je veux cliquer une ligne (ou un de ses points) pour la mettre en avant : les autres s'effacent, ses points deviennent pleins, plus gros, avec un halo qui pulse.
32. En tant que client, je veux que seuls les points de la ligne mise en avant ouvrent le panneau, sur ce jour et cet élément seul.
33. En tant que client, je veux qu'un clic à côté, sur la même ligne ou sur une autre ligne relâche la mise en avant.
34. En tant que client, je veux que deux éléments changés le même jour aient chacun leur zone de clic, sans que l'une masque l'autre.
35. En tant que client, je veux que le panneau ne déborde jamais à droite, et que les longs textes de Meta (ciblage, codes) se coupent.
36. En tant que client, je veux que le panneau ouvert reste dans l'URL, pour qu'un lien partagé ou un retour arrière rouvre le même jour et le même élément.
37. En tant que membre invité, je veux lire le même journal que le propriétaire, sans jamais accéder aux jetons qui servent à le récolter.
38. En tant que client, je veux que les changements des 180 derniers jours portent ce détail après le prochain passage du worker, et que les plus anciens gardent au moins leur phrase.
39. En tant que lecteur du rapport hebdo, je veux que la phrase de chaque changement reste écrite en base, pour que le fil du rapport continue de la lire.
40. En tant que David, je veux qu'aucun changement réel ne soit jeté sans rien dire par la récolte, pour pouvoir faire confiance au journal.
41. En tant que David, je veux qu'un passage du worker n'efface pas un détail écrit par un passage précédent quand Meta ne le renvoie plus.
42. En tant que David, je veux que la vérification du budget soit dite « non testée » tant qu'aucun vrai changement de budget n'a été vu sur un compte.
43. En tant que David, je veux voir le journal en production, ce qui suppose que la branche rejoigne `main` (Vercel et le cron de 07:00).

## Implementation Decisions

**Déjà construit** sur `journal-meta/carte` (tickets 12 et 13, validés). Ce
qui suit décrit la fonctionnalité telle qu'elle est, pour qu'un agent la
reprenne ou la prolonge sans rouvrir ses décisions.

- **Schéma de `platform_changes` — ajout seul.** Colonnes `niveau`
  (`campagne` / `groupe` / `annonce`, NULL permis, CHECK), `object_id`,
  `object_name`, `adset_id` (texte) et `extra_data` (jsonb, ou chaîne si Meta
  n'envoie pas du JSON). Catégories `objectif` et `calendrier` ajoutées à la
  CHECK de `categorie` (`DROP CONSTRAINT IF EXISTS` puis `ADD`, aucune ligne
  touchée). Toutes NULL sur les lignes Google et celles d'avant. Pas de
  colonnes `avant` / `apres` extraites : tout se lit dans `extra_data`.
  `resume` reste écrit (le rapport hebdo le lit).
- **Récolte Meta.** Le niveau se lit dans le préfixe de `event_type` (pas
  dans `object_type`, peu fiable). `adset_id` vaut l'objet lui-même pour un
  groupe ; pour une annonce, `extra_data.campaign_id` (qui porte l'ID du
  **groupe**), sinon la hiérarchie tirée des insights, étendue pour rendre le
  groupe de chaque annonce. `extra_data` est gardé tel que Meta l'envoie.
  Types ajoutés : changement d'objectif d'un groupe, ciblage d'une annonce,
  durée d'un groupe. Un nom absent ne jette pas la ligne : l'élément se dit
  par son ID. La créa « a été modifiée » (et non « remplacée »).
- **Aucune logique ne lit un libellé.** Ranger, regrouper ou décider se
  fonde sur le code chiffré (`run_status`) ou le type d'événement ; les
  libellés sont recopiés dans la langue de Meta.
- **Budget.** Montants lus dans `composite_data` (centimes, devise donnée par
  Meta), sinon « budget modifié ». Non testé sur un vrai changement : aucun
  n'existe sur le compte depuis le 2026-01-11.
- **Écriture.** Les colonnes « si connues » ne partent à l'upsert que
  remplies, pour ne rien effacer d'un passage précédent (même règle que
  `fuseau`).
- **Lecture d'`extra_data` à l'affichage** : un module pur, par forme
  (statut, ciblage, créa, objectif, enchère, calendrier, création), qui rend
  soit des rubriques `{ nom, avant, après }`, soit la phrase `resume` seule
  pour une forme inconnue. « Actuel » = les rubriques dont l'avant et l'après
  diffèrent, **comparées texte contre texte** — aucun montant ni nombre
  comparé. Une rubrique qui disparaît s'écrit « retiré ».
- **Mise en page du journal** : un module pur qui prend les lignes de
  `platform_changes` et la portée de la page (campagne, groupe d'annonces)
  et rend les jours marqués de la Tendance, les marques de chaque ligne de la
  Comparaison, le nombre de l'onglet et l'arbre du panneau
  (campagne › groupe › annonce › cartes, statut regroupé par élément et par
  jour d'abord, tri par heure). Une ligne de groupe compte les changements de
  ses annonces.
- **État dans l'URL.** Le jour ouvert, l'élément ouvert et le groupe
  d'annonces filtré sont des paramètres de l'URL ; un lien n'énumère que ce
  qu'il change.
- **Composants.** Le panneau, les onglets du bord droit, la Tendance, la
  Comparaison, le bandeau de filtres et la courbe partagée (une zone de clic
  par élément et par jour, bulle « nom seul » au survol d'une ligne).
  Valeurs partagées dans un module sans directive `"use client"`.

**Reste à faire** (pas encore spécifié en détail, voir la carte) :
- **La mise en production** : `journal-meta/carte` rejoint `main` ; jusque-là
  ni Vercel ni le cron de 07:00 n'ont le nouveau code.
- **Les lignes d'avant le ticket 12** : un passage du worker relit 180 jours
  et les complète ; au-delà, elles gardent leur phrase seule.
- **La vérification du budget** dès qu'un vrai changement existera.

## Testing Decisions

- **Un bon test** passe par une couture et vérifie ce qu'elle rend — la
  ligne écrite, la rubrique lue, le point posé, l'arbre du panneau — jamais
  la façon dont c'est calculé. Les formes d'entrée sont celles du ticket 02,
  **noms et IDs remplacés** (le dépôt est public).
- **Trois coutures, toutes existantes, aucune nouvelle :**
  1. **La récolte** : activités Meta + hiérarchie des insights → lignes de
     `platform_changes`. Couvre le niveau, le groupe d'une annonce (avec et
     sans `campaign_id`), `extra_data` tel quel, un statut en français gardé,
     un nom absent, le budget avec et sans montant, les types ajoutés.
  2. **La lecture d'`extra_data`** : catégorie + `extra_data` → rubriques ou
     phrase seule. Couvre chaque forme, « Actuel », « retiré », « identiques
     selon Meta », une forme inconnue, un code brut affiché tel quel.
  3. **La mise en page du journal** : lignes + portée → jours marqués,
     marques par ligne, nombre, panneau. Couvre le filtre groupe, le point
     d'un jour sans valeur, la ligne de groupe qui compte ses annonces, le
     statut regroupé qui compte pour un.
  Les coutures 2 et 3 sont le haut de l'écran : au-dessus, il n'y a plus que
  le rendu React, qui se juge dans Chrome.
- **Prior art.** Harnais Python du ticket 12 (24/24) sur la couture 1 ;
  harnais `node --test` du ticket 13 (28/28) sur les coutures 2 et 3, lancé
  avec le résolveur d'import du harnais. Le dépôt n'a pas de suite de tests
  permanente : chaque ticket écrit son harnais (`CLAUDE.md` §9).
- **Ce qui se vérifie à la main** : le clic, le halo, l'ouverture du panneau
  et le débordement, dans Chrome sur `/meta` ; en base, après un passage du
  worker, que les lignes Meta portent `niveau` et `extra_data`.
- **Toujours** : `python3.12 -m py_compile` sur le Python touché ; `tsc` et
  `build` verts, 18 routes, sur un `.next` vidé.

## Out of Scope

- **Traduire les valeurs de Meta** dans la langue de l'application (ticket 04).
- **Comparer des montants ou des nombres** entre avant et après (ticket 06) :
  seule la comparaison texte contre texte existe.
- **Filtrer les modifications sans différence** : Meta ne donne aucun champ
  qui dise « rien n'a changé ».
- **Enrichir un changement au-delà de ce que Meta envoie** (ticket 01).
- **Google Ads** : ses lignes gardent les nouvelles colonnes à NULL.
- **Le rapport hebdo** : il continue de lire `resume`, inchangé.
- **Mettre `CLAUDE.md` à jour** après le retrait de `CONTEXT.md`,
  `BACKLOG.md` et `docs/` : chantier à part.

## Further Notes

- Une correction de la récolte **ne se voit qu'après un passage du worker** :
  le cron du Jour de travail (07:00 UTC, sur `main`) ou un lancement à la
  main de `weekly-fetch.yml`. Avant la fusion, seul le lancement à la main
  sur la branche fait tourner le nouveau code.
- Le `000` doit être joué sur Supabase avant tout passage qui écrit les
  nouvelles colonnes ; sans lui, le premier `objectif` ou `calendrier` fait
  refuser tout le lot Meta (vu le 2026-10-14).
- Le panneau met environ deux secondes à s'ouvrir en local : à revoir si la
  production le confirme.
