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
