# 04: Ce que l'API Instagram donne du compte, jour par jour

Type: research
Status: resolved
Blocked by: —
Assignee: Claude

## Question

Le module « la page » et un éventuel équivalent organique de la Tendance de
Meta demandent des chiffres **du compte**, jour par jour. Que rend
`GET /{ig-user-id}/insights` pour : `follower_count` (abonnés gagnés par
jour ?), `follows_and_unfollows`, `profile_views` / `profile_links_taps`,
`views`, `total_interactions`, `accounts_engaged`, `reach` — période,
`metric_type`, historique relisible, permissions requises, seuil
d'abonnés minimum ?

Point de départ obligatoire : la recherche déjà faite pour l'hebdo,
`.scratch/hebdo/issues/12-la-portee-organique-du-compte.md` (portée de compte
non dédoublonnée sur une plage et incluant les pubs ; `views` et
`total_interactions` additionnables ; `pages_read_engagement` absent de nos
scopes). Ne pas la refaire : la compléter pour les métriques qu'elle n'a pas
couvertes, et dire lesquelles exigent un changement de scope (qui oblige tous
les comptes à re-consentir).

Ce que la récolte lit aujourd'hui du compte :
`saas/data/fetch_data/sources/meta/instagram/fetchers/account.py` et la table
`followers_history`. Sources de premier rang seulement.

## Answer

Recherche du 2026-11-01, documentation Meta for Developers seulement, aucun
appel réel ; complète la recherche hebdo 12 sans la refaire. Tableau par
métrique et citations : branche `research/api-compte` (`fcd0d5e`),
`git show origin/research/api-compte:.scratch/instagram/research/api-compte.md`.

- **Un seul point d'accès**, `GET /{ig-user-id}/insights`, tout en
  `period=day`. **Seule `reach` rend une série par jour** (`time_series`) ;
  les autres n'acceptent que `total_value` (« sum » sur `since`/`until`) — une
  série jour par jour coûte donc un appel par jour (déduction).
- **S'additionnent** (événements) : `views`, `total_interactions` (boosts
  compris), `likes`, `comments`, `saves`, `shares`, `replies`, `reposts`,
  `profile_links_taps`, et les moitiés de `follows_and_unfollows`. **Ne
  s'additionnent pas** (comptes uniques, pubs comprises, estimées) : `reach`,
  `accounts_engaged`.
- **Abonnés gagnés / perdus** : `follows_and_unfollows` les compte, mais sa
  seule ventilation `follow_type` est définie « abonnés ou non-abonnés » — **la
  doc ne dit pas comment séparer gagnés et perdus**. Rien sous 100 abonnés.
- **`follower_count` n'est plus au tableau des métriques**, seulement cité dans
  les limitations ; statut ambigu.
- **Retirées** : `profile_views`, `website_clicks`, clics de contact (2025-01-08),
  `impressions` (2025-04-21). Du profil, il reste `profile_links_taps`.
- **Historique** : 90 jours pour les métriques du compte, 48 h de retard,
  absence = jeu vide. Fuseau des jours et plage maximale non documentés.
- **Scopes** : toutes les métriques relèvent du même jeu ; la doc exige
  `pages_read_engagement` en Facebook Login, que nous ne demandons pas — et
  pourtant la récolte lit déjà `followers_count` sans lui (Meta ne
  l'appliquerait pas à la lettre, déduction). L'ajouter = re-consentement de
  tous les comptes + revue Meta.
- **La récolte aujourd'hui** : `account.py` lit `followers_count` et
  `media_count`, `sync.py` jette le résultat ; aucune métrique `/insights` de
  compte n'est appelée.
- **`followers_history` n'a plus d'écrivain dans le dépôt** — vérifié :
  seulement des lecteurs (`saas/web/lib/channels.ts:923`,
  `saas/data/supabase/_queries.py`). L'Edge Function `fetch-followers` qui
  l'alimentait (et écrivait 0 quand Meta ne rendait rien) a quitté le dépôt
  le 2026-09-06 (`7f188f3`). **Le chiffre d'abonnés de `/instagram` est
  peut-être figé depuis septembre** — à constater :
  [L'état des abonnés en base](16-l-etat-des-abonnes-en-base.md).
- Les inconnues restantes se tranchent par un appel réel :
  [L'essai réel des métriques Instagram](17-l-essai-reel-des-metriques.md).
