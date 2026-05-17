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
