# Un post porte plusieurs thèmes ; le filtre de `/labels` n'en voit qu'un

Type: task
Status: open
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
