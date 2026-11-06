# 14: Ce que la récolte et le traitement doivent calculer

Type: task
Status: resolved
Blocked by: 07, 11, 13
Assignee: Claude (session 2026-11-06)

## Question

Une fois la page décidée, **dresser la liste exacte** de ce qui doit changer
sous elle : nouvelles métriques à récolter (et leur essai réel), relevé daté
des posts, colonnes et tables, ce qui se calcule dans le traitement Python et
ce qui se calcule dans `lib/` côté page, et la correction de `follows` écrit
`0` en cas d'absence. Chaque calcul nommé une seule fois, à un seul endroit.
Sur le modèle de `.scratch/hebdo/issues/14-ce-que-le-traitement-doit-calculer.md`.

Défauts de récolte déjà relevés, à porter dans la liste
([recherche 02](02-ce-que-l-api-donne-d-un-post.md)) :
- `fetchers/post_metrics.py:33` range le format par `media_type` et teste
  `"REEL"`, valeur qui n'existe pas : une vidéo du fil perd ses `likes`. Le
  format se lit dans `media_product_type` ;
- une métrique absente — `follows` en tête, et toujours sur un Reel — est
  écrite `0` au lieu de rester absente (§7) ;
- `pages_read_engagement` exigé par la doc en Facebook Login, absent de nos
  scopes : un essai réel avant toute nouvelle métrique.

Tranché par [Garder l'historique](05-garder-l-historique-d-un-post.md) :
une table de relevés (un relevé s'ajoute, n'écrase jamais, porte son âge
réel), un mode quotidien léger du worker (insights + `follows` des posts de
J+0 à J+7, sans plafond), la relecture du Jour de travail qui ajoute aussi un
relevé, et la durée réelle d'un passage à mesurer à l'essai.

Tranché par [La place d'un post](06-la-place-d-un-post.md) : quartiles
exclusifs **par format × métrique × période**, le post compris, minimum 6,
hors norme à 1,5 × IQR ; taux d'engagement = interactions ÷ portée du post
(vide sans portée). À calculer **une seule fois, à un seul endroit** — décider
lequel (traitement ou `lib/`), la période venant du Bandeau.

Tranché par [L'âge d'un post](07-l-age-d-un-post.md) : trois tranches fixes
sur l'âge réel du dernier relevé — moins de 48 h (hors de la foule), 48 h →
7 jours (quartiles **à âge égal** : par format × J+n, sur les relevés de ce
J+n, minimum 6), plus de 7 jours (foule normale). Les posts antérieurs à la
mise en service = plus de 7 jours, jamais dans l'âge égal.

Tranché par [Écarter un post](08-ecarter-un-post.md) : deux filtres de
lecture, dans l'URL. « Sans les hors norme » : bornes de Tukey (1,5 × IQR)
calculées **une fois** sur la foule du format pour la métrique affichée, les
posts au-delà retirés, quartiles recalculés sur le reste, sans itérer.
« Sans les boostés » : toutes métriques, sur un marqueur de boost que fixe
[Les posts boostés](19-les-posts-boostes.md). Il faut donc, par format et par
métrique, les quartiles avec et sans les écartés, le nombre d'écartés et leur
raison, et le minimum de 6 jugé après le retrait.

Tranché par [Les formats et les abonnés](09-les-formats-et-les-abonnes.md) :
- **le lieu du calcul** : à la lecture (période libre, filtres dans l'URL),
  **un seul calcul de la foule** dans un dossier commun de `lib/` qui sert
  tous les graphiques — quartiles exclusifs, Tukey, minimum 6, totaux,
  « x sur n » — contrôlé sur [1…6] → 1,75 / 3,5 ;
- **quatre formats** (Reel, Carrousel, Image, Vidéo du fil) : la récolte
  stocke `media_product_type` en plus de `media_type` (`sync.py:193-197`
  range aujourd'hui un Reel en `VIDEO`) ;
- **totaux** seulement pour ce qui se compte (`follows`, likes, commentaires,
  partages, enregistrements, vues, visites de profil), jamais portée ni taux ;
- **deux métriques dérivées** : `follows` ÷ portée × 1 000 ; (enregistrements
  + partages) ÷ portée — vides sans portée ;
- **nettoyage de l'existant** : `follows` des Reels → null ; une relecture
  unique de tous les posts du fil réécrit `follows` (0 si Instagram rend 0,
  null s'il ne rend rien) — lancement à la main depuis GitHub Actions
  (`weekly-fetch.yml`, `force`), à confronter au plafond de relecture.

> **Éclairé par [Les règles d'analyse réglables](11-les-regles-d-analyse-reglables.md)
> (2026-11-05)** : aucun paramètre de calcul réglable — Tukey 1,5, minimum
> 6, quartiles exclusifs et seuils d'âge sont des constantes. À calculer en
> plus : la **portée ÷ abonnés du jour de publication** par post, vide
> quand l'abonné du jour manque (dépend de
> [L'état des abonnés en base](16-l-etat-des-abonnes-en-base.md)).

> **Éclairé par [La page entière, en maquette](13-la-page-entiere-en-maquette.md)
> (2026-11-06)** :
> - **la référence** : quartiles par format × métrique sur **les 12 derniers
>   mois glissants** (plus « × période ») ; en plus, les quartiles des **3
>   derniers mois** et du **dernier mois** (minimum 6, sinon rien) et l'écart
>   de leur médiane à celle de l'année ;
> - **la liste de droite** : les 5 meilleurs de la période sur la métrique
>   choisie ; **le Tableau** : tous les posts du compte, triable par date et
>   par métrique, **export `.csv`** (Date en première colonne, absence =
>   cellule vide) ;
> - **lire `permalink`** dans la lecture des posts (en base, ignoré par
>   `getInstaDash`) — c'est lui qui ouvre le lecteur Instagram ; quelques
>   posts n'en ont pas ;
> - relevé dans la base : `follows` et `shares` **absents** de
>   `instagram_organic_posts` (l'objectif Abonnés n'a aucun chiffre) ; les
>   **Reels sans j'aime** ; portée et interactions du compte **jamais
>   récoltées** ; `followers_history` figé au 2026-09-04.

## Answer

Mené seul le 2026-11-06. Rien n'est construit : ce qui suit est la liste que
[La spec de la page Instagram](15-la-spec-de-la-page-instagram.md) reprendra.
Les noms de colonnes, tables et fonctions sont **proposés** ; la construction
peut les renommer, pas en changer le sens.

**Comment c'est établi.** Lecture de la récolte
(`sources/meta/instagram/sync.py`, `fetchers/post_metrics.py`,
`fetchers/account.py`), de l'écriture (`source_data/meta.py`), du schéma
(`migrations/000_run_me_all.sql`), de la lecture de la page
(`web/lib/channels.ts:getInstaDash`), du quartile de l'hebdo
(`processed_data/weekly_report/blocs/canaux.py:107`) et de la maquette
retenue ; deux sondes **en lecture seule** sur la vraie base (GET PostgREST,
noms de colonnes et comptes, aucune valeur ni identifiant imprimé), le
2026-11-06.

### 0 · Ce que la sonde corrige

[La page entière, en maquette](13-la-page-entiere-en-maquette.md) disait
`follows` absent de la table. **C'est faux** : la colonne existe et est
remplie sur les 468 posts. Le vrai état :

| Constat (2026-11-06) | Chiffre |
|---|---|
| Colonnes de `instagram_organic_posts` | `caption, comments, created_at, date, follows, id, likes, media_product_type, media_url, permalink, post_id, reach, saved, type, user_id, views` — **ni `shares` ni `profile_visits`** |
| `follows` à 0 | 177 / 468 — dont **les 124 `VIDEO`, toutes à 0** : des zéros fabriqués (§7), Meta ne rend jamais `follows` sur un Reel |
| `likes` des `VIDEO` | 0 sur les 124 — le défaut `"REEL"` de `post_metrics.py:33` |
| `media_product_type` et `permalink` remplis | **32 / 468** (la récolte ne les écrit que sur les posts qu'elle reprend) |
| Posts en base / chez Instagram | deux comptes Pulse sur **la même page** : 233 et 235 en base pour **1 839** chez Instagram ; 33 et 35 au-delà des 200 derniers, donc **jamais relus** |
| `followers_history` | 176 lignes, dernière le **2026-09-04** pour les deux comptes |
| `couverture_recolte` | une ligne `('instagram', 'posts')` par compte |

### 1 · La récolte — ce qui se corrige

| # | Où | Correction |
|---|---|---|
| R1 | `post_metrics.py:33` | La liste des métriques se choisit par **`media_product_type`**, plus par `media_type` : `REELS` et `FEED` demandent `reach, views, likes, comments, saved, shares` ; `FEED` seul demande en plus `follows, profile_visits` (recherche 02 : jamais sur un Reel). La vidéo du fil retrouve ses `likes`. |
| R2 | `post_metrics.py:41-55` | **Une métrique non rendue reste absente** : plus de `val or 0`, plus de `metrics["follows"] = 0` dans le `else` ni dans l'`except`. Un Reel n'a pas de clé `follows`. |
| R3 | `sync.py:201-206` | `m.get(k)` au lieu de `m.get(k, 0)` : la ligne envoie `None` pour une absence. Les métriques ne passent **pas** par `COLONNES_SI_CONNUES` : là, un `None` doit bien effacer un faux zéro. |
| R4 | `sync.py:192-194` | `info_du_post` est déjà appelé avant les métriques : passer son `media_product_type` à `metriques_du_post`. Un post sans `media_product_type` rendu prend la branche `FEED` sans `follows` (on ne sait pas, on ne demande pas). |
| R5 | `sync.py:187` | `compte.recuperer(acces)` lit `followers_count` et le jette : il s'écrit dans le relevé du compte (§2.3). |
| R6 | essai réel | `pages_read_engagement` absent des scopes : rien de §2 ne se construit avant [L'essai réel des métriques Instagram](17-l-essai-reel-des-metriques.md), point 1. |

### 2 · La récolte — ce qui s'ajoute

**2.1 · Le relevé d'un post** ([Garder l'historique](05-garder-l-historique-d-un-post.md)).
Chaque lecture des métriques d'un post — passage léger ou Jour de travail —
ajoute une ligne ; rien ne s'écrase.

**2.2 · Le passage léger quotidien.** Un nouveau mode du worker, lancé par le
cron de 07:00 UTC **pour tous les comptes Instagram**, Jour de travail ou
non (aujourd'hui `cockpit/scheduled_update.py:_due_today` écarte les autres
jours) : il relève les posts en base de **moins de 8 × 24 h** (insights +
`follows`, 2 appels ; 1 pour un Reel), sans image, sans toucher au
rapport ; puis le relevé du compte (§2.3). **Un post publié entre deux
passages n'est pas encore en base** : le passage léger lit donc aussi la
première page de l'inventaire (`/media?limit=25`, 1 appel) et la fiche des
posts neufs — sans quoi un post du mardi attendrait le Jour de travail pour
son premier relevé et l'âge égal ne marcherait pas. Le Jour de travail
garde la récolte complète, qui ajoute aussi un relevé à chaque post relu.

**2.3 · Le relevé du compte, un par jour** ([Le compte dans le temps](10-le-compte-dans-le-temps.md)).
Pour **hier** (le jour en cours est exclu) : `reach` (`period=day`),
`total_interactions`, gagnés / perdus (`follows_and_unfollows`, lecture
fixée par l'essai, point 3), et `followers_count` au moment du passage. Au
**premier** passage d'un compte : les 90 jours que Meta garde pour la
portée (1 appel) et les interactions (~90 appels, une fois). Les abonnés
n'ont pas d'historique chez Meta : la courbe commence au premier relevé.
Conditionnel à l'essai, point 8 : `reach` et `total_interactions` en
`breakdown=media_product_type` pour la part `AD` — sans valeur `AD`, rien
à stocker et l'interrupteur n'existe pas.

**2.4 · Le marqueur de boost** : `boost_ads_list` lu **à chaque relevé**,
au même appel que les chiffres ; la première fois qu'une annonce y paraît,
`booste_vu_le` prend la date et ne se vide plus — **fixé par
[Les posts boostés](19-les-posts-boostes.md)**. Sans `boost_ads_list` pour
notre jeton (essai réel, point 9), le filtre « sans les boostés » n'existe pas.

**2.5 · La relecture unique de tous les posts en base.** Elle remplit
`media_product_type`, `permalink`, `shares`, `profile_visits`, les `likes`
des vidéos, et vide `follows` des Reels. Deux obstacles vus au code :
`_a_relire` (`sync.py:78`) ne regarde que les 200 premiers de l'inventaire
et plafonne la reprise à 40 ; le mode `complete` du workflow ne change rien
à `_a_relire`. Il faut donc **un drapeau dédié** de `weekly-fetch.yml` qui
relit **chaque post déjà en base** (y compris ceux au-delà des 200), sans
plafond, une fois — environ 470 posts × 3 appels. Lancement à la main
depuis l'onglet GitHub Actions, après la migration. Un post supprimé chez
Instagram ne se relit pas : ce qu'il en reste se traite en §3.4.

### 3 · La base

Tout en **ajout seul** (une section 23 de `000_run_me_all.sql`), RLS en
lecture au propriétaire comme `couverture_recolte`.

**3.1 · `instagram_organic_posts`** reste **la fiche du post et son dernier
relevé** — ce que la page affiche :

| Colonne | Pourquoi |
|---|---|
| `shares` int, null | Partages (Engagement) et réactions fortes. |
| `profile_visits` int, null | Rendu par Meta sur le fil, au même appel que `follows` ; aucune décision ne l'affiche encore — **à retirer de R1 si la spec ne lui donne pas de place**. |
| `releve_a` timestamptz, null | La date du dernier relevé, que la page écrit (« chiffres au … »). Null = antérieur au relevé. |
| `booste_vu_le` date, null | Le filtre « sans les boostés » et l'étiquette « Boosté » — forme fixée par [Les posts boostés](19-les-posts-boostes.md) ; le relevé porte en plus `booste` (booléen du moment). |

**3.2 · `instagram_post_releves`** (nouvelle), clé `(user_id, post_id,
releve_a)` : `age_heures` (réel, numérique : un passage manqué donne 200 h,
jamais un faux J+7), puis `reach, views, likes, comments, saved, shares,
follows, profile_visits`, tous **nullables**. Index `(user_id, age_heures)` :
la lecture ne veut que les relevés de moins de 8 jours.

**3.3 · `instagram_compte_jours`** (nouvelle), clé `(user_id, jour)` :
`reach`, `total_interactions`, `abonnes` (`followers_count` du passage),
`gagnes`, `perdus` (ou rien, selon l'essai), et `reach_ad`,
`interactions_ad` si l'essai montre une valeur `AD`. Un jour sans ligne est
un trou, jamais un zéro.

**3.4 · Le nettoyage, à faire valider** (§7 : pas de `DELETE`, mais une
écriture qui efface) : après la relecture unique, les posts qu'elle n'a pas
pu relire (supprimés chez Instagram) gardent leurs faux zéros. Un
`UPDATE … SET follows = NULL, likes = NULL WHERE type = 'VIDEO' AND
media_product_type IS NULL` les vide — on ne peut plus savoir. À compter
avant (`SELECT count(*)` sur la même condition) et à montrer à David.

**3.5 · `followers_history`** : son sort (garder les anciennes lignes comme
premiers points de la courbe, ou non) se tranche dans
[L'état des abonnés en base](16-l-etat-des-abonnes-en-base.md) ; la sonde
répond à sa moitié SQL (figée au 2026-09-04 sur les deux comptes, 139 et 37
lignes). La lecture de la page la quitte pour `instagram_compte_jours`.

### 4 · La lecture — un seul calcul de la foule, dans `lib/instagram/`

Tranché par [Les formats et les abonnés](09-les-formats-et-les-abonnes.md) :
**à la lecture**, une fois, dans un dossier commun qui sert le module, la
liste, le Tableau, le Panneau et l'export. **Rien dans le traitement
Python** : `build_payload` ne touche pas à la page Instagram (le panneau
Organique de l'hebdo ne porte aucun chiffre, hebdo ticket 04).

| Valeur | Source | Calcul |
|---|---|---|
| `format` | `media_product_type` × `type` | `REELS` → Reel ; `FEED` + `VIDEO` → Vidéo du fil ; `CAROUSEL_ALBUM` → Carrousel ; `IMAGE` → Image. **`media_product_type` vide + `VIDEO` → format inconnu**, hors des quatre foules (aujourd'hui `FORMAT_LABEL` en fait un Reel, `channels.ts:899`). |
| métriques brutes | dernier relevé (`instagram_organic_posts`) | Lues telles quelles : **null reste null** (aujourd'hui `Number(p.x) \|\| 0`, `channels.ts:928-939`, refait des zéros). |
| `eng` (Engagement) | likes, comments, saved, shares, reach | (likes + comments + saved + shares) ÷ reach × 100 ; **vide** si `reach` est vide ou 0, ou si un terme manque. Remplace la formule à trois termes de la maquette, faite sans `shares`. |
| réactions fortes | saved, shares, reach | (saved + shares) ÷ reach ; même règle du vide. |
| abonnés pour 1 000 | follows, reach | follows ÷ reach × 1 000 ; vide sur un Reel (pas de `follows`). |
| portée ÷ abonnés | reach, `instagram_compte_jours.abonnes` du jour de publication | Vide si ce jour n'a pas de relevé du compte — donc vide pour tout post antérieur à la mise en service. |
| âge | `releve_a − date` | En heures ; < 48 h → hors de la foule ; 48 h → 7 j → âge égal ; au-delà, foule normale. Un post sans `releve_a` compte comme plus de 7 jours. |
| **la référence** (foule) | posts du format, 12 mois glissants, âge > 48 h, métrique non vide | Quartiles **exclusifs**, le résultat de `statistics.quantiles(method="exclusive")` (contrôle [1…6] → 1,75 / 3,5 / 5,25) ; médiane = post type ; `n` et « x sur n » quand des valeurs manquent ; **rien sous 6**. Le post lui-même compris. |
| moustaches 3 mois, 1 mois | idem, fenêtres plus courtes | Mêmes quartiles, minimum 6 ; écart de leur médiane à celle de l'année, en % ; aucune place calculée contre elles. Le seuil « ≈ » sous ±5 % attend [La place d'un post hors de l'année](20-la-place-d-un-post-hors-de-l-annee.md). |
| **la place** | valeur, quartiles de la référence | `en dessous` sous q1, `bas de tes habitudes` de q1 à la médiane, `haut de tes habitudes` de la médiane à q3, `au-dessus` au-delà ; **hors norme** hors de [q1 − 1,5 × IQR, q3 + 1,5 × IQR]. Les bornes exactes (≤ ou <) s'écrivent une fois, dans la spec. |
| place à âge égal | `instagram_post_releves`, âge < 8 × 24 h | Pour un post à J+n (n = ⌊âge ÷ 24⌋, 2 ≤ n ≤ 7) : de chaque autre post du format sur les 12 mois, son **premier** relevé tombé dans [n × 24, (n+1) × 24) h ; mêmes quartiles, minimum 6, sinon une mention. |
| « sans les hors norme » | la référence | Bornes de Tukey calculées **une fois** sur la référence de la métrique affichée, posts au-delà retirés, quartiles refaits sur le reste, minimum 6 jugé **après** ; nombre d'écartés et raison. |
| « sans les boostés » | `booste_vu_le` (ticket 19) | Retire les boostés de toutes les foules ; même comptage. |
| totaux d'un format | follows, likes, comments, shares, saved, views, profile_visits | Somme des valeurs non vides, avec « x sur n » ; **jamais** portée ni taux. |
| les 5 meilleurs | posts de la période, âge > 48 h | Tri décroissant sur la métrique choisie, sans les écartés ; un post sans valeur n'y entre pas. |
| le Tableau | tous les posts en base | Tri par date ou par métrique ; place contre la référence actuelle (ou selon le ticket 20 pour un post de plus de 12 mois). |
| l'export `.csv` | le Tableau | Date en première colonne, point-virgule, absence = cellule vide, jamais 0. |
| `permalink` | `instagram_organic_posts` | Lu par la page (aujourd'hui ignoré par `getInstaDash`) ; vide → ni lecteur ni lien. |
| la Tendance | `instagram_compte_jours` | Série par jour sur la période et la période d'avant ; portée : aucun total, au plus une moyenne par jour ; jours de publication = dates des posts. |

**Pagination** : les posts et les relevés de moins de 8 jours dépassent
vite 1 000 lignes sur un compte actif — `lireToutesLesPages` partout (§8).

### 5 · Ce qui part de la lecture actuelle

`followers`, `followersDelta`, `growth30`, `avgEng`, `histReach`,
`followersSeries` (lus dans `followers_history`), `topPosts` / `scope` (top
3 avec repli sur l'historique), `postsEng`, `comparaison`
(`batirComparaison`) et `FORMAT_LABEL` : remplacés par §4.
`_prototype-selection/calcul.ts` est jetable ; `lib/instagram/` s'écrit
neuf, avec son contrôle [1…6].

### 6 · Dans quel ordre, et ce qui attend encore

1. [L'essai réel](17-l-essai-reel-des-metriques.md) — scopes, `follows` sur
   un Reel, `follows_and_unfollows`, valeur `AD`.
2. R1–R4, la migration (§3.1, §3.2), la relecture unique (§2.5), puis le
   comptage et le nettoyage validé (§3.4).
3. Le passage léger et le relevé du compte (§2.2, §2.3, §3.3).
4. `lib/instagram/` et la page.

Restent **conditionnels**, sans changer la liste : la part `AD` et
gagnés / perdus (ticket 17), le marqueur de boost (ticket 19), le sort de
`followers_history` (ticket 16), la place d'un post de plus de 12 mois et
le seuil ±5 % (ticket 20), ce que voit un compte gratuit (ticket 18).

**Fait nouveau, hors de cette liste** : « tout ton historique » au Tableau
montre aujourd'hui 233 posts sur 1 839 — la récolte n'a jamais lu au-delà
des 200 derniers. Combien d'historique Pulse va chercher est une question
d'offre et de coût, pas de calcul → nouveau ticket
[La profondeur de l'historique des posts](21-la-profondeur-de-l-historique.md).

### 7 · Comment ce sera vérifié

Rien de tout cela ne se voit en cliquant. **La relecture unique** se lance à
la main depuis l'onglet GitHub Actions (`weekly-fetch.yml`, drapeau à
créer) ; **le premier relevé** du passage léger arrive au cron suivant
(07:00 UTC, n'importe quel jour) ; l'âge égal exige au moins 6 posts d'un
format relevés au même J+n, donc des semaines de relevés après la mise en
service. La sonde de §0, rejouée après la relecture, doit montrer
`media_product_type` sur tous les posts relus, `follows` vide sur les Reels
et `likes` > 0 sur les vidéos.

> **Éclairé par [L'essai réel](17-l-essai-reel-des-metriques.md)
> (2026-11-06)** : `follows` sur un Reel rend une **erreur 100** → null, jamais
> 0 ; sur un post du fil, 0 est un vrai 0. Gagnés / perdus = `FOLLOWER` /
> `NON_FOLLOWER` de `follows_and_unfollows`, fenêtre ≤ 30 jours. Part `AD` :
> à stocker pour Portée et Interactions (2.3). `boost_ads_list` : dédoublonner
> par `ad_id`, statuts en minuscules.
