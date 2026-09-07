# Pulse

SaaS d'analyse marketing : récolte les données publicitaires et organiques d'un
client, les range par thème, et publie un rapport hebdomadaire qui dit où mettre
ses dix minutes cette semaine.

## Language

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
Un thème que le client a marqué comme celui sur lequel Pulse doit se concentrer.
Les 3 premières étoiles posées (par ordre de pose, pas alphabétique) reçoivent
des conseils rédigés par l'IA ; les suivantes ont leur bilan et leurs conseils
calculés, sans texte rédigé.
_Avoid_: Favori, épinglé.

**Couverture** :
La part de la dépense publicitaire (fenêtre de 90 jours pleins) rattachée à un
thème. Sert à la fois de baromètre (page Thèmes) et d'alerte (rapport hebdo,
`AlerteThemes`) — c'est délibérément le même chiffre, jamais recalculé à part.

**Hypothèse** :
La piste rédigée par l'IA qu'un thème porte à un instant donné — une seule à
la fois par thème, suivie jusqu'à son Verdict avant qu'une autre ne la
remplace.
_Avoid_: Idée, test — « hypothèse » est le seul mot qui porte la promesse d'un
Verdict à échéance ; une simple idée ne l'engage pas.

**Verdict** :
Le jugement (meilleur / pire / stable) porté sur une Hypothèse à son
échéance, en comparant l'indicateur de son Levier à sa valeur de départ.
_Avoid_: Résultat, bilan — trop génériques, déjà pris ailleurs dans le
produit pour d'autres choses (bilan de thème, résultat de campagne).

**Levier** :
Ce sur quoi une piste IA agit — argent, contenu, tempo ou audience — jamais
deviné après coup : l'IA le déclare elle-même pour chaque piste.
_Avoid_: Catégorie, type d'action.

**Plan de thème** :
L'état courant de l'Hypothèse active d'un thème (depuis quand, quel Levier,
son dernier Verdict) — une seule ligne par thème qui se remplace, jamais un
historique des hypothèses passées.
_Avoid_: Historique, journal.
