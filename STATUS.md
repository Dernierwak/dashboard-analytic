# État du projet Pulse

Dernière mise à jour : 19 août 2026

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

L'ancienne interface Streamlit située à la racine doit être retirée. Ce retrait
ne doit supprimer ni les traitements encore utilisés par le worker, ni les
connaissances accumulées pendant le développement.

## Travail en cours

1. Extraire les fonctions serveur encore mélangées à l'interface Streamlit.
2. Vérifier que la collecte et la génération des rapports fonctionnent sans
   importer Streamlit.
3. Retirer ensuite les points d'entrée et composants exclusivement Streamlit.
4. Nettoyer les dépendances et actualiser la documentation.

## Dépendances qui bloquent encore le retrait complet

Le worker importe actuellement :

- `components/ga4.py` et `components/reco_engine.py` ;
- `scripts/app_secrets.py`, `scripts/fetch_data.py` et `scripts/insert_data.py` ;
- `google_script/` ;
- `meta_script/fetch_meta_ads.py` et `meta_script/fetch_instagram.py`.

Ces éléments doivent être déplacés ou rendus totalement indépendants de
Streamlit avant suppression de l'ancienne application.

## Prochaine étape

Créer les modules d'intégration headless dans `saas`, rediriger les imports du
worker vers eux, puis exécuter les contrôles Python et le build Next.js.

## Règle de fin de session

À chaque fin de session, mettre à jour ce fichier avec : ce qui a été terminé,
les fichiers modifiés, le blocage éventuel et la prochaine action concrète.
