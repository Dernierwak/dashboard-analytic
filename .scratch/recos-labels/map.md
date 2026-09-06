# Recos par thème — cross-canal (Graphe B)

## Destination

Spécifier complètement les modules manquants du Graphe B (hypothèse générique
par thème, suivi d'hypothèse, analyse assemblée) pour que chaque thème —
qu'il regroupe une campagne Meta, une campagne Google et un post Instagram,
ou une seule de ces sources — produise des recos qui tiennent compte de sa
progression réelle vers son objectif propre (vente, lead, followers, vues).
Fin de carte = un plan prêt à construire, pas le code lui-même.

## Notes

- Domaine : `saas/traitement/build_report.py` (`_theme_ai_recos()`,
  `_orga_recos()`, `_kpis_du_theme()`, `_poids_theme`) + `saas/recos_ia/insights.py`
  (`build_matrix()` — agrège déjà Meta+Google+Instagram par thème).
- Référence de départ : même artifact que la carte sœur — **"La fabrique des
  recos"** (David, 26 août 2026) —
  https://claude.ai/code/artifact/5e384b78-c34c-440b-baa4-ccc561804c2e —
  section Graphe B.
- Carte sœur : **Recos générales (Graphe A, compte)** —
  `.scratch/recos-generales/map.md`. Correction post-ticket 01 : l'objectif
  par thème **n'attend pas** le ticket "profil client vivant" de la carte
  sœur — `_obj_theme()` (existant depuis le 27 août) est un champ propre au
  thème, indépendant du profil compte. Le ticket "analyse assemblée" peut
  avancer sans dépendre de la résolution du ticket 05 de la carte sœur.
- "Thème" et "label" sont le même concept dans le code — ne pas chercher deux
  systèmes différents.
- La règle de composition finale ("2 recos issues du suivi + 1 nouvelle idée
  générique si pertinente, jamais plus d'une idée neuve, arbitrées par les
  retours client") est déjà **décidée** dans l'artifact — ne pas la
  re-trancher, seulement vérifier qu'elle reste cohérente une fois 2A/2B/3
  spécifiés.

## Decisions so far

- [Vérifier l'état réel du Graphe B](issues/01-verifier-etat-graphe-b.md) :
  1 (`build_matrix`) et 3 (`_kpis_du_theme`), 4 (`reco_feedback.theme`) et 5
  (`_theme_ai_recos`/`_compares_channels`) sont toujours vrais tels que
  décrits ; mais 2A/2B ("hypothèse générique" + "suivi") ont changé
  substantiellement le 27 août 2026 — un mécanisme complet existe déjà
  (`_theme_ai_recos` rédige 1 piste `role="hypothese"` par thème, taguée par
  `levier`, auto-suivie dans `suivi_actions` via un statut `"auto"` avec
  échéance fixe à 14 jours et verdict ±5 %) — les tickets 02/03 devraient
  être relus à la lumière de ce qui existe déjà plutôt que rediscutés dans
  l'abstrait.

- [Hypothèse générique](issues/02-hypothese-generique.md) : le mécanisme
  actuel (IA libre, un levier obligatoire, une seule hypothèse par thème)
  est bon, rien à changer. Le vrai manque : aucun historique
  (levier/verdict/retour client) ne nourrit la génération — corrigé pas par
  une règle codée, mais par un "plan par thème" condensé à concevoir (ticket
  05, nouveau).

- [Suivi d'hypothèse](issues/03-suivi-hypothese.md) : bug de fond trouvé — le
  système lance une nouvelle hypothèse chaque semaine sans attendre le
  verdict de la précédente (plusieurs peuvent coexister par thème, non
  suivi). Corrigé par décision : fenêtres différenciées par levier (7j
  contenu/tempo, 14j argent/audience), `suivi_actions` reste partagé, seuil
  ±5 % partout, et blocage explicite — pas de nouvelle hypothèse avant 1-2
  cycles de vérification (~14-21 jours) pour confirmer l'échec avant d'en
  tester une autre.

- [Analyse assemblée](issues/04-analyse-assemblee.md) : pas de cible
  chiffrée d'objectif (vérifié, n'existe nulle part) — le jugement affiche à
  la place un vrai % mesuré de variation sur l'événement GA4 correspondant
  au type d'objectif (ventes/notoriete/engagement). Bascule "améliorer tout"
  vs "cibler le plus impactant" pilotée par l'avancement vers l'objectif ;
  le jugement influence la composition finale (favorise le levier le plus
  impactant) ; confirmé sans chevauchement avec `_importance()` — le tri du
  compte choisit les thèmes (3 favoris à égalité), ce jugement opère dans
  chaque thème déjà choisi.

- [Plan par thème](issues/05-plan-par-theme.md) : mécanisme séparé du profil
  client vivant (carte sœur). Nouvelle table Supabase (user_id, theme) avec
  deux couches : état déterministe (hypothèse active, levier, date, cycles,
  dernier verdict) + résumé narratif rédigé par IA, généré seulement quand
  un nouveau verdict tombe (pas chaque rapport), reformulant des chiffres
  déjà calculés sans jamais en inventer.

**Tous les tickets (01 à 05) de cette carte sont résolus — la destination
est atteinte.** Reste en fog (voir ci-dessous) un seul détail de
construction, à préciser au moment de coder.

**Implémentation (6 septembre 2026)** : tickets 03, 04 et l'état (couche
déterministe) du ticket 05 codés et vérifiés (`py_compile` + `tsc --noEmit` +
`npm run build`, 16 routes) :
- Ticket 03 : nouvelle table `theme_plan`, fenêtres différenciées par levier
  (`FENETRE_LEVIER`), blocage effectif d'une nouvelle hypothèse avant sa
  fenêtre d'attente (`ATTENTE_MIN_NOUVELLE_HYPOTHESE`), réaffichage fidèle de
  la carte suivie via `snapshot`.
- Ticket 04 : `_jugement_theme()` — vrai % mesuré (ROAS pour ventes,
  engagement pour engagement, **portée pour notoriété** — décision de David,
  pas d'équivalent GA4 honnête), bascule "cible" sur dégradation ≥10% (même
  seuil que `verdict_tone`), réordonnancement des pistes du thème vers le
  levier le plus impactant en mode "cible". Affiché dans
  `theme-objectif-mini.tsx`.

**Pas encore codé** : le résumé narratif rédigé par IA du ticket 05 (la
couche "mémoire lisible" qui nourrirait le prompt de `_theme_ai_recos` —
l'état déterministe suffit au blocage du ticket 03, ce résumé reste un
raffinement futur, pas bloquant).

## Not yet specified

- Quel événement GA4 précis représente les objectifs `notoriete` et
  `engagement` (le catalogue actuel documente Ventes/Contacts/Engagement,
  pas explicitement "notoriété") — détail de construction à préciser au
  moment de coder le ticket "analyse assemblée", pas encore assez net pour
  un ticket séparé.

## Out of scope

- **Graphe C ("Aller plus loin" / `apprentissage.tsx`)** — **correction
  (6 sept.)** : n'est PAS "déjà construit" — retiré le 31 août (`d9c7504`).
  Reste hors scope, effort séparé prévu plus tard (voir carte sœur).
