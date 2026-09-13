# Le carnet a trois silences : un zéro fabriqué, une panne déguisée, une troncature invisible

Type: task
Status: open

## Question

Trouvés par la revue de code lancée à la fin de [14](14-la-porte-vers-la-plateforme.md),
**vérifiés ligne à ligne** dans `saas/web/lib/carnet.ts` (arbre de travail, non
commité). Les trois sont la même faute sous trois formes : **une lecture qui
échoue ou qui tronque se rend comme une mesure.**

### 1 · Un comptage raté devient un zéro mesuré — l. 210

```ts
marche: marche.error ? 0 : marche.count ?? 0,
```

Les deux comptages sont indépendants. Si le second échoue (réseau, refus RLS sur
le `eq` supplémentaire) pendant que le premier passe, `PhraseBilan` écrit
**« 6 actions jugées sur 30 jours, 0 ont marché »**. `CLAUDE.md` §7 : une absence
de donnée n'est pas un zéro. La branche `juges.error` trois lignes plus haut rend
déjà `null` — c'est le même traitement qu'il faut ici.

### 2 · Toute panne qui n'est pas une colonne manquante se lit « tu n'as rien écrit » — l. 281

`colonneAbsente` ne reconnaît que `/author_id|campaign_/`. Pour n'importe quelle
autre panne, `lignes` reste vide, `retenues` tombe à `0`, `migrationOk` reste
**vrai**, et le `total` vient d'un comptage `head` séparé qui, lui, a réussi.
L'écran affiche donc « Rien d'écrit sur ce que tu regardes ici » **suivi de**
« 12 autres notes dans ton carnet » : on dit au client que son filtre a tout
écarté alors que la lecture est tombée.

Le commentaire juste au-dessus pose pourtant la bonne règle — « on ne dit
"migration pas jouée" que si c'est ce que la base a dit ». Elle n'est appliquée
qu'à moitié : on distingue bien la cause, mais on traite l'inconnue comme un
carnet vide.

### 3 · Au-delà de 200 notes, la ligne qui devait le dire affiche zéro — l. 249

La liste est `.limit(200)` mais `retenues` prend le compte **exact**. Sur 250
notes qui passent le filtre : 200 s'affichent, `horsContexte = total - 250 = 0`,
donc la ligne « N autres notes » ne s'écrit pas et **50 notes sont invisibles
sans que rien ne le signale**. C'est la troncature silencieuse contre laquelle le
commentaire du comptage `head`, deux lignes plus bas, met lui-même en garde.
Paginer, ou comparer `lignes.length` à `retenues` et l'écrire.
