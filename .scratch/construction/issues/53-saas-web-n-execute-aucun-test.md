# `saas/web` n'exécute aucun test, et le ticket 29 montre que c'est réparable

Type: question
Status: open
Blocked by:

## Question

**Soulevé par le [ticket 29](29-un-post-a-plusieurs-themes-le-filtre-n-en-voit-qu-un.md).**
Le correctif y a été vérifié par un harnais réellement joué — mais dans le
dossier temporaire de la session, pas dans le dépôt. Installer une convention de
test côté web est une décision, pas quelque chose qui se glisse dans un
correctif. D'où ce ticket.

### Le fait

`saas/traitement` a ses harnais (`.scratch/construction/harnais/`, un dossier par
ticket, rejoués d'un coup par `jouer_tout.py`) parce que `build_payload` prend un
`Lecteur` : il y a un **seam**, donc le rapport se construit hors ligne.

`saas/web` n'a rien. `package.json` ne porte que `dev`, `build`, `start`, `lint` ;
il n'existe aucun `*.test.ts` dans le dépôt, et aucun lanceur dans
`node_modules/.bin`. La seule vérification est `npx tsc --noEmit` + `npm run
build` + le compte de 19 routes (`CLAUDE.md` §9) — qui prouve que **ça compile**,
jamais que **ça répond juste**.

Le ticket 28 l'a constaté et s'est arrêté là : « pas de harnais possible ici…
`getInstaDash` va chercher Supabase — il n'y a pas de seam équivalent au
`Lecteur` du traitement ». C'est vrai des fonctions qui LISENT. Ça ne l'est pas
de tout.

### Ce que le ticket 29 a montré

La règle de filtrage a été sortie de la page vers `lib/commandes.ts` — un module
qui **n'importe rien** (pas de `next/headers`, pas de client Supabase, pas de
directive `"use client"`). Une fois là, elle se vérifie sans rien installer :

```
npx tsc lib/commandes.ts --outDir <tmp> --module esnext --target es2020
node <tmp>/test.mjs
```

Onze vérifications, dont celle qui prouve que l'ancien code échouait sur le cas
du ticket. Ni base, ni secret, ni réseau — exactement le contrat des harnais
Python.

Le seam côté web existe donc déjà : **c'est la logique pure extraite des pages.**
`themesChoisis`, `filtreParThemes`, `nomPeriode`, `fmtCHF`, les fonctions de
fenêtre — tout ce qui décide sans aller chercher.

### Ce qu'il faut trancher

1. **Où vivent ces harnais ?** Le même
   `.scratch/construction/harnais/<ticket>/` que le Python, ou un dossier à part ?
   `jouer_tout.py` ne ramasse que `test_*.py` : soit il apprend à lancer du
   `node`, soit les deux familles se jouent séparément.
2. **Avec quoi ?** La voie ci-dessus n'ajoute **aucune dépendance** — le `tsc`
   du dépôt et le `node` de la machine suffisent. Un vrai lanceur (`vitest`)
   serait plus confortable et coûterait une dépendance de plus dans un dépôt qui
   n'en a que dix. Le dépôt a jusqu'ici choisi « aucun lanceur » ; ce ticket ne
   propose pas de revenir dessus à la légère.
3. **Sur quoi ?** N'a de sens que pour la logique pure. Une fonction qui lit
   Supabase reste hors de portée tant qu'elle n'a pas son `Lecteur`.

### Pourquoi ça compte

Les tickets 28 et 29 sont **le même bug commis deux fois** — une règle recopiée
d'une page à l'autre qui diverge d'un côté. `tsc` ne voit ni l'un ni l'autre :
les deux versions compilent, elles ne disent simplement pas la même chose. Tant
que `saas/web` n'exécute rien, cette famille de fautes ne se trouve qu'à la
lecture, ou chez le client.
