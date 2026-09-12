# Les quatre règles du ticket 07 n'ont pas de cible : elles ne sortent qu'une fois

Type: task
Status: open

## Question

**Trouvé en posant les `cible` des six règles du ticket
[10](10-six-regles-payantes-restantes.md).** `CLAUDE.md` §4 : ça devient un
ticket. Le ticket 10 a posé les siennes ; il n'a pas touché à celles de
[07](07-quatre-regles-payantes.md), qui ne sont pas de son périmètre.

### Le fait

L'identité d'un conseil, pour la composition de la semaine, est
`(clé, cible)` — `empreinte`, dans `saas/recos_ia/composition.py`. Et David a
posé lui-même ce que ça veut dire :

> *« Mettre un objectif de CPC à X, dans deux semaines on peut refaire une reco
> mettre CPC objectif à X. Le X ne sera pas le même. […] On ne fait cependant
> pas revenir la même reco qui change exactement la même chose. »*

`annonce_sans_conversion`, `annonce_locomotive`, `annonce_chere` et
`theme_hors_budget` **ne posent aucune `cible`**. Leur empreinte est donc
`("annonce_chere", "")` — la même pour toutes les annonces, de tous les Groupes,
de tous les thèmes. Deux conséquences, et la seconde est la plus lourde :

- **Dans un même rapport** : un compte à trois thèmes prioritaires ne verra
  `annonce_chere` que sur UN thème. Le filtre `empreinte_conseil(r) not in
  _deja_servies` (`build_report.py`) puis `composer_la_semaine` écartent les
  deux autres — deux annonces chères, sur deux thèmes différents, réduites à une.
- **D'une semaine sur l'autre** : `_deja_servies` est alimenté par les rapports
  **publiés**. Une fois `annonce_chere` servie, la clé est consommée pour de
  bon : l'annonce chère de la semaine suivante, même si c'en est une autre, dans
  un autre Groupe, ne repassera pas. C'est le contraire exact de ce que David a
  dit.

### Ce que ça n'est pas

Ce n'est pas le plafond de trois par thème, ni celui de cinq sur la semaine :
ceux-là sont voulus et assumés. C'est une identité trop grossière, qui fait
prendre deux conseils différents pour le même.

### Le geste, et pourquoi il ne se glisse pas

Poser `cible` sur les quatre est de quelques lignes — l'Annonce pour les trois
règles d'annonce, le thème pour `theme_hors_budget`, exactement comme le ticket
10 l'a fait pour les six autres. Mais **ça change ce que les rapports déjà
publiés signifient** : les empreintes `("annonce_chere", "")` déjà en base ne
correspondront plus à rien, et la règle se remettra à parler sur des thèmes où
elle s'était tue. C'est un changement de comportement visible, pas une
correction invisible — il se dit avant de se faire.

### À vérifier avant, parce que ça peut être pire

Les clés **organiques** (`orga_*`, `silence`, `page_endormie`) et `roas` ne
posent pas de cible non plus. Si leur empreinte souffre du même écrasement, le
défaut ne date pas du ticket 07 : il date du jour où l'empreinte a remplacé la
clé seule, et il touche **tout** le catalogue. **À compter avant de corriger
quoi que ce soit** — un ticket qui répare quatre règles là où quinze sont en
cause répare la mauvaise moitié.

### Consigne de repli

Rendre la liste : quelles clés posent une `cible` aujourd'hui, lesquelles non,
et combien d'empreintes distinctes `reco_feedback` / les rapports publiés de
David contiennent réellement. Une liste vérifiée vaut mieux qu'une correction
appliquée à l'aveugle.
