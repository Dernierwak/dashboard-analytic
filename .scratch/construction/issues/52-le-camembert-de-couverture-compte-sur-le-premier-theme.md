# Le camembert de couverture compte une publication sous son premier thème seulement

Type: question
Status: open
Blocked by:

## Question

**Laissé ouvert par le [ticket 29](29-un-post-a-plusieurs-themes-le-filtre-n-en-voit-qu-un.md)**,
qui a réparé le FILTRE de `/labels` et s'est arrêté là, volontairement : le
camembert n'écarte aucune ligne de l'écran, il compte. Ce n'est pas la même
faute, et ça ne se tranche pas dans un correctif.

### Le fait

`lib/couverture.ts`, la boucle qui construit `parTheme` : chaque ligne est
comptée sous **son premier thème**. Une publication étiquetée « Marque » ET
« Promo » ajoute donc 1 au `nb` de « Marque », et rien à celui de « Promo ».

Depuis le ticket 29, cette publication **s'affiche** pourtant bien dans « Déjà
étiqueté » quand le client coche « Promo ». Le même écran peut donc montrer une
liste sous « Promo » et une part de camembert qui ne la compte pas.

### Pourquoi ça n'a pas été changé

L'invariant écrit au-dessus de la boucle : **la somme des `nb` de tous les
thèmes, plus `sansTheme.length`, vaut toujours `lignes.length`.** Compter une
publication dans chacun de ses thèmes le casse — un camembert dont les parts
dépassent le tout, ce qui est pire que la question qu'on essaie de régler.

Les montants, eux, ne sont pas en jeu : **seule une publication porte plusieurs
thèmes, et une publication ne dépense rien.** Le débat ne porte donc que sur
`nb`, jamais sur les CHF.

### Ce qu'il faut trancher

Que doit dire une part du camembert ?

1. **« Ce dont c'est le premier thème »** — l'invariant tient, les parts
   s'additionnent, mais le nombre affiché sous « Promo » n'est pas le nombre de
   lignes que la page montre sous « Promo ». Le comportement d'aujourd'hui.
2. **« Ce qui est rattaché à ce thème »** — le nombre colle à ce que le client
   voit dans la liste, mais la somme des parts dépasse le total et le camembert
   doit alors le DIRE (une part n'est plus une fraction du tout).
3. **Compter les CHF et non les lignes** — l'en-tête du fichier rappelle que « le
   chiffre est un montant, jamais un compte ». Si `nb` ne fait rien faire à
   personne, la vraie réponse est peut-être de ne pas l'afficher.

Trancher demande de savoir **combien de publications portent réellement
plusieurs thèmes** chez un client — inconnu, faute d'accès à la base depuis
l'environnement de développement. Si la réponse est « presque aucune », la
question ne vaut pas une ligne de code.

### Le piège de fichiers

`lib/couverture.ts` (la boucle `parThemeMap`) et `components/labels-couverture.tsx`
pour ce que la part écrit.
