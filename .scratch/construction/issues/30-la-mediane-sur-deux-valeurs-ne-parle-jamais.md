# Une médiane calculée sur deux valeurs ne peut jamais franchir son ratio

Type: task
Status: open

## Question

**Trouvé en écrivant `adset_inegal`** (ticket
[10](10-six-regles-payantes-restantes.md)), qui portait le même défaut : il y a
été corrigé, il reste dans `regle_annonce_chere` (ticket
[07](07-quatre-regles-payantes.md)). `CLAUDE.md` §4 : ça devient un ticket, pas
un détour silencieux.

### Le fait, et il est arithmétique

`regle_annonce_chere` compare le prix du clic de l'annonce la plus chère à la
**médiane** des annonces de son Groupe :

```python
mediane = median(_cpc(a) for a in comparables)
pire = max(comparables, key=_cpc)
if _cpc(pire) >= mediane * SEUILS["cpc_ratio"]:   # cpc_ratio = 2.0
```

Quand le Groupe ne contient que **deux** annonces comparables, la médiane vaut
`(a + b) / 2`. La condition devient `a ≥ a + b`, c'est-à-dire `b ≤ 0` — et `b`
est le prix du clic d'une annonce qui a des clics, donc il est strictement
positif. **La règle ne peut donc JAMAIS parler sur un Groupe de deux annonces**,
quel que soit l'écart entre elles : une annonce à 40 CHF le clic à côté d'une
annonce à 4 CHF reste muette.

Ce n'est pas un cas de bord. Un Groupe d'annonces à deux créas est la situation
la plus courante chez un petit annonceur — c'est même la forme canonique d'un
test A/B. Le harnais 07 ne l'a pas vu parce que ses fixtures montent toujours
**trois** annonces par Groupe.

### Ce que le ticket 10 a fait, et qui sert de patron

`regle_adset_inegal` comparait d'abord à une médiane et se taisait exactement
pareil sur une campagne à deux Groupes. Elle compare maintenant au prix du clic
des **AUTRES**, pondéré par leurs clics — la même mécanique que
`regle_annonce_locomotive`, qui ne souffre pas du défaut parce qu'elle a
toujours été écrite comme ça :

```python
autres = [a for g, lignes in groupes.items() if g != pire for a in lignes]
repere = _cpc_groupe(autres)
```

Un Groupe ne se compare jamais à lui-même, un petit voisin ne commande pas le
repère, et deux suffisent.

### Ce qu'il faut trancher avant de recopier

**Le repère change de sens, et ça change qui se fait dénoncer.** La médiane est
robuste aux extrêmes, la moyenne pondérée ne l'est pas : dans un Groupe de cinq
annonces dont une brûle tout son budget à 40 CHF le clic, le repère des « autres »
reste sain, mais dans un Groupe où DEUX annonces sont chères, le repère monte et
la règle se tait. Il faut décider ce qu'on veut :

- **le repère des autres** (ce que fait `annonce_locomotive` et maintenant
  `adset_inegal`) — cohérent avec ses voisines, parle dès deux annonces ;
- **la médiane des autres** (`median` en excluant la candidate) — garde la
  robustesse ET parle dès deux ; mais avec deux voisines la médiane est leur
  moyenne, donc les deux options se rejoignent exactement dans le cas qui pose
  problème.

La seconde a l'air de gagner sur les deux tableaux. À vérifier sur un jeu de
cas avant de trancher, pas à décider ici.

### Ce que ce ticket NE touche pas

`regle_annonce_sans_conversion` — elle ne compare aucune médiane, elle cherche
une voisine qui convertit. Elle parle déjà sur un Groupe de deux.

### Consigne de repli

Rendre la mesure : sur combien de Groupes d'annonces du compte de David
`regle_annonce_chere` se tait aujourd'hui **uniquement** parce qu'ils ont deux
annonces. Sans ce compte, on ne sait pas si le défaut est théorique ou vécu.
