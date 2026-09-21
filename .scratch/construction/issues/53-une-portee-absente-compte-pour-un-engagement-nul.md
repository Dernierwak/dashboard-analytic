# Une portée absente compte pour un engagement NUL, dans les quatre implémentations

Type: task
Status: open

Trouvé en réparant le ticket [44](44-la-vue-du-regroupement-ne-peut-pas-etre-jouee.md)
le 2026-09-20 : écrit plutôt que corrigé dans le même geste, parce que la
correction doit être faite **partout à la fois** ou pas du tout.

## Le fait

L'engagement d'une publication est `(j'aime + commentaires + enregistrements) /
portée × 100` (`CONTEXT.md`). Quand la portée est nulle ou absente, le taux est
**inconnu** — aucun dénominateur. Les quatre implémentations écrivent `0` :

```
lib/channels.ts:1001        eng: reach > 0 ? (…) : 0
channel-dash.tsx:571        r > 0 ? (…) : null      ← celle-ci est déjà juste
comparaison.tsx:108         p.reach > 0 ? (…) : null ← celle-ci aussi
theme_regroupement.sql      ELSE 0, diviseur = count(*)
```

`lib/channels.ts` est la source des posts de `/instagram` : un post sans portée
y entre à `0 %`, tire la colonne « Eng. » vers le bas, et **rien à l'écran ne
dit que ce 0 n'est pas une mesure**. `CLAUDE.md` §7 : *« Une absence de donnée
n'est pas un zéro. »*

Le SQL, lui, reproduit volontairement ce zéro — la vue existe pour que Python,
TypeScript et la base lisent **la même arithmétique**, et la faire diverger
seule aurait donné deux chiffres différents pour le même thème selon l'écran.
Le commentaire du bloc 8 le dit.

## Ce qu'il faut décider avant de coder

Un post sans portée doit-il **sortir de la moyenne** (diviseur = nombre de
posts dont la portée est connue) ou **rester compté** d'une autre façon ? Les
deux réponses changent un chiffre déjà publié :

- Sortir du diviseur **remonte** l'engagement moyen de tout thème qui porte au
  moins un post sans portée. Sur le jeu de vérification du harnais 04, `p3`
  (portée absente, thème « Lifestyle ») est exactement ce cas.
- Le garder au diviseur en ne comptant que les posts mesurés serait un troisième
  chiffre, ni l'un ni l'autre.

Et la question de fond, qui est à David : **combien de posts ont-ils une portée
absente en production ?** Si c'est marginal, le geste est mécanique. Si c'est
courant, la colonne « Eng. » ment depuis le début et il faut le dire à l'écran,
pas seulement corriger la moyenne.

## Ce que ça touche

`lib/channels.ts` (l. 1001), `theme_regroupement.sql` (bloc 8) et sa copie dans
`000_run_me_all.sql`, le harnais `04-vue-sql` (fixtures `p3`), et la colonne
« Eng. » de `/instagram`. `channel-dash.tsx` et `comparaison.tsx` rendent déjà
`null` : elles n'ont rien à corriger, elles servent de modèle.
