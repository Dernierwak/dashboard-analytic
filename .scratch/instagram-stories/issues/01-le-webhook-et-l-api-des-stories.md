# 01: Le webhook et l'API des stories, à jour

Type: research
Status: resolved
Blocked by: —
Assignee: Claude (2026-11-25)

## Question

La recherche du 2026-11-01 a lu les stories en passant ; le circuit retenu
(carte, Decisions so far) repose sur des points qu'elle n'a pas creusés.
Documentation Meta for Developers seulement, Graph v24.0 (celle de la
récolte) et changelogs jusqu'à la dernière version ; ce qui n'est pas écrit se
dit **non documenté**, une déduction se nomme déduction.

1. **Le contenu exact du webhook `story_insights`** aujourd'hui : la liste
   `impressions, reach, taps_forward, taps_back, exits, replies` est-elle
   encore celle-là après la dépréciation d'`impressions` (v22) ? `views` ou
   `navigation` y sont-ils entrés ?
2. **Ce qu'il faut pour le recevoir** avec Facebook Login : abonnement de
   l'app (tableau de bord), abonnement **par compte** (`subscribed_apps` sur
   la Page ? sur le compte Instagram ?), permissions, et surtout **mode Live
   et niveau d'accès** — faut-il la revue Meta ?
3. **La livraison** : délai après l'expiration, nombre et durée des
   nouvelles tentatives quand notre route répond une erreur, taille et forme
   du message (un `entry` par compte ? plusieurs stories par message ?).
4. **`/{ig-user-id}/stories`** : champs rendus (`media_url`,
   `thumbnail_url`, `timestamp`, `permalink`, `media_type`), durée de vie de
   `media_url`, pagination, limites d'appels pour un passage par heure.
5. **La signature** : `X-Hub-Signature-256`, sur quel corps, avec quel
   secret.

Sources de départ : référence des webhooks Instagram
(https://developers.facebook.com/docs/graph-api/webhooks/reference/instagram),
page Insights
(https://developers.facebook.com/docs/instagram-platform/insights), guide
Webhooks de la plateforme Instagram.

Livrable : `.scratch/instagram-stories/research/webhook-et-api.md`, réponse
courte en tête, citations, puis la réponse résumée ici.

## Answer

Détail, citations et URL : [research/webhook-et-api.md](../research/webhook-et-api.md).

- **Contenu** : la référence liste toujours `impressions`, `reach`, `taps_forward`, `taps_back`, `exits`, `replies` (+ `media_id`) ; ni `views` ni `navigation`. Aucun changelog ne l'a touchée depuis 2019, alors qu'`impressions` (v22) et les trois taps (2023-09-12) ont quitté l'API. Ce qui arrive vraiment : **non documenté** — à lire sur une vraie livraison.
- **Pour le recevoir** : app **Live** (en Développement, seulement les tests du tableau de bord et les comptes ayant un rôle sur l'app) ; champ coché au tableau de bord ; `POST /{page-id}/subscribed_apps` avec un **jeton de Page** (sur la Page, pas sur le compte Instagram).
- **Permissions du champ** en Facebook Login : `instagram_basic`, `instagram_manage_insights`, `pages_manage_metadata`, `pages_read_engagement`, `pages_show_list`. **Il nous manque `pages_manage_metadata` et `pages_read_engagement`.**
- **Revue** : « Webhooks does not require App Review », mais servir des comptes qu'on ne possède pas demande l'Advanced Access → App Review + vérification d'entreprise (**déduction** pour Pulse : revue nécessaire).
- **Livraison** : à l'expiration (délai **non documenté**) ; seules les 24 premières heures de métriques ; `-1` sous 5.
- **Nouvelles tentatives** : immédiate, puis « a few more times » à fréquence décroissante sur **36 h**, abandon ensuite ; nombre **non documenté**. Répondre `200 OK` vite (délai Instagram **non documenté**). Doublons possibles : idempotence.
- **Forme** : `object: instagram`, `entry[]` (id = compte IG) → `changes[]` (`field`, `value`) ; lots jusqu'à 1 000 mises à jour, non garantis → tout parcourir.
- **`/stories`** : `id` par défaut, champs IG Media sur demande ; `media_url` optionnel (audio sous droits), **durée de vie non documentée** ; `thumbnail_url` vidéo seulement ; pagination par curseurs (`next` absent = fin) ; plafond BUC 4800 × impressions / 24 h — un passage horaire en est très loin (**déduction**).
- **Signature** : `X-Hub-Signature-256` = `sha256=` + SHA256 avec l'**App Secret** sur « the payload » ; Messenger précise « escaped unicode, lowercase hex ». Signer le corps brut, jamais un JSON reparsé (**déduction**).
- Doc contradictoire sur `subscribed_fields` côté Page : à essayer.
