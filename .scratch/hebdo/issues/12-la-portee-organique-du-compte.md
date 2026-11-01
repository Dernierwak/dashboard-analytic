# 12: La portée organique du compte

Type: research
Status: resolved
Blocked by: —

## Question

Le bandeau des totaux montre la portée organique par plateforme, sans total
(ticket 01). Aujourd'hui elle vaut « — » : on ne récolte que la portée **de
chaque post** (`instagram_organic_posts.reach`), et des portées de posts ne
s'additionnent pas, parce qu'une même personne est comptée sur chaque post
(§7, constaté dans [La page entière, en maquette](08-la-page-entiere-en-maquette.md)).

**L'API Instagram donne-t-elle la portée du compte sur 7 jours pleins, avec
les permissions actuelles, et pour une semaine passée calée sur le Jour de
travail ?** Si oui : quel point d'accès, quelle métrique, quelle période,
quelles limites (historique, délai de mise à jour, comptes de moins de
100 abonnés). Si non : la case sort du bandeau, ou elle affiche autre chose
qui s'additionne honnêtement (les vues, ticket 01) — à trancher avec David.

Sources de premier rang seulement (documentation Meta for Developers).

## Answer

Recherche du 2026-10-31, docs Meta for Developers uniquement, aucun appel
réel. Les points décisifs ont été relus sur la page de référence.

- **Non : aucune portée de semaine garantie.** `GET /{ig-user-id}/insights?metric=reach`
  n'accepte que `period=day` (`week` et `days_28` ne figurent plus pour le
  compte). En `metric_type=total_value` sur une plage `since`/`until`, la doc
  définit la valeur comme « **sum** of requested metric values » : rien ne
  dit qu'elle est dédoublonnée, et le mot « sum » dit plutôt le contraire.
  L'afficher comme « portée de la semaine » contreviendrait à §7.
- **Et elle n'est pas organique** : « unique accounts that have seen your
  content, at least once, **including in ads** » — et estimée (« This metric
  is estimated »). Même dédoublonnée, elle ne remplirait pas une case
  « portée organique ».
- **Limites écrites** : données en retard jusqu'à **48 h** (une semaine finie
  la veille peut être incomplète) ; sans `since`/`until`, 24 h ; une absence
  rend un jeu vide, pas 0 ; historique annoncé à 90 jours sur une page
  datée. Non documentés : la plage maximale et le fuseau des jours (les
  exemples à 07:00 UTC suggèrent l'heure du Pacifique — déduction).
- **Permissions** : en Facebook Login, la doc demande `instagram_basic` +
  `instagram_manage_insights` + **`pages_read_engagement`** (et `ads_read` si
  l'utilisateur a un rôle Business Manager sur la Page). Ce dernier n'est pas
  dans nos scopes ; toute nouvelle métrique de compte s'essaie en vrai avant
  d'être promise.
- **Ce qui s'additionne honnêtement** : `views` (« times your content was
  played or displayed », `total_value`, `period=day`, marquée « in
  development ») et `total_interactions` (contenus boostés compris) — des
  comptages d'événements, additionnables jour par jour par définition
  (lecture des définitions, pas une phrase de la doc). `accounts_engaged`
  compte des comptes uniques : il ne s'additionne pas.
- **Conséquence** : la case « portée organique » ne peut pas montrer une
  portée de semaine. Ce qu'elle devient — sortie du bandeau, vues, ou autre —
  se tranche avec David dans
  [Ce que montre la case Instagram du bandeau](16-ce-que-montre-la-case-instagram-du-bandeau.md).
- **Pour lever le doute sur `total_value`** : un seul appel réel, `reach` en
  `total_value` sur 7 jours comparé à la somme des 7 valeurs `time_series`
  du même compte. S'ils diffèrent, l'API dédoublonne en pratique — sans
  garantie écrite, donc sans valeur pour §7.

Sources :
- https://developers.facebook.com/docs/instagram-platform/api-reference/instagram-user/insights
- https://developers.facebook.com/docs/instagram-platform/insights/
- https://developers.facebook.com/docs/instagram-platform/changelog
- https://developers.facebook.com/docs/graph-api/changelog/version24.0/
