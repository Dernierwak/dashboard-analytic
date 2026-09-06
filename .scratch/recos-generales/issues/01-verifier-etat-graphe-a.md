Type: research
Status: resolved

## Question

Confronter les statuts ● (existe) / ◐ (existe partiellement) / ○ (à
concevoir) du Graphe A dans l'artifact "La fabrique des recos" (David,
26 août 2026 — voir lien dans `map.md`) au code réel de `saas/recos_ia/` et
`saas/traitement/` à la date d'aujourd'hui.

Points à vérifier précisément :
- Le classificateur (juge la pertinence d'une piste, cherche une
  correspondance dans `reco_engine`) — toujours à l'état ○, ou quelque chose
  a été commencé ?
- `reco_engine.py` — toujours les 10 règles décrites, ou des règles
  ajoutées/modifiées depuis ?
- La distinction "recos définies" / "recos news" (file d'attente pour les
  pistes sans catégorie) — existe-t-elle sous une forme quelconque, même
  partielle ?
- `_importance()` / `_diversifier()` dans `build_report.py` — toujours les
  fonctions qui choisissent "les 3 du moment" ? Les 7 critères de tri décrits
  (thème désigné client → poids → veille urgente → veille ordinaire en
  dernier → confiance → effort → priorité règle) sont-ils toujours dans cet
  ordre dans le code ?
- `user_persona.py` — toujours non branché nulle part (`build_report.py`
  utilise-t-il toujours un fallback déterministe pour le brief IA) ?
- Le pont onboarding (`onboarding_profile.sql` + `onboarding-card.tsx`) →
  `user_persona.py` — toujours absent, ou construit depuis ?
- `reco_feedback` — la colonne `theme` mentionnée comme prérequis
  (`ALTER TABLE reco_feedback ADD COLUMN theme`) a-t-elle été ajoutée ?

Rendre un rapport point par point : "toujours vrai" / "a changé, voici
comment" / "je n'ai pas pu vérifier", avec références fichier:ligne.

## Answer

**Découverte majeure, non demandée explicitement mais qui recadre toute la
question** : entre le 26 août (artifact) et aujourd'hui, le Graphe A a été
**entièrement construit puis entièrement retiré**, sur décision produit de
David — pas resté figé à l'état ○ décrit dans l'artifact.

- `c4a630a` (29/08/2026, 09:57) — *feat(recos): Graphe A — classificateur +
  recos_compte dans le pool commun* : le classificateur
  (`CLASSIFIER_CATEGORIES_IA` / `CATEGORY_PLATFORM_IA` / anti-collision) et
  la file `reco_news` (`supabase/migrations/reco_news.sql`, table dédiée,
  RLS, upsert par semaine) existaient réellement dans `saas/worker/build_report.py`
  (nom du dossier avant le renommage en `saas/traitement/`), fusionné sur `main`.
- `b10b9fd` (30/08/2026, 12:41) — *revert(recos): retrait du Graphe A — les
  recos redeviennent 100% par thème* : retrait miroir exact du commit
  précédent, motivé par une phrase de David citée dans le message de commit :
  « les recos c'est uniquement pour les thèmes, on fait pas de recos
  générale — le général c'est le point de vue de la semaine ». Le commit
  supprime la section "Compte entier" du rapport, `recos_compte`, le
  classificateur et la migration `reco_news.sql`.

Résultat aujourd'hui (vérifié par grep sur tout `saas/` : aucune occurrence
de `classificateur`, `CLASSIFIER_CATEGORIES_IA`, `reco_news`, `recos_compte`) :
le code est revenu à un état visuellement identique à celui que l'artifact
décrivait (○), mais ce n'est plus un "jamais commencé" — c'est un aller-retour
tranché. **Ça vaut la peine que David confirme si la destination de cette
carte (`map.md` : "les recos générale, niveau compte, hors thème") tient
toujours compte de cette décision du 30/08**, avant de continuer à instruire
le classificateur.

Point par point :

- **Le classificateur** — *a changé, puis est revenu à l'état ○* (voir
  découverte ci-dessus). Aucune trace dans le code actuel :
  `saas/recos_ia/reco_engine.py` et `saas/traitement/build_report.py` ne
  contiennent ni classificateur, ni logique de correspondance IA vers une
  catégorie. Vérifié par grep sur `saas/` entier (aucun résultat pour
  "classificateur"/"classifier"), et par lecture complète de
  `saas/recos_ia/reco_engine.py` (aucune fonction de ce type) et
  `saas/traitement/build_report.py` (seule référence : `_theme_ai_recos`,
  la piste IA **par thème**, sans lien avec un classificateur compte-entier).

- **`reco_engine.py` — toujours les 10 règles ?** — *toujours vrai, à
  l'identique.* `saas/recos_ia/reco_engine.py:690-701` (fonction
  `build_recos`) liste exactement les 10 mêmes règles que l'artifact,
  dans le même ordre d'évaluation :
  `_rule_roas` (l. 232), `_rule_gaspillage` (l. 115), `_rule_scaler` (l. 194),
  `_rule_silence` (l. 522), `_rule_format_gagnant` (l. 477),
  `_rule_page_endormie` (l. 552), `_rule_creneau` (l. 578), `_rule_funnel`
  (l. 369), `_rule_ga4_muet` (l. 426), `_rule_connecter_ga4` (l. 453).
  Aucune ajoutée, aucune retirée, aucune renommée.

- **Distinction "recos définies" / "recos news"** — *a changé, temporairement,
  puis retour à ○.* A existé du 29/08 au 30/08 sous la forme d'une vraie
  table `reco_news` (migration `supabase/migrations/reco_news.sql`, commit
  `c4a630a`) — file d'attente pour les pistes sans catégorie, explicitement
  *pas* un pipeline de promotion automatique (aucun statut, aucun compteur,
  à consulter à la main dans Supabase Studio, par décision de David citée
  dans le commentaire SQL du commit). Entièrement supprimée par `b10b9fd` le
  lendemain — la migration n'existe plus dans le repo (confirmé : absente de
  `supabase/migrations/000_run_me_all.sql` et du dossier `supabase/migrations/`
  sur `main` aujourd'hui).

- **`_importance()` / `_diversifier()` dans `build_report.py`** — *toujours
  vrai, à l'identique.* `saas/traitement/build_report.py:371-387`
  (`_importance`) applique exactement les 7 critères dans l'ordre décrit par
  l'artifact : `is_priority` — thème désigné client (l. 380) → `rang` — poids
  du thème (l. 381) → urgence de la veille (l. 382) → veille ordinaire reléguée
  en dernier (l. 383) → confiance `_CONF_W` (l. 384) → effort `_EFF_W`
  (l. 385) → `priority` de la règle, tie-break final (l. 386).
  `saas/traitement/build_report.py:297-331` (`_diversifier`) applique
  toujours les 5 passes décroissantes en exigence (`cle+theme+levier` →
  `cle+theme` → `cle+levier` → `cle` → aucune), confirmées ligne 311-312.

- **`user_persona.py` — toujours non branché ?** — *toujours vrai.* Le
  fichier existe en entier (`saas/recos_ia/user_persona.py`,
  `build_user_persona()` / `regenerate_user_persona()`) mais
  `saas/traitement/build_report.py:10` porte encore le commentaire
  "disponible mais pas encore branché ici", et un grep sur
  `saas/traitement/build_report.py` et `saas/collecte/automatisation/`
  ne trouve aucun appel à `build_user_persona`/`regenerate_user_persona`.
  Le brief IA du rapport reste sur un fallback déterministe (confirmé aussi
  par `saas/traitement/CLAUDE.md`, section "Différence assumée avec l'ancien
  Streamlit").

- **Le pont onboarding → `user_persona.py`** — *toujours absent, à
  l'identique.* `supabase/migrations/onboarding_profile.sql:1-8` pose bien
  les 4 colonnes (`business_type`, `budget_range`, `time_budget`,
  `frustration`) avec le commentaire "nourrit le persona IA dès le départ",
  mais en pratique seul `business_type` est lu, et uniquement par
  `saas/recos_ia/labeling.py:79-92` (la description business envoyée à
  l'IA de catégorisation des thèmes) — jamais par `user_persona.py`. Aucune
  des 4 colonnes n'apparaît dans `saas/recos_ia/user_persona.py`.

- **`reco_feedback.theme`** — *a changé : la colonne a été ajoutée.*
  `supabase/migrations/000_run_me_all.sql:1899-1909` (section "22") ajoute
  `theme text NOT NULL DEFAULT ''` et `title text` à `reco_feedback`, et
  remplace la contrainte d'unicité `reco_feedback_uq` par
  `reco_feedback_uq2 UNIQUE (user_id, reco_key, week_start, theme)`. Ajoutée
  par le commit `16fdbc8` (*feat(recos): retours client dans la composition +
  pondération honnête*, 29/08/2026 00:30) — donc **après** l'artifact du 26
  août. Le prérequis identifié par l'artifact est donc rempli, mais il l'a
  été pour le Graphe B (par thème) — le commentaire SQL le dit explicitement
  ("pour que « Fait » (Graphe B) sache distinguer un « gaspillage » fait sur
  un thème d'un « gaspillage » fait sur un autre"), pas pour un besoin du
  Graphe A.

Non vérifiable : rien dans cette liste n'a dû être laissé en "je n'ai pas pu
vérifier" — chaque point a une trace directe dans le code ou l'historique git.
