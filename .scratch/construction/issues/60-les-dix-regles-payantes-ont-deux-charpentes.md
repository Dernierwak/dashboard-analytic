# Les dix règles payantes portent deux charpentes au lieu d'une

Type: task
Status: open
Blocked by:

## Question

**Trouvé par la revue `/simplify` du ticket
[30](30-la-mediane-sur-deux-valeurs-ne-parle-jamais.md)**, par deux agents
indépendants (angle *reuse* et angle *simplification*, même conclusion). Le
ticket 30 a unifié le **repère** ; il reste deux duplications de **charpente**
que je n'ai pas appliquées dans sa passe, parce qu'elles touchent des règles qui
n'ont rien à voir avec son défaut et qu'un correctif de fond mérite d'être
relisible seul.

### Fait 1 — la forme du candidat : tuple ici, dict là

Cinq règles rangent leur candidat dans un **tuple positionnel** relu par index :

```python
candidats.append((pire, repere, len(comparables) - 1))   # regle_annonce_chere
pire, repere, n_voisines = max(candidats, key=lambda c: float(c[0].get("depense") or 0))
```

`regle_adset_inegal` fait le même travail avec un **dict à clés nommées**
(`c["depense"]`, `c["groupe"]`…). Les deux formes cohabitent dans le même
fichier sans qu'une ligne dise laquelle est la bonne.

Le coût est concret et déjà vécu : le fichier a gagné six règles en un seul
ticket (le [10](10-six-regles-payantes-restantes.md)). Ajouter un champ à un
tuple oblige à retoucher la construction **et** tous les accès positionnels,
sans qu'aucun outil ne signale un oubli. La forme dict survit au même ajout sans
rien changer. C'est elle qui devrait être la forme unique.

### Fait 2 — la queue de règle recopiée cinq fois

`if not candidats: return None` suivi d'un `max(candidats, key=<poids en argent>)`
est écrit à l'identique dans `annonce_chere`, `annonce_sans_conversion`,
`adset_inegal`, `budget_non_depense` et `creneau_pub` — cinq `lambda`
légèrement différentes pour une seule et même décision : *entre plusieurs
candidats, celui qui pèse le plus en CHF gagne.*

`annonce_locomotive` s'en écarte, et c'est **légitime et documenté** : son poids
est le nombre d'impressions, parce que c'est le signal le moins fragile. Cette
variation-là n'est pas une redite et ne doit pas être aplatie.

Le coût : changer ce départage (par exemple départager deux dépenses égales par
le nombre de clics) demande cinq éditions cohérentes, et rien ne le rappelle.

### Fait 3 — le groupement, deux idiomes pour une idée

`_par_groupe` range les Annonces par `(canal, groupe)` et jette les singletons.
`regle_adset_inegal` a besoin d'un cran de plus (par campagne, **puis** par
groupe) et reconstruit à la main un dict-de-dict avec deux `setdefault`
imbriqués, suivi d'une boucle de 45 lignes qui mélange trois choses : construire
le repère, appliquer les seuils, élire le pire.

Un lecteur qui a compris `_par_groupe` doit réapprendre un second schéma pour
cette seule règle.

### Ce qu'il faut trancher avant de recopier

**Ne pas généraliser pour généraliser.** Un `_par_cle(annonces, cle)` générique
qui accepte n'importe quelle clé composite serait plus court et moins clair : la
valeur de `_par_groupe` n'est pas son `setdefault`, c'est son **docstring**, qui
explique pourquoi deux Annonces d'un même Groupe sont comparables et pourquoi
deux Annonces de deux canaux ne le sont pas. Un helper générique perd
exactement ça.

La bonne cible est donc probablement un second helper **nommé et documenté**
(`_par_campagne_puis_groupe`) à côté du premier, pas un helper paramétrable qui
remplace les deux.

### Ce que ce ticket NE touche pas

Le **repère** des trois règles, réglé par le ticket 30 et couvert par
`.scratch/construction/harnais/30-le-repere-des-autres/`. Ce ticket-ci ne change
aucun chiffre rendu au client : c'est une refonte à comportement constant, et
les 44 harnais doivent rester verts à l'identique — c'est sa condition de
sortie, et c'est ce qui le rend sûr à jouer.

### Consigne de repli

Les trois faits sont indépendants. Faire le 2 seul (la queue de règle) est déjà
une amélioration complète et se relit en deux minutes ; le 1 et le 3 peuvent
attendre. Rendre ce qui est fini plutôt que trois moitiés.
