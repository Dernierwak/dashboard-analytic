# Le document de refonte — celui qui ferme la carte

Type: grilling
Status: resolved
Blocked by: 04

## Question

**C'est la destination de la carte, et le dernier ticket sur le chemin.**

La carte demande un document unique qui dise, dans cet ordre :

1. **le but de Pulse en une phrase** ;
2. **ce qui doit être validé en premier** → tranché par
   [04](04-ce-qui-doit-etre-valide-en-premier.md) : que le fil de la semaine
   tienne de bout en bout, jugé par David sur son compte ;
3. **à quoi ressemble la version la plus simple qui le valide** ;
4. **dans quel ordre les briques suivantes s'ajoutent**.

Le point 2 est fait. **Restent 1, 3 et 4**, et ils sont maintenant formulables
parce que le parcours est décidé : les tickets 06 à 13 disent ce que chaque
module fait dans le fil.

### 1 · La phrase

Elle est en brume depuis [03](03-le-but-de-pulse.md), et **David a arrêté la
ciselure lui-même** : *« tu me poses des questions pour faire des choses précises
alors que le projet est encore flou. Nous n'avons aucun workflow, nous ne savons
pas comment les pages travaillent ensemble. »* Cette raison est levée : le
workflow est décidé.

Une candidate **non validée** dort dans l'`## Answer` de 03. Matière disponible :
pour qui (une entreprise, plusieurs paires d'yeux — 03), le moment (le Jour de
travail — 03), le rôle du carnet (03, 08), le fil (04), et les formulations
**mortes à l'écrit** par [02](02-sur-quoi-se-differencient-les-autres.md) :
« toutes vos données au même endroit » (un connecteur coûte 39 €/mois) et « des
recos pour améliorer vos campagnes » (gratuit chez Google comme chez Meta). L'axe
resté libre sur les 10 produits lus : **l'arbitrage ENTRE canaux dans une seule
réponse**.

### 2 · La version la plus simple qui valide

Ce que le fil de 04 exige, et rien de plus. Deux garde-fous :

- **Interdit** de répondre « il faut d'abord tout nettoyer » — un chantier de
  propreté ne valide aucune hypothèse (règle posée dans 04).
- La version la plus simple **inclut ce qui casse le fil** : la validation à la
  date choisie (défaut mesuré en 04) en fait partie ; un module qui n'est pas sur
  le fil n'en fait pas partie, même s'il est décidé.

### 3 · L'ordre des briques

Quelle fonctionnalité s'ajoute quand, et **à quelle condition**. Les tickets
ouverts à ranger dans cet ordre : 14, 15, 16, 17, 18, 19, 20. Deux dépendances
dures connues : [18](18-passer-en-production.md) conditionne toute validation
chez un vrai client, et [17](17-ce-qui-se-regroupe-et-ce-qui-est-mesure.md)
conditionne le rapport qui se met à jour à la lecture.

### 4 · Le sort des thèmes, qui se referme ici

Question ouverte depuis 03, jamais tranchée, et **08 en a changé la forme** : le
thème n'est pas un rayon qu'on garderait ou couperait, c'est un
**multiplicateur** — chaque dashboard vit sans lui et gagne un module avec lui.
04 y ajoute la réponse de conception : **un module par thème vide est visible et
verrouillé**, et il dit ce qu'il débloque. Ce qui reste à écrire : **ce que Pulse
vaut pour un compte qui ne classe jamais.**

### 5 · La doc du produit, décidée en 05

[05](05-carte-du-savoir.md) a tranché qu'on n'exhume aucun des six documents
supprimés et que **la structure propre s'écrit à la sortie de cette carte**,
thématique par thématique, à partir de ce que 07 à 13 ont décidé. C'est ce
document qui déclenche ce travail — il en est la table des matières, pas le
contenu.

### Consigne de conduite

Ticket **HITL**. Le document se relit **contre les tickets**, jamais de mémoire :
chaque affirmation pointe le ticket qui l'a tranchée. Skills : `vision-produit`
pour la phrase, `domain-modeling` pour ce qui doit entrer dans `CONTEXT.md`,
puis `grilling`.

### Consigne de repli

Écrire les points 2 et 3 (la version la plus simple, l'ordre des briques) plutôt
que de ciseler la phrase — c'est la phrase qui a déjà été arrêtée une fois pour
avoir été prise trop tôt.

## Answer

Session HITL du 2026-09-10 avec David. **Le document existe :
[`plan-de-refonte.md`](../plan-de-refonte.md).** La carte est fermée.

### 1 · La phrase — écrite, et David a corrigé le produit en la corrigeant

> *Chaque semaine, le jour que tu choisis, Pulse te dit ce qui a bougé chez toi
> — campagnes et publications, tous canaux confondus — te propose quoi faire sur
> les thèmes que tu as mis en priorité, et te dit la semaine suivante si ça a
> marché.*

La session avait proposé *« Pulse te dit lequel de tes thèmes mérite tes dix
minutes »*. **David l'a refusée net** : *« Non putin. Tu as le point de vue de la
semaine, campagne x fonctionne bien, une nouvelle campagne lancée, poste est
bien, etc. Les labels sont les recos pour les labels prio. Fin. »*

Ce n'est pas une nuance de formulation, c'est **une décision produit** : Pulse
n'arbitre pas entre les thèmes, le client désigne ses priorités et Pulse
conseille dedans. Trois temps : le **constat** (existe sans thème), le
**conseil** (n'existe que sur les priorités), le **retour**.

**Conséquence appliquée** : `CLAUDE.md` §1 promettait *« où mettre ses dix
minutes cette semaine, et pourquoi »* — une phrase qui attribue l'arbitrage à
Pulse. Corrigée. `CONTEXT.md` gagne **Point de vue de la semaine** et voit
**Priorité (étoile)** redéfinie.

### 2 · Filtre dur, pas tri — un défaut mesuré pendant la session

`build_report.py` l. 442 **trie** en mettant `is_priority` en tête, mais les
conseils des thèmes non prioritaires **sortent quand même**, plus bas. La règle
de David les supprime : filtre, pas tri.

Fichée en ADR le 2026-09-10 à la demande de David :
[`docs/adr/0003-conseil-uniquement-sur-theme-prioritaire.md`](../../../docs/adr/0003-conseil-uniquement-sur-theme-prioritaire.md).

Deux effets assumés : le plafond de cinq de
[11](11-d-ou-viennent-les-conseils.md) devient rarement atteint — **c'est un
plafond, pas un quota**, on ne complète pas avec du non-prioritaire ; et un
compte à zéro priorité voit le **module de conseils verrouillé** (« désigne un
thème prioritaire »), sur le patron des modules verrouillés de
[04](04-ce-qui-doit-etre-valide-en-premier.md).

### 3 · La version la plus simple : le fil d'une semaine, sur un compte déjà branché

Onze éléments, tous sur le fil, détaillés au §3 du document. Deux tickets
doivent être résolus **avant d'écrire une ligne** : [20](20-a-faire-cette-semaine.md)
(le module qui se vide, la date choisie) et [22](22-rebrancher-le-plan-de-theme.md)
— parce que [14](14-le-conseil-facile-et-la-degradation.md) a mesuré qu'après
11, **une seule règle sur douze est une retouche** : le fil mènerait à une liste
pauvre et on jugerait le mauvais coupable.

Sont **hors v1** et pourquoi : 10, 18, 12/15, 07, 17, 16, 19, 23 — aucun ne
répare un cul-de-sac du fil.

### 4 · L'ordre des briques : huit rangs, chacun avec sa condition d'entrée

Tableau au §4 du document. Le principe : **rien ne se construit pour un client
qui n'existe pas encore.**

[18](18-passer-en-production.md) est en **brique 0, en parallèle, hors du fil** :
son délai est administratif (CASA annuelle par un tiers agréé, `adwords` étant
*restricted*), pas technique. Fait vérifié pendant la session qui débloque la
validation sans l'attendre : **le bouton « Reconnecter » existe déjà**
(`app/comptes/page.tsx` l. 353 et 373). Le mur des 7 jours n'interdit pas de
valider, il oblige à recliquer avant chaque Jour de travail — une semaine
oubliée est une semaine de données perdue.

### 5 · Le sort des thèmes, fermé

Un compte qui ne classe jamais reçoit **le point de vue de la semaine** et
**aucun conseil**. Le chemin compte-entier déterministe existe toujours
(`build_recos`, l. 2048) et **n'est volontairement pas rebranché** : un conseil
compte-entier retombe exactement dans ce que Google et Meta donnent gratuitement
([02](02-sur-quoi-se-differencient-les-autres.md)). Les modules par thème sont
**visibles et verrouillés**, avec écrit dessus ce qu'un thème débloque.

### 6 · Le fil est un chemin, pas un rail

David : *« le user peut faire ce qu'il veut dans l'ordre qu'il veut, mais je
trouve essentiel d'avoir une idée de comment le client doit faire pour pouvoir
améliorer »*. Une seule exception gardée : **la connexion reste un gate dur**
(patron de l'ADR 0002) — la passer ne donne pas de la liberté, ça donne l'écran
mort mesuré en [10](10-l-entree-premier-ecran.md). Tout le reste se franchit
dans le désordre.

**Précision apportée à 10** : l'étape « thèmes » de la Mise en place se valide
sur **un thème posé sur au moins une campagne**, pas sur un thème créé. Sinon on
franchit l'étape en tapant un mot et le module reste verrouillé juste après
avoir annoncé qu'il se déverrouillait. Le profil (étape 1) et les priorités
(étape 4) restent, avec leurs raisons écrites en 10.

### 7 · Ce qui est versé ailleurs, non tranché ici

Le *« hé teste cela »* de David (ajoute un thème, mets une priorité, renseigne
tes budgets) **n'est pas de la Mise en place** — c'est le **nudge**, déjà ouvert
dans [20](20-a-faire-cette-semaine.md) avec sa réserve écrite : *un nudge qui
revient chaque semaine devient un décor en trois semaines*. Reporté à 20, pas
décidé ici.
