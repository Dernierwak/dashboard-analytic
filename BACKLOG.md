# Backlog — Améliorations futures

Liste des idées notées pendant le développement, à implémenter plus tard.

---

## Meta Ads

### Alertes budget
- Notification quand `spend > 80%` du `budget_planifié` (warning jaune)
- Notification critique quand `spend > 100%` (rouge + badge sur la card campagne)
- Visuellement via un toast Next.js au rendu + badge persistant
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

## Paiement

### Stripe côté Next.js — à reconstruire
- Stripe n'est pas branché en réel aujourd'hui (ni côté ancien Streamlit, ni
  côté Next.js). L'ancien code Streamlit (`scripts/stripe.py`,
  `components/callbacks.py::handle_stripe_payment`, la card d'upgrade dans
  `components/account_tab.py`) a été retiré avec le reste de Streamlit
  (voir `STREAMLIT_REMOVAL.md`), pas migré — c'est un chantier séparé.
- Repères de l'ancienne implémentation, au cas où ils servent de point de
  départ : plans `starter` (15 CHF/mois), `pro` (35 CHF/mois), `agency`
  (150 CHF/mois), abonnement mensuel, `stripe.checkout.Session` en mode
  `subscription`, statut stocké dans `profiles.is_paid`.
- À construire : route API Next.js pour créer la session checkout, webhook
  Stripe pour confirmer le paiement et mettre à jour `profiles.is_paid`,
  page d'upgrade dans `saas/web`.

### Persona utilisateur IA — extrait mais pas branché
- `saas/core/user_persona.py` (déplacé depuis l'ancien `components/user_persona.py`
  au retrait de Streamlit) sait construire et rafraîchir un profil utilisateur
  à partir des commentaires laissés sur les conseils (`build_user_persona`,
  `regenerate_user_persona`), pour personnaliser le ton de l'IA. Le module est
  headless et fonctionnel, mais **n'est appelé par aucun code aujourd'hui** —
  l'ancien Streamlit l'utilisait dans `pages/rapport.py` (retiré), et
  `saas/worker/build_report.py` ne l'a jamais branché (brief IA en fallback
  déterministe). À décider : le brancher dans `build_report.py`, ou construire
  l'équivalent côté Next.js.

## Général

### Module « Comparer » à repenser
- Retiré des pages Google Ads, Meta Ads et Instagram (`app/google/page.tsx`,
  `app/meta/page.tsx`, `app/instagram/page.tsx`) — David l'a jugé pas optimal.
- Le composant (`components/comparaison.tsx`) et les calculs sous-jacents
  (`batirComparaison` dans `lib/channels.ts`, type `Comparaison`) sont
  **conservés en base**, juste plus rendus nulle part, pour repartir de ce
  code plutôt que de zéro.
- À reprendre proprement plus tard — sans présumer ici de sa forme future.

### Notifications dashboard
- Centre de notifications (badge rouge en haut à droite du nav)
- Agrège : alertes budget, baisse de portée, dépassement, etc.
- Persiste les notifications lues vs non-lues

### Export rapport hebdomadaire
- PDF/HTML avec un screenshot des KPI principaux
- Envoi automatique par email chaque lundi — déjà en place (Resend, voir
  `saas/worker/build_report.py` + `saas/emailing/`) ; ce qui manque, c'est le
  export PDF/HTML téléchargeable en plus de l'email

### Mode dark
- CSS tokens déjà en place (`--ink`, `--ink-3`, etc.)
- Toggle dans Paramètres

### Frise chronologique de la semaine (rapport, section 1)
Dans « Ta semaine, tous thèmes confondus » : une vue du temps, à côté de la
boussole et de l'anneau. On voit *ce qui tournait* pendant la semaine, pas
seulement ce que ça a donné.

- **Campagnes** : une barre horizontale par campagne, du début à la fin de sa
  diffusion. Une campagne lancée mercredi n'a eu que la moitié de la semaine —
  aujourd'hui rien ne le dit, et on lui compare des chiffres de semaine pleine.
- **Publications** : un point (ou une vignette) à sa date de publication, sur la
  même échelle de temps. On voit d'un coup le rythme, les trous, et si un pic
  de portée suit un post ou une campagne.
- Couleur par thème (`lib/palette.ts`) → la frise dit aussi *dans quel thème* on
  a été actif cette semaine, ce que l'anneau dit en dépense seulement.
- Réutiliser les marqueurs ▲ d'action de `theme-timeline.tsx` : on verrait la
  décision, la campagne et le post sur la même ligne de temps.

Données déjà en base : `meta_ads_insights.date_start` et
`google_ads_insights.date_start` donnent les jours où une campagne a dépensé
(donc début/fin réels de diffusion, sans appel API supplémentaire) ;
`instagram_organic_posts.date` donne la date de publication.

À trancher : période affichée (la semaine seule, ou 30 jours pour du contexte),
et comportement quand il y a 18 campagnes — regroupement par thème plutôt qu'une
barre par campagne.
