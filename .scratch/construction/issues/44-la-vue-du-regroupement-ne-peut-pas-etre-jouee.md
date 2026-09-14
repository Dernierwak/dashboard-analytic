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
- Le ticket [22](22-pulse-lit-la-vue.md) — **son code est écrit et `resolved`
  depuis le 2026-09-14** : Pulse lit la vue à chaque affichage, `revenuTheme()`
  est mort. Sans la vue, cette lecture rend « on ne sait pas » et rien ne se
  rafraîchit — elle ne casse rien, elle n'apporte rien. C'est donc ici, et nulle
  part ailleurs, que se trouve le déclencheur du regroupement à la lecture.

  Deux choses restent à faire **une fois la migration jouée**, et elles
  n'appartiennent à personne d'autre :
  - **Parcourir le fil à la main** : classer une campagne depuis `/labels`,
    revenir sur `/`, et voir le bilan du thème avoir bougé **sans passage du
    worker**. C'est le seul contrôle qui prouve que le `revalidatePath("/")` de
    `setCampaignLabel` n'est plus un no-op, et le seul que 22 n'a pas pu faire.
  - **Lire les deux phrases de la carte de thème** — « revenu inconnu » et
    « pas encore assez de dépense ». Elles vivent dans du JSX, aucun harnais ne
    les rend, et c'est exactement là que la revue de 22 a trouvé un trou.
