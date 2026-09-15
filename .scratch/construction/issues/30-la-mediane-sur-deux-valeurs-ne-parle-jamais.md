# Une médiane calculée sur deux valeurs ne peut jamais franchir son ratio

Type: task
Status: resolved
Blocked by:

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

---

## La réponse

### Ce qui a été tranché, et par quoi

La question laissée ouverte — repère pondéré des autres, ou médiane des autres —
a été **mesurée avant d'être décidée**, dans
`.scratch/construction/harnais/30-le-repere-des-autres/mesure_repere.py`, qui
pose les trois définitions côte à côte sur onze cas et imprime qui parle et qui
se tait. Le verdict n'est pas celui que le ticket pressentait :

| | médiane actuelle | **repère pondéré des autres** | médiane des autres |
|---|---|---|---|
| 2 annonces, 40 vs 4 CHF | se tait | **parle** | parle |
| 2 annonces, 5 vs 4 CHF | se tait | **se tait** | se tait |
| 4 annonces dont DEUX brûlent | se tait | **parle** | parle |
| voisin minuscule, Groupe à 1 CHF | se tait | **parle** | **se tait** |

Deux choses que le ticket n'avait pas vues :

- **son inquiétude ne se vérifie pas.** Il craignait que le repère des autres se
  taise quand deux annonces sont chères. La mesure dit non : à 40/40/4/4 le
  repère monte à 16 CHF et 40 ≥ 32, la règle parle encore ;
- **la médiane des autres, elle, a un vrai défaut** — elle ignore les volumes.
  Face à un Groupe qui paie 1 CHF le clic sur 10 000 clics, deux miettes à
  30 CHF lui font prendre 25 CHF pour repère, et elle se tait. Or la livraison
  concentre le trafic sur l'annonce qui marche : dans un Groupe réel le
  déséquilibre de volume est **la règle, pas le cas de bord**.

C'est donc le **repère pondéré des autres** — celui qu'utilisaient déjà
`regle_annonce_locomotive` et `regle_adset_inegal`. Le ticket cherchait le
meilleur des deux ; la bonne réponse était le mécanisme unique.

### Le principe qui reste

**Une candidate ne fait jamais partie du repère qui la juge.** C'est la cause
racine, et elle vaut au-delà de cette règle : une médiane qui inclut la
candidate est auto-bloquante à deux valeurs, quel que soit l'écart.

### Ce qui a changé

- `regle_annonce_chere` compare au prix du clic des **autres** annonces du
  Groupe, pondéré par leurs clics (`_cpc_groupe`) ;
- `_cpc_groupe` et `_ctr_groupe` remontent en tête de fichier et deviennent la
  **seule** formule de chacun des deux taux : `_cpc(a)` et `_ctr(a)` n'en sont
  plus que le cas à une ligne. `regle_annonce_locomotive` recalculait son CTR
  pondéré à la main, elle appelle maintenant le helper ; l'import `median`
  est mort et parti ;
- un helper `_les_autres(n, mot)` écrit « l'autre annonce » au lieu de « les
  1 autres annonces ». **Ce défaut était déjà en production** : depuis le ticket
  10, `regle_adset_inegal` parle sur une campagne à deux Groupes et écrivait
  donc « les 1 autres Groupes ». Les trois règles passent par le helper ;
- le commentaire de `SEUILS["cpc_ratio"]` ne promet plus une médiane.

### Ce qui le vérifie

`.scratch/construction/harnais/30-le-repere-des-autres/test_repere_des_autres.py`
— **24 vérifications**, le trou que le ticket avait nommé : le harnais 07 montait
toujours trois annonces par Groupe. Il couvre le Groupe de deux (écart énorme,
pile au seuil, juste sous, écart honnête), le petit voisin qui ne commande pas
le repère, les deux annonces chères, et il vérifie que les gardes du ticket 07
tiennent à deux (campagne jeune des deux côtés, plancher de dépense, deux
canaux, annonce sans clic).

**Les 44 harnais passent** (`python3.12 .scratch/construction/harnais/jouer_tout.py`),
et les 43 qui existaient avant passaient déjà avant le correctif : aucun n'a été
ajusté pour laisser passer le changement.

### Ce qui reste non mesuré

**La consigne de repli n'a pas été honorée, et il faut le dire.** Sur combien de
Groupes du compte de David la règle se taisait pour cette seule raison : pas
d'accès à la base depuis cet environnement. Le correctif se justifie par
l'arithmétique — la règle ne *pouvait pas* parler, c'est démontré, pas estimé —
pas par un volume observé.

**Rien de tout ceci ne se voit en cliquant.** C'est du traitement : il faut un
passage du worker — le cron du Jour de travail (07:00 UTC) ou un lancement à la
main depuis **GitHub Actions** (`weekly-fetch.yml`, `report_only`). Ici ce sera
`report_only`.

**Aucune règle payante n'a jamais tourné sur un vrai compte** (ticket 16). Ce
correctif rend la règle *capable* de parler à deux annonces ; il ne dit pas
qu'elle dira quelque chose de juste — ça, seul un vrai compte le dira.

### Ce que ce ticket a ouvert

- [59](59-la-mediane-muette-existe-une-deuxieme-fois-dans-le-moteur.md) — la
  **même arithmétique** tue `_rule_gaspillage` (`reco_engine.py` l. 217) sur un
  compte à deux campagnes actives. Autre fichier, autre niveau, et la vraie
  question y est « deux campagnes sont-elles comparables du tout ? ».
- [60](60-les-dix-regles-payantes-ont-deux-charpentes.md) — la charpente des dix
  règles (tuple vs dict, la queue recopiée cinq fois, deux idiomes de
  groupement), signalée par deux agents indépendants. À comportement constant,
  volontairement hors de cette passe.
