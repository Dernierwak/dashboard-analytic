# État du projet Pulse

Dernière mise à jour : 25 août 2026

## Produit actif

Pulse est l'application active. Son interface est le portail Next.js situé dans
`saas/web`. Supabase reste la source de vérité des données. Les traitements
automatiques vivent dans `saas/worker` et l'envoi des rapports dans
`saas/emailing`.

`PROJECT_STATUS.html` est le centre de guidage visuel partagé avec les LLM : il
affiche la progression, les tâches faites/en cours/à faire et leur historique.
Les validations manuelles sont conservées dans le navigateur.
La roadmap y est organisée par projets, chacun portant ses mini-tâches et sa
propre progression : GA4, Agents, Recos IA, Google Ads, Onboarding, Site
internet, UX, Structure projet, Meta Ads, Instagram et Général.
Le dashboard contient également 24 grands livrables historiques validés par
Git et l'archive complète des 260 commits depuis février 2026. Cette archive se
rafraîchit avec `python3 scripts/build_project_history.py`.
Une section Agents documente le rôle et la méthode de chaque spécialiste et
transforme les retours de David en auto-revues LLM : signal, apprentissage,
évolution de compétence et nouvelle règle. Une carte des coûts en tokens montre
les postes probables (contexte, historique, outils, sous-agents, gros fichiers)
détectés par le LLM. Les optimisations sûres sont appliquées automatiquement ;
les changements qui demandent une décision créent une tâche pour David.

L'ancienne interface Streamlit a été entièrement retirée du dépôt (TASK-016,
voir `STREAMLIT_REMOVAL.md`). `saas/web` (Next.js) est la seule interface
produit. Aucun traitement utilisé par le worker n'a été perdu : `ga4.py`,
`reco_engine.py` et `user_persona.py` vivent maintenant dans `saas/core/` ;
`meta_script/`, `google_script/` et `scripts/` restent à la racine, rendus
100% headless (zéro import Streamlit).

## Travail en cours

Rien en cours sur le retrait de Streamlit — terminé et validé (compilation
Python, imports réels du worker, build Next.js 16 routes vert).

## Prochaine étape

Voir `BACKLOG.md` : Stripe reste à construire côté Next.js (jamais branché en
réel), et `saas/core/user_persona.py` est extrait mais pas encore câblé dans
`saas/worker/build_report.py`.

## Règle de fin de session

À chaque fin de session, mettre à jour ce fichier avec : ce qui a été terminé,
les fichiers modifiés, le blocage éventuel et la prochaine action concrète.
