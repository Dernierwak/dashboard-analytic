# Trois moteurs d'engagement, trois réponses — et deux d'entre eux rendent 0 sur une portée inconnue

Type: task
Status: open

## Question

**Trouvé en relecture du ticket [44](44-la-vue-du-regroupement-ne-peut-pas-etre-jouee.md).**
44 a écrit la définition de l'engagement dans `CONTEXT.md` et l'a implémentée
dans la vue `theme_regroupement`. Il a aussi révélé que **la même formule vit
déjà à deux autres endroits**, avec une agrégation différente et une politique
opposée sur la donnée manquante.

C'est le défaut à trois moteurs que la vue existe pour supprimer — mesuré par
le ticket 11 de la refonte, et toujours là pour l'engagement.

| Où | Agrégation | Portée inconnue | Lu par |
|---|---|---|---|
| `theme_regroupement` (la référence) | rapport de sommes | **inconnu** | `/` (carte de thème), le rapport |
| `saas/web/lib/channels.ts` l. 1022 / 1119 | **moyenne de taux** | **0** | `/instagram` |
| `saas/traitement/build_report.py` l. 1997 | **moyenne de taux** | **0** | `build_matrix` → formats, `avg_engagement` |

### Ce que ça donne à l'écran

Sur les fixtures du harnais 04, le thème `Lifestyle` (un post à 4 400 vues, un
post dont la portée n'est pas remontée) :

- **moyenne de taux, portée inconnue comptée 0** → `(6,25 + 0)/2 = 3,12 %`
- **rapport de sommes, portée inconnue écartée** → `275/4400 = 6,25 %`

**Le simple** — et rien n'indique à l'écran lequel des deux on regarde. Le
client peut lire 3,12 % sur `/instagram` et 6,25 % sur la carte du même thème.

### Les deux défauts ne sont pas de même gravité

- **La moyenne de taux** est un choix discutable mais défendable : elle répond
  à « le taux de la publication moyenne ». Le produit a tranché pour l'autre
  (`CONTEXT.md`), donc elle doit s'aligner — mais elle ne MENT pas.
- **Le `0` sur portée inconnue MENT** (`CLAUDE.md` §7). `reach > 0 ? … : 0`
  affirme « personne n'a réagi » là où on ignore combien de personnes ont vu.
  Et comme la collecte écrit `0` plutôt que `NULL` quand Graph ne rend pas la
  portée (voir [50](50-la-collecte-instagram-ecrase-ce-qu-elle-ne-sait-pas.md)),
  ce chemin s'emprunte pour de vrai, pas en théorie.

## Ce qu'il faut faire

- **Aligner `channels.ts` et `build_report.py` sur la définition de
  `CONTEXT.md`** : rapport de sommes, et publication sans portée connue
  (`reach <= 0`) hors du calcul des DEUX côtés de la division.
- **Ne plus jamais rendre 0 pour une portée inconnue** — rendre « inconnu », et
  laisser l'affichage dire qu'on ne sait pas. `/instagram` a déjà des colonnes
  qui savent afficher un vide.
- **Idéalement, ne plus recalculer du tout côté web** : `/instagram` lit
  `instagram_organic_posts` en direct alors que la vue sait déjà répondre. Ce
  serait la vraie fin du problème — mais la vue est au grain du THÈME, pas du
  post ni du format, donc ça demande un second grain. À arbitrer, pas à faire
  en passant.

## Ce qui n'est PAS dans ce ticket

- **La formule elle-même.** Elle est tranchée (`CONTEXT.md`), et la vue
  l'applique. Ce ticket ne la rouvre pas.
- **Le trou de collecte sur les Reels**, qui fausse le numérateur des trois
  moteurs à la fois : c'est [50](50-la-collecte-instagram-ecrase-ce-qu-elle-ne-sait-pas.md).

## Ce qu'il faut savoir avant de commencer

**Ce que je croyais en ouvrant ce ticket était faux, et la relecture l'a
corrigé.** J'avais écrit que l'engagement par format n'était jamais calculé,
parce que `build_matrix` le garde derrière `if "eng" in p.columns` et que la
colonne `eng` n'existe pas en base. Elle n'existe pas en base, mais
`build_report.py` l. 1997 **la fabrique sur le DataFrame** avant de le passer à
`build_matrix` (l. 2182) : la garde est donc vraie en production, et les
formats ont toujours eu un engagement. Vérifier d'où vient une colonne avant de
conclure qu'elle est vide.

## Comment le vérifier

`test_vue_vs_build_matrix.py` (harnais `04-vue-sql`) déclare aujourd'hui l'écart
`eng_avg` comme **voulu**, chiffré thème par thème (`ECARTS_VOULUS`). Le jour où
ce ticket est fait, ces deux entrées doivent **disparaître** au lieu d'être
mises à jour : plus d'écart, un seul moteur.

Côté web, rien ne se voit sans recharger `/instagram` ; côté rapport, rien ne se
voit sans **un passage du worker** (cron du Jour de travail 07:00 UTC, ou
`weekly-fetch.yml` en `report_only`).
