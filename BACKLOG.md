# Backlog — Pulse

Idées et pistes notées en chemin, à reprendre. On y ajoute, on n'y efface pas
sans raison. Une fois lancée, une piste devient une issue GitHub (voir
`docs/agents/issue-tracker.md`) ou un ticket sur une carte `wayfinder` — elle
reste ici en trace de pourquoi elle existe.

## Le retrait des recommandations (2026-09-21)

David : « Je n'arrive plus à suivre cette application, je veux que tout le code
en lien avec les recommandations IA soit supprimé. Les modules de l'application
aussi, ainsi que les issues. »

**Ce qui est parti** : `saas/recos_ia/` en entier (moteur déterministe, six
règles payantes, constats, composition, labellisation IA, catégorisation IA,
persona, mémoire de thème), le suivi des actions, le Carnet, le module « À
faire », le brief rédigé par Gemini, le savoir-faire de fond, et les trois
tables `reco_feedback` / `suivi_actions` / `theme_plan`.

**Ce qui reste** : ce qui se mesure. Le verdict, la boussole, l'anneau, la
frise, les cartes de thème, les faits de plateforme, et les dashboards par
canal — intacts, ils n'ont jamais lu le rapport.

**Les questions que ça rouvre, si un jour on y revient** — notées ici et
nulle part ailleurs, puisque les tickets correspondants sont partis :

- **Un tableau de bord qui ne conseille rien est-il un produit ?** C'est la
  question que le retrait pose et ne tranche pas. Pulse promettait « quoi faire
  cette semaine » ; il promet maintenant « ce qui a bougé ». Les deux sont des
  produits, ce ne sont pas les mêmes.
- **Le thème se pose entièrement à la main.** La labellisation IA classait les
  nouvelles campagnes et publications en tâche de fond. Sans elle, un compte
  actif accumule du contenu non étiqueté, et tout ce qui se regroupe par thème
  se vide à mesure. C'est le premier endroit où le retrait se paiera.
- **Les 21 tickets et 3 cartes supprimés** contenaient des mesures et des
  décisions qui n'existent nulle part ailleurs — notamment les seuils des
  règles payantes et la grammaire d'un conseil. Ils sont dans l'historique git
  du dépôt (`git log --diff-filter=D -- .scratch/`), pas dans l'arbre.
- **`insight_feedback` survit** parce qu'elle porte les thèmes prioritaires
  (clé `priority_label:<nom>`) en plus des verdicts de constats. Les lignes de
  verdict y dorment, mortes ; le nettoyage optionnel est en bas de
  `supabase/migrations/999_supprimer_les_recommandations.sql`.
- **`saas/commun/` garde des fonctions que plus personne n'appelle**, héritées
  de l'ancien Streamlit et antérieures à ce retrait. Pas touchées : c'est un
  ménage à part.

## Écarté de la carte wayfinder « Refonte : reprendre les bases de Pulse » (2026-09-08)

- **Mise en ligne : OAuth Google en Production** — bloquant réel au lancement.
  Tant que `saas/web/legal/` (Privacy Policy, CGU, vidéo de démo) n'est pas
  publié sur une URL HTTPS, Google garde l'app en mode Testing, limitée à
  quelques comptes. Écarté de la carte parce que c'est une **check-list
  d'exécution, pas une décision** : il n'y a rien à trancher, seulement à faire.
  Voir `saas/web/legal/README.md`. Les pages `app/privacy` et `app/terms`
  n'existent pas encore — les sources sont des `.md` avec des `<PLACEHOLDERS>`.

- **La carte du savoir de `CLAUDE.md` §6 est morte** — 6 des 7 fichiers listés
  n'existent plus, supprimés au commit `7f188f3` (« nettoyage docs obsolètes ») :
  `STATUS.md`, `DECISIONS.md`, `STREAMLIT_REMOVAL.md`,
  `docs/03-grammaire-des-modules.md`, `docs/04-modules-partages-entre-sources.md`,
  `docs/references/`. Effet de bord non vu au moment de la suppression : le
  `CLAUDE.md` de `saas/web/` invoque toujours « la grammaire des modules, neuf
  rangs » que plus personne ne peut lire. Le ticket 01 de la carte refonte
  inventorie ce que chacun portait ; ce qu'on reconstruit se décide dans le
  ticket 05 de cette même carte, `.scratch/refonte/issues/05-carte-du-savoir.md`.

## Trouvé pendant l'état des lieux (ticket 01 de la carte refonte, 2026-09-08)

Rien de tout ça n'était demandé. Aucun de ces points n'est une décision, donc
aucun ne devient un ticket de la carte — mais aucun ne doit se perdre. Détail
et commandes de reproduction : `.scratch/refonte/etat-des-lieux.md`.

- **32 worktrees, 8,6 Go dans `.claude/worktrees/`** — plusieurs portent
  l'**ancienne** arborescence (`saas/worker/`, `saas/core/`, `scripts/`), des
  chemins qui n'existent plus sur `main`. Effet mesuré : une recherche
  récursive de `build_report` renvoie une vingtaine de résultats venant tous de
  worktrees périmés avant d'atteindre le vrai code. C'est une cause matérielle
  de « je n'arrive plus à voir où sont les problèmes ». Un est marqué
  `prunable`. **Rien n'a été supprimé** — un worktree peut porter du travail
  non fusionné, ça se regarde avant. `git worktree list`, `du -sh
  .claude/worktrees`.

- **Deux prototypes non suivis par git, importés par un fichier suivi et
  modifié** — `components/proto-parcours-themes.tsx` (491 l.) et
  `components/prototype-switcher.tsx` sont en `??`, mais
  `saas/web/app/labels/page.tsx` (en `M`) les importe l. 59-60. Ils sont bien
  gardés derrière un paramètre d'URL et invisibles sans lui, et `npx tsc
  --noEmit` passe **parce que les fichiers sont là** : committer
  `app/labels/page.tsx` sans eux casserait le build. Même piège que la règle
  `CLAUDE.md` §7 sur les pages de contrôle, sur un autre chemin.

- **`components/comparaison.tsx` (479 l.) n'est monté nulle part** — il exporte
  `Comparer`, qu'aucun fichier n'importe. Des commentaires de `ecart.tsx`,
  `channel-dash.tsx` et `channels.ts` continuent de parler du « module
  Comparer » comme s'il existait. Listé, pas supprimé.

- **Aucun email hebdomadaire n'est envoyé** — `saas/emailing/` (`render.py`,
  `send.py`) n'est atteint que par `collecte/automatisation/run_weekly.py`, que
  personne n'appelle ; `saas/collecte/CLAUDE.md` l. 73 le dit déjà (« pas
  encore câblé au cron »). `fetch_all.py` ne contient aucune référence à
  `emailing`. À savoir avant toute discussion sur « le rapport hebdo arrive par
  mail ».

- **Deux chiffres invoqués dans `.scratch/refonte/map.md` ne se reproduisaient
  pas** — « 6 appels `_call_gemini` » (il y en a **3** : l. 1470, 1612, 3178 ;
  le 6 comptait la définition et deux commentaires) et « 425 mentions de
  label/theme » (la mesure honnête est **670 lignes sur 4 775, 14 %**, pour 809
  occurrences). Corrigés dans la carte. Rappel de `CLAUDE.md` §7 : un seuil
  invoqué de mémoire se vérifie avant d'être invoqué.

- **`saas/web/app/actions.ts` (1 840 l., 39 actions serveur) est le plus gros
  fichier du web** — plus gros que `channels.ts` (1 637) et `report.ts` (973).
  Il n'apparaissait dans aucune note du projet. `channels.ts` porte en plus des
  lectures qui n'ont rien à voir avec un canal (`getLabelsData`,
  `getThemeEvenements`, `getThemeObjectifs`, `getConversionCategories`).

## Thèmes (issu du grill du 2026-09-07, écarté de la carte wayfinder « Thèmes : démontrer le vrai bénéfice »)

- **Export par thème** — écarté du chantier "vrai bénéfice des thèmes" pour
  ne pas en diluer le périmètre (UX + workflow, pas de nouvelle fonctionnalité).
  Rien n'existe aujourd'hui côté produit. À cadrer avant de construire : qui
  l'utilise (client ou agence), quel format (CSV/PDF), quel contenu (liste
  brute des campagnes/posts du thème, ou aussi les chiffres agrégés — dépense,
  ROAS, conversions).
- **Conversions par thème : élargir au-delà de l'événement GA4 principal** —
  `insights.py::build_matrix` ne calcule le revenu que pour l'événement de
  conversion principal choisi sur `/conversions`. L'élargir à plusieurs
  événements par thème touche le backend, donc écarté du même chantier.

## Reporté par David le 2026-09-08 (ticket `.scratch/refonte/issues/07`)

- **Récolter les mots-clés Google Ads.** Aucune table ne les porte aujourd'hui
  (rien dans `supabase/migrations/`), alors qu'ils sont la vraie nuance Google ↔
  Meta. Ce n'est pas un affichage à faire, c'est une récolte à ajouter. Le
  gabarit de plateforme n'a pas besoin de changer pour les accueillir : un
  mot-clé est le **rang 5** de Google (son détail ligne par ligne), au même titre
  que l'adset chez Meta.
- **Brancher TikTok.** *« On sait qu'on va ajouter, mais on va attendre d'avoir
  une excellente structure avant d'ajouter. »* Le critère d'entrée d'une
  plateforme est écrit dans le ticket 07.

## Reporté par David le 2026-09-09 (ticket `.scratch/refonte/issues/12`)

- **Comparer deux thèmes côte à côte.** Le bandeau de commandes accepte
  plusieurs thèmes, et deux thèmes cochés **s'additionnent** (décision du ticket
  12). David voulait aussi pouvoir les opposer — deux courbes, deux colonnes —
  et l'a reporté lui-même : *« séparer serait super […] mais cela devrait être
  un autre module, comme sur GA4. Cela devrait être à faire plus tard, car nous
  avons déjà beaucoup de choses, et cela est pour des experts. »* Ce n'est donc
  **pas** une option du filtre — un filtre qui compare et un bloc qui compare
  seraient deux endroits pour une même lecture, exactement le défaut mesuré au
  ticket 11 sur « ce qui marche ». C'est un module à part, à poser à côté du
  rang 3 du gabarit (ticket 07), plafonné à deux thèmes si l'UX ne suit pas
  au-delà.

## Reporté par David le 2026-09-10 (ticket `.scratch/refonte/issues/13`)

- **Récolter tous les jours, voire toutes les heures — une offre payante.** Idée
  de David : *« on pourrait faire des fetch tous les jours ou toutes les heures,
  mais c'est une idée à développer que nous n'allons pas développer dans
  refonte. »* Ce que l'outil sait déjà faire : le cron tourne **tous les matins**
  (`weekly-fetch.yml`, `cron: "0 7 * * *"`) et `_due_today` écarte simplement les
  comptes dont ce n'est pas le jour — donc une cadence quotidienne est un
  changement de réglage, pas d'infrastructure. Deux conséquences à trancher le
  jour où on le fera : ça **abîme la promesse « je travaille une fois par
  semaine »** (David l'a noté lui-même), et **le rapport cesse d'être un point
  fixe** — c'est le prix de l'option, il faudra le dire au client qui la prend.
  Place tarifaire mesurée au ticket 02 : entre 49 € et 159 $.

## Relevé en chemin le 2026-09-11 (ticket `.scratch/refonte/issues/16`)

- **`user` ne nomme pas une personne, il nomme un compte — 43 fois.**
  `app/actions.ts` écrit partout `const user = { id: compte.uid };` puis
  `user_id: user.id`. La valeur est le **compte regardé**, jamais la personne
  connectée. C'est ce qui fait marcher tout le partage, et c'est écrit avec le
  mot qui dit le contraire. Le piège est armé pour la prochaine édition : écrire
  `auth.getUser()` là où on croit lire « l'utilisateur » **casserait le partage
  en silence** — la ligne partirait sous l'identité de l'invité, invisible au
  propriétaire, et aucune erreur ne serait levée. Renommer (`compteId`, ou passer
  `compte.uid` directement) est mécanique et sans risque ; à faire quand on ouvre
  `actions.ts` pour la colonne `author_id`, pas avant. Le vocabulaire juste est
  déjà dans `CONTEXT.md` : **Compte** ≠ **Propriétaire** ≠ **Membre**.
