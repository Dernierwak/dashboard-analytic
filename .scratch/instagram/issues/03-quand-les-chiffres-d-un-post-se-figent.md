# 03: Quand les chiffres d'un post se figent

Type: research
Status: resolved
Blocked by: —
Assignee: Claude

## Question

David veut un **seuil de maturité** : « une période que Insta donne pour dire
qu'après cette deadline on peut les analyser ». **Meta documente-t-il quand
les chiffres d'un post cessent de bouger** — délai de mise à jour des insights
de média, durée pendant laquelle ils évoluent, différence entre Reel, post et
story ?

Et pour la comparaison **à âge égal** : l'API rend-elle les insights d'un
média **jour par jour** depuis sa publication (une série `period=day`), ou
seulement une valeur cumulée à la date de lecture (`lifetime`) ? Si elle ne
rend que le cumul, l'âge égal ne s'obtient qu'en relevant nous-mêmes chaque
jour — ce qui conditionne
[Garder l'historique des chiffres d'un post](05-garder-l-historique-d-un-post.md).

Si Meta ne documente aucun délai de maturité, le dire tel quel, et lister ce
qui existe de plus proche (délai de latence des données, durée de rétention).
Aucun chiffre « d'usage » trouvé sur un blog ne remplace la documentation :
§7, un seuil invoqué se source.

## Answer

Recherche du 2026-11-01, documentation Meta for Developers seulement, aucun
appel réel. Détail et citations : branche `research/maturite-post`
(`35cedb1`), `git show origin/research/maturite-post:.scratch/instagram/research/maturite-post.md`.

- **Un cumul, jamais une série par jour** : pour un média, « Period is
  automatically set to `lifetime` … and cannot be changed ». L'âge égal ne
  s'obtient qu'en **relevant nous-mêmes** le cumul à chaque passage : un
  « J+7 » n'existe que si on a lu le post à J+7.
- **Aucun délai de maturité documenté**, pour aucun format. Le plus proche :
  « Data … can be delayed up to **48 hours** » — un plancher (un post de moins
  de 48 h est forcément incomplet), pas une date où les chiffres se figent.
  Tout seuil au-delà viendra **de nos relevés**, présenté comme une
  observation de Pulse, jamais comme une règle d'Instagram.
- **Rétention** : insights d'un média 2 ans ; insights du compte 90 jours.
- **Story** : lisible 24 h seulement ; valeurs < 5 rendues `-1` (webhook) ou
  erreur `10`.
- **Absence** : Meta rend un jeu vide, pas 0 — même règle que §7.
- **Les formats diffèrent par leurs métriques, pas par le temps** : le **Reel
  n'a ni `follows` ni `profile_visits`** ; le post du fil les a ; les médias
  d'un carrousel n'ont pas d'insights propres.
- **Ruptures d'historique** : `impressions` absent des médias créés depuis le
  2024-07-02 ; `views` remplace `plays`/`impressions` depuis le 2025-01-21.
- Non confirmé : que `lifetime` soit le cumul à la lecture (déduit du mot), et
  qu'un `period=day` soit bien remplacé — un appel réel le trancherait.
