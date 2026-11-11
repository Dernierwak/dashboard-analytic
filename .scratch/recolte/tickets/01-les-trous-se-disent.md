# 01: Les trous se disent

Type: task
Status: ready-for-human
Blocked by: —

**What to build:** aucune tranche refusée par une plateforme ne se perd sans
un mot, et aucun appel HTTP de la récolte ne peut pendre sans fin.
Aujourd'hui, Meta dit ses trous ; Google et GA4 ne les disent pas.
`CLAUDE.md` §7 : une absence n'est pas un zéro, ce qu'on ne mesure pas se dit.

Ce que le code fait aujourd'hui :
- `_fetch_google` (`automatisation/fetch_all.py`) : `if not err: rows += chunk`
  — la tranche refusée (insights campagne ET annonces) est jetée, la run reste
  verte, le mot dit « N lignes ».
- `run_ga4_fetch` (`ga4/ga4.py`) : une tranche en erreur fait `continue` ; si
  une autre tranche a des lignes, le message final ne cite pas l'erreur.
  `_ev_err` (événements) est ignoré sans un mot.
- `fetch_instagram.py` : quatre `requests.get` sans `timeout`
  (`_fetch_post_info`, `_fetch_post_metrics` ×2, `_fetch_account_followers`).
  `requests` attend alors indéfiniment ; le plafond est celui du job GitHub
  Actions (6 h).

- [x] Google : chaque tranche refusée (campagnes et annonces) est imprimée
      dans le journal et comptée dans le mot de fin du canal
- [x] GA4 : une tranche d'insights ou d'événements refusée est comptée dans le
      mot de fin, même quand d'autres tranches ont rendu des lignes
- [x] Instagram : les quatre appels ont un `timeout`
- [x] `python3.12 -m py_compile` sur ce qui a été touché
- [x] Harnais hors ligne : un faux `fetch_campaign_insights` qui refuse une
      tranche → le mot de fin la nomme
- [ ] **Essai (ticket 08)** sur un vrai compte :
      le journal des canaux Google et GA4 est inchangé quand rien n'est refusé

## Comment

**2026-10-07 — écrit et vérifié hors ligne. Reste l'Essai (ticket 08).**

Ce qui a changé :
- `saas/collecte/automatisation/fetch_all.py` : `_tranches_google(appel, …)
  -> (lignes, trous)` remplace les deux boucles de `_fetch_google`. Chaque trou
  s'imprime dans le journal ; le mot de fin ajoute
  `· N tranche(s) campagnes|annonces REFUSÉE(S) : <la première>`.
- `saas/collecte/ga4/ga4.py` : `trous` et `trous_ev` remplacent `last_error`,
  et `_avec_trous` les colle aux deux sorties de `run_ga4_fetch`. Zéro ligne
  ET des refus ne dit plus « la propriété ne rend rien ».
- `saas/collecte/meta/fetch_instagram.py` : `timeout=30` sur les quatre appels.
  Un scan AST de tout `saas/collecte/` ne trouve plus aucun
  `requests.get/post` sans `timeout`.

Le mot de fin n'est analysé nulle part (`git grep` sur `web/`, `emailing/`,
`traitement/`) : l'allonger ne casse aucun écran.

Vérifié : `python3.12 -m py_compile` sur les trois fichiers ;
`python3.12 .scratch/recolte/harnais/01_trous.py` → `TOUT VERT` (Google :
aucun trou, un trou, un seul jour ; GA4 : aucun trou, trou d'insights, trou
d'événements, tout refusé).

Pas vérifié : le comportement avec de vraies API. Il se vérifiera avec
l'Essai (ticket 08), qui n'écrit rien et n'envoie rien.

**2026-10-07 — suite.** Le code a déménagé aux tickets 02 et 06 : la boucle de
`_tranches_google` vit dans `google/ads/insights_campagnes.py` et
`insights_annonces.py` (`recuperer`), le mot de fin dans `google/ads/recolte.py`,
GA4 dans `google/analytics/recolte.py`. `harnais/01_trous.py` suit les nouveaux
noms et reste `TOUT VERT`.
