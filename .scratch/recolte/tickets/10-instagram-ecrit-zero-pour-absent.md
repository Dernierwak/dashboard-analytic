# 10: Instagram écrit zéro pour une métrique absente

Type: task
Status: open (trouvé en chemin, à trier)
Blocked by: 05

**Trouvé le 2026-10-07 en écrivant le ticket 01.** `fetch_instagram.py`
transforme toute absence en `0`, contre `CLAUDE.md` §7 :
- `_fetch_post_metrics` : `metrics[item["name"]] = val or 0`, et `follows`
  vaut `0` quand l'appel échoue ou ne rend rien ;
- `fetch_headless` : `metrics.get("likes", 0)` etc. ;
- `_fetch_account_followers` : `followers_count` absent → `0` abonné ;
- une erreur Graph (`{"error": …}` en HTTP 200) donne `data` vide, donc un
  post entièrement à zéro, sans un mot.

`saas/web/lib/channels.ts` (~l. 819) note déjà que la récolte ne distingue pas
une absence. Les tickets 25 et 28 de `meta-ads` corrigent l'affichage ; ici,
c'est la source.

À trancher avant de construire : les colonnes Instagram acceptent-elles
`NULL` ? Si non, migration — à faire valider (§7).
