# Décisions du projet Pulse

Ce journal conserve les décisions durables et leur raison. Il complète le
backlog, qui décrit les idées futures, et `STATUS.md`, qui décrit l'avancement.

## 19 août 2026 — Pulse remplace Streamlit

L'unique interface produit à conserver est le portail Next.js `saas/web`.
Streamlit sera retiré après extraction de toute logique serveur encore utilisée
par les workers.

## 19 août 2026 — Le savoir des agents est protégé

Les éléments suivants ne font pas partie du nettoyage Streamlit :

- `.claude/`, ses agents, ses skills et sa configuration ;
- `CLAUDE.md` ;
- `memory/` ;
- `docs/` ;
- `handoff/` ;
- `BACKLOG.md` ;
- les règles métier, décisions UX et commentaires qui expliquent un arbitrage.

Ils peuvent être restructurés, corrigés et actualisés, mais jamais supprimés
comme de simples restes de l'ancienne interface. Avant de supprimer un fichier
de code Streamlit, toute connaissance unique qu'il contient doit être déplacée
vers la documentation ou vers le nouveau code.

## 19 août 2026 — Une seule branche de référence

Le worktree `tender-moore-baca4c` est la référence actuelle : son historique est
plus récent que celui de `clever-lederberg-1431c0`. Les modifications locales
des deux worktrees doivent être sécurisées avant la suppression d'un worktree.

## 19 août 2026 — Le suivi est versionné

- `STATUS.md` porte l'état courant et la prochaine étape.
- `DECISIONS.md` porte les choix durables et leurs raisons.
- `BACKLOG.md` porte uniquement les idées non engagées.

Une information importante ne doit pas dépendre uniquement d'une conversation
avec un agent.

## 19 août 2026 — Mode de travail économe pour les LLM

Chaque demande contenant plusieurs sujets est d'abord transformée en checklist
explicite. Le compte rendu final répond à chaque point de cette checklist.
Les changements proches sont inspectés et vérifiés ensemble pour éviter de
relire plusieurs fois les mêmes fichiers.

Aucun sous-agent ne doit être lancé sans demande explicite de David. Un
sous-agent est un appel de modèle supplémentaire : il peut accélérer des travaux
réellement indépendants, mais augmente la consommation et disperse le contexte
quand la tâche est petite ou séquentielle.

Le dashboard HTML et son archive Git ne doivent jamais être relus en entier par
un LLM. Leur conservation ne coûte rien ; c'est leur chargement dans le contexte
qui coûte. Les agents reprennent le fil via `STATUS.md`, puis utilisent des
recherches ciblées pour modifier uniquement la section utile du dashboard.
