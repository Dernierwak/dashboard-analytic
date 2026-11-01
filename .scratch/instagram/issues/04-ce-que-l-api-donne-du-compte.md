# 04: Ce que l'API Instagram donne du compte, jour par jour

Type: research
Status: open
Blocked by: —
Assignee: —

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
