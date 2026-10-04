# 19: La frise du rapport rapproche dépense et dates déclarées par le nom

Type: task
Status: needs-triage
Blocked by: 13

Trouvé en construisant le ticket 13. Le seul lecteur de `meta_campaign_config`,
`saas/traitement/build_report.py` (`_dates_declarees`, puis la frise des
campagnes), indexe tout par `(canal, nom[:60])` — Meta comme Google. Après
l'étape B, la config est rattachée par l'ID et porte le nom **actuel** ; mais
les lignes d'insights de plus de 28 jours gardent le nom qu'elles avaient à leur
récolte (sauf rejeu). Une campagne renommée peut donc se lire en **deux barres**
dans la frise, et sa date de fin déclarée ne s'attache qu'à celle au nouveau nom.
Deux campagnes homonymes, elles, s'écrasent l'une l'autre dans le dict.

Ce n'est pas une régression du ticket 13 : c'était déjà le cas avec la clé par
nom. Mais la spec (« L'identité par ID ») veut que les regroupements utilisent
l'ID et affichent le nom le plus récent.

Attention : le compte `0b83e564` n'a pas encore d'IDs dans ses insights (rejeu
du ticket 03 à faire) — indexer par ID sans repli lui ferait perdre sa frise.
Et le rapport hebdo « se refera ailleurs » (`CLAUDE.md` §1) : à trancher avec
David avant de construire.

- [ ] Décider si la frise du rapport actuel mérite ce chantier
