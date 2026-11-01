# Quand les chiffres d'un post se figent — recherche

Ticket : [03 · Quand les chiffres d'un post se figent](../issues/03-quand-les-chiffres-d-un-post-se-figent.md).
Recherche du 2026-11-01, documentation Meta for Developers uniquement, aucun
appel réel à l'API. Les phrases décisives ont été relues sur la page de
référence et sont citées en anglais, telles quelles.

## Réponse courte

- **Cumul seulement, aucune série par jour.** Les insights d'un média se lisent
  en `lifetime` : « Period is automatically set to `lifetime` in the request
  and cannot be changed, so this value will always be `lifetime`. » Le
  paramètre `period` liste bien `day`, `week`, `days_28`…, mais la réponse les
  écrase. Aucune série jour par jour depuis la publication n'est documentée.
- **Conséquence : l'âge égal ne s'obtient qu'en relevant nous-mêmes**, à chaque
  passage, la valeur cumulée du jour — ce qui commande
  [Garder l'historique des chiffres d'un post](../issues/05-garder-l-historique-d-un-post.md).
  Une valeur « à J+7 » n'existe que si on a lu le post à J+7.
- **Aucun délai de maturité documenté.** Nulle part Meta n'écrit qu'après N
  jours les chiffres d'un post (Reel, image, carrousel) cessent de bouger.
  Aucune distinction par format sur ce point.
- **Ce qui s'en approche le plus : la latence de 48 h.** « Data used to
  calculate metrics can be delayed up to 48 hours. » C'est un plancher, pas un
  seuil de maturité : un post de moins de 48 h a forcément des chiffres
  incomplets ; au-delà, rien ne dit qu'ils sont figés.
- **Rétention : 2 ans pour un média.** « Metrics data is stored for up to
  2 years. » (À ne pas confondre avec les 90 jours des insights du compte :
  « User Metrics data is stored for up to 90 days. »)
- **Story : 24 h, puis plus rien par l'API.** « Story media metrics are only
  available for 24 hours. » La story a, elle, une fin écrite : sa valeur se
  fige à l'expiration — et il faut la capter avant.
- **Story : le webhook `story_insights` livre les chiffres à l'expiration**
  (« Notifies you when a story expires »), Facebook Login seulement, valeurs
  < 5 rendues `-1` dans le webhook et en erreur `10` par l'appel direct. Une
  story mise en highlight peut renvoyer des données après expiration, avec des
  résultats qui peuvent différer entre API, webhook et interface.
- **Une absence n'est pas un zéro, écrit par Meta** : « the API returns an
  empty data set instead of `0` for individual metrics » — même règle que §7.
- **Différences Reel / post / story : les métriques, pas le temps.** Reel :
  `views`, `reach`, `ig_reels_avg_watch_time`, `ig_reels_video_view_total_time`,
  `reels_skip_rate`… mais **pas `follows`** ni `profile_visits`. Post (FEED) :
  `follows`, `profile_visits`, `profile_activity`, `reach`, `views`… Story :
  `follows`, `navigation`, `replies`, `link_clicks`… Aucun média d'un album
  n'a d'insights propres.
- **Les dates de création comptent pour l'historique** : `impressions` n'existe
  plus pour les médias créés à partir du 2024-07-02 ; `views` remplace
  `plays`/`impressions` depuis le 2025-01-21. Une comparaison qui remonte avant
  ces dates ne lit pas la même métrique.

## Détail

### Série par jour ou cumul

Point d'accès : `GET /{ig-media-id}/insights`. La page de référence liste, pour
le paramètre de requête `period`, « Comma-separated list of time periods you
want returned » avec `day`, `week`, `days_28`, `month`, `lifetime`,
`total_over_range`. Mais la description de la réponse tranche : la période est
forcée à `lifetime` et ne peut pas être changée. La page d'ensemble
(*Instagram Platform insights*) montre la même chose : les réponses média
portent `"period": "lifetime"`, quand les requêtes de compte sont en `day`.

La documentation ne dit pas explicitement que `lifetime` est « le cumul depuis
la publication jusqu'à la lecture » — c'est la lecture du mot et du fait qu'il
n'existe aucun paramètre `since`/`until` pour un média (déduction, pas une
phrase de la doc). Aucune mention de série temporelle (`time_series`) pour un
média ; `breakdown` existe, mais pour découper une valeur, pas pour la dater.

Les champs du nœud média (`like_count`, `comments_count`) sont eux aussi des
compteurs lus à l'instant ; rien ne les date.

### Délai de maturité

Cherché dans : la référence Media Insights, la page d'ensemble Insights, le
changelog de l'Instagram Platform, les webhooks. **Aucune phrase** sur une
durée pendant laquelle les chiffres d'un post évoluent, ni sur un moment où ils
deviennent définitifs, ni par format. La page d'ensemble ne dit pas non plus à
quelle vitesse les insights apparaissent ; seule la référence Media Insights
donne les 48 h.

Ce qui existe de plus proche, par ordre d'utilité pour un seuil :

| Fait écrit | Ce qu'il permet | Ce qu'il ne permet pas |
|---|---|---|
| Latence jusqu'à 48 h | Marquer « trop jeune » tout post de moins de 48 h (incomplet par construction) | Dire qu'un post de 3 jours est figé |
| Story : 24 h, webhook à l'expiration | Une valeur finale de story, datée | Rien pour Reel / post |
| Rétention 2 ans | Relire un vieux post et obtenir encore son cumul | Retrouver sa valeur à un âge passé |

Un seuil de maturité au-delà de 48 h (7 jours, 30 jours…) **ne peut donc pas
se sourcer chez Meta**. S'il en faut un, il devra venir de nos propres relevés
(ticket 05) : mesurer, post par post, quand le cumul cesse de bouger dans nos
données, et le dire comme une observation de Pulse, pas comme une règle
d'Instagram.

### Organique et payant

La référence écrit que `comments`, `likes`, `views`, `total_interactions`
« report organic interaction metrics only; interactions on ads containing a
media object are not counted », et que les `total_*` (`total_likes`,
`total_comments`, `total_views`, ajoutés le 2026-04-22) incluent publicité et
vues croisées Facebook, en Facebook Login seulement. Attention : une entrée
ancienne du changelog (2018-04-23) dit que `impressions` et `reach` incluent
l'activité publicitaire ; la référence actuelle ne le contredit ni ne le
confirme pour `reach`. Un post boosté peut donc continuer de bouger tant que la
publicité tourne — non documenté comme tel, à vérifier dans le ticket sur le
post.

## Limites

- La documentation a été lue telle que servie le 2026-11-01 ; Meta la réécrit
  sans versionner les pages de référence.
- Que `lifetime` soit un cumul jusqu'à l'instant de lecture est une lecture du
  mot, cohérente avec tout le reste, mais non écrite noir sur blanc.
- Le fuseau horaire et l'heure de « fin » d'une story ne sont pas documentés.
- Les 48 h sont un maximum annoncé (« up to »), sans distinction par métrique
  ni par format.
- Le comportement exact d'une story mise en highlight (quelles valeurs, jusqu'à
  quand) n'est pas documenté au-delà de l'avertissement cité.
- Aucun appel réel n'a été fait : le forçage à `lifetime` d'un `period=day` sur
  un média n'a pas été essayé. Un seul appel le confirmerait.

## Sources

- https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights
  (même contenu sous https://developers.facebook.com/documentation/instagram-platform/reference/instagram-media/insights)
- https://developers.facebook.com/docs/instagram-platform/insights/
- https://developers.facebook.com/docs/instagram-platform/changelog
- https://developers.facebook.com/docs/graph-api/webhooks/reference/instagram
- https://developers.facebook.com/documentation/instagram-platform/webhooks/fields
- https://developers.facebook.com/docs/instagram-platform/webhooks
