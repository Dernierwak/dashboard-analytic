# Un conseil compare deux régies que le tableau de bord refuse de séparer

Type: task
Status: open

## Question

**Ticket HITL — la question est à David, et elle porte sur une décision qu'il
n'a pas encore prise.** Trouvé en livrant `theme_deux_regies` (ticket
[10](10-six-regles-payantes-restantes.md)). `CLAUDE.md` §4 : ça se remonte, ça
ne se glisse pas.

**Ce ticket ne re-litige rien.** Il constate un écart entre deux choses écrites
le même jour par le même ticket de la refonte, et demande laquelle gouverne.

### Le fait

[`docs/mesures-impossibles.md`](../../../docs/mesures-impossibles.md) porte,
dans sa section « Ce qui n'est PAS impossible, mais pas décidé » :

> **Séparer le ROAS Meta du ROAS Google.** […] Elle exige de **choisir une règle
> d'attribution** — ce qui est une décision produit, pas une donnée manquante.
> **Tant qu'elle n'est pas prise, un ROAS affiché par canal serait une
> invention.**

Et [24](../../refonte/issues/24-conseils-payants-manquants.md), **le même
ticket qui a écrit ce paragraphe**, a décidé la règle `theme_deux_regies` :

> `theme_deux_regies` | ce thème rend 4× mieux sur Google — bascule 25 % |
> tester | argent | **à mesurer**

Cette règle **calcule et affiche** un retour par canal : *« 5,0 CHF rapportés
par franc investi sur Google, contre 1,0 sur Meta »*. C'est un ROAS par canal,
écrit dans un conseil que le client lit chaque lundi.

### Ce qui a été fait, et pourquoi ce n'est pas une décision prise en douce

La règle est livrée avec 24, parce que 24 est la décision de David et que la
carte interdit de la rouvrir soi-même. Mais elle est livrée **sous les gardes
les plus dures qu'on ait su écrire**, et aucune d'elles n'existait dans le
ticket :

- **L'attribution doit être complète des deux côtés.** Chaque campagne du thème
  qui a dépensé sur un canal doit avoir été retrouvée côté GA4 par son nom. Une
  seule campagne perdue (nom vide, renommage dans la régie, UTM qui ne
  correspond plus — le fait mesuré par
  [18](18-revenu-google-non-rattachable.md)) et la règle **se tait**.
- **Un nom de campagne porté par les deux régies rend les deux incomplètes.**
  GA4 indexe par `utm_campaign`, donc par un nom : le même revenu serait versé
  aux deux numérateurs.
- **L'écart doit dépasser 4×**, et pas le 2× des autres comparaisons de coût —
  précisément pour laisser au biais du dernier clic la place qu'il prend.
- **Le champ `pourquoi` nomme ce biais**, en toutes lettres, et c'est une
  condition que 24 avait posée nommément.
- **Le geste est un transfert partiel à tester** (un quart, deux semaines), avec
  un `repere` qui interdit de tout basculer et un `angle_mort` qui dit qu'on ne
  sait pas ce qu'une régie apporte à l'autre.

Autrement dit : la règle n'affiche pas un ROAS par canal **sur un tableau de
bord**, comme une vérité posée. Elle fait une comparaison, dit d'où vient
l'incertitude, et demande une expérience. C'est la lecture qui a été retenue
pour livrer — **elle peut être la mauvaise, et c'est pour ça que ce ticket
existe.**

### Ce qu'il faut trancher

**Un conseil a-t-il le droit de dire ce qu'un tableau de bord n'a pas le droit
d'afficher ?**

- **Oui, et la limite ne parlait que des écrans.** Un conseil porte son angle
  mort, un KPI non. La règle reste, et
  `docs/mesures-impossibles.md` gagne la nuance.
- **Non, un chiffre est un chiffre.** La règle sort du catalogue jusqu'à ce que
  la règle d'attribution soit choisie — et un compte payant retombe alors à
  **une seule** clé qui ouvre une Stratégie (`adset_inegal`), ce qui remplit
  encore l'exigence n° 4 de 24, mais de justesse.
- **Oui, mais sans les chiffres.** La règle reste et cesse d'écrire les deux
  ROAS : elle dit « une de tes deux régies rend nettement mieux sur ce thème,
  voilà comment le tester ». On perd la preuve, on garde le geste — et un
  conseil sans chiffre est exactement ce que Pulse évite partout ailleurs.

### Ce que ce ticket NE demande pas

La règle d'attribution elle-même. Elle reste la question de
[18](18-revenu-google-non-rattachable.md), qui a ses trois options et sa
consigne : **ne pas trancher dans le code**. Aucune ligne de ce ticket n'y
touche — la dépense est comptée exactement comme avant partout ailleurs (page
Coûts, `build_matrix`, ROAS affiché d'un thème).

### Consigne de repli

Rendre la mesure et rien d'autre : sur le compte de David, **combien de thèmes
ont des campagnes dépensières sur les deux régies, et sur combien d'entre eux
l'attribution est complète des deux côtés.** Si c'est zéro, la règle ne parlera
jamais et la question peut attendre — et ça se dit.
