# Le conseil toujours faisable, et celui qu'on ignore

Type: grilling
Status: resolved

## Question

Gradué par [12](12-module-de-commandes.md), où David a répondu bien au-delà de
la question posée sur le compteur :

> *« Je ne suis pas sûr de comment on fait si la personne ne répond pas […]. Je
> les garderais, car nous avons des recos mais nous avons un problème, et cela
> sera souvent le cas : les personnes n'ont pas le temps ou l'envie de les faire,
> donc ne les font pas. On devrait laisser 1-2 semaines et, si pas faite, faire
> des recos plus simples. Je partirais même sur une base de toujours avoir une
> reco super simple à mettre en place, pour motiver les personnes à faire une
> étape. »*

12 a tranché ce qui le concernait — la pastille ne compte que la semaine en
cours, un conseil ignoré cesse d'être compté sans être perdu. **Ce qui devient
du conseil ignoré ensuite est une règle du moteur, pas du bandeau**, et c'est ce
ticket.

### Le fait qui change la donne : le signal existe déjà et il est jeté

Les quatre réactions sont en base — `useful` / `not_for_me` / `too_hard` /
`done` (`saas/web/app/actions.ts:11`) — et le bouton **« ◇ Trop compliqué »**
est à l'écran depuis le début (`components/reco-actions.tsx:44`). Son en-tête
dit même ce qu'il veut dire : *« ni un rejet ni un accord — je vois l'intérêt
mais je ne sais pas faire »*.

**`build_recos` ne le lit jamais.** Il ne pondère que `not_for_me` (+6) et
`done` (+2 ou +6 selon le verdict mesuré) ; `grep -rn "too_hard" saas/recos_ia/`
ne rend **rien**. Quatrième tuyau mort de la carte, après `preuve` (08), les
semaines passées (06) et les constats de `/labels` (11).

### Ce qu'il faut trancher

- **Ce que « plus simple » veut dire, mesurablement.** Un conseil n'a pas
  aujourd'hui de champ « difficulté ». On le déclare à la règle (chaque règle de
  `reco_engine.py` porte son coût) ? On le déduit du levier (`argent` est plus
  facile que `contenu` ?) ? Sans définition, « plus simple » est un mot, pas un
  tri. **`CLAUDE.md` §7 s'applique : une difficulté inventée est un chiffre
  fabriqué.**
- **Ce qui déclenche la dégradation.** Un `too_hard` explicite, ou l'absence de
  réponse pendant deux semaines, ou les deux ? L'absence de réponse est
  ambiguë — elle peut vouloir dire « pas vu ».
- **Le conseil toujours faisable.** Est-ce une **onzième règle** de
  `reco_engine.py` qui produit un conseil garanti, ou un **plancher** appliqué à
  la sélection des cinq (« au moins un conseil de coût bas dans le lot ») ? Le
  second ne fabrique rien de nouveau ; le premier risque le conseil décoratif
  qui se répète chaque semaine.
- **Le garde-fou de la répétition.** Un conseil facile garanti chaque semaine
  devient un décor en trois semaines — c'est la leçon écrite dans
  `alerte-themes.tsx`. Qu'est-ce qui l'empêche ?
- **Le rapport à `user_persona.py`.** Le profil client vivant porte déjà
  « niveau de maîtrise » et « à éviter ». La dégradation passe-t-elle par lui
  (l'IA calibre le ton) ou par le moteur déterministe (le tri) ? Les deux
  existent, et 11 a rappelé qu'on ne veut pas deux moteurs pour une lecture.

### Ce qui n'est PAS dans ce ticket

Le compteur et son affichage — [12](12-module-de-commandes.md), résolu. Le
nombre de conseils (cinq par semaine sur tout le compte) et leur origine —
[11](11-d-ou-viennent-les-conseils.md), résolu.

### Consigne de conduite

Ticket **HITL**. Skills : `recos` (pertinence et variété), puis `grilling` +
`domain-modeling` si un mot nouveau (« difficulté », « coût d'un conseil ») doit
entrer dans `CONTEXT.md`.

### Consigne de repli

Trancher la définition de « plus simple » avant tout le reste : sans elle,
aucune des autres questions n'a de prise.

## Answer

### Le ticket se trompait trois fois, et la troisième change la question

**1 · Le champ « difficulté » existe.** Il s'appelle **`effort`** : liste fermée
de quatre valeurs (`build_report.py:84`), déclarée par clé de règle dans
`EFFORT_BY_KEY` (l. 85-107), affichée en pastille `⏱` (`reco-card.tsx:106`),
persistée au carnet (`actions.ts:46`) et **déjà le 5ᵉ critère de tri** de
`_importance` (`_EFF_W`, l. 430/447).

**2 · `too_hard` n'est pas jeté — son consommateur est écrit et jamais appelé.**
`_themes_tips()` porte un paramètre **`bloques`** avec le prompt exact
(l. 1594-1611 : *« Traite ces sujets EN PRIORITÉ, en expliquant le savoir-faire
qui manque, pas en répétant le conseil »*) ; **le seul appelant ne passe que deux
arguments** (l. 4365). Pire, `reco-actions.tsx:39` promet par écrit que ce retour
*« remonte dans "Pour aller plus loin" la semaine suivante »* — **cette chaîne
n'existe nulle part dans le dépôt**. Tuyau posé, raccordé au mauvais bout,
documenté comme s'il coulait.

**3 · Tout ce que ce ticket voulait inventer existe déjà, et [11](11-d-ou-viennent-les-conseils.md)
vient de couper son fournisseur.** La « stratégie en étapes » demandée par David,
c'est **`theme_plan`** (une ligne par thème : `reco_key`, `levier`, `decided_at`,
`snapshot`, `resume`) plus ses deux fenêtres — `FENETRE_LEVIER` (7 j
contenu/tempo, 14 j argent/audience) et `ATTENTE_MIN_NOUVELLE_HYPOTHESE`
(14-21 j). Son axe « retoucher vs fabriquer », c'est **`role`**, déjà défini mot
pour mot : `generale` = *« une modification précise sur un élément NOMMÉ, dont on
peut CONSTATER DEMAIN, à l'œil, dans la plateforme, qu'elle a été faite — un
état, jamais un KPI »*. Son axe « geste », c'est **`nature`** : liste fermée de
cinq — couper / augmenter / tester / créer / corriger — **déjà exigée distincte
entre les trois idées d'un thème**. Et le décompte est déjà là : trois places par
thème, toujours **2 « générale » + 1 « hypothèse »**, forcé par le code.

Le tout est **100 % Gemini** depuis la décision du 27 août 2026 (*« plus aucun
conseil-règle ne participe aux 3 recos d'un thème »*), et `upsert_theme_plan`
n'est appelé que pour l'hypothèse IA (l. 3691). **En coupant les pistes IA
(l. 1470), 11 a rendu orphelins `theme_plan`, `NATURES_IA`, `ROLES_IA` et toute
la séquence à fenêtre.** Ce ticket n'avait donc rien à inventer : il avait à
décider qui reprend cette grammaire.

### L'état du stock, mesuré

Après les coupes de 11, **douze règles déterministes survivent**. Sur l'axe du
geste : **une seule retouche** (`roas`, un arbitrage de budget), **six
fabrications** (`silence`, `page_endormie`, `orga_rythme`, `orga_essoufflement`,
`orga_format`, `orga_reaction`), trois vérifications, deux mises en place. Sur
l'axe du temps : **10 min : 2** (dont `connecter_ga4`, qui disparaît une fois
GA4 branché) · **30 min : 5** · **1 h : 5** · **2 h+ : 0** (cette valeur n'était
produite que par les pistes IA que 11 coupe).

Cinq clés valaient « 10 min » avant 11 ; **11 en tue trois** (`gaspillage`,
`scaler`, `creneau`). Le moteur d'après-11 produit donc très exactement la
semaine que David décrit comme dégoûtante : trois demandes de fabrication
d'affilée.

**Et quatre des cinq exemples de conseil facile donnés par David ne sont pas
écrivables faute de données** — mots-clés (aucune table ; le texte n'est récolté
que pour légender un changement, `fetch_google_ads.py:941`), audience Meta
(aucun découpage âge/sexe/placement), texte d'annonce (on a `ad_name` et les
chiffres, jamais le titre), page d'atterrissage (GA4 récolte
`date × source × medium × campagne`, `fetch_ga4.py:86`). **Le cinquième — bloquer
le CPC — est disponible, et c'est `_rule_gaspillage`, la règle que 11 a tuée.**

### Les décisions

**1 · « Plus simple » ne demande aucun champ neuf.** Trois axes existants
suffisent : **`effort`** (le temps à prévoir), **`nature`** (le geste, cinq
valeurs fermées), **`role`** (`generale` = constatable demain à l'œil). Pas de
champ `geste`, pas de champ `difficulté`. Seule correction : la pastille dit
« temps à prévoir », jamais une promesse de durée.

**2 · Le résultat attendu ne s'affiche jamais — il trie.** Un « impact élevé »
montré au client serait un chiffre fabriqué (§7). Ce qui est mesuré, c'est
l'**enjeu** (la somme réellement en jeu) et la **confiance** (●◐○). Le tri
combine l'effort déclaré, l'enjeu mesuré et un **poids d'impact déclaré par
règle**, interne. David : *« je ne dis pas qu'il faut mettre impact élevé […]
mais nous en interne, on sait que changer un CPC objectif a plus d'impact que
changer une description. »* C'est la doctrine déjà écrite pour `_importance` :
*« ce tuple est INTERNE, il ne devient jamais un score affiché »*.

**3 · Un plafond, pas un plancher.** **Jamais plus de deux conseils à la fois
`créer`/`corriger` et `effort ≥ 1 h`.** Un plancher (« au moins une retouche »)
serait invérifiable la plupart des semaines — il n'y a qu'un candidat en stock —
et un plancher qu'on ne peut pas tenir se remplit de décor. Un plafond se
respecte toujours : il suffit d'arrêter de servir. Le plancher devient un ticket
d'écriture de règles, il ne se décrète pas.

**4 · La composition des cinq** : **une à deux Marches d'une Stratégie**, des
retouches rapides (faible effort, fort enjeu), et le plafond ci-dessus. David :
*« on a dit 1 ou 2 recos suivent une logique, c'est cela que je dis avec la
marche. »*

**5 · Le déclencheur de la dégradation, en deux vitesses.** `too_hard`
**simplifie** : c'est le seul signal qui dit *quel savoir-faire manque*. Deux
semaines sans réponse **mettent en veille** — le conseil cesse d'occuper une des
cinq places, il n'est ni refusé, ni perdu, ni remplacé par une version plus
facile. Lire un silence comme « c'était trop dur » inventerait une intention :
§7, et le renversement de David en [04](04-ce-qui-doit-etre-valide-en-premier.md)
(*juger une note obligerait Pulse à choisir le chiffre à sa place*). Le calcul est
disponible sans infrastructure neuve : `reco_feedback` porte `week_start` et le
worker relit déjà les huit derniers rapports publiés.

**6 · Deux destinataires séparés, pas deux moteurs.** Le moteur déterministe ne
fait qu'une chose : trier sur `effort`/`nature`/`role`. `too_hard` **ne va pas au
tri** — il va au savoir-faire : on branche `bloques` sur l'appel `_themes_tips`
(l. 4365), un argument à passer, et la phrase déjà écrite dans
`reco-actions.tsx:39` devient enfin vraie. `user_persona.py` garde le **ton** et
n'entre jamais dans le tri. Ce ne sont pas deux lectures d'un même objet ([11]),
ce sont deux objets : le conseil, et le mode d'emploi.

**7 · Le périmètre est le thème, mais on descend jusqu'à la campagne — correction
à [11](11-d-ou-viennent-les-conseils.md).** David : *« c'est exact, c'est les
thèmes, mais ces thèmes ont en leur sein des campagnes. Si je me concentre sur le
thème X il y a peut-être 2 campagnes, une qui fonctionne et l'autre non, donc les
recos sont sur une campagne. Mais nous ne prenons pas les autres campagnes qui
sont sous un autre label. »* 11 disait *« on arrête tout conseil qui porte sur une
campagne précise dans une seule régie »* ; la règle exacte est plus fine : **une
campagne peut être nommée si elle appartient au thème traité.** Une campagne hors
thème, ou sans étiquette, reste hors sujet.

**8 · L'avancement se lit à deux endroits, et le second est mesuré.** Le clic
« fait » (`suivi_actions.done_at`), et **`platform_changes`** — table alimentée à
chaque récolte, dont la colonne `categorie` est une liste fermée qui parle la
langue des conseils : `budget`, `motcle`, `enchere`, `statut`, `audience`,
`creatif`, `autre`, par campagne, avec un résumé déjà rédigé en français. David :
*« le user fait les recos et pas juste clique recos faite. »* **Deux limites
notées** : Google `change_event` plafonne à **30 jours** (`CLAUDE.md` §8 — une
fenêtre plus large fait rejeter la requête entière), et la table ne couvre que
Meta et Google : **un conseil organique n'a aucune corroboration possible**,
seulement le clic.

**9 · Deux horloges.** La **Marche suivante arrive au « fait »**, pas au verdict —
sinon il y a deux semaines de vide entre changer un CTA et changer un header, et
la Stratégie meurt d'ennui. Le **Verdict** sert à autre chose : il décide si la
Stratégie **continue** ou **change** — un `worse` sur le CTA ne fait pas passer au
header, il fait revenir sur le CTA.

**10 · L'empreinte anti-répétition = `reco_key` + `cible`.** David : *« mettre un
objectif de CPC à X, dans deux semaines on peut refaire une reco mettre CPC
objectif à X. Le X ne sera pas le même. […] On ne fait cependant pas revenir la
même reco qui change exactement la même chose. »* Même clé, cible différente →
autorisé, c'est une nouvelle Marche. Même clé **et** même cible qu'une semaine
déjà servie → interdit. `cible` est déjà dans `RECO_FIELDS` et déjà affiché en
pastille `▪` ; ça se vérifie sur `weekly_reports`, sans champ neuf ni migration.
**Ceci remplace la règle que la session avait recommandée** (« une clé `done` au
verdict `better` ne revient pas ») : David l'a renversée, et il a raison — c'est
l'instruction exacte qui ne se répète pas, pas la clé.

**11 · L'échelle des Marches est écrite par Gemini.** Aucune règle déterministe
ne sait que « refaire la landing page » se descend en CTA → header → section
mieux structurée : ce n'est pas dans les chiffres, c'est du savoir-faire. Ça ne
contredit pas 11, qui a coupé les pistes IA parce qu'elles disaient *« quelque
chose que rien ne peut vérifier »* — une idée inventée à partir de chiffres — et
qui a **explicitement épargné les astuces** (*« des bonnes pratiques durables qui
restent valables dans six mois »*, l. 1612). C'est le même endroit où `bloques`
se branche. Garde-fou : la Marche proposée doit être `role: generale`, donc
constatable demain, et corroborable par `platform_changes` quand elle porte sur
une campagne.

**Point le plus souple de cette résolution, signalé comme tel** : à la question
« qui écrit l'échelle — nous en dur, ou Gemini ? », David a répondu en recadrant
le périmètre (*« 1 ou 2 recos suivent une logique »*) sans trancher l'auteur. La
recommandation Gemini n'a pas été contestée, elle n'a pas été explicitement
choisie. À rouvrir sans frais si le ticket 22 bute dessus.

**12 · Ce qui sort en tickets.** [22](22-rebrancher-le-plan-de-theme.md) — remettre
`theme_plan`, `nature`, `role` et les fenêtres d'attente en service côté
déterministe. [23](23-recolte-des-quatre-manques.md) — la récolte des quatre
données qui bloquent les conseils faciles. David a validé le découpage : un ticket
qui porte cinq décisions se calibre mal, c'est le reproche que
[06](06-le-parcours-comment-les-pages-se-parlent.md) s'est fait à lui-même.

### Vocabulaire

`CONTEXT.md` gagne **Stratégie**, **Marche** et **Mise en veille**. Trois entrées
existantes perdent leur mention « rédigée par l'IA » — **Hypothèse**, **Levier**,
**Plan de thème** — puisque ce sont désormais les règles qui déclarent.
Le mot **chantier** n'est pas retenu : `CONTEXT.md` l'écarte déjà explicitement
(entrée *Action suivie*), et `CLAUDE.md` §6 s'en sert pour les cartes wayfinder.
