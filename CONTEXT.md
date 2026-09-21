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
qui invite les autres. Elle est la seule à gérer les invitations et les rôles.
_Avoid_: Admin — le mot dit un pouvoir technique, pas la personne à qui Pulse
parle.

**Membre** :
Une personne invitée sur le Compte de quelqu'un d'autre. Elle **voit tout** —
chiffres et rapport — et agit selon son rôle : *Peut agir* (reclasse, choisit
les priorités) ou *Lecture seule*. Elle ne voit jamais les jetons OAuth.
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
L'action de poser un thème sur du contenu qui n'en a pas. **À la main, et
seulement à la main** (`label_source='user'`) depuis le 2026-09-21 : la
labellisation IA est partie avec les recommandations. Les contenus déjà classés
par elle gardent leur `label_source='ai'` et restent corrigibles.
_Avoid_: Étiquetage, catégorisation — utilisés de façon interchangeable dans le
code existant, mais « classement » est le mot qui apparaît dans l'UI (« On
classe tes contenus ? »).

**Priorité (étoile)** :
Un thème que le client a désigné comme celui sur lequel Pulse doit se
concentrer — **trois au maximum**, par ordre de pose. C'est le client qui
arbitre, jamais Pulse : ce sont les thèmes étoilés qui reçoivent une carte en
tête du rapport. Aucune priorité posée : le rapport retient les trois thèmes de
plus gros poids, un défaut assumé. L'étoile ne commande plus aucun conseil —
il n'y en a plus (ADR 0003, caduque).
_Avoid_: Favori, épinglé.

**Point de vue de la semaine** :
Ce que Pulse rend à un compte **sans rien lui demander de classer** : ce qui a
bougé depuis le dernier Jour de travail — une campagne qui marche, une campagne
nouvellement lancée, une publication au-dessus de sa moyenne. C'est un
**constat**, jamais un conseil : il ne désigne aucun sujet à travailler. Depuis
le 2026-09-21 c'est **tout ce que le rapport rend** — le conseil, qui en était
l'autre moitié, a été retiré du produit.
_Avoid_: Résumé, aperçu, vue d'ensemble — « point de vue » dit bien ce que c'est :
ce qu'on voit, pas ce qu'on doit faire.

**Couverture** :
La part de la dépense publicitaire (fenêtre de 90 jours pleins) rattachée à un
thème. Sert à la fois de baromètre (page Thèmes) et d'alerte (rapport hebdo,
`AlerteThemes`) — c'est délibérément le même chiffre, jamais recalculé à part.

**Annonce** :
Le contenu diffusé lui-même, un cran sous la campagne.
**Une Annonce est identifiée par son `ad_id`, jamais par son nom.** Le nom est
une étiquette que l'annonceur réutilise à volonté — deux annonces « Video 1 »
dans deux Groupes sont le montage courant, et les confondre a déjà coûté ~40 %
de la dépense Meta de deux journées mesurées (19-20/08/2026). Une règle qui
regroupe, compare ou désigne une Annonce par `ad_name` rejoue ce bug.
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
Un écran qui écrirait « 2,8 fois » sans le « au moins » affirmerait une mesure
qu'on n'a pas (`CLAUDE.md` §7).
_Avoid_: Fréquence — c'est le mot de Meta, et il désigne précisément la valeur
qu'on ne sait PAS calculer. L'employer ferait passer un plancher pour elle.

**Engagement** :
Un **taux**, jamais un nombre : `(j'aime + commentaires + enregistrements) /
portée × 100`, en pourcentage. Ce n'est **pas une colonne en base** —
`instagram_organic_posts` porte les cinq comptes bruts, et l'engagement se
recalcule à chaque lecture, partout pareil (`lib/channels.ts`,
`components/channel-dash.tsx`, la vue `theme_regroupement`,
`saas/traitement/matrice.py`).
**`follows` et `views` en sont dehors**, bien que les colonnes existent : les
abonnements gagnés ne sont pas une réaction à la publication, et compter les
vues au numérateur d'un taux dont la portée est le dénominateur mélangerait
deux dénominateurs.
**Deux agrégats portent ce nom et ne se comparent pas** : la *moyenne des taux
post par post* — un post vu par 40 personnes y pèse autant qu'un reel vu par
12 000 — qui est ce qu'affichent la colonne « Eng. » et `eng_avg` d'un Thème ;
et le *taux calculé sur les totaux* d'une fenêtre, qui est ce qu'affiche
« Comparer ». Les deux sont légitimes, aucun des deux ne se met en face de
l'autre.
_Avoid_: Interactions, engagement rate — le premier désigne le numérateur seul
et se confondrait avec le taux, le second est de l'anglais de régie. Et « le
nombre d'engagements » ne veut rien dire ici : la valeur affichée est toujours
un pourcentage.

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

**Regroupement** :
Ce qui change quand on pose un Thème : par quoi des chiffres **déjà en base**
sont additionnés. Un regroupement ne produit aucune donnée, donc il se recalcule
**à la lecture** — le client classe, l'écran suivant est à jour, sans récolte ni
rien d'autre. C'est la frontière du produit : ce qui se regroupe est immédiat,
ce qui se récolte attend le Jour de travail.
_Avoid_: Recalcul, rafraîchissement, mise à jour — trois mots qui laissent croire
qu'un traitement tourne ; ici rien ne tourne, on relit autrement.

**Mesure prise** :
Un chiffre **enregistré à une date**, et qui ne rétroagit pas — même quand on
saurait le recalculer. Un chiffre publié dans un rapport de la semaine 37 juge
le périmètre qui existait ce jour-là. Le recalculer sur un périmètre élargi
plus tard attribuerait un mouvement de chiffres à un travail qui ne l'a pas
produit.
C'est la seule chose qu'un Regroupement ne touche jamais : classer une campagne
change tous les totaux d'un Thème à la lecture, mais ne change aucune Mesure
déjà prise.
_Avoid_: Snapshot, historique, archive — les trois disent « vieille copie », or
une Mesure prise n'est pas une copie : c'est le seul chiffre qui ait jamais été
vrai pour cette décision-là.
