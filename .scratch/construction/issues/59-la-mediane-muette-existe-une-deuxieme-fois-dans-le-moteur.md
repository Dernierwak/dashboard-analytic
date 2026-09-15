# La médiane muette existe une deuxième fois, dans `_rule_gaspillage`

Type: task
Status: open
Blocked by:

## Question

**Trouvé en résolvant le ticket [30](30-la-mediane-sur-deux-valeurs-ne-parle-jamais.md)**,
qui ne nommait qu'un seul site. `CLAUDE.md` §4 : ça devient un ticket, pas un
détour silencieux — et c'est d'autant plus vrai ici que le correctif touche un
autre fichier, un autre niveau de comparaison et un autre jeu de données.

### Le fait, et c'est exactement la même arithmétique

`_rule_gaspillage` (`saas/recos_ia/reco_engine.py`, l. 217) compare le prix du
clic de la campagne la plus chère à la **médiane des campagnes actives** :

```python
actives = df_camp[df_camp["cpc"] > 0]
if len(actives) < 2:
    return None  # 1 seule campagne = pas de médiane comparable
median_cpc = actives["cpc"].median()
worst = actives.loc[actives["cpc"].idxmax()]
if not (worst["cpc"] >= median_cpc * SEUILS["cpc_ratio"] and ...):
```

Sa garde s'arrête à **une** campagne. Mais à **deux** campagnes actives, la
médiane vaut `(a + b) / 2`, la condition devient `a ≥ a + b`, donc `b ≤ 0` — et
`b` est le prix du clic d'une campagne qui a des clics. **La règle est muette
sur tout compte à deux campagnes actives**, quel que soit l'écart.

Le commentaire de la garde dit « 1 seule campagne = pas de médiane comparable ».
Il a raison sur 1 et se trompe sur 2 : à deux, la médiane est *calculable* mais
*infranchissable*. C'est la même erreur de lecture que celle qui a laissé le
défaut vivre dans `regle_annonce_chere`.

### Pourquoi ce n'est pas le même ticket que le 30

Trois raisons de le traiter à part, pas d'en faire un détour :

- **Un autre niveau de comparaison.** Le 30 compare des Annonces dans un Groupe,
  qui partagent audience, placement et enchère. Ici on compare des **campagnes
  entre elles**, qui ne partagent rien — c'est précisément le défaut que
  `_par_groupe` a corrigé un cran plus bas (voir son docstring : une campagne
  Search et une campagne Display n'ont pas un prix du clic, elles en ont deux).
  Recopier le repère des autres sans se poser cette question-là reproduirait le
  vrai problème au lieu de le corriger.
- **Un autre fichier et un autre outil.** `reco_engine.py` travaille en pandas
  sur `df_camp` ; `regles_payantes.py` est pur et ne connaît que des listes de
  dicts. Le helper `_cpc_groupe` ne se réutilise pas tel quel.
- **Un autre jeu de règles.** `_rule_scaler` (l. 304) compare un CTR à `avg_ctr`,
  le taux du **compte entier**, reçu en paramètre — donc elle n'a PAS
  l'impossibilité arithmétique décrite ici, et il ne faut pas la « réparer » par
  symétrie. Elle a en revanche un cousin plus doux, à regarder dans la même
  passe : ce taux de compte inclut la campagne candidate, donc plus celle-ci
  pèse dans le compte, plus elle tire vers elle le repère qu'elle doit dépasser.
  Sur un compte à une ou deux campagnes, c'est la campagne elle-même qui fixe
  presque entièrement sa propre barre.

### Ce qu'il faut trancher

La bonne cible n'est probablement pas « recopier le repère pondéré du ticket 30 »
mais **répondre d'abord à la question de comparabilité** : deux campagnes d'un
même compte sont-elles comparables du tout ? Si la réponse est non, la règle ne
doit pas être réparée, elle doit être **retirée** — et c'est un meilleur
résultat qu'une règle réparée qui compare ce qui ne se compare pas.

`docs/mesures-impossibles.md` est l'endroit où la réponse « non » s'écrirait.

### Consigne de repli

Rendre la mesure : sur le compte de David, combien de semaines ont exactement
deux campagnes actives. Sans ce compte, on ne sait pas si `_rule_gaspillage` est
muette par accident ou muette tout le temps.
