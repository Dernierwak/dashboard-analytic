Type: research
Status: resolved

## Question

Confronter les statuts ● (existe) / ◐ (existe partiellement) / ○ (à
concevoir) du Graphe B dans l'artifact "La fabrique des recos" (26 août
2026 — lien dans `map.md`) au code réel à la date d'aujourd'hui.

Points à vérifier précisément :
- Le collecteur filtré par thème (Meta+Google+Instagram, sans GA4) —
  `build_matrix()` dans `saas/recos_ia/insights.py` fait-il toujours
  exactement ça ?
- "Hypothèse générique" (2A) et "Suivi d'hypothèse" (2B) — toujours à l'état
  ○ (rien n'existe), ou un début de table/logique a été introduit ?
- "Analyse" (3) — `_kpis_du_theme()` lit-il toujours le GA4 filtré thème
  séparément de l'objectif du compte, sans les assembler en jugement
  explicite ? Toujours vrai que l'analyse doit arriver après 2A/2B, pas
  avant ?
- `reco_feedback` — la colonne `theme` a-t-elle été ajoutée (prérequis pour
  que "Fait" distingue un gaspillage par thème) ?
- `_theme_ai_recos()` et `_compares_channels()` dans `build_report.py` —
  toujours le comportement décrit (pistes Gemini en confiance `piste`,
  élimination des comparaisons Meta vs Google) ?

Rendre un rapport point par point : "toujours vrai" / "a changé, voici
comment" / "je n'ai pas pu vérifier", avec références fichier:ligne.

## Answer

Vérifié le 4 septembre 2026, code réel du dépôt (pas l'artifact — je n'ai pas
rouvert le lien claude.ai, seulement confronté ce que la question du ticket
en rapporte).

**1. `build_matrix()` — collecteur filtré par thème, Meta+Google+Instagram,
sans GA4 — TOUJOURS VRAI.**
`saas/recos_ia/insights.py:46-299`. Les deux LISTES d'entités qui composent
la matrice (`campaigns`, `posts_by_label`) viennent exclusivement de Meta
(`insights.py:74-93`), Google (`:96-115`) et Instagram (`:151-198`). GA4
n'ajoute JAMAIS sa propre entité — il vient seulement enrichir le revenu
d'une campagne déjà listée, par correspondance de nom normalisé
(`rev_by_name`/`events_by_name`, `:117-136`, appliqué aux thèmes
`:217-226,239-264`). C'est exactement la lecture "Meta+Google+Instagram, sans
GA4" de la question — GA4 est une couche de valeur, jamais une source
d'objets.

**2. "Hypothèse générique" (2A) et "Suivi d'hypothèse" (2B) — A CHANGÉ, ET
SUBSTANTIELLEMENT — plus à l'état ○.**
Un mécanisme complet a été branché le **27 août 2026** (un jour après la date
de l'artifact du 26 août), donc probablement pas encore vu par le graphe :
- **2A (hypothèse générique)** est tranchée en faveur de l'IA libre, pas
  d'une bibliothèque de gabarits (ce que le ticket 02 posait encore comme
  question ouverte) : `_theme_ai_recos()` (`saas/traitement/build_report.py:1277-1479`)
  fait rédiger par Gemini exactement 1 piste sur 3 avec `role="hypothese"`
  (les 2 autres `"generale"`), et la garantie "exactement 1" est forcée par
  le code, jamais par le prompt (`_forcer_une_hypothese`, `:165-184`,
  ré-appliquée après le filtre anti-Meta/Google `:2715-2718`). Elle porte
  aussi un `levier` obligatoire dans `LEVIERS_IA = ("argent", "contenu",
  "tempo", "audience")` (`:108`) — la "catégorie légère" que le ticket 02
  imaginait existe déjà, sous ce nom.
- **2B (suivi)** N'EST PAS une nouvelle table — c'est `suivi_actions`,
  existante, réutilisée avec un statut dédié `"auto"` : dès qu'un thème a une
  hypothèse rédigée, elle est upsertée automatiquement dans `suivi_actions`
  avec une baseline capturée immédiatement, une échéance `check_at` FIXE à
  **14 jours** (`_hyp_check = today + timedelta(days=14)`,
  `build_report.py:3341-3390`) — pas les "2-3 semaines ajustables" que le
  ticket 03 posait en question ouverte. Le verdict (`better`/`worse`/`stable`)
  se calcule au seuil **±5 %** de variation sur la métrique déclarée par
  l'IA (`:3462-3468`), exactement le même seuil que le Graphe A
  (`_attach_metric`). Ceci répond concrètement aux questions ouvertes des
  tickets 02 et 03 : le code a tranché entre-temps, sans attendre leur
  résolution formelle — à vérifier avec David s'il veut aligner 02/03 sur ce
  qui existe déjà plutôt que continuer à les discuter dans l'abstrait.
  Point d'attention : ce suivi ne couvre QUE l'hypothèse que Gemini a
  choisie, jamais plus d'une par thème à la fois — la question du ticket 02
  ("plusieurs hypothèses en parallèle ?") est donc déjà tranchée par le
  code, côté "une seule".

**3. `_kpis_du_theme()` — GA4 filtré thème séparé de l'objectif du compte,
analyse jamais assemblée en jugement explicite — TOUJOURS VRAI, avec une
nuance neuve à signaler.**
`_kpis_du_theme()` (`build_report.py:3227-3232`, qui appelle `_kpis_window`
`:3133-3171`) ne renvoie que des métriques brutes (cpc/roas/posts/reach/eng/
purchases) filtrées par thème — le revenu GA4 n'est retenu QUE s'il est
rattachable à une campagne du thème par nom (`:3158-3164`, sinon `None`,
jamais un zéro inventé). Cette fonction ne sert QUE de baseline pour le
verdict ±5 % (`_attach_metric`, `:3234-3252`) — elle ne compare jamais ce
chiffre à l'objectif du thème pour produire une phrase de jugement. La
nuance : depuis le 27 août 2026 un objectif PROPRE par thème existe belle et
bien (`_obj_theme()`, `:1853-1865`, alimenté par `fetch_theme_objectifs`) et
s'affiche désormais dans un module dédié, `theme-objectif-mini.tsx`
(`saas/web/components/theme-objectif-mini.tsx`) — mais ce module est
STRICTEMENT DESCRIPTIF ("Objectif : Plus de ventes (objectif propre) ·
Conversions : achat"), sans aucun calcul de progression ni de verdict. Donc
le "profil client vivant" de la carte sœur EST résolu (l'objectif par thème
existe et alimente déjà `_theme_ai_recos`), mais l'assemblage
GA4-filtré-thème + objectif en un jugement explicite ("tu es à X % de ton
objectif") reste absent — 3) doit toujours arriver après 2A/2B, rien ne
contredit ça.

**4. `reco_feedback.theme` — A ÉTÉ AJOUTÉE.**
`supabase/migrations/000_run_me_all.sql:1899-1910` (section 22) : colonne
`theme text NOT NULL DEFAULT ''`, mise DANS la clé d'unicité
(`reco_feedback_uq2 UNIQUE (user_id, reco_key, week_start, theme)`,
`:1905-1906`) précisément pour que deux refus "pas pour moi" sur la même
clé-règle générique mais deux thèmes différents ne s'écrasent plus. Le
prérequis que la question posait est donc rempli — "Fait" peut distinguer un
gaspillage par thème.

**5. `_theme_ai_recos()` et `_compares_channels()` — TOUJOURS VRAI sur les
deux points cités, avec le détail exact.**
- Confiance `"piste"` : toute piste rédigée par Gemini reçoit
  `"confidence": "piste"` en dur, sans exception
  (`build_report.py:1465`) — jamais "solide" ni "creuser", quel que soit son
  `role`.
- Élimination Meta vs Google : `_compares_channels()` (`:1240-1250`) reste
  définie exactement comme décrit (les deux mots présents + un mot de
  comparaison/opposition) et reste appelée à DEUX endroits contre les pistes
  IA — une fois juste après réception de Gemini (`:2709`), une seconde fois
  après fusion avec le filet règles/veilles/événements, juste avant le
  tri final à 3 (`:2807`) — donc le filtre est bien "à la génération, pas
  qu'à l'affichage" comme le commentaire du code le dit lui-même (`:2705-2707`).

**Ce que je n'ai pas vérifié** : je n'ai pas rouvert l'artifact "La fabrique
des recos" du 26 août 2026 lui-même (pas d'accès web dans cette recherche) —
ma comparaison s'appuie sur la formulation des puces du ticket, pas sur une
relecture directe des statuts ●/◐/○ d'origine. Si la formulation du ticket
avait déjà déformé l'artifact, cette réponse hérite du même biais sur ce
point précis.
