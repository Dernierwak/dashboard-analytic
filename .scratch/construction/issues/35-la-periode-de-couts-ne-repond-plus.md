# La période de `/couts` : l'ancien nom gagne, et la fenêtre peut s'inverser

Type: task
Status: open

## Question

Trouvé par la revue de code lancée à la fin de [14](14-la-porte-vers-la-plateforme.md),
**vérifié ligne à ligne**. Deux défauts dans `resoudrePeriode`
(`saas/web/lib/couts.ts` l. 255-290), tous deux dans l'arbre de travail, aucun
commité.

### 1 · `p=mois` et `p=an` rendent les présélections inertes

`resoudrePeriode` teste `f.p === "mois"` et `f.p === "an"` **avant** de retomber
sur `f.jours`, alors que le bandeau (`ecrire.periode`,
`components/bandeau-commandes.tsx` l. 66-80) n'écrit et n'efface que `d` — il ne
touche jamais à `p`. Sur un favori `/couts?p=mois`, chaque clic de période écrit
`d` et **ne change rien à l'écran** : le bouton a l'air cassé, et il l'est.

**La revue disait aussi que `?p=90` + clic « 30 j » restait à 90 : c'est faux**,
`f.jours` gagne dans cette branche-là. Mais **le clic « 7 j » y retombe**, parce
qu'il *efface* `d` : `f.jours` redevient absent, `f.p === "90"` reprend la main,
et on revient à 90 jours en croyant demander 7.

L'en-tête du fichier promet « aucun favori ne casse ». Deux corrections
possibles : effacer `p` dans `ecrire.periode`/`ecrire.plage`, ou donner la
priorité à `f.jours` sur `f.p` partout.

### 2 · `from` n'est jamais borné à l'ancre — la fenêtre peut s'inverser

`to` est ramené au dernier jour plein (`r.ancre`), `from` non, et les branches
`mois`/`an` ne le sont ni l'une ni l'autre. Deux chemins atteignables :

- **Une plage sur mesure dans le futur.** Le sélecteur ne valide que `de <= a`
  (`valide`, `bandeau-commandes.tsx`) : choisir « 1 oct → 15 oct » un 13 septembre
  donne `from = 2026-10-01`, `to = 2026-09-12`.
- **`p=mois` le 1er du mois** (et `p=an` le 1er janvier) : `from = monthStart`
  est postérieur à `to = veille`.

`dJours` rend alors ≤ 0, `Math.max(1, …)` le masque, et `bornes` imprime
« du 01 oct au 12 sep · 1 jours » pendant que tous les graphes reviennent vides.
**Ça se lit comme une panne de données, pas comme une plage impossible** — et une
fenêtre inversée qu'on affiche à l'envers est un chiffre qu'on ne peut pas tenir
(`CLAUDE.md` §7).
