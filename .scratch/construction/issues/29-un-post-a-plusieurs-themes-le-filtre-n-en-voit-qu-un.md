# Un post porte plusieurs thèmes ; le filtre de `/labels` n'en voit qu'un

Type: task
Status: resolved
Blocked by:

## Question

**Trouvé par la revue de code du ticket [09](09-trois-moteurs-un-seul.md)**, et
comme [28](28-engagement-du-compte-filtre-par-theme.md) il ne vient pas de 09 :
c'est le travail du bandeau de commandes, non commité, que son commit a emporté.

### Le fait

Une publication Instagram porte **plusieurs** thèmes
(`instagram_organic_posts.labels`), là où une campagne n'en porte qu'un — c'est
écrit dans `lib/channels.ts` l. 1035 et le filtre d'`/instagram` en tient compte :
`p.labels.some((l) => themesRetenus.includes(l))`.

**`/labels` fait l'inverse.** `lib/couverture.ts` l. 185 aplatit la liste à son
premier élément (`label: ls[0] ?? null`), et `app/labels/page.tsx` l. 78 filtre
avec `themes.includes(e.label)`. Un post étiqueté `["Marque", "Promo"]` disparaît
donc de « Déjà étiqueté » quand le client coche **Promo**.

**Et la page écrit alors une phrase fausse.** S'il était le seul, la page rend :

> *« Rien n'est encore étiqueté « Promo ». »*

alors que le post existe, porte le thème, et s'affiche sur `/instagram`. Deux
pages du même produit répondent l'inverse à la même question.

### Ce qu'il faut faire

Porter la liste complète jusqu'au filtre — `couverture.ts` garde `labels`, et
`/labels` filtre avec `some`, exactement comme `/instagram`. Le premier thème
peut rester pour l'affichage ; c'est le **filtre** qui ne doit pas décider sur
un aplatissement.

### Le piège de fichiers

`lib/couverture.ts` et `app/labels/page.tsx` — le second est en cours côté
bandeau.

---

## Réponse

**La liste complète va jusqu'au filtre, et le filtre ne s'écrit plus dans la
page.**

`ElementLabel.label` (`components/labels-modele.tsx`) devient
`ElementLabel.labels: string[]`. Ce n'est pas un champ de PLUS à côté de
l'ancien : c'est l'ancien qui disparaît. Deux champs dont l'un doit toujours
valoir le premier élément de l'autre, c'est l'aplatissement remis à portée de
main du prochain qui passe — il suffisait d'écrire `e.label` pour reproduire
exactement ce bug. Il n'y a plus de `e.label` à écrire.

Une campagne porte au plus un thème, une publication en porte plusieurs : les
deux rendent désormais une **liste**, vide quand rien n'est étiqueté
(`themesDeCampagne` dans `lib/couverture.ts`). « Pas de thème » s'écrit donc
pareil des deux côtés, et c'est ce vide qui range une ligne dans « Sans thème ».

Le filtre lui-même part dans `lib/commandes.ts`, à côté de `themesChoisis` :

```ts
export function filtreParThemes<T extends { labels: string[] }>(
  elements: T[], themes: string[]
): T[] {
  if (themes.length === 0) return elements;
  return elements.filter((e) => e.labels.some((l) => themes.includes(l)));
}
```

C'est le seul endroit du lot qui répare vraiment la cause. Le fait n'était pas
qu'une page se soit trompée, c'est que la règle « cocher un thème veut dire
cache-moi le reste » était **recopiée** à chaque page qui filtre — et une règle
recopiée finit toujours par diverger d'un côté. `/instagram` filtrait avec
`some`, `/labels` avec `includes` sur un aplatissement ; les deux croyaient
appliquer la même règle. `lib/commandes.ts` n'a aucune directive et n'importe
rien, donc les composants serveur comme client peuvent le lire.

**`/instagram` a été rebranché dessus aussi**, et c'est ce qui rend la phrase
« la règle s'écrit une fois » vraie plutôt que souhaitée. Sa version restait
juste, mais elle restait une COPIE — réparer `/labels` en laissant la copie
d'en face, c'est reconduire exactement la situation qui a produit le ticket.
`lib/channels.ts` importait déjà `themesChoisis` du même module et son
`tous.filter((p) => p.labels.some(...))` était mot pour mot `filtreParThemes` :
l'échange n'a rien changé au comportement. Ce qui était propre à cette page — le
filtre porte sur `all` et pas seulement sur la fenêtre — reste écrit sur place.

`labels[0]` reste, à deux endroits, et dans les deux c'est un **affichage** :
les sélecteurs de `labels-listes.tsx` (un `<select>` n'a qu'une valeur) et le
tri de « Déjà étiqueté » (une liste se parcourt dans un ordre, un élément à deux
thèmes n'a qu'une place). Un tri n'écarte personne — c'est là toute la
différence avec un filtre.

Au passage, `cleLigne` — la clé React qui empêche l'état d'un champ de survivre
sur une autre ligne — portait `e.label`. Elle porte maintenant
`e.labels.join("|")` : un post qui passe de `["Marque"]` à `["Marque","Promo"]`
change enfin de clé, là où il gardait la même.

## Vérifié

`rm -rf .next tsconfig.tsbuildinfo`, puis `npx tsc --noEmit` vert et
`npm run build` vert, **19 routes**.

**Et, pour la première fois côté `saas/web`, le comportement est réellement
exécuté** — pas seulement typé. `lib/commandes.ts` n'importe rien : il se
compile seul avec le `tsc` du dépôt et se joue sous `node`, sans lanceur de
tests, sans base, sans secret, sans réseau. Onze vérifications passent, dont
celle du ticket (un post `["Marque","Promo"]` reste visible sous « Promo ») et
celle qui **prouve que l'ancien code l'aurait perdue** — sans elle, le test ne
discriminerait rien. Les autres couvrent l'union de deux thèmes cochés, aucun
thème coché, un thème inconnu, un élément sans thème, la casse, et le fait que
le filtre ne modifie pas la liste qu'on lui donne.

Ce harnais a été joué dans le dossier temporaire de la session, **il n'est pas
commité** : en installer un côté `saas/web` est une convention à décider, pas à
glisser dans un correctif. C'est le [ticket 53](53-saas-web-n-execute-aucun-test.md).

## Comment on le verra

**Tout de suite, à la lecture** — c'est du rendu de page, pas du traitement :
aucun passage du worker n'est nécessaire. Étiqueter une publication avec deux
thèmes, puis ouvrir `/labels?l=<le second thème>` : elle doit apparaître dans
« Déjà étiqueté », et la phrase « Rien n'est encore étiqueté … » ne doit plus
s'afficher alors que `/instagram?l=<le même thème>` montre le post.

## Ce qui reste non mesuré

**Combien de publications portent réellement plusieurs thèmes chez un client.**
Pas d'accès à la base depuis cet environnement : on ne sait donc pas combien de
lignes disparaissaient en vrai, ni combien de fois `/labels` a écrit « Rien
n'est encore étiqueté » à tort. Le correctif se justifie par la contradiction
entre deux pages, pas par un volume mesuré.

**Le camembert de couverture n'a pas changé, et c'est un choix.** `parTheme`
compte toujours chaque ligne sous son PREMIER thème. Le compter sous tous ses
thèmes casserait l'invariant écrit au-dessus de la boucle — la somme des `nb`
plus `sansTheme.length` vaut `lignes.length` — et donnerait un camembert dont
les parts dépassent le tout. Les montants, eux, ne bougeraient pas : seule une
publication porte plusieurs thèmes, et une publication ne dépense rien. La
question « une part doit-elle dire *posts rattachés* ou *posts dont c'est le
premier thème* ? » est donc ouverte, et c'est le [ticket 52](52-le-camembert-de-couverture-compte-sur-le-premier-theme.md). Elle est hors de ce
ticket, qui porte sur le FILTRE : le camembert, lui, n'écarte aucune ligne de
l'écran.
