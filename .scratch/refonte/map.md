# Refonte : reprendre les bases de Pulse

> ## ⚠️ LA MOITIÉ « CONSEIL » DE CE DOCUMENT EST CADUQUE — 2026-09-21
>
> Le moteur de recommandations a été retiré de Pulse, sur demande de David
> (« je n'arrive plus à suivre cette application »). Tout ce que ce document
> dit du **conseil**, de la **composition de la semaine**, du **suivi des
> actions**, du **Carnet**, du **module À faire**, du **brief IA**, des
> **règles payantes** et de la **labellisation IA** décrit un produit qui
> n'existe plus.
>
> Ce qui reste vrai : le regroupement par thème, les thèmes prioritaires, la
> fenêtre de sept jours pleins, le Jour de travail, le canal muet, et tout ce
> qui CHIFFRE.
>
> Le document n'est pas réécrit : c'est une carte de travail, pas la carte du
> savoir. Le nouvel état du produit est dans `CLAUDE.md` §1. Ce que le retrait
> rouvre est noté dans `BACKLOG.md`, section « Le retrait des recommandations ».
>
> **Tickets encore ouverts après le tri** : construction 22, 28, 29, 34, 35,
> 40, 41, 44, 49, 53 · refonte 18, 30. Les vingt-et-un autres sont partis avec
> leur sujet (retrouvables par `git log --diff-filter=D -- .scratch/`).


## Destination

Un document unique qui dit, dans cet ordre : **le but de Pulse en une phrase**,
**ce qui doit être validé en premier** pour ce but, **à quoi ressemble la version
la plus simple qui le valide**, et **dans quel ordre les briques suivantes
s'ajoutent**.

Fin de carte = un plan de refonte prêt à construire. Pas le code.

**✓ ATTEINTE le 2026-09-10** — le document est [`plan-de-refonte.md`](plan-de-refonte.md), écrit par [21](issues/21-le-document-de-refonte.md).

## Notes

### La règle de séquence de cette carte

**On ne décide rien à couper avant l'état des lieux.** Demande explicite de
David du 2026-09-08 : d'abord voir ce qu'on a, ensuite dire où on va. Toute
session qui ouvre une question de périmètre (« garde-t-on les thèmes »,
« garde-t-on l'IA ») avant que le ticket 01 soit résolu travaille à l'envers.

### Ce qui a déclenché cette carte

David, mot pour mot : *« il manque un vrai concept. On a plein d'idées mais elles
doivent s'emboîter, faire sens ensemble, et pas être des produits séparés »* et
*« je ne comprends plus la structure du projet, je n'arrive pas à améliorer ou
voir où sont les problèmes »*. Le besoin est double : une **direction produit**,
et le **contrôle** — savoir sur quoi on travaille, où, et pouvoir le suivre.

Ce n'est pas un défaut d'attention. Les causes matérielles sont mesurées :

- `saas/traitement/build_report.py` fait **4 775 lignes** dans un seul fichier,
  avec **425 mentions** de `label`/`theme` et **6 appels `_call_gemini`**.
- `saas/web/lib/report.ts` fait **973 lignes**, `saas/web/components/` en
  contient **56+**.
- **La carte du savoir a été effacée** : `CLAUDE.md` §6 liste 7 fichiers, **6
  n'existent plus** — `STATUS.md`, `DECISIONS.md`, `STREAMLIT_REMOVAL.md`,
  `docs/03-grammaire-des-modules.md`, `docs/04-modules-partages-entre-sources.md`,
  `docs/references/`. Supprimés au commit `7f188f3` (« nettoyage docs
  obsolètes »). Seuls `BACKLOG.md` et `saas/web/legal/` répondent encore.
  Conséquence directe : le `CLAUDE.md` de `saas/web` invoque une « grammaire des
  modules » que plus personne ne peut lire.

### Le point de tension déjà nommé, à ne pas re-litiger avant 01

La promesse écrite dans `CLAUDE.md` — *« où mettre ses dix minutes cette
semaine, et pourquoi »* — est portée par l'hebdo, les recos et les thèmes.
« Récolter et présenter » sans eux n'est pas un concept mais une catégorie, déjà
occupée gratuitement (Looker Studio). Fait utile pour plus tard : `reco_engine.py`
et `insights.py` sont **déterministes** (`CLAUDE.md` racine) — une réponse hebdo
sans Gemini est donc techniquement possible. Ce n'est pas une décision, c'est un
fait qui attend le ticket 03.

**02 a durci ce point.** Le plancher n'est pas Looker Studio, ce sont les régies
elles-mêmes : Google Ads et Meta livrent déjà gratuitement des recommandations
priorisées. Deux formulations sont donc mortes à l'écrit avant même le ticket
03 — « toutes vos données au même endroit » (ça coûte 39 €/mois de connecteur)
et « des recos pour améliorer vos campagnes » (c'est gratuit chez Google comme
chez Meta). 01 a montré de son côté que le chemin déterministe compte-entier
existe toujours dans le code.

### Domaine

- Produit vu par le client : `saas/web/` (10 routes, `CLAUDE.md` du dossier).
- Fabrication du rapport : `saas/traitement/build_report.py`.
- Recommandations : `saas/recos_ia/` (`reco_engine.py`, `insights.py`
  déterministes ; `labeling.py`, `categorizing.py`, `user_persona.py`,
  `theme_memoire.py` appellent Gemini).
- Récolte : `saas/collecte/`. **David la dit bonne** — hors périmètre.
- Vocabulaire : `CONTEXT.md`. Le mot est **« thème »**, jamais « label ».

### Comment David veut recevoir le travail (posé en 08)

*« Quand je veux améliorer une partie, je reçois des prototypes que j'accepte,
et ensuite ils vont dans l'application avec un check pour voir si l'app
fonctionne. »* Il veut pouvoir comparer des variantes, en demander un mélange
(« un mixe entre version A et C »), **sans avoir toute l'application ouverte**.
L'outil existe déjà et marche : `PrototypeSwitcher`
(`saas/web/components/prototype-switcher.tsx`, 77 l., non commité) — plusieurs
variantes d'un même module sur une vraie page via `?variant=`, navigation aux
flèches, invisible en production. Il tourne aujourd'hui sur `/labels`. Une
session qui propose une refonte de module la propose donc **en variantes
comparables**, pas en description.

### Skills à consulter à chaque session

`vision-produit` (quelle information mérite d'exister), `vision-ux` (hiérarchie
et uniformisation des modules), `ux` (une action de bout en bout), `hebdo`
(structure du rapport), `recos` (pertinence et variété des conseils).

### Règles dures qui s'appliquent ici

`CLAUDE.md` §7 : **aucun chiffre fabriqué**, aucune démo fictive, toute
comparaison exclut le jour en cours. Un plan de refonte qui repose sur une
donnée qu'on ne sait pas mesurer est refusé.

### Hérité de la carte « Thèmes : démontrer le vrai bénéfice », supprimée

David a supprimé `.scratch/themes-benefice/` le 2026-09-08. Le dossier n'avait
jamais été commité : **les fichiers ne sont pas récupérables**. La carte
construisait un workflow de classement qui ne s'imbriquait dans aucun concept
d'ensemble — on traitait `/labels` avant d'avoir nommé le but du produit. C'est
cette carte-ci qui reprend à la racine.

Deux constats y avaient été établis et vérifiés. Ils sont recopiés ici parce
qu'il n'y a plus de source à pointer, et parce qu'ils resserviront au ticket 04.
**Leurs dossiers sourcés sont perdus** : si l'un devient décisif, il faudra le
re-vérifier plutôt que le citer sur parole.

- **La rétroactivité du classement est vraie par construction.** Le thème vit
  sur la configuration de la campagne, jamais sur les lignes de chiffres ; le
  rattachement se fait par jointure à la lecture, aucune date de pose ne filtre
  quoi que ce soit (`label_at` ne sert qu'à l'annulation des étiquettes IA).
  Classer rattache donc d'un coup **90 jours de dépense** et **tout l'historique
  de revenu** — deux fenêtres différentes, piège de formulation. Seule limite :
  baselines, snapshots et verdicts de suivi ne rétroagissent pas. On a le droit
  de promettre la rétroactivité : ce n'est pas un chiffre fabriqué.
- **Aucun produit comparable ne convainc avant le classement.** Tous évacuent le
  problème ; le plus proche (Intercom) publie son plancher et assume l'écran
  vide. Deux mises en garde relevées : une barre de progression peut *réduire*
  la complétion en rendant le coût saillant, et l'aperçu chiffré à la Klaviyo ne
  transpose pas à nos volumes. Le ticket 02 recouvre en partie ce terrain.

## Decisions so far

<!-- l'index : une ligne par ticket clos, le détail vit dans le ticket -->

- [État des lieux : ce que Pulse fait aujourd'hui, module par module](issues/01-etat-des-lieux.md)
  → le document existe : [`etat-des-lieux.md`](etat-des-lieux.md). Un seul cerveau
  (`build_payload`, **3 060 l.**, 64 % de `build_report.py`) ; le web ne calcule
  jamais, il déclenche un workflow GitHub et lit `weekly_reports` ; **un rapport
  sans thèmes tient debout** — le chemin compte-entier déterministe existe
  (`build_recos`, l. 2048) et n'a jamais été retiré, mais `themes_focus`,
  `themes`, `top_recos` et les astuces IA disparaissent ; **sur 10 pages une
  seule est décisionnelle** ; « trois dashboards jumeaux » est faux — deux
  jumeaux déjà factorisés et un cousin de 635 lignes ; deux chiffres de cette
  carte étaient faux (**3** appels Gemini et non 6, **670 lignes / 14 %** de
  couplage aux thèmes et non 425) ; **aucun email n'est envoyé** ; **32
  worktrees, 8,6 Go**, portant l'ancienne arborescence, noient toute recherche.

- [Sur quoi se différencient les produits qui font ce que Pulse veut faire](issues/02-sur-quoi-se-differencient-les-autres.md)
  → dossier : [`research/02-…`](research/02-sur-quoi-se-differencient-les-autres.md),
  70 liens primaires. **Le plancher gratuit est bien plus haut qu'un tableau de
  bord** : Google Ads, Meta (Opportunity Score) et GA4 livrent déjà
  gratuitement des recommandations priorisées, *dans l'interface où on les
  applique en un clic*. **La catégorie « on te dit quoi faire » est prise, mot
  pour mot** — GoodMorning, « The Meta Ads dashboard that tells you what to
  do », « Action items, not analysis », « Act today / This week / Monitor »,
  **199 $/mois** (159 $ annuel), Meta seulement ; Opteo pareil côté Google,
  129→499 $/mois. **Personne ne vend le classement manuel comme un bénéfice** —
  Motion, qui l'avait, a livré l'AI Tagging « no manual labeling required ».
  **Personne ne promet la valeur à la minute 1** : tous publient leur plancher
  d'éligibilité avant l'essai (30 jours d'historique chez Optmyzr, 7 jours et
  « first report Monday » chez GoodMorning). **Le seul axe encore libre sur les
  10 produits lus : l'arbitrage ENTRE canaux dans une seule réponse** — tous
  les concurrents sont mono-régie par naissance, et c'est exactement ce qu'un
  thème transverse permet de dire. Restent aussi libres : le vocabulaire du
  client plutôt que celui de la régie, organique et payant dans le même
  verdict, et le prix entre 49 € et 159 $.

- [Le but de Pulse, en une phrase](issues/03-le-but-de-pulse.md)
  → **la phrase n'est PAS écrite, et c'est David qui a arrêté la ciselure** :
  *« nous n'avons aucun workflow, nous ne savons pas comment les pages
  travaillent ensemble »*. Quatre choses sont tranchées. **Pour qui** : une
  ENTREPRISE, plusieurs paires d'yeux sur un compte (l'artisan et son
  marketeur, deux marketeurs et le patron) — pas une agence ; le code va déjà
  dans ce sens (`dashboard_members`, `owner_id → member_email`). **Le moment** :
  le jour que le client choisit, **déjà construit** (`profiles.fetch_schedule`,
  réglable dans `/comptes`). **Le carnet ET les recos sont tous les deux le
  produit** — David a refusé explicitement de choisir : *« tu as à la fin un peu
  tout ton historique de ce que tu fais pour travailler. Cela permet de garder
  le client. Et on te propose des choses à faire si tu as plus d'idées. »* Le
  carnet est le seul mécanisme de rétention de toute la carte (aucun des 10
  produits de 02 n'en a un) — **mais il n'a pas de page de relecture** : on
  écrit dans `suivi_actions`, aucune page ne le relit. **La structure par
  plateforme** est un gabarit pour brancher TikTok, et son document existe :
  `docs/04-modules-partages-entre-sources.md`, effacé, qui s'ouvre sur la
  question de David mot pour mot. Constat qui a fait graduer la brume : **8 des
  9 étapes du parcours existent déjà** ; `SetupWizard` mène du profil à la
  première étoile puis lâche l'utilisateur — le workflow n'a jamais existé
  au-delà de l'onboarding.

- [Le parcours : comment les pages travaillent ensemble](issues/06-le-parcours-comment-les-pages-se-parlent.md)
  → **ticket mal calibré : il portait cinq décisions.** Ce qu'il a produit, c'est
  la **carte du fil réel** (`app/page.tsx`, bloc par bloc, avec la question à
  laquelle chacun répond) — et elle montre que « comment les pages se parlent »
  se découpe en **quatre chemins** (08 à 11). **Correction à 03 : le carnet SE
  RELIT déjà** — « Ton historique d'actions » n'a pas été perdu, il a été fusionné
  exprès dans la carte du thème (`685a3e9`, 615 l. supprimées) parce qu'il fallait
  traverser 900 px pour relier un conseil à son effet ; le **rail des actions**
  porte le cycle de vie complet avec l'effet chiffré. Ne pas le défaire. Quatre
  trous vérifiés : **`preuve` est calculé et affiché nulle part** (142 l. de
  worker, `ProofOutcome` inutilisé) ; **aucune semaine passée n'est lisible**
  (`weekly_reports` lu `.limit(1)` — l'historique est déjà en base, jamais
  ouvert) ; **le rapport ne renvoie jamais vers `/meta`, `/google`,
  `/instagram`** (ses seuls liens sortants vont vers `/labels`) ; **`SetupWizard`
  est rendu en bas de page**, sous deux écrans de défilement.

- [Ce qui remplace la carte du savoir effacée](issues/05-carte-du-savoir.md)
  → **David a refusé la prémisse du ticket** : *« tout ce qui est avant, on
  oublie ; on veut créer une base saine, une structure claire pour chacune de
  ces thématiques »*. **On n'exhume aucun des six documents supprimés** — ils
  restent dans Git. La structure propre s'écrit **à la sortie de cette carte**,
  thématique par thématique, à partir de ce que 07 à 11 auront décidé : c'est le
  produit qui dicte la doc. Seule la panne active a été réparée — `CLAUDE.md`
  §6 ne cite plus que des fichiers qui existent, les deux paragraphes de
  contournement (`saas/web/`, `saas/collecte/`) sont retirés, et la seule
  connaissance qui ne se périmera jamais est extraite dans
  [`docs/mesures-impossibles.md`](../../docs/mesures-impossibles.md) — **re-vérifiée
  contre le code, pas recopiée** : le doc effacé disait « le ROAS par canal est
  impossible », c'est faux depuis que `ga4_insights` porte `campaign` ; c'est
  une règle d'attribution à choisir, donc une décision, pas une donnée manquante.

- [Le gabarit d'une plateforme : brancher TikTok sans réécrire](issues/07-gabarit-de-plateforme.md)
  → **le gabarit tient en six rangs, valables pour toute plateforme** : 0 les
  commandes (barre **collante**, pas un rang de contenu) · 1 les chiffres de
  tête (**trois, quatre au maximum**) · 2 la courbe · 3 **par thème** · 4 **ce
  qui marche pour toi** · 5 le détail ligne par ligne (l'« Excel »). L'ordre
  n'est pas une intuition : David a demandé qu'on le challenge, et il est celui
  de Shneiderman (*overview first, zoom and filter, details-on-demand*) — **qui
  place le filtrage APRÈS la vue d'ensemble**, d'où le rang 0. **Le rang 3 est
  le pivot** : le seul qui parle la même langue sur les trois pages, donc le
  seul qui empêche `/meta`, `/google` et `/instagram` d'être trois produits
  séparés. **Le rang 4 s'ajoute au payant** (décision de David) mais conclut sur
  le THÈME, jamais sur l'annonce — l'annonce, les régies la commentent déjà
  gratuitement (02). Deux défauts mesurés : **six tuiles** en tête de `/meta` et
  `/google` (les deux dernières ne sont pas lues) et **la barre de filtres n'est
  pas collante** (`sticky` n'existe que dans les en-têtes de tableaux). Un seul
  déplacement pour aligner les trois pages : Instagram met le rang 4 avant le
  rang 3. **Reporté par David** : brancher TikTok et récolter les mots-clés
  Google — *« on attend d'avoir une excellente structure avant d'ajouter »* ; le
  critère d'entrée d'une plateforme est écrit dans le ticket, et un mot-clé
  n'est pas un rang de plus, c'est le rang 5 de Google.

- [La porte vers la plateforme : d'où on part, ce qu'on en ramène](issues/09-la-porte-vers-la-plateforme.md)
  → **la porte part de la carte du thème, et d'elle seule** (David) — un chiffre
  du point général ne désigne aucune plateforme, le lien serait vague. **Rien à
  construire côté données** : `ThemeCampaign` porte déjà `channel` + la clé de
  chaque campagne, et `label` est déjà un paramètre reconnu des pages canal —
  `/meta?label=…` marche aujourd'hui. **Le lien emporte le thème ET la fenêtre du
  rapport**, sinon « 4 520 CHF » devient « 103 CHF » au clic et ça se lit comme
  un bug ; le piège des pastilles inertes est déjà couvert par `exclusifs()`
  dans `lib/liens.ts`. **On ne ramène rien** (écrire depuis une page canal
  appartient à 08) **mais la page dit d'où on vient et propose d'y retourner**.
  **Instagram devient filtrable par thème** — `ByLabelInsta` existe déjà, il
  manque le paramètre ; sans ça le rang 3 de 07 ne tient pas. **David a élargi
  la réponse** : les filtres ne sont pas à recopier par page, il veut **un seul
  module de commandes visible partout** → [12](issues/12-module-de-commandes.md).

- [D'où viennent les conseils, combien, et où ils vivent](issues/11-d-ou-viennent-les-conseils.md)
  → **« qu'est-ce qui marche chez toi » est calculé TROIS fois**, dans deux
  langages, avec trois jeux de seuils : `insights.py` (tout l'historique, zéro
  IA, clés stables — **jamais affiché**), deux règles de `reco_engine.py`
  (`format_gagnant`, `creneau`, fenêtre courte), et la page `/instagram` qui
  recalcule en TypeScript. **C'est la réponse à la question ouverte par 07** :
  le bloc « ce qui marche » et le conseil ne sont pas deux noms du même objet,
  ce sont trois moteurs qui peuvent se contredire. Pire : `/labels` promet au
  client des constats que **rien ne rend à l'écran** — troisième tuyau mort
  après `preuve`. **Décisions : `insights.py` gagne, les deux autres meurent**
  (et ça remplit le rang 4 de 07 sur les trois plateformes sans un calcul
  nouveau) · **cinq conseils par semaine sur tout le compte** — aujourd'hui
  c'est 3 par thème sur un nombre de thèmes **illimité**, donc pas un plafond ·
  **le conseil naît sur la carte du thème**, le renvoi devient une
  **notification qui vit dans l'app, hors du rapport** (→ 12) · **on arrête
  tout conseil portant sur une campagne d'une seule régie** (02 : les régies le
  font gratuitement, dans l'écran du clic) · **les pistes inventées par l'IA
  sont coupées** — le seul endroit que rien ne peut vérifier. Correction au
  ticket : **cinq** sites d'appel Gemini, pas trois ; les quatre autres restent.

- [La mémoire du travail : ce qui s'accumule, où on le relit, ce qu'il nourrit](issues/08-la-memoire-du-travail.md)
  → **trois prémisses du ticket étaient fausses**, et les corriger a changé la
  question. La note est **déjà** sur la frise, deux fois (`_markers` ne filtre
  pas `kind`) ; le worker **relit déjà** les 8 derniers rapports publiés ; et
  `preuve` n'est pas un trou mais **un moteur concurrent, plus vieux et moins
  juste** que le rail — il mesure sur le compte entier là où le rail mesure sur
  le thème. **Décisions : `preuve` meurt**, le bilan compte-entier devient un
  *comptage* de `suivi_actions.verdict` déjà persisté (motif de 11 rejoué) ·
  **la mémoire est le fil continu, pas l'archive rejouée** — on ne rouvre aucune
  semaine passée, deux vérités à l'écran · **une note entre dans la mémoire du
  thème, jamais dans le repondérage** (narratif ≠ mesuré, §7) · **le carnet
  devient un module unique posé partout**, sur le patron de 12, avec auteur et
  campagne en base · **le client ne déclenche plus rien** : les **quatre**
  boutons passent en mode test, parce que cliquer « ↻ Recharger » un samedi
  quand on a choisi jeudi **change tous les écarts sans qu'aucune donnée n'ait
  bougé**. Correction de David qui vaut au-delà du ticket : **les thèmes ne
  découpent pas l'application en deux axes, ils DÉBLOQUENT des modules** — coûts
  par plateforme, puis coûts par thème ; posts individuels, puis moyenne par
  thématique. `CONTEXT.md` gagne **Carnet**, **Retour**, **Jour de travail**, et
  **Note** s'élargit à la campagne.

- [L'entrée : le premier écran, pour celui qui arrive et celui qui revient](issues/10-l-entree-premier-ecran.md)
  → **le fil de démarrage ne demande pas ce qu'il faut pour démarrer** : brancher
  Meta/Google/GA4 n'est pas une étape, seulement une entrée de menu — donc sans
  connexion `couverture.total = 0`, le fil rend **`null`**, et le compte le plus
  neuf ne voit ni fil ni rapport (le ticket croyait qu'il était « deux écrans
  plus bas » ; il n'est pas là). **Décisions : quatre étapes** — profil →
  **connexions** (gate dur, patron de l'ADR 0002) → thèmes → priorités · **un
  seul écran piloté par les données, mais l'ordre s'inverse** — le fil passe en
  tête tant qu'une étape est ouverte · **le fil ne revient jamais** (condition :
  aucun rapport publié ; zéro migration), ce qui arrive après est l'affaire
  d'`AlerteThemes` · **on annonce les DEUX horloges** — la récolte part du
  **1er janvier de l'année**, huit mois à la minute 1 là où 02 a mesuré 30 jours
  d'attente chez les concurrents, mais le rapport attend le worker · **le Jour de
  travail se choisit à la clôture du fil, la récolte part à la connexion** ·
  **le premier écran de celui qui revient** devient verdict → bilan du carnet →
  rail des chantiers → résumé IA replié. 08 tue le **déclencheur** de récolte,
  pas l'**afficheur** : `checkFetchProgress` est déjà de la vérité serveur, et
  une première récolte Instagram de **16 minutes réussit** — elle se dit longue,
  jamais cassée. `CONTEXT.md` gagne **Mise en place**.

- [Le module de commandes : un seul, partout](issues/12-module-de-commandes.md)
  → **un seul bandeau, collant, rendu par le layout, qui se replie au défilement
  en une ligne fine ne montrant que les filtres actifs** (« pas la sensation
  d'avoir une barre qui nous suit »). Il porte **la date et PLUSIEURS thèmes
  partout** — statut et campagne en plus sur `/meta` et `/google` seulement, et
  **un contrôle sans choix ne s'affiche pas** (principe déjà écrit dans
  `rail-filtre.tsx`). Deux thèmes cochés **s'additionnent** ; la comparaison
  côte à côte est **reportée par David** (« un autre module, comme sur GA4,
  pour des experts ») → `BACKLOG.md`. **Un seul vocabulaire d'URL, `d` et `l`**,
  les anciens noms lus mais plus jamais produits : aucun favori ne casse. Caché
  sur `/`, `/comptes`, `/equipe` — sur `/` parce que 08 a fermé la relecture des
  semaines passées et qu'une date sur un instantané figé ne recalcule rien.
  **La pastille de rappel est un objet SÉPARÉ**, dans `SideNav` : deux lignes
  (conseils / actions à juger), **la semaine en cours seulement** — jamais de
  retard qui s'empile —, elle disparaît à zéro (patron d'`alerte-themes.tsx`) et
  mène **aux conseils dans le rapport, ancrés** (« l'hebdomadaire, c'est le
  cockpit »). Elle est **partagée entre les personnes d'un compte** → migration,
  donc ticket [16](issues/16-compteur-partage.md). **Barre de complétion et
  animations refusées** après confrontation à 02 (une barre de progression peut
  *réduire* la complétion) et à §7 (elle félicite d'avoir cliqué) : **on ne fête
  que le mesuré**, à l'arrivée d'un verdict `better`. Cinquième constat de tuyau
  mort : **« ◇ Trop compliqué » (`too_hard`) est collecté depuis toujours et le
  moteur ne le lit jamais** — le signal exact que réclame la reco-plus-simple.

- [Entre deux jours de travail : ce qui bouge quand le client n'a plus la main](issues/13-entre-deux-jours-de-travail.md)
  → **la question avait une prémisse trop large, et David l'a coupée en deux** :
  **ce qui se REGROUPE se recalcule à la lecture, tout de suite, partout ; ce qui
  se RÉCOLTE ou se RÉDIGE attend le Jour de travail.** Une étiquette ne produit
  aucune donnée, elle change par quoi on regroupe des chiffres déjà en base —
  **déjà vrai sur les dashboards** (`lib/channels.ts` l. 653-659, `lblAgg` →
  `byLabel`), **faux sur le rapport** dont les blocs par thème sortent du payload
  figé : `setCampaignLabel` y appelle `revalidatePath("/")` avec le commentaire
  « le rapport regroupe les campagnes par thème » — **l'appel est un no-op
  documenté comme s'il marchait**, et c'est le seul vrai trou du ticket.
  **Ce ticket CORRIGE 08** : « ↻ Recharger mes conseils » ne déplaçait aucun
  écart — la fenêtre est ancrée sur la dernière donnée (`build_report.py`
  l. 1734), pas sur le jour de fabrication ; seul « ↻ Mes données » bougeait
  l'ancre, parce qu'il récolte. La décision de 08 tient, sa raison était trop
  large, et c'est elle qui avait fermé cette porte. **Décisions** : les recos IA,
  les priorités, l'objectif du compte et les catégories de conversions **attendent
  le jour dit**, avec un message qui le date · **rien à annoncer au client qui
  classe** — pas de bandeau « mise à jour en cours », pas de mention d'âge par
  carte (refusée deux fois) · toute la clarté tient dans **trois dates en tête du
  rapport** : mesuré du X au X · publié le X · **mis à jour le X** (`updated_at`
  existe et n'est jamais lu) · **un rapport ne se déclare jamais « périmé »**
  (vieux ≠ faux, §7) · **une source branchée en milieu de semaine récolte tout de
  suite** et entre au rapport le jour dit, sans infrastructure neuve (le cron
  tourne déjà tous les matins) · **aucun bouton de test dans l'app** : GitHub
  Actions, et le prototype porte son propre bouton quand on travaille un sujet.
  Trois défauts mesurés : `/couts` jamais rafraîchi par un classement,
  `setPostLabel` ne rafraîchit pas le rapport, et republier dans une autre
  semaine calendaire crée une **deuxième ligne** (`week_start` dérivé de
  `today`, l. 2164).

- [Ce qui doit être validé en premier pour ce but](issues/04-ce-qui-doit-etre-valide-en-premier.md)
  → **ce n'est pas une fonctionnalité, c'est la CONTINUITÉ : que le fil de la
  semaine tienne de bout en bout, sans cul-de-sac** — jugé par David, sur son
  compte, sur de vraies données. Il a écarté les trois candidates proposées
  (le classement, le conseil pris, le carnet rempli) : ce sont des **morceaux**
  du fil, et si le fil casse, un bon conseil ne sert à rien parce que personne
  n'arrive jusqu'à lui. **Deux profils, un seul fil** : celui qui ne veut *que*
  l'hebdo, et celui qui s'en sert de travail prémâché puis va creuser seul — ce
  second explique pourquoi 07 et 09 ne sont pas du décor. **Le juge est son
  jugement, pas un chiffre** : *« c'est moi qui valide avec mon intuition, backé
  par ton expertise »* — et le fait qui ferme toutes les autres options est que
  **Pulse ne mesure rien de ses utilisateurs** (aucune télémétrie dans le dépôt,
  `last_sign_in_at` jamais lu, aucun email envoyé) ; ajouter un outil de mesure
  d'audience a été écarté, ce serait une brique avant la première. **Trois choses
  figées** : un module par thème vide est **visible et VERROUILLÉ**, avec ce
  qu'il débloque écrit dessus (*« ha voilà, je débloque quelque chose de
  super »*) · la récompense c'est **la liste qui se vide**, à chaque décision,
  « fait » comme « pas pour moi », **à la date que le client choisit** ·
  **une note du client ne reçoit AUCUN verdict** — David a renversé la
  recommandation de la session, et en mieux : juger sa note obligerait Pulse à
  choisir le chiffre à sa place, donc à inventer une intention ; Pulse **marque**
  sur la courbe, le client **juge**. Deux défauts mesurés qui bloquent le fil :
  **on ne peut pas valider à la date où on a agi** (`done_at: isoDate(today)`,
  échéance = ce jour + 14) et `suivi_actions` n'a **aucune colonne de campagne**.
  Piège à ne pas rejouer : les marques sur une courbe **ont existé et David les a
  fait retirer** le 24 août (points noirs parasites sur la série) — les props
  `markers` vivent encore et ne dessinent plus rien.

- [Le conseil toujours faisable, et celui qu'on ignore](issues/14-le-conseil-facile-et-la-degradation.md)
  → **le ticket n'avait rien à inventer : tout existe, et 11 a coupé le
  fournisseur.** La « stratégie en étapes » demandée par David, c'est
  `theme_plan` + `FENETRE_LEVIER` (7/14 j) + `ATTENTE_MIN_NOUVELLE_HYPOTHESE`
  (14-21 j) ; son axe « retoucher vs fabriquer », c'est `role` (`generale` =
  *« constatable DEMAIN, à l'œil »*) ; son axe « geste », c'est `nature`
  (couper/augmenter/tester/créer/corriger, **déjà exigées distinctes**) ; et le
  décompte 2+1 par thème est déjà forcé par le code. Le tout est 100 % Gemini
  depuis le 27 août 2026, et **11 (l. 1470) l'a rendu orphelin**. Trois autres
  prémisses corrigées : `effort` existe (liste fermée, `EFFORT_BY_KEY`, pastille
  ⏱, **5ᵉ clé de `_importance`**) ; `too_hard` n'est pas jeté mais **raccordé au
  mauvais bout** — `_themes_tips(bloques=…)` porte le prompt exact et le seul
  appelant ne passe que deux arguments, pendant que `reco-actions.tsx:39` promet
  par écrit un « Pour aller plus loin » **qui n'existe nulle part** ; et le stock
  est vide — après 11, **une seule règle sur douze est une retouche**, six
  demandent de produire du contenu, et **11 a tué trois des cinq clés « 10 min »**.
  **Décisions : aucun champ neuf** (`effort` × `nature` × `role` suffisent) ·
  **un plafond, pas un plancher** — jamais plus de deux `créer`/`corriger` à
  `effort ≥ 1 h`, parce qu'un plancher qu'on ne peut pas tenir se remplit de
  décor · **la composition des cinq** = 1-2 Marches d'une Stratégie + des
  retouches à faible effort et fort enjeu · **`too_hard` simplifie, le silence
  met en veille** (lire une absence, c'est inventer une intention — §7, et le
  renversement de 04 sur la note) · **le moteur trie, l'IA explique** : `bloques`
  se branche (un argument), le persona garde le ton, jamais le tri · **le
  périmètre est le thème mais on descend à la campagne — correction à 11** ·
  **l'avancement est corroboré**, `platform_changes` porte déjà
  budget/motcle/enchere/statut/audience/creatif par campagne (limites : Google
  30 j, rien pour l'organique) · **deux horloges** — la Marche suivante arrive au
  « fait », le Verdict dit si la Stratégie continue ou change · **l'empreinte =
  clé + cible**, donc le même conseil revient avec un autre chiffre, jamais à
  l'identique (David a renversé la recommandation de la session, qui voulait
  sortir la clé). **Le résultat attendu ne s'affiche jamais** — il pondère le tri
  en interne, comme `_importance` le fait déjà. `CONTEXT.md` gagne **Stratégie**,
  **Marche**, **Mise en veille** ; **Hypothèse** et **Levier** perdent « rédigée
  par l'IA ».

- [Le document de refonte — celui qui ferme la carte](issues/21-le-document-de-refonte.md)
  → **la carte est arrivée : [`plan-de-refonte.md`](plan-de-refonte.md).** La
  phrase est écrite — *« chaque semaine, le jour que tu choisis, Pulse te dit ce
  qui a bougé chez toi, te propose quoi faire sur les thèmes que tu as mis en
  priorité, et te dit la semaine suivante si ça a marché »* — et David l'a
  obtenue en **corrigeant le produit** : *« Non putin. […] Les labels sont les
  recos pour les labels prio. Fin. »* **Pulse n'arbitre pas entre les thèmes**,
  le client désigne ses priorités et Pulse conseille dedans ; d'où un **filtre
  dur** là où `build_report.py` l. 442 ne fait qu'un tri, et `CLAUDE.md` §1
  corrigé (il promettait « où mettre ses dix minutes », ce qui attribuait
  l'arbitrage à Pulse). **La v1 = le fil d'une semaine sur un compte déjà
  branché**, onze éléments, avec 20 et 22 à résoudre avant d'écrire une ligne —
  après 11, *une seule règle sur douze est une retouche*. **Huit briques, chacune
  avec sa condition d'entrée**, sur le principe « rien ne se construit pour un
  client qui n'existe pas encore » ; 18 en brique 0 parce que son délai est
  administratif, et le bouton **« Reconnecter » existe déjà** — le mur des 7 jours
  n'interdit pas de valider. **Le sort des thèmes est fermé** : un compte qui ne
  classe jamais reçoit le point de vue de la semaine et **aucun conseil** — le
  chemin compte-entier existe et n'est pas rebranché exprès (02 : c'est gratuit
  chez les régies). **Le fil est un chemin, pas un rail** — un seul gate dur, la
  connexion. `CONTEXT.md` gagne **Point de vue de la semaine** ; **Priorité
  (étoile)** est redéfinie.

- [À faire cette semaine : le module qui se vide](issues/20-a-faire-cette-semaine.md)
  → **une seule règle : le module liste ce qui attend une décision de TOI, le
  rail montre le temps qui passe** — la seule frontière qui empêche un quatrième
  objet de contredire les trois qui montrent déjà les mêmes actions. **Trois
  prémisses du ticket étaient fausses.** La baseline n'est pas prise au « fait »
  mais à `decided_at` (`build_report.py` l. 3751-3760) : antidater ne fausse
  aucune mesure, ça avance seulement le verdict — d'où une date libre bornée par
  **`decided_at ≤ done_at ≤ aujourd'hui`**, sans plafond en jours. **Un plafond
  de 3 actions ouvertes existait, écrit nulle part** (`page.tsx` l. 199) : à
  cinq conseils, deux d'entre eux n'avaient d'autre sortie que le refus —
  le code forçait le raccourci que le ticket redoutait, **il meurt**, 14 borne
  déjà la charge par la composition. Et `not_for_me` est **déjà scopé par
  thème** (+6, sans masquer). **Décisions : la ligne, pas la carte** (le conseil
  est expliqué sur son thème, expédié dans le module) · **posé après le bilan du
  carnet**, l'ordre de 10 tient · **les conseils ne s'empilent jamais, les
  verdicts s'empilent toujours** — proposition de Pulse contre résultat de ton
  travail, **ce qui corrige le §9 de 12** (rien n'archive un `due` tout seul) ·
  **les verdicts d'abord**, l'ordre du rail · **aucune raison demandée sur un
  refus**, « trop compliqué » est déjà la sortie non pénalisante · **la liste se
  vide sous le doigt**, pas d'écran de félicitations — on ne fête que le mesuré ·
  **le module disparaît quand il est vide ET n'a plus rien à faire découvrir** ·
  **le nudge ne vit que dans le module vide, un seul à la fois, éteint pour
  toujours par le premier usage du geste** — jamais par le temps · **c'est le
  module « à faire » qui dit « désigne un thème prioritaire »**, dans son état
  bloqué : le module verrouillé parle de ce qui manque **en base**, celui-ci de
  ce qui manque **à ta décision** · **la tâche écrite soi-même entre sans
  verdict** (`kind: "note"` naissant en `running`, aucun objet neuf).
  `CONTEXT.md` gagne **À faire** ; **Note** peut naître avant le fait, **Action
  suivie** perd son plafond de trois, **Rappel** perd « jamais de retard ».

- [Rebrancher le plan de thème : la séquence sans l'IA qui l'alimentait](issues/22-rebrancher-le-plan-de-theme.md)
  → **deux prémisses fausses, toutes deux dans le sens de l'allègement** : la
  table des leviers par clé existe (`_LEVIER_REGLE`, l. 290, avec un cinquième
  levier `socle` que `LEVIERS_IA` n'a pas), donc **sur les cinq colonnes à
  donner à une règle — durée · levier · indicateur · geste · preuve — trois sont
  déjà écrites** ; et `PROOF_KPI` duplique `METRIC_INFO_IA` valeur pour valeur,
  donc **le ticket retire dix-sept lignes au lieu d'en ajouter**. **Le stock réel
  est de sept conseils, pas douze** — quatre règles sont des réparations de la
  mesure, une cinquième (`theme_event_cout`) ne demande aucun geste, donc c'est
  un constat. **Le fait le plus lourd : six des sept ne parlent qu'à Instagram,
  donc un compte sans Instagram reçoit UN conseil par semaine** (`roas`), et
  comme les deux seules clés « à mesurer » sont organiques, **une Stratégie ne
  peut naître que sur l'organique** → [24](issues/24-conseils-payants-manquants.md).
  **Décisions : les cinq gouvernent** — le « 2+1 par thème » n'est plus une
  garantie mais une forme de fabrication (neuf candidats pour cinq places), et le
  plafond de 14 est un filtre dedans · **cinq est un plafond, jamais un quota**,
  une semaine à deux conseils est honnête · **une table par clé pour le geste et
  la preuve, mais c'est la règle qui déclare** — `roas` écrit quatre gestes selon
  le chiffre du jour, et découper sa clé effacerait l'historique des retours ·
  **pas de sixième geste « vérifier »**, d'où le critère d'entrée : **un conseil
  sans geste est un constat** · **Gemini écrit l'échelle des Marches** — le point
  que 14 laissait ouvert — mais seulement la Marche SUIVANTE d'une Stratégie
  ouverte par une règle, en listes fermées, sur un objet présent dans les faits ·
  **plus rien n'entre au carnet sans un clic**, l'entrée automatique meurt (un
  verdict sur un geste que personne n'a confirmé attribue un mouvement de
  chiffres à une action qui n'a peut-être jamais eu lieu, §7) — `theme_plan`
  reste écrit à la publication, c'est la mémoire de Pulse, pas le carnet du
  client, et l'échéance du Verdict part du clic · **une Stratégie n'est pas un
  objet en base** : zéro table, zéro migration. `CONTEXT.md` gagne **Geste** ;
  **Action suivie**, **Hypothèse** et **Verdict** sont corrigées par la fin de
  l'entrée automatique.

- [Les conseils payants qui manquent : un compte sans Instagram n'en reçoit qu'un](issues/24-conseils-payants-manquants.md)
  → **David a supprimé le critère d'admission que 02 avait posé.** *« Les
  dashboards montrent des données Meta et Google, mais l'hebdomadaire, ces
  recos, les personnes ne les voient pas seules ; ceux qui ne connaissent pas ne
  les voient jamais, ceux qui connaissent ont le travail prémâché. »* La
  gratuité d'un conseil chez la régie **n'est plus un motif de refus** — la
  valeur est qu'un seul endroit rassemble tout, et que Pulse n'a rien à vendre
  là où l'Opportunity Score pousse à dépenser plus sur Meta ; `gaspillage` et
  `scaler`, coupés par 11 pour ce seul motif, sont réhabilités. **ADR 0003 :
  décision intacte, justification réécrite.** Le gisement que personne n'avait
  vu : **on récolte chaque jour le détail annonce par annonce, Meta et Google,
  et aucune règle ne le lit** (`grep ad_name` ne renvoie rien sur les trois
  moteurs) — à l'échelle d'un thème, l'unité de comparaison n'est plus la
  campagne mais l'**Annonce** et le **Groupe d'annonces**. Trois prémisses
  corrigées, dont **deux chiffres faux à l'écran aujourd'hui** :
  `docs/mesures-impossibles.md` §1 était faux (la date EST dans `ga4_insights`,
  c'est `build_ga4_context` qui l'écrase — le revenu hebdomadaire d'un thème
  devient mesurable, donc un compte payant peut enfin ouvrir une Stratégie), et
  **`_kpis_window` divise un revenu Meta+Google par une dépense Meta seule**
  (l. 3344-3351), donc tout Verdict de ROAS sur un thème bi-régie est gonflé.
  **Décisions : `_compares_channels` meurt entièrement** (*« filtre à la
  poubelle, on verra si ça pose problème »*) · **les conseils vivent dans
  l'hebdo, jamais sur les pages plateforme** · **« couper » survit** mais jamais
  sur une campagne jeune ni sur une part de budget (rien en base ne dit qu'une
  campagne est un test) · **dix règles, quatre livrées d'abord** parce qu'elles
  n'ont aucun seuil inventé, cinq Gestes et cinq Leviers couverts, zéro
  migration · **l'alerte budget de David est un constat**, pas un conseil, et il
  l'accepte · **le trou n'était pas seulement un manque de règles** — le plafond
  de trois par thème fait qu'un compte à un seul thème prioritaire plafonne à
  trois conseils, et c'est assumé. `CONTEXT.md` gagne **Annonce** et **Groupe
  d'annonces** ; **Levier** avait quatre valeurs, il en a cinq (`socle`
  manquait).

- [L'identifiant d'annonce Meta : deux annonces homonymes n'en font qu'une](issues/25-identifiant-annonce-meta.md)
  → **le ticket se croyait sans décision — il en portait cinq**, et c'est écrire
  le code qui les a fait remonter. **La migration `meta_ads_ad_id.sql` était un
  piège armé** : elle annonce un fix dans `upsert_meta_ads` qui **n'a jamais
  existé**, donc la jouer n'aurait pas « laissé le bug en place », elle aurait
  **cassé la récolte Meta** — son `DROP CONSTRAINT` retire la clé que
  `on_conflict=…ad_name` désigne. **Décisions : le rejeu de l'historique passe
  par une date forcée, jamais par un DELETE** — puisque l'upsert efface
  désormais les lignes `ad_id IS NULL` des dates qu'il réécrit, la table n'est
  jamais vide et rien ne se perd si la récolte s'interrompt, là où le geste 3 du
  ticket créait une fenêtre sans donnée · **le drapeau ne touche que Meta**, un
  `--since` global fabriquerait la panne que §8 raconte déjà (Google rejette la
  requête entière au-delà de 30 jours) · **le code se défend et la run finit
  rouge** si la colonne manque — une run verte sans Meta, c'est une semaine de
  dépense que **le rapport lirait comme une baisse**, donc un faux verdict et
  pas un trou visible · **une Annonce est identifiée par `ad_id`, jamais par son
  nom**, sans quoi les trois règles Annonce de
  [24](issues/24-conseils-payants-manquants.md) rejouent le bug dans le moteur
  de conseils (`CONTEXT.md`). Deux gestes sur trois sont faits en code ; **le SQL
  n'est pas joué**. Relevé au passage : le `.env` racine nomme
  `SUPABASE_SERVICE_ROLE_KEY` quand le worker cherche `SUPABASE_SERVICE_KEY`, et
  son projet Supabase n'existe plus — **la production tourne parce que le
  workflow, lui, passe le bon nom**.

- [Ce qui se regroupe, et ce qui est une mesure figée](issues/17-ce-qui-se-regroupe-et-ce-qui-est-mesure.md)
  → **la règle de 13 tenait ; c'est l'inventaire qui était trop timide.** La
  courbe d'un thème avait été rangée en « figé » — David a corrigé : *« la courbe
  se met à jour et les records sur l'ancienne semaine »*. Une courbe n'est qu'une
  suite de sommes, donc un Regroupement, donc **tout l'historique du thème se
  recompose**, semaines passées comprises — pas seulement la semaine du rapport.
  **Décisions : le regroupement descend dans une VUE SQL** (`security_invoker`),
  le seul endroit où Python et TypeScript partagent *une* implémentation au lieu
  d'en entretenir deux qui dérivent — un module TS aurait réimplémenté
  `build_matrix`, soit le défaut à trois moteurs de 11, avec pagination
  obligatoire (PostgREST tronque à 1 000 lignes, §8) · **la vue ne couvre que les
  thèmes** — `formats`, `slots`, `campaigns`, `coverage` n'alimentent que des
  constats écrits, qui attendent le Jour de travail · **le seuil des 100 CHF
  descend dans la vue**, qui expose un `roas` déjà filtré et un drapeau `juge` ;
  `C_SEUILS["theme_spend_min"]` disparaît de Python · **`revenuTheme()` meurt** —
  son « max de deux sources » était un pansement capable d'afficher un revenu que
  la vue ne confirme pas (§7) ; sans réponse de la vue, pas de revenu, et on le
  dit. **Deux limites tiennent** : le `jugement` attend le Jour de travail **en
  entier**, parce que son chiffre et sa phrase sont le même objet et qu'il
  réordonne les conseils (l. 3539-3540) ; et **un Verdict déjà rendu ne se
  recalcule pas** — il jugeait une action sur le périmètre qui existait alors.
  Trois faits établis : **`ga4_insights` porte bien `campaign`** (migration
  l. 419), donc le revenu par thème est regroupable en base ; **`/` ne lit pas
  aujourd'hui ce que la règle exige** (un mois de GA4, 3 000 lignes d'annonces
  sans pagination, sans colonnes de campagne) ; et **le précédent de 13 ne se
  transportait pas gratuitement** — `lblAgg` marche parce que les pages canal
  sont fenêtrées. `CONTEXT.md` gagne **Mesure prise**, le contraire de
  **Regroupement**.

- [Le compteur partagé entre les personnes d'un compte](issues/16-compteur-partage.md)
  → **la prémisse était fausse : le partage existe déjà et il marche.** Le ticket
  n'avait lu que les politiques de la section 9 du bundle ; la **section 15**
  (l. 1590) nomme `suivi_actions` et `reco_feedback` et leur pose
  `partage_select USING a_acces(user_id)` — les anciennes règles « chacun ses
  lignes » restent, **combinées en OU**. Et `user_id` **n'est pas la personne,
  c'est le compte** : `app/actions.ts` fait `const user = { id: compte.uid }`
  **43 fois sans une exception**. Donc **aucune ligne à ré-attribuer** (avant le
  partage, personne ne pouvait écrire ailleurs que chez soi : l'historique est
  juste par construction), **et le compteur de la pastille est déjà partagé**
  (`getInfosNav(uid)`) — la migration annoncée par 12 §11 n'existe pas, les deux
  premières questions du ticket tombent sans un geste. **La règle de fond que
  David a posée en refusant les deux colonnes** : *« on ne duplique pas ; si une
  reco change son statut, c'est pour tout le monde »* → **une note est
  personnelle, elle a un auteur ; un statut est celui de l'entreprise, il n'en a
  pas** — [ADR 0004](../../docs/adr/0004-une-note-a-un-auteur-un-statut-non.md),
  qui porte le prix accepté : on ne saura jamais qui a jugé quoi. **Décisions : UNE colonne `author_id` sur `suivi_actions`**, posée à la
  création, jamais réécrite, **aucun backfill** (inscrire le propriétaire serait
  un chiffre fabriqué, §7) — pas de table neuve, une note reste `kind = 'note'`
  (20 : *« aucun objet neuf »*) · **le verdict n'a pas d'auteur**, donc le
  message de collision dit « déjà marquée faite » **sans nommer personne** ·
  **le premier verdict tient** — défaut mesuré, `resolveAction` (l. 135-156) ne
  regarde pas le statut de départ et ne compte pas les lignes touchées : le
  second écrase le premier et l'écran répond « enregistré », le piège de §8 armé ·
  **une note ne s'efface que par son auteur** (aujourd'hui n'importe quel
  `editor` efface celle de n'importe qui) mais **tout le monde les voit**, déjà
  vrai sans un geste · **les deux rôles restent tels quels — rien à construire** :
  « Peut agir » / « Lecture seule » existent, se changent après coup et sont
  appliqués **à deux étages**, écran *et* RLS ; les « accords d'écriture » de
  plus tard sont plus **fins**, pas absents — les passer tous en lecture seule
  aurait vidé les trois décisions précédentes de leur objet · **le retour d'un
  invité continue de nourrir le persona** (une colonne d'auteur sur
  `reco_feedback` n'aurait servi qu'à jeter le meilleur signal qu'on ait, le
  « ◇ Trop compliqué » que 14 réclame) **mais les conseils sont écrits pour le
  propriétaire, et on l'écrit** — dans le rapport au-dessus des conseils quand on
  regarde le compte d'un autre, et sur `/equipe`. Non vérifiable ici : **aucun
  décompte de lignes**, le `.env` racine pointe un projet Supabase qui ne répond
  plus (même relevé qu'en 25). `CONTEXT.md` gagne **Propriétaire** et **Membre** ;
  **Note** gagne son auteur, **Action suivie** précise que son statut n'en a pas.

- [Le bandeau de commandes, en trois variantes comparables](issues/15-le-bandeau-en-variantes.md) :
  **B, l'en-tête vivant** — le bandeau n'est pas un objet de plus, c'est le
  TITRE de la page qui maigrit au défilement (34 px → 17 px, ~78 px → ~44 px).
  Rien de neuf n'entre jamais à l'écran, seule réponse structurelle à « pas la
  sensation d'une barre qui nous suit ». Le repli **fusionne** les deux lignes
  au lieu d'en faire tomber une : dates, thèmes posés et portes restent
  utilisables en bas de page. Règle de densité acquise et valable partout —
  **une question, un contrôle, et rien qui n'est pas posé ne s'affiche** ;
  présélections et plage sur mesure sous un seul bouton. Un défaut révélé :
  **une page `force-dynamic` n'est vérifiée par aucun contrôle de `CLAUDE.md`
  §9** — ni `tsc` ni `npm run build` ne l'exécutent. La
  construction sort en [27](issues/27-le-bandeau-partout.md).

- [Poser le bandeau de commandes dans l'application](issues/27-le-bandeau-partout.md) :
  **posé sur cinq pages** — période + thèmes + statut + campagne sur `/meta` et
  `/google`, période + thèmes sur `/instagram`, thèmes seuls sur `/labels` et
  `/conversions`. Partent avec lui : `PeriodPills`, `PeriodPillsInsta`,
  `filter-bar.tsx`, les trois `DateRange` de période et le prototype de 15.
  `getInstaDash` apprend à filtrer par plusieurs thèmes — **la fenêtre se
  calcule sur les posts non filtrés**, sinon « 30 j » désigne trente jours
  différents selon le thème. Deux pages laissées dehors avec leur raison :
  `/couts` (sa période est l'année, pas des jours glissants →
  [28](issues/28-la-periode-de-couts.md)) et le prototype orphelin de `/labels`
  (non commité, carte supprimée → [29](issues/29-le-prototype-orphelin-de-labels.md)).

- [La période de la page Coûts : une exception, ou un alignement ?](issues/28-la-periode-de-couts.md) :
  **alignement — `/couts` rejoint le bandeau**, période et thèmes, après
  comparaison de quatre variantes cliquables sur de vraies données. Le fait qui
  a déplacé la question : **la période ne gouverne QU'UNE section sur trois** —
  ni l'enveloppe de l'année ni les cartes par thème ne la lisent, et ce qu'elle
  commande (une répartition, un rythme) est exactement ce que commande la
  période des pages canal. Donc **un seul vocabulaire** — 7/14/30/90/Tout dans
  `d` ; « ce mois » et « cette année » quittent l'écran, `p` reste lu et n'est
  plus jamais écrit (12 §5). **L'ancre s'aligne aussi, et ce n'était pas
  facultatif** : la page finissait sur **aujourd'hui** quand les pages canal
  finissent sur le dernier jour plein — aligner les mots seuls aurait mis deux
  fenêtres sous un libellé unique, contre `CLAUDE.md` §7. **Et la portée
  s'écrit**, puisqu'elle ne se lit plus à la position du filtre : une phrase en
  tête de la section, pas un pied sous chaque module. `CONTEXT.md` est
  **corrigé** — **Bandeau de commandes** affirmait qu'il gouverne « ce que toute
  la page montre », c'est faux depuis `/couts`. Trois prix assumés : « depuis le
  début » et « cette année » coïncident aujourd'hui (la récolte part du
  1er janvier) et divergeront au prochain 1er janvier ; la fenêtre par défaut
  passe de l'année à 7 jours ; les thèmes perdent leur pastille de couleur dans
  le filtre. Partent avec la décision : `components/filtre-couts.tsx`,
  `monthLabel`, `MOIS_FULL`.
- [Le prototype orphelin de /labels](issues/29-le-prototype-orphelin-de-labels.md) :
  **il part.** Les trois variantes du « parcours par thème » posaient une
  question à laquelle la carte avait répondu contre leur prémisse — 12 a refusé
  les barres de complétion (02 mesure qu'une barre peut *réduire* la
  complétion), 08 a corrigé que les thèmes **débloquent des modules** au lieu de
  découper l'app, et le plan pose que **le classement se vend là où le bénéfice
  se voit, jamais sur une page de réglages**, alors que les trois vivaient sur
  `/labels`. `proto-parcours-themes.tsx` et son montage dans `app/labels/page.tsx`
  sont supprimés ; ce qu'ils opposaient survit dans le tableau du ticket, écrit
  **avant** de trancher parce que les fichiers n'avaient aucune copie.
  **`prototype-switcher.tsx` reste** — c'est l'instrument des Notes de cette
  carte, pas le décor, et 28 s'en est resservi le même jour. Vérifié : `tsc` et
  `build` verts, **19 routes**, `git grep proto` ne laisse que des `url.protocol`.

## Not yet specified

**Rien. La carte est fermée** — les seize tickets du chemin sont résolus (01 à
14, puis 20, 21 et 22), la brume est levée et la destination est atteinte :
[`plan-de-refonte.md`](plan-de-refonte.md).

Ce qui s'y ajoute depuis n'est plus du repérage mais de la **construction** :
[15](issues/15-le-bandeau-en-variantes.md) a choisi la forme du bandeau,
[27](issues/27-le-bandeau-partout.md) l'a posé dans l'application, et
[28](issues/28-la-periode-de-couts.md) a réglé le cas qu'il avait laissé dehors
— `/couts` rejoint le bandeau. La dernière décision qu'il
avait fait sortir est tranchée : le prototype orphelin de `/labels` **est
parti** ([29](issues/29-le-prototype-orphelin-de-labels.md)).

Ce qui reste ouvert n'est pas de la brume, ce sont **huit tickets nommés, déjà
rangés** par le §4 du plan, avec leur condition d'entrée :

- **[24](issues/24-conseils-payants-manquants.md) est résolu le 2026-09-11** — il
  ne reste de lui que du travail de construction, listé dans son ticket, et
  **une réparation qui passe avant tout le reste** : `_kpis_window` affiche
  aujourd'hui un ROAS gonflé sur tout thème qui tourne sur les deux régies.
  Il a fait naître [25](issues/25-identifiant-annonce-meta.md), d'abord reporté
  puis **rouvert et résolu le 2026-09-11** — il ne reste de lui que de la
  construction, listée dans son ticket ;
- **en parallèle, tout de suite** — [18](issues/18-passer-en-production.md), dont
  le délai est administratif. **Entamé le 2026-09-11** : le dossier de
  vérification est écrit (`saas/web/legal/GOOGLE_VERIFICATION.md` — les deux
  scopes, leur justification prête à coller, les sous-processeurs), et les pages
  légales sont alignées sur le vrai produit. Elles décrivaient **Stripe et une
  offre Free/Pro qui n'existent nulle part dans le code**, et taisaient **GA4 et
  l'API Gemini** — deux omissions qui faisaient refuser le dossier. Le mur des
  7 jours n'est toujours pas documenté par Google pour l'état « Production non
  vérifiée » (re-vérifié à la source) : **seul le test répond**. Et une découverte
  a semblé bloquer le dépôt → [26](issues/26-gemini-palier-payant.md) : sur le
  palier gratuit de l'API Gemini, Google se réserve de faire lire la donnée par
  des humains, ce que la Limited Use des scopes `adwords` et
  `analytics.readonly` interdit.
  **Corrigé le 2026-09-11 : la prémisse était fausse, et la clause qui le dit
  est dans le même document.** Relus au texte brut — parce que deux lectures
  automatiques du même document se sont contredites sur le point décisif — les
  termes portent une seule occurrence d'« European Economic Area » : *« If
  you're in the European Economic Area, Switzerland, or the United Kingdom, the
  terms under "How Google uses Your Data" in "Paid Services" apply to all
  Services, including […] unpaid quota in the Gemini API, even though they are
  offered free of charge. »* **Pour un exploitant suisse ou européen, le palier
  gratuit porte donc déjà le régime de données du palier payant** — pas
  d'infraction, et le dépôt n'est pas bloqué par elle. L'affirmation est retirée
  des trois endroits qui la portaient. **La décision de payer tient quand même,
  sur quatre raisons neuves** : la clause dépend de l'entreprise, qui n'existe
  pas encore (première case de 18) · la phrase *« Do not submit sensitive,
  confidential, or personal information to the Unpaid Services »* vit dans une
  section que la clause n'importe pas · le quota gratuit ferait **retomber le
  rapport sur son chemin déterministe sans rien dire** · et le prix d'entrée est
  **5 $ prépayés, réversibles**. Même motif que l'ADR 0003 en 24 : décision
  intacte, justification réécrite. Côté code la case est close — **une seule clé
  existe**, le secret GitHub Actions, et **aucune clé neuve ne sera nécessaire**
  (une clé hérite du palier de son projet). Reste un seul regard, dans AI Studio,
  colonne **Billing Tier** ;
  **Deuxième passe le 2026-09-11** : le **dossier Meta** n'existait pas, il est
  écrit (`META_APP_REVIEW.md`) et il porte une décision — **Pulse demande
  `ads_management` alors qu'il n'écrit jamais rien**, aucun `POST` vers
  `graph.facebook.com` dans le dépôt ; la permission de lecture s'appelle
  `ads_read`. Meta dépend de la **même** première marche que Google : la
  vérification d'entreprise est exigée dès l'Advanced Access. Le **script de la
  vidéo** faisait dire à l'écran *« we only ask for the adwords scope »* — faux
  contre `oauth/google/start/route.ts` l. 11-14, et c'est le genre d'écart qui
  coûte un cycle : réécrit. Et le mur que personne n'avait mesuré : **aucune page
  légale n'a d'URL** — ni `/privacy`, ni `/terms`, ni la page de suppression que
  Meta exige —, et `middleware.ts` l. 33-35 renverrait un reviewer sur l'écran de
  connexion. C'est le seul morceau de construction du ticket, et il déplace le
  compte de routes de `CLAUDE.md` §9.
  **Troisième passe le 2026-09-11 : ce morceau est construit.** L'arbitrage est
  tranché en faveur de **A** (pages Next.js) — un `github.io` ne se vérifie qu'en
  propriété « préfixe d'URL », le raccourci se serait payé à l'étape suivante.
  Les trois URL répondent **200 sans session** (`CHEMINS_PUBLICS` dans le
  middleware), le compte de routes passe de 16 à **19**, et les pages **lisent**
  le `.md` au lieu de le recopier : un document juridique tenu en deux
  exemplaires finit par en avoir deux versions. **Une garde empêche désormais de
  publier une fausse déclaration** — un document qui garde un `<PLACEHOLDER>` ou
  un commentaire « À VÉRIFIER AVANT PUBLICATION » n'est pas servi, ce qui rend
  mécanique la consigne de repli de 26 sur le palier Gemini. Aujourd'hui les
  trois URL existent et **ne publient rien** : remplir les placeholders
  d'entreprise est le seul geste qui reste avant qu'elles servent les vrais
  documents. **Quatre affirmations fausses sont sorties du rendu, pas du
  compilateur** : `git grep -n revoke` ne renvoie **rien** dans le dépôt —
  `deconnecter()` supprime notre copie du jeton, il ne le révoque pas, alors que
  la vidéo et la politique §2.2 le promettaient ; les CGU §10.1 promettaient
  encore un bouton « delete your account » qui n'existe pas ; le §10.2 résiliait
  pour non-paiement d'une offre qui n'existe pas ; et les liens croisés des CGU
  pointaient vers des `.md`, donc **404** sur la page publiée — le lien même
  qu'un reviewer suit ;
- **plus tard, chacun à sa condition** — [10](issues/10-l-entree-premier-ecran.md)
  et [17](issues/17-ce-qui-se-regroupe-et-ce-qui-est-mesure.md) (tous deux
  **résolus**, à construire : 10 quand 18 aboutit, 17 dès qu'on ouvre la carte de
  construction — sa vue SQL est le socle du reste),
  [15](issues/15-le-bandeau-en-variantes.md),
  [19](issues/19-module-mes-notes.md) — **prototypé le 2026-09-11, en attente
  du jugement de David** : quatre formes de la marque sur `/meta?variant=A|B|C|D`,
  aucune ne touchant au tracé (la règle vient du retrait du 24 août). L'inventaire
  de réemploi a sorti deux corrections et un fait dur. Les corrections : les
  **abonnés ne manquent pas** au sélecteur, ils ont déjà leur courbe
  (`CourbeAbonnes`), et **Instagram n'a pas de série journalière** — ses posts
  sont des barres, donc les événements SONT déjà les marques. Le fait dur :
  **« filtrer mes notes par campagne », la demande mot pour mot, n'est pas
  calculable** — `suivi_actions` ne porte ni campagne ni plateforme, et une note
  sans thème posée sur la courbe de Meta lui prête un sujet qu'elle n'a jamais
  eu (le module l'écrit, §7). D'où l'argument qui décide la suite : une note
  écrite **depuis la page canal, filtre posé**, hérite de son contexte — la
  colonne de 08 cesse d'être un champ à remplir, c'est l'écran qui la remplit ;
  [23](issues/23-recolte-des-quatre-manques.md).
  **23 a été ouvert puis refermé le 2026-09-11** — David : *« mets-le à faire
  plus tard »*. Il reste en brique 7, mais la recherche est faite et écrite
  dedans : **ses quatre prémisses sont exactes** (premier ticket de la carte dans
  ce cas), **le quota n'est pas le coût** (un `searchStream` vaut **1 opération**
  sur 15 000/jour ; GA4 ~10 jetons sur 200 000), **la limite `change_event`
  30 jours ne concerne aucune des quatre récoltes**, et **son titre est périmé
  depuis 24** : les conseils *faciles* ne manquent plus, c'est le bac **2 h+** qui
  est vide. Deux pièges §7 relevés d'avance — un breakdown Meta fausserait
  `reach`, donc la fréquence sur laquelle 24 a posé `annonce_usee` ; et *page
  path* est l'exemple même que Google donne d'une dimension à forte cardinalité,
  dont l'excédent se replie dans `(other)`.
  **[16](issues/16-compteur-partage.md) est résolu le 2026-09-11** — et il ne
  laisse presque rien à construire : le partage existait déjà. Restent une
  colonne `author_id` sur `suivi_actions` (à jouer **avec** la colonne de
  campagne réclamée par 08 et 04 — une seule migration, deux colonnes), la garde
  de collision de `resolveAction`, et la phrase « ces conseils sont écrits
  pour X ».

**La construction se charte comme une carte neuve** — wayfinder planifie, il ne
bâtit pas. **C'est fait le 2026-09-11 :
[`../construction/map.md`](../construction/map.md)**, quinze tickets, destination
« le fil d'une semaine en service sur le compte de David ». Elle exécute au lieu
de décider — l'exception prévue par wayfinder, déclarée dans ses Notes — et sa
règle de fond est que **chaque ticket pointe le ticket d'ici qui l'a tranché et
ne le re-litige pas**. La doc du produit s'écrit thématique par thématique,
chacune quand sa brique est construite : la table des matières est au §6 du plan,
la décision est dans [05](issues/05-carte-du-savoir.md).

## Out of scope

- **La récolte de données** (`saas/collecte/`) — David la dit bonne. On n'y
  touche pas dans cette carte.
- ~~**La mise en ligne : OAuth Google en Production + pages légales**~~ —
  **CETTE MISE HORS PÉRIMÈTRE ÉTAIT FAUSSE, corrigée par
  [04](issues/04-ce-qui-doit-etre-valide-en-premier.md).** On l'avait qualifiée de
  « check-list d'exécution, pas une décision ». La doc Google mesure le
  contraire : en statut **Testing**, le refresh token expire à **7 jours** pour
  tout scope autre que nom/email/profil — donc `adwords` et `analytics.readonly`
  — et **le worker hebdomadaire casse par construction chaque semaine**. Aucun
  vrai client ne peut utiliser Pulse deux semaines de suite. Ce n'est pas une
  formalité de lancement, c'est **la porte d'entrée de toute validation** : c'est
  devenu le ticket [18](issues/18-passer-en-production.md), de type tâche.
- **L'archéologie des documents supprimés au commit `7f188f3`** — décidé par
  David en [05](issues/05-carte-du-savoir.md) : ils décrivent une app que la
  refonte est en train de changer, les exhumer coûterait deux fois. Ils restent
  lisibles par `git show 7f188f3^:<chemin>` si l'un devient décisif.
- **Le code de la refonte** — cette carte produit un plan. Wayfinder planifie ;
  la construction se charte après.
