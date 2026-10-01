# « Pas maintenant » se grise, « pas toi » s'absente

Un contrôle grisé est une **promesse** : *la seconde d'après, il revient*. Elle
est tenue pour `pending` — le temps d'un aller-retour serveur. Elle est fausse
pour un Membre en Lecture seule : sur ce compte-là, l'état où le bouton
fonctionne n'arrivera jamais. Lui montrer un bouton grisé, c'est lui faire
attendre quelque chose qui ne vient pas.

> **`disabled` veut dire « pas maintenant ». L'absence veut dire « pas toi ».**

La règle vaut pour le produit entier, pas pour le seul panneau de classement qui
l'a fait surgir.

## Pourquoi elle est surprenante, et donc écrite ici

`disabled` est la convention du métier, et le dépôt la suivait :
`components/conversions-themes.tsx` écrit `disabled={pending || !d.peutEditer}`,
trois fois. Cette seule expression **confond les deux impossibilités** — un `||`
entre ce qui dure une seconde et ce qui ne finit pas. Sans cette fiche, la
prochaine personne qui verra un bouton manquant là où un `disabled` serait
attendu le « réparera » en le grisant, et aura l'impression de bien faire.

C'est aussi la seule règle qui pouvait **contredire une décision déjà prise** :
le ticket qui posait la question proposait « absents, pas grisés » sans savoir
qu'un précédent inverse existait à une page de là. Les deux ne pouvaient pas
rester vrais.

## Ce que la règle coûte, et ce qu'elle rapporte

Elle coûte une branche de rendu plutôt qu'un attribut : on ne peut plus écrire
un composant unique qu'un booléen éteint. En échange, elle ferme le piège de
`CLAUDE.md` §8 **du bon côté**. Ce piège dit qu'un refus RLS sur un `update` ne
lève aucune erreur et touche zéro ligne — une action peut répondre « enregistré »
sans avoir rien écrit. Les seize actions d'écriture de `app/actions.ts` le
ferment déjà côté serveur (`if (!compte.peutEditer) return { ok: false, message:
"Tu es en lecture seule sur ce compte." }`), donc rien ne ment. Mais un refus,
même honnête, arrive **après** le geste. Un contrôle absent le dit avant.

## Deux corollaires qui ne se devinent pas

**Une information n'est pas un geste.** Ce qui porte une information reste
visible, rendu **en marque et jamais en bouton mort** — l'étoile de priorité (son
rang *est* l'ordre des cartes du rapport) et le compteur de couverture, qui
cesse d'être une tâche pour devenir la clé de lecture d'un écart : « 14
campagnes, 8 200 CHF, hors de tout thème », jamais « il reste 14 à classer ».
Retirer ces deux-là au motif qu'on retire l'écriture ferait disparaître de
l'information avec le geste, et laisserait à l'écran un total que rien
n'explique — `CLAUDE.md` §7.

**Une grammaire d'allumage n'a pas de sens sans clic.** La colonne du
vocabulaire du panneau est grise puis **s'allume** en couleur dès qu'un contenu
est coché ([ticket 04](../../.scratch/parcours-themes/issues/04-le-panneau-de-classement.md)).
Chez quelqu'un qui ne cochera jamais rien, elle resterait grise à perpétuité —
soit exactement l'aspect « désactivé » que cette fiche bannit. Elle est donc
allumée d'emblée : la couleur n'y est pas un signal d'affordance, c'est
l'identité du thème.

Décidée au
[ticket 15 du parcours des thèmes](../../.scratch/parcours-themes/issues/15-le-panneau-pour-un-membre-invite.md),
avec David, le 2026-09-21. La dette de `conversions-themes.tsx` est relevée au
`BACKLOG.md` : elle n'a pas été corrigée ici, la carte ne livre pas de code.
