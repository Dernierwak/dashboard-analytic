# Le prototype orphelin de /labels

Type: task
Status: resolved

## Question

`/labels` porte encore un prototype : `components/proto-parcours-themes.tsx`
(491 l., trois variantes du « parcours par thème ») monté via `?variant=A|B|C`
avec `components/prototype-switcher.tsx`.

Il vient de la carte `.scratch/themes-benefice/`, **supprimée par David le
2026-09-08**. Son ticket n'existe plus ; la carte de refonte note que *« les
fichiers ne sont pas récupérables »*. Ces deux composants-ci ne sont pas
commités non plus : les effacer est **irréversible**, et c'est pour ça que
[27](27-le-bandeau-partout.md) n'y a pas touché en retirant son propre
prototype.

### Ce qu'il faut décider

Une seule chose : **est-ce qu'on garde ce parcours, ou est-ce qu'il part ?**

- S'il part, `proto-parcours-themes.tsx`, `prototype-switcher.tsx` et le montage
  conditionnel de `app/labels/page.tsx` s'en vont ensemble, et `git grep proto`
  doit être propre.
- S'il reste, il lui faut un ticket qui dit ce qu'il attend, sinon il pourrira
  là où il est : un prototype sans question ouverte n'est plus un prototype,
  c'est du décor qu'on n'ose plus toucher.

Le regarder d'abord coûte une minute — `/labels?variant=A|B|C` — et c'est la
seule façon de décider en connaissance de cause.

### Consigne de conduite

**Ne rien supprimer sans que David ait tranché** (`CLAUDE.md` §7 : rien de
destructeur sans regarder d'abord, et ces fichiers n'ont aucune copie).

## Relevé avant décision (2026-09-11)

**Rien n'a été supprimé.** Ce qui suit est sauvegardé ici pour que la réflexion
survive aux fichiers, qui n'ont aucune copie.

### Ce que le prototype opposait (son en-tête, in extenso)

| | A — la carte qui grandit | B — le convoyeur | C — le relevé |
|---|---|---|---|
| forme | une carte par thème, qui gagne des lignes | 3 colonnes nommées par ce qu'elles rendent | un tableau, une ligne par thème |
| progression | jamais nommée : la carte est plus haute | explicite (le thème traverse les colonnes) | inexistante : la ligne se remplit |
| coût restant | invisible (garde-fou Irrational Labs) | saillant : on voit la pile de la colonne 1 | discret : des « — » dans les cellules |
| rétroactivité | promise sur CHAQUE carte à l'étape 1 | promise UNE fois, en tête de colonne 1 | promise UNE fois, en pied de tableau |
| 90 j vs. historique | les deux, chacun sa fenêtre écrite sous lui | dépense 90 j sur la puce, revenu réservé à l'étoile | deux colonnes, chacune sa fenêtre en en-tête |
| l'étoile | expliquée en entier sur la carte | expliquée en tête de colonne 3 | une note de pied |
| quand c'est fini | reste : la carte EST le bilan du thème | reste, mais la colonne 1 se vide | reste : le tableau devient un relevé pur |

Sa donnée était propre (§7) : dépense de `getEtiquetage` (90 jours pleins,
aujourd'hui exclu), revenu du dernier rapport publié, `null` — écrit « — »,
jamais 0 — quand ce rapport n'existe pas ou ignore le thème.

### La carte a répondu à sa question, et contre sa prémisse

- [`plan-de-refonte.md`](../plan-de-refonte.md) §« un compte qui ne classe
  jamais » : *« les modules par thème sont visibles et verrouillés, avec écrit
  dessus ce qu'un thème débloque […] **Le classement se vend à l'endroit où le
  bénéfice se voit, jamais sur une page de réglages** »*. Les trois variantes
  sont sur `/labels`.
- [12](12-module-de-commandes.md) a **refusé les barres de complétion** — 02
  mesure qu'une barre de progression peut *réduire* la complétion, et §7
  interdit de féliciter un clic : *« on ne fête que le mesuré »*. C'est l'axe
  exact de A et de B.
- [08](08-la-memoire-du-travail.md), correction de David : *« les thèmes ne
  découpent pas l'application en deux axes, ils DÉBLOQUENT des modules »*.
- Le revenu par thème, que `getParcours` va chercher dans le dernier rapport
  publié, est repris autrement par [17](17-ce-qui-se-regroupe-et-ce-qui-est-mesure.md)
  (une vue SQL) et [24](24-conseils-payants-manquants.md) (le revenu
  hebdomadaire d'un thème devient mesurable).

### Une distinction que le ticket ne faisait pas

`prototype-switcher.tsx` n'est **pas** le prototype, c'est l'**instrument** —
celui que la carte cite dans ses Notes (*« il tourne aujourd'hui sur /labels »*)
et que [28](28-la-periode-de-couts.md) a réutilisé le même jour pour faire
juger quatre variantes de `/couts`. Il ne part pas avec le décor.


## Réponse — 2026-09-11

**Il part.** Tranché par David sur le relevé ci-dessus, sans re-regarder les
variantes : la carte avait déjà répondu contre leur prémisse, et un prototype
dont la question est morte n'est plus un prototype.

### Ce qui a été retiré

- `saas/web/components/proto-parcours-themes.tsx` (491 l.) — supprimé.
- Dans `saas/web/app/labels/page.tsx` : les trois imports du prototype, le
  calcul de `variante` et l'`await getParcours(...)`, le montage conditionnel
  en tête de page, et la barre de comparaison en pied. L'import `Suspense` part
  avec elle — il ne servait qu'à ça.

### Ce qui reste, et pourquoi

`saas/web/components/prototype-switcher.tsx` est **l'instrument**, pas le décor :
les Notes de la carte s'appuient dessus pour la façon dont David veut recevoir le
travail (*« des variantes comparables, pas une description »*), et
[28](28-la-periode-de-couts.md) s'en est resservi le même jour pour faire juger
quatre formes de `/couts`. Il n'a plus de client aujourd'hui — le prochain
prototype le remontera.

### Vérifié

`grep -rn "proto-parcours\|ProtoParcours\|getParcours"` sur `saas/web` ne renvoie
rien ; `git grep -ni proto` ne laisse que deux `url.protocol` sans rapport.
Après `rm -rf .next tsconfig.tsbuildinfo` : `npx tsc --noEmit` vert,
`npm run build` vert, **19 routes** — le compte attendu depuis que
[18](18-passer-en-production.md) a publié les trois pages légales.

### Ce que ça coûte si on s'est trompé

Les fichiers n'étaient pas commités : ils ne sont récupérables nulle part. Ce
qu'ils opposaient survit ici, dans le tableau du relevé — c'est ce pour quoi il a
été écrit avant de trancher.
