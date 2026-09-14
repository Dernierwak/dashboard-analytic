# La période des coûts peut s'inverser, et le bandeau reste inerte sur un vieux lien

Type: task
Status: open

## Question

**Quatre défauts relevés par la revue du ticket
[19](19-ecritures-qui-ne-se-relisent-pas.md)**, dans du travail **non commité**
qui vit dans l'arbre — `saas/web/lib/couts.ts`,
`components/bandeau-commandes.tsx`, `components/prototype-switcher.tsx`. Ils ne
sont **pas** du ticket 19 et n'ont **pas** été corrigés : ce sont d'autres
fichiers, portés par un autre chantier, et on ne travaille pas à deux sur les
mêmes fichiers (`CLAUDE.md` §5). Ils sont écrits ici pour ne pas se perdre.

Les quatre sont lus dans le code, aucun n'est mesuré à l'écran.

### 1 · Une plage qui finit dans le futur produit une fenêtre à l'envers

`resoudrePeriode` (`lib/couts.ts` l. 263-270) valide `f.from ≤ f.to`, **puis**
rabat `to` sur l'ancre : `to = f.to > r.ancre ? r.ancre : f.to`. `from`, lui,
n'est jamais rabattu, et les deux `<input type="date">` du bandeau ne portent
**aucun `max`**.

Du 20 au 25 septembre avec une ancre au 13 : `from = 2026-09-20`,
`to = 2026-09-13`. `dJours` devient négatif, `Math.max(1, …)` le remonte à `1`,
le bandeau écrit « du 20 sep au 13 sep · 1 jours », et la boucle
`for (let cur = premier; cur <= periode.to; …)` ne tourne **pas une fois** :
courbe vide, totaux à zéro, **sans un mot disant que la plage a été déplacée**.
C'est la forme exacte du §7 — un écran qui affiche un chiffre qu'il n'a pas.

**`p=mois` le fait aussi**, le 1er du mois : `from = r.monthStart` est
aujourd'hui, `to = r.ancre` est au mieux hier. Le rabat sur l'ancre est ce qui a
rendu ce cas possible ; avant, `to = aujourd'hui` l'interdisait.

### 2 · Les présélections de période sont inertes sur un lien qui porte `p`

`resoudrePeriode` teste `f.p === "mois"` et `f.p === "an"` **avant** de regarder
`f.jours`, et `ecrire.periode()` (`bandeau-commandes.tsx` l. 63-73) efface bien
`from`/`to` mais **jamais `p`**.

Un vieux signet `/couts?p=mois` : on clique « 7 j », « 30 j », « 90 j » — `p`
survit à chaque clic et la fenêtre ne bouge pas. Avec `?p=30`, « 7 j » est
doublement inerte : il ne fait qu'**effacer** `d`, et la branche de repli
retombe sur 30.

C'est le piège de `CLAUDE.md` §8 sur les liens, dans son autre sens : **un lien
qui n'énumère pas ce qu'il change garde ce qu'il aurait dû jeter.**

### 3 · Les flèches du sélecteur de prototype sont armées en production

`prototype-switcher.tsx` : le `useEffect` qui pose l'écouteur `keydown` est
**au-dessus** du `if (process.env.NODE_ENV === "production") return null;`
(l. 46). En production, la barre est invisible mais **← et → font toujours un
`router.replace` vers `?variant=B`**. Un lien de prototype partagé donne donc à
un client une navigation invisible, sans aucune commande à l'écran.

### Ce qu'il faut faire

- **Refuser ou rabattre la fenêtre entière** quand `from > to` après résolution,
  au lieu de laisser `Math.max(1, …)` cacher l'inversion — et poser un `max` sur
  les deux champs de date.
- **Effacer `p`** dans `ecrire.periode` / `ecrire.plage`, ou faire passer les
  branches héritées `mois`/`an` **après** le test sur `f.jours`.
- **Faire entrer le test d'environnement dans l'effet**, ou ne monter le
  composant qu'en développement depuis la page.

### Ce qui n'est PAS dans ce ticket

Rien de `app/actions.ts` ni des cascades — [19](19-ecritures-qui-ne-se-relisent-pas.md),
fait.

### Consigne de repli

Livrer l'inversion de fenêtre seule, vérifiée : c'est celle qui affiche des
chiffres faux. Les deux autres sont des commandes inertes, pas des mensonges.
