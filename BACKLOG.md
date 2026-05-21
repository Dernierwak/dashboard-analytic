# Backlog — Améliorations futures

Liste des idées notées pendant le développement, à implémenter plus tard.

---

## Meta Ads

### Alertes budget
- Notification quand `spend > 80%` du `budget_planifié` (warning jaune)
- Notification critique quand `spend > 100%` (rouge + badge sur la card campagne)
- Visuellement via `st.toast` au rendu + badge persistant
- Idée d'extension : envoi d'un email/notif si l'utilisateur a opté pour les alertes

### Tab Insights
- Vue "performance avancée" séparée de Performance et Coût
- Pyramide des coûts : CPM → CPC → CPV → CPA
- Benchmarks par secteur (à définir)
- Évolution du Quality Ranking si dispo via l'API

### Granularité Assets
- Drill-down : campagne → adset → ad
- Permet de voir quelle créa performe le mieux dans une campagne
- Nécessite refonte du fetch (actuellement on stocke au niveau ad mais on agrège au niveau campagne)

---

## Instagram

### Filtre temporel "Ce qui marche"
- Actuellement la métrique est calculée sur tous les posts
- Ajouter un filtre période (30j / 90j / tout) pour voir l'évolution des formats qui marchent

### Comparaison avant/après pour les labels
- Si un label a été assigné à plusieurs posts, comparer la perf moyenne avant/après l'introduction du label
- Permet de mesurer l'impact d'une stratégie

### Heatmap "Quand publier" — filtre métrique
- Comme "Ce qui marche pour toi", permettre de choisir la métrique (likes, saves, eng)
- Cohérence avec le filtre déjà ajouté en Performance

### Auto-labellisation IA des posts
- L'utilisateur définit ses labels et donne 1-2 exemples + une description courte par label
  (ex. "Promo : posts qui annoncent une offre commerciale, code promo, soldes…")
- Un bouton "Labelliser automatiquement" appelle un LLM qui assigne le bon label à chaque post non labellisé
- Stockage : `instagram_organic_posts.labels` (déjà existant)
- Coût : limiter par batch / par jour pour éviter dérapage
- UI : bouton dans le tab Labels, modal pour ajouter examples + description par label, progress bar pendant l'analyse

### Stories Instagram
- Récupérer les stories via Instagram Graph API (endpoint `/stories`)
- Stocker dans nouvelle table `instagram_stories` ou dans `instagram_organic_posts` avec `type=STORY`
- Métriques disponibles : reach, exits, taps_forward, replies
- À noter dans Paramètres → Instagram (déjà fait : 'bientôt')

### Posts Collab Instagram
- Posts collab (partagés entre plusieurs comptes) ne sont **pas accessibles** via l'API Instagram Graph en lecture
- Limitation API Meta — pas réalisable côté technique aujourd'hui
- Surveiller les évolutions de l'API Meta Graph (potentiellement débloqué dans une future version)

---

## Général

### Notifications dashboard
- Centre de notifications (badge rouge en haut à droite du nav)
- Agrège : alertes budget, baisse de portée, dépassement, etc.
- Persiste les notifications lues vs non-lues

### Export rapport hebdomadaire
- PDF/HTML avec un screenshot des KPI principaux
- Envoi automatique par email chaque lundi
- Pattern existant dans `pages/rapport.py` à étendre

### Mode dark
- CSS tokens déjà en place (`--ink`, `--ink-3`, etc.)
- Toggle dans Paramètres
