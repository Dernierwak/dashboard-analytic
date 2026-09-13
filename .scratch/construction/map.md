# Construction : le fil d'une semaine, en service

## Destination

**La v1 du plan de refonte en service sur le compte de David** : le fil d'une
semaine parcouru de bout en bout, sur de vraies données, **sans cul-de-sac** —
du premier écran au verdict de la semaine suivante.

Fin de carte = les quinze tickets construits et vérifiés, le fil parcouru une
fois en entier par David, et son jugement rendu. Ce que 04 a tranché : **le juge
est son jugement, pas un chiffre** — Pulse ne mesure rien de ses utilisateurs, et
on n'ajoute pas d'outil de mesure d'audience pour ça.

**La spec de cette carte est [`spec.md`](spec.md)** — le document unique de la
v1, écrit le 2026-09-11 par `/to-spec` à partir de la carte de refonte. Elle ne
décide rien : elle rassemble en un endroit ce que les vingt-et-un tickets de la
refonte ont tranché, pour qu'un agent qui prend un ticket d'ici sache ce que son
morceau sert. **En cas d'écart entre la spec et un ticket de la refonte, le
ticket gagne** — il porte la mesure, la date et les mots exacts de David.

La carte de refonte — [`../refonte/map.md`](../refonte/map.md) — est **fermée** :
21 tickets résolus, destination atteinte
([`plan-de-refonte.md`](../refonte/plan-de-refonte.md)). Cette carte-ci ne décide
plus rien de ce qu'elle a tranché ; elle le bâtit.

## Notes

### Cette carte EXÉCUTE — c'est l'exception, pas la règle

Wayfinder planifie par défaut. **Cette carte est l'exception prévue** : ses
tickets ne résolvent pas des décisions, ils livrent du code vérifié. Le plan le
prescrit lui-même — *« la construction se charte comme une carte neuve »*.
Tous les tickets sont donc de type `task`.

### La règle qui tient toute la carte

**Chaque ticket pointe le ticket de la refonte qui l'a tranché, et ne le
re-litige pas.** Une session qui rouvre une décision déjà prise travaille à
l'envers — s'il faut y revenir, ça se dit à David, ça ne se glisse pas.

Si le code contredit la décision, **c'est un fait, pas une permission** : on le
remonte dans le ticket et on demande. Quatre tickets de la refonte sur cinq ont
trouvé une prémisse fausse ; celle qu'on trouvera ici vaut la même attention.

### Vérifier avant de dire que c'est fait — `CLAUDE.md` §9

- `saas/web` : `rm -rf .next tsconfig.tsbuildinfo`, puis `npx tsc --noEmit` **et**
  `npm run build` verts, **19 routes**. Un écart signale une page de contrôle
  oubliée. *(19 depuis que 18 a publié `/privacy`, `/terms`, `/suppression`.)*
- Python : `python3.12 -m py_compile` sur ce qui a été touché. **`python3.12`,
  jamais `python3`.**
- Une correction du traitement ne se voit **qu'après un « ↻ Recharger mes
  conseils »**, une correction de récolte après « ↻ Mes données ». Le dire à
  chaque fois — **jusqu'à ce que le ticket 15 retire ces boutons**.
- Ce qui n'a pas pu être vérifié se dit franchement. Pas de résultat prédit.

### Le partage des fichiers — la contrainte qui commande le parallélisme

**Trois agents au maximum, et jamais deux sur les mêmes fichiers.** Les arêtes de
blocage de cette carte sont posées autant pour ça que pour la logique :
`build_report.py` (4 775 l.), `reco_engine.py` et `supabase/migrations/` sont des
goulots où deux sessions concurrentes se marchent dessus.

### Ce qui ne se négocie jamais ici

`CLAUDE.md` §7, et deux points mordent particulièrement sur cette carte :

- **Aucun chiffre fabriqué.** Une absence de donnée n'est pas un zéro, un
  « +∞ % » n'existe pas. **Trois tickets de cette carte existent parce qu'un
  chiffre faux est à l'écran aujourd'hui.**
- **Rien de destructeur sans regarder d'abord.** Aucun `DROP`, `DELETE` ou
  `TRUNCATE` dans une migration sans le signaler et le faire valider. Le ticket
  03 en porte un — et la migration qu'il corrige est un piège armé.

### Les pièges déjà payés — `CLAUDE.md` §8

Ils s'appliquent tous, et quatre reviendront à coup sûr : la constante exportée
d'un module `"use client"` ; `min-w-0` en grille et en flex ; **un refus RLS sur
un `update` ne lève rien, il touche zéro ligne** (le ticket 02 est exactement
ça) ; **PostgREST plafonne à 1 000 lignes** et tronque en silence (le ticket 04
l'a déjà en tête) ; et **un lien énumère ce qu'il CHANGE**, jamais ce qu'il garde.

### Comment David reçoit le travail

Posé en 08 : *« quand je veux améliorer une partie, je reçois des prototypes que
j'accepte, et ensuite ils vont dans l'application avec un check pour voir si
l'app fonctionne »*. Un ticket qui touche à la **forme** d'un module le propose
en **variantes comparables** via `PrototypeSwitcher`
(`saas/web/components/prototype-switcher.tsx`), pas en description.

### Skills à consulter

`vision-produit` (quelle information mérite d'exister), `vision-ux` (hiérarchie
et uniformisation), `ux` (une action de bout en bout), `hebdo` (structure du
rapport), `recos` (pertinence et variété des conseils). Côté code :
`py-boy-scout` et `ts-boy-scout`.

### Le vocabulaire

`CONTEXT.md` est la source. Le mot est **« thème »**, jamais « label » — alors
que le code dit `label` partout, y compris dans les URL (`l`). Les mots gagnés
pendant la refonte : Carnet, Retour, Jour de travail, Note, Mise en place,
Stratégie, Marche, Mise en veille, Geste, Annonce, Groupe d'annonces, Mesure
prise, Regroupement, Point de vue de la semaine, À faire, Propriétaire, Membre.

### Ce qui tourne en parallèle, hors de cette carte

[18](../refonte/issues/18-passer-en-production.md) et
[26](../refonte/issues/26-gemini-palier-payant.md) — David seul, délai
administratif. **Le fait qui mord pendant ce temps** : en statut *Testing*, le
refresh token Google meurt à **7 jours** pour `adwords` et `analytics.readonly`,
donc le worker casse chaque semaine, **y compris sur le compte de David**. Le
bouton « Reconnecter » existe déjà (`app/comptes/page.tsx` l. 353 et 373) : il
faut recliquer avant chaque Jour de travail, et une semaine oubliée est une
semaine de données perdue.

## Decisions so far

<!-- l'index : une ligne par ticket clos, le détail vit dans le ticket -->

**[01 · Le ROAS gonflé](issues/01-roas-gonfle.md)** — le premier des trois
chiffres faux est réparé. `_kpis_window` divisait un revenu Meta+Google par une
dépense Meta seule ; elle lit maintenant `_pub_fenetre` (ex-`_pub_theme`, élargi
au compte entier par `lbl=None`) des deux côtés. **Aucune règle d'attribution
neuve** : additionner les dépenses des deux régies est déjà ce que fait
`build_matrix` pour le ROAS d'un thème — c'est *séparer* un ROAS par canal qui
resterait une décision non prise. L'historique n'est pas rejoué : les actions
décidées avant le `_BASCULE_PUB` portent une baseline d'un autre périmètre et
finissent donc sans verdict automatique.

**Deux tickets nés de sa revue de code**, hors des seize :
[17](issues/17-verdict-persiste-qui-derive.md) (le verdict persisté dérive au
lieu d'être figé — il fait dire à Gemini qu'une hypothèse ratée a réussi) et
[18](issues/18-revenu-google-non-rattachable.md) (la dépense Google se rattache
par identifiant, son revenu par nom — **une question pour David, pas une
correction**).

**[02 · La garde de collision](issues/02-garde-de-collision-resolveaction.md)** —
« le premier verdict tient » existe maintenant en code. `resolveAction`
conditionne son `update` au statut de départ **et** lit les lignes touchées
(`.in("status", …)` + `.select("id")` : l'un sans l'autre remplace un écrasement
silencieux par un refus silencieux). Sur zéro ligne, le statut réel est **relu**
avant qu'un message soit écrit — on nomme l'état, jamais une personne (ADR 0004),
et on ne l'affirme pas sans l'avoir lu (§7). `reco_feedback` n'est plus écrit sur
un geste refusé. **Repli appliqué** : la suppression d'une note par son auteur
attend `author_id`, que [05](issues/05-migration-deux-colonnes.md) n'a pas encore
posé. **Non vérifié en base** — aucune collision réelle jouée ; le projet Supabase
de `saas/web/.env.local` répond mais ne donne que la clé anon. La revue des
voisines a ouvert
[19 · Trente écritures qui ne se relisent pas](issues/19-ecritures-qui-ne-se-relisent-pas.md).

**Un seizième ticket est né hors des quinze** :
[16 · Le seam du payload](issues/16-le-seam-du-payload.md). C'est **le seul que
la refonte n'a pas tranché** — il vient de la session `/to-spec` du 2026-09-11,
où David a choisi le seam de test de la v1 : **le payload du rapport, seam
unique**, et **aucun runner de test dans `saas/web`**. Conséquence assumée, à
écrire dans les rapports de vérification concernés : la garde de collision (02)
et la date libre (11) ne seront couvertes par aucun test automatisé.

**[03 · L'identifiant d'annonce Meta](issues/03-identifiant-annonce-meta.md)** —
une Annonce s'identifie par son `ad_id`, jamais par son nom. Le rejeu
d'historique passe par `--meta-since` (Meta seul : un `--since` global ferait
rejeter la requête Google `change_event`), jamais par un `DELETE` ; le code se
défend si la colonne manque et la run finit rouge, l'utilisateur concerné ne
recevant ni rapport ni email — un trou lu comme une baisse est un faux verdict.
28 vérifications ciblées. **Le SQL n'est PAS joué** : son `DROP CONSTRAINT`
attend le feu vert de David, et le code déployé et la migration doivent partir
dans la même fenêtre. La migration est entrée dans le dépôt le 2026-09-12
(`03aa183`) — elle y était restée non commitée.

**[04 · La vue SQL du regroupement](issues/04-vue-sql-du-regroupement.md)** — le
regroupement par thème descend en base : `theme_regroupement`, une seule
implémentation, `security_invoker`, seuil des 100 CHF compris (`juge`), lecture
paginée et bornée au compte. `C_SEUILS["theme_spend_min"]` a disparu de Python
et `build_matrix` ne calcule plus les thèmes, elle les reçoit. **Trois chiffres
bougeront en service, tous dans le sens du §7** : le revenu GA4 ne se compte plus
une fois par campagne homonyme (1 560 CHF affichés pour 520 réels sur le jeu de
vérification), deux orthographes d'un nom ne s'écrasent plus, dépense et revenu
couvrent enfin le même périmètre. **103 vérifications** sur un PostgreSQL 16 réel.
**Le SQL n'est PAS joué**, et ce code déployé sans la vue ne publie plus aucun
rapport — c'est volontaire. La moitié web est [22](issues/22-pulse-lit-la-vue.md).

**[05 · La migration, deux colonnes](issues/05-migration-deux-colonnes.md)** —
`suivi_actions` gagne `author_id` (posé à la création, **figé par un déclencheur**
et non par une politique : une politique ne voit que la ligne d'arrivée) et la
campagne qu'une ligne désigne. **Aucun backfill** : une note sans auteur est une
note ancienne, pas une note cassée (ADR 0004). **Écart assumé avec la lettre du
ticket** : la campagne prend DEUX colonnes (`campaign_channel` + `campaign_key`),
parce que dans ce code l'identité d'une campagne est une paire — Meta par le nom,
Google par l'identifiant — et que deviner la régie rejouerait le bug du ticket 03.
42 vérifications sur un PostgreSQL 16 réel, dont le cas qui casse un garde-fou
trop zélé : supprimer un membre passe par le même UPDATE que le déclencheur
surveille. **Le SQL n'est PAS joué.** Les écritures TypeScript qui s'en servent
sont [12](issues/12-le-carnet-et-la-mort-de-preuve.md) et
[19](issues/19-ecritures-qui-ne-se-relisent-pas.md). Sa revue a ouvert
[23 · L'auteur peut être FAUX dès l'écriture](issues/23-auteur-forge-a-l-insertion.md) :
la colonne est figée après coup, mais la politique d'insertion contrôle le
compte et jamais la personne — une règle sur ce qu'un Membre a le droit
d'écrire, donc elle se propose.

**[06 · Rebrancher le plan de thème](issues/06-rebrancher-le-plan-de-theme.md)** —
les cinq colonnes d'une règle sont posées, et l'entrée automatique au carnet est
morte. La panne était plus bête que prévu : `_LEVIER_REGLE` et `EFFORT_BY_KEY`
existaient, mais **aucun poseur ne mettait le levier sur une reco-règle** —
`upsert_theme_plan` recevait `levier=None` et `FENETRE_LEVIER` retombait sur son
défaut pour tout le monde. `PROOF_KPI` est **retirée** (17 lignes, zéro valeur
changée, prouvé table contre table). La table des gestes n'est qu'un **défaut** :
`roas` écrit augmenter / couper / couper / corriger sous **une seule clé**, et la
découper aurait effacé `reco_feedback`. **Un conseil sans geste est un constat**
et n'est jamais servi — filtre appliqué **avant** la coupe à trois, veille et
socle exemptés. Plus aucun `status="auto"` écrit ni relu, plus aucun verdict sur
un geste que personne n'a confirmé ; `theme_plan` reste écrit à la publication.
**Deux conséquences qui n'étaient pas dans le ticket** : la mémoire d'un thème,
qui se nourrissait de ces lignes `auto`, lit maintenant les actions confirmées
(et `startTracking` emporte le levier, sinon elle ne verrait que des « levier
inconnu ») ; et `theme_event_cout` **disparaît des cartes** jusqu'à ce que 09 lui
donne sa place dans les constats. **257 vérifications**, aucune base ni secret.
**`build_payload` n'a pas tourné** — c'est le ticket 16. Repli appliqué : la
Marche suivante écrite par Gemini part en [24](issues/24-marche-suivante-ecrite-par-gemini.md),
parce qu'après ce ticket **seules deux règles ouvrent une Stratégie, les deux
organiques** — Gemini n'aurait rien à continuer chez un compte sans Instagram.
Sa revue a ouvert [25 · Le statut `auto` et ses branches inertes](issues/25-le-statut-auto-et-ses-branches-inertes.md).

**[07 · Les quatre règles payantes](issues/07-quatre-regles-payantes.md)** — le
moteur descend enfin sous la campagne. `annonce_sans_conversion`,
`annonce_locomotive`, `annonce_chere` et `theme_hors_budget` vivent dans un
module neuf et **pur** (`saas/recos_ia/regles_payantes.py`), leurs seuils
sortent tous de `SEUILS` et les tests se placent **pile dessus**. Les deux
garde-fous du geste « couper » tiennent, et le second va plus loin que la lettre
du ticket : une annonce de campagne jeune n'est ni dénoncée **ni comptée dans la
médiane**. Deux lectures branchées — `fetch_google_ads_ad_insights` **paginée**
(elle tronquait à 1 000 lignes en silence) et `fetch_platform_budgets` écrite,
relevé choisi **par canal**, prorata porté tel quel depuis `lib/budgets.ts`.
`_compares_channels` est **morte entièrement**, définition, appels et
commentaires. `spend` entre dans les indicateurs, `sessions` non — `_kpis_window`
ne sait pas le mesurer. **Deux faits imposés par la donnée** : Meta n'a pas la
conversion au niveau de l'Annonce (`conversions=None`, jamais zéro), et Meta
sort des comparaisons d'Annonces tant que le SQL du ticket 03 n'est pas joué —
Google tourne dès aujourd'hui et Meta arrive sans une ligne de code ce jour-là.
Trois règles peuvent tomber sur la même Annonce : un **arbitre** les
départage — deux conseils qui disent de couper la même n'en font qu'un, deux qui
se contredisent sur la même n'en font aucun. La revue de code a imposé le
point le plus important : **la comparaison se fait dans un Groupe d'annonces**,
jamais sur tout le thème — un clic Search et un clic social n'ont pas le même
prix, et la première version aurait désigné la même annonce Search chaque
semaine en affirmant « elles partagent la même audience ». **188 vérifications**,
plus les 302 du harnais 06 rejouées. **Rien n'est joué en
base, aucune migration, aucune récolte nouvelle.**

**[08 · Le filtre dur et le plafond de cinq](issues/08-filtre-dur-et-plafond-de-cinq.md)** —
**la phrase du produit est en code.** Un conseil ne naît que sur un thème que le
client a désigné : `_conseille` garde les quatre familles de règles, il se lit
sur `priority_labels[:3]` et **il n'a pas de `else`** — un plafond qui n'est pas
un quota ne se complète pas. `is_priority` **sort d'`_importance`** : un filtre
ne se double pas d'un critère de tri, et c'est très exactement le défaut que le
ticket dénonçait. Cinq conseils au maximum sur tout le compte
(`saas/recos_ia/composition.py`, pur), **≤ 2 Marches** et **≤ 2 fabrications à
une heure ou plus** ; il s'applique après la pose des efforts et **avant
`upsert_theme_plan`**, pour qu'une Marche non retenue n'ouvre aucune Stratégie.
L'**empreinte = clé + cible** filtre **avant** la coupe à trois d'un thème,
sinon le thème sortait muet avec un conseil frais derrière ; horizon assumé de
huit rapports. **Les pistes rédigées par Gemini sont coupées** — `_theme_ai_recos`
et `_forcer_une_hypothese` supprimées, le second chemin par thème avec elles,
cinq constantes renommées sans qu'une valeur bouge. Le blocage de la Marche a
été **porté**, avec une seule différence : un `snapshot` en `ai_` ne se
réaffiche jamais. **Deux tuyaux morts raccordés** : `too_hard` arrive enfin dans
`_themes_tips(bloques=…)`, et `themes_tips` — publié depuis des mois, rendu par
aucun composant — s'affiche dans « Pour aller plus loin ». Le renvoi « Si tu ne
fais que trois choses » **sort du rapport** (sa notification est
[refonte 12](../refonte/issues/12-module-de-commandes.md), hors carte) et
`_diversifier` meurt avec lui. **83 vérifications neuves**, 570 rejouées, 19
routes. **Le filtre n'a jamais tourné sur un vrai payload** — c'est le ticket
16, et ça se voit après un « ↻ Recharger mes conseils ».

**Il répond [26](issues/26-les-regles-payantes-n-atteignent-pas-le-rapport.md)
par construction, sans rouvrir sa question** : les pistes coupées, il n'y a plus
de porte à arbitrer, et les quatre règles payantes du ticket 07 sortent dès la
première étoile. **À fermer par David.** Deux autres faits remontés :
`CONTEXT.md` place le cas « zéro priorité » sur le module À faire
([11](issues/11-module-a-faire-et-date-libre.md)), qui n'existe pas encore — la
phrase vit donc sur la carte du thème en attendant, l'écart est écrit dans le
composant ; et le renvoi est retiré **sans que son remplaçant existe**.

**Et une prémisse fausse, la plus lourde de la carte jusqu'ici** →
[26 · Les règles payantes n'atteignent pas le rapport](issues/26-les-regles-payantes-n-atteignent-pas-le-rapport.md).
Un thème rédigé par Gemini ne reçoit **aucun** conseil-règle, et `_THEMES_IA = 3`
couvre **toute** la liste des thèmes d'un client à trois étoiles ou moins : le
chemin des règles ne s'ouvre qu'à la **quatrième étoile**. Ça ne vaut pas que
pour ces quatre-là — `roas`, le « un conseil par semaine » que 22 a mesuré, ne
sort pas non plus. Les quatre règles sont livrées **au bon endroit** ; c'est une
porte en amont qui décide qui les verra, et c'est une décision de David du
27 août 2026 qu'on ne rouvre pas soi-même. Sa revue a aussi ouvert
[27 · L'Hypothèse d'une règle peut changer de théorie toutes les semaines](issues/27-l-hypothese-d-une-regle-peut-changer-chaque-semaine.md),
qui vient de 06 et non de 07 — les quatre règles payantes sont toutes
« constatable » et n'ouvrent aucune Stratégie.

**[09 · Trois moteurs, un seul](issues/09-trois-moteurs-un-seul.md)** — « qu'est-ce
qui marche chez toi » ne se calcule plus qu'UNE fois. Les deux règles du moteur
(`format_gagnant`, `creneau`) sont mortes — fonction, cinq tables de grammaire,
`OBJECTIFS`, `VISION_RULES`, et les deux seuils qui ne servaient qu'à elles — et
le recalcul TypeScript de `/instagram` avec (`formats`, `heatmap`, `bestSlot`).
**Les constats d'`insights.py` s'affichent enfin** : publiés depuis des mois,
rendus par aucun composant, ils remplissent maintenant le **rang 4** de `/meta`,
`/google`, `/instagram` **et** `/labels` — sans une ligne de calcul nouvelle,
exactement le bénéfice que 11 avait prévu. Chaque constat porte sa `platform` et
`constatsDeLaPage` est le seul endroit qui décide où il se lit ; un repli par
genre couvre les payloads d'avant, sans jamais deviner la régie d'une campagne.
**Deux promesses écrites deviennent vraies** : `/labels` annonçait ces constats,
et `saveInsightFeedback` attendait depuis des mois qu'un écran l'appelle
(« ✓ ça me parle » / « ✗ pas d'accord »). **`theme_event_cout` a la place que 06
lui devait** : calculé chaque semaine et jeté en silence, il devient un constat
`cout_conversion`, clé portant le thème ET l'événement, angle mort collé au
chiffre. **`gaspillage` et `scaler` restent vivantes** — le ticket voulait les
tuer, [24](../refonte/issues/24-conseils-payants-manquants.md) les a
réhabilitées et il est plus récent ; dit, pas tranché en silence. **107
vérifications neuves**, 696 rejouées, 19 routes. **`build_payload` n'a pas
tourné** (ticket 16) et **rien du rendu web n'est testé** — aucun runner dans
`saas/web`, décision de David. Ça se voit après un « ↻ Recharger mes conseils ».

**Sa revue de code a trouvé quatre défauts dans le ticket, tous corrigés**, et le
plus grave n'était pas dans le neuf mais dans ce qu'on retirait : sortir
`creneau` et `format_gagnant` de `_METRIC_REGLE` faisait **disparaître sans un
mot le Verdict d'une décision déjà prise** — la boucle écarte sur un indicateur
absent AVANT la branche « en attente », tout en consommant une des quatre places.
Les deux clés reviennent en lecture seule. Les trois autres : le constat de coût
portait sept jours sous un en-tête « tout l'historique », son angle mort
n'atteignait pas Gemini là où on dit au modèle de s'appuyer sur le chiffre, et un
verdict **ne pouvait plus se retirer** (le repli se déclenchait sur l'absence
d'une ligne, alors que se déjuger SUPPRIME la ligne). **Deux autres constats ne
viennent pas de ce ticket** mais du travail du bandeau que son commit a emporté →
[28](issues/28-engagement-du-compte-filtre-par-theme.md) (« Engagement du compte »
filtré par thème sous une phrase qui jure le contraire — §7) et
[29](issues/29-un-post-a-plusieurs-themes-le-filtre-n-en-voit-qu-un.md).
**Et un fait qui mord** : à `96457f8` quatre pages importent cinq modules encore
non suivis par git, donc le commit ne construit pas depuis un checkout neuf —
**rien ne doit être poussé avant que le travail du bandeau soit commité**, Vercel
déploie depuis `main`.

**[10 · Les six règles payantes restantes](issues/10-six-regles-payantes-restantes.md)** —
le moteur payant passe de **quatre règles à dix**, et le repli n'a pas eu à
s'appliquer : 06 étant en service, les deux règles « à mesurer » sont parties
avec les quatre autres. **Un compte qui ne fait que de la publicité ouvre enfin
une Stratégie** (`adset_inegal`, `theme_deux_regies`) — c'était l'exigence n° 4
de [24](../refonte/issues/24-conseils-payants-manquants.md), et avant elles les
deux seules clés à Hypothèse étaient organiques. **Quatre seuils neufs
seulement, pas six** : les comparaisons de coût réutilisent `cpc_ratio`, et pour
`budget_non_depense` ce « 2× » est littéralement le nombre de David. Chacun des
quatre porte sa source dans `SEUILS`, **avec l'avertissement** : aucune règle
payante n'a jamais tourné sur un vrai compte, ce sont des points de départ
argumentés, pas des valeurs observées. **Les deux pièges du ticket sont tenus** :
`annonce_usee` ne calcule pas une fréquence mais un **plancher** de fréquence
(impressions ÷ somme des portées quotidiennes — les personnes ne se somment pas,
donc le rapport est toujours plus petit que la vraie fréquence, et la règle se
tait plus souvent qu'elle ne le devrait, jamais l'inverse) ; `page_arrivee_muette`
**ne nomme jamais une page**, et un test vérifie qu'aucune URL ne sort de son
texte. Elle ne prend pas non plus une des trois places d'un thème — levier
`socle`, elle rejoint le bloc « réglages », **une seule par rapport**, celle qui
perd le plus de clics. L'arbitre des collisions passe de deux cas à six, **et une
seule Stratégie par thème** — ce qui augmente l'exposition au ticket 27 : il n'y
avait que deux clés à Hypothèse, il y en a quatre. **343 vérifications**, plus
189 (harnais 07) et 342 (harnais 06) rejouées.

**Deux faits imposés par la donnée, et le second est le plus lourd.**
`adset_inegal` comparait d'abord à une **médiane** : sur une campagne à deux
Groupes, la médiane vaut leur moyenne et la condition devient « a ≥ a + b » —
**la règle n'aurait jamais parlé sur le cas le plus courant**. Le repère est
maintenant celui des voisins, comme `annonce_locomotive`. Le même défaut vit
encore dans `regle_annonce_chere` → [30](issues/30-la-mediane-sur-deux-valeurs-ne-parle-jamais.md).
Et `theme_deux_regies` **se tait dès que l'attribution d'un canal est trouée** :
sans ça, une campagne dont l'`utm_campaign` ne correspond plus verserait sa
dépense sans son revenu et la règle dirait « l'autre rend quatre fois mieux »
(le fait de [18](issues/18-revenu-google-non-rattachable.md)). Ce lecteur **ne
tranche pas la question de 18** — il ne change rien à la dépense comptée
ailleurs, il refuse seulement de faire parler UNE règle neuve sur une
attribution trouée. En chemin : **aucune règle du dépôt sauf `theme_event_cout`
ne pose de `cible`**, donc son empreinte est `(clé, "")` et une clé servie une
fois est consommée pour tous les thèmes et toutes les semaines →
[31](issues/31-un-conseil-sans-cible-ne-sort-qu-une-fois.md). **Rien n'est joué
en base, aucune migration, aucune récolte nouvelle.**

**Sa revue de code a trouvé six défauts, tous corrigés**, et les trois premiers
étaient des chiffres faux au sens du §7 — exactement ce que ces règles existent
pour ne pas produire. `page_arrivee_muette` **comparait deux populations
différentes** (tous les clics du thème contre les seules sessions que GA4
rattache, et **Meta ne pose aucun paramètre de campagne tout seul**) : un thème
Meta sans UTM affichait « 100 % des clics n'arrivent nulle part » et accusait
une balise qui marche. Le « plancher » de fréquence **pouvait dépasser la vraie
fréquence** quand la portée manquait sur certains jours — l'invariant que le
module promet noir sur blanc était faux ; une seule journée sans portée et
l'annonce sort. Et `theme_deux_regies` écrivait *« Meta rapporte, l'autre pas
que Google »* quand une régie ne rapportait rien. Les trois autres : deux
`cible` qui n'étaient pas propres au thème (un conseil servi sur « Été »
musellerait « Hiver » huit semaines), et `creneau_jours_min = 4` exigé sur une
fenêtre de 28 jours qui en donne exactement quatre — elle passe à cinq semaines.

**Et un conflit qui va à David, HITL.** `docs/mesures-impossibles.md` dit qu'un
**ROAS affiché par canal serait une invention** tant que la règle d'attribution
n'est pas choisie ; `theme_deux_regies` en affiche un. Les deux phrases ont été
écrites le même jour par le même ticket de la refonte (24) — c'est un écart
interne à la décision, pas une désobéissance à elle. La règle est livrée sous
ses gardes, la lecture retenue étant qu'**un conseil qui porte son angle mort
n'est pas un KPI posé sur un tableau de bord**, et la question part telle quelle →
[32](issues/32-un-conseil-compare-deux-regies-que-le-tableau-de-bord-refuse-de-separer.md).
`CONTEXT.md` gagne **Vues par personne** (et déconseille « fréquence », le nom de
la valeur qu'on ne sait PAS calculer) ; `docs/mesures-impossibles.md` gagne
**« Quelle page d'arrivée perd les gens »**.

**[11 · Le module « À faire » et la date libre](issues/11-module-a-faire-et-date-libre.md)** —
**la liste qui se vide existe, et la date où on a agi cesse d'être celle du
clic.** `resolveAction` prend le JOUR CHOISI (`done_at`, donc `check_at =
done_at + 14`), borné par `decided_at ≤ done_at ≤ aujourd'hui` et **sans plafond
en jours** — antidater n'avance que le verdict, la baseline étant prise à la
décision. Hors bornes, on **refuse** au lieu de rabattre sur aujourd'hui : écrire
une date que personne n'a choisie sur la seule colonne dont dépend l'échéance
serait un chiffre fabriqué (§7). Un défaut trouvé en chemin et corrigé :
`new Date("2026-09-12")` lit une date nue comme UTC et `isoDate` la relit en
local — **l'échéance reculait d'un jour à l'ouest de Greenwich**. **Le plafond de
trois chantiers meurt** (`capReached`, quatre fichiers) ; ce qui borne la charge
est la composition des cinq. Le module trie et **compte à un seul endroit**
(`lib/a-faire.ts`, pur) pour que la pastille de navigation (refonte 12) ne puisse
pas dire un autre chiffre : verdicts → ce que tu t'es écrit → conseils, la LIGNE
et pas la carte, trois gestes sans raison demandée, et la ligne s'en va sous le
doigt. **Une Note peut naître `running`** — aucun objet neuf, aucune migration —
ce qui a obligé quatre lectures à l'apprendre (le rail, le filet hors thème, la
courbe du prototype, et `build_report.py`, qui lui aurait cherché un verdict).
**Le cas « aucune étoile » a déménagé** du module verrouillé d'une carte vers ce
module, comme `CONTEXT.md` l'exigeait ; la carte nomme l'état et renvoie, elle ne
réclame plus. **Le raccourci du hero est retiré** : il comptait « à juger » ce
qui était en observation, et pointait vers ce qui tient désormais dans le même
écran. **Rien n'est vérifié en service** — aucun clic joué, aucune écriture
relue en base, et `saas/web` n'a toujours aucun runner de test (décision de David
au ticket 16, que cette carte annonçait pour ce ticket-ci nommément). `tsc` et
`npm run build` verts, **19 routes**. **Le module se pose sous le hero, là où il
restera** : le bilan du Carnet qui doit s'intercaler est le ticket 13.

**[12 · Le carnet, et la mort de `preuve`](issues/12-le-carnet-et-la-mort-de-preuve.md)** —
**le seul mécanisme de rétention de la carte existe, et le moteur concurrent est
mort.** `preuve` part avec `fetch_reco_decisions`, `ProofOutcome` et
`payload.preuve` : il remesurait sur le COMPTE ENTIER ce que le rail mesure sur
le THÈME, et aucun écran ne l'a jamais lu. Ce qui le remplace ne mesure rien —
un **comptage** des `suivi_actions.verdict` déjà persistés, deux `head` count
(donc hors du plafond des 1 000 lignes), **aucun taux dérivé** : un pourcentage
sur quatre actions serait un chiffre juste qui ment. La relève est vérifiée et
non supposée, l'écriture du verdict comprise — sans elle il n'y aurait plus rien
à compter. **Le Carnet est un module unique posé sur cinq pages** (`/meta`,
`/google`, `/instagram`, `/labels`, `/couts`), filtré par **exactement ce que le
bandeau de la page filtre**. La page n'est pas un filtre, elle est un **contexte
d'écriture** : une note posée depuis `/meta`, campagne cochée, naît
`('meta','Été')` sans qu'on demande rien — la colonne réclamée par 08 cesse
d'être un champ à remplir. **L'accueil ne prend que le BILAN**, entre le hero et
« À faire » : le rail porte déjà la chronologie avec l'effet chiffré, et le
relire en liste referait ce que `685a3e9` avait défait. `author_id` prend
**`compte.moi`** — le seul endroit d'`actions.ts` où la personne compte et non le
compte ; `updateNote` (neuf) et `deleteNote` filtrent sur l'auteur, Propriétaire
excepté, lisent les lignes touchées et **relisent** avant de dire pourquoi.
**Le repli de migration refuse plutôt que de perdre une campagne en silence**, et
ne dit « migration pas jouée » que si la base l'a dit. **La note entre dans la
mémoire du thème et jamais dans le repondérage** : lecture séparée de la boucle
de verdict (l'élargir y aurait fait entrer les notes, et c'est elle qui ÉCRIT
`verdict`), présentées comme **faits déclarés** dans un prompt où leur ligne n'a
pas de place pour un chiffre. **Les deux pièges sont tenus** : aucune marque
rallumée sur une courbe (les quatre variantes de refonte 19 attendent le jugement
de David), aucune semaine passée rouverte. **179 vérifications**, harnais 06→10
rejoués, 19 routes. **La migration n'est PAS jouée** : le Carnet s'affiche sans
auteur ni campagne et le dit. Ça se voit après un « ↻ Recharger mes conseils »
pour la partie worker, tout de suite pour le Carnet. Sa revue a ouvert
[33 · Une note pas encore faite marque déjà la frise](issues/33-une-note-pas-encore-faite-marque-la-frise.md) :
`_markers` est la seule lecture des notes qui n'a pas appris qu'une Note peut
naître `running`.

## Not yet specified

- **Le jugement de David sur le fil, une fois la v1 en service.** C'est la
  destination, et c'est le seul endroit où cette carte peut découvrir qu'elle
  s'est trompée. Ce qu'il en sortira — un module qui ne sert pas, un ordre à
  refaire, un conseil qui tombe à plat — ne se charte pas d'avance.
- **Ce que les DIX règles payantes donneront sur de vraies données.** Écrites et
  vérifiées par [07](issues/07-quatre-regles-payantes.md) et
  [10](issues/10-six-regles-payantes-restantes.md) ; la porte que 26 nommait est
  tombée avec 08, elles atteignent donc le rapport dès la première étoile. Mais
  **aucune n'a jamais tourné**, et c'est plus lourd pour les six de 10 : quatre
  de leurs seuils sont neufs, et 24 les avait reportées exactement pour ça
  (« au moins un seuil à calibrer sur données réelles »). Quand elles
  tourneront : si elles se taisent ou se répètent, c'est un ticket, pas une
  retouche silencieuse.
- **La doc du produit.** Table des matières au §6 du plan, décision dans
  [05](../refonte/issues/05-carte-du-savoir.md) : elle s'écrit **thématique par
  thématique, quand la brique est construite** — c'est le produit qui dicte la
  doc, pas l'inverse. Chaque thématique graduera en ticket à ce moment-là.

## Out of scope

- **Tout ce que la carte de refonte a tranché.** On bâtit ses décisions, on ne
  les rouvre pas.
- **Les briques 2 à 7 du plan §4** — [10](../refonte/issues/10-l-entree-premier-ecran.md)
  la mise en place, [07](../refonte/issues/07-gabarit-de-plateforme.md) les six
  rangs, [12](../refonte/issues/12-module-de-commandes.md) /
  [15](../refonte/issues/15-le-bandeau-en-variantes.md) le bandeau,
  [16](../refonte/issues/16-compteur-partage.md) au-delà de sa migration,
  [19](../refonte/issues/19-module-mes-notes.md) les notes sur la courbe,
  [23](../refonte/issues/23-recolte-des-quatre-manques.md) les quatre récoltes.
  Chacune a une condition d'entrée qui n'est pas remplie. **Le principe : rien ne
  se construit pour un client qui n'existe pas encore.**
- **La récolte de données** (`saas/collecte/`) — David la dit bonne. Seule
  exception, portée par le ticket 03 : l'identifiant d'annonce Meta, parce que
  c'est une **réparation** d'un bug de récolte, pas un ajout.
- **[18](../refonte/issues/18-passer-en-production.md) et
  [26](../refonte/issues/26-gemini-palier-payant.md)** — David seul, et ils
  tournent en parallèle sans rien bloquer ici.
- **Le nettoyage pour le nettoyage.** Garde-fou posé en 04 : il est interdit de
  répondre « il faut d'abord tout nettoyer ». Un chantier de propreté ne valide
  aucune hypothèse. Les 32 worktrees et 8,6 Go relevés en 01 restent où ils sont.

**[14 · La porte vers la plateforme](issues/14-la-porte-vers-la-plateforme.md)** —
le cul-de-sac est fermé. Une porte en pied de chaque carte de thème
(`components/porte-canal.tsx`) ouvre `/meta`, `/google` ou `/instagram` **sur le
thème ET sur la fenêtre du bilan** — `matrice.period`, et pas `since`/`until` du
payload, qui sont ceux de la semaine et auraient reproduit l'écart « 4 520 CHF →
103 CHF » que le ticket interdit. **Pas de fenêtre, pas de porte.** Le retour
(`components/retour-rapport.tsx`) survit à l'exploration parce que tous les liens
de ces pages énumèrent ce qu'ils CHANGENT. **Deux prémisses du ticket étaient
fausses** : `/instagram` était déjà filtrable par thème (le bandeau l'a apporté),
et le vocabulaire d'URL est `l`, pas `label` — `label` ne s'écrit plus nulle
part. **Aucun compte affiché sur la porte** : `theme.campaigns` est plafonné à
huit, d'où [34](issues/34-ses-campagnes-plafonnees-a-huit.md), qui est le même
plafond en train de mentir trente pixels plus bas (« Ses campagnes (8) » sur
douze). Vérifié `tsc` + `build` verts, 19 routes, et les deux constructeurs de
liens exécutés sous node ; **jamais vu à l'écran** — ces pages demandent une
session.

**Cinq tickets nés de la revue de 14**, aucun dans son périmètre :
[34](issues/34-ses-campagnes-plafonnees-a-huit.md) (« Ses campagnes (8) » sur un
thème qui en porte douze), [35](issues/35-la-periode-de-couts-ne-repond-plus.md)
(sur `/couts`, `p=mois` rend les présélections inertes, et `from` n'est pas borné
à l'ancre — la fenêtre peut s'afficher à l'envers),
[36](issues/36-le-carnet-a-trois-silences.md) (un zéro fabriqué, une panne de
lecture rendue comme « tu n'as rien écrit », 50 notes invisibles au-delà de 200),
[37](issues/37-la-memoire-de-theme-lit-les-notes-les-plus-vieilles.md) (un
`.order()` ascendant fait lire à Gemini les notes les plus vieilles du compte) et
[38](issues/38-le-repli-de-posernote-efface-l-auteur.md) (un repli qui crée une
note sans auteur sur une base qui sait les signer — ADR 0004). **Tous vérifiés
ligne à ligne, aucun corrigé** : ils vivent dans du travail non commité qui n'est
pas celui de 14. Une affirmation de la revue était fausse et n'a pas été reprise
telle quelle (voir 35 §1).

**[13 · Le premier écran, et les trois dates en tête](issues/13-premier-ecran-et-trois-dates.md)** —
**le rapport dit enfin de quand il date, et le premier écran est dans son
ordre.** Les trois dates — *mesuré du X au X · publié le X · mis à jour le X* —
prennent la place du libellé de semaine au lieu de s'y ajouter : `week_label`
disait déjà la fenêtre, la relire trente pixels plus bas aurait doublé sur les
pixels les plus chers. `updated_at`, qui existait depuis toujours et n'était
jamais lu, est la deuxième ; la troisième sort de `fetch_schedule` **du compte
regardé** — un Membre invité lit les dates du compte dont il voit les chiffres.
**Aucune des trois ne juge** : jamais « périmé », jamais « il y a N jours »,
aucune couleur d'alerte (vieux ≠ faux, §7, refusé deux fois par David), et
chacune **peut manquer sans s'écrire**. **Le piège du §8 était armé** : le calcul
du prochain passage vivait dans un module `"use client"` et les trois dates sont
rendues par le serveur — il a déménagé dans `lib/jour-de-travail.ts`, sans
directive, et `jour-recolte.tsx` n'en garde aucune copie. **Les cinq marches du
premier écran sont en place** : `SetupWizard` remonte en tête (défaut de 06 : il
était sous deux écrans de défilement — **sa place seule bouge**, les quatre
étapes restent hors v1), le résumé IA descend au dernier rang et se replie dans
un `<details>` fermé sans état React, et **le rail des chantiers en cours existe
enfin sur l'accueil** — c'était le rang 4 depuis 10 point 6, confirmé par 20, et
**la seule marche que personne n'avait construite**. Ce n'est pas un deuxième
objet : c'est `RailActions` servi sans thème courant et **sans faits de
plateforme**, et il ne double pas « À faire » — `chantiersEnCours` est le
complément **exact** du module, calculé au même endroit, et un test l'exécute
(aucune action des deux côtés, aucune perdue entre les deux).

**Le défaut de publication est réparé** : `week_start` sortait du lundi
d'**aujourd'hui**, donc republier dans une autre semaine calendaire écrivait une
deuxième ligne pour les mêmes chiffres et renumérotait « Semaine N ». Il sort
maintenant de la **fenêtre mesurée**, voyage dans le payload, et la borne qui
empêche un rapport de se relire dans son propre historique suit. La publication
devient **idempotente**. **Une conséquence dite d'avance** : pour un compte servi
le **lundi**, la fenêtre finit le dimanche — semaine ISO précédente — donc la
première publication après ce ticket écrase la ligne de la semaine d'avant
(upsert, aucune suppression) et on perd **un** payload d'historique. Les autres
jours ne bougent pas. **77 vérifications neuves**, harnais 06→12 rejoués (1 244),
19 routes. **Une nouveauté dans le harnais** : deux modules purs de `saas/web`
(`lib/jour-de-travail.ts`, `lib/a-faire.ts`) **tournent pour de bon**, importés
tels quels — node 22+ retire les types lui-même, donc plus aucune copie du code
à vérifier dans le test. **Rien n'a été vu à l'écran** et **`build_payload` n'a
pas tourné** (ticket 16) : la dérivation de `week_start` est vérifiée sur le
texte et sur sa propriété, jamais en base — aucun `upsert` joué. Le `week_start`
et le numéro de semaine ne se voient qu'après un « ↻ Recharger mes conseils ».
