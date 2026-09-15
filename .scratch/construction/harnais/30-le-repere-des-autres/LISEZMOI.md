# Harnais 30 — le repère des autres

Ticket : [30](../../issues/30-la-mediane-sur-deux-valeurs-ne-parle-jamais.md).

```
python3.12 mesure_repere.py            # la mesure qui a tranché
python3.12 test_repere_des_autres.py   # 24 vérifications
```

Ni base, ni secret, ni réseau.

## Pourquoi ce dossier contient DEUX fichiers

Ils ne font pas le même travail, et c'est délibéré.

**`mesure_repere.py` ne teste rien — il mesure.** Le ticket 30 posait une
question et refusait de la trancher sur avis : faut-il comparer une annonce à la
médiane des autres, ou à ce qu'elles paient pondéré par leurs clics ? Ce script
pose les trois définitions du repère côte à côte sur onze cas et imprime qui
parle et qui se tait. Il n'a pas d'assertion, il n'échoue jamais, et il reste ici
parce que **c'est lui qui porte la raison du choix** : sans lui, la décision
redevient une opinion dans un commentaire. Il se relance si quelqu'un veut
rouvrir la question.

Ce qu'il a montré, et que le ticket n'avait pas vu : l'inquiétude du ticket (le
repère pondéré se tairait quand deux annonces sont chères) ne se vérifie pas,
et c'est la *médiane des autres* qui a le vrai défaut — elle ignore les volumes,
donc deux miettes à 30 CHF lui font prendre 25 CHF pour repère dans un Groupe
qui paie 1 CHF le clic.

**`test_repere_des_autres.py` vérifie.** Il couvre le trou exact que le ticket
nomme : le harnais 07 monte toujours **trois** annonces par Groupe, donc il ne
pouvait pas voir qu'à **deux** la règle était muette quel que soit l'écart.

## Ce que le test prouve

- un Groupe de **deux** annonces fait parler `regle_annonce_chere` — écart
  énorme, et pile au seuil de `cpc_ratio` ;
- et la fait taire quand l'écart est honnête, ou juste sous le seuil ;
- un petit voisin ne commande pas le repère (pondération par les clics) ;
- deux annonces chères sur quatre ne font pas taire la règle ;
- les gardes du ticket 07 tiennent **à deux** : campagne jeune écartée des deux
  côtés, plancher de dépense, deux canaux jamais comparés, annonce sans clic
  hors du repère ;
- aucun conseil n'écrit « les 1 autres annonces » — `locomotive` comprise.

## Ce qu'il ne prouve pas

Que la règle dit quelque chose de **juste**. Aucune règle payante n'a jamais
tourné sur un vrai compte (ticket 16) : le harnais montre qu'elle est capable de
parler, pas qu'elle a raison de le faire.

Et il ne dit rien du volume : sur combien de Groupes réels la règle se taisait
pour cette seule raison reste non mesuré, faute d'accès à la base.
