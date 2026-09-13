# La v1 : le fil d'une semaine, de bout en bout

Status: ready-for-agent

Origine : la carte de refonte [`../refonte/map.md`](../refonte/map.md), **fermée**
le 2026-09-10 après 21 tickets résolus, et son document de sortie
[`plan-de-refonte.md`](../refonte/plan-de-refonte.md) §3. Cette spec est le
document unique de ce que le §3 appelle *« la version la plus simple qui
valide »* ; les quinze tickets de [`map.md`](map.md) la bâtissent, un morceau
chacun.

**Règle de lecture** : cette spec ne décide rien. Chaque affirmation a été
tranchée par un ticket de la refonte, et le ticket est cité. Une session qui
rouvre une décision citée ici travaille à l'envers — ça se dit à David, ça ne se
glisse pas.

Vocabulaire : **Thème**, **Priorité (étoile)**, **Point de vue de la semaine**,
**À faire**, **Carnet**, **Note**, **Action suivie**, **Verdict**, **Geste**,
**Levier**, **Stratégie**, **Marche**, **Jour de travail**, **Regroupement**,
**Mesure prise**, **Annonce**, **Groupe d'annonces**, **Propriétaire**,
**Membre** sont ceux de `CONTEXT.md`, pas des synonymes libres. Le mot est
**thème**, jamais « label » — alors que le code dit `label` partout, y compris
dans les URL.

ADR qui commandent ce périmètre :
[0003](../../docs/adr/0003-conseil-uniquement-sur-theme-prioritaire.md) (un
conseil ne naît que sur un thème prioritaire) et
[0004](../../docs/adr/0004-une-note-a-un-auteur-un-statut-non.md) (une note a un
auteur, un statut n'en a pas). Ni l'un ni l'autre ne se re-litige ici.

---

## Problem Statement

Pulse promet une semaine de travail : *« chaque semaine, le jour que tu
choisis, Pulse te dit ce qui a bougé chez toi, te propose quoi faire sur les
thèmes que tu as mis en priorité, et te dit la semaine suivante si ça a
marché »*. Aujourd'hui, **ce fil casse à sept endroits au moins**, et chaque
cassure est mesurée, pas supposée.

**Le client n'arrive pas jusqu'au conseil, ou il arrive à un mauvais conseil.**

- Le filtre sur les thèmes prioritaires **n'existe pas** : Pulse ne fait qu'un
  *tri*, donc les conseils des thèmes que le client n'a pas étoilés sortent
  quand même, plus bas. Pulse arbitre à sa place, contre l'ADR 0003
  ([21](../refonte/issues/21-le-document-de-refonte.md)).
- Il n'y a **aucun plafond** : trois conseils par thème sur un nombre de thèmes
  illimité n'est pas un plafond. La liste est longue là où elle devrait être
  courte ([11](../refonte/issues/11-d-ou-viennent-les-conseils.md)).
- Le **stock réel de conseils est de sept**, et **six des sept ne parlent qu'à
  Instagram** : un compte sans Instagram reçoit **un** conseil par semaine
  ([22](../refonte/issues/22-rebrancher-le-plan-de-theme.md)).
- La séquence qui enchaîne les conseils d'un thème — la **Stratégie** et ses
  **Marches** — était rédigée à 100 % par l'IA, et le retrait des pistes
  inventées l'a laissée **orpheline**
  ([14](../refonte/issues/14-le-conseil-facile-et-la-degradation.md)).
- « Qu'est-ce qui marche chez toi » est calculé **trois fois**, dans deux
  langages, avec trois jeux de seuils **qui peuvent se contredire** — et le
  moteur le plus juste, celui qui lit tout l'historique sans IA, **n'est affiché
  nulle part** ([11](../refonte/issues/11-d-ou-viennent-les-conseils.md)).

**Des chiffres faux sont à l'écran, et ils fabriquent de faux Verdicts.**

- Le ROAS d'un thème divise un revenu **deux régies** par une dépense **Meta
  seule** : tout thème bi-régie affiche un chiffre gonflé, et le Verdict rendu
  sur ce chiffre est faux dans le même sens
  ([24](../refonte/issues/24-conseils-payants-manquants.md)).
- Deux **Annonces** homonymes n'en font qu'une en base : la dépense de la
  seconde n'entre jamais
  ([25](../refonte/issues/25-identifiant-annonce-meta.md)).

**Le client ne peut pas rendre compte de ce qu'il a fait.**

- On ne peut **pas valider à la date où on a agi** : Pulse écrit la date du
  clic. Faire le changement mardi et cliquer vendredi décale la mesure de trois
  jours — **et le Verdict repose sur cette date**
  ([04](../refonte/issues/04-ce-qui-doit-etre-valide-en-premier.md)).
- Un plafond de **trois actions ouvertes**, écrit nulle part, ferme la sortie :
  à cinq conseils, deux n'ont d'autre issue que le refus
  ([20](../refonte/issues/20-a-faire-cette-semaine.md)).
- Sur un compte à deux personnes, **le second Verdict écrase le premier** et
  l'écran répond « enregistré » sans avoir rien vérifié — le piège maison d'un
  refus silencieux sur un `update`
  ([16](../refonte/issues/16-compteur-partage.md)).
- Le **Carnet** ne peut pas répondre à *« montre-moi tout ce que j'ai fait pour
  cette campagne »* : aucune colonne de campagne n'existe
  ([08](../refonte/issues/08-la-memoire-du-travail.md)).

**Le fil se termine en cul-de-sac.**

- Le rapport **ne renvoie jamais** vers les pages plateforme : ses seuls liens
  sortants vont vers la page de classement. Le profil qui se sert de l'hebdo
  comme travail prémâché puis va creuser seul est bloqué net
  ([06](../refonte/issues/06-le-parcours-comment-les-pages-se-parlent.md)).
- Le premier écran met en haut **la prose IA** — ce qu'il y a de moins
  vérifiable sur la page — et le Verdict plus bas
  ([10](../refonte/issues/10-l-entree-premier-ecran.md)).
- Trois dates commandent la lecture du rapport — mesuré, publié, mis à jour — et
  **une seule est affichée** ([13](../refonte/issues/13-entre-deux-jours-de-travail.md)).
- Quatre boutons laissent le client **déclencher lui-même** la récolte et la
  rédaction, hors de son Jour de travail
  ([08](../refonte/issues/08-la-memoire-du-travail.md)).

**Le prix de tout ça, du point de vue de David** : il ne peut pas parcourir son
propre fil une fois en entier, donc il ne peut pas juger si le produit tient. Et
c'est la seule mesure qu'il ait — Pulse ne mesure rien de ses utilisateurs
(aucune télémétrie dans le dépôt, aucun email envoyé), et ajouter un outil de
mesure d'audience a été explicitement écarté : ce serait une brique avant la
première.

---

## Solution

**Le fil d'une semaine, parcouru de bout en bout sur un compte déjà branché,
sans cul-de-sac.** Rien de plus. Ce n'est pas une fonctionnalité : c'est la
**continuité**, et c'est ce que 04 a désigné comme la première chose à valider.
Les trois candidates évidentes — le classement, le conseil pris, le carnet
rempli — ont été écartées par David : ce sont des **morceaux** du fil, et si le
fil casse, un bon conseil ne sert à rien parce que personne n'arrive jusqu'à lui.

Le fil, dans les mots de David :

> *« Hebdomadaire : ha super, je vois ce qui est en ligne, j'ai un mini point de
> situation. Je vois que les postes sont moins bien en moyenne, je vais voir sur
> la plateforme et j'essaie de trouver seul. On scroll, ok je dois faire quoi
> cette semaine, parfait je prends note, je fais mes tâches. Semaine prochaine
> je pourrai regarder si cela a fonctionné. Une fois fait, je vais sur l'app et
> je valide ce que j'ai fait. Si j'ai fait cela hier et oublié, je peux valider
> à une date précise autre que quand je clique. »*

Ce que le client voit changer, dans l'ordre où il le rencontre :

**Il ouvre l'app et le vérifiable est en haut.** Le Verdict de ce qu'il a fait la
semaine dernière, puis le bilan de son Carnet, puis le rail des chantiers en
cours, et **le résumé IA replié** — la prose est ce qu'il y a de moins
vérifiable, elle cesse d'occuper les pixels les plus chers. En tête du rapport,
**trois dates** disent tout ce qu'il y a à dire sur la fraîcheur : *mesuré du X
au X · publié le X · mis à jour le X*. Un rapport ne se déclare **jamais**
« périmé » : vieux ≠ faux.

**Il lit le Point de vue de la semaine.** Ce qui a bougé sur ses campagnes et ses
publications, tous canaux confondus. Il existe déjà, et il existe **pour tout le
monde**, même pour qui n'a jamais classé.

**Il reçoit cinq conseils au maximum, et seulement sur ses thèmes prioritaires.**
Un **filtre dur**, pas un tri : les conseils des thèmes non étoilés
**disparaissent**. Cinq est **un plafond, jamais un quota** — une semaine à deux
conseils est honnête, et on ne complète pas avec du non-prioritaire. S'il n'a
étoilé aucun thème, il ne voit pas un module vide mais un module **verrouillé**
qui dit ce qu'une étoile débloque. Et les conseils cessent d'être un privilège
Instagram : dix règles neuves lisent enfin le détail **Annonce par Annonce** que
Pulse récolte chaque jour sans jamais l'ouvrir.

**Il clique sur un chiffre de thème et atterrit sur la bonne plateforme, à la
bonne fenêtre.** Le lien emporte **le thème ET la fenêtre du rapport** — sinon
« 4 520 CHF » devient « 103 CHF » au clic, et ça se lit comme un bug. La page
dit d'où il vient et propose d'y retourner. Il ne ramène rien : écrire depuis
une page plateforme appartient au Carnet.

**Il coche ce qu'il a fait, à la date où il l'a fait.** Le module **À faire**
liste ce qui attend une décision de lui, et **la liste raccourcit sous le
doigt** — « c'est fait » comme « pas pour moi ». Pas d'écran de félicitations,
pas de barre de complétion, pas d'animation : **on ne fête que le mesuré**, à
l'arrivée d'un Verdict `better`. La date de réalisation est **libre**, bornée
seulement par *décidé ≤ fait ≤ aujourd'hui*.

**La semaine suivante, le Verdict tombe sur le bon périmètre.** Un seul moteur
le rend — le rail, qui mesure sur le **thème** —, et le moteur concurrent plus
vieux qui mesurait sur le compte entier **meurt**. Le bilan compte-entier devient
un simple comptage des Verdicts déjà persistés.

**Et il ne déclenche plus rien.** Ce qui se **récolte** ou se **rédige** attend
son Jour de travail ; ce qui se **regroupe** se recalcule à la lecture, tout de
suite. Les quatre boutons sortent de l'app ; l'afficheur de progression de
récolte, lui, **reste** — une première récolte Instagram de seize minutes
réussit, elle se dit longue, jamais cassée.

**Le juge est David, sur son compte, sur de vraies données** — *« c'est moi qui
valide avec mon intuition, backé par ton expertise »*.

---

## User Stories

### Le premier écran, et la fraîcheur

1. En tant que **Propriétaire** qui revient, je veux voir en premier le
   **Verdict** de ce que j'ai fait la semaine dernière, afin de savoir tout de
   suite si mon travail a servi.
2. En tant que Propriétaire, je veux voir le bilan de mon **Carnet** juste après
   le Verdict, afin de mesurer ce que j'ai accumulé avant qu'on me propose quoi
   que ce soit de neuf.
3. En tant que Propriétaire, je veux le rail des chantiers en cours en troisième
   position, afin de voir le temps qui passe sur ce qui est déjà lancé.
4. En tant que Propriétaire, je veux que le résumé rédigé par l'IA arrive
   **replié**, afin que la partie la moins vérifiable de la page n'occupe pas
   les pixels les plus chers.
5. En tant que Propriétaire, je veux lire en tête du rapport **de quand à quand
   il mesure**, afin de ne pas attribuer à cette semaine un chiffre d'une autre.
6. En tant que Propriétaire, je veux lire **quand il a été publié** et **quand
   il a été mis à jour**, afin de comprendre pourquoi un chiffre a bougé depuis
   ma dernière visite sans qu'on me dise que mon rapport est périmé.
7. En tant que Propriétaire, je veux qu'une republication ne crée **jamais une
   deuxième ligne** pour la même semaine mesurée, afin de ne pas avoir deux
   vérités pour une seule semaine.

### Le Point de vue de la semaine

8. En tant que Propriétaire qui n'a **jamais classé**, je veux quand même
   recevoir le **Point de vue de la semaine** — ce qui a bougé sur mes campagnes
   et mes publications —, afin que Pulse me serve dès la première semaine.
9. En tant que Propriétaire qui n'a jamais classé, je veux voir les modules par
   thème **visibles et verrouillés** avec écrit dessus ce qu'ils débloquent,
   afin de comprendre ce que le classement m'apporterait au lieu de regarder un
   écran vide.
10. En tant que Propriétaire qui n'a jamais classé, je veux **ne recevoir aucun
    conseil** plutôt qu'un conseil générique, afin de ne pas recevoir de Pulse
    ce que Google et Meta me donnent déjà gratuitement dans l'écran du clic.
11. En tant que Propriétaire, je veux que le Point de vue mélange **campagnes et
    publications, payant et organique**, afin d'avoir en un endroit ce qu'aucun
    outil mono-régie ne me donne.

### Les conseils

12. En tant que Propriétaire, je veux des conseils **uniquement sur les thèmes
    que j'ai étoilés**, afin que Pulse conseille là où je travaille au lieu de
    choisir le sujet à ma place.
13. En tant que Propriétaire, je veux que les conseils des thèmes non étoilés
    **disparaissent** au lieu de sortir plus bas dans la liste, afin que mon
    étoile veuille dire quelque chose.
14. En tant que Propriétaire, je veux **cinq conseils au maximum** par semaine
    sur tout mon compte, afin de recevoir une liste que je peux finir.
15. En tant que Propriétaire, je veux qu'une semaine calme me donne **deux
    conseils** plutôt que cinq complétés avec du remplissage, afin de pouvoir
    faire confiance à la liste quand elle est longue.
16. En tant que Propriétaire sans **aucun thème prioritaire**, je veux un module
    **verrouillé** qui me dit « désigne un thème prioritaire pour recevoir des
    conseils », afin de savoir quoi faire au lieu de croire que Pulse n'a rien
    trouvé.
17. En tant que Propriétaire **sans Instagram**, je veux recevoir autant de
    conseils qu'un compte qui en a un, afin que mon abonnement ne dépende pas
    d'un canal que je n'utilise pas.
18. En tant que Propriétaire, je veux qu'un conseil me dise qu'une **Annonce**
    dépense sans vendre pendant que sa voisine vend, afin d'agir sur l'unité où
    la différence se voit.
19. En tant que Propriétaire, je veux qu'un conseil compare un **Groupe
    d'annonces** à un autre dans le même thème, afin de déplacer mon budget vers
    ce qui marche.
20. En tant que Propriétaire, je veux qu'un conseil me prévienne quand un thème
    va **dépasser le budget** que j'ai prévu, afin de corriger avant la fin du
    mois.
21. En tant que Propriétaire, je veux que **chaque conseil porte un Geste**
    — couper, augmenter, tester, créer, corriger —, afin de ne jamais lire un
    constat déguisé en conseil.
22. En tant que Propriétaire, je veux que la liste des cinq contienne **une à
    deux Marches d'une Stratégie** et le reste en retouches à faible effort,
    afin d'avancer sur une suite cohérente sans que ma semaine soit mangée.
23. En tant que Propriétaire, je veux **jamais plus de deux conseils lourds**
    (créer ou corriger à une heure et plus), afin que la liste reste faisable
    dans le temps que j'ai.
24. En tant que Propriétaire qui a répondu « **trop compliqué** » à un conseil,
    je veux qu'on m'en propose une version plus simple, afin que mon refus serve
    à quelque chose.
25. En tant que Propriétaire qui **ne répond rien** à un conseil, je veux qu'il
    soit mis en veille sans qu'on m'attribue une intention, afin que mon silence
    ne soit pas lu comme un avis.
26. En tant que Propriétaire, je veux qu'un même conseil ne revienne **jamais à
    l'identique** — la clé plus la cible —, afin de ne pas lire deux fois la
    même phrase avec le même chiffre.
27. En tant que Propriétaire, je veux que Pulse **ne m'invente jamais une
    piste** : un conseil s'appuie sur un chiffre qu'il a mesuré, ou il n'existe
    pas.
28. En tant que Propriétaire, je veux que la **Marche suivante** d'une Stratégie
    soit rédigée à partir de la Stratégie ouverte par une règle, jamais à partir
    d'une idée sortie de nulle part.
29. En tant que Propriétaire, je veux qu'« **ce qui marche chez toi** » soit
    calculé une seule fois, afin que deux écrans de Pulse ne me disent jamais le
    contraire l'un de l'autre.
30. En tant que Propriétaire, je veux voir à l'écran les constats que la page de
    classement me promet, afin qu'une promesse de Pulse débouche sur quelque
    chose.

### La porte vers la plateforme

31. En tant que Propriétaire qui se sert de l'hebdo comme travail prémâché, je
    veux **partir de la carte d'un thème vers la page de sa plateforme**, afin
    de creuser moi-même sans perdre le fil.
32. En tant que Propriétaire, je veux que le lien emporte **le thème ET la
    fenêtre** du rapport, afin de retrouver le même chiffre que celui sur lequel
    j'ai cliqué.
33. En tant que Propriétaire arrivé sur une page plateforme, je veux qu'elle me
    dise **d'où je viens** et me propose d'y retourner, afin de ne pas devoir
    refaire le chemin à la main.
34. En tant que Propriétaire, je veux **filtrer Instagram par thème** comme je
    filtre déjà Meta et Google, afin que les trois pages parlent la même langue.
35. En tant que Propriétaire, je veux qu'un lien change **ce qu'il change** et
    garde le reste, afin de ne pas perdre mes autres filtres en changeant de
    page.

### Le module « À faire » et la date libre

36. En tant que Propriétaire, je veux un module qui liste **ce qui attend une
    décision de moi**, distinct du rail qui montre le temps qui passe, afin de
    savoir où cliquer.
37. En tant que Propriétaire, je veux que la liste **raccourcisse à chaque
    décision**, « fait » comme « pas pour moi », afin que ma récompense soit la
    liste qui se vide.
38. En tant que Propriétaire, je veux **aucune animation, aucune barre de
    complétion, aucun écran de félicitations**, afin que Pulse ne me félicite
    jamais d'avoir simplement cliqué.
39. En tant que Propriétaire qui a fait le changement **mardi** et clique
    **vendredi**, je veux pouvoir choisir la date du mardi, afin que la mesure
    parte du bon jour.
40. En tant que Propriétaire, je veux que la date choisie soit bornée par
    *décidé ≤ fait ≤ aujourd'hui* et **sans plafond en jours**, afin de pouvoir
    rattraper un oubli de trois semaines.
41. En tant que Propriétaire, je veux pouvoir ouvrir **plus de trois actions à
    la fois**, afin que le refus ne soit pas ma seule sortie quand j'ai reçu
    cinq conseils.
42. En tant que Propriétaire, je veux **refuser sans donner de raison**, afin de
    ne pas être interrogé pour dire non.
43. En tant que Propriétaire, je veux que **les conseils ne s'empilent jamais**
    et que **les Verdicts s'empilent toujours**, afin de distinguer une
    proposition de Pulse du résultat de mon travail.
44. En tant que Propriétaire, je veux voir **les Verdicts en premier** dans le
    rail, afin de lire le résultat avant la proposition.
45. En tant que Propriétaire, je veux écrire moi-même une tâche dans le module,
    afin d'y mettre ce que Pulse n'a pas vu — et qu'elle entre **sans Verdict**.
46. En tant que Propriétaire, je veux que le module **disparaisse** quand il est
    vide et qu'il n'a plus rien à me faire découvrir, afin de ne pas garder un
    cadre vide à l'écran.
47. En tant que Propriétaire qui n'a jamais utilisé un geste, je veux **un seul
    conseil d'usage à la fois**, dans le module vide, éteint pour toujours par
    mon premier usage — jamais par le temps.

### Le Carnet et la mémoire

48. En tant que Propriétaire, je veux retrouver **tout ce que j'ai fait pour une
    campagne**, afin de rendre compte de mon travail sans le réécrire.
49. En tant que Propriétaire, je veux un Carnet **posé partout** dans l'app et
    pas seulement sur une page, afin d'écrire au moment où je constate.
50. En tant que **Membre** invité, je veux que **ma** Note porte mon nom, afin
    qu'on sache qui a écrit quoi.
51. En tant que Membre, je veux que **personne d'autre ne puisse effacer ma
    Note**, tout en la laissant visible de tous, afin que la mémoire de
    l'entreprise ne dépende pas d'un clic malheureux.
52. En tant que Propriétaire, je veux que **ma Note ne reçoive aucun Verdict**,
    afin que Pulse ne choisisse pas à ma place le chiffre sur lequel me juger :
    **Pulse marque, je juge.**
53. En tant que Propriétaire, je veux qu'une Note entre dans la mémoire du thème
    **sans peser sur le tri des conseils**, afin que du narratif ne devienne
    jamais du mesuré.
54. En tant que Propriétaire, je veux que Pulse **ne rouvre aucune semaine
    passée**, afin de n'avoir jamais deux vérités à l'écran.

### Le Verdict et la justesse des chiffres

55. En tant que Propriétaire, je veux que le **Verdict** d'une action soit rendu
    par **un seul moteur**, sur le **thème** de l'action, afin qu'un second
    moteur plus vieux ne le contredise pas sur le compte entier.
56. En tant que Propriétaire d'un thème qui tourne sur **Meta et Google**, je
    veux un ROAS dont le revenu et la dépense couvrent **le même périmètre**,
    afin que ni mon chiffre ni le Verdict qui en découle ne soient gonflés.
57. En tant que Propriétaire, je veux qu'un **Verdict déjà rendu ne soit jamais
    recalculé**, afin qu'il continue de juger l'action sur le périmètre qui
    existait alors.
58. En tant que Propriétaire, je veux que **deux Annonces au même nom restent
    deux Annonces**, afin que la dépense de la seconde entre bien dans mes
    chiffres.
59. En tant que Propriétaire, je veux que la récolte **finisse en erreur**
    plutôt que de réussir sans Meta, afin qu'une semaine de dépense manquante ne
    se lise pas comme une baisse.
60. En tant que **Membre** d'un compte à deux, je veux que **le premier Verdict
    tienne** et que le second me dise « déjà marquée faite », afin que mon clic
    n'écrase pas silencieusement celui de mon collègue.
61. En tant que Propriétaire, je veux que Pulse me dise « enregistré »
    **seulement quand il a écrit**, afin qu'un refus silencieux ne passe pas
    pour un succès.

### Le rythme : ce qui se regroupe, ce qui attend

62. En tant que Propriétaire qui classe une campagne, je veux que **les chiffres
    regroupés par thème soient à jour à l'écran suivant**, partout et sans rien
    déclencher, afin que mon classement serve tout de suite.
63. En tant que Propriétaire qui classe une campagne, je veux que **la courbe
    d'un thème et ses records se recomposent sur tout l'historique**, afin que
    le classement soit bien rétroactif comme on me l'a promis.
64. En tant que Propriétaire, je veux que les **conseils, les priorités,
    l'objectif et les catégories de conversions** attendent mon **Jour de
    travail**, avec un message qui le date, afin de ne pas recevoir un rapport
    différent à chaque rechargement.
65. En tant que Propriétaire, je veux **aucun bandeau « mise à jour en cours »**
    et **aucune mention d'âge par carte**, afin que trois dates en tête du
    rapport suffisent.
66. En tant que Propriétaire, je veux que **les quatre boutons de déclenchement
    sortent de l'app**, afin de ne pas pouvoir casser mon propre rythme.
67. En tant que Propriétaire dont la première récolte Instagram dure seize
    minutes, je veux **garder l'afficheur de progression**, afin de ne pas
    rester devant un écran muet un quart d'heure.
68. En tant que Propriétaire qui branche une source **en milieu de semaine**, je
    veux que la récolte parte tout de suite et que le rapport l'intègre le jour
    dit, afin de ne pas perdre une semaine.
69. En tant que Propriétaire, je veux que Pulse ne me dise **jamais** que mon
    rapport est périmé, afin qu'on ne confonde pas « vieux » et « faux ».

### David, juge de la v1

70. En tant que David, je veux parcourir **une fois le fil en entier** sur mon
    compte et sur de vraies données, afin de juger si le produit tient.
71. En tant que David, je veux qu'une décision déjà tranchée par la refonte soit
    **bâtie et non re-litigée**, afin que la construction n'annule pas le
    travail de cadrage.
72. En tant que David, je veux qu'un ticket qui trouve **une prémisse fausse**
    me la remonte au lieu de trancher en silence, afin de garder la main sur ce
    qui change.
73. En tant que David, je veux qu'un ticket touchant à **la forme** d'un module
    me propose des **variantes comparables** sur une vraie page, afin de choisir
    au lieu de lire une description.

---

## Implementation Decisions

### Le partage du travail : quinze tickets, une carte

La v1 se bâtit par les quinze tickets de [`map.md`](map.md), **tous de type
`task`** — cette carte exécute, elle ne décide pas. Chaque ticket pointe le
ticket de la refonte qui l'a tranché. Les arêtes de blocage sont posées autant
pour la logique que pour la contrainte maison *« jamais deux agents sur les mêmes
fichiers »* : le module de construction du rapport, le moteur de règles et le
dossier de migrations sont les trois goulots.

### Les réparations qui passent avant tout

- **Le ROAS d'un thème** : le numérateur et le dénominateur doivent couvrir le
  même périmètre de régies. **Ce n'est pas forcément « ajouter Google au
  dénominateur »** — le ROAS par canal est une **règle d'attribution à choisir**,
  pas une donnée manquante, depuis que les insights GA4 portent la campagne. Si
  les deux lectures se défendent, la question monte à David. Correction du calcul
  **sans rejouer l'historique** : un Verdict déjà rendu ne se recalcule pas.
- **L'identité d'une Annonce** est son identifiant de régie, **jamais son nom**
  (`CONTEXT.md`). La migration écrite pour ça est un **piège armé** : son
  `DROP CONSTRAINT` retire la clé que l'upsert désigne encore. Elle **s'ouvre
  avant tout geste**, le `DROP` **se fait valider explicitement par David**, et
  le rejeu de l'historique passe par une **date forcée, jamais par un `DELETE`**
  — l'upsert efface désormais les lignes sans identifiant des dates qu'il
  réécrit, donc la table n'est jamais vide.
- **Le drapeau de rejeu ne touche que Meta.** Un rejeu global fabriquerait la
  panne connue : Google Ads rejette une requête d'événements de changement
  au-delà de trente jours, en entier, au lieu de la tronquer.
- **La récolte finit rouge** si la colonne d'identifiant manque. Une run verte
  sans Meta est une semaine de dépense que le rapport lirait comme une baisse.

### Le seul endroit où le regroupement est implémenté

- **Une vue SQL en `security_invoker`** porte le regroupement par thème. C'est le
  seul endroit où Python et TypeScript partagent **une** implémentation au lieu
  d'en entretenir deux qui dérivent — le défaut à trois moteurs, en pire.
- **La vue ne couvre que les thèmes.** Formats, créneaux, campagnes et couverture
  n'alimentent que des constats rédigés, qui attendent le Jour de travail.
- **Le seuil de dépense minimale d'un thème descend dans la vue**, qui expose un
  ROAS déjà filtré et un drapeau disant si le thème est jugeable ; la constante
  équivalente disparaît de Python.
- **La pagination est obligatoire**, pas optionnelle : PostgREST plafonne à
  1 000 lignes et tronque en silence.
- **Le pansement « max de deux sources » pour le revenu d'un thème meurt.** Sans
  réponse de la vue, **pas de revenu — et on le dit**. Pas de zéro, pas
  d'estimation.
- **Deux limites tiennent** : le jugement rédigé d'un thème attend le Jour de
  travail **en entier** (son chiffre et sa phrase sont le même objet, et il
  réordonne les conseils), et un Verdict déjà rendu ne se recalcule pas.

### Le schéma : une migration, deux colonnes

- **Une seule migration**, réclamée par trois tickets : un **auteur** sur les
  actions suivies, et une **campagne**.
- L'auteur est posé **à la création, jamais réécrit, sans aucun backfill** —
  inscrire le Propriétaire sur les lignes existantes serait un chiffre fabriqué.
  Une politique RLS ne voyant que la ligne d'arrivée, l'immutabilité demande un
  **déclencheur qui compare l'ancienne et la nouvelle valeur**, pas une
  politique.
- **Le Verdict n'a pas d'auteur** (ADR 0004) : le prix est écrit et accepté — on
  ne saura jamais qui a jugé quoi. **Ne pas ajouter de colonne d'auteur au
  Verdict pour « améliorer » ça.**
- **Aucune table neuve** : une Note reste une action suivie d'un certain genre.
  Aucun objet neuf n'entre dans le schéma pour la v1, et une **Stratégie n'est
  pas un objet en base** — zéro table, zéro migration.
- Le partage entre personnes d'un compte **existe déjà et fonctionne** : la
  migration annoncée par un ticket antérieur n'a jamais été nécessaire, et
  l'identifiant porté par ces lignes est **le compte, pas la personne** — donc
  aucune ligne à ré-attribuer.
- Le fichier de migration unique doit rester **rejouable sans risque**. Aucun
  `DROP`, `DELETE` ou `TRUNCATE` sans le signaler et le faire valider.

### Le moteur de conseils

- **Filtre dur, pas tri.** Les conseils des thèmes non prioritaires
  **disparaissent** du rapport. C'est l'ADR 0003 rendu exécutable.
- **Cinq par semaine sur tout le compte, en plafond.** On ne complète pas avec du
  non-prioritaire. Le plafond de trois conseils par thème reste, et il est
  **assumé** : un compte à un seul thème prioritaire plafonne à trois.
- **Zéro priorité = module verrouillé**, jamais un module vide. Le module
  verrouillé parle de ce qui manque **en base** ; le module « À faire » parle,
  dans son état bloqué, de ce qui manque **à ta décision**. Ce sont deux phrases
  différentes portées par deux modules différents.
- **Le chemin compte-entier déterministe reste en place et n'est pas
  rebranché** — délibérément. Ne pas le « réparer ».
- **Le plan de thème se rebranche sans l'IA qui l'alimentait.** Sur les cinq
  colonnes à donner à une règle — durée · levier · indicateur · geste · preuve —
  **trois sont déjà écrites** dans le code, et une table de correspondance en
  duplique une autre valeur pour valeur : le ticket **retire** des lignes au lieu
  d'en ajouter.
- **Une table par clé pour le geste et la preuve, mais c'est la RÈGLE qui
  déclare** : une même clé écrit plusieurs gestes selon le chiffre du jour, et
  découper cette clé **effacerait l'historique des retours**.
- **Pas de sixième geste « vérifier »**, d'où le critère d'entrée d'une règle :
  **un conseil sans Geste est un constat**.
- **La composition des cinq** : une à deux Marches d'une Stratégie, le reste en
  retouches à faible effort et fort enjeu. **Un plafond, pas un plancher** —
  jamais plus de deux gestes lourds. Un plancher qu'on ne peut pas tenir se
  remplit de décor.
- **Le moteur trie, l'IA explique.** Le signal « trop compliqué », collecté
  depuis toujours et jamais lu, est **raccordé** — c'est un argument à brancher,
  pas un champ à créer. Le persona garde le ton, **jamais le tri**. Gemini écrit
  **seulement la Marche suivante** d'une Stratégie déjà ouverte par une règle, en
  listes fermées, sur un objet présent dans les faits.
- **L'empreinte d'un conseil est sa clé plus sa cible.** Le même conseil revient
  avec un autre chiffre, jamais à l'identique. Décision renversée par David en
  faveur du maintien de la clé : ne pas re-proposer de l'en sortir.
- **Le résultat attendu ne s'affiche jamais** : il pondère le tri en interne.
- **Plus rien n'entre au Carnet sans un clic.** L'entrée automatique meurt : un
  Verdict sur un geste que personne n'a confirmé attribue un mouvement de
  chiffres à une action qui n'a peut-être jamais eu lieu. Le plan de thème reste
  écrit à la publication — c'est la mémoire de Pulse, pas le Carnet du client —
  et **l'échéance du Verdict part du clic**.

### Les dix règles neuves, en deux vagues

Le gisement que personne n'avait ouvert : **le détail Annonce par Annonce est
récolté chaque jour, Meta et Google, et aucune règle ne le lit.** À l'échelle
d'un thème, l'unité de comparaison devient l'**Annonce** et le **Groupe
d'annonces**.

**Quatre d'abord**, parce qu'elles n'ont **aucun seuil inventé** (tous sortent
des seuils existants), couvrent cinq Gestes et cinq Leviers, et demandent **zéro
migration** : l'annonce qui dépense sans convertir (couper · contenu),
l'annonce locomotive (augmenter · argent), l'annonce chère au clic (couper ·
argent), le thème qui va dépasser son budget (corriger · argent).

**Six ensuite** : groupe d'annonces inégal, thème qui rend mieux sur une régie
que sur l'autre, budget posé non dépensé, annonce usée, page d'arrivée muette,
créneau publicitaire cher. Deux d'entre elles ouvrent une **Stratégie**, donc
elles dépendent du plan de thème rebranché.

Garde-fous posés par David :

- **La gratuité d'un conseil chez la régie n'est plus un motif de refus** — la
  valeur est qu'un seul endroit rassemble tout, et que Pulse n'a rien à vendre là
  où l'Opportunity Score pousse à dépenser plus. L'ADR 0003 est **intact**, sa
  justification est réécrite.
- **Le geste « couper » survit**, mais jamais sur une campagne **jeune** ni sur
  une **part de budget** : rien en base ne dit qu'une campagne est un test.
  Seulement sur un résultat mesuré.
- **Les conseils vivent dans l'hebdo, jamais sur les pages plateforme.**
- **Le filtre qui refusait les conseils croisant deux régies meurt
  entièrement**, règles et IA.
- **L'alerte budget est un constat, pas un conseil** — accepté par David.
- **Deux pièges nommés d'avance** : la règle d'annonce usée repose sur une
  audience **dédoublonnée**, qui ne se somme pas ; et la règle de page d'arrivée
  **nomme un écart, pas une page** — aucune dimension de page n'est récoltée, et
  l'écrire quand même serait un chiffre fabriqué.

### Un seul moteur pour « ce qui marche chez toi »

Trois moteurs concurrents, deux langages, trois jeux de seuils. **Le moteur
déterministe qui lit tout l'historique gagne** ; les deux règles à fenêtre courte
du moteur de conseils et le recalcul TypeScript de la page Instagram **meurent**.
Le gagnant remplit du même coup le rang « ce qui marche pour toi » sur les trois
plateformes, **sans un calcul nouveau**. Les constats promis au client sur la
page de classement, aujourd'hui rendus nulle part, **se raccordent**.

Conflit à connaître : la décision d'arrêter tout conseil mono-régie a été
**partiellement renversée** par la décision plus récente sur les conseils
payants — deux règles coupées pour ce seul motif sont **réhabilitées**. La plus
récente gagne, **mais le ticket l'écrit** au lieu de trancher en silence.

### Le module « À faire » et la date libre

- **Le module liste ce qui attend une décision de toi ; le rail montre le temps
  qui passe.** C'est la seule frontière qui empêche un quatrième objet de
  contredire les trois qui montrent déjà les mêmes actions.
- **La ligne, pas la carte** : le conseil est expliqué sur son thème, **expédié**
  dans le module. Posé **après** le bilan du Carnet.
- **La date de réalisation est libre**, bornée par *décidé ≤ fait ≤ aujourd'hui*,
  **sans plafond en jours**. Le patron existe déjà dans l'écriture d'une Note.
  Fait mesuré qui autorise cette liberté : la baseline est prise à la **décision**
  et non au « fait » — **antidater ne fausse aucune mesure**, ça avance seulement
  le Verdict.
- **Le plafond de trois actions ouvertes meurt.** Il était écrit nulle part et
  forçait le refus ; la composition des cinq borne déjà la charge.
- **Aucune raison demandée sur un refus** — « trop compliqué » est déjà la sortie
  non pénalisante.
- **Les conseils ne s'empilent jamais, les Verdicts s'empilent toujours.** Les
  Verdicts d'abord dans le rail.
- **Une tâche écrite par le client entre sans Verdict**, comme une Note naissant
  en cours — aucun objet neuf.
- **Le module disparaît quand il est vide ET n'a plus rien à faire découvrir.**
  Le conseil d'usage ne vit que dans le module vide, **un seul à la fois**,
  éteint **pour toujours par le premier usage du geste** — jamais par le temps.
- **Aucune barre de complétion, aucune animation, aucun écran de félicitations.**
  Refusées deux fois : une barre de progression peut *réduire* la complétion, et
  elle félicite d'avoir cliqué. **On ne fête que le mesuré**, à l'arrivée d'un
  Verdict positif.

### Le Carnet, et la mort du moteur concurrent

- **Le moteur de preuve compte-entier meurt.** Le bilan compte-entier devient un
  **comptage** des Verdicts déjà persistés.
- **La mémoire est le fil continu, pas l'archive rejouée** : aucune semaine
  passée ne se rouvre. Le fait qu'un seul rapport soit lu est **voulu**, pas un
  défaut.
- **Le Carnet se relit déjà** — il a été fusionné exprès dans la carte du thème
  pour éviter 900 px entre un conseil et son effet, et **le rail porte le cycle
  de vie complet avec l'effet chiffré. Ne pas le défaire.**
- **Une Note du client ne reçoit aucun Verdict** : juger la Note obligerait Pulse
  à choisir le chiffre à sa place, donc à inventer une intention. **Pulse marque,
  le client juge.**
- **Une Note entre dans la mémoire du thème, jamais dans le repondérage** —
  narratif ≠ mesuré.
- **Une Note ne s'efface que par son auteur**, mais **tout le monde les voit**.
- **Piège d'août à ne pas rejouer** : les marques sur une courbe ont existé et
  David les a fait retirer — points noirs parasites sur la série. Les propriétés
  correspondantes vivent encore et ne dessinent plus rien. Marquer, oui ; salir
  la courbe, non — et si ce chantier rallume des marques, **c'est en variantes
  comparables**, pas en décision d'agent.

### L'écriture, et la garde de collision

- Tout `update` d'une action suivie devient **conditionnel au statut de départ**
  et **compte les lignes touchées**. Zéro ligne = collision, pas succès. C'est le
  piège maison en vrai : un refus RLS sur un `update` ne lève rien.
- **Le premier Verdict tient.** Le message de collision dit **« déjà marquée
  faite » sans nommer personne** — conséquence directe de l'ADR 0004. **Ne pas
  nommer quelqu'un pour améliorer le message.**
- Le même défaut se cherche **sur les actions voisines** : toute écriture qui ne
  lit pas son compte de lignes porte le même piège.
- Les deux rôles « Peut agir » / « Lecture seule » existent déjà, appliqués à
  **deux étages** — écran *et* RLS. **Rien à construire.**
- Les conseils sont écrits **pour le Propriétaire**, et on l'écrit quand un
  Membre regarde le compte d'un autre.

### La porte vers la plateforme

- **Rien à construire côté données** : l'objet campagne d'un thème porte déjà son
  canal et sa clé, et le thème est déjà un paramètre reconnu des pages
  plateforme.
- **La porte part de la carte du thème, et d'elle seule** : un chiffre du point
  général ne désigne aucune plateforme, le lien serait vague.
- **Le lien emporte le thème ET la fenêtre du rapport.**
- **On ne ramène rien**, mais la page dit d'où on vient et propose d'y retourner.
- **Instagram devient filtrable par thème** — le composant existe, **il manque le
  paramètre**. Sans ça, le rang qui parle la même langue sur les trois pages ne
  tient pas.
- **Un lien énumère ce qu'il CHANGE, jamais ce qu'il garde**, sinon il perd par
  construction tout paramètre ajouté après lui **en produisant une URL valide**.
  L'utilitaire de liens existe pour ça, et la neutralisation des pastilles
  inertes y est déjà couverte : **ne pas la réécrire**.
- **Le vocabulaire d'URL unifié appartient au bandeau de commandes, hors
  périmètre.** Ici on ouvre une porte avec le paramètre existant et la fenêtre,
  rien de plus.

### Le premier écran et les trois dates

- **Ordre imposé** : Verdict → bilan du Carnet → rail des chantiers en cours →
  résumé IA **replié**.
- Le fil de démarrage est aujourd'hui rendu **en bas de page**, sous deux écrans
  de défilement : à corriger dans le même passage.
- **Trois dates en tête du rapport** : *mesuré du X au X · publié le X · mis à
  jour le X*. La dernière **existe en base et n'est jamais lue**. Toute la clarté
  du décalage entre deux Jours de travail tient dans ces trois dates et **dans
  rien d'autre**.
- **Refusés deux fois, ne se re-proposent pas** : un bandeau « mise à jour en
  cours », une mention d'âge par carte, et tout libellé déclarant un rapport
  « périmé ».
- **Défaut de publication à réparer ici** : republier dans une autre semaine
  calendaire crée une **deuxième ligne**, parce que la semaine est dérivée du
  jour de fabrication et non de la fenêtre mesurée.
- **Piège de fichiers** : une constante exportée depuis un module client devient
  une référence client côté serveur — la valeur lue est un proxy, **rien ne lève,
  TS passe**. Les valeurs partagées vivent dans un module sans directive.

### Le rythme, et la sortie des quatre boutons

- **Règle de fond** : **ce qui se REGROUPE se recalcule à la lecture, tout de
  suite, partout ; ce qui se RÉCOLTE ou se RÉDIGE attend le Jour de travail.**
- **Les quatre boutons de déclenchement sortent de l'app.** Le déclenchement vit
  dans GitHub Actions, et un prototype porte son propre bouton quand on travaille
  un sujet. **Aucun bouton de test dans l'app.**
- **L'afficheur de progression de récolte RESTE.** C'est le piège du ticket : on
  tue le **déclencheur**, pas l'**afficheur**. Une première récolte Instagram de
  seize minutes réussit — elle se dit longue, jamais cassée ; retirer l'afficheur
  laisserait un client devant un écran muet un quart d'heure.
- **Une source branchée en milieu de semaine récolte tout de suite** et entre au
  rapport le jour dit, **sans infrastructure neuve** — le cron tourne déjà tous
  les matins.
- **Raison corrigée, décision inchangée** : « recharger mes conseils » ne
  déplaçait aucun écart, la fenêtre étant ancrée sur **la dernière donnée** et
  non sur le jour de fabrication. Seul le bouton de récolte bougeait l'ancre.
- **Trois défauts mesurés à réparer ou à ticketer** : la page des coûts n'est
  jamais rafraîchie par un classement ; l'étiquetage d'une publication ne
  rafraîchit pas le rapport ; et l'invalidation appelée après l'étiquetage d'une
  campagne est un **no-op documenté comme s'il marchait** — ce dernier se referme
  avec la vue SQL, pas ici.
- **`CLAUDE.md` §9 se met à jour dans le même passage** que le retrait des
  boutons, sinon la consigne survit à son objet.

### Le vocabulaire, mis à jour dans le même passage

`CONTEXT.md` n'est pas une tâche de fin de chantier : chaque ticket qui gagne ou
corrige un mot le fait **dans son propre passage**, pas « plus tard ». Les mots
concernés par la v1 : **Geste** (nouveau), **À faire** (nouveau), **Action
suivie** (perd son plafond de trois, précise que son statut n'a pas d'auteur),
**Note** (gagne son auteur, peut naître avant le fait), **Hypothèse** et
**Verdict** (corrigés par la fin de l'entrée automatique), **Rappel** (perd
« jamais de retard »).

---

## Testing Decisions

### L'état réel du dépôt, à ne pas maquiller

**Il n'existe aujourd'hui aucune suite de tests automatisés** — aucun fichier de
test hors `.venv/`, et **aucun runner de test dans `saas/web`**. `pytest` est
présent dans l'environnement virtuel et n'a jamais servi. Il n'y a donc pas de
prior art à imiter dans ce dépôt : le seul précédent est la spec
[`../theme-memoire/spec.md`](../theme-memoire/spec.md), qui a fait le même constat
et a livré sans suite.

La vérification en vigueur reste celle de `CLAUDE.md` §9, et elle ne se remplace
pas :

- `saas/web` : `rm -rf .next tsconfig.tsbuildinfo`, puis `npx tsc --noEmit` **et**
  `npm run build` verts, **19 routes** — un écart signale une page de contrôle
  oubliée ;
- Python : `python3.12 -m py_compile` sur ce qui a été touché. **`python3.12`,
  jamais `python3`** ;
- ce qui n'a pas pu être vérifié **se dit franchement**. Pas de vérification
  supposée, pas de résultat prédit.

### Le seam, choisi par David : le payload du rapport

**Un seul seam, au point le plus haut** : le **payload du rapport hebdomadaire**
— la structure que le worker produit et persiste, et que le web se contente de
lire (le web ne calcule jamais ; il déclenche un workflow et lit la table des
rapports).

C'est le bon seam pour trois raisons :

1. **Tout ce que la v1 calcule y passe** : le filtre dur sur les thèmes
   prioritaires, le plafond de cinq, la composition, le ROAS réparé, les trois
   dates, l'état verrouillé du module, les dix règles neuves.
2. **C'est le seam existant, pas un seam neuf.** La frontière entre le worker et
   le web est déjà cette structure ; on n'en invente aucune.
3. **Il autorise enfin le découpage.** Le docstring de la fonction de
   construction le dit lui-même : *« pas de découpage sûr sans tests de
   non-régression »*. Un test au niveau du payload est exactement ce qui lève
   cette interdiction.

**Ce qu'il faut construire pour l'atteindre** : la fonction de construction prend
aujourd'hui un client Supabase vivant et va chercher ses données elle-même. Le
seul geste de structure de cette spec est donc **d'injecter le lecteur** — de
faire entrer par paramètre ce qu'elle importe aujourd'hui — afin qu'un faux
lecteur gréé sur des lignes fixes puisse la faire tourner hors ligne. **Aucun
découpage des trois mille lignes n'est demandé ici** : on rend la fonction
appelable, on ne la réécrit pas.

Sous ce seam, **la couche de règles est déjà pure** — elle prend des DataFrames
et ne fait aucune I/O. Elle se teste sans rien construire, et c'est là que les
dix règles neuves se vérifient une par une.

**Aucun runner de test n'entre dans `saas/web`.** Décision de David : le web
reste vérifié par `tsc`, `npm run build`, le compte de routes, et le fil parcouru
à la main. Conséquence assumée et à écrire dans les tickets concernés : **la
garde de collision et la date libre ne seront couvertes par aucun test
automatisé** — elles se vérifient à la main, et le rapport de vérification le dit.

### Ce qu'un bon test vérifie ici

Du **comportement externe** — ce que le payload contient —, jamais un détail
d'implémentation. Aucun test ne doit connaître le nom d'une fonction interne, un
ordre de section, ou le nombre de lignes d'un module. Les propriétés qui valent
la peine :

- un compte avec **des thèmes prioritaires et des thèmes classés non étoilés**
  produit un payload où **aucun conseil ne porte un thème non étoilé** — c'est
  l'ADR 0003 rendu vérifiable, et c'est le test le plus important de la v1 ;
- un compte avec beaucoup de thèmes prioritaires produit **au plus cinq**
  conseils ;
- un compte calme produit **moins de cinq** conseils et **aucun remplissage** :
  le plafond n'est pas un quota ;
- un compte **sans aucun thème prioritaire** produit un payload qui porte le
  **Point de vue de la semaine** et **zéro conseil**, avec l'état verrouillé du
  module — pas une absence de module ;
- la liste des cinq ne contient **jamais plus de deux gestes lourds** ;
- un thème dont la dépense tourne sur **deux régies** produit un ROAS dont le
  numérateur et le dénominateur couvrent le même périmètre — la propriété qui
  protège « aucun chiffre fabriqué » ;
- un thème **sans revenu confirmé** ne porte **aucun revenu** dans le payload :
  ni zéro, ni estimation ;
- deux **Annonces homonymes** dans les lignes d'entrée produisent **deux**
  Annonces dans les comparaisons, pas une ;
- un payload porte **les trois dates**, et la semaine qu'il déclare est dérivée
  de **la fenêtre mesurée**, pas du jour de fabrication — rejouer la construction
  un jour de semaine différent ne change pas la semaine déclarée ;
- le même conseil rendu deux semaines de suite sur la **même cible** avec le
  **même chiffre** ne réapparaît pas ; avec un chiffre différent, il réapparaît ;
- un faux appel IA qui rend `None` **ne casse pas le payload** : le rapport ne
  casse jamais sur une règle qui plante, c'est déjà la règle du moteur ;
- aucun nombre présent dans le payload n'est **absent des lignes d'entrée** —
  c'est la propriété qui protège `CLAUDE.md` §7, et elle est vérifiable par
  simple inspection.

### La vérification manuelle attendue, à faire et à rapporter

Elle n'est **pas** remplaçable par les tests, et c'est elle qui clôt la carte :
**David parcourt le fil une fois en entier**, sur son compte, sur de vraies
données — du premier écran au Verdict de la semaine suivante. C'est la
destination écrite de [`map.md`](map.md), et **le juge est son jugement, pas un
chiffre**.

Deux rappels qui valent pendant toute la construction :

- une correction du traitement ou de la récolte **ne se voit qu'après un
  passage du worker** — le cron du Jour de travail, ou un lancement à la main
  depuis l'onglet GitHub Actions. **À dire à chaque fois, en nommant lequel des
  deux.** (Le ticket 15 a retiré les quatre boutons de l'app le 2026-09-13, et
  `CLAUDE.md` §9 a été mis à jour dans le même passage.) Ce qui se REGROUPE par
  thème, lui, se voit tout de suite, à la lecture ;
- **aucune vérification en base n'est possible en local** : le `.env` racine
  pointe un projet Supabase qui ne répond plus, et il nomme d'ailleurs la clé de
  service autrement que le worker ne la cherche — la production ne tourne que
  parce que le workflow, lui, passe le bon nom. **Aucun décompte de lignes ne
  pourra être donné. Le dire, ne pas le contourner**, et ne jamais faire figurer
  une valeur de secret : un message d'erreur nomme la **variable**, jamais sa
  valeur.

---

## Out of Scope

- **Tout ce que la carte de refonte a tranché.** On bâtit ses décisions, on ne
  les rouvre pas. Si le code contredit une décision, **c'est un fait, pas une
  permission** : ça remonte dans le ticket et ça se demande.
- **Les briques 2 à 7 du plan §4**, chacune avec une condition d'entrée non
  remplie — le principe étant *« rien ne se construit pour un client qui n'existe
  pas encore »* :
  - la **Mise en place** (le fil de démarrage en quatre étapes) — elle ne sert
    qu'à quelqu'un qui n'est pas David, qui est déjà branché ;
  - le **gabarit de plateforme** en six rangs — il range, il ne débloque rien ;
  - le **bandeau de commandes** unique — uniformisation, pas un cul-de-sac : la
    porte marche déjà avec le paramètre existant. Le vocabulaire d'URL unifié lui
    appartient, **pas à cette spec** ;
  - le **compteur partagé** au-delà de sa colonne d'auteur ;
  - les **Notes sur la courbe** — décidées dans leur principe, pas dans leur
    forme, et le retrait des marques d'août interdit de trancher sans variantes ;
  - les **quatre récoltes manquantes** — elles ajoutent des conseils, elles ne
    réparent aucun cul-de-sac.
- **Le passage en Production Google et Meta**, et le palier payant de l'API
  Gemini. Ils tournent **en parallèle**, David seul, délai administratif. Le fait
  qui mord pendant ce temps : en statut *Testing*, le jeton de rafraîchissement
  Google meurt à **sept jours** pour les scopes publicité et analytics, donc le
  worker casse chaque semaine, **y compris sur le compte de David** — le bouton
  « Reconnecter » existe déjà, il faut recliquer avant chaque Jour de travail, et
  une semaine oubliée est une semaine de données perdue.
- **La récolte de données** en général — David la dit bonne. Seule exception,
  portée par le ticket 03 : l'identifiant d'Annonce Meta, parce que c'est une
  **réparation** d'un bug de récolte, pas un ajout.
- **Le rebranchement du chemin de conseils compte-entier.** Il existe toujours
  dans le code et **n'est volontairement pas rebranché**. Ne pas le « réparer ».
- **Le plafond de trois conseils par thème.** Un compte à un seul thème
  prioritaire plafonne à trois conseils : **c'est assumé, ne pas le réparer.**
- **Une colonne d'auteur sur le Verdict**, pour savoir qui a jugé quoi — refusée
  par l'ADR 0004, avec son prix écrit et accepté.
- **La comparaison de deux thèmes côte à côte** — reportée par David, « un autre
  module, comme sur GA4, pour des experts », notée au `BACKLOG.md`.
- **La relecture des semaines passées.** L'historique est en base et n'est jamais
  ouvert : **c'est voulu**, deux vérités à l'écran est le défaut qu'on évite.
- **Le recalcul d'un Verdict déjà rendu.**
- **Un outil de mesure d'audience** pour juger la v1 — écarté en 04 : ce serait
  une brique avant la première.
- **Le nettoyage pour le nettoyage.** Garde-fou de 04 : il est interdit de
  répondre « il faut d'abord tout nettoyer ». Un chantier de propreté ne valide
  aucune hypothèse. Les 32 worktrees et 8,6 Go relevés en 01 restent où ils sont.
- **La doc du produit.** Elle s'écrit **thématique par thématique, quand la
  brique est construite** — c'est le produit qui dicte la doc. Table des matières
  au §6 du plan.
- **Un runner de test dans `saas/web`** — arbitré par David en même temps que le
  seam.

---

## Further Notes

**Ce document ne décide rien.** Sa seule valeur est de rassembler en un endroit
ce que vingt-et-un tickets ont tranché, pour qu'un agent qui prend un ticket de
construction sache ce que son morceau sert. En cas d'écart entre cette spec et un
ticket de la refonte, **le ticket gagne** : il porte la mesure, la date et les
mots exacts de David.

**Deux décisions se contredisent dans les sources, et la plus récente gagne** :
l'arrêt de tout conseil mono-régie
([11](../refonte/issues/11-d-ou-viennent-les-conseils.md)) a été partiellement
renversé par la suppression du critère d'admission
([24](../refonte/issues/24-conseils-payants-manquants.md)). Deux règles coupées
pour ce seul motif sont réhabilitées. **Le ticket qui le rencontre l'écrit** au
lieu de trancher en silence.

**Quatre tickets de la refonte sur cinq ont trouvé une prémisse fausse.** Ce
n'est pas une anecdote, c'est un taux : celle qu'on trouvera pendant la
construction vaut la même attention. Plusieurs des corrections les plus utiles de
la refonte sont allées **dans le sens de l'allègement** — un ticket qui retire
dix-sept lignes au lieu d'en ajouter, un partage qui existait déjà, une migration
annoncée qui n'était pas nécessaire. Chercher ce qui est déjà là **avant** de
construire est la posture qui a payé jusqu'ici.

**Comment David reçoit le travail** : *« quand je veux améliorer une partie, je
reçois des prototypes que j'accepte, et ensuite ils vont dans l'application avec
un check pour voir si l'app fonctionne »*. Un ticket qui touche à la **forme**
d'un module la propose en **variantes comparables** sur une vraie page, via le
sélecteur de prototypes — pas en description. Ça vaut au moins pour l'ordre du
premier écran et pour tout ce qui rallumerait des marques sur une courbe.

**Skills à consulter** selon le morceau : `vision-produit` (quelle information
mérite d'exister), `vision-ux` (hiérarchie et uniformisation), `ux` (une action
de bout en bout), `hebdo` (structure du rapport), `recos` (pertinence et variété
des conseils). Côté code : `py-boy-scout` et `ts-boy-scout`.

**Ce qui ne se charte pas d'avance**, et que la carte de construction assume :
le jugement de David sur le fil une fois en service — c'est le seul endroit où
cette spec peut découvrir qu'elle s'est trompée —, et ce que les quatre premières
règles payantes donneront sur de vraies données. Leurs seuils ne sont pas
inventés, mais **aucune n'a jamais tourné**. Si elles se taisent ou se répètent,
**c'est un ticket, pas une retouche silencieuse.**
