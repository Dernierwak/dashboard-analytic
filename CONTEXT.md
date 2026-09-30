# Pulse

SaaS d'analyse marketing : récolte les données publicitaires et organiques d'un
client, et publie chaque semaine — le jour que le client choisit — ce qui a
bougé chez lui. Il constate, il ne conseille pas.

## Language

**Compte** :
L'unité à laquelle appartiennent les données. Il
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
chiffres et rapport — et agit selon son rôle : *Peut agir* ou *Lecture
seule*. Elle ne voit jamais les jetons OAuth.
_Avoid_: Invité quand on parle de ce qu'elle fait — l'invitation est l'événement,
« membre » est l'état.

**Mise en place** :
Les deux étapes que le compte franchit **une seule fois** : son profil, ses
connexions. Elle se termine et ne recommence pas.
_Avoid_: onboarding, configuration — le premier est de l'anglais de produit, le
second laisse croire à un panneau de réglages qu'on rouvre.

**Jour de travail** :
Le jour de la semaine que le compte a choisi, et le **seul** moment où Pulse
récolte, recalcule et publie. Tout ce que le client lit est ancré dessus : la
fenêtre mesurée est celle des sept jours pleins qui le précèdent, et elle ne
bouge plus jusqu'au suivant.
_Avoid_: Jour de récolte, jour du rapport — la récolte et le rapport sont deux
conséquences du même choix, pas deux réglages.

**Point de vue de la semaine** :
Ce que Pulse rend à un compte **sans rien lui demander** : ce qui a
bougé depuis le dernier Jour de travail — une campagne qui marche, une campagne
nouvellement lancée, une publication au-dessus de sa moyenne. C'est un
**constat**, jamais un conseil : il ne désigne aucun sujet à travailler. Depuis
le 2026-09-21 c'est **tout ce que le rapport rend** — le conseil, qui en était
l'autre moitié, a été retiré du produit.
_Avoid_: Résumé, aperçu, vue d'ensemble — « point de vue » dit bien ce que c'est :
ce qu'on voit, pas ce qu'on doit faire.

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
`components/channel-dash.tsx`, `saas/traitement/matrice.py`).
**`follows` et `views` en sont dehors**, bien que les colonnes existent : les
abonnements gagnés ne sont pas une réaction à la publication, et compter les
vues au numérateur d'un taux dont la portée est le dénominateur mélangerait
deux dénominateurs.
**Deux agrégats portent ce nom et ne se comparent pas** : la *moyenne des taux
post par post* — un post vu par 40 personnes y pèse autant qu'un reel vu par
12 000 — qui est ce qu'affiche la colonne « Eng. » ;
et le *taux calculé sur les totaux* d'une fenêtre, qui est ce qu'affiche
« Comparer ». Les deux sont légitimes, aucun des deux ne se met en face de
l'autre.
_Avoid_: Interactions, engagement rate — le premier désigne le numérateur seul
et se confondrait avec le taux, le second est de l'anglais de régie. Et « le
nombre d'engagements » ne veut rien dire ici : la valeur affichée est toujours
un pourcentage.

**Fenêtre** :
Les deux bornes de dates sur lesquelles un chiffre est calculé. **Un chiffre sans
sa Fenêtre n'est pas un chiffre** : deux totaux vrais posés côte à côte sur deux
Fenêtres différentes se lisent comme une contradiction, et le lecteur en conclut
que Pulse se trompe. Une Fenêtre **exclut toujours le jour en cours** — la
journée du fetch est incomplète.
La plupart des Fenêtres se choisissent au Bandeau de commandes ; certaines sont
**fixes et ne se choisissent pas** (l'année civile d'une enveloppe). Une Fenêtre fixe posée sur une page qui en
porte une mobile **s'écrit à l'endroit du chiffre**, jamais ailleurs.
_Avoid_: Timeline, plage, intervalle, range — « timeline » promet une frise
qu'on parcourt, alors qu'il s'agit de deux bornes ; les trois autres ne disent
pas que le jour en cours en est exclu.

**Bandeau de commandes** :
La barre unique, collante, posée au-dessus de chaque page — elle en porte le
titre et les contrôles de ce qu'elle montre : la période partout,
le statut et la campagne sur les pages payantes seulement. Ce qui ne gouverne
qu'un seul module n'y entre pas ; un contrôle qui n'a rien à choisir ne s'y
affiche pas. **Sa portée n'est pas toujours la page entière, et là où elle ne
l'est pas, la page l'écrit** : sur `/couts`, la période ne commande que la
répartition et la courbe — l'enveloppe de l'année n'en dépend pas. Tant qu'un
filtre était posé DANS la section qu'il gouvernait, sa
portée se lisait à sa position ; en haut de page, elle doit se dire.
_Avoid_: Filtres, barre de filtres, header — « filtres » désigne les valeurs
choisies, pas l'objet qui les porte ; et il ne filtre pas que des listes, il
gouverne les chiffres et la courbe.

**Mesure prise** :
Un chiffre **enregistré à une date**, et qui ne rétroagit pas — même quand on
saurait le recalculer. Un chiffre publié dans un rapport de la semaine 37 juge
le périmètre qui existait ce jour-là. Le recalculer sur un périmètre élargi
plus tard attribuerait un mouvement de chiffres à un travail qui ne l'a pas
produit.
_Avoid_: Snapshot, historique, archive — les trois disent « vieille copie », or
une Mesure prise n'est pas une copie : c'est le seul chiffre qui ait jamais été
vrai pour cette décision-là.

**Revenu** :
Les francs que Google Analytics rattache à une campagne payante, par le nom de
son UTM, additionnés par Thème. C'est un revenu **attribué**, pas encaissé :
Pulse ne voit jamais la caisse du client, il voit ce que GA4 veut bien relier à
une campagne.
**Il vaut « rien » et non zéro quand GA4 n'attribue aucune campagne payante au
Compte** : dire « ce thème a rapporté 0 » exigerait de savoir que rien n'est
venu, alors qu'on ne sait rien du tout. Sur un compte où GA4 attribue bien du
revenu, un thème qui n'en reçoit aucun vaut 0 — là, on le sait.
_Avoid_: Chiffre d'affaires, ventes, conversions en francs — les trois promettent
la caisse réelle ; et « revenu généré » attribue au thème une causalité que
l'attribution par UTM ne démontre pas.

**Part muette** :
La portion de la dépense d'un Thème faite par des campagnes dont Google
Analytics ne connaît pas le nom. Elle pèse au dénominateur du ROAS sans pouvoir
rien apporter au numérateur : **un ROAS dont la part muette fait la moitié de la
dépense n'est pas faux, il est incomplet**, et ça se lit à côté du chiffre.
Comme le Revenu, elle vaut « rien » et non zéro quand GA4 n'attribue rien au
Compte — y annoncer « 0 CHF non rattachable » affirmerait que tout est rattaché.
_Avoid_: Dépense non trackée, perte d'attribution, dépense orpheline — les deux
premiers sont du jargon de régie, le troisième laisse croire que l'argent s'est
perdu alors qu'il a bien acheté quelque chose.

**ROAS** :
Le Revenu d'un Thème divisé par sa dépense. Il n'existe que **là où le Seuil de
jugement est franchi et où le Revenu existe** ; partout ailleurs il ne se
calcule pas et ne s'affiche pas, plutôt que de se montrer amputé.
Sa lecture ne vaut rien sans la Part muette posée à côté.
_Avoid_: ROI, retour sur investissement, rentabilité — un ROAS ignore le coût de
ce qui est vendu, donc il ne dit pas si l'opération est rentable ; il dit
combien de francs attribués répondent à un franc dépensé.

**Seuil de jugement** :
Les 100 CHF de dépense en dessous desquels Pulse ne se prononce pas sur un
Thème. Un ROAS calculé sur 12 CHF n'est pas un chiffre solide, et un chiffre
fragile publié sans réserve se lit comme un chiffre sûr.
**Le mot « juge » est un nom de colonne, jamais un mot d'écran** : ce que le
client lit, c'est *« pas encore assez de dépense pour se prononcer »*.
_Avoid_: Significativité, seuil statistique, confiance — les trois promettent un
test statistique qui n'existe pas ici ; c'est un plancher de dépense, choisi.
