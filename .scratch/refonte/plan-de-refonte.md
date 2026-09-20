# Plan de refonte de Pulse

Ce document ferme la carte `.scratch/refonte/`. Il dit, dans cet ordre : **le
but de Pulse en une phrase**, **ce qui doit être validé en premier**, **à quoi
ressemble la version la plus simple qui le valide**, et **dans quel ordre les
briques suivantes s'ajoutent**.

Chaque affirmation pointe le ticket qui l'a tranchée. Rien ici n'est écrit de
mémoire : ce qui n'a pas de lien n'a pas été décidé.

Écrit le 2026-09-10, à la résolution du ticket
[21](issues/21-le-document-de-refonte.md).

---

## 1 · Le but de Pulse, en une phrase

> **Chaque semaine, le jour que tu choisis, Pulse te dit ce qui a bougé chez toi
> — campagnes et publications, tous canaux confondus — te propose quoi faire sur
> les thèmes que tu as mis en priorité, et te dit la semaine suivante si ça a
> marché.**

Et la ligne qui la suit, pour le compte qui n'a pas encore classé :

> *Sans thème, Pulse te donne le point de vue de la semaine. Les thèmes, c'est
> ce qui le fait parler ta langue.*

### Trois temps, et pourquoi ils sont dans cet ordre

| Temps | Ce que c'est | Existe sans thème ? |
|---|---|---|
| **Le constat** | Le point de vue de la semaine : ce qui a bougé sur les campagnes et les publications, tous canaux | **Oui** |
| **Le conseil** | Quoi faire, **uniquement** sur les thèmes prioritaires | Non |
| **Le retour** | Le Verdict de la semaine suivante sur ce qui a été fait | Non |

**Pulse n'arbitre pas entre les thèmes.** Décision durable, fichée en
[`docs/adr/0003`](../../docs/adr/0003-conseil-uniquement-sur-theme-prioritaire.md).
C'est le client qui désigne ses
priorités (trois maximum, `priority_label:<nom>` dans `insight_feedback`,
`actions.ts` l. 383-425) ; Pulse conseille à l'intérieur. Décidé par David le
2026-09-10 : *« Tu as le point de vue de la semaine — campagne x fonctionne
bien, une nouvelle campagne lancée, poste est bien. Les labels sont les recos
pour les labels prio. Fin. »*

**Conséquence sur `CLAUDE.md` §1**, appliquée : la promesse y était écrite *« où
mettre ses dix minutes cette semaine, et pourquoi »*, ce qui laisse croire que
Pulse choisit le sujet. Il ne le choisit pas. La ligne dit maintenant que Pulse
conseille **là où le client a mis ses priorités**.

### Ce que la phrase n'a pas le droit de dire

Deux formulations sont **mortes à l'écrit**, mesurées en
[02](issues/02-sur-quoi-se-differencient-les-autres.md) sur 10 produits et 70
sources primaires :

- ~~« toutes vos données au même endroit »~~ — un connecteur coûte 39 €/mois ;
- ~~« des recos pour améliorer vos campagnes »~~ — Google Ads, Meta (Opportunity
  Score) et GA4 le font **gratuitement, dans l'écran où on applique en un
  clic**. La catégorie « on te dit quoi faire » est prise mot pour mot
  (GoodMorning, 199 $/mois ; Opteo, 129→499 $/mois).

Le seul axe encore libre sur les dix produits lus : **l'arbitrage entre canaux
dans une seule réponse** — tous les concurrents sont mono-régie par naissance.
C'est ce que « tous canaux confondus » porte dans la phrase, et c'est le thème
qui le rend possible.

---

## 2 · Ce qui doit être validé en premier

**Que le fil de la semaine tienne de bout en bout, sans cul-de-sac.**
Tranché en [04](issues/04-ce-qui-doit-etre-valide-en-premier.md).

Ce n'est pas une fonctionnalité. Les trois candidates proposées (le classement,
le conseil pris, le carnet rempli) ont été écartées par David : ce sont des
**morceaux** du fil. Si le fil casse, un bon conseil ne sert à rien — personne
n'arrive jusqu'à lui.

Le fil, dans ses mots :

> *« Hebdomadaire : ha super, je vois ce qui est en ligne, j'ai un mini point de
> situation. Je vois que les postes sont moins bien en moyenne, je vais voir sur
> la plateforme et j'essaie de trouver seul. On scroll, ok je dois faire quoi
> cette semaine, parfait je prends note, je fais mes tâches. Semaine prochaine
> je pourrai regarder si cela a fonctionné. Une fois fait, je vais sur l'app et
> je valide ce que j'ai fait. Si j'ai fait cela hier et oublié, je peux valider
> à une date précise autre que quand je clique. »*

**Deux profils, un seul fil** : celui qui ne veut *que* l'hebdo, et celui qui
s'en sert de travail prémâché puis va creuser seul. Le second est la raison
d'être de la porte vers la plateforme ([09](issues/09-la-porte-vers-la-plateforme.md))
et du gabarit ([07](issues/07-gabarit-de-plateforme.md)).

**Le juge est David, sur son compte, sur de vraies données** — *« c'est moi qui
valide avec mon intuition, backé par ton expertise »*. Le fait qui ferme les
autres options : **Pulse ne mesure rien de ses utilisateurs** (aucune télémétrie
dans le dépôt, `last_sign_in_at` jamais lu, aucun email envoyé). Ajouter un
outil de mesure d'audience a été écarté : ce serait une brique avant la première.

**Le fil est un chemin conseillé, pas un rail** (David, 2026-09-10 : *« le user
peut faire ce qu'il veut dans l'ordre qu'il veut, mais je trouve essentiel
d'avoir une idée de comment le client doit faire pour pouvoir améliorer »*).
Une seule exception, gardée : **la connexion d'une source reste un gate dur** —
la passer ne donne pas de la liberté, ça donne un écran mort
([10](issues/10-l-entree-premier-ecran.md) : sans connexion `couverture.total = 0`,
le fil rend `null`).

---

## 3 · La version la plus simple qui valide

**Le fil d'une semaine, de bout en bout, sur un compte déjà branché — le tien.**
Rien de plus. Deux garde-fous posés en 04 : interdit de répondre « il faut
d'abord tout nettoyer » (un chantier de propreté ne valide aucune hypothèse), et
**ce qui casse le fil en fait partie même si c'est petit**.

### Avant d'écrire une ligne : deux tickets à résoudre

| Ticket | Pourquoi il bloque la v1 |
|---|---|
| [20 · À faire cette semaine](issues/20-a-faire-cette-semaine.md) | Le module qui se vide et **la date de réalisation choisie** sont sur le fil ; leur forme n'est pas tranchée |
| [22 · Rebrancher le plan de thème](issues/22-rebrancher-le-plan-de-theme.md) | Après [11](issues/11-d-ou-viennent-les-conseils.md), **une seule règle sur douze est une retouche** et trois des cinq clés « 10 min » sont mortes ([14](issues/14-le-conseil-facile-et-la-degradation.md)). Sans lui, le fil mène à une liste pauvre et on jugerait le mauvais coupable |

### Ce que la v1 contient

**a · L'entrée** — l'ordre du premier écran de celui qui revient
([10](issues/10-l-entree-premier-ecran.md), point 6) : Verdict → **bilan du
carnet** → rail des chantiers en cours → résumé IA **replié**. La prose IA est
ce qu'il y a de moins vérifiable sur la page et elle occupe aujourd'hui les
pixels les plus chers.

**b · Le point de vue de la semaine** — le constat, tous canaux. Il existe déjà.

**c · Les conseils, filtrés dur sur les thèmes prioritaires**
([11](issues/11-d-ou-viennent-les-conseils.md) + décision du 2026-09-10) :

- **cinq par semaine au maximum sur tout le compte** — un plafond, jamais un
  quota : on ne complète pas avec du non-prioritaire ;
- **filtre, pas tri.** Aujourd'hui `build_report.py` l. 442 trie en mettant
  `is_priority` en tête, mais les conseils des thèmes non prioritaires sortent
  quand même plus bas. Ils disparaissent ;
- **zéro priorité = module verrouillé**, qui dit « désigne un thème prioritaire
  pour recevoir des conseils » — jamais un module vide, jamais du décor
  ([04](issues/04-ce-qui-doit-etre-valide-en-premier.md), patron des modules
  verrouillés) ;
- **le conseil naît sur la carte du thème** ; le renvoi est une notification qui
  vit dans l'app, hors du rapport ;
- **`insights.py` gagne**, les deux autres moteurs de « ce qui marche chez toi »
  meurent (les deux règles de `reco_engine.py` et le recalcul TypeScript de
  `/instagram`) — trois moteurs, deux langages, trois jeux de seuils qui peuvent
  se contredire ;
- **plus aucun conseil mono-régie** (les régies le font gratuitement, dans
  l'écran du clic — [02](issues/02-sur-quoi-se-differencient-les-autres.md)) ;
- **les pistes inventées par l'IA sont coupées** — le seul endroit que rien ne
  peut vérifier.

**d · La composition des cinq** ([14](issues/14-le-conseil-facile-et-la-degradation.md)) :
1 à 2 Marches d'une Stratégie + des retouches à faible effort et fort enjeu.
**Un plafond, pas un plancher** : jamais plus de deux `créer`/`corriger` à
`effort ≥ 1 h`. `too_hard` simplifie, **le silence met en veille** (lire une
absence, c'est inventer une intention). Le moteur trie, **l'IA explique** —
`bloques` se branche (un argument), le persona garde le ton, jamais le tri.

**e · Le module « à faire cette semaine » qui se vide**
([20](issues/20-a-faire-cette-semaine.md)) — la récompense, c'est **la liste qui
raccourcit**, à chaque décision, « c'est fait » comme « pas pour moi »
([04](issues/04-ce-qui-doit-etre-valide-en-premier.md)). Pas d'animation, pas de
barre de complétion (refusée en [12](issues/12-module-de-commandes.md) : une
barre de progression peut *réduire* la complétion, et elle félicite d'avoir
cliqué — on ne fête que le mesuré).

**f · La validation à la date où on a agi** — défaut mesuré :
`resolveAction` écrit `done_at: isoDate(today)` et fixe l'échéance à ce jour + 14
(`app/actions.ts` l. 150-156). Faire le changement mardi et cliquer vendredi
décale la mesure de trois jours, **et le Verdict repose sur cette date**. Le
patron existe déjà dans `saveNote` (date libre, jamais dans le futur).

**g · La porte vers la plateforme** ([09](issues/09-la-porte-vers-la-plateforme.md)) —
elle part de la **carte du thème et d'elle seule**. Le lien emporte **le thème
ET la fenêtre du rapport** (sinon « 4 520 CHF » devient « 103 CHF » au clic et ça
se lit comme un bug). La page dit d'où on vient et propose d'y retourner. On ne
ramène rien. `/instagram` devient filtrable par thème (`ByLabelInsta` existe, il
manque le paramètre).

**h · Le carnet** ([08](issues/08-la-memoire-du-travail.md)) — module unique posé
partout, avec **auteur et campagne en base** (`suivi_actions` n'a aucune colonne
de campagne aujourd'hui). Une note entre dans la mémoire du thème, **jamais dans
le repondérage** : narratif ≠ mesuré. Une note du client **ne reçoit aucun
Verdict** — Pulse **marque**, le client **juge** (04 : juger la note obligerait
Pulse à choisir le chiffre à sa place, donc à inventer une intention).

**i · Le retour de la semaine suivante** — le rail des actions porte le cycle de
vie complet avec l'effet chiffré ([06](issues/06-le-parcours-comment-les-pages-se-parlent.md)).
**`preuve` meurt** : c'est un moteur concurrent, plus vieux et moins juste, qui
mesure sur le compte entier là où le rail mesure sur le thème. Le bilan
compte-entier devient un **comptage** de `suivi_actions.verdict` déjà persisté.

**j · Le client ne déclenche plus rien** ([08](issues/08-la-memoire-du-travail.md),
raison corrigée par [13](issues/13-entre-deux-jours-de-travail.md)) — les quatre
boutons sortent de l'app ; le déclenchement vit dans GitHub Actions, et un
prototype porte son propre bouton quand on travaille un sujet.

**k · Les trois dates en tête du rapport**
([13](issues/13-entre-deux-jours-de-travail.md)) : **mesuré du X au X · publié le
X · mis à jour le X** (`updated_at` existe et n'est jamais lu). Un rapport ne se
déclare **jamais** « périmé » : vieux ≠ faux.

### Ce que la v1 ne contient pas, et pourquoi

| Hors v1 | Raison |
|---|---|
| [10](issues/10-l-entree-premier-ecran.md) la mise en place | Ne sert qu'à quelqu'un qui n'est pas toi — tu es déjà branché |
| [18](issues/18-passer-en-production.md) la Production | Même raison ; démarre en parallèle (§4) |
| [12](issues/12-module-de-commandes.md)/[15](issues/15-le-bandeau-en-variantes.md) le bandeau | Uniformisation, pas un cul-de-sac : la porte de 09 marche déjà via `?label=` |
| [07](issues/07-gabarit-de-plateforme.md) les six rangs | Idem — le gabarit range, il ne débloque rien |
| [17](issues/17-ce-qui-se-regroupe-et-ce-qui-est-mesure.md) le recalcul à la lecture | Le rapport se refait au Jour de travail : c'est une discontinuité, pas une rupture |
| [16](issues/16-compteur-partage.md) le compteur partagé | Migration, et tu es seul sur ton compte |
| [19](issues/19-module-mes-notes.md) les notes sur la courbe | Décidé dans son principe, pas dans sa forme |
| [23](issues/23-recolte-des-quatre-manques.md) les quatre récoltes | Ajoute des conseils, ne répare aucun cul-de-sac |

---

## 4 · L'ordre des briques, et à quelle condition chacune s'ajoute

Le principe qui tient ce tableau : **rien ne se construit pour un client qui
n'existe pas encore**, et une brique dont la condition n'est pas remplie attend
— elle ne se glisse pas en avance.

| # | Brique | Condition d'entrée |
|---|---|---|
| **0** | [18](issues/18-passer-en-production.md) **Production Google/Meta** | **Démarre maintenant**, en parallèle, hors du fil |
| **—** | ~~[20](issues/20-a-faire-cette-semaine.md) et [22](issues/22-rebrancher-le-plan-de-theme.md)~~ **résolus le 2026-09-10** | Plus rien à décider avant la v1 : il n'en reste que de la construction |
| **1 bis** | [24](issues/24-conseils-payants-manquants.md) les conseils payants | Avant qu'un client **sans Instagram** voie la v1 — 22 a mesuré qu'il n'en reçoit qu'**un** |
| **1** | **La v1** — le fil de la semaine (§3) | Rien : c'est le point de départ |
| **2** | [10](issues/10-l-entree-premier-ecran.md) la mise en place | Quand 18 aboutit — elle ne sert qu'à un client extérieur |
| **3** | [17](issues/17-ce-qui-se-regroupe-et-ce-qui-est-mesure.md) le recalcul à la lecture | Quand un deuxième client classe entre deux Jours de travail |
| **4** | [07](issues/07-gabarit-de-plateforme.md) + [12](issues/12-module-de-commandes.md)/[15](issues/15-le-bandeau-en-variantes.md) | Après quelques semaines de fil réellement parcouru |
| **5** | [16](issues/16-compteur-partage.md) le compteur partagé | Au premier compte à deux personnes — c'est une migration |
| **6** | [19](issues/19-module-mes-notes.md) mes notes sur la courbe | Quand des notes existent en base |
| **7** | [23](issues/23-recolte-des-quatre-manques.md) les quatre récoltes | Quand le stock de conseils faciles s'épuise, 22 étant en service — à croiser avec [24](issues/24-conseils-payants-manquants.md) |

### Pourquoi 18 démarre maintenant sans être une brique du fil

En statut **Testing**, le refresh token Google meurt à **7 jours** pour tout
scope autre que nom/email/profil — `adwords` et `analytics.readonly` en sont
([04](issues/04-ce-qui-doit-etre-valide-en-premier.md), source primaire Google).
Donc le worker hebdomadaire casse par construction chaque semaine, **y compris
sur ton compte**.

Ce qui débloque la validation sans attendre : le bouton **« Reconnecter »**
existe déjà (`app/comptes/page.tsx` l. 353 et 373). Tu recliques avant chaque
Jour de travail ; une semaine oubliée est une semaine de données perdue.
En face, `adwords` est classé **restricted** : la vérification complète impose
une évaluation **CASA annuelle par un tiers agréé**. Le délai est administratif,
pas technique — c'est pour ça qu'il commence maintenant et qu'il n'attend rien.

---

## 5 · Le sort des thèmes

**Le thème n'est pas un rayon qu'on garde ou qu'on coupe : c'est un
multiplicateur.** Chaque dashboard vit sans lui et **gagne un module** avec lui
([08](issues/08-la-memoire-du-travail.md), correction de David : *« les thèmes ne
découpent pas l'application en deux axes, ils DÉBLOQUENT des modules »* — coûts
par plateforme, puis coûts par thème ; posts individuels, puis moyenne par
thématique).

**Ce que Pulse vaut pour un compte qui ne classe jamais** — la question ouverte
depuis [03](issues/03-le-but-de-pulse.md), fermée ici :

- il reçoit **le point de vue de la semaine** : ce qui a bougé sur ses campagnes
  et ses publications, ses chiffres, ses courbes, son carnet ;
- il ne reçoit **aucun conseil**. Le chemin compte-entier déterministe existe
  toujours dans le code (`build_recos`, `build_report.py` l. 2048) et n'est
  volontairement pas rebranché : un conseil compte-entier retombe exactement
  dans ce que Google et Meta donnent **gratuitement**
  ([02](issues/02-sur-quoi-se-differencient-les-autres.md)) ;
- les modules par thème sont **visibles et verrouillés**, avec écrit dessus ce
  qu'un thème débloque ([04](issues/04-ce-qui-doit-etre-valide-en-premier.md) :
  *« ha voilà, je débloque quelque chose de super »*). Le classement se vend **à
  l'endroit où le bénéfice se voit**, jamais sur une page de réglages — aucun
  des dix produits lus en 02 ne le fait.

**Ce qu'on a le droit de promettre** : la **rétroactivité**. Le thème vit sur la
configuration de la campagne, jamais sur les lignes de chiffres ; le rattachement
se fait par jointure à la lecture. Classer rattache d'un coup **90 jours de
dépense** et **tout l'historique de revenu** — deux fenêtres différentes, piège
de formulation. Seule limite : baselines, snapshots et Verdicts ne rétroagissent
pas.

---

## 6 · La doc du produit : la table des matières, pas le contenu

[05](issues/05-carte-du-savoir.md) a tranché qu'**on n'exhume aucun des six
documents supprimés au commit `7f188f3`** (David : *« tout ce qui est avant, on
oublie ; on veut créer une base saine »*) et que la structure propre s'écrit
**à la sortie de cette carte**, thématique par thématique. C'est ce document qui
la déclenche.

Les thématiques à écrire, chacune à partir du ticket qui l'a décidée — et
**chacune quand sa brique est construite**, jamais avant :

| Doc à écrire | Sa source |
|---|---|
| La mise en place | [10](issues/10-l-entree-premier-ecran.md) |
| Le fil de la semaine | [06](issues/06-le-parcours-comment-les-pages-se-parlent.md), [04](issues/04-ce-qui-doit-etre-valide-en-premier.md) |
| Le gabarit d'une plateforme | [07](issues/07-gabarit-de-plateforme.md), [09](issues/09-la-porte-vers-la-plateforme.md) |
| D'où viennent les conseils | [11](issues/11-d-ou-viennent-les-conseils.md), [14](issues/14-le-conseil-facile-et-la-degradation.md), [22](issues/22-rebrancher-le-plan-de-theme.md) |
| Le carnet | [08](issues/08-la-memoire-du-travail.md) |
| Le bandeau de commandes | [12](issues/12-module-de-commandes.md) |
| Ce qui se regroupe, ce qui attend | [13](issues/13-entre-deux-jours-de-travail.md), [17](issues/17-ce-qui-se-regroupe-et-ce-qui-est-mesure.md) |

Ce qui ne se périmera jamais est déjà sorti : [`docs/mesures-impossibles.md`](../../docs/mesures-impossibles.md).

---

## 7 · Ce que ce plan ne dit pas

- **Le code.** Cette carte produit un plan ; la construction se charte après,
  comme une carte neuve.
- **La forme des modules.** Trois tickets décidés dans leur principe attendent
  leurs variantes cliquables : [15](issues/15-le-bandeau-en-variantes.md),
  [19](issues/19-module-mes-notes.md), [20](issues/20-a-faire-cette-semaine.md).
  Une refonte de module se propose **en variantes comparables**
  (`PrototypeSwitcher`), pas en description.
- **La récolte** (`saas/collecte/`) — David la dit bonne, hors périmètre. Seul
  [23](issues/23-recolte-des-quatre-manques.md) y **ajoute**, sans rien corriger.
