# Spec — La page Google Ads

Status: ready-for-agent
Carte : [`map.md`](map.md) · Modèle : [`../meta-ads/spec.md`](../meta-ads/spec.md) ·
ADR : `docs/adr/0010`, `docs/adr/0011` · Vocabulaire : `CONTEXT.md`

Écrite le 2026-11-11 à partir des tickets clos 01 à 21 de la carte. Rien n'y est
inventé : chaque décision renvoie à son ticket. Ce que la carte laissait ouvert
est soit **hors périmètre**, soit **tranché par défaut** et signalé comme tel
(§ Further Notes) — David peut le renverser sans toucher au reste.

**État de départ** : la spec vise `main` (les modules Meta y sont construits ;
la branche de la carte a 189 commits de retard). Sur `main`, la page `/google`
est encore l'ancienne structure Streamlit — KPIs, moyennes, graphe à métrique
au choix, table — sans Sélecteur de vue, Tendance, Comparaison ni Panneau
latéral. La récolte Google relit déjà 30 jours à chaque passage et enregistre
déjà le journal `change_event`.

---

## Problem Statement

Le client de Pulse qui fait de la publicité sur Google ouvre la page Google Ads
et n'y retrouve pas la page Meta qu'il connaît : une métrique à la fois, aucune
vue Notoriété / Trafic / Conversion, aucun moyen de comparer deux campagnes ou
deux annonces dans le temps, et les changements faits dans le compte vivent
loin des courbes qu'ils expliquent.

Il ne peut pas non plus répondre aux questions propres à Google :
- ses campagnes **Performance Max** n'apparaissent pas sous la campagne — Google
  ne les range pas en groupes d'annonces mais en groupes d'éléments, que Pulse
  ne récolte pas ;
- il ne sait pas **quel type** est chaque campagne (Search, PMax, Display,
  Vidéo, Demand Gen) — la base ne le stocke pas ;
- il ne voit **ni la valeur de ses conversions ni son ROAS**, et si on les lui
  montrait tels que Google les rend, il lirait souvent « 1 × le nombre de
  conversions » sans le savoir (valeur par défaut imposée à 1, ticket 10) ;
- pour relire le texte d'une annonce Search ou voir la vidéo d'une annonce
  YouTube, il doit retourner dans Google Ads ;
- il ne sait pas **ce que les gens ont tapé** pour arriver sur ses annonces
  Search, ni sous quel mot-clé ou quel groupe de Google ces recherches se
  rangent.

## Solution

**La page Google est la page Meta, avec les chiffres de Google** (ticket 11,
ADR 0011) : les mêmes modules, sous le même nom, à la même place, construits
avec le code et la grammaire des modules Meta — pas d'après la maquette.

1. **Bandeau de commandes** — titre, « Chiffres Google au <Jour de travail>,
   07:00 », campagne, période, pilule flottante au défilement.
2. **Sélecteur de vue** — Notoriété / Trafic / Conversion. Il ne filtre rien,
   toutes les campagnes de tous les types sont dans chaque vue.
3. **Tendance** — le total jour par jour, la période d'avant en pointillé, un
   point par jour de changement qui ouvre le Panneau latéral.
4. **Comparaison** — la variante A du ticket 16 : trois réglages au-dessus
   (Type de campagne, Niveau, deux métriques), la liste à cocher étiquetée par
   type, dessous le nuage de la période et la courbe jour par jour.
5. **Tableau détaillé** — un seul tableau dépliant ; chaque campagne porte un
   repère de son type et se déplie selon lui : jusqu'à l'Annonce (Search,
   Display, Vidéo, Demand Gen), jusqu'au Groupe d'éléments (PMax).
6. **Groupes de termes** — en bas de page, pour Search : les termes de
   recherche en graphe en grappes, rangés au choix sous leur **Mot-clé** ou
   sous le **cluster de Google** (ticket 21).

Et le **Panneau latéral**, un seul, qui s'ouvre sur un jour (ses changements)
ou sur une annonce (tout ce qu'elle contient : titres et descriptions Search,
images Display, la vidéo elle-même).

Tous les chiffres sont ceux que **Google** déclare (ADR 0010), recopiés : les
conversions sont la colonne « Conversions » de Google Ads, les taux sont
recalculés total ÷ total comme Google le fait (vérifié exact au ticket 10), et
la valeur de conversion s'efface derrière « — » quand elle n'est qu'un
comptage. Ce qui ne se mesure pas pour un type s'écrit « — » avec sa raison,
jamais « 0 ».

---

## User Stories

### Lire la page

1. En tant que client, je veux voir en haut de la page la date à laquelle Pulse a lu Google (« Chiffres Google au <Jour de travail>, 07:00 »), afin de comprendre tout seul pourquoi un chiffre diffère de Google Ads consulté plus tard.
2. En tant que client, je veux que les chiffres d'un jour de plus de 30 jours soient ceux de Google Ads, afin de faire confiance à Pulse sans tout revérifier.
3. En tant que client, je veux que le jour en cours ne soit jamais compté, afin de ne pas lire une journée incomplète comme une chute.
4. En tant que client, je veux retrouver exactement les modules, l'ordre et les gestes de ma page Meta Ads, afin de ne pas réapprendre une page par régie.
5. En tant que client, je veux que tous les intitulés soient en français et dans le vocabulaire de Pulse (« groupe d'annonces », « groupe d'éléments », « terme de recherche »), afin de ne pas lire du jargon de régie.
6. En tant que membre invité, je veux voir exactement la même page que le propriétaire, afin de travailler sur les mêmes chiffres — sans jamais avoir accès aux jetons Google.
7. En tant que client, je veux qu'aucun chiffre de GA4 ne vienne compléter ceux de Google Ads, afin que chaque nombre de la page se retrouve dans Google Ads.

### Bandeau de commandes

8. En tant que client, je veux choisir une campagne dans un menu avec recherche, pastille de couleur, repère de type et dépense de la période, afin de retrouver vite celle dont je parle.
9. En tant que client, je veux que le choix d'une campagne resserre toute la page — Sélecteur, Tendance, points de changement, Comparaison, Tableau, Groupes de termes — afin de lire une campagne d'un bout à l'autre.
10. En tant que client, je veux choisir la période par des raccourcis ou par un calendrier, comme sur Meta, afin de lire la durée qui m'intéresse.
11. En tant que client, je veux que toute période soit comparée à la période d'avant de même durée, afin de savoir si ça monte ou si ça baisse.
12. En tant que client, je veux que le bandeau reste visible quand je descends et se replie en pilule avec la vue active dedans, afin de ne jamais perdre de vue ce que je regarde.
13. En tant que client, je veux qu'un lien partagé rouvre la page exactement dans l'état où je l'ai vue (vue, campagne, période, réglages de la Comparaison, jour ou annonce ouverts, mode des Groupes de termes), afin de pouvoir l'envoyer à mon patron.

### Sélecteur de vue

14. En tant que client, je veux trois cartes Notoriété / Trafic / Conversion avec leur question, leur chiffre principal et son écart, afin de voir les trois réponses avant de cliquer.
15. En tant que client, je veux que la vue Notoriété montre impressions et CPM, afin de savoir combien de fois on m'a vu et à quel prix.
16. En tant que client, je veux que la vue Trafic montre clics, CTR et CPC, afin de savoir si mes annonces font cliquer.
17. En tant que client, je veux que la vue Conversion montre conversions, coût par conversion, taux de conversion (conversions ÷ clics, dénominateur écrit), valeur de conversion et ROAS, afin de savoir ce que mes campagnes rapportent.
18. En tant que client, je veux que les totaux additionnent tous mes types de campagnes, comme la Vue d'ensemble de Google Ads, afin de retrouver le même nombre aux deux endroits.
19. En tant que client, je veux une info-bulle « ⓘ » sur impressions et clics qui rappelle que ces totaux mêlent des types de campagnes différents, afin de savoir ce que j'additionne.
20. En tant que client, je veux que toutes mes campagnes restent présentes quelle que soit la vue, afin de ne pas en perdre une parce que son objectif est différent.

### Conversions et valeur

21. En tant que client, je veux que mes conversions soient la colonne « Conversions » de Google Ads, sans règle maison de dédoublonnage entre PMax et Search, afin de lire le même nombre aux deux endroits.
22. En tant que client dont les actions de conversion n'ont qu'une valeur imposée à 0 ou à 1, je veux voir « — » à la place de la valeur et du ROAS, avec la raison (« aucune valeur de conversion déclarée dans Google Ads »), afin de ne pas lire un comptage comme un chiffre d'affaires.
23. En tant que client dont le compte mêle des actions à vraie valeur et des actions comptées à 1, je veux voir le total de Google avec un « ⓘ » qui dit qu'une partie n'est qu'un comptage, afin de savoir ce que vaut le nombre.
24. En tant que client, je veux que la règle « sans valeur » se recalcule sur la période et la campagne choisies, afin qu'une campagne à vraie valeur ne soit pas effacée par le reste du compte.
25. En tant que client, je veux qu'un ROAS sans dépense, un coût par conversion sans conversion ou un écart sans base s'affichent « — », jamais « +∞ % » ni « 0 », afin de ne jamais lire un chiffre fabriqué.

### Tendance

26. En tant que client, je veux voir le total de la sélection jour par jour, un graphe par métrique de la vue, la principale en grand, afin de voir comment l'ensemble évolue.
27. En tant que client, je veux la période d'avant en pointillé sur le même graphe, afin de comparer sans calcul.
28. En tant que client, je veux que les taux de la Tendance soient recalculés jour par jour depuis les comptes, afin qu'ils coïncident avec ceux de Google.
29. En tant que client, je veux un petit point sur la courbe principale chaque jour où quelque chose a changé dans mon compte Google Ads, afin de relier une variation à une modification.
30. En tant que client, je veux qu'un clic sur ce point ouvre le Panneau latéral avec les changements du jour, rangés par campagne, afin de comprendre ce qui a bougé.
31. En tant que client qui a filtré une campagne, je veux que les points et le panneau ne montrent que cette campagne, ses groupes et ses annonces compris, afin de ne pas être noyé par les autres.
32. En tant que client, je veux une info-bulle « ⓘ » sur la légende qui dise depuis quand le journal existe (30 jours avant la première récolte Google) et quelles catégories de changements Pulse garde, afin de ne pas conclure qu'un jour sans point est un jour où rien n'a changé.
33. En tant que client, je veux qu'un jour sans données s'affiche comme un trou, pas comme un zéro, afin de ne pas lire une panne de récolte comme une chute.

### Comparaison

34. En tant que client, je veux choisir au-dessus de la Comparaison un Type de campagne (Tous, ou l'un des types présents dans mon compte), afin de comparer entre elles des campagnes du même type.
35. En tant que client, je veux choisir le Niveau — Campagnes, Groupes, Annonces — afin de comparer au niveau où je prends mes décisions.
36. En tant que client qui a choisi PMax seul, je veux que le niveau « Annonces » disparaisse, afin de ne pas chercher des annonces que PMax n'a pas.
37. En tant que client, je veux que le niveau « Groupes » réunisse groupes d'annonces et groupes d'éléments PMax, chacun avec son repère de type, afin de tout comparer au même étage.
38. En tant que client sur « Tous » au niveau « Annonces », je veux une phrase qui dise que PMax n'a pas d'annonces, plutôt qu'une absence muette, afin de savoir pourquoi mes PMax ne sont pas là.
39. En tant que client, je veux choisir deux métriques de la vue — axe horizontal et axe vertical — la première classant la liste, afin de comparer sur ce qui compte pour moi.
40. En tant que client, je veux une liste à cocher sur deux colonnes, avec l'étiquette du type sur chaque ligne, afin de savoir d'un coup d'œil quel type je compare.
41. En tant que client, je veux voir dessous, à gauche, un nuage de la période (une ligne = un point, taille = coût, lignes non cochées en gris), afin de situer chaque élément par rapport aux autres.
42. En tant que client, je veux voir à droite la courbe jour par jour des lignes cochées, qui bascule entre les deux métriques, afin de suivre leur évolution.
43. En tant que client, je veux cocher jusqu'à quatre lignes, et qu'une cinquième case se refuse visiblement, afin de garder le contrôle.
44. En tant que client, je veux qu'un changement de type ou de niveau reparte du pré-cochage, comme sur Meta, afin de ne jamais comparer des lignes qui ne sont plus affichées.
45. En tant que client, je veux sur chaque annonce une cible « Lire » visible au repos, distincte de la case, afin d'ouvrir son contenu.
46. En tant que client, je veux qu'une ligne sans valeur pour la métrique de classement se range en bas avec « — », afin qu'elle ne soit ni cachée ni classée comme nulle.
47. En tant que client, je veux que deux annonces de même nom restent deux lignes, afin de ne pas mélanger leurs chiffres.

### Tableau détaillé

48. En tant que client, je veux un seul tableau dépliant avec une ligne Total, afin de retrouver tout le détail au même endroit.
49. En tant que client, je veux un repère de type à côté de chaque campagne, afin de savoir ce que je déplie.
50. En tant que client, je veux qu'une campagne Search, Display, Vidéo ou Demand Gen se déplie en Groupes d'annonces puis en Annonces, afin de descendre comme sur Meta.
51. En tant que client, je veux qu'une campagne PMax se déplie en Groupes d'éléments, et rien en dessous, afin de voir comment PMax est organisé sans fausses annonces.
52. En tant que client, je veux qu'une campagne d'un autre type (Shopping, App…) se déplie si Google lui donne des groupes, et reste une ligne seule sinon, afin de ne rien cacher du total.
53. En tant que client, je veux que les colonnes suivent la vue active, afin de lire les mêmes métriques qu'au-dessus.
54. En tant que client, je veux qu'une métrique sans objet pour une ligne s'écrive « — » avec sa raison au survol, afin de distinguer « rien mesuré » de « zéro ».
55. En tant que client, je veux que les ratios de chaque ligne soient recalculés sur la ligne, afin qu'une ligne parent ne soit jamais la moyenne de ses enfants.
56. En tant que client, je veux exporter le tableau tel que je le vois, « — » compris, avec une colonne « Type de campagne », afin de le retravailler dans mon tableur.
57. En tant que client, je veux qu'une campagne renommée dans Google reste une seule ligne, sous son nom le plus récent, afin de ne pas voir son historique coupé.

### Panneau latéral — lire une annonce

58. En tant que client, je veux lire dans Pulse tous les titres (jusqu'à 15) et toutes les descriptions (jusqu'à 4) d'une annonce Search, numérotés, avec « épinglé en position N » et le chemin d'affichage, afin de savoir ce que j'ai mis en ligne.
59. En tant que client, je veux voir les images, titres et textes d'une annonce Display, numérotés, afin de relire toute l'annonce.
60. En tant que client, je veux lire la vidéo YouTube d'une annonce Vidéo dans le panneau, avec ses titres et textes, afin de voir à quoi elle ressemble sans quitter Pulse.
61. En tant que client, je veux un lien « l'annonce envoie vers… » lu dans l'annonce, et aucun lien quand elle n'en porte pas, afin de vérifier la page d'arrivée sans être envoyé au mauvais endroit.
62. En tant que client, je ne veux jamais voir une annonce Google recomposée par Pulse, afin de ne pas croire que Google l'a diffusée telle quelle.
63. En tant que client, je ne veux aucun chiffre à côté d'un titre, d'une description ou d'une image, et une phrase qui dit pourquoi, afin de ne pas croire que Pulse les mesure ici.
64. En tant que client, je veux qu'un montage que Pulse ne sait pas lire le dise, plutôt qu'un panneau vide, afin de savoir que l'annonce existe.
65. En tant que client, je veux que les images s'affichent encore dans six mois, afin que l'historique de mes annonces reste lisible.

### Panneau latéral — commun

66. En tant que client, je veux un seul panneau à droite, qui se ferme quand j'en ouvre un autre, afin de ne jamais avoir deux couches ouvertes.
67. En tant que client, je veux que le jour ou l'annonce ouverts soient dans l'adresse, afin que « retour » et un lien partagé les rouvrent.
68. En tant que client, je veux qu'un jour hors de la période ne s'ouvre pas, et qu'un groupe d'éléments PMax n'ouvre rien, afin de ne lire que ce que Pulse sait montrer.

### Groupes de termes (Search)

69. En tant que client, je veux voir en bas de la page les termes que les gens ont tapés avant de voir mes annonces Search, regroupés en grappes reliées, afin de comprendre d'un coup d'œil ce que mes campagnes attrapent.
70. En tant que client, je veux basculer entre « Mots-clés » (les termes sous leur mot-clé déclencheur) et « Clusters Google » (les termes sous le groupe que Google forme), afin de lire les mêmes recherches de deux façons.
71. En tant que client, je veux voir en mode Mots-clés le type de correspondance de chaque terme et son coût, afin de savoir comment Google l'a apparié.
72. En tant que client, je veux qu'en mode Clusters le coût s'écrive « — » et que le réglage de taille « Coût » soit barré, afin de ne pas croire que Google donne ce chiffre.
73. En tant que client, je veux une ligne de totaux sur clics, impressions, conversions et coût, jamais une seule métrique, afin de voir le poids de chaque grappe sous plusieurs angles.
74. En tant que client, je veux choisir la taille des ronds (clics par défaut), afin de faire ressortir ce qui m'intéresse.
75. En tant que client, je veux ouvrir la fiche d'une grappe — ses quatre métriques terme par terme et la ligne « Masqués par Google » — afin de savoir ce qui la compose et ce qui échappe à la liste.
76. En tant que client, je veux un classement des grappes par clics, conversions ou coût, afin de trouver vite les plus lourdes.
77. En tant que client, je veux filtrer par campagne Search, « Toutes les campagnes » compris, afin de lire une campagne à la fois.
78. En tant que client, je veux que « Sans cluster » (la fourre-tout de Google) et « N petits clusters » (≤ 5 clics) soient hachurés et rangés en dernier avec leur raison, afin qu'ils ne se confondent pas avec un vrai groupe.
79. En tant que client, je veux qu'un terme rangé dans deux grappes relie les deux, afin de voir les recouvrements.
80. En tant que client, je veux que la part des clics venant de termes masqués par Google s'affiche, afin de savoir que la liste n'est jamais le tout.
81. En tant que client, je veux une phrase qui dise qu'un même sujet peut former un cluster par langue, afin de ne pas croire à trois sujets différents.
82. En tant que client sans campagne Search, je veux une phrase à la place du module, afin de savoir pourquoi il est vide.

### Ceux qui maintiennent Pulse

83. En tant que David, je veux que la récolte stocke le type de campagne Google (`advertising_channel_type`) sur chaque ligne de campagne, afin que la page n'ait jamais à le deviner.
84. En tant que David, je veux que les trois colonnes de conversions et la valeur soient récoltées dans la même requête, et `NULL` quand Google ne les rend pas, afin de lire leur forme réelle avant d'en afficher d'autres.
85. En tant que David, je veux que la récolte relise 30 jours à chaque passage, comme aujourd'hui, afin que Pulse recopie Google jusqu'à ce que Google cesse de corriger.
86. En tant que David, je veux que la récolte passe à l'API v26, afin de ne pas tomber au retrait de v25.
87. En tant que David, je veux pouvoir reprendre l'historique par jour sur 37 mois au plus par la récolte complète, afin que la page ait du passé dès le premier jour.
88. En tant que développeur qui construira une autre régie, je veux retrouver les mêmes modules sous les mêmes noms, afin de savoir quoi construire sans redécider.

---

## Implementation Decisions

### La structure (ADR 0011, tickets 11, 15)

- **Mêmes modules, même nom, même rôle, même place que Meta** : Bandeau de
  commandes, Sélecteur de vue, Tendance, Comparaison, Tableau détaillé, Panneau
  latéral. Chaque module Google est **son propre code**, écrit en partant des
  modules Meta construits et de leur grammaire ; seules les briques visuelles
  neutres (carte, graphe en courbe, nuage, panneau, bandeau, menu) se partagent
  et ne savent rien de la régie. Pas de vue SQL commune, pas de type unique
  rempli par Meta et Google.
- **Un module de plus, en bas : Groupes de termes** (ticket 21), à la place de
  l'emplacement « Analyser une campagne — à venir » de la maquette. C'est un
  ajout propre à Google, pas un écart sur un module existant.
- **La page `/google` actuelle est remplacée**, pas complétée. Aucune route
  nouvelle : le compte reste à **18 routes**. Les maquettes vivent sur des
  branches jetables (`prototype/google-page`, `prototype/comparaison`,
  `prototype/groupes-de-termes`) ; **seules les décisions de cette spec font
  foi**, pas les maquettes, qui contiennent des variantes rejetées.
- **Rien de propre aux types hors de trois endroits** (ticket 15) : le repère
  de type au Tableau et au menu de campagne, le réglage et l'étiquette de type
  dans la Comparaison, le module Groupes de termes (Search). Ni filtre Type au
  Bandeau, ni moustache, ni répartition de la dépense par type, ni module des
  types : abandonnés.

### Le Type de campagne (tickets 04, 06, 14)

- Lu dans `campaign.advertising_channel_type`, stocké brut sur les lignes de
  campagne. L'écran le traduit en six libellés : **Search, PMax, Display,
  Vidéo, Demand Gen, Autres types**. « Autres types » réunit tout le reste
  (Shopping, App, Local, Hotel, Smart…) ; le Tableau et l'export montrent alors
  le vrai type de Google.
- Un type n'est jamais exclu d'un total (§7). « Vidéo » est le nom de l'écran
  pour le YouTube payant ; « YouTube » seul désigne la future page organique
  (`CONTEXT.md`).

### Les vues et leurs métriques (tickets 05, 10, 13)

| Vue | Chiffre principal | Métriques |
|---|---|---|
| Notoriété | impressions | impressions, CPM |
| Trafic | clics | clics, CTR, CPC |
| Conversion | conversions | conversions, coût par conversion, taux de conversion, valeur de conversion, ROAS |

- **Clic = `metrics.clicks`**, la colonne « Clics » de Google Ads.
- **Tout ce qui se compte se totalise tous types confondus** (impressions,
  clics, coût, conversions, valeur), comme la Vue d'ensemble de Google. Une
  « ⓘ » le rappelle sur impressions et clics. Pas de « — » sur un total parce
  que plusieurs types ont diffusé.
- **Taux calculés sur les totaux** (`CONTEXT.md`), jamais récoltés tout faits ni
  moyennés : CPM = coût ÷ impressions × 1 000 ; CTR = clics ÷ impressions ×
  100 ; CPC = coût ÷ clics ; coût par conversion = coût ÷ conversions ; taux de
  conversion = conversions ÷ clics × 100 ; ROAS = valeur ÷ coût. Vérifié au
  ticket 10 : ce recalcul égale exactement les taux de Google. Le mot
  « moyenne » ne s'écrit pas à l'écran. Diviseur nul ou absent → « — ».
- **Un compteur que Google rend à 0 pour un type où il n'a pas de sens n'est
  pas une mesure** (ticket 10) : le « — » se décide **par type, dans Pulse**,
  jamais d'après la réponse de Google. Aucune métrique propre à un type n'est
  affichée dans cette spec, la règle sert surtout aux suivantes.
- **Écart** contre la période d'avant de même durée ; base absente ou nulle →
  « — », jamais « +∞ % ».
- **Coût en micros** côté Google (`cost_micros`), converti une fois, dans la
  devise du compte.

### Les conversions et leur valeur (tickets 05, 10, 13)

- **Conversions affichées = `metrics.conversions`**, datées au clic comme la
  colonne de Google, additionnées entre types et campagnes telles que Google
  les attribue, sans dédoublonnage maison.
- **Récoltées en plus, non affichées** : `all_conversions`,
  `view_through_conversions` (même requête). Le choix de la colonne affichée
  est au `BACKLOG.md` ; `all_conversions` pèse 7 à 160 fois `conversions`
  (ticket 10), ce n'est pas un détail.
- **« Sans valeur »** (ticket 13) : une action de conversion est sans valeur
  quand `value_settings.always_use_default_value` est vrai **et** sa valeur par
  défaut vaut 0 ou 1. La page affiche « — » pour la valeur et le ROAS quand,
  sur la période et la campagne choisies, **toutes** les actions qui ont des
  conversions sont sans valeur. Sinon, elle affiche le total de Google
  (`metrics.conversions_value`), jamais un total recomposé par Pulse, avec une
  « ⓘ » quand une partie vient d'actions sans valeur.
- Pour tenir cette règle, la récolte lit **les réglages des actions de
  conversion** et **la répartition des conversions par action**
  (`segments.conversion_action`, par campagne et par jour, métriques de
  conversion seules — l'API refuse impressions et coût dans la même requête,
  ticket 18). La somme par action redonne exactement `metrics.conversions`
  (ticket 19).
- **À écrire dans `docs/mesures-impossibles.md`** à la construction : une
  action réglée « par événement » dont les événements arrivent sans montant
  retombe sur son défaut (1), sans que ses réglages le montrent ; Pulse ne
  peut pas la reconnaître.
- Aucune jointure GA4, aucun chiffre d'une autre plateforme (ADR 0010).

### La fraîcheur

- **Le recouvrement Google reste à 30 jours** (fenêtre de conversion par
  défaut, rafraîchissement hebdomadaire de l'attribution data-driven — le
  commentaire existant le justifie déjà avec ses sources).
- Le Bandeau écrit **« Chiffres Google au <Jour de travail>, 07:00 »**
  (formulation exacte à la construction, alignée sur Meta), lu dans la date du
  dernier passage réussi.
- **Aucune zone « provisoire »** sur les derniers jours : le délai de
  stabilisation des conversions Google n'est pas mesuré (§ Further Notes).
- Le client ne déclenche rien : aucun appel à Google depuis l'app.

### L'identité par ID

- Campagne, groupe d'annonces, annonce et groupe d'éléments sont identifiés par
  leur **ID Google** (`campaign.id`, `ad_group.id`, `ad_group_ad.ad.id`,
  `asset_group.id`) ; le nom affiché est le plus récent lu. Regroupements,
  filtres, liens et clés de liste utilisent l'ID. `google_ads_insights` est
  déjà unique par `campaign_id` : pas de migration de clé comme sur Meta.

### Les colonnes et tables nouvelles

Toutes additives, dans le `000`, rejouables, RLS `*_own` et déclencheur
`set_updated_at` sur le patron de `google_ads_insights`. Aucune n'est
destructive.

- **`google_ads_insights`** (campagne × jour) : type de campagne (texte),
  `conversions_value`, `all_conversions`, `view_through_conversions` — tous
  nullables, `NULL` quand la colonne n'a pas été lue.
- **Groupes d'éléments PMax × jour** — campagne, groupe d'éléments (ID, nom),
  impressions, clics, coût, conversions, valeur. ≈ 600 lignes sur 90 jours
  chez A (ticket 10). Google ne rend aucune ligne PMax dans `ad_group_ad`, et
  ne lève aucune erreur : sans cette table, PMax n'a pas de détail.
- **Actions de conversion** — une ligne par action : ID, nom, catégorie,
  statut, `always_use_default_value`, valeur par défaut, devise. Relue à
  chaque passage (ce sont des réglages actuels, pas un historique).
- **Conversions par action × campagne × jour** — conversions et valeur par
  action. Sert la règle « sans valeur » ; rien d'autre ne la lit dans cette
  spec.
- **Contenu des annonces** — une ligne par annonce : type d'annonce, adresses
  finales, chemin d'affichage, et les éléments de texte, d'image et de vidéo
  (titres, descriptions, épinglage, URL d'image, identifiant YouTube), rangés
  avec leur rang. Forme exacte fixée au ticket de construction, **après un
  appel réel** (ticket 12 : champs non vérifiés). Pistes :
  `ad.responsive_search_ad`, `ad.responsive_display_ad`, `ad.video_ad`,
  `ad.video_responsive_ad`, `ad.final_urls`, la ressource `asset`.
- **Termes de recherche × jour** (Search) — campagne, groupe d'annonces, terme,
  mot-clé déclencheur (texte et type de correspondance du mot-clé), type
  d'appariement du terme, impressions, clics, coût, conversions. Lu dans
  `search_term_view` ; ≈ 8 700 lignes sur 90 jours chez A, au-delà d'une page
  de 10 000 sans erreur (ticket 19). Les termes reviennent en minuscules,
  accents conservés : aucune normalisation maison.
- **Clusters de Google** (Search) — par campagne Search : cluster (`id`,
  libellé), impressions, clics, conversions, **sans coût** (refusé par l'API),
  et les termes qu'il liste avec leurs chiffres ; plus le niveau compte
  (`customer_search_term_insight`) pour « Toutes les campagnes ». Une requête
  par campagne, **fenêtre agrégée** sans `segments.date` (la série par jour
  exige un seul `id` par requête, ticket 19). Les `id` sont stables d'une
  semaine à l'autre (956 sur 959 chez A).
- **Ne se construisent pas** : éléments PMax, éléments RSA chiffrés, mots-clés
  (`keyword_view`) et niveau de qualité, objectifs de conversion par campagne,
  portée, vues vidéo et quartiles, emplacements — tous hors périmètre.

### La récolte (sans module nouveau côté orchestration)

- Chaque récolte nouvelle s'ajoute au parcours Google existant, un appel par
  fichier comme aujourd'hui, avec sa propre fraîcheur et le même recouvrement
  de 30 jours pour les tables par jour ; les clusters sont relus en entier sur
  leur fenêtre à chaque passage.
- **Passage de v25 à v26** (v26 répond, vérifié au ticket 10).
- **Piège à tenir** (ticket 10) : avec `segments.date`, Google **omet** les
  jours où toutes les métriques demandées sont à 0. Une requête qui ne demande
  que des conversions rend donc beaucoup moins de lignes ; chaque requête
  demande les métriques dont elle a besoin, et un jour absent n'est jamais
  écrit comme une ligne à 0.
- **Reprise de l'historique** : par la récolte complète existante (départ
  forcé), 37 mois au plus par jour. `change_event` garde sa fenêtre de 30 jours
  (une fenêtre plus large fait rejeter la requête entière, `CLAUDE.md` §8).
- Le journal des changements Google existe déjà (`platform_changes`, upsert) ;
  la liste des catégories gardées pour Google est écrite à côté de la récolte
  et reprise mot pour mot par l'info-bulle de la légende, comme sur Meta.

### Comparaison — la mécanique (ticket 16, variante A)

- **Réglages au-dessus** : **Type de campagne** (Tous, puis les types présents
  sur la période), **Niveau** (Campagnes › Groupes › Annonces — jamais les
  éléments), **deux métriques** de la vue (axe horizontal, axe vertical). La
  première classe la liste, décroissante (croissante pour un coût) ; « — » en
  bas. Choisir pour l'une la métrique de l'autre les échange.
- **Niveau « Groupes »** = groupes d'annonces et groupes d'éléments ensemble,
  avec le repère de type. **Niveau « Annonces »** : absent quand PMax est seul ;
  sur « Tous », une phrase dit que PMax n'en a pas.
- **Liste à cocher sur deux colonnes**, étiquette du type sur chaque ligne,
  **quatre cases au plus** (la 5ᵉ se refuse visiblement). Changer de type ou de
  niveau repart du pré-cochage.
- **Dessous, côte à côte** : le **nuage de la période** (axes = les deux
  métriques, taille = coût, non cochées en gris) et la **courbe jour par jour**
  des cochées, qui bascule entre les deux métriques.
- **« Lire »** sur chaque annonce, cible distincte de la case ; les groupes
  n'en ont pas.
- **Sur Meta, rien ne change** dans cette spec (§ Out of Scope).

### Tableau détaillé (ticket 09)

- Un seul tableau, ligne Total en tête ; le dépliage reste **hors de l'URL**,
  comme sur Meta.
- Profondeurs : Search, Display, Vidéo, Demand Gen → Campagne › Groupe
  d'annonces › Annonce ; PMax → Campagne › Groupe d'éléments ; Autres types →
  jusqu'où Google donne des groupes, sinon la campagne seule.
- Colonnes = la vue active ; « — » avec la raison au survol ; ratios recalculés
  par ligne ; export CSV tel qu'affiché, « — » compris, avec « Type de
  campagne ».

### Panneau latéral (ticket 12)

- **D'où il s'ouvre** : « Lire » sur une annonce de la Comparaison ; un point
  de la Tendance pour un jour. Le Tableau ne l'ouvre pas ; un groupe (d'annonces
  ou d'éléments) n'ouvre rien.
- **L'annonce** : tout ce qu'elle contient, tel que Google l'a reçu, selon son
  type (récits 58 à 64). Jamais une annonce recomposée. Un champ absent reste
  vide ; un montage inconnu le dit.
- **Les images** doivent rester lisibles dans six mois. Savoir si l'URL d'un
  asset Google expire se vérifie au ticket de construction ; si elle expire,
  téléversement dans Supabase Storage sur le patron Meta, avec **la même
  question bucket public ou privé** posée à David. La vidéo se lit par son
  identifiant YouTube, rien à stocker.
- **Le jour** : les changements de `platform_changes`, rangés par campagne,
  filtrés par campagne quand le Bandeau en a une. Avant la première récolte
  Google moins 30 jours, pas de point.

### Groupes de termes (tickets 19, 21)

- **Forme** : le graphe en grappes — un rond par groupe, ses termes reliés
  autour ; un terme rangé dans deux groupes relie les deux grappes ; 8 couleurs
  aux plus gros groupes, le reste gris.
- **Sélecteur Mots-clés | Clusters Google** en tête. Mots-clés : les termes
  sous leur mot-clé déclencheur, avec coût et type de correspondance. Clusters
  Google : les termes sous le cluster de Google, coût « — », réglage de taille
  Coût barré.
- **Toujours plusieurs métriques** : ligne de totaux (clics, impressions,
  conversions, coût) ; fiche de la grappe terme par terme avec la ligne
  « Masqués par Google » ; classement clics · conversions · coût ; taille des
  ronds au choix, clics par défaut.
- **La part masquée** se calcule, ne se lit pas : en mode Mots-clés, total de
  la campagne (lu dans `google_ads_insights`) moins la somme des termes ; en
  mode Clusters, total du cluster moins ses termes listés. 44 à 61 % des clics
  Search sont masqués (ticket 19).
- **Filtre par campagne Search** au-dessus du module, « Toutes les campagnes »
  compris ; une campagne Search choisie au Bandeau le préremplit.
- « Sans cluster » et « N petits clusters » (≤ 5 clics) hachurés, en dernier,
  avec leur raison. Une phrase dit qu'un même sujet est découpé par langue.
- Aucun « mauvais », aucun « à supprimer » (§1) : le module montre, le client
  décide.

### L'état de la page vit dans l'URL

Paramètres : la vue, la campagne (ID), la période, les réglages de la
Comparaison (type, niveau, deux métriques, lignes cochées), le jour ouvert,
l'annonce lue (ID), le mode, la campagne et la taille des Groupes de termes.

- **Un lien énumère ce qu'il change, jamais ce qu'il garde** (`CLAUDE.md` §8) :
  ouvrir un jour ne touche que le jour et retire l'annonce, et inversement.
- Un jour hors période ou une annonce inconnue ne s'ouvre pas.

### La lecture des données côté web

- Une couche de lecture **propre à Google** lit les lignes de la période et de
  la période d'avant, **paginées au-delà de 1 000** (`CLAUDE.md` §8), puis en
  tire le contenu de chaque module. Agrégations, ratios, règle « sans valeur »,
  profondeur par type, part masquée et grappes vivent dans des fonctions
  **pures, sans directive et sans import**, sur le patron de la lecture Meta,
  pour tourner sous Node sans Next ni Supabase.

### La grammaire

- La grammaire de module existante (le chiffre en premier, le plus gros).
  Skills `dataviz` et `frontend-design` avant de dessiner ; couleurs des séries
  passées au validateur de palette.
- `min-w-0` / `min-h-0` sur les enfants de grille et de flex.
- Les animations se coupent pour qui a réduit les animations.

---

## Testing Decisions

**Ce qu'est un bon test ici** : il donne une entrée qu'on peut écrire à la main
(une réponse GAQL, des lignes de base, des commandes d'URL) et vérifie ce que
l'utilisateur lira — un nombre, un « — », une ligne présente ou absente, une
profondeur de dépliage. Il ne vérifie jamais comment le code y arrive. Les cas
qui comptent sont ceux de `CLAUDE.md` §7.

**Deux seams, qui se rejoignent au schéma** — les mêmes que Meta. La base
sépare la récolte (Python, nocturne) de la page (TypeScript, à la demande) ;
un seam unique traverserait Supabase et le worker, intestable hors ligne.

1. **Récolte — « réponse Google → lignes à écrire »**. Les fonctions qui
   transforment le JSON des requêtes GAQL en lignes de base, sans réseau. À
   couvrir : le type de campagne recopié brut ; une colonne de conversion
   absente → `NULL`, jamais 0 ; un jour omis par Google n'est pas écrit à 0 ;
   les groupes d'éléments PMax rattachés à leur campagne ; les réglages de
   valeur d'une action lus tels quels ; le contenu RSA (15 titres, épinglage,
   chemin), Display et Vidéo, une adresse absente reste vide, un montage inconnu
   est signalé ; le terme et son mot-clé déclencheur ; un cluster sans coût ;
   le micro converti une seule fois.
2. **Page — « lignes de base + commandes → contenu des modules »**. Les
   fonctions pures de la lecture Google. À couvrir : les taux total ÷ total
   (une ligne parent n'est pas la moyenne de ses enfants) ; diviseur nul →
   « — » ; pas de « +∞ % » ; totaux tous types ; la règle « sans valeur »
   (toutes sans valeur → « — » ; mélange → total Google + drapeau) recalculée
   au filtre campagne ; les profondeurs par type au Tableau ; « Annonces »
   absent quand PMax est seul, phrase sur « Tous » ; « Groupes » qui réunit
   groupes d'annonces et d'éléments ; quatre cases au plus ; le pré-cochage au
   changement de type ou de niveau ; la part masquée ; les grappes (un terme
   dans deux groupes, petits clusters regroupés, fourre-tout) ; le coût
   « — » en mode Clusters ; plus de 1 000 lignes lues entières ; le jour en
   cours exclu ; une campagne renommée reste une ligne.

**Prior art** : la lecture Meta et son harnais
(`.scratch/meta-ads/harnais/06-la-page-meta-neuve/`), la lecture Instagram et
le sien (`.scratch/instagram-construction/harnais/09-la-lecture/`,
`lecture.test.ts` lancé par `lancer.sh`) pour le seam page ; les harnais Python
d'Instagram (`harnais/01` à `08`) pour le seam récolte. `saas/web` n'a pas de
lanceur de tests : chaque ticket **écrit son harnais** (`CLAUDE.md` §9).

**Ce qui ne se teste qu'en vrai** :
- `rm -rf .next tsconfig.tsbuildinfo`, `npx tsc --noEmit` et `npm run build`
  verts, **18 routes** ; `python3.12 -m py_compile` sur la récolte touchée.
- La forme réelle du contenu des annonces, des clusters et des réglages de
  valeur : **après un passage du worker** — un lancement à la main de
  `weekly-fetch.yml` (`force` pour réécrire les 30 jours ; la récolte complète
  pour reprendre l'historique), ou le cron du Jour de travail. Chaque ticket
  dit lequel.
- La migration sur un PostgreSQL jetable avant d'être donnée à David.
- L'écran dans Chrome : les trois vues, la Comparaison et ses trois réglages,
  le Tableau déplié sur un Search et un PMax, le point → le panneau du jour,
  « Lire » → une annonce Search, les deux modes des Groupes de termes, un lien
  partagé qui rouvre le même état. Les totaux d'un mois face à Google Ads
  (repère : octobre 2026 chez A, ticket 10).

---

## Out of Scope

- **La Comparaison sur Meta.** La variante A y ajouterait un niveau Campagnes
  et un réglage Objectif ; David ne s'est pas prononcé (carte, « Not yet
  specified »). La page Meta ne change pas.
- **Le reste de l'Analyse Search** : nuage des mots-clés, éléments RSA (titres
  et descriptions chiffrés), niveau de qualité, onglet Étendue, choix des
  actions de conversion à analyser et `campaign_conversion_goal` (tickets 18,
  20 ; `BACKLOG.md`).
- **L'analyse propre aux autres types** : éléments, audiences et termes de
  PMax, emplacements Display, vues, CPV et quartiles Vidéo (tickets 07, 08) —
  un type à la fois, plus tard.
- **La portée et la fréquence** : non additionnables, par campagne, 92 jours au
  plus (tickets 01, 10) — non récoltées, non affichées, comme sur Meta.
- **Le choix de la colonne de conversions affichée** (`all_conversions`,
  après affichage) — récoltées, pas affichées (`BACKLOG.md`).
- **Une zone « provisoire »** sur les derniers jours, tant que le délai de
  stabilisation n'est pas mesuré.
- **La section Google du rapport hebdo** (`CLAUDE.md` §1).
- **Toute jointure GA4** (ADR 0010).
- **Thèmes, labels, recommandations, regroupement des campagnes par
  thématique** — retirés du produit, ne reviennent pas par la bande.
- **Une page YouTube** : « Vidéo » est un type de `/google` (ticket 07) ;
  YouTube organique est une autre page (`BACKLOG.md`).

---

## Further Notes

**Tranché par défaut — David peut renverser sans toucher au reste :**

1. **La fenêtre des Clusters Google.** L'API ne donne pas de série par jour
   sans une requête par cluster (≈ 960 chez A), ni de cluster par groupe
   d'annonces. Par défaut, la récolte lit les clusters **sur les 90 derniers
   jours pleins** à chaque passage, et le module écrit cette fenêtre en mode
   Clusters quand elle diffère de la période du Bandeau. Le mode Mots-clés,
   lui, suit la période du Bandeau (récolté par jour). Alternative à éprouver
   si David veut que les clusters suivent la période : récolter par semaine et
   additionner, à condition que les `id` restent stables — ce qu'un essai
   devrait vérifier au-delà d'une semaine de décalage.
2. **« Toutes les campagnes » en mode Clusters** lit le niveau compte, qui
   **mêle Search et PMax** (ticket 19 : 35 076 clics pour 16 224 Search) ; une
   phrase le dit, et ce total ne se compare pas au mode Mots-clés.
3. **Un jour sans ligne est un trou**, comme sur Meta, même si Google omet les
   jours entièrement à 0 : la couverture de récolte permettrait de les écrire
   à 0, mais ce serait un écart de comportement entre deux modules de même nom
   (ADR 0011). À revoir pour les deux régies ensemble si David le veut.
4. **Le bucket des images d'annonces Google** suit la réponse que David donnera
   pour Meta.

**Mesure en attente** : un second relevé des conversions jour par jour du
compte A sur 27.10–09.11 (premier relevé au ticket 10), une à deux semaines
plus tard, dira combien les derniers jours bougent. Il décidera s'il faut un
jour une zone « provisoire » — pour Google et Meta ensemble.

**Échantillon** : les décisions de volume et de type reposent sur deux comptes
d'un seul utilisateur (ticket 03), où Search et PMax font 100 % de la dépense
récente. Display, Vidéo et Demand Gen n'ont été vus que sur 36 mois.
