# 14: Ce que le traitement doit calculer

Type: task
Status: resolved
Blocked by: —

## Question

La page est validée ([La page entière, en maquette](08-la-page-entiere-en-maquette.md)).
**Dresser la liste « clé du payload → d'où elle vient »** pour chaque chose
qu'elle montre, et ce qui **sort** du payload. Pas de construction : une
table qui dit, pour chaque valeur, la table source, le calcul et la fenêtre.

Le point de départ exécutable est `.scratch/hebdo/prototype-08/extraire.py` :
il calcule déjà, sur un vrai compte, les totaux, la semaine type et ses
quartiles par canal, les changements retenus, les campagnes de l'année
(identité par ID, statut, dates déclarées, visuels, dépense par semaine) et
les posts. À confronter à `saas/data/supabase/processed_data/weekly_report/builder.py`
et à ce qu'il produit aujourd'hui.

Ce que la carte sait déjà :

- **sortent** : `metrics_read`, `metrics_prev`, `metrics_series`, `kpis`
  ([l'inventaire](../inventaire-2026-10-28.md)) et les `changements` déduits
  de la dépense (ticket 05). `canaux_muets` ne sort plus : il devient la
  source de l'état par canal ci-dessous ([Les états de la page](13-les-etats-de-la-page.md)) ;
- **entrent** : un **signal de couverture du journal** par plateforme
  (ticket 05, exigence ferme du ticket 13) ; `permalink` et
  `media_product_type` des posts (ticket 04) ; un **état par canal** pour la
  semaine — récolté · jeton mort · panne interne, semaine partielle comprise
  — ; la **date de connexion** de chaque source ; le nombre de semaines avec
  un ratio (ticket 13) ;
- **la semaine** s'ancre sur le Jour de travail, pas sur la veille du jour
  de fabrication (ticket 02, `builder.py`, `last_full_day`) ;
- la frise navigue sur **toute l'année** : le payload hebdo la porte-t-il,
  ou la page la lit-elle à part (comme `lib/changements-api.ts`) ?

Le harnais qui exécute `build_payload` hors ligne est à écrire pour ce
ticket (`CLAUDE.md` §9) : aucun ne subsiste dans l'arbre.

## Answer

Mené seul le 2026-11-01. Rien n'est construit : ce qui suit est la table
que [La spec de la page hebdo](15-la-spec-de-la-page-hebdo.md) reprendra.
Les noms de clés sont **proposés** ; la construction peut les renommer, pas
en changer le sens.

**Comment c'est établi.** Lecture de `builder.py`, `reader.py`,
`_queries.py`, `fetch_state/state.py`, de la récolte Meta et du schéma ;
deux sondes en lecture seule sur la vraie base (noms de colonnes et
comptes, aucune valeur) ; et un harnais qui **exécute** `build_payload`
hors ligne,
`.scratch/hebdo/harnais/14-ce-que-le-traitement-doit-calculer/test_payload.py`
(`python3.12 <chemin>` depuis la racine) : sept constats sur le traitement
d'aujourd'hui, tous vérifiés à l'exécution le 2026-11-01.

### 1 · Ce qui sort du payload

| Clé d'aujourd'hui | Pourquoi elle sort |
|---|---|
| `verdict`, `verdict_pct`, `verdict_metric`, `verdict_tone` | Le verdict part (ticket 01). |
| `kpi_focus` | La boussole part (tickets 01, 06). |
| `metrics_read`, `metrics_prev`, `metrics_series` | Jamais lues, Meta+Google confondus (inventaire). |
| `kpis` | Clé morte depuis le départ de l'email. |
| `changements` (déduits de la dépense) | Seul compte ce que la plateforme a écrit (ticket 05). |
| `canaux_muets` | Remplacée par l'état par source (§3), qui la contient. `semaines_muettes` et `SEUIL_ESCALADE` vont au chantier de la remontée des erreurs (Out of scope) : il devra reprendre ce que lit `error_reporter.py` (`note_canaux_qui_durent`, nourri par `publish_weekly_report`). |
| `frise`, dans sa forme actuelle | Remplacée par §6 : identité par nom, deux ans, posts sans visuel (harnais). |
| `week_label` | La page écrit son titre depuis `semaine` (§2). |

Les lectures que seules ces clés utilisaient partent avec elles :
`objectif`, `ga4_contexte`, `ga4_insights`, `abonnes` et les agrégats
Instagram (engagement, portée moyenne) de `build_payload`.

### 2 · La semaine

| Clé | Source | Calcul |
|---|---|---|
| `semaine.fin` | `profiles.fetch_schedule` (« Monday »…, défaut lundi) + horloge du lecteur | Le dernier Jour de travail ≤ aujourd'hui, **moins un jour**. Jamais la dernière donnée. |
| `semaine.debut` | — | `fin − 6 jours`. |
| `semaine.numero` | — | Semaine ISO de `fin`. |
| `week_start` (clé d'écriture) | — | Même règle qu'aujourd'hui (lundi ISO de `fin`), appliquée à la nouvelle `fin`. |

**Écart prouvé par le harnais.** Le builder ancre sur
`min(dernière donnée, hier)`, or la récolte du Jour de travail écrit une
ligne Meta pour le jour même (`Fenetre(since, today)`). Publié le jeudi :
22 → 28 octobre, juste. **Refait le samedi sans nouvelle récolte : 23 → 29
octobre**, la semaine englobe le jour du fetch, incomplet (§7 de
`CLAUDE.md`). Le `Lecteur` doit donc gagner une méthode qui rend le Jour de
travail.

### 3 · L'état de chaque source

Une entrée par source **connectée** ; une source pas branchée n'a pas
d'entrée et n'apparaît nulle part (ticket 13, point 1).

| Clé | Source | Calcul |
|---|---|---|
| `sources[c].etat` | voir la règle | `recolte` · `jeton_mort` · `panne` |
| `sources[c].connecte_le` | `connected_accounts.created_at` (colonne vérifiée en base) | Date de la ligne de connexion. Sert « Meta n'était pas encore connecté » pour une semaine antérieure (ticket 13, point 9). |
| `sources[c].journal` | couverture du journal (§7) | `couvert` · `non_couvert`. Sépare « Changements en cours de récupération » du vrai 0 (ticket 13, point 8). |

**La règle de l'état**, dans cet ordre :

1. `connected_accounts.a_reconnecter_depuis` renseigné → `jeton_mort`.
2. La couverture des insights (§7) n'atteint pas `semaine.fin` → `panne`
   (couvre « semaine récoltée en partie », ticket 13, point 5).
3. Sinon → `recolte`.

**Deux signaux sur lesquels on ne peut PAS s'appuyer**, dont un que le
prototype utilise :

- **« a une ligne au dernier jour »** (`extraire.py`, `meta_couvre`) : Meta
  n'écrit aucune ligne pour un jour sans diffusion. Une semaine en pause
  passerait pour une panne, alors que le ticket 03 veut « 0 CHF » et des
  ratios « — ».
- **`fetch_progress`** : `planifie` remet chaque ligne à `attente` à chaque
  passage (une ligne par canal, aucun historique), et une récolte de
  routine qui rencontre des tranches refusées **écrit ce qu'elle a et finit
  `fini`** (`sources/meta/ads/sync.py`). `fini` ne prouve donc pas que la
  semaine est entière.

### 4 · Le bandeau des totaux

Fenêtre : `semaine`. Une valeur par source dont l'état est `recolte`,
`null` sinon (jamais 0).

| Clé | Source | Calcul |
|---|---|---|
| `totaux.depense.meta` | `meta_ads_insights.spend` | Somme sur la semaine. |
| `totaux.depense.google` | `google_ads_insights.cost_micros` | Somme ÷ 10⁶. |
| `totaux.impressions.meta` / `.google` | `impressions` des deux tables | Somme. |

Le grand chiffre (somme des sources qui ont répondu) et la note qui nomme
la source absente (ticket 13, point 2) se calculent à l'affichage depuis
ces valeurs : rien à ajouter au payload. Pas de `totaux.portee` : la case
sort du bandeau ([Ce que montre la case Instagram du bandeau](16-ce-que-montre-la-case-instagram-du-bandeau.md)).

### 5 · Le module des canaux, une carte par canal

Meta seul aujourd'hui (Out of scope de la carte) ; Google entrera avec les
mêmes clés depuis `google_ads_insights`.

| Clé | Source | Calcul | Fenêtre |
|---|---|---|---|
| `canaux[c].volumes.depense / impressions / clics` | insights | Sommes. `0` si la source a répondu sans diffusion ; `null` si `etat ≠ recolte`. | `semaine` |
| `canaux[c].ratios.{ctr,cpc,cpm}.valeur` | volumes | CTR = clics ÷ impressions × 100 ; CPC = dépense ÷ clics ; CPM = dépense ÷ impressions × 1 000 ; `null` si le dénominateur vaut 0. | `semaine` |
| `canaux[c].ratios[m].semaines` | insights | Le ratio de **chacune** des 12 semaines précédentes, calculé sur ses propres totaux (ticket 03, point 3), chaque semaine calée sur le Jour de travail ; une semaine sans ratio n'y entre pas. Donne les points et les moustaches (min → max). | 12 semaines avant `semaine` |
| `canaux[c].ratios[m].n` | idem | Nombre de semaines avec un ratio. « encore N » = 6 − `n` (ticket 13, point 6). | idem |
| `canaux[c].ratios[m].mediane`, `.q1`, `.q3` | idem | Médiane et quartiles des `semaines` ; `null` si `n < 6`. **La méthode de quartile s'écrit dans la spec** : le prototype prend `statistics.quantiles(n=4)`, méthode « exclusive » par défaut. | idem |
| `canaux[c].ratios[m].etat` | idem | `au_dessus` · `dans` · `en_dessous` de [q1, q3] ; `null` si `n < 6` ou valeur `null`. Le sens (mieux, moins bien) se décide à l'affichage. | — |
| `canaux[c].changements[]` | `platform_changes` | `occurred_at` dans la semaine (au fuseau de la ligne, colonne `fuseau`), `categorie` parmi `budget, enchere, audience, creatif, objectif, motcle, diffusion, calendrier, autre` (ticket 05) ; par entrée : jour, catégorie, `campaign_id`, nom de campagne, `resume`. | `semaine` |
| `canaux[c].changements[].objet` | `platform_changes.niveau`, `object_name` | Hors campagne : « Compte publicitaire » au niveau du compte, sinon `object_name` (ticket 13, point 11). | — |

Le regroupement par catégorie et le compte « Budget · 3 » se font à
l'affichage. Le lien « journal → » se construit depuis `semaine`.

### 6 · « Ce qui a été fait » : la frise et le panneau

**Dans le payload, pas lu à part.** La page navigue sur l'année, mais tout
ce qu'elle montre se calcule en Python et reste figé avec le rapport :
identité par ID, règle des statuts, jointure annonce → créa, dépense par
semaine. C'est la règle déjà écrite dans
`processed_data/weekly_report/CLAUDE.md` (« batch écrit, serverless
lit ») ; une lecture à part façon `lib/changements-api.ts` la
contournerait. Le volume reste modeste : 462 posts dans toute la base, et
seules les campagnes de l'année entrent.

| Clé | Source | Calcul |
|---|---|---|
| `frise.annee` | `semaine.fin` | L'année de `fin`. Aujourd'hui, deux ans depuis janvier N-1 (harnais). |
| `frise.campagnes[].id`, `.plateforme` | `campaign_id` des insights et des `*_campaign_config` | **Identité par ID** (ticket 04). Le harnais le prouve : aujourd'hui deux homonymes se fusionnent et une campagne renommée se coupe en deux barres. |
| `.nom` | config, sinon la ligne d'insights la plus récente | Le nom **actuel**. |
| `.debut`, `.fin`, `.fin_declaree` | `start_date` / `end_date` de la config ; sinon premier et dernier jour avec dépense | En base : Meta 395/395 débuts et 373 fins déclarés, Google 156/158 et 120. |
| `.statut` | `effective_status` + dates | Fin déclarée passée → `terminee` ; sinon `WITH_ISSUES` → `probleme` ; `ACTIVE`/`ENABLED` → `en_cours` ; `PAUSED` → `en_pause` ; début déclaré futur → `prevue` ; non récolté → absent (ticket 13, point 10). Valeurs vues en base : Meta `ACTIVE`, `PAUSED`, `WITH_ISSUES` (**aucun statut « programmé » chez Meta** : `prevue` ne vient que d'un début futur) ; Google `ENABLED`, `PAUSED`, `REMOVED`, `null`. **`REMOVED` n'entre dans aucun statut tranché** (§8). |
| `.visuels[]` | `meta_ads_insights.ad_id` → `meta_ads_creatives.image_url` ou `vignette_url` | Les créas des annonces, par dépense décroissante, sans doublon, 4 au plus. Rien pour Google (ticket 11). |
| `.depense_par_semaine` | insights | Dépense de chaque semaine de l'année, calée sur le Jour de travail : sert la dépense au survol pour **n'importe quelle** semaine choisie, et « lancée / terminée cette semaine ». |
| Entrée dans l'année | — | A dépensé dans l'année, ou ses dates déclarées la touchent ; une fin non déclarée seule ne suffit pas (le prototype l'a mesuré : des campagnes « actives » sans fin n'ont rien diffusé depuis des années). |
| `frise.posts[]` : `.plateforme`, `.date`, `.format`, `.visuel`, `.lien` | `instagram_organic_posts` : `date`, `type`, `media_url` ; `permalink` et `media_product_type` **à récolter** (§7) | Posts de l'année, aucun chiffre (ticket 04). Sans `media_product_type`, un `VIDEO` (122 en base) ne peut pas se dire « Reel ». |

### 7 · Ce que la récolte doit fournir d'abord (hors `build_payload`)

Sans ces trois points, le payload ne peut pas tenir ce que la page promet.

1. **Brancher la vérification du jeton.** `verifier()` existe pour Meta
   (`sources/meta/auth/token.py`) et pour Google
   (`sources/google/auth/token.py`), mais **aucun code ne l'appelle** : le
   commit d3df753 notait « Branchement dans plan.py : à la fusion avec
   recolte/restructuration », et ce branchement n'a jamais été fait. Rien
   n'écrit donc `a_reconnecter_depuis` (0 compte sur 3 marqué en base), et
   un jeton mort ne se distingue d'aucune autre panne. Le plan d'origine
   (visible dans le diff de 1b05a92) : jeton mort →
   `a_reconnecter_depuis = coalesce(a_reconnecter_depuis, now())` et la
   raison, canal sauté ; jeton inconnu → ne rien marquer.
2. **Un signal de couverture, par source et par flux** (insights, journal,
   posts) : « récolté sans trou jusqu'au <date> », écrit seulement quand le
   flux a rendu sans tranche refusée, et qui **survit** aux passages
   suivants. Ni `fetch_progress` ni les lignes d'insights ne le donnent
   (§3). Pour le journal, l'échec est aujourd'hui imprimé puis avalé
   (`source_data/platform.py`, `journal_changements`). Forme recommandée :
   une petite table à part, créée par ajout seul ; sa forme exacte se
   tranche à la construction.
3. **`permalink` et `media_product_type`** des posts Instagram : même
   permission qu'aujourd'hui, aucun re-consentement (ticket 04). Colonnes
   absentes de `instagram_organic_posts` (vérifié en base).

Le compte neuf (ticket 13, point 12) ne demande rien de plus : ses dates
sortent de `semaine` et du Jour de travail.

### 8 · Ce que ce ticket laisse ouvert

- **Une campagne Google `REMOVED`** (41 en base) : terminée, cachée, ou un
  sixième statut ? À David → [Le statut d'une campagne Google supprimée](17-le-statut-d-une-campagne-google-supprimee.md).
- ~~**La portée du bandeau**~~ : tranché par le ticket 16 — la case sort.
- **La méthode de quartile** : à écrire dans la spec (§5), pour que « tes
  habitudes » ne dépende pas de l'outil.

**À ne pas recopier du prototype** : le test « a répondu » (§3).
