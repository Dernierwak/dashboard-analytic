# Pulse

SaaS d'analyse marketing : récolte les données publicitaires et organiques d'un
client, les range par thème, et publie chaque semaine — le jour que le client
choisit — ce qui a bougé chez lui, quoi faire sur les thèmes qu'il a mis en
priorité, et si ce qu'il a fait la semaine d'avant a marché.

## Language

**Compte** :
L'unité à laquelle appartiennent les données, les thèmes et le carnet. Il
appartient à **l'entreprise, pas à la personne** : plusieurs personnes gravitent
autour du même compte (l'artisan et son marketeur, deux marketeurs et leur
patron), invitées en lecture ou en édition. Un invité voit les chiffres, jamais
les jetons OAuth.
_Avoid_: Utilisateur, client — un compte survit au départ de la personne qui
l'a ouvert. À ne pas confondre avec le compte publicitaire d'une régie (« compte
Meta », « compte Google Ads »), qui est une SOURCE branchée sur celui-ci.

**Propriétaire** :
La personne dont le Compte porte les données — celle qui a branché les régies et
qui invite les autres. **C'est à elle que les conseils s'adressent** : le persona
qui donne le ton est bâti sur son profil, et l'écran le dit à un Membre qui
regarde le compte d'autrui. Elle est la seule à gérer les invitations et les
rôles.
_Avoid_: Admin — le mot dit un pouvoir technique, pas la personne à qui Pulse
parle.

**Membre** :
Une personne invitée sur le Compte de quelqu'un d'autre. Elle **voit tout** —
chiffres, rapport, notes de tout le monde — et agit selon son rôle : *Peut agir*
(coche les actions, reclasse, choisit les priorités) ou *Lecture seule*. Elle ne
voit jamais les jetons OAuth, et les conseils ne sont pas écrits pour elle.
_Avoid_: Invité quand on parle de ce qu'elle fait — l'invitation est l'événement,
« membre » est l'état.

**Mise en place** :
Les quatre étapes que le compte franchit **une seule fois** : son profil, ses
connexions, ses premiers thèmes, ses priorités. Elle se termine et ne recommence
pas — des campagnes non classées qui arrivent plus tard sont une affaire de
couverture, pas de mise en place.
_Avoid_: onboarding, configuration — le premier est de l'anglais de produit, le
second laisse croire à un panneau de réglages qu'on rouvre.

**Jour de travail** :
Le jour de la semaine que le compte a choisi, et le **seul** moment où Pulse
récolte, recalcule et publie. Tout ce que le client lit est ancré dessus : la
fenêtre mesurée est celle des sept jours pleins qui le précèdent, et elle ne
bouge plus jusqu'au suivant.
_Avoid_: Jour de récolte, jour du rapport — la récolte et le rapport sont deux
conséquences du même choix, pas deux réglages.

**Thème** :
Une étiquette posée sur une campagne (Meta, Google) ou un post (Instagram) qui
en dit le SUJET business (produit, gamme, offre, événement) — jamais le format
ni le canal. C'est ce qui permet de regrouper trois sources en une seule lecture
(coût, recommandations, bilan) par sujet plutôt que par plateforme.
_Avoid_: Label, catégorie, tag — le mot affiché partout dans l'UI et dans le
vocabulaire produit est « thème » ; « label » ne survit que dans des noms de
colonnes techniques (`label_source`, `campaign_label_select`).

**Classement** :
L'action de poser un thème sur du contenu qui n'en a pas — à la main (un choix
qui ne sera plus jamais réécrit par l'IA, `label_source='user'`) ou par l'IA en
tâche de fond (`label_source='ai'`, corrigible).
_Avoid_: Étiquetage, catégorisation — utilisés de façon interchangeable dans le
code existant, mais « classement » est le mot qui apparaît dans l'UI (« On
classe tes contenus ? »).

**Nouveau thème** :
Un thème que l'IA invente pendant un classement, parce qu'aucun thème existant
ne convenait à l'item qu'elle traite (jusqu'à 5 par lot). Distinct d'une
« assignation » (poser un thème EXISTANT sur un item) — les deux se décident
différemment : une assignation s'annule en bloc après coup, un nouveau thème se
revoit un par un (garder / supprimer) parce qu'il modifie durablement le
vocabulaire du compte, pas un seul item.

**Priorité (étoile)** :
Un thème que le client a désigné comme celui sur lequel Pulse doit se
concentrer — **trois au maximum**, par ordre de pose. C'est le client qui
arbitre, jamais Pulse : **un conseil ne peut naître que sur un thème
prioritaire**, et un thème sans étoile a son bilan et ses chiffres, jamais de
conseil. Aucune priorité posée : le module À faire est visible et
**verrouillé**, il dit ce qu'une étoile débloque — c'est lui qui le dit, jamais
le module verrouillé d'un thème, qui ne parle que de données manquantes.
_Avoid_: Favori, épinglé.

**Point de vue de la semaine** :
Ce que Pulse rend à un compte **sans rien lui demander de classer** : ce qui a
bougé depuis le dernier Jour de travail — une campagne qui marche, une campagne
nouvellement lancée, une publication au-dessus de sa moyenne. C'est un
**constat**, jamais un conseil : il n'engage aucun Verdict et ne désigne aucun
sujet à travailler.
_Avoid_: Résumé, aperçu, vue d'ensemble — le premier désigne déjà la prose IA du
rapport ; et « point de vue » dit bien ce que c'est : ce qu'on voit, pas ce
qu'on doit faire.

**Couverture** :
La part de la dépense publicitaire (fenêtre de 90 jours pleins) rattachée à un
thème. Sert à la fois de baromètre (page Thèmes) et d'alerte (rapport hebdo,
`AlerteThemes`) — c'est délibérément le même chiffre, jamais recalculé à part.

**Annonce** :
Le contenu diffusé lui-même, un cran sous la campagne — c'est l'unité à
laquelle un conseil payant compare, parce qu'à l'échelle d'un thème une
campagne n'a plus personne à qui se comparer. Un conseil parle d'une Annonce
**toujours accroché au thème** : « ton annonce est mauvaise » se lit déjà dans
la régie, « sur ce thème, voilà où part ton argent » ne s'y lit nulle part.
**Une Annonce est identifiée par son `ad_id`, jamais par son nom.** Le nom est
une étiquette que l'annonceur réutilise à volonté — deux annonces « Video 1 »
dans deux Groupes sont le montage courant, et les confondre a déjà coûté ~40 %
de la dépense Meta de deux journées mesurées (19-20/08/2026). Une règle qui
regroupe, compare ou désigne une Annonce par `ad_name` rejoue ce bug dans le
moteur de conseils.
_Avoid_: Créa, créatif, ad — « créatif » désigne le visuel, pas la ligne
diffusée ; l'anglais ne s'affiche jamais.

**Groupe d'annonces** :
Ce qui contient les Annonces **et porte leur budget** — l'ad set chez Meta, l'ad
group chez Google, un seul mot pour les deux. La distinction avec l'Annonce
n'est pas cosmétique : on ne finance pas une Annonce, on finance son Groupe.
Un Geste « augmenter » désigne donc toujours le Groupe, jamais l'Annonce qui a
fait remarquer qu'il fallait l'augmenter.
_Avoid_: Ad set, ad group, adset — le nom de la régie ne s'affiche pas ; il ne
survit que dans les colonnes techniques (`adset_name`, `ad_group_name`).

**Vues par personne** :
Combien de fois la même personne a revu une Annonce sur la semaine. Pulse
n'affiche **jamais** ce nombre tel quel : il affiche un **minimum** (« au moins
2,8 fois »), et c'est une contrainte de la donnée, pas une prudence de style.
La portée (`reach`) compte des personnes **dédoublonnées** — quelqu'un touché
lundi et mardi est une personne, pas deux — et on ne récolte cette portée que
jour par jour. Diviser les impressions de la semaine par la SOMME des portées
quotidiennes donne donc un nombre plus petit que la réalité, jamais plus grand.
Un conseil qui écrirait « 2,8 fois » sans le « au moins » affirmerait une mesure
qu'on n'a pas (`CLAUDE.md` §7).
_Avoid_: Fréquence — c'est le mot de Meta, et il désigne précisément la valeur
qu'on ne sait PAS calculer. L'employer ferait passer un plancher pour elle.

**Engagement** :
La part des gens qui ont vu une publication et ont fait quelque chose :
**`(likes + comments + saved) ÷ reach`**, exprimée en **pourcentage**. Tranché
avec David le 2026-09-14 (ticket 44 de la construction).

⚠ **La formule était déjà employée ; ce qui manquait, c'est qu'elle soit
écrite.** Elle vit aujourd'hui à TROIS endroits, et l'énoncé ci-dessous est
celui que la vue `theme_regroupement` applique — les deux autres en divergent
et sont à ramener dessus (voir le ticket 50 de la construction) :

| Où | Agrégation | Portée inconnue |
|---|---|---|
| `theme_regroupement` (la référence) | rapport de sommes | **inconnu** |
| `saas/web/lib/channels.ts` (`/instagram`) | moyenne de taux | **0** |
| `saas/traitement/build_report.py` l. 1997 | moyenne de taux | **0** |

Ce que la définition exclut, et pourquoi :
- **`follows` n'y est pas.** S'abonner n'est pas réagir à une publication,
  c'est décider de suivre un compte. Les mélanger rendrait un taux qu'aucun
  repère du métier ne permettrait plus de lire.
- **`views` n'est pas le dénominateur.** La colonne est vide ou nulle sur les
  publications image ; l'employer rendrait l'engagement inconnu sur une partie
  du catalogue sans que personne comprenne pourquoi.
- **C'est un rapport de sommes, pas une moyenne de taux.** Sinon une
  publication vue par douze personnes pèse autant qu'une vue par dix mille, et
  un thème entier se juge sur son plus petit post.
- **Une publication dont la portée n'est pas remontée sort du calcul**, des
  DEUX côtés de la division. Garder ses réactions sans son dénominateur
  gonflerait le taux : une panne de collecte se lirait comme une réussite.
  **« Pas remontée » veut dire `reach <= 0`, pas seulement `NULL`** : la
  collecte écrit `metrics.get("reach", 0)` (`fetch_instagram.py`), donc une
  portée absente arrive en base à **zéro**. Ne filtrer que le `NULL`
  laisserait passer exactement le cas qu'on veut exclure.

**Sans portée connue, l'engagement est INCONNU, jamais 0** (`CLAUDE.md` §7) —
zéro affirmerait que personne n'a réagi, alors qu'on ignore combien de
personnes ont vu. En revanche, une publication vue sans aucune réaction vaut
bien 0 : là, la mesure existe.

⚠ **Ce chiffre est déjà affiché, et il va BOUGER.** `/instagram` montre un
« Engagement » en % depuis toujours, et le rapport hebdo aussi. Le passage à la
vue ne change ni le numérateur ni le dénominateur : il change **l'agrégation**
(rapport de sommes au lieu d'une moyenne de taux) et le sort de la portée
inconnue (inconnu au lieu de 0). Un thème dont l'engagement change après la
migration n'est donc pas en panne — mais il ne faut pas non plus présenter ça
comme une première mesure.

⚠ **Les Reels et les vidéos n'ont pas de `likes` en base** — la collecte ne
demande pas la métrique pour ces formats et écrit `0`. Leur engagement est donc
structurellement sous-évalué, quel que soit le moteur qui le calcule. Tant que
ce n'est pas réparé (ticket 51), un classement de thèmes par engagement
défavorise mécaniquement ceux qui publient des Reels.

_Avoid_: Taux d'interaction, engagement rate — un seul mot pour une seule
formule. Et ne jamais écrire « engagement » à côté d'un nombre brut de likes :
l'unité du produit est le **%** (`METRIC_INFO`, `saas/traitement/build_report.py`).

**Note** :
Ce que le client a fait et que Pulse ne peut pas deviner — « refait les
visuels », « changé le ciblage à la main », « le concurrent a lancé une promo ».
Texte libre, posé sur une date choisie (souvent la veille ; jamais dans le
futur — une note est un fait, pas un projet) et rattaché à ce qu'elle concerne :
un thème, une campagne, les deux, ou rien. **Une note n'est pas une Action
suivie** : elle n'a ni indicateur, ni valeur de départ, ni échéance, donc aucun
Verdict ne peut tomber dessus. Elle se corrige et se supprime — c'est un fait
déclaré par une personne, pas une mesure.
Une note peut **naître avant le fait** : le client écrit ce qu'il compte faire,
la ligne rejoint le module À faire et s'y coche. Elle **ne se date qu'au moment
où on la coche** — la règle « jamais dans le futur » tient donc toujours, et
tant qu'elle n'est pas cochée elle ne raconte rien et ne marque pas la courbe.
Une note **porte son auteur** : c'est un fait déclaré par une personne, donc
elle seule (ou le Propriétaire) la corrige et la supprime. L'auteur ne s'affiche
que sur un Compte à plus d'un Membre.
_Avoid_: Commentaire — voir Retour ; un retour répond à un conseil de Pulse,
une note ne répond à rien, elle raconte.

**À faire** :
Le module du rapport qui liste **ce qui attend une décision du client cette
semaine** : les conseils non encore décidés et les Actions suivies dont le
Verdict est tombé — les verdicts d'abord. Une ligne par chose, avec ses gestes
posés dessus ; le titre renvoie, ancré, à l'endroit où le conseil est expliqué.
Il se **vide sous le doigt** : chaque décision retire sa ligne, « fait » comme
« pas pour moi ». Ce qui n'attend aucune décision — en cours, en observation,
l'historique — reste au Carnet. Il disparaît quand il est vide **et** qu'il n'a
plus rien à faire découvrir.
_Avoid_: Tâches, to-do, checklist — « tâche » est déjà écarté par Action suivie ;
et ce module ne liste pas du travail, il liste des décisions.

**Carnet** :
Tout ce que le compte a écrit et décidé, lu comme une seule chronologie
continue : les Notes et les Actions suivies avec leur Verdict, mêlées aux faits
que les plateformes déclarent. Il n'est pas découpé en semaines et ne se rejoue
pas depuis un rapport archivé — c'est un fil vivant, pas une pile de photos.
C'est **un seul module, posé sur toutes les pages de lecture**, et filtré par ce
que le bandeau de commandes de la page filtre : ses thèmes, sa campagne. On
écrit donc là où on constate, et la Note hérite du contexte de l'écran plutôt
que de le redemander.
Son **bilan** est un COMPTAGE des Verdicts déjà tombés sur le compte entier —
« 6 actions jugées sur 30 jours, 4 ont marché ». Il ne remesure rien : un second
moteur qui remesurait ce bilan sur le compte pendant que le rail mesure sur le
thème pouvait rendre deux verdicts opposés sur la même décision, et il est mort
le 2026-09-13.
_Avoid_: Historique, journal, mémoire — « historique » désigne aussi bien
l'archive des rapports, qui est autre chose.

**Retour** :
Ce que le client dit d'un conseil : une réaction (utile / pas pour moi / trop
compliqué) et, si elle veut, une phrase. Il nourrit le portrait que l'IA se
fait du client pour rédiger les conseils suivants. **Un retour juge un conseil ;
une Note raconte un fait.**
_Avoid_: Commentaire, feedback, avis — « commentaire » ne survit que dans des
noms de colonnes techniques (`reco_feedback.comment`).

**Action suivie** :
Un geste que le client a décidé de tester, avec son indicateur, sa valeur de
départ et son échéance à 14 jours — donc un Verdict qui tombera. Elle naît d'un
conseil pris, et d'un clic seulement — Pulse n'en ouvre jamais une à la place
du client.
_Avoid_: Tâche, chantier — le mot qui porte la mesure est « action suivie ».
Aucun plafond ne limite plus le nombre d'actions ouvertes : ce qui borne la
charge, c'est la composition des cinq conseils (Stratégie, effort).
**Son statut n'a pas d'auteur** : il appartient au Compte, pas à la personne qui
l'a changé (ADR 0004). Tout Membre qui peut agir le fait avancer, et le premier
qui juge l'emporte — deux verdicts sur un seul chiffre seraient une contradiction, pas
une nuance. C'est la différence exacte avec la Note, qui est personnelle.

**Hypothèse** :
La piste qu'un thème porte à un instant donné — une seule à la fois par thème,
avant qu'une autre ne la remplace. Elle ne reçoit un Verdict que si le client
l'a prise : restée deux semaines sans réponse, elle part en Mise en veille.
_Avoid_: Idée, test — « hypothèse » est le seul mot qui porte la promesse d'un
Verdict à échéance ; une simple idée ne l'engage pas.

**Stratégie** :
Ce qu'on cherche à obtenir sur un thème et qui ne tient pas en une semaine —
« une meilleure page d'arrivée », « une campagne qui parle d'une autre
thématique ». Elle ne se propose jamais en entier : le client n'en reçoit
qu'une Marche à la fois.
_Avoid_: Chantier, projet, plan — « chantier » désigne une carte de travail
interne, « plan de thème » est déjà pris ci-dessous.

**Marche** :
L'étape d'une Stratégie proposée cette semaine, et la seule visible : changer
l'appel à l'action avant de toucher au titre, le titre avant de restructurer.
La suivante n'arrive que lorsque la précédente est faite — un Verdict ne fait
pas avancer d'une marche, il dit si la Stratégie continue ou change.
_Avoid_: Étape, sous-tâche — « étape » désigne déjà les rangs de la Mise en
place.

**Mise en veille** :
Ce qui arrive à un conseil resté deux semaines sans réponse : il cesse
d'occuper une des places de la semaine. Il n'est ni refusé, ni perdu, ni
remplacé par une version plus facile — un silence ne dit pas pourquoi.
_Avoid_: Rejet, abandon, expiration — le client n'a rien décidé, et c'est
précisément le point.

**Verdict** :
Le jugement (meilleur / pire / stable) porté sur une Hypothèse à son
échéance, en comparant l'indicateur de son Levier à sa valeur de départ.
L'échéance se compte depuis le jour où le client a dit l'avoir fait, jamais
depuis la publication du rapport.
_Avoid_: Résultat, bilan — trop génériques, déjà pris ailleurs dans le
produit pour d'autres choses (bilan de thème, résultat de campagne).

**Geste** :
Ce qu'un conseil demande de faire — couper, augmenter, tester, créer ou
corriger. Cinq valeurs, pas une de plus : elles existent pour empêcher que les
conseils d'une semaine se ressemblent, et « vérifier » n'en est pas une.
**Un conseil sans Geste n'est pas un conseil, c'est un constat.** Comme le
Levier, il est déclaré par ce qui écrit le conseil, jamais deviné après coup.
_Avoid_: Action, type — « action » désigne déjà ce que le client suit.

**Levier** :
Ce sur quoi un conseil agit — argent, contenu, tempo ou audience — jamais
deviné après coup : il est déclaré, conseil par conseil, par ce qui l'écrit.
Un cinquième existe, **socle** : réparer la mesure elle-même (Google Analytics
absent, événement muet, clics qui n'arrivent jamais en sessions). Il est à part
et ne concourt pas pour les places de la semaine — tant que la mesure est
cassée, les quatre autres n'ont rien de fiable à dire.
_Avoid_: Catégorie, type d'action.

**Plan de thème** :
L'état courant de l'Hypothèse active d'un thème (depuis quand, quel Levier,
son dernier Verdict) — une seule ligne par thème qui se remplace, jamais un
historique des hypothèses passées.
_Avoid_: Historique, journal.

**Bandeau de commandes** :
La barre unique, collante, posée au-dessus de chaque page — elle en porte le
titre et les contrôles de ce qu'elle montre : la période et les thèmes partout,
le statut et la campagne sur les pages payantes seulement. Ce qui ne gouverne
qu'un seul module n'y entre pas ; un contrôle qui n'a rien à choisir ne s'y
affiche pas. **Sa portée n'est pas toujours la page entière, et là où elle ne
l'est pas, la page l'écrit** : sur `/couts`, la période ne commande que la
répartition et la courbe — l'enveloppe de l'année et les cartes par thème n'en
dépendent pas. Tant qu'un filtre était posé DANS la section qu'il gouvernait, sa
portée se lisait à sa position ; en haut de page, elle doit se dire.
_Avoid_: Filtres, barre de filtres, header — « filtres » désigne les valeurs
choisies, pas l'objet qui les porte ; et il ne filtre pas que des listes, il
gouverne les chiffres et la courbe.

**Rappel** :
Le compteur discret posé dans la navigation, qui dit ce qui reste à faire cette
semaine — les conseils non décidés et les Actions suivies arrivées à échéance,
sur deux lignes distinctes. **Les conseils ne s'empilent jamais** — un conseil
non décidé redescend et revient plus simple ; **les Actions suivies à juger
s'empilent toujours**, parce qu'un verdict est le résultat du travail du client
et que l'effacer effacerait ce qu'il a fait. Il disparaît quand il n'a plus rien
à dire. Il est **partagé** : ce qu'une personne
du compte traite descend chez toutes.
_Avoid_: Notification, alerte, badge — « notification » est réservé à une
notification poussée, que Pulse n'envoie pas ; « alerte » annonce un problème,
or un Rappel annonce du travail normal.

**Regroupement** :
Ce qui change quand on pose un Thème : par quoi des chiffres **déjà en base**
sont additionnés. Un regroupement ne produit aucune donnée, donc il se recalcule
**à la lecture** — le client classe, l'écran suivant est à jour, sans récolte ni
IA. C'est la frontière du produit : ce qui se regroupe est immédiat, ce qui se
récolte ou se rédige attend le Jour de travail.
_Avoid_: Recalcul, rafraîchissement, mise à jour — trois mots qui laissent croire
qu'un traitement tourne ; ici rien ne tourne, on relit autrement.

**Mesure prise** :
Un chiffre **enregistré à une date**, et qui ne rétroagit pas — même quand on
saurait le recalculer. La baseline d'une Action suivie, un Verdict déjà rendu,
un Jugement de thème : tous jugent un travail sur le périmètre qui existait au
moment où il a été fait. Les recalculer sur un périmètre élargi plus tard
attribuerait un mouvement de chiffres à un travail qui ne l'a pas produit.
C'est la seule chose qu'un Regroupement ne touche jamais : classer une campagne
change tous les totaux d'un Thème, y compris ceux des semaines passées, mais
ne change aucune Mesure prise.
_Avoid_: Snapshot, historique, archive — les trois disent « vieille copie », or
une Mesure prise n'est pas une copie : c'est le seul chiffre qui ait jamais été
vrai pour cette décision-là.
