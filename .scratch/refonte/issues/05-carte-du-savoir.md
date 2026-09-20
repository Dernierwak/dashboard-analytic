# Ce qui remplace la carte du savoir effacée

Type: grilling
Status: resolved

## Question

Gradué de la brume par la résolution de
[01](01-etat-des-lieux.md) : la question est maintenant formulable parce qu'on
sait exactement ce qui manque, ce que chaque fichier portait, et que **tout est
récupérable** par `git show 7f188f3^:<chemin>`.

Que doit lire un agent au démarrage, et où ça vit ?

### L'état constaté

`CLAUDE.md` §6 liste 7 fichiers ; **6 n'existent plus** (commit `7f188f3`,
« nettoyage docs obsolètes »). Le plus lourd, `docs/03-grammaire-des-modules.md`
(**1 075 lignes**), est toujours invoqué par `CLAUDE.md` racine §6 — qui exige
que « tout module créé ou restructuré met à jour sa section *Où on en est* dans
le même commit » — et par `saas/web/CLAUDE.md`, qui parle de « la grammaire des
modules » et de son « rang 3 est le chiffre ».

**Conséquence mécanique, pas théorique** : un agent qui obéit à l'instruction
cherche un fichier absent, ne le trouve pas, et improvise. C'est le mécanisme
par lequel des modules cessent de se ressembler. `CLAUDE.md` §3 pose que la
qualité des agents compte autant que le produit — cette question est de ce
côté-là.

Détail des 6 fichiers et de leurs sommaires récupérés :
[`etat-des-lieux.md` §7](../etat-des-lieux.md).

### Ce qu'il faut trancher

- **Ce qui revient, et sous quelle forme.** Un document de 1 075 lignes qu'aucun
  agent ne lit en entier n'est pas un savoir, c'est un coût. Ressusciter tel
  quel, réécrire court, ou remplacer par autre chose.
- **Ce qui ne revient pas**, et alors `CLAUDE.md` §6 et `saas/web/CLAUDE.md`
  cessent de l'invoquer — une référence morte est pire qu'une absence assumée.
- **Où vit l'état des lieux.** Il est daté (`main` à `cf84957`) et il périmera.
  Reste-t-il une photo de `.scratch/`, ou devient-il le `STATUS.md` permanent
  qui manque ? Les deux ont un coût d'entretien différent.
- **Ce que `docs/references/plateformes.md` portait** — dont une section
  « Ce qui est impossible — ne pas essayer de le reconstruire ». `CLAUDE.md` §8
  n'en garde qu'une ligne (Google Ads `change_event`, 30 jours). Le reste est
  du savoir payé cher, aujourd'hui lisible seulement par `git show`.

### Ce qui n'est PAS dans ce ticket

Le but de Pulse (03) et ce qu'on coupe (04). Ce ticket ne touche pas au
produit : il décide de ce que les agents lisent. Il est **indépendant** de 03 et
peut se travailler en parallèle.

### Consigne de conduite

Ticket **HITL**. Appeler `grilling` + `domain-modeling`. Aucune décision de
périmètre produit ici ; si la conversation y dérive, c'est qu'elle appartient à
03 ou 04.

## Answer

**David a tranché le ticket en refusant sa prémisse** (2026-09-08) :

> *« Tout ce qui est avant, on oublie. On veut créer une base qui est saine, une
> structure qui est claire pour chacune de ces thématiques. […] On ne va pas
> aller dans les détails qui ne servent à rien et qui n'apportent pas grand-chose
> à part de la confusion. »*

### La décision

**On n'exhume aucun des six documents supprimés.** Ils restent dans Git
(`git show 7f188f3^:<chemin>`) et n'en sortent pas. La raison n'est pas qu'ils
étaient mauvais — la grammaire des écrans était dense et chèrement payée — mais
qu'ils décrivent une app que la refonte est en train de changer. Ressusciter un
document pour le contredire trois tickets plus loin coûte deux fois.

**La structure propre s'écrit à la sortie de cette carte**, thématique par
thématique, à partir de ce que les tickets 07 à 11 auront décidé. C'est le
produit qui dicte la doc, pas l'inverse.

### Ce qui a quand même été fait, parce que c'est une panne active

Les références mortes dans les `CLAUDE.md` **font improviser les agents** — deux
d'entre eux avaient déjà contourné le trou par écrit (`saas/web/CLAUDE.md`,
`saas/collecte/CLAUDE.md`) sans que personne ne rebouche. Corrigé :

- `CLAUDE.md` §6 ne cite plus que des fichiers qui existent.
- Les deux paragraphes de contournement sont retirés.
- `docs/mesures-impossibles.md` (28 l.) : la seule connaissance des six
  documents qui ne se périmera jamais et qui contraint tout écran à venir — le
  ROAS par canal, le ROAS par thème et par semaine, l'historique de budget, la
  conversion sur un thème organique. C'est la matière d'application de §7
  (« aucun chiffre fabriqué »), pas de l'archéologie.

### Ce qui ne se décide plus ici

L'inventaire « où en est chaque écran », le journal de bord, la procédure Google
Ads, le document TikTok : rien de tout ça ne revient par ce ticket. Le gabarit
d'une plateforme se décide en [07](07-gabarit-de-plateforme.md), à partir du
code d'aujourd'hui.
