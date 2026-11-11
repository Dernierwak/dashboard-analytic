# 19: L'essai réel de l'Analyse Search

Type: task
Status: resolved
Blocked by: 18
Assignee: Claude (session 2026-11-11)

## Question

[L'Analyse Search](18-l-analyse-search.md) est tranchée sur la foi de la doc
de l'API v26 (tickets 17 et 18, aucun appel réel). **Avant la spec, qu'est-ce
qui tient sur les deux comptes réels ?** Même démarche que
[L'essai réel des métriques Google](10-l-essai-reel.md) — par l'API, v26,
fenêtre de 90 jours, jour en cours exclu.

À relever, chacun avec la requête, le nombre de lignes et ce qui revient :

1. **Catégories de termes** (`customer_search_term_insight`, puis
   `campaign_search_term_insight` sur une campagne) : libellés obtenus, termes
   par catégorie, part « autres » / fourre-tout. **La condition de David** : un
   mot récurrent (« gratuit » ou l'équivalent réel du compte) ressort-il dans
   une catégorie à lui, ou est-il noyé dans une catégorie d'intention ? Les
   `id` et libellés sont-ils les mêmes sur deux fenêtres décalées d'une
   semaine ? Filtres obligatoires, `RESOURCE_EXHAUSTED`, pagination.
2. **Conversions par action** : `segments.conversion_action` sur
   `keyword_view` et `search_term_view` avec `segments.date` ; la somme par
   action redonne-t-elle `metrics.conversions` du mot-clé ? Noms des actions
   principales lus dans `conversion_action`.
3. **Éléments RSA** : `ad_group_ad_asset_view` par jour — impressions, clics,
   coût, conversions remplis ? Volume de lignes.
4. **« Déclenché tout seul »** : sur quelques mots-clés, part des clics du
   terme au texte identique ; casse et accents des termes tels que rendus ;
   valeurs réelles de `segments.search_term_match_type`.
5. **Ce que 17 a laissé ouvert** : part perdue (budget) avec `keyword_view` ;
   statut `EXCLUDED` face aux listes partagées et à la liste du compte ;
   `quality_info.quality_score` rempli pour quelle part des mots-clés.

Résolu quand chaque point a sa réponse vérifiée ou son « non mesurable »
écrit, et que la condition des catégories est tranchée (catégories de Google
ou groupement par mot de Pulse).

## Answer

Essai AFK le 2026-11-11, **API v26**, lecture seule, scripts jetables hors
dépôt (`$CLAUDE_JOB_DIR/tmp`), aucun secret ni identifiant en sortie. Mêmes
comptes **A** (choisi dans Pulse) et **B** qu'aux tickets 03 et 10. Fenêtre :
90 jours pleins, **2026-08-13 → 2026-11-10**, jour en cours exclu ; fenêtre
décalée d'une semaine pour la stabilité : 2026-08-06 → 2026-11-03. Les termes
du compte ne sont pas recopiés ici (dépôt public) ; les exemples sont décrits.

### 1 · Catégories de termes

**Contraintes de requête, relevées par les refus de l'API :**

| Requête | Résultat |
|---|---|
| `customer_search_term_insight` sans filtre de date | acceptée |
| … avec `segments.date` sélectionné | ✗ `REQUIRES_FILTER_BY_SINGLE_RESOURCE` — **la série par jour exige un seul `id` de catégorie** dans le `WHERE` |
| … avec `metrics.cost_micros` | ✗ `PROHIBITED_METRIC_IN_SELECT_OR_WHERE_CLAUSE` — **pas de coût**, confirmé |
| `segments.search_term` sans `segments.search_subcategory` | ✗ `MISSING_FIELD_IN_SELECT_CLAUSE` — les deux vont ensemble (la sous-catégorie revient toujours vide) |
| `campaign_search_term_insight` sans filtre de campagne | ✗ `REQUIRES_FILTER_BY_SINGLE_RESOURCE` — **une campagne par requête** |
| une catégorie par jour (un `id`, 90 j) | 90 lignes, total = celui de la fenêtre au clic près |

Une soixantaine de requêtes enchaînées : aucun `RESOURCE_EXHAUSTED`.

**Ce qui revient :**

| | A | B |
|---|---|---|
| Catégories (90 j) | 959 | 64 |
| Clics couverts | 35 076 | 1 194 |
| Catégorie fourre-tout (libellé vide) | 1 — **16 %** des clics, **aucun terme listé** | 1 — 32 % des clics, aucun terme |
| Part des 10 premières catégories | 55 % | 93 % |
| Catégories à ≤ 5 clics | 625 | 49 |
| Niveau campagne (la campagne Search la plus dépensière) | 25 catégories, **100 %** des clics de la campagne | 24, 100 % |

- Le niveau compte couvre **Search et PMax** ensemble (A : 35 076 clics pour
  16 224 Search + 23 070 PMax, le PMax hors recherche n'y est pas) : ce n'est
  pas un sous-total de Search, et il ne se compare pas au rapport des termes.
- Une catégorie est un **sujet**, nommé d'après son terme principal (ex. «
  visite guidée + ville »), et **une langue** : le même sujet en allemand, en
  français et en anglais fait trois catégories. Les termes listés d'une
  catégorie ne font pas son total (termes masqués) : 40 termes et 2 324 clics
  pour une catégorie de 3 516 clics.
- **Stabilité** : d'une fenêtre à l'autre, décalée d'une semaine, A garde
  956 `id` sur 959 (B : 64 sur 64), **tous avec le même libellé**, et ces
  `id` portent 100 % des clics. Aucun libellé en double. L'`id` est une clé
  utilisable sur 90 jours glissants.

**La condition de David — le mot « gratuit » ressort-il ?** Oui, sans être
noyé, mais **en morceaux**. Chez A, six catégories portent le mot dans leurs
trois langues (« free … », « … kostenlos », « … gratuit »), ≈ 210 clics. Sur les
46 catégories dont les termes ont été lus (les 40 premières et les six «
gratuit »), **72 des 73 clics** des termes qui contiennent le mot tombent dans
une catégorie qui le porte ; un seul clic se trouve ailleurs. En revanche, ces
catégories absorbent aussi des termes sans le mot (5 des 18 termes de la
première), et **aucune catégorie « gratuit » unique** n'existe : le mot reste
collé à son sujet. B n'a pas de mot de ce genre (seulement une catégorie «
günstig », 2 clics).

**Tranché : les catégories de Google**, la condition est remplie — le mot
ressort dans des catégories à lui. Pulse ne regroupe pas par mot. Ce que ça
coûte, à dire à l'écran : sans coût, et un même sujet est découpé par langue.

### 2 · Conversions par action

`segments.conversion_action` avec `segments.date`, sur 90 jours :

| | `keyword_view` A | `search_term_view` A | `keyword_view` B | `search_term_view` B |
|---|---|---|---|---|
| Lignes sans / avec l'action | 575 / 7 398 | 701 / 6 998 | 5 / 6 | 2 / 2 |
| `metrics.conversions` | 4 111,19 | 2 111,80 | 7 | 2 |
| Somme par action | 4 111,19 | 2 111,80 | 7 | 2 |
| Clés (groupe, mot-clé ou terme, jour) en écart | **0** | **0** | 0 | 0 |

- **La somme par action redonne exactement `metrics.conversions`**, clé par
  clé : le choix des actions dans l'Analyse s'additionne sans reste.
- **Piège : le drapeau « principale » ne dit pas ce qui compte.** Chez A,
  **3 861 des 4 111 conversions Search (94 %)** viennent d'une action « Page
  vue », pourtant `primary_for_goal = false` et
  `include_in_conversions_metric = false`. Elle compte quand même parce que
  des campagnes fixent leurs objectifs **au niveau campagne**
  (`conversion_goal_campaign_config`, 17 campagnes actives sur 27) et
  déclarent « Page vue » comme objectif d'enchère
  (`campaign_conversion_goal.biddable`, 21 campagnes). Ce qui entre dans
  `metrics.conversions` se lit donc **par campagne** dans
  `campaign_conversion_goal`, pas dans `conversion_action`.
- Les noms et catégories des actions se lisent dans `conversion_action`
  (A : 188 actions dont 21 principales actives ; B : 51 dont 11). Ici
  anonymisés.

### 3 · Éléments RSA

`ad_group_ad_asset_view` par jour, campagnes Search :

| | A | B |
|---|---|---|
| Lignes (90 j) | 22 046 (≈ 245 / jour) | 2 583 |
| Jours | 90 | 90 |
| Types | titres 16 765, descriptions 5 281 | 1 673 / 910 |
| Impressions, clics, coût, conversions | **tous remplis**, coût sur chaque ligne | idem |
| Somme des éléments face aux annonces | impr. 650 307 / 141 254 ; clics 87 559 / 16 224 ; coût 87 156 / 16 050 CHF | clics 4 366 / 833 |
| `performance_label` | `NOT_APPLICABLE` sur toutes les lignes | idem |

- **Les chiffres d'un élément ne s'additionnent pas** : chaque impression
  d'une annonce est comptée pour chaque titre et description affichés
  (somme ≈ 5,4 fois les clics réels chez A). Un élément se lit seul, jamais
  en total ni en part d'un total.
- L'étiquette « Meilleur / Bon / Faible » ne revient plus : rien à afficher.

### 4 · « Déclenché tout seul », casse, appariement

`search_term_view`, 90 jours : A 10 106 lignes (au-delà d'une page de
10 000, lues sans erreur), B 196.

- **Casse** : tous les termes reviennent **en minuscules** (0 majuscule sur
  10 302 lignes) ; **accents et umlauts conservés** (1 597 termes chez A).
  Les mots-clés gardent la casse saisie (« E-Bike Touren »).
- **`segments.search_term_match_type`, valeurs réelles** : A `NEAR_PHRASE`
  6 911, `NEAR_EXACT` 2 430, `PHRASE` 654, `EXACT` 111 ; B ajoute `BROAD` (1).
- **Texte identique et `EXACT` coïncident** dès qu'on compare comme Google :
  casse, traits d'union et apostrophes neutralisés (« e bike touren » est
  `EXACT` pour « E-Bike Touren »). Comparés à la lettre, ils divergent de
  45 clics sur 1 220 chez A. **« Déclenché tout seul » = appariement `EXACT`**
  — Google fait déjà la normalisation ; Pulse n'a pas à la refaire.
- Part des clics déclenchés tout seuls : **13 % chez A, 30 % chez B** ; par
  mot-clé, de 0 % à 97 % parmi les six plus cliqués de chaque compte.

### 5 · Ce que 17 avait laissé ouvert

- **Part perdue (budget) sur `keyword_view`** : **rejetée**
  (`PROHIBITED_METRIC_IN_SELECT_OR_WHERE_CLAUSE`). La part d'impressions et
  la part perdue (classement) sont remplies sur toutes les lignes (A 8 297,
  B 553). La part perdue faute de budget ne se lit qu'à la campagne.
- **Statut `EXCLUDED`** : **non mesurable sur ces comptes**. Des exclusions
  existent sur chaque niveau (A : 1 201 au groupe, 222 à la campagne, 508
  dans les listes partagées ; B : 106 / 0 / 39), mais aucun terme servi
  dans la fenêtre ne correspond à une exclusion exacte qui s'applique à sa
  campagne. Le statut revient `NONE` (A 9 948) ou `ADDED` (158), jamais
  `EXCLUDED`. Aucune liste d'exclusion au niveau du compte. Savoir si les
  listes partagées allument `EXCLUDED` reste ouvert, et ne bloque rien : la
  spec n'affiche pas d'« exclu ».
- **`quality_info.quality_score`** : rempli pour **127 des 305 mots-clés
  actifs (42 %) chez A**, 11 sur 25 chez B ; **jamais** pour un mot-clé en
  pause ou supprimé (129 sur 9 369 lignes de `keyword_view` à 90 j). « Niveau
  de qualité du jour » = l'état actuel des seuls mots-clés actifs ; les
  autres s'écrivent « — » (pas assez de trafic, ou mot-clé inactif).

### En plus — la part masquée des termes

Le rapport des termes couvre **9 089 des 16 224 clics Search de A (56 %)**,
et 325 sur 833 pour B (39 %) : **44 % et 61 % des clics** viennent de termes
masqués. La liste des termes n'est jamais le tout ; la part masquée se
calcule (total campagne − somme des termes) et s'affiche.

### Ce qui change pour la spec

- Catégories : un `id` par appel pour la série par jour, une campagne par
  appel au niveau campagne ; volume de récolte ≈ 960 catégories × 90 jours
  pour A si toutes sont suivies par jour → récolter la fenêtre agrégée, et le
  jour seulement pour les catégories ouvertes.
- « Déclenché tout seul » = `EXACT`.
- Le sélecteur d'actions de conversion part de `campaign_conversion_goal`, pas
  du drapeau « principale ».
- Éléments RSA : jamais additionnés.
- Niveau de qualité : mots-clés actifs seulement.
