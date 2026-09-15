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

<!-- ETAT:DEBUT — recalculé par `etat.py`, ne pas tenir à la main -->

## Où on en est

**24 tickets résolus, 26 ouverts** (sur 50). Recalculé depuis les `Status:` des fichiers par [`etat.py`](etat.py) — `python3.12 .scratch/construction/etat.py`.

⚠ **Ce que tu lis dépend de ta branche.** Les tickets sont des fichiers versionnés : un ticket résolu sur une branche non fusionnée reste `open` dans une copie de travail restée sur `main`. En cas de doute, `git log --oneline main..<branche>` dit ce qui n'est pas encore arrivé dans `main`.

### Fait

| № | Ticket |
|---|---|
| **01** | [Le ROAS gonflé : un revenu deux régies divisé par une dépense Meta seule](issues/01-roas-gonfle.md) |
| **02** | [La garde de collision : le second verdict écrase le premier, et l'écran dit « enregistré »](issues/02-garde-de-collision-resolveaction.md) |
| **03** | [L'identifiant d'annonce Meta : la migration livrée est un piège armé](issues/03-identifiant-annonce-meta.md) |
| **04** | [La vue SQL du regroupement par thème — le socle du reste](issues/04-vue-sql-du-regroupement.md) |
| **05** | [Une migration, deux colonnes : l'auteur d'une note et la campagne d'une action](issues/05-migration-deux-colonnes.md) |
| **06** | [Rebrancher le plan de thème : la séquence sans l'IA qui l'alimentait](issues/06-rebrancher-le-plan-de-theme.md) |
| **07** | [Les quatre règles payantes qui se livrent seules](issues/07-quatre-regles-payantes.md) |
| **08** | [Le filtre dur sur les thèmes prioritaires, et le plafond de cinq](issues/08-filtre-dur-et-plafond-de-cinq.md) |
| **09** | [Trois moteurs, deux langages, trois jeux de seuils : `insights.py` gagne](issues/09-trois-moteurs-un-seul.md) |
| **10** | [Les six règles payantes restantes](issues/10-six-regles-payantes-restantes.md) |
| **11** | [Le module « à faire cette semaine » qui se vide, et la date où on a agi](issues/11-module-a-faire-et-date-libre.md) |
| **12** | [Le carnet : un module unique posé partout — et `preuve` meurt](issues/12-le-carnet-et-la-mort-de-preuve.md) |
| **13** | [Le premier écran de celui qui revient, et les trois dates en tête](issues/13-premier-ecran-et-trois-dates.md) |
| **14** | [La porte vers la plateforme : le thème ET la fenêtre](issues/14-la-porte-vers-la-plateforme.md) |
| **15** | [Le client ne déclenche plus rien : les quatre boutons sortent](issues/15-le-client-ne-declenche-plus-rien.md) |
| **16** | [Le seam du payload : rendre le rapport appelable hors ligne](issues/16-le-seam-du-payload.md) |
| **17** | [Le verdict « figé » qui se réécrit chaque semaine](issues/17-verdict-persiste-qui-derive.md) |
| **18** | [La dépense Google entre par l'identifiant, son revenu ne peut entrer que par le nom](issues/18-revenu-google-non-rattachable.md) |
| **19** | [Trente écritures qui ne relisent jamais ce qu'elles ont écrit](issues/19-ecritures-qui-ne-se-relisent-pas.md) |
| **20** | [Le rapport se publie sur un canal muet, et l'email part avec](issues/20-rapport-publie-sur-un-canal-muet.md) |
| **21** | [Les statuts de campagne Meta s'arrêtent à 200, sans pagination](issues/21-campagnes-meta-non-paginees.md) |
| **23** | [L'auteur d'une note est figé après coup, mais rien ne l'empêche d'être FAUX dès l'écriture](issues/23-auteur-forge-a-l-insertion.md) |
| **24** | [La Marche suivante écrite par Gemini — la moitié IA du plan de thème](issues/24-marche-suivante-ecrite-par-gemini.md) |
| **28** | [« Engagement du compte » est filtré par thème, et la page jure le contraire](issues/28-engagement-du-compte-filtre-par-theme.md) |
| **43** | [L'étiqueteuse IA fabrique le nom d'une campagne Google, et ce nom détruit le pont du revenu](issues/43-le-nom-dune-campagne-google-est-fabrique-par-letiqueteuse.md) |

### Reste à faire

| № | Ticket |
|---|---|
| **22** | [Pulse lit la vue : la moitié TypeScript du regroupement](issues/22-pulse-lit-la-vue.md) — **bloqué par 44** |
| **25** | [Le statut `auto` : des branches inertes, et des lignes orphelines en base](issues/25-le-statut-auto-et-ses-branches-inertes.md) |
| **26** | [Les règles payantes sont écrites, et aucun client ne les verra](issues/26-les-regles-payantes-n-atteignent-pas-le-rapport.md) |
| **27** | [L'Hypothèse d'une règle peut changer de théorie toutes les semaines](issues/27-l-hypothese-d-une-regle-peut-changer-chaque-semaine.md) |
| **29** | [Un post porte plusieurs thèmes ; le filtre de `/labels` n'en voit qu'un](issues/29-un-post-a-plusieurs-themes-le-filtre-n-en-voit-qu-un.md) |
| **30** | [Une médiane calculée sur deux valeurs ne peut jamais franchir son ratio](issues/30-la-mediane-sur-deux-valeurs-ne-parle-jamais.md) |
| **31** | [Les quatre règles du ticket 07 n'ont pas de cible : elles ne sortent qu'une fois](issues/31-un-conseil-sans-cible-ne-sort-qu-une-fois.md) |
| **32** | [Un conseil compare deux régies que le tableau de bord refuse de séparer](issues/32-un-conseil-compare-deux-regies-que-le-tableau-de-bord-refuse-de-separer.md) |
| **33** | [Une note qu'on n'a pas encore faite marque déjà la frise, deux fois](issues/33-une-note-pas-encore-faite-marque-la-frise.md) |
| **34** | [« Ses campagnes (8) » sur un thème qui en porte douze](issues/34-ses-campagnes-plafonnees-a-huit.md) |
| **35** | [La période de `/couts` : l'ancien nom gagne, et la fenêtre peut s'inverser](issues/35-la-periode-de-couts-ne-repond-plus.md) |
| **36** | [Le carnet a trois silences : un zéro fabriqué, une panne déguisée, une troncature invisible](issues/36-le-carnet-a-trois-silences.md) |
| **37** | [La mémoire de thème lit les 200 notes les plus VIEILLES](issues/37-la-memoire-de-theme-lit-les-notes-les-plus-vieilles.md) |
| **38** | [Le repli de `poserNote` efface l'auteur même quand la base sait le porter](issues/38-le-repli-de-posernote-efface-l-auteur.md) |
| **39** | [L'annulation en bloc des étiquettes IA a perdu son déclencheur](issues/39-l-annulation-des-etiquettes-ia-a-perdu-son-declencheur.md) |
| **40** | [Un thème sans revenu confirmé est publié à zéro franc](issues/40-un-theme-sans-revenu-confirme-est-publie-a-zero.md) |
| **41** | [La fenêtre ne s'ancre pas sur Google : un compte Google seul mesure des jours vides](issues/41-la-fenetre-ne-s-ancre-pas-sur-google.md) |
| **42** | [Le verdict persisté ne remonte jamais à l'écran](issues/42-le-verdict-persiste-ne-remonte-jamais-a-l-ecran.md) |
| **44** | [La vue du regroupement n'existe pas en base, et le fichier qui l'installe ne peut pas être joué](issues/44-la-vue-du-regroupement-ne-peut-pas-etre-jouee.md) |
| **45** | [Renommer un thème lui fait perdre son étoile — et le supprimer en laisse une qui ne désigne rien](issues/45-renommer-un-theme-lui-fait-perdre-son-etoile.md) |
| **46** | [La période des coûts peut s'inverser, et le bandeau reste inerte sur un vieux lien](issues/46-la-periode-de-couts-peut-s-inverser.md) |
| **47** | [Un canal muet deux semaines de suite n'est plus une note, c'est une relance](issues/47-un-canal-muet-deux-semaines-de-suite.md) |
| **48** | [Les tableaux de bord lisent le trou en direct, sans passer par le rapport](issues/48-les-tableaux-de-bord-lisent-le-trou-en-direct.md) |
| **49** | [Trois moteurs d'engagement, trois réponses — et deux d'entre eux rendent 0 sur une portée inconnue](issues/49-trois-moteurs-d-engagement-trois-reponses.md) |
| **50** | [La collecte Instagram écrit 0 pour ce qu'elle ne sait pas — et ne demande jamais les likes des Reels](issues/50-la-collecte-instagram-ecrase-ce-qu-elle-ne-sait-pas.md) |

<!-- ETAT:FIN -->

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
- **Les quatre boutons sont retirés depuis le ticket 15.** Une correction du
  traitement ou de la récolte ne se voit donc **qu'après un passage du worker** :
  le cron du Jour de travail (07:00 UTC), ou un lancement à la main depuis
  l'onglet GitHub Actions (`weekly-fetch.yml`). Le dire à chaque fois, et dire
  lequel des deux. Ce qui se REGROUPE par thème, lui, se voit à la lecture.
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
[16 · Le seam du payload](issues/16-le-seam-du-payload.md), **résolu** — voir son
entrée en fin d'index. C'est **le seul que la refonte n'a pas tranché** : il
vient de la session `/to-spec` du 2026-09-11, où David a choisi le seam de test
de la v1 — **le payload du rapport, seam unique**, et **aucun runner de test dans
`saas/web`**. Conséquence assumée, à écrire dans les rapports de vérification
concernés : la garde de collision (02) et la date libre (11) ne sont couvertes
par aucun test automatisé.

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

**[23 · L'auteur, sincère dès l'écriture](issues/23-auteur-forge-a-l-insertion.md)** —
une note se signe de son propre nom ou de personne : `author_id IS NULL OR
author_id = auth.uid()`, en `WITH CHECK` sur l'INSERT. Ici une politique suffit
là où 05 a dû prendre un déclencheur — à l'insertion il n'y a pas de ligne
d'avant, donc la limite « une policy ne voit que la ligne d'arrivée » ne mord
pas. **Le mot qui porte tout le ticket est `AS RESTRICTIVE`**, et il n'était pas
dans l'énoncé : PostgreSQL combine les politiques PERMISSIVES d'une même commande
**en OU**, et `suivi_actions` en a déjà deux sur l'insertion (`partage_insert` et
`suivi_actions_insert_own`) — une permissive de plus se serait lue comme une
protection sans en être une, à un mot près dans le SQL. D'où un contrôle de fin
de fichier qui vérifie `permissive = 'RESTRICTIVE'` et pas seulement le nom.
**39 vérifications** sur un PostgreSQL 16 réel, dont **le trou lui-même reproduit
avant correction** — sans ce contraste, le vert de la correction ne dirait pas si
elle sert. Le `NULL` reste permis (ADR 0004), le worker n'est pas concerné
(vérifié : clé de service, et zéro INSERT Python sur la table), l'app écrivait
déjà juste (`actions.ts` l. 587). **Le SQL n'est PAS joué**, et **ça ne se verra
pas en cliquant** : l'écran ne change pas, seul change ce qu'une écriture directe
en PostgREST a le droit de faire.

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

**[15 · Le client ne déclenche plus rien](issues/15-le-client-ne-declenche-plus-rien.md)** —
**les quatre boutons sont sortis, l'afficheur est resté.** `fetch-button.tsx`
devient `suivi-recolte.tsx` : même vérité serveur, même refus d'inventer un
pourcentage, **moins le lanceur** — et il ne rend RIEN quand rien ne tourne. Le
flottement du panneau était une conséquence du bouton (il pendait sous lui) :
sans bouton, les deux coupes mesurées disparaissent d'elles-mêmes. Deux places :
`flux` (colonne, tiroir, Connexions) et `compact` (en-tête du téléphone, une
pastille). **Une veille d'une minute a dû être ajoutée** — sans clic pour
allumer l'écran, et GitHub mettant quelques secondes à publier un run, le client
qui vient de brancher sa Page serait resté devant un écran muet : le défaut même
que le ticket interdit. **Les trois décisions voisines sont bâties** : une source
branchée lance sa récolte (`lib/github-workflow.ts`, dispatch déplacé hors d'un
fichier `"use server"` qui ne peut exporter que des fonctions asynchrones), le
Jour de travail se choisit **à la clôture du fil de démarrage**
(`components/choix-jour.tsx`, l'unique écriture des sept jours — et elle ne se
rejoue pas, `fetch_schedule` valant `'Monday'` par défaut, rien ne distingue un
défaut d'un choix), et les trois réglages différés portent **la date** de leur
prise en compte (`prisEnCompteLe` + `lib/jour-compte.ts`, sur le compte
REGARDÉ). **Une conséquence non prévue par le ticket** : choisir son compte
Google Ads puis sa propriété GA4 fait partir deux récoltes — `weekly-fetch.yml`
gagne un `concurrency` par compte. Les trois défauts de rafraîchissement de 13
sont réparés, **commentaire menteur compris** : `revalidatePath("/")` n'est pas
un no-op (il rafraîchit la couverture, lue en direct), il ne peut simplement pas
rendre les blocs par thème du payload figé — ce qui attend le ticket 04.
`CLAUDE.md` §9 est mis à jour dans le même passage, ici et dans `spec.md`. **19
routes**, `tsc` et `npm run build` verts, `py_compile` sur les trois fichiers
Python. **Rien n'a été joué en service** : aucun clic, aucun run GitHub, aucune
écriture relue en base, et `saas/web` n'a toujours aucun runner de test. Le
ticket a fait naître
[39 · L'annulation des étiquettes IA a perdu son déclencheur](issues/39-l-annulation-des-etiquettes-ia-a-perdu-son-declencheur.md) :
les garanties 2 et 3 de l'ADR 0001 tenaient à un `depuis` gardé dans le
`sessionStorage` de l'onglet qui cliquait — sans clic, plus rien à annuler,
alors que le besoin grandit (l'IA classe maintenant sans qu'on le demande).

**[16 · Le seam du payload](issues/16-le-seam-du-payload.md)** — **`build_payload`
tourne hors ligne, pour la première fois du dépôt.** Elle prend un `Lecteur`
(`saas/traitement/lecteur.py`) au lieu d'un client Supabase : trente méthodes,
une par source, dont **les quatre fenêtres GA4, les six requêtes qui passaient
par `sb.table(...)` en clair, les trois appels Gemini, les deux ÉCRITURES et
l'horloge** — les deux dernières ne sont pas dans le mot « lecteur », et sans
elles un test hors ligne écrirait en base et lirait la vraie date. **Trente-six
points d'appel** réécrits, tous mécaniques ; les **sept `from saas.collecte…`
cachés au milieu de la fonction** disparaissent, chacun étant un point de sortie
qu'aucune signature n'annonçait. Les `try/except` restent chez l'appelant, et
`themes_regroupes()` laisse toujours remonter `VueRegroupementAbsente`. **Aucun
découpage** des 3 775 lignes : le ticket lève l'interdiction du docstring, il ne
l'utilise pas.

**Le « rapport identique avant/après » demandé par le repli n'existe pas**, et pas
pour la raison attendue : avant l'injection la fonction ne pouvait pas tourner
hors ligne du tout, donc il n'y a pas de « avant » à comparer. Ce qui le remplace
est une **équivalence de routage** — chaque méthode jouée contre un espion doit
atteindre la même fonction, la même chaîne PostgREST et les mêmes arguments qu'à
`git show HEAD:…`, écritures comprises. **298 vérifications neuves**, dont la
première est la phrase du produit : **aucun conseil ne porte un thème non
étoilé**, par ses DEUX portes (un thème classé sans étoile n'a pas de carte ; au
delà de la troisième étoile la carte porte `conseille: false` et zéro conseil).
Le plafond de cinq tient, une semaine calme rend moins de cinq sans remplissage,
zéro étoile rend zéro conseil, le ROAS bi-régie couvre le même périmètre des deux
côtés, deux Annonces homonymes restent deux, et **la publication est idempotente**
— rejouée trois semaines plus tard elle retombe sur la même ligne (13 l'avait
démontré sur un calcul recopié). **1 326 vérifications rejouées**, et **seize
assertions réécrites** dans six harnais : elles cherchaient dans le TEXTE des
appels qui ont changé de point d'entrée, pas de destination — c'étaient
exactement les substituts que ce seam remplace par une exécution.

**Sa revue de code a trouvé un trou dans le seam**, et la leçon vaut plus que le
trou : `_themes_tips`, fonction du module **appelée depuis** `build_payload`,
appelait `_call_gemini` directement — la construction partait sur le réseau dès
qu'une clé Gemini existait dans l'environnement, et un test « hors ligne »
dépendait de la machine qui le joue. La vérification ne regardait que le CORPS
de la fonction ; elle est maintenant **transitive** et suit les appels. **Deux
prémisses du ticket étaient fausses** : « aucune suite de tests n'existe »
(neuf harnais existaient, ~1 300 vérifications) et « les dix règles neuves se
vérifient une par une » (déjà fait par 07 et 10 ; rejoués, pas refaits). **Et
deux défauts trouvés en faisant tourner la fonction, aucun corrigé** —
[40](issues/40-un-theme-sans-revenu-confirme-est-publie-a-zero.md)
(`themes.rows[].rev` publie `0.0` là où la carte publie `null` ; **aucun écran ne
le montre aujourd'hui**, et le ticket le dit) et
[41](issues/41-la-fenetre-ne-s-ancre-pas-sur-google.md), le plus lourd :
**l'ancre de la fenêtre ne lit pas Google**, donc un compte Google seul mesure
des jours vides — mêmes lignes, **210 CHF en Meta contre 90 CHF en Google**, et
c'est exactement le compte que la v1 promet de servir. **Rien n'est joué en
base** et **rien ne se voit à l'écran** : ce ticket ne change aucun rendu et ne
demande aucun passage du worker.

- **[21 · Les statuts de campagne Meta s'arrêtent à 200](issues/21-campagnes-meta-non-paginees.md) —
resolved.** `_fetch_meta` demandait les campagnes avec `limit: 200` et ignorait
`paging.next` : au-delà, la liste était **tronquée sans un mot**, et la 201e
campagne recevait le même `UNKNOWN` qu'une campagne dont Meta ignore vraiment le
statut — le piège PostgREST de `CLAUDE.md` §8 sur une autre API. `_meta_campagnes`
suit le curseur au bout et rend `(campagnes, erreur)`, **le contrat de
`_meta_chunk`**, pour la même raison : sans lui, « ce compte n'a que 200
campagnes » et « on s'est arrêté à 200 » se confondent. **Le vrai correctif est
le silence levé** — le journal donne son compte à chaque passage, et nomme
l'incomplétude quand il y en a une. La run reste **verte** : ces statuts ne
portent aucune dépense, et une semaine d'insights vaut plus qu'une liste
complète. **Retiré au passage** : `row["effective_status"]`, posé sur chaque
ligne d'insight et **lu par personne** — son seul effet était de fabriquer un
`UNKNOWN`. **Et la revue a trouvé bien plus gros que le ticket : un
jeton client sortait par CHAQUE échec réseau.** `requests` recopie l'URL
appelée dans son exception — vérifié sur pièce — et le curseur `paging.next` de
Meta la porte par construction ; ce message ne s'arrêtait pas au journal public,
`suivi.termine` l'écrivait dans `fetch_progress.mot_de_fin`, que **l'app relit
et montre**. Un membre invité y aurait lu un jeton de `connected_accounts` —
`CLAUDE.md` §7 violé deux fois. `_sans_jeton` est posé sur **le goulot** (`_fil`,
donc les quatre canaux, `refresh_token` Google compris) et sur les quatre autres
sites qui impriment une exception réseau. **Trois défauts de plus dans le même
geste** : les statuts vivaient sous le `if rows:` des insights (un compte qui ne
dépense plus montrait l'`ACTIVE` de sa dernière semaine dépensière **comme
courant**) ; un curseur Meta qui rend une page vide avec un `next` faisait
tourner le worker sans fin et sans un mot ; et une réponse JSON qui n'est pas un
objet levait **au travers d'une fonction qui a promis de ne pas lever**.
**40 vérifications neuves** (harnais `21-campagnes-paginees`, faux Graph qui
pagine ET fuit comme le vrai), **quatre mises à l'épreuve par mutation**, 16
harnais rejoués, tous verts. **Non mesuré, et ça le reste** : combien de comptes
dépassaient 200 campagnes — aucun accès à la base. **Rien ne se voit en
cliquant** (§9) : il faut un passage du worker, cron du Jour de travail ou
`weekly-fetch.yml` à la main. **Laissé ouvert dans le ticket** : `_meta_chunk`
n'a pas de plafond de pages, et un chiffre choisi de mémoire y tronquerait une
récolte réelle.

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

**[17 · Le verdict « figé » qui se réécrit chaque semaine](issues/17-verdict-persiste-qui-derive.md)** —
**un verdict se rend une fois.** Une ligne faite reste `due` pour toujours : la
boucle la remesurait contre le KPI du jour et **réécrivait** `verdict` à chaque
rapport, donc un `worse` de juin redevenait `better` en septembre parce que le
compte avait bougé — et cette valeur-là nourrissait la mémoire du thème puis le
poids des conseils (`_DONE_W`). La migration disait pourtant « écrite UNE
FOIS » : c'est maintenant vrai, garde chez l'appelant **et** `verdict IS NULL`
côté base. Le `then/now/delta` n'est servi que **la semaine de la chute** —
après, il mesurerait la dérive du compte, pas l'action ; **prix assumé et
irrécupérable**, l'archive existante perd sa ligne d'effet d'un coup (question
des deux colonnes posée au ticket 42). La **mémoire d'un thème** se nourrit
désormais du verdict persisté, sans mesure fraîche : elle perdait une hypothèse
dès qu'un `roas` n'avait pas de revenu rattachable, et `condense_theme_memoire`
réécrivant `resume` en entier, la perte était définitive. Le **rattrapage de
condensation** n'appelle plus l'IA quand la mémoire n'a nulle part où se poser
(pas de ligne `theme_plan`, thème renommé, colonne `resume` pas migrée) :
c'était un appel Gemini par thème et par semaine pour une écriture qui touche
zéro ligne. **La revue de code a trouvé deux défauts dans le correctif
lui-même**, tous deux corrigés et couverts : `ecrire_verdict` rend maintenant
`True` seulement si une ligne a été touchée et la mémoire attend ce retour
(sinon un refus RLS y versait un chiffre neuf chaque semaine — la dérive
déplacée d'un cran), et la condensation reçoit le libellé de `theme_plan`, pas
celui du carnet (un renommage à la casse près passait le garde et ratait
l'écriture). **47 vérifications neuves** dans `harnais/17-verdict-fige/`, le
premier harnais à **réutiliser** le faux lecteur du 16 plutôt qu'à le recopier ;
chacune rejouée d'abord contre le code d'avant, où elle tombe. Huit harnais
rejoués sans régression — **1 671** au total. **Rien n'est joué en base** (que
`.is_("verdict", "null")` bloque réellement une seconde écriture **reste à
constater**) et **rien ne se verra avant un passage du worker** : cron du Jour
de travail, ou `weekly-fetch.yml` en `report_only`.

**[18 · Le revenu Google non rattachable](issues/18-revenu-google-non-rattachable.md)** —
**mesuré, et la mesure a déplacé la question.** L'étape 1 du ticket est faite,
en lecture seule dans l'éditeur SQL Supabase du projet vivant : ce n'est **pas
zéro** (2 campagnes étiquetées, **808.87 CHF**), mais ce n'est pas diffus non
plus — **tout tient sur le seul thème « Campagne Générale », à 100 %.** Les dix
autres thèmes sont à 0 %. Le ticket cherchait une règle d'attribution à choisir
entre trois (puis quatre) lectures ; il a trouvé **une fabrication à arrêter**.
Les deux campagnes muettes portent dans `google_campaign_config` un
`campaign_name` que Google n'a jamais émis — `Campagne <campaign_id>`, écrit par
`labeling.py` l. 282, qui liste les campagnes depuis `google_ads_insights` sans
lire le `campaign_name` que cette table porte pourtant. Le vrai nom
(`ch_fr_pmax_herbst_2026`, `ch_de_pmax_herbst_2026`) est intact dans
l'historique, **et GA4 le connaît** : 352.00 CHF de revenu réel n'ont
aujourd'hui aucun thème. ROAS affiché 0.00, ROAS réel 0.44. Second dégât : la
description envoyée à Gemini était `«Campagne 24176742897»`, sans un mot de
business — d'où les deux campagnes dans le fourre-tout. Le défaut technique part
au ticket [43](issues/43-le-nom-dune-campagne-google-est-fabrique-par-letiqueteuse.md) ;
18 **reste `open`** et garde la seule question qui demande David : que dit-on
d'une campagne étiquetée vraiment non rattachable, une fois la fabrication
arrêtée ? **`build_report.py` et `insights.py` sont intacts** — aucune règle
d'attribution n'a été écrite (étape 3 du ticket).

**[43 · Le nom fabriqué](issues/43-le-nom-dune-campagne-google-est-fabrique-par-letiqueteuse.md)
· [18 · La part muette](issues/18-revenu-google-non-rattachable.md)** — **résolus
tous les deux, et le second a fallu poser la question à David DEUX fois.**
`labeling.py` listait les campagnes Google sans lire le `campaign_name` que
`google_ads_insights` porte pourtant, fabriquait `Campagne <id>` et **l'écrivait
en base** : le pont du revenu détruit (352.00 CHF orphelins) et Gemini classant
sur une description sans un mot de business. Corrigé à la source — `name` part
en base et vaut `None` sans nom réel, `desc` seul garde le repli pour Gemini —
plus une migration de rattrapage (`nom_google_fabrique.sql`, un `UPDATE` borné à
l'égalité exacte, **périmètre mesuré en lecture seule : 2 lignes**), **que David
doit jouer.** Pour 18, la première réponse (« se taire ») reposait sur une
prémisse fausse que j'avais énoncée : le pont passe par le nom pour les DEUX
régies, et **mesuré avant d'écrire la règle**, se taire aurait vidé **10 thèmes
jugés sur 17** — 9 à cause de Meta seul, 48 431 CHF sur 90 515. Seconde réponse,
implémentée : **on publie le ROAS et on écrit la part muette à côté** — la vue
rend `spend_muette` / `campagnes_muettes` (NULL et non 0 quand GA4 ne répond pas
au COMPTE), la carte de thème porte `part_muette`. `insights.py` n'est pas
touché : depuis 04, il ne calcule plus le ROAS d'un thème. **39 vérifications
neuves**, dont 21 **contre un vrai PostgreSQL montant la vraie migration**,
toutes rejouées d'abord contre le code d'avant ; le faux lecteur du 16 a été
aligné sur la vue (GA4 se juge au compte, pas au thème). **1 874 au total, aucun
échec.** ⚠ **Rien de tout ça n'atteint la production** : `theme_regroupement`
n'existe pas en base et sa migration ne peut pas être jouée — voir
[44](issues/44-la-vue-du-regroupement-ne-peut-pas-etre-jouee.md).

**[44 · La vue ne peut pas être jouée](issues/44-la-vue-du-regroupement-ne-peut-pas-etre-jouee.md)** —
**ouvert, et il bloque 04, 18 et 22.** Deux faits lus en base le 2026-09-13 :
`theme_regroupement` **n'existe pas** en production, et la migration qui
l'installe **échoue** (`column p.eng does not exist`). `instagram_organic_posts`
n'a pas de colonne `eng` et aucune migration n'en crée — la table est antérieure
aux migrations, ce que le commentaire de la vue dit sans en tirer la
conséquence. `000_run_me_all.sql` porte la même ligne, donc « le fichier unique
à jouer » échoue au même endroit. **Le harnais 04 ne l'a pas vu parce que son
`schema.sql` déclare `eng`** : il prouve la vue contre une base qui n'existe
nulle part — c'est le plus coûteux des deux défauts, il se reproduira sur la
prochaine colonne. La réparation demande d'abord une **définition produit** de
l'engagement (`likes + comments + saved` ? avec `follows` ? nombre ou taux sur
`reach` ?), à écrire dans `CONTEXT.md` : elle ne s'invente pas en passant.

**[19 · Trente écritures qui ne se relisent pas](issues/19-ecritures-qui-ne-se-relisent-pas.md)** —
**les trois familles, cascade comprise.** Sur les 30 écritures nues il en reste
**2**, et le code écrit désormais leur raison (le harnais épingle le chiffre :
c'est ce qui empêche une trente et unième d'arriver en silence). Le défaut avait
une **seconde moitié** que le ticket ne voyait pas : les écrans **jetaient la
réponse** — `budget-editor.tsx` faisait `setSaved(true)` après un appel qu'il ne
regardait pas. Corriger les actions seules n'aurait rien changé pour le client.
**L'arbitrage de la famille 3 est tranché et il est à David** : séquence plutôt
que fonction SQL `SECURITY DEFINER`, parce qu'aucune migration ne peut être jouée
(03, 04, 05 attendent) et qu'un appel à une fonction inexistante casserait le
renommage au lieu de le rendre silencieux — *on ne remplace pas un mensonge par
une panne*. Le patron n'est pas neuf : `_fusionnerLabels` l'appliquait déjà, il
est **étendu aux quatre** chemins (thèmes **et** catégories de conversion) via
`lib/cascade.ts`, un module **pur** — c'est ce qui le rend jouable hors ligne,
`actions.ts` ne le sera jamais. **Deux défauts trouvés en chemin et corrigés dans
le même geste** : `renameLabel`/`deleteLabel` écrivaient `profiles.labels` sur
une lecture **non vérifiée** (`_labels` replie un SELECT raté sur `[]`, donc une
lecture ratée **effaçait tous les thèmes du compte**), et l'ordre de
`renameConversionCategory` rendait un arrêt **irrattrapable**. **La revue a
trouvé ce que la relecture avait manqué** : le **dernier maillon** de chaque
cascade — l'étape qui écrit la liste maîtresse — ne rendait que son `.error`,
donc le défaut corrigé par ce ticket survivait **dans sa propre correction** ; et
les deux cascades de catégories pouvaient être des **no-op complets** et dire
« renommée partout ». Les quatre comptent leurs lignes, et le refus se dit
autrement qu'un arrêt — la liste maîtresse étant la dernière, **tout le reste EST
écrit**, et le message le dit. **117 + 23 vérifications neuves**, dont **trois**
mises à l'épreuve **par mutation** ; 639 rejouées ; 19 routes. **Rien n'est joué
en base** — mais le risque propre au ticket est écarté **sur pièce** : un
`RETURNING` fait appliquer la politique de SELECT, donc un SELECT plus étroit
que l'UPDATE **bloquerait** l'écriture, et `peut_editer` est exactement
`a_acces` plus `role = 'editor'` (§12 du SQL). **Exception au §9** : tout est
côté web, donc **visible au prochain déploiement sans aucun passage du worker**.
Sa revue a ouvert deux tickets :
[45 · Renommer un thème lui fait perdre son étoile](issues/45-renommer-un-theme-lui-fait-perdre-son-etoile.md) —
l'étoile est une **clé** `priority_label:<nom>` que le renommage simple ne
propage pas et que la suppression ne retire pas, donc un thème renommé perd ses
conseils et un thème effacé consomme en silence une des trois places
(`CLAUDE.md` §1) ; et
[46 · La période des coûts peut s'inverser](issues/46-la-periode-de-couts-peut-s-inverser.md) —
**hors de ce ticket**, dans du travail non commité porté par un autre chantier
(`lib/couts.ts`, `bandeau-commandes.tsx`, `prototype-switcher.tsx`), donc écrit
plutôt que corrigé (§5) : le premier des trois affiche une **courbe vide et des
totaux à zéro** sur une fenêtre à l'envers, sans un mot.

**[24 · La Marche suivante écrite par Gemini](issues/24-marche-suivante-ecrite-par-gemini.md)** —
**le repli de 06 est rattrapé, et c'est le seul endroit où l'IA écrit encore un
conseil.** Un module neuf, pur et headless (`saas/recos_ia/marche_suivante.py`),
branché dans la boucle des thèmes **avant** le tri et la coupe — la consigne de
repli est tenue, `composition.py` n'est pas touché d'une ligne. **La barrière qui
compte se ferme deux fois** : le branchement n'appelle Gemini que si une
Stratégie est ouverte **par une règle** et que le client a confirmé la Marche
précédente ; et le module rejette toute piste qui ne déclare pas
`role="generale"` — or c'est très exactement ce que la boucle
`ecrire_plan_de_theme` **ne ramasse pas**. Ce garde-fou vient de la décision 11
de [14](../refonte/issues/14-le-conseil-facile-et-la-degradation.md), que la
décision 6 de 22 n'a pas renversée : **sans lui j'aurais produit une Hypothèse**,
donc une Stratégie ouverte par Gemini. Les listes fermées arrivent **par
paramètre** (`build_report.GRAMMAIRE`) plutôt que recopiées — les deux tables qui
divergent ont déjà coûté `PROOF_KPI`. `effort` s'ajoute aux quatre colonnes du
ticket, parce que sans lui le plafond des gestes lourds ne peut **par
construction** jamais voir une Marche, et la décision 1 de 22 dit qu'il existe
pour ça. **Deux défauts trouvés par ma propre relecture, pas par les tests** :
une **Note cochée** faisait avancer une Stratégie qu'elle n'avait jamais ouverte,
et un **seul vieux clic** faisait écrire une étape neuve chaque semaine — chaque
étape portant sa propre clé, l'empreinte ne les voyait jamais passer. La borne
posée est le `week_start` du dernier rapport publié : *un clic, une Marche*, la
lecture littérale de la décision 9 de 14. **171 vérifications neuves**, dont
**60 sur `build_payload` réellement exécutée** (seam du 16) — y compris la seule
qui compte vraiment : **rien n'entre dans `theme_plan`**, lu sur les écritures
tentées, pas supposé. Les **48 autres fichiers de harnais rejoués sans
régression**, par `harnais/jouer_tout.py` que ce ticket ajoute. `saas/web` n'est
pas touché. **§9 s'applique en entier** : ça ne se verra qu'après un passage du
worker — et seulement le jour où une règle qui pose une Hypothèse et un clic
« ✓ Je l'ai fait » se rencontrent sur le même thème.

**[28 · « Engagement du compte » filtré par thème](issues/28-engagement-du-compte-filtre-par-theme.md)** —
la tuile disait « du compte », la phrase du bandeau le **jurait** au lecteur, et
le chiffre était celui du thème coché. Des deux réparations légitimes, c'est le
périmètre qui bouge, pas l'étiquette : `avgEng` et `histReach` se calculent
désormais sur `tous` — la liste d'avant le filtre. La raison qui tranche n'est
pas la tuile, c'est **`histReach` comme repère** : il colore en vert la portée
d'une ligne de la table des posts, écrit son pied et son état vide. Filtré, il
faisait changer de couleur une ligne que rien n'avait changée, et pris à
l'intérieur du groupe qu'il note il mettait la moitié des lignes en vert par
construction. L'engagement DU thème n'est pas perdu : c'est la colonne « Eng. »
de « Performance par thème », et la phrase du bandeau y renvoie maintenant —
**seulement si cette table est rendue**, sinon le renvoi serait la même faute par
l'autre bout. **Un zéro fabriqué part avec** : un thème sans aucun post donnait
`mean([])` → « Engagement du compte : 0,0 % », §7 de face. `tsc` et `npm run
build` verts, **19 routes**. Pas de harnais : `saas/web` n'a aucun lanceur de
tests et `getInstaDash` va chercher Supabase. **Ça se voit tout de suite**, à la
lecture — c'est du rendu de page, aucun passage du worker n'est nécessaire.
