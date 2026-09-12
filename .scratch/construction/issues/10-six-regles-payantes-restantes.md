# Les six règles payantes restantes

Type: task
Status: resolved
Blocked by: 07

## Question

**Tranché par [24](../../refonte/issues/24-conseils-payants-manquants.md)**, qui
a décidé dix règles et en a fait livrer quatre d'abord (ticket **07**). Voici les
six autres.

| clé | ce que le client lit | geste | levier | preuve |
|---|---|---|---|---|
| `adset_inegal` | ton Groupe « Retargeting » coûte 3× « Lookalike » | tester | audience | **à mesurer** |
| `theme_deux_regies` | ce thème rend 4× mieux sur Google — bascule 25 % | tester | argent | **à mesurer** |
| `budget_non_depense` | 25 CHF/jour posés, 9 dépensés | corriger | argent | constatable |
| `annonce_usee` | même personne touchée 2,3×/jour, le clic double | créer | contenu | constatable |
| `page_arrivee_muette` | 640 clics envoyés, GA4 en compte 180 | corriger | socle | constatable |
| `creneau_pub` | le dimanche coûte 2× la semaine | corriger | tempo | constatable |

### Pourquoi elles passent en second

Elles ne se livrent pas seules : certaines portent un seuil qui n'est pas déjà
dans `SEUILS`, et les deux marquées **« à mesurer »** ouvrent une Stratégie — donc
elles dépendent du plan de thème rebranché (ticket **06**).

**Le fait qui les débloque** : `docs/mesures-impossibles.md` §1 était faux — la
date **EST** dans `ga4_insights`, c'est `build_ga4_context` qui l'écrase. Le
revenu hebdomadaire d'un thème devient mesurable, **donc un compte payant peut
enfin ouvrir une Stratégie**. Avant ce constat, seules les clés organiques le
pouvaient (22).

### Les deux pièges nommés d'avance

- **`annonce_usee` repose sur la fréquence, donc sur `reach`** — des personnes
  **dédoublonnées**, qui ne se somment pas. Toute tentative future d'ajouter un
  breakdown Meta à la même table la fausserait sans rien lever
  ([23](../../refonte/issues/23-recolte-des-quatre-manques.md), hors périmètre
  ici, mais le relevé vaut avertissement).
- **`page_arrivee_muette` nomme un écart, pas une page** : GA4 n'a aucune
  dimension de page aujourd'hui (`fetch_ga4.py:86`). La règle dit « ta page perd
  des gens », elle **ne peut pas dire laquelle** — et l'écrire quand même serait
  un chiffre fabriqué.

### Consigne de repli

Les quatre `constatable` d'abord, les deux `à mesurer` ensuite : elles dépendent
d'une Stratégie ouverte, donc du ticket 06 réellement en service.

## Answer

Les six règles sont écrites, branchées et vérifiées — **343 vérifications**,
aucune base, aucun secret, aucun réseau
([harnais](../harnais/10-six-regles/LISEZMOI.md)). Les **189** du harnais 07 et
les **342** du harnais 06 sont rejouées sans régression. Le moteur payant passe
de quatre règles à **dix**.

**Le repli n'a pas eu à s'appliquer** : le ticket 06 est en service depuis
[son commit](06-rebrancher-le-plan-de-theme.md), donc les deux règles « à
mesurer » pouvaient partir avec les quatre autres. Elles sont là.

### Les six — `saas/recos_ia/regles_payantes.py`

| clé | ce qui déclenche | geste · levier · preuve · indicateur · durée |
|---|---|---|
| `budget_non_depense` | posé ≥ 2 × dépensé, et ≥ 50 CHF qui dorment | corriger · argent · constatable · roas · 10 min |
| `annonce_usee` | plancher de fréquence ≥ 2,5 **et** clic +20 % vs la semaine d'avant | créer · contenu · constatable · cpc · 1 h |
| `page_arrivee_muette` | GA4 sous la moitié des clics facturés | corriger · socle · constatable · **aucun** · 30 min |
| `creneau_pub` | un jour à ≥ 2 × le clic des six autres, sur 4 semaines | corriger · tempo · constatable · cpc · 30 min |
| `adset_inegal` | un Groupe à ≥ 2 × le clic de ses voisins, dans une même campagne | tester · audience · **à mesurer** · cpc · 30 min |
| `theme_deux_regies` | une régie qui rend ≥ 4 × l'autre, attribution complète des deux côtés | tester · argent · **à mesurer** · roas · 30 min |

**Un compte qui ne fait que de la publicité ouvre enfin une Stratégie.**
C'était l'exigence n° 4 de
[24](../../refonte/issues/24-conseils-payants-manquants.md) : avant ce ticket,
les deux seules clés dont la preuve était « à mesurer » étaient organiques
(`orga_essoufflement`, `page_endormie`), donc un compte sans Instagram
n'ouvrait jamais de plan de thème et Gemini n'avait aucune Marche suivante à
écrire chez lui. `adset_inegal` et `theme_deux_regies` la lui donnent.

### Les seuils : quatre neufs, quatre évités, et tous sourcés

Le ticket disait que ces six règles « portent un seuil qui n'est pas déjà dans
`SEUILS` ». C'est vrai pour quatre d'entre eux ; **les quatre comparaisons de
coût n'en ont finalement demandé aucun.** `cpc_ratio` dit déjà « 2×, ce n'est
plus du bruit » sur de l'argent, et c'est exactement ce que comparent un Groupe
d'annonces, un jour de semaine et un budget posé. Les « 3× » et « 2× » des
exemples de 24 décrivent **ce que le client lit**, pas le seuil qui déclenche —
et pour `budget_non_depense`, 2× est littéralement le nombre de David
(*« c'est 2 fois plus que la dépense moyenne »*, décision 6).

Les quatre nombres neufs vivent dans `SEUILS` (`reco_engine.py`), chacun avec
sa source écrite à côté :

- **`freq_plancher` = 2,5** — la convention du métier sur Meta en prospection
  (la performance baisse au-delà de 2,5 vues par personne et par semaine,
  s'effondre au-delà de 4). **Et le commentaire dit ce que la recherche dit
  aussi** : l'origine de ce 2,5 ne se retrouve dans aucune étude ni aucune
  documentation de plateforme — c'est une convention d'agences répétée jusqu'à
  faire règle. On s'en sert parce qu'il n'y a pas mieux, et parce que la règle
  qui le lit compare un **plancher** de fréquence, jamais une fréquence exacte.
- **`freq_cpc_hausse` = 1,2** — la fatigue publicitaire est mesurée à ~+20 % de
  CPC. Sans cette seconde condition, une audience volontairement étroite (du
  retargeting) se ferait dénoncer alors qu'elle marche très bien.
- **`arrivee_perte_max` = 0,5** — Google documente 10 à 20 % d'écart clics/
  sessions comme normal et « au-dessus de 30 % » comme le signe d'un problème
  technique. On parle à **50 %**, deux fois plus prudent, parce que la règle
  additionne Meta et Google : un clic Meta perd plus de monde qu'un clic Google
  (navigateur intégré, App Tracking Transparency), et 30 % ferait parler cette
  règle toutes les semaines sur un compte parfaitement taggé.
- **`regie_roas_ratio` = 4,0** — le nombre que 24 a écrit pour cette règle, et
  pas le 2× des comparaisons de coût : le revenu GA4 est attribué au dernier
  clic, ce qui déplace mécaniquement du revenu de Meta vers Google. Un écart de
  2× peut n'être que ce biais ; le 4× lui laisse la place qu'il prend.

**Ce qui n'a pas changé depuis 24, et il faut le redire** : aucune règle payante
n'a jamais tourné sur un vrai compte (ticket [16](16-le-seam-du-payload.md) pas
ouvert). Ces quatre nombres sont des **points de départ argumentés, pas des
valeurs observées** — c'est écrit dans `SEUILS`, dans le module et dans le
harnais. Les changer est une ligne.

### Les deux pièges du ticket, et ce qu'ils ont imposé

**`annonce_usee` ne calcule pas une fréquence, elle calcule un PLANCHER — et
c'est mathématiquement exact.** `reach` compte des personnes dédoublonnées :
quelqu'un touché lundi et mardi est une personne, pas deux. La portée unique de
la semaine n'existe nulle part par annonce, et aucune API ne la donne. On
calcule donc *impressions de la semaine ÷ somme des portées quotidiennes* — et
comme cette somme est toujours **plus grande** que la portée unique, le rapport
est toujours **plus petit** que la vraie fréquence. Quand ce plancher dépasse
déjà 2,5, la vraie fréquence le dépasse aussi. **La règle se tait donc plus
souvent qu'elle ne le devrait, jamais l'inverse.** Le titre, l'observation et
l'angle mort disent tous les trois « au moins », et le harnais le vérifie.

**`page_arrivee_muette` ne nomme jamais une page, et elle le dit.** GA4 n'a
aucune dimension de page dans ce qu'on récolte. Son angle mort commence par
*« Je ne peux pas te dire QUELLE page perd les gens »*, et un test vérifie
qu'aucune URL n'apparaît nulle part dans son texte.

### Ce que la donnée a imposé, et qui n'était pas dans le ticket

**`adset_inegal` ne compare plus à une médiane, et c'est une correction, pas un
goût.** La première version comparait le Groupe le plus cher à la médiane des
Groupes de sa campagne. Sur une campagne à **deux** Groupes, la médiane vaut
leur moyenne : la condition devient « a ≥ a + b », donc impossible. **La règle
n'aurait jamais parlé sur le cas le plus courant** — un Groupe à 40 CHF le clic
à côté d'un Groupe à 1 CHF serait resté muet. Le repère est maintenant le prix
du clic des **autres** Groupes, pondéré par leurs clics : la même mécanique que
`regle_annonce_locomotive`, qui n'a jamais souffert du défaut parce qu'elle a
toujours été écrite comme ça. **Le même défaut reste dans `regle_annonce_chere`
(ticket 07)** → ticket [30](30-la-mediane-sur-deux-valeurs-ne-parle-jamais.md).

**`theme_deux_regies` se tait dès que l'attribution d'un canal est trouée, et
ce n'est pas une précaution de confort.** Le revenu d'une campagne n'entre que
si GA4 la retrouve **par son nom** ; une campagne étiquetée dont l'`utm_campaign`
ne correspond plus verse sa dépense sans jamais verser son revenu — c'est le
fait mesuré par [18](18-revenu-google-non-rattachable.md). La règle dirait alors
« l'autre régie rend quatre fois mieux » alors qu'on a simplement perdu le
revenu d'une campagne : un chiffre fabriqué au sens du §7. Le lecteur
`_regies_theme` pose donc un drapeau `complet` — vrai seulement quand **toutes**
les campagnes dépensières du thème, sur ce canal, ont été retrouvées côté GA4 —
et un **second** cas rend les deux canaux incomplets : un nom de campagne porté
par les deux régies, puisque GA4 indexe par nom et que le même revenu serait
versé aux deux numérateurs.

**Ce lecteur ne tranche pas la question du ticket 18 et ne la contourne pas** :
il ne change rien à la façon dont la dépense est comptée ailleurs (la page
Coûts, `build_matrix`, le ROAS affiché d'un thème sont intacts), il refuse
seulement de faire parler **une** règle neuve sur une attribution dont il sait
qu'elle est trouée. 18 nomme trois options et appelle « se taire » la plus
honnête ; c'est celle-ci, appliquée localement, et elle laisse la décision de
David entière.

**`page_arrivee_muette` ne prend pas une des trois places du thème.** Son levier
est `socle` — c'est un prérequis de **mesure**, et 24 l'avait écrit : *« elle
répare la mesure dont toutes les autres dépendent »*. Elle est donc routée vers
le bloc « réglages », à côté de « connecte Google Analytics », par le même patron
que `_constat_cout` qui sort de la boucle des thèmes pour rejoindre les constats.
Et **une seule sort par rapport** : un tag absent d'une page d'arrivée ne se
produit pas « par thème », trois thèmes prioritaires auraient affiché trois fois
la même réparation. C'est celle qui perd le plus de clics qui se lit.

**Elle est aussi la seule des dix sans indicateur, et c'est voulu.** Lui donner
`roas` ou `purchases` reviendrait à juger sa réussite avec le chiffre qu'elle
vient justement de déclarer faux. Même raison que `connecter_ga4` et `ga4_muet`.

**`budget_non_depense` déclare `roas`, pas `spend`, et ça mérite une phrase.**
`spend` était le réflexe, mais son sens d'amélioration est « down »
(`METRIC_INFO`, table unique) : une dépense qui **remonte** vers le budget posé
se serait lue comme un échec. L'argent qui dort ne coûte rien, il ne rapporte
rien non plus — ce qu'on remesure est ce que le thème rend une fois cet argent
remis en circulation.

**`annonce_usee` est la seule des dix au-dessus de 30 minutes, et c'est un écart
assumé avec 24** (décision 8 : *« aucune règle payante au-dessus de 30 min »*).
Elle demande de **fabriquer** une créa. Ses voisines organiques qui demandent la
même chose sont toutes à « 1 h » (`silence`, `orga_format`,
`orga_essoufflement`) : lui coller « 30 min » pour tenir une estimation écrite
avant que la règle existe ferait mentir la pastille sur ce qu'elle coûte. Le bac
**« 2 h+ » reste vide côté pub**, et c'est bien ce que la décision protégeait.

### L'arbitre des collisions passe de deux cas à six

Dix règles peuvent tomber sur le même objet, et la carte d'un thème n'a que trois
places. Ce qui s'ajoute aux deux cas du ticket 07 :

- **usée ET chère, même Annonce** — les deux constatent le même clic trop cher,
  une seule en donne la cause et le geste qui la répare. On garde l'usure ;
- **usée ET locomotive, même Annonce** — « remplace-la » contre « finance son
  Groupe » : même contradiction que locomotive+chère, même issue, on ne sert ni
  l'une ni l'autre ;
- **Groupe inégal ET annonce chère DANS ce Groupe** — si le prix du Groupe est
  tiré par UNE de ses annonces, ce n'est pas l'audience qui coûte cher, c'est la
  créa : `adset_inegal` conclurait faux, elle s'efface ;
- **budget qui dort ET budget qui déborde, même thème** — servis ensemble ils se
  lisent comme une contradiction. Le fait du thème gagne : c'est lui qui a une
  date, la fin du mois.

**Et une seule Stratégie par thème.** `adset_inegal` et `theme_deux_regies`
portent toutes deux `role="hypothese"` : servies ensemble, la carte afficherait
deux théories concurrentes et `theme_plan` n'en suivrait qu'une, au hasard de
l'ordre de tri. On garde celle qui a le plus d'argent en jeu. **Le cas général
n'est PAS réglé ici** — `orga_essoufflement` et `page_endormie` peuvent encore
entrer en concurrence avec elles sur le même thème, et c'est le ticket
[27](27-l-hypothese-d-une-regle-peut-changer-chaque-semaine.md), dont ce ticket
augmente l'exposition : il n'y avait que deux clés à Hypothèse, il y en a quatre.

### Les cinq lectures, aucune récolte nouvelle

Tout était déjà en base. `_budget_campagnes_theme` (le budget posé **par
campagne**, là où `_budget_theme` répond pour le thème sur le mois),
`_usure_theme` (Meta, avec la portée quotidienne et le prix du clic de la
semaine d'avant), `_creneaux_theme` (Meta, 28 jours, par jour de semaine),
`_arrivee_theme` (clics payés contre sessions GA4) et `_regies_theme`. Trois
gardes valent d'être nommées :

- **`_usure_theme` garde sur `ad_id` ET sur `reach`.** Sans `ad_id`, regrouper
  par nom rejouerait le bug des homonymes dans le moteur de conseils (ticket
  03) ; sans `reach`, il n'y a pas de fréquence du tout. Et une portée
  **absente** n'est pas une portée nulle : la ligne entre pour sa dépense, elle
  ne gonfle pas le dénominateur.
- **`_budget_campagnes_theme` écarte les campagnes EN PAUSE et les campagnes
  JEUNES.** Une campagne en pause ne dépense pas son budget et c'est normal — la
  dénoncer chaque semaine serait du bruit. Une campagne en rodage consomme mal :
  c'est le même garde-fou que le geste « couper », étendu aux gestes qui ne
  coupent pas.
- **`_creneaux_theme` et `_usure_theme` ne lisent que Meta.** Pour l'usure c'est
  la donnée qui l'impose (Google n'a pas de portée) ; pour le créneau c'est une
  condition de 24 — on ne récolte pas la stratégie d'enchère d'une campagne
  Google, et brider les horaires d'une enchère automatique la dégrade au lieu de
  l'aider.

Chaque lecture est protégée **séparément** : une table absente ou une colonne
qui manque fait taire SA règle, pas les cinq autres.

### Ce que la revue de code a rendu, et ce que j'en ai fait

**Six relevés, six corrigés** — un l'était déjà avant qu'elle rende. Les trois
premiers étaient des chiffres faux au sens du §7, c'est-à-dire exactement ce que
ces règles existent pour ne pas produire :

- **`page_arrivee_muette` comparait deux populations différentes.** Les clics
  venaient de TOUT le thème, les sessions seulement des campagnes que GA4 sait
  rattacher — or `by_campaign` n'est rempli que pour un `medium` cpc/ppc/paid
  portant un `utm_campaign` connu, et **Meta ne pose aucun paramètre de campagne
  tout seul**. Un thème Meta sans UTM affichait donc « 2 000 clics (100 %)
  n'arrivent nulle part » et accusait la balise d'une page qui marche.
  `_arrivee_theme` **intersecte** maintenant les deux côtés : on ne compare que
  les campagnes que GA4 rattache déjà. Ce que ça laisse dehors — une campagne
  dont les liens n'ont aucun paramètre — est un vrai problème, mais pas celui de
  cette règle, et le distinguer de « pas de trafic » demande une mesure qu'on
  n'a pas.
- **Le « plancher » de fréquence pouvait dépasser la vraie fréquence.** Une
  portée absente était sautée au dénominateur, mais ses impressions restaient au
  numérateur : une annonce diffusée sept jours dont deux seulement ont une
  portée enregistrée donnait un nombre **trois fois trop grand**, affiché sous
  la mention « au moins ». L'invariant que le module promet noir sur blanc était
  faux. **Une seule journée sans portée et l'annonce sort entièrement** — on
  préfère la perdre.
- **Un titre cassé.** Quand une régie ne rapporte rien, `theme_deux_regies`
  écrivait *« Meta rapporte, l'autre pas que Google »* : la phrase de cette
  branche se glissait dans le gabarit de l'autre. Les deux titres s'écrivent
  maintenant séparément, et le test compare la phrase entière.
- **Deux `cible` qui n'étaient pas propres au thème.** `theme_deux_regies`
  posait `meta->google` (deux valeurs pour tout le compte) et `creneau_pub`
  posait `dimanche` (sept) : un conseil servi sur « Été » aurait muselé le même
  déséquilibre, réel et différent, sur « Hiver », pendant huit semaines. Les
  deux portent maintenant le thème. C'est le même défaut que le ticket
  [31](31-un-conseil-sans-cible-ne-sort-qu-une-fois.md) relève ailleurs, en
  plus discret parce que la cible existait.
- **`creneau_jours_min` = 4 sur une fenêtre qui donne exactement 4.** Vingt-huit
  jours contiennent exactement quatre lundis : une journée en pause, une journée
  sans diffusion ou un trou de récolte, et le jour tombait à trois — la règle se
  taisait pour une raison qui n'a rien à voir avec son prix. La fenêtre passe à
  **cinq semaines** pour pouvoir en perdre une ; le seuil, lui, ne bouge pas.
- **Le repère d'`adset_inegal` mélangeait deux ensembles** — déjà corrigé avant
  que la revue rende : un Groupe sans un seul clic versait sa dépense au repère
  sans y apporter de clics.

### Le conflit qu'il faut porter à David, et il n'est pas petit

**`docs/mesures-impossibles.md` dit qu'un ROAS affiché par canal serait une
invention tant que la règle d'attribution n'est pas choisie. `theme_deux_regies`
en affiche un.** Les deux phrases ont été écrites le même jour par le même
ticket de la refonte (24) — c'est un écart interne à la décision, pas une
désobéissance à elle.

**La règle est livrée**, parce que 24 est la décision de David et que la carte
interdit de la rouvrir soi-même, et elle est livrée sous les gardes les plus
dures qu'on ait su écrire : attribution complète des deux côtés, aucun nom de
campagne partagé entre les régies, écart d'au moins 4×, biais du dernier clic
nommé dans le `pourquoi`, geste réduit à un transfert partiel à tester. La
lecture retenue est qu'**un conseil qui porte son angle mort n'est pas un KPI
posé sur un tableau de bord**. Elle peut être la mauvaise : la question part
telle quelle à David →
[32](32-un-conseil-compare-deux-regies-que-le-tableau-de-bord-refuse-de-separer.md),
et `docs/mesures-impossibles.md` porte maintenant le fait sous le paragraphe
qu'il concerne, pour que la limite ne se périme pas en silence — c'est la leçon
que ce document tire de lui-même.

### Ce qui sort en ticket

- [32 · Un conseil compare deux régies que le tableau de bord refuse de
  séparer](32-un-conseil-compare-deux-regies-que-le-tableau-de-bord-refuse-de-separer.md)
  — **HITL**, la question ci-dessus.
- [30 · Une médiane calculée sur deux valeurs ne peut jamais franchir son
  ratio](30-la-mediane-sur-deux-valeurs-ne-parle-jamais.md) — le défaut corrigé
  dans `adset_inegal` vit encore dans `regle_annonce_chere` (ticket 07).
- [31 · Les quatre règles du ticket 07 n'ont pas de cible, elles ne sortent
  qu'une fois](31-un-conseil-sans-cible-ne-sort-qu-une-fois.md) — leur empreinte
  est `(clé, "")`, donc une annonce chère servie une fois consomme la clé pour
  tous les thèmes et toutes les semaines. **Et ça dépasse le ticket 07** : sauf
  `theme_event_cout`, aucune règle du dépôt ne pose de cible. À compter avant de
  corriger.

### Vérifications

- **343 vérifications** (harnais 10), **189** (harnais 07, rejouées) et **342**
  (harnais 06, rejouées). Deux assertions ont été assouplies ailleurs, et les
  deux le disent sur place : `test_branchement.py` (l'appel à l'orchestrateur
  s'écrit autrement depuis que `page_arrivee_muette` est routée à part) et
  `test_indicateur_sans_proof_kpi.py` (cinq clés neuves nommées ; une sixième qui
  apparaîtrait sans ticket ferait toujours tomber le test).
- `python3.12 -m py_compile` vert sur `build_report.py`, `reco_engine.py`,
  `regles_payantes.py`, `insights.py`, `composition.py`, et l'import réel de
  `build_report` passe.
- **`saas/web` n'a pas été vérifié, et n'avait pas à l'être : aucun fichier
  TypeScript n'est touché par ce ticket.** L'arbre de travail en porte beaucoup
  d'autres, qui ne sont pas de ce chantier.
- **Aucune des six règles n'a tourné sur de vraies données**, et `build_payload`
  n'a pas tourné non plus — c'est le ticket [16](16-le-seam-du-payload.md). Les
  cinq lectures neuves sont des closures de `build_payload` : elles sont
  vérifiées **par lecture seule et par texte source**, jamais exécutées.
- **Aucune migration, aucune récolte nouvelle, rien de joué en base.**
- **Deux documents de savoir ont bougé, et les deux le disent sur place.**
  `CONTEXT.md` gagne **Vues par personne** — le mot « fréquence » y est
  explicitement déconseillé, parce que c'est le nom de la valeur qu'on ne sait
  PAS calculer. `docs/mesures-impossibles.md` gagne **« Quelle page d'arrivée
  perd les gens »** (aucune dimension de page côté GA4 tant que 23 n'est pas
  pris) et le fait du ticket 32 sous le paragraphe qu'il concerne.
  **Ces deux fichiers ne sont PAS dans le commit de ce ticket, et il faut le
  dire** : ils portaient déjà, avant cette session, un gros travail de
  documentation non commité (tout le vocabulaire de la refonte pour l'un, le
  fichier entier pour l'autre, qui n'est pas encore suivi par git). Commiter
  mes lignes aurait emporté ce travail-là avec elles. Les deux modifications
  sont écrites et dans l'arbre de travail ; elles partiront avec le commit de la
  documentation.
- Une correction du traitement **ne se voit qu'après un « ↻ Recharger mes
  conseils »**.
