# 14: Ce que la récolte et le traitement doivent calculer

Type: task
Status: open
Blocked by: 07, 11, 13
Assignee: —

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
