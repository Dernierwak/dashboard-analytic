# L'engagement est un taux recalculé, jamais une colonne

La vue `theme_regroupement` lisait `instagram_organic_posts.eng`. **Cette
colonne n'existe pas** : jouer la migration sur la base de production échoue en
`ERROR: 42703: column p.eng does not exist`, et `000_run_me_all.sql` — « le
fichier unique à jouer » — échoue au même endroit. La vue manquante faisait
lever `VueRegroupementAbsente`, donc **le rapport hebdomadaire ne se construisait
pas du tout**.

Le ticket qui l'a mesuré
([44](../../.scratch/construction/issues/44-la-vue-du-regroupement-ne-peut-pas-etre-jouee.md))
concluait qu'une **définition produit manquait** et qu'elle ne s'inventait pas
en passant. Elle ne manquait pas : le produit en portait déjà une, à trois
endroits, identique au caractère près.

```
lib/channels.ts:1001        eng: reach > 0 ? ((likes + comments + saved) / reach) * 100 : 0
channel-dash.tsx:571        r > 0 ? (som(g, p => p.likes + p.comments + p.saved) / r) * 100 : null
comparaison.tsx:108         p.reach > 0 ? ((p.likes + p.comments + p.saved) / p.reach) * 100 : null
```

`insights.py:350` imprime « % d'engagement moyen », et `/instagram` affiche la
colonne avec son `%`. C'est donc **cette** formule qui devient la définition
maison, écrite dans `CONTEXT.md` — pas une quatrième choisie par un agent. Les
colonnes `follows` et `views` restent dehors parce qu'aucune des trois
implémentations ne les a jamais comptées.

## Ce que la vue calcule, et pourquoi c'est la moyenne des taux

`eng_avg` d'un Thème est la **moyenne des taux post par post**, pas le taux
calculé sur les totaux du thème. C'est ce que rendait `build_matrix`
(`("eng", "mean")`), ce qu'affiche la colonne « Eng. » de `/instagram`, et ce
que `channel-dash.tsx` l. 849-852 documentait déjà comme distinct du module
« Comparer ». Changer l'agrégat en même temps qu'on répare la colonne aurait
déplacé un chiffre publié sans que personne ne l'ait demandé.

## Le zéro fabriqué qu'on n'a PAS corrigé ici

Un post dont la portée est nulle ou absente compte **0** dans cette moyenne,
alors que son engagement est inconnu, pas nul — ce que `CLAUDE.md` §7 interdit
partout ailleurs. Le défaut est **antérieur** et vit dans les trois
implémentations TypeScript autant que dans le SQL : le corriger ici aurait fait
diverger la vue de l'écran, c'est-à-dire exactement ce que la vue existe pour
empêcher. Il est écrit plutôt que corrigé — ticket
[53](../../.scratch/construction/issues/53-une-portee-absente-compte-pour-un-engagement-nul.md).

## Le harnais prouvait la vue contre une base qui n'existe nulle part

`.scratch/construction/harnais/04-vue-sql/schema.sql` déclarait
`instagram_organic_posts (…, reach integer, eng numeric)`. Le harnais montait
donc la vraie vue sur un schéma inventé, et c'est **le plus coûteux des deux
défauts** : il se serait reproduit sur la prochaine colonne. Son schéma porte
désormais les colonnes réelles de la production, relevées sur la base
(`id, created_at, user_id, post_id, type, caption, date, likes, comments,
saved, reach, views, follows, labels, label_source, label_at, media_url`).
