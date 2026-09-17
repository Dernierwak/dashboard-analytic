# La vue du regroupement n'existe pas en base, et le fichier qui l'installe ne peut pas être joué

Type: task
Status: open

Trouvé en vérifiant le ticket [18](18-revenu-google-non-rattachable.md) contre
la vraie base, le 2026-09-13. Ce n'est pas une conséquence de 18 : le défaut est
antérieur, et il bloque **tout ce qui passe par la vue** — donc 18, donc 04.

## Deux faits, mesurés

### 1. La vue n'est pas là

```sql
SELECT count(*) FROM information_schema.views
 WHERE table_schema='public' AND table_name='theme_regroupement';
-- 0
```

Sur le projet de production (`dctjbteygbgwenhvdnul`), `theme_regroupement`
n'existe pas. `fetch_theme_regroupement` (`saas/commun/fetch_data.py` l. 90)
attrape bien le cas et lève `VueRegroupementAbsente` plutôt que de rendre une
liste vide — le message dit à David de jouer la migration. C'est le bon
comportement, et il veut dire que **le rapport ne se construit pas** tant que
la migration n'est pas passée.

### 2. Et la migration ne peut pas passer

Jouer `theme_regroupement.sql` sur cette base échoue :

```
ERROR: 42703: column p.eng does not exist
LINE 54: sum(coalesce(p.eng, 0))::numeric / count(*)  AS eng_avg
```

Les colonnes réelles de `public.instagram_organic_posts` en production :

```
id, created_at, user_id, post_id, type, caption, date,
likes, comments, saved, reach, views, follows,
labels, label_source, label_at, media_url
```

**Il n'y a pas de colonne `eng`, et aucune migration n'en crée.** La table est
antérieure aux migrations — le commentaire du bloc 8 de la vue le dit lui-même,
sans en tirer la conséquence. `000_run_me_all.sql` porte la même ligne
(l. 2303), donc « le fichier unique à jouer » échoue au même endroit.

## Pourquoi les harnais ne l'ont pas vu

`.scratch/construction/harnais/04-vue-sql/schema.sql` l. 47-52 déclare la table
avec `eng numeric`. Le harnais monte donc la vraie vue sur un schéma qui n'est
pas celui de production : **il prouve la vue contre une base qui n'existe nulle
part.** C'est le défaut le plus coûteux des deux, parce qu'il se reproduira sur
la prochaine colonne.

Côté Python le problème ne se voit pas non plus : `build_matrix`
(`saas/recos_ia/insights.py` l. 172-177) garde `if "eng" in p.columns` et rend
`eng_avg = None` quand la colonne manque. La vue SQL, elle, ne garde rien.

## Ce qu'il faut décider avant de coder

`eng` n'est pas une colonne perdue, c'est une **définition produit absente**.
Les colonnes disponibles sont `likes`, `comments`, `saved`, `views`, `follows`,
`reach`. « L'engagement d'une publication », c'est :

- `likes + comments + saved` ? (le plus courant)
- avec `follows` ? avec `views` ?
- un **nombre**, ou un **taux** rapporté à `reach` ?

`CONTEXT.md` doit trancher avant que le SQL l'écrive — une formule inventée ici
deviendrait la définition maison par accident, et `eng_avg` est déjà publié dans
le payload. **Ne pas choisir en passant.**

## Ce qu'il faut faire, dans l'ordre

1. **Définir l'engagement** avec David, et l'écrire dans `CONTEXT.md`.
2. **Aligner `schema.sql` du harnais 04 sur la production**, et pas l'inverse :
   retirer `eng`, ajouter les colonnes réelles. Le harnais doit retomber en
   échec sur la vue actuelle — c'est la preuve qu'il regarde enfin la bonne
   base.
3. **Écrire `eng_avg` à partir des colonnes qui existent**, dans
   `theme_regroupement.sql` ET dans sa copie de `000_run_me_all.sql` (le harnais
   `04-vue-sql/test_copie_non_derivee.py` refuse toute dérive entre les deux).
4. **Jouer la migration**, et vérifier que `fetch_theme_regroupement` rend
   enfin des lignes.

## Ce que ça bloque

- Le ticket [18](18-revenu-google-non-rattachable.md) : `spend_muette` et
  `campagnes_muettes` sont écrits, vérifiés contre un vrai PostgreSQL, et
  **n'atteindront la production qu'une fois ce ticket réglé**.
- Le ticket [04](04-vue-sql-du-regroupement.md), dont la vue est la livraison.
- Le ticket [22](22-pulse-lit-la-vue.md) — **son code est écrit depuis le
  2026-09-14, et le ticket reste OUVERT à cause d'ici** : Pulse lit la vue à
  chaque affichage et `revenuTheme()` est mort, mais sans la vue cette lecture
  rend « on ne sait pas » et rien ne se rafraîchit. Elle ne casse rien, elle
  n'apporte rien. C'est donc ce ticket-ci, et nul autre, qui tient le
  déclencheur du regroupement à la lecture.

  Deux contrôles de 22 ne peuvent se faire **qu'une fois la migration jouée** —
  ils restent listés chez lui, ils sont rappelés ici parce que c'est ici qu'ils
  redeviennent possibles :
  - **Parcourir le fil à la main** : classer une campagne depuis `/labels`,
    revenir sur `/`, et voir le bilan du thème avoir bougé **sans passage du
    worker**. C'est le seul contrôle qui prouve que le `revalidatePath("/")` de
    `setCampaignLabel` n'est plus un no-op — et c'est lui qui manque pour que 22
    passe `resolved`.
  - **Lire les deux phrases de la carte de thème** — « revenu inconnu » et
    « pas encore assez de dépense ». Elles vivent dans du JSX, aucun harnais ne
    les rend, et c'est exactement là que la revue de 22 a trouvé un trou.

## Avancement — session du 2026-09-14 (construction)

**Les trois étapes qui étaient de la réalisation sont faites. Il reste la
quatrième, qui est une EXPLOITATION et appartient à David : jouer la migration.**

### 1 · L'engagement est défini — c'était le seul vrai blocage

Tranché avec David le 2026-09-14 : **`(likes + comments + saved) ÷ reach`, en
pourcentage**. Écrit dans `CONTEXT.md` (« Engagement ») avec ce que la
définition exclut et pourquoi — `follows` dehors (s'abonner n'est pas réagir),
`views` refusé comme dénominateur (vide sur les posts image).

**L'unité n'était pas un choix libre, et ce ticket ne l'avait pas vu** :
`METRIC_INFO["eng"]` (`saas/traitement/build_report.py` l. 217) porte déjà
l'unité « % » et `insights.py` l. 350 écrit déjà « X % d'engagement moyen ».
Le produit attendait donc un TAUX depuis toujours. Rendre un nombre absolu
aurait affiché « 128 % ». La question posée à David s'est donc réduite au
numérateur et au dénominateur.

**Deux règles ajoutées en écrivant le SQL, parce qu'aucune des deux n'allait
de soi :**

- **Un rapport de sommes, pas une moyenne de taux.** Sinon une publication vue
  par 12 personnes et aimée par 3 pèse 25 % et emporte le thème entier. Mesuré
  dans le harnais : deux posts à 50 % et 1 % donnent 25,5 % en moyenne de taux
  contre **1,05 %** en rapport de sommes, et c'est le second qui décrit ce qui
  s'est passé (10 010 vues, 105 réactions).
- **Une publication sans portée remontée sort du calcul, des DEUX côtés.**
  Garder ses réactions au numérateur sans rien mettre au dénominateur gonfle le
  taux d'autant plus que la donnée manque : **une panne de collecte se lirait
  comme une réussite.** C'est un `FILTER (WHERE p.reach IS NOT NULL)`, et c'est
  pour cela que `eng_avg` s'écarte de `reach_avg` juste au-dessus, qui compte
  bien une portée absente comme 0 — une MOYENNE porte sur les publications
  (elles existent toutes), un TAUX porte sur les gens (eux, on ne les connaît
  pas). Mesuré : le thème `Lifestyle` du harnais rend **6,25 %** et non 6,70 %.

### 2 · Le harnais regarde enfin la bonne base

`schema.sql` du harnais 04 déclarait `eng numeric`. La colonne est **retirée**,
les colonnes réelles de la production sont **déclarées** (`likes`, `comments`,
`saved`, `views`, `follows`, toutes en `integer` comme des comptes), avec en
commentaire la raison pour laquelle cette table-là est recopiée de la
production au lieu d'être réduite à ce que la vue touche : elle est antérieure
aux migrations, donc ce bloc est **le seul endroit du dépôt qui décrit sa
forme**, et une colonne inventée ici ne rencontre jamais de démenti.

**La preuve demandée par ce ticket a été obtenue** : sur le schéma corrigé et
AVANT de toucher au SQL, le harnais tombe sur l'erreur exacte de la production —

```
ERROR:  column p.eng does not exist
```

Il ne prouvait rien jusque-là ; il prouve maintenant.

`views` et `follows` sont déclarées bien qu'aucune formule ne les lise : elles
existent en base, et le jour où la définition bouge elle se vérifie ici au lieu
de partir d'une supposition.

### 3 · `eng_avg` est écrit à partir des colonnes qui existent

Dans `theme_regroupement.sql`, et sa copie de `000_run_me_all.sql` **régénérée
par extraction du bloc source** plutôt que recopiée à la main —
`test_copie_non_derivee.py` est vert, et il compare les deux au caractère près.

Le `::numeric` est conservé et sa raison renforcée : sur un taux, le numérateur
est **toujours** plus petit que le dénominateur, donc une division entière
rendrait **0 à tous les coups**, pas seulement un arrondi faux.

### 4 · Ce que la vérification a mesuré — 133 contrôles sur un vrai PostgreSQL

`pgserver` (PostgreSQL 16 jetable, ni base Supabase, ni secret, ni réseau) :

| Fichier | Résultat |
|---|---|
| `test_copie_non_derivee.py` | 2/2 |
| `test_regles_de_la_vue.py` | **26/26** (dont 5 neufs sur l'engagement) |
| `test_vue_vs_build_matrix.py` | 60/60 |
| `test_isolement.py` | 4/4 |
| `test_python_lit_la_vue.py` | 18/18 |
| `test_part_muette_sql.py` | 21/21 |
| `plan.py` | 2/2 — 300 puis 900 comptes, **520 lignes lues** dans les deux cas : le `FILTER` n'a pas coûté l'index |

**Le harnais a fait tomber une erreur d'arithmétique que j'avais écrite**
(un attendu à 60 au lieu de 105) : il ne passe pas toujours.

⚠ **Trois nombres de ce tableau étaient faux, corrigés le 2026-09-17.** Il
portait 25/25 et 61/61 sur les deux premières lignes, et « 131 contrôles » en
titre alors que ses propres lignes en additionnaient 133. Les valeurs
ci-dessus sont celles de deux rejeux successifs et identiques, sur un dépôt où
ni le harnais ni la vue n'ont bougé depuis le commit qui les a écrites
(`git diff 44092af HEAD` vide sur `04-vue-sql/` et `theme_regroupement.sql`) :
le total de 133 était donc juste, seule sa répartition et le titre ne
l'étaient pas. Un chiffre recopié d'un rejeu antérieur au dernier contrôle
ajouté reste un chiffre faux (`CLAUDE.md` §7).

### 5 · CE QUE ÇA CHANGE À L'ÉCRAN, ET QU'IL FAUT SAVOIR AVANT DE DÉPLOYER

**Des engagements déjà affichés vont CHANGER DE VALEUR. Ce n'est pas une
panne, et ce n'est pas non plus une première mesure.**

⚠ **J'avais écrit ici le contraire, et c'était faux.** Je concluais de
l'absence de colonne `eng` en base que personne n'avait jamais vu d'engagement.
La relecture l'a corrigé : `build_report.py` l. 1997 **fabrique** la colonne
`eng` sur le DataFrame — même numérateur, même dénominateur — avant de le
passer à `build_matrix` (l. 2182), et `saas/web/lib/channels.ts` la recalcule
pour `/instagram`. **L'engagement est mesuré et affiché depuis toujours.** Ce
qui était cassé, c'est que la VUE lisait une colonne de BASE inexistante, donc
tout le regroupement refusait de s'installer — pas seulement l'engagement.

Ce que la migration change réellement, sur une valeur déjà à l'écran :

- **l'agrégation** — rapport de sommes au lieu d'une moyenne de taux ;
- **le sort de la portée inconnue** — inconnu au lieu de 0.

Mesuré sur les fixtures : le thème `Lifestyle` passe de **3,12 % à 6,25 %**, le
double. `E-bike` de 4,87 % à 5,66 %. Les deux écarts sont chiffrés dans
`ECARTS_VOULUS` (`test_vue_vs_build_matrix.py`) pour qu'ils cessent d'être une
surprise.

**Comparer à l'ancien rapport avant de conclure à une panne**, comme pour le
revenu et le ROAS.

### 6 · Ce qui reste — et ce n'est plus de la réalisation

- [ ] **Jouer la migration** (`000_run_me_all.sql`), puis déployer. **David
      seul** : aucun secret ni accès production n'est passé par cette session.
      C'est la seule étape restante de CE ticket.

      **Toujours pas jouée au 2026-09-17**, re-mesuré ce jour-là. La vue est
      encore absente de la production : un `GET /rest/v1/theme_regroupement`
      avec la **clé anon publique** (celle de `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
      lecture seule, aucun secret en jeu) rend `404 PGRST205 — Could not find
      the table 'public.theme_regroupement' in the schema cache`. C'est
      exactement le code que `fetch_theme_regroupement` attrape pour lever
      `VueRegroupementAbsente` : **le rapport ne se construit toujours pas.**
      La sonde ne prouve que l'absence, pas que la migration passera — elle
      ne peut pas créer la vue, qui demande des droits que cette session n'a
      pas.
- [ ] Ensuite seulement, les deux contrôles de [22](22-pulse-lit-la-vue.md)
      rappelés plus haut redeviennent possibles.

### 7 · Relevé en chemin, pas de ce ticket — deux tickets ouverts

- **[49](49-trois-moteurs-d-engagement-trois-reponses.md) · trois moteurs
  d'engagement.** `channels.ts` (pour `/instagram`) et `build_report.py` font
  tous deux une **moyenne de taux** et rendent **0** sur une portée inconnue,
  là où la vue fait un rapport de sommes et rend « inconnu ». Le client peut
  lire deux chiffres différents pour le même thème. Le `0` est le plus grave
  des deux : il affirme « personne n'a réagi » là où on ne sait pas (§7).
- **[50](50-la-collecte-instagram-ecrase-ce-qu-elle-ne-sait-pas.md) · la
  collecte écrase ce qu'elle ignore.** `fetch_instagram.py` ne demande
  **jamais `likes` pour les Reels et les vidéos** (l. 248-251) et écrit `0`
  (l. 321) : l'engagement des Reels est structurellement sous-évalué, et
  « le thème qui fait le plus réagir » peut nommer le mauvais. Plus
  généralement, **toute métrique absente est écrite `0`** — y compris `reach`,
  et c'est pour ça que le filtre de la vue doit viser `reach <= 0`.

La docstring de `build_matrix` annonçait `df_insta` avec une colonne `eng` :
**corrigée ici**. Elle n'était pas fausse sur le fond — `build_report` la pose
bien avant l'appel — mais elle laissait croire que la colonne venait de la
base, ce qui est précisément la confusion qui a coûté ce ticket. Elle dit
maintenant d'où la colonne vient.
