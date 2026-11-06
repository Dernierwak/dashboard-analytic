# 16: L'état des abonnés en base

Type: task
Status: resolved
Blocked by: —
Assignee: David (session Claude, 2026-11-06)

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

## Résolution (2026-11-06)

Lu par Claude avec la clé secrète du `.env` (lecture seule, PostgREST),
colonnes `user_id, followers, fetched_at, id` :

| Compte | Lignes | Première | Dernière |
|---|---|---|---|
| `0b83e564-…` | 139 | 2026-04-18 | 2026-09-04 |
| `11043e9a-…` | 37 | 2026-03-12 | 2026-09-04 |

1. **Plus rien n'écrit `followers_history` depuis le 2026-09-04** (relevé
   quotidien à 09:00 UTC jusque-là), deux jours avant le départ de
   `fetch-followers`. Qu'elle soit encore déployée ou non ne change rien :
   elle ne tourne pas. Le tableau de bord n'a pas été ouvert.
2. **Le chiffre d'abonnés affiché aujourd'hui en production est figé au
   2026-09-04** — un bug hors de cette carte, noté au `BACKLOG.md`.
3. **Pour la page** : l'historique existant est mesuré et daté, il se garde.
   Avec la remontée de 30 jours ([Ce que l'essai réel laisse à
   décider](22-ce-que-l-essai-laisse-a-decider.md)), la courbe a donc deux
   morceaux : jusqu'au 2026-09-04, puis à partir de 30 jours avant le premier
   passage — **un trou entre les deux**, comme le veut
   [Le compte dans le temps](10-le-compte-dans-le-temps.md) pour un jour sans
   donnée. La portée ÷ abonnés du jour de publication se lit sur ces jours-là
   seulement ; ailleurs, « – ».
