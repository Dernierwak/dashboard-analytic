# 09: Les posts à venir se lisent-ils chez Meta ?

Type: research
Status: resolved
Blocked by: —

## Question

David veut voir les posts « à venir » sur la page hebdo. Le payload n'en porte
aucun : la frise ne connaît que les posts publiés (`frise.posts`, date et
format). Pour les campagnes, `planifiee` et `fin_prevue` existent déjà.

L'API Instagram Graph (et celle des Pages Facebook, si le compte y programme)
expose-t-elle les publications **programmées** d'un compte professionnel ?
Quel endpoint, quelle permission (et est-elle dans celles que
`saas/web/app/api/oauth/meta/start/route.ts` demande déjà — un nouveau scope
oblige tous les comptes à re-consentir), quels champs, et quelles limites
(ce qu'un post programmé depuis Meta Business Suite donne, ou pas) ?

Sources primaires uniquement (docs développeurs Meta). Si ce n'est pas
lisible, le dire : « à venir » se limitera aux campagnes, et le ticket « La vue
des campagnes et des posts » doit le savoir avant de trancher.

## Answer

Recherche du 2026-10-30, docs développeurs Meta uniquement, aucun appel réel.

- **Instagram : non.** `GET /{ig-user-id}/media` ne documente aucun média
  programmé ; le nœud IG Media n'a ni champ d'état ni date future
  (`timestamp` = date de création) ; Content Publishing n'a ni
  `scheduled_publish_time` ni endpoint de programmation. Un post programmé
  depuis Business Suite ou l'app n'est donc pas lisible — conclusion tirée
  d'une absence dans la doc, pas d'une interdiction écrite.
- **Page Facebook : oui, attesté.** `GET /{page-id}/scheduled_posts` (et
  `promotable_posts`, filtré par `is_published`) ; champs
  `scheduled_publish_time`, `is_published`, `message`, `attachments`. Exige
  `pages_read_engagement` (ou `pages_read_user_content`, `pages_manage_ads`,
  `pages_manage_metadata`) — **aucune n'est dans nos scopes**
  (`ads_management, pages_show_list, instagram_basic,
  instagram_manage_insights, business_management`). L'ajouter = re-consentement
  de tous les comptes + App Review, et une nouvelle source à récolter (aucun
  post de Page n'est lu aujourd'hui). Que Business Suite y figure : probable,
  non attesté.
- **Conséquence** : avec les scopes actuels, « à venir » se limite aux
  campagnes (`planifiee`, `fin_prevue`).

Sources :
- https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media
- https://developers.facebook.com/docs/instagram-platform/reference/instagram-media
- https://developers.facebook.com/docs/instagram-platform/content-publishing
- https://developers.facebook.com/docs/graph-api/reference/page/scheduled_posts/
- https://developers.facebook.com/docs/graph-api/reference/page/promotable_posts/
- https://developers.facebook.com/docs/graph-api/reference/post/
