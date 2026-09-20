# Ce qui doit être validé en premier pour ce but

Type: grilling
Status: resolved
Blocked by: 03, 06, 08, 09, 10, 11, 12, 13

## Question

Le but étant nommé (03), quelle est **la seule chose qu'il faut vérifier avant
tout le reste** — celle dont la réponse rendrait le reste inutile si elle était
non ?

David : *« qu'est-ce qui doit être validé en premier pour ce but, ok on finalise
cela au plus simple possible, et ensuite on ajoute ses briques »*. Ce ticket
choisit ce « cela ». Il ne construit rien.

### Ce qu'il faut trancher

- **L'hypothèse la plus fragile du but.** Pas la plus grosse fonctionnalité : la
  plus incertaine. Exemple de forme : « qu'une PME ouvre le rapport chaque
  semaine », « qu'un conseil produit sans IA soit jugé utile », « qu'un compte
  neuf arrive jusqu'à des données affichées sans aide ».
- **Comment on saura que c'est validé ou non**, avec une mesure qu'on est
  réellement capable de prendre. Règle dure : **aucun chiffre fabriqué**
  (`CLAUDE.md` §7). Si on ne peut pas mesurer, on choisit un autre critère — on
  ne s'invente pas un indicateur.
- **Ce que ça implique de figer**, et donc ce qui devient une brique à ajouter
  après plutôt qu'avant. C'est ici, et pas avant, que les questions de coupe
  (thèmes, IA rédactionnelle, dashboards jumeaux) deviennent légitimes.

### Ce qu'il ne faut pas faire

Répondre « il faut d'abord tout nettoyer ». Un chantier de propreté ne valide
aucune hypothèse produit — il peut être nécessaire, il n'est pas *premier*.

### Consigne de conduite

Ticket **HITL**. Appeler `vision-produit` puis `grilling`. À la résolution,
graduer la brume : « la version la plus simple qui valide » et « l'ordre des
briques » deviennent alors formulables et sortent de **Not yet specified**.

## Answer

**Ce qui doit être validé en premier : que le fil de la semaine tienne de bout
en bout, sans cul-de-sac. Le juge est David, sur son propre compte, sur de
vraies données — pas un chiffre.**

### 1 · L'hypothèse la plus fragile n'est pas une fonctionnalité, c'est la continuité

David a écarté les trois candidates que la session proposait (le classement, le
conseil pris, le carnet rempli) en décrivant à la place **le fil complet**, et
c'est la bonne réponse : les trois candidates sont des **morceaux** de ce fil.
Si le fil se casse, un bon conseil ne sert à rien parce que personne n'arrive
jusqu'à lui, et le carnet reste vide parce qu'on n'atteint pas l'endroit où on
écrit.

Le fil, dans ses mots :

> *« Hebdomadaire : ha super, je vois ce qui est en ligne, j'ai un mini point de
> situation. Je vois que les postes sont moins bien en moyenne, je vais voir sur
> la plateforme et j'essaie de trouver seul, same pour toutes les plateformes.
> On scroll, ok je dois faire quoi cette semaine, parfait je prends note, je
> fais mes tâches — je peux écrire aussi si je fais une tâche autre. Semaine
> prochaine je pourrai regarder si cela a fonctionné. Une fois fait, je vais sur
> l'app et je valide ce que j'ai fait, sinon cela [ne] prend pas en compte. Si
> j'ai fait cela hier et oublié, je peux valider à une date précise autre que
> quand je clique. »*

C'est la même chose que 03 avait nommée en creux — *« nous n'avons aucun
workflow, nous ne savons pas comment les pages travaillent ensemble »* — et que
les tickets 06 à 13 ont décrite morceau par morceau. **04 dit que c'est la
continuité, et non un module, qui se valide d'abord.**

**Deux profils, un seul fil.** À ne pas dédoubler en deux produits :

- celui qui ne veut **que** l'hebdo — *« super, je sais enfin ce que je devrais
  faire, pas besoin de faire plus, je vois si cela avance dans la bonne
  direction »* ;
- celui qui prend l'hebdo comme du travail prémâché puis **va creuser
  lui-même** — *« je vais aller checker moi les données ads, car pas de recos
  dessus, et je vais faire moi les modifications que je pense bonnes et ajouter
  mes remarques de ce que j'ai fait »*.

Le second explique pourquoi la porte vers la plateforme (09) et le gabarit (07)
ne sont pas du décor : ils sont la moitié du fil pour la moitié des clients.

**L'onboarding est nommé à part** : *« on doit avoir un onboarding claire »* —
décidé en [10](10-l-entree-premier-ecran.md), donc rien à rouvrir ici.

### 2 · Comment on saura : le jugement de David, et rien qui ressemble à une mesure

> *« C'est moi qui valide avec mon intuition, backé par ton expertise. Ensuite,
> quand l'app sera online, on va créer un moyen de faire remonter les retours
> users. »*

**Fait qui a fermé toutes les autres options : Pulse ne mesure rien de ses
utilisateurs.** Aucune télémétrie dans le dépôt (`posthog`, `plausible`,
`mixpanel`, `gtag` : zéro occurrence), `last_sign_in_at` n'est lu nulle part, et
01 avait établi qu'aucun email n'est envoyé. Donc « est-ce qu'il ouvre son
rapport chaque semaine » **n'est pas mesurable**, et §7 interdit de l'estimer.
Ce qui laisse une trace exploitable, c'est ce que le client **écrit** en base :
thèmes posés, actions décidées, notes, verdicts.

La session a proposé d'ajouter un outil de mesure d'audience : **écarté** — ce
serait ajouter une brique au produit avant d'avoir validé la première, exactement
l'ordre que ce ticket existe pour éviter.

### 3 · Sur qui, et le mur qui a été découvert en le demandant

David est en **mode Testing**, et pour en sortir : *« je dois créer une
entreprise pour mettre Google et Meta app en ligne et pouvoir mettre
l'application pour tous. »*

Vérification faite (documentation Google, sources primaires) :

> *« A Google Cloud Platform project with an OAuth consent screen configured for
> an external user type and a publishing status of "Testing" is issued a refresh
> token expiring in 7 days, unless the only OAuth scopes requested are a subset
> of name, email address, and user profile. »*

Le critère n'est pas la classification du scope mais « tout scope autre que nom /
email / profil » : `adwords` et `analytics.readonly` tombent tous deux dedans.
**Donc en Testing, le jeton meurt à 7 jours pile, et le worker hebdomadaire
casse par construction chaque semaine.** S'ajoutent : 100 utilisateurs de test
maximum, un écran d'avertissement à chaque consentement, et `adwords` classé
**restricted** par Google — la vérification complète impose une évaluation de
sécurité **CASA annuelle par un tiers agréé** dès que les données transitent par
un serveur, ce qui est le cas de Pulse.

**Conséquence de périmètre** : la carte avait rangé « OAuth Google en
Production » hors périmètre comme *« une check-list d'exécution, pas une
décision — rien à trancher »*. **C'est faux** : c'est la porte d'entrée de toute
validation chez un vrai client. Ça devient le ticket
[18](18-passer-en-production.md), de type tâche.

Lecture du texte à tester avant de bâtir dessus, **donnée comme incertaine** :
passer en « Production » sans vérification terminée lèverait peut-être le mur des
7 jours, au prix d'un écran « danger » et d'un plafond de 100 utilisateurs.
Aucune page Google ne l'écrit noir sur blanc.

### 4 · Ce que ça implique de figer

Trois décisions posées en résolvant, chacune avec sa raison :

**a · Un module par thème vide est VISIBLE et VERROUILLÉ, jamais caché.**
David : *« si la personne n'ajoute rien, on a des modules qui sont visibles mais
limite flous, on lui demande d'ajouter des labels pour pouvoir les débloquer »*
et *« on a des modules qui ont l'air super et qui nous motivent à ajouter les
labels car — ha voilà, je débloque quelque chose de super »*. Ça rend le
classement désirable **à l'endroit où le bénéfice se voit**, au lieu de le
réclamer sur une page de réglages. C'est aussi la réponse au constat de 02 :
aucun des 10 produits ne vend le classement, et aucun ne montre ce qu'il
débloque.

**b · La récompense, c'est la liste qui se vide** — pas une animation. Le module
« à faire cette semaine » se raccourcit à **chaque décision**, « c'est fait »
comme « pas pour moi », parce que dans les deux cas le client a tranché. Et
**c'est lui qui choisit la date de réalisation**, pas le moment du clic. Cohérent
avec [12](12-module-de-commandes.md), qui avait refusé la barre de complétion :
la récompense n'est pas retirée, elle est **promise** — la tâche part au carnet
avec sa date et son rendez-vous de verdict. → ticket
[20](20-a-faire-cette-semaine.md).

**c · Une note écrite par le client ne reçoit AUCUN verdict.** La session
recommandait le contraire ; **David a renversé la proposition, et en mieux** :

> *« Si la personne se dit "ben tu sais quoi, je vais tester ce thème", on ne
> devrait pas changer nos recos pour suivre cette idée. Cela devrait être
> indépendant. […] Quand une personne fait un changement d'une campagne, elle la
> sélectionne, on a un affichage sur les graphs [que] son action est mise, et
> elle estime elle-même si cela aide. Car sinon on doit faire rentrer ses recos
> dans un but précis, chaque reco[,] les mettre[,] c'est pour quel objectif — et
> cela devient un trop gros travail. »*

C'est plus juste **et** moins cher : juger la note du client obligerait Pulse à
choisir à sa place le chiffre à surveiller — donc à inventer une intention.
Ici Pulse fournit le **contexte** (la marque sur la courbe), le client fournit le
**jugement**. Frontière nette : **les conseils de Pulse ont un verdict** (la
règle qui les produit déclare le chiffre), **les notes du client ont une
marque**. → ticket [19](19-module-mes-notes.md).

### 5 · Deux défauts mesurés qui bloquent le fil décrit au point 1

- **On ne peut pas valider à la date où on a agi.** `resolveAction` écrit
  `done_at: isoDate(today)` et fixe l'échéance à **ce jour + 14**
  (`app/actions.ts` l. 150-156). Faire le changement mardi et cliquer vendredi
  décale la mesure de trois jours. Demande explicite de David, et ce n'est pas
  cosmétique : le verdict repose sur cette date.
- **Le carnet accepte le travail du client et refuse de le situer.** `saveNote`
  accepte une date libre (*« on note souvent le lendemain ce qu'on a fait la
  veille »*) mais écrit `status: "archived"` avec le commentaire *« elle n'attend
  aucun verdict : son échéance est le jour même »*, et `suivi_actions` **n'a
  aucune colonne de campagne** — déjà relevé en [08](08-la-memoire-du-travail.md),
  qui avait décidé que la note s'élargit à la campagne.

### 6 · Le piège d'août, à ne pas rejouer

Les marques d'action sur une courbe **ont existé et David les a fait retirer** —
`components/line-chart.tsx` l. 45-56, retour du 24 août 2026 :

> *« Retiré à la demande de David : sur une carte de thème, ils ressortaient
> comme deux points noirs pleins au milieu des points bleus de la série et
> brouillaient la lecture de la courbe. »*

Les props `markers` / `marqueurs` sont **encore acceptées et ne dessinent plus
rien**. Ce que le point 4c demande n'est pas la même chose : là, la marque était
un **parasite sur la courbe de quelqu'un d'autre** ; ici elle est **le sujet du
module**. La distinction doit rester écrite, sinon quelqu'un refera l'erreur.

### Ce qui sort en tickets

- [18](18-passer-en-production.md) *(tâche)* — l'entreprise et le passage en
  Production. Bloque toute validation chez un vrai client.
- [19](19-module-mes-notes.md) — le carnet situé sur la courbe, **sans dupliquer
  un seul graphique**.
- [20](20-a-faire-cette-semaine.md) — le module qui se vide, la date choisie, le
  nudge.
- [21](21-le-document-de-refonte.md) — **le document final**, qui ferme la carte.
