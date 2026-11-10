# 10: L'essai réel des métriques Google

Type: task
Status: resolved
Blocked by: 01, 03
Assignee: Dernierwak

## Question

La doc dit ce qui **devrait** être rendu ; **un vrai compte dit ce qui
l'est**. Sur les comptes réels (03), lancer les requêtes GAQL que la
recherche (01) a retenues, type par type, et noter :
- ce qui revient rempli, ce qui revient à 0, ce qui est rejeté ;
- les métriques vidéo et PMax sur de vraies campagnes ;
- le volume de lignes par niveau (mots-clés, éléments) sur 90 jours ;
- **conversions (ticket 05)** : que `metrics.conversions` retrouve la colonne
  « Conversions » de l'interface Google Ads et sa date (au clic — déduit, non
  écrit par Google) ; que `all_conversions` et `view_through_conversions`
  reviennent dans la même requête ; ce que rend `conversions_value` pour un
  compte **sans valeur configurée** — 0 ou vide (la page affiche « — »,
  jamais 0) ;
- _Non bloquant depuis la Comparaison (08) — sert l'analyse par type, au
  `BACKLOG.md`_ — **PMax et les audiences (ticket 07)** : David veut lire PMax par ses
  audiences. Vérifier si l'API rend une performance (impressions, coût,
  conversions) par audience ou signal d'audience pour une campagne PMax, ou
  seulement par groupe d'éléments, par réseau et en « insights » ; noter ce
  qui revient et à quel grain ;
- **Display et les emplacements (ticket 07)** : ce que rendent
  `group_placement_view` / `detail_placement_view` (sites, trafic) ;
- qu'un taux calculé sur les totaux (clics ÷ impressions, coût ÷ clics…) sur
  une campagne et une période retrouve celui de l'interface Google Ads.

Lecture seule, jetable (branche `essai/` ou `$CLAUDE_JOB_DIR/tmp`), aucun
secret en sortie (§7). HITL si l'agent ne peut pas joindre l'API : checklist
précise pour David.

## Rendu attendu

Un tableau métrique × type « rendu / 0 / rejeté » confronté à la doc, et les
écarts qui changent une décision de la carte.

## Answer

Essai AFK le 2026-11-10, **API v26**, lecture seule, scripts jetables hors
dépôt (`$CLAUDE_JOB_DIR/tmp`), aucun secret ni identifiant en sortie. Mêmes
deux comptes que le ticket 03 : **A** (choisi dans Pulse) et **B**. Période :
90 jours pleins, du 2026-08-12 au 2026-11-09. Display, Vidéo et Demand Gen
n'ayant rien diffusé sur 90 jours, ils sont lus sur **36 mois** (sous le
plafond de 37 mois).

### 1 · Ce que Google rend, type par type (`FROM campaign`)

✓ = rempli · **0** = `0` explicite · **∅** = champ absent de la réponse ·
✗ = requête rejetée.

| Métrique | Search | PMax | Display | Vidéo | Demand Gen | Doc (01) |
|---|---|---|---|---|---|---|
| impressions, clics, coût, CTR, CPC, interactions | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `conversions`, `all_conversions`, valeur, `*_by_conversion_date` — **une seule requête** | ✓ | ✓ | ✓ (0) | ✓ (0) | ✓ (0) | ✓ |
| `view_through_conversions` | **0** | **0** | ✓ | **0** | ✓ | ? |
| `video_trueview_views` | **0** | ✓ | **0** | ✓ | **0** | ? |
| `video_trueview_view_rate`, `trueview_average_cpv` | ∅ | ✓ | ∅ | ✓ | ∅ | ? |
| quartiles `video_quartile_p*_rate` | ∅ | **∅** | ✓ (19/24 campagnes) | ✓ | ∅ | ? sur `campaign` |
| `video_watch_time_duration_millis` | ∅ | ✓ | ∅ | **∅** | ∅ | — |
| `active_view_impressions` | **0** | **0** | ✓ | ✓ | ✓ | ? |
| `unique_users` (portée), fréquence | **✓** | **✓** | ∅ sur 36 mois* | ∅* | ∅* | « n/a » pour Search et PMax |
| `search_impression_share` | ✓ | ✓ | ∅ | ∅ | ∅ | ? pour PMax |
| `metrics.video_views` | ✗ `UNRECOGNIZED_FIELD` | | | | | absent en v26 ✓ |

\* La portée n'existe que sur 92 jours : Display, Vidéo et Demand Gen n'ont
diffusé qu'avant, elle n'a donc pas pu être vue sur eux.

**Trois règles de lecture, vérifiées :**

- **Un compteur revient à `0`, un taux revient absent.** Les vues TrueView
  valent `0` sur Search, où elles n'ont aucun sens : **un 0 de Google n'est pas
  une mesure**. Le « — » avec sa raison (ticket 09) se décide donc **par type,
  dans Pulse**, et non à partir de ce que Google renvoie.
- **La portée au-delà de 92 jours n'est pas rejetée, elle disparaît.** À 92
  jours exactement, 21 campagnes sur 21 sont remplies ; à 93 jours, 0 sur 21,
  sans aucune erreur. Par jour, elle n'est remplie que sur 44 lignes sur 91.
- **Les lignes à 0 dépendent de la requête.** Sans `segments.date`, Google
  rend toutes les campagnes, même entièrement à 0 (138 sur 159). Avec
  `segments.date`, il omet les jours où **toutes les métriques demandées**
  valent 0 : 370 lignes en ne demandant que les conversions, 1 562 avec les
  impressions. Un jour absent n'est pas un zéro.

### 2 · Conversions (ticket 05)

- Les trois colonnes reviennent dans la même requête. **`all_conversions`
  pèse 7 à 160 fois `conversions`** (A sur 90 jours : Search 33 021 contre
  4 410, PMax 62 943 contre 385). Le choix de la colonne affichée
  (`BACKLOG.md`) n'est pas un détail.
- **`conversions_value` n'est jamais vide** : `0` explicite sans conversion.
  Et **un compte sans valeur réelle rend quand même une valeur** : sur A, 8
  des 13 actions de conversion principales ont une valeur par défaut de **1**
  imposée (`always_use_default_value`) et 4 une valeur de **0** ; sur B, 9 sur
  11 valent 1. La valeur rendue est donc souvent « 1 × le nombre de
  conversions ». **Le « — sans valeur déclarée » de 05 ne se lit pas dans
  `conversions_value`** : il faudra lire `conversion_action.value_settings`.
  Ce que veulent dire ces réglages dans l'interface est vérifié par
  [Ce que l'interface Google Ads affiche, face à l'essai](13-l-interface-face-a-l-essai.md).
- **Date** : `conversions` (date du clic, une déduction) et
  `conversions_by_conversion_date` divergent chaque jour. Relevé de A,
  à comparer avec un second relevé pour mesurer la stabilisation (le
  brouillard de la carte) :

  | Jour | 27.10 | 28 | 29 | 30 | 31 | 1.11 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
  |---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
  | `conversions` | 5,02 | 12,00 | 14,00 | 2,00 | 13,01 | 14,62 | 8,41 | 5,67 | 4,00 | 15,83 | 1,00 | 0,61 | 3,39 | 3,00 |
  | par date de conversion | 15,99 | 12,00 | 17,00 | 3,00 | 12,00 | 14,00 | 8,11 | 11,00 | 7,00 | 12,00 | 4,00 | 3,00 | 8,00 | 3,00 |

- **La colonne « Conversions » de l'interface** n'a pas pu être lue par
  l'agent : la comparaison est confiée au ticket 13.

### 3 · Taux

Sur toutes les campagnes des deux comptes (21 + 3), le CTR, le CPC, le CPM et
le coût par conversion de Google sont **exactement** clics ÷ impressions, coût
÷ clics, etc. Le taux calculé sur les totaux de 05 retrouve donc celui de
Google. Les totaux d'octobre 2026 de A, à confronter à l'interface au ticket
13 : 182 679 impressions, 15 688 clics, 8 703,37 CHF, 303,69 conversions, CTR
8,5877 %, CPC 0,55.

### 4 · Volumes sur 90 jours (lignes) — pour la récolte

| Niveau | A | B |
|---|---|---|
| campagne × jour | 1 562 | 162 |
| groupe d'annonces × jour / annonce × jour | 1 357 / 1 357 | 249 / 307 |
| annonce PMax dans `ad_group_ad` | **0, sans erreur** (01 ✓) | 0 |
| Groupe d'éléments × jour | 600 | 72 |
| élément PMax × jour (période seule) | 20 822 (341) | 2 827 (89) |
| mot-clé × jour (période seule) | 8 363 (155) | 537 (11) |
| termes de recherche `search_term_view` | 8 685 | 167 |
| termes PMax `campaign_search_term_view` | 20 820 | 429 |

Le Groupe d'éléments × jour (ticket 09) reste léger. Les éléments et les
termes, que la carte a mis au `BACKLOG.md`, sont 15 à 35 fois plus lourds.

### 5 · PMax : par réseau oui, par audience non

- **`segments.ad_network_type` ventile PMax** : A = 95 % du coût sur Search,
  puis Discover, YouTube, Display (`CONTENT`), Maps, Partenaires, Gmail,
  `MIXED` ; B = 54 % sur Display, 25 % Search, 13 % YouTube. Deux comptes,
  deux PMax opposés.
- **Aucune performance par audience pour PMax** : `asset_group_signal` liste
  les signaux (205 sur A) mais **rejette toute métrique**
  (`PROHIBITED_METRIC_IN_SELECT_OR_WHERE_CLAUSE`) ; `campaign_audience_view`
  et `ad_group_audience_view` ne rendent aucune ligne PMax (Search, Display,
  Vidéo, Demand Gen seulement). Le service d'insights d'audience n'a pas été
  essayé. Ce que David voulait (« PMax par ses audiences ») n'est pas lisible
  au grain des métriques.

### 6 · Emplacements

- **Display** : `group_placement_view` et `detail_placement_view` rendent
  impressions, clics et coût par chaîne YouTube, site et application, soit
  **154 000 à 181 000 lignes** sur 36 mois pour A.
- **PMax** : `performance_max_placement_view` rend **les impressions
  seules** ; le coût est rejeté (`PROHIBITED_METRIC…`). 01 est confirmé.

### Les écarts qui touchent une décision de la carte

1. **Demand Gen n'est pas marginal dans l'historique** : sur 36 mois, A y a
   dépensé ≈ 50 900 CHF (53 M d'impressions, plus que PMax : 34 200 CHF) et B
   ≈ 14 600 CHF. 06 l'a rangé sous « Autres types » au vu des 90 jours, en
   disant qu'il serait nommé « quand un compte réel y dépensera ». Avec la
   reprise de l'historique, la question se repose :
   [Demand Gen, cinquième type nommé ?](14-demand-gen-nomme.md). Display
   pèse aussi ≈ 36 000 CHF chez A.
2. **Valeur de conversion** : elle est rendue même sans valeur réelle (point
   2). La règle de 05 tient, mais sa détection change de source (ticket 13).
3. **« — » par type, et non à partir de Google** (point 1) : cela durcit la
   règle de 09, sans la changer.
4. **La portée existe sur Search et PMax**, à 92 jours au plus, et
   disparaît en silence au-delà. 05 (« ne se totalise pas ») tient ; la
   récolte devra la demander sur des fenêtres de 92 jours au plus.
5. **PMax par audience est impossible** au grain des métriques : l'entrée
   du `BACKLOG.md` est à annoter.
