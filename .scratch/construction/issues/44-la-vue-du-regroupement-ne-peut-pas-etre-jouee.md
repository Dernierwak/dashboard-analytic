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
- Le ticket [22](22-pulse-lit-la-vue.md), qui attend que Pulse lise la vue.

## Avancement — 2026-09-20 : trois des quatre pas sont faits

**Le ticket reste OUVERT** : son quatrième pas — jouer la migration — n'appartient
qu'à David. Rien de ce qui suit n'est visible tant qu'elle n'est pas passée.

### 1. La définition ne manquait pas, elle n'était pas écrite

Le ticket concluait à une **définition produit absente**. Elle existait déjà
dans le produit, à trois endroits, identique au caractère près :

```
lib/channels.ts:1001      eng: reach > 0 ? ((likes + comments + saved) / reach) * 100 : 0
channel-dash.tsx:571      r > 0 ? (som(g, p => p.likes + p.comments + p.saved) / r) * 100 : null
comparaison.tsx:108       p.reach > 0 ? ((p.likes + p.comments + p.saved) / p.reach) * 100 : null
```

`insights.py:350` imprime « % d'engagement moyen » et `/instagram` affiche la
colonne avec son `%`. C'est **cette** formule qui entre dans `CONTEXT.md`, pas
une quatrième choisie en passant — `follows` et `views` restent dehors parce
qu'aucune des trois ne les a jamais comptés. Décision consignée en
[ADR 0008](../../../docs/adr/0008-l-engagement-est-un-taux-recalcule-jamais-une-colonne.md).

### 2. Le harnais regarde enfin la bonne base

`04-vue-sql/schema.sql` déclarait `eng numeric`. Il porte maintenant les
colonnes relevées sur la production, et les comptes sont en `integer` comme
`reach` — un harnais choisit le type qui **révèle** la division entière, pas
celui qui la masque. `fixtures.py` donne des comptes bruts et partage la formule
avec le côté Python via `engagement()`, parce que la `build_matrix` d'origine
lisait une colonne que la production n'a jamais eue.

### 3. `eng_avg` se calcule des deux côtés

`theme_regroupement.sql` **et** sa copie dans `000_run_me_all.sql`
(`test_copie_non_derivee.py` refuse toute dérive). L'agrégat n'a pas bougé :
c'est la **moyenne des taux post par post**, ce que rendait `build_matrix` et ce
qu'affiche la colonne « Eng. » — réparer la colonne et déplacer l'agrégat dans
le même geste aurait bougé un chiffre publié sans que personne le demande.

**Côté Python aussi** : `insights.py` gardait `("eng", "mean") if "eng" in
p.columns else …`, donc `formats[].eng_avg` sortait à `None` pour chaque format
— une colonne vide publiée depuis l'origine. L'engagement s'y calcule
maintenant, avec la même formule.

**Vérifié** : harnais 04 complet sur PostgreSQL 16 jetable — 58/58 pour
« vue vs `build_matrix` », 19/19, 18/18, 21/21, 4/4, 2/2, 2/2. Les harnais du
traitement rejoués : 16 (184/184), 09, 07, 10, tous verts. `npx tsc --noEmit`
et `npm run build` verts, **19 routes**.

### Ce qui reste, et qui n'appartient qu'à David

**Jouer `supabase/migrations/theme_regroupement.sql`** (ou `000_run_me_all.sql`)
sur le projet de production, puis vérifier que `fetch_theme_regroupement` rend
des lignes. Tant que ce n'est pas fait, `VueRegroupementAbsente` continue de
lever et **le rapport hebdomadaire ne se construit pas**. La migration ne porte
aucun `DROP TABLE`, `DELETE` ni `TRUNCATE` : le seul `DROP VIEW` ne touche
qu'une définition, et le fichier est rejouable sans risque.

### Un défaut écrit plutôt que corrigé

Ticket [53](53-une-portee-absente-compte-pour-un-engagement-nul.md) : un post
sans portée compte pour un engagement **nul** alors qu'il est inconnu. Le
corriger dans le seul SQL aurait fait diverger la vue de l'écran — ce que cette
vue existe précisément pour empêcher.
