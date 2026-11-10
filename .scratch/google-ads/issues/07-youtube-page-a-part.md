# 07: YouTube : une page à part ou une vue de la page Google

Type: grilling
Status: resolved
Blocked by: 01, 04
Assignee: Dernierwak

## Question

YouTube se lit en **vues, taux de vue, quartiles de lecture, coût par vue,
engagements** — presque rien de commun avec Search. **Mérite-t-il sa propre
page** (`/youtube`, sa propre entrée de navigation, ses propres modules
remplis de ses propres métriques) ou **une vue dédiée de `/google`** ?

À peser :
- la lisibilité : combien de modules gardent un sens pour YouTube ;
- c'est **le même compte Google Ads**, la même facture, le même total ;
- la **vidéo** comme objet (l'équivalent du post ou de l'annonce) — et les
  vidéos YouTube diffusées par PMax ;
- la frontière avec un futur **YouTube organique** (la chaîne), hors de ce
  chantier.

Dépend de ce que l'API rend en vidéo (01) et de l'axe retenu (04).

## Ce que l'axe apporte (04, résolu)

Les cartes du Sélecteur gardent les mêmes métriques quel que soit le type
filtré : filtrer sur Vidéo resserre les courbes, il **n'ajoute pas** vues, CPV
ni quartiles. Si YouTube reste sur la page Google, il faut donc dire où ces
métriques vivent (Tableau, Comparaison, un module à part ?) — c'est l'un des
arguments de cette question. Le type s'écrit « Vidéo » (`CONTEXT.md`).

## Answer

Grilling avec David, 2026-11-10.

**Pas de page à part pour la vidéo payante.** David : « on va de toute façon
pas créer une page exprès pour tout ce qui va être vidéo ». Les campagnes
vidéo — le YouTube payant — sont **un type de campagne de `/google`** comme
Search ou PMax : une entrée du filtre du Bandeau, totalisées avec les autres
(05), une part dans la moustache (04). Pas de `/youtube` payant, pas d'entrée
de navigation à part, pas de carte Vidéo au Sélecteur (04 : les cartes ne
changent pas avec le filtre).

**Les métriques propres à la Vidéo vivent dans le module d'analyse par type**
— [La Comparaison sur Google](08-la-comparaison.md) — « où l'on choisit le
type et où l'on analyse dedans » : vues, taux de vue, CPV, quartiles.
**Détaillées au même niveau que Search et PMax** — David a écarté le socle
minimal que je proposais au motif qu'aucun compte réel n'a de Vidéo diffusée
(03) : la Vidéo doit être un « truc signature ». La maquette (11) ne pourra
donc pas l'éprouver sur des données réelles ; elle le dira au lieu d'inventer
des chiffres (§7).

**La vidéo diffusée par PMax reste sous PMax**, lue dans sa répartition par
réseau. Le type Vidéo ne compte que les campagnes `advertising_channel_type =
VIDEO` — sinon la même dépense serait comptée deux fois.

**Le nom : celui de Google Ads.** David : « prends le nom Google Ads ». Google
Ads appelle ce type « Vidéo » : l'entrée du filtre s'écrit **« Vidéo »**.

**« YouTube » seul désigne la future page organique** — la chaîne, où il n'y a
aucun contenu payant. Hors de ce chantier, notée au `BACKLOG.md`. La frontière
est nette : le payant sous Google Ads, l'organique sur sa propre page, comme
Instagram.

**Lecture propre à chaque type, dans les mots de David** (apport au ticket
08) : PMax → les audiences ; Search → les mots-clés et les termes de
recherche ; Display → les sites (emplacements) qui ont amené le plus de
trafic ; Vidéo → les métriques de la campagne ; Shopping et App → la vente des
produits (au `BACKLOG.md`, ticket 06).

**Fait à vérifier, pas une promesse** : d'après ce que je sais de l'API, PMax
ne rend pas de performance par signal d'audience — seulement par groupe
d'éléments, par réseau, et des « insights » incomplets. Non vérifié ; ajouté à
[L'essai réel des métriques Google](10-l-essai-reel.md). La spec ne promet pas
« les audiences de PMax » avant cette vérification.

`CONTEXT.md` : « Type de campagne » précisé (nom Google Ads ; YouTube réservé
à l'organique ; la vidéo de PMax reste à PMax). Pas d'ADR : rien d'irréversible
— ajouter une page YouTube organique plus tard ne défait rien ici.
