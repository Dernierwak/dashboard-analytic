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
réhabilitées et il est plus récent ; dit, pas tranché en silence. **102
vérifications neuves**, 694 rejouées, 19 routes. **`build_payload` n'a pas
tourné** (ticket 16) et **rien du rendu web n'est testé** — aucun runner dans
`saas/web`, décision de David. Ça se voit après un « ↻ Recharger mes conseils ».

## Not yet specified

- **Le jugement de David sur le fil, une fois la v1 en service.** C'est la
  destination, et c'est le seul endroit où cette carte peut découvrir qu'elle
  s'est trompée. Ce qu'il en sortira — un module qui ne sert pas, un ordre à
  refaire, un conseil qui tombe à plat — ne se charte pas d'avance.
- **Ce que les quatre premières règles payantes donneront sur de vraies
  données.** Écrites et vérifiées par 07, seuils issus de `SEUILS`, aucun
  inventé — mais aucune n'a jamais tourné, et le ticket 26 dit qu'aucune ne
  tournera chez un client à trois étoiles tant que la porte de Gemini n'est pas
  tranchée. Quand elles tourneront : si elles se taisent ou se répètent, c'est
  un ticket, pas une retouche silencieuse.
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
