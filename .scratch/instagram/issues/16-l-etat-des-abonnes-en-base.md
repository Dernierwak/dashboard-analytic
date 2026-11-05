# 16: L'état des abonnés en base

Type: task
Status: open
Blocked by: —
Assignee: —

## Question

La page `/instagram` lit les abonnés dans `followers_history`
(`saas/web/lib/channels.ts:923`), mais **plus rien dans le dépôt n'écrit
cette table** depuis le départ de l'Edge Function `fetch-followers`
(2026-09-06, `7f188f3`) — [recherche 04](04-ce-que-l-api-donne-du-compte.md).

Constater, sans rien modifier :
1. dans Supabase → Edge Functions : `fetch-followers` est-elle encore
   déployée, et a-t-elle tourné récemment ?
2. dans le SQL Editor :
   `select user_id, max(fetched_at), count(*) from followers_history group by user_id;`
   — la date de la dernière ligne par compte.

HITL : David seul a l'accès au tableau de bord Supabase. Le résultat dit si
le chiffre d'abonnés affiché aujourd'hui est figé (un bug en production,
hors de cette carte, à signaler à part) et ce que
[Le compte dans le temps](10-le-compte-dans-le-temps.md) peut supposer de
l'historique existant.

> **Éclairé par [Les règles d'analyse réglables](11-les-regles-d-analyse-reglables.md)
> (2026-11-05)** : une métrique de plus en dépend — la portée ÷ abonnés du
> jour de publication (objectif Portée) exige un nombre d'abonnés **daté**
> pour chaque jour où un post est publié.
