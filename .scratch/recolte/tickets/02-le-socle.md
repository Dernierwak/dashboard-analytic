# 02: Le socle — HTTP et fenêtres

Type: task
Status: resolved
Blocked by: 01

**What to build:** `saas/collecte/socle/`, partagé par toutes les plateformes.

- `socle/http.py` : une `requests.Session`, `timeout` obligatoire,
  `sans_jeton()` (aujourd'hui dans `fetch_all.py` seul). **Les 429 et 5xx se
  réessaient** : `Retry-After` respecté, sinon attente croissante, nombre
  d'essais plafonné, puis l'erreur est rendue (elle devient un trou nommé,
  ticket 01). Chez Meta, la limite arrive aussi en HTTP 400 avec un code
  d'erreur dans le corps : **lire la doc Meta pour la liste exacte des codes**
  et la citer dans le commentaire, ne pas la recopier de mémoire.
- `socle/fenetre.py` : `tranches(since, until, jours=90)`, `depart_recolte`,
  `date_forcee`. La boucle de tranches existe aujourd'hui en quatre exemplaires.
- `ga4/ga4.py` cesse d'importer `_depart_recolte` depuis `fetch_all`.

- [x] Plus aucune boucle de tranches écrite à la main dans `collecte/`
- [x] Plus aucun `requests.get/post` direct hors de `socle/http.py`
- [x] Harnais hors ligne : `fenetre.py` (même jour, 90 j pile, 91 j, `latest`
      None, `latest` futur) et `http.py` (faux serveur : 429 avec et sans
      `Retry-After`, 500 puis 200, 429 sans fin → erreur rendue, pas levée)
- [x] `python3.12 -m py_compile` sur ce qui a été touché
- [ ] **Essai (ticket 08)** sur un vrai compte : mêmes mots de fin qu'avant

## Comment

**2026-10-07 — construit et vérifié hors ligne. L'Essai (08) reste à passer.**

Ce qui a changé :
- `saas/collecte/socle/http.py` (neuf) : `get`/`post` à `timeout` sans défaut,
  une `requests.Session` **par fil** (`threading.local` — `requests` ne
  garantit pas le partage, https://github.com/psf/requests/issues/2766).
  Réessai sur 429, 5xx et limites Meta rendues dans le corps : codes 4, 17, 32,
  613, 80000–80014, **lus dans la doc le 2026-10-07**
  (https://developers.facebook.com/docs/graph-api/overview/rate-limiting/).
  `Retry-After` respecté ; chez Meta, la doc ne parle pas de `Retry-After` mais
  d'`estimated_time_to_regain_access` (minutes) dans `X-Business-Use-Case-Usage`.
  4 tentatives, 2/4/8 s ; une attente annoncée > 60 s ne s'attend pas. Au bout,
  la dernière réponse est RENDUE (l'appelant en fait un trou nommé). Une
  exception réseau n'est pas réessayée. `sans_jeton` y a déménagé.
- `saas/collecte/socle/fenetre.py` (neuf) : `tranches`, `depart_recolte`,
  `date_forcee(valeur, today, profondeur_jours)` — la profondeur Meta
  (`_PROFONDEUR_META_JOURS`) reste dans `fetch_all.py` avec sa source.
- Les trois boucles de tranches (`_fetch_meta`, `_tranches_google`,
  `run_ga4_fetch`) passent par `tranches()`. `ga4/ga4.py` n'importe plus rien de
  `fetch_all`.
- Tous les `requests.get/post` de `collecte/` (fetch_all, fetch_token,
  fetch_ga4, fetch_google_ads, fetch_instagram, fetch_meta_ads) → `http.get/post`.
- Références renommées : `docs/adr/0005`, `saas/traitement/build_report.py`,
  `saas/web/lib/canaux-muets.ts` (commentaires seulement).

Un seul changement visible hors réessai : le message d'erreur de
`--meta-since` dit « dépasse les 1126 jours que l'API accepte » au lieu de
« 37 mois que l'API Meta accepte » (la fonction est devenue générique) ; le
préfixe `--meta-since :` est conservé à l'impression.

Vérifié : `py_compile` sur tout `saas/collecte/` et `build_report.py` ;
`harnais/02_socle.py` → `TOUT VERT` (tranches 1 j / 90 j / 91 j / vide ;
reprise None / passé / futur ; 429 avec et sans `Retry-After`, 500 puis 200,
429 sans fin rendu après 4 essais, attente de 3600 s non attendue, code Meta
80000 réessayé, 30 min BUC non attendues, code 190 non réessayé, code Meta hors
hôte Meta ignoré) ; `harnais/01_trous.py` → `TOUT VERT`. Scan AST : aucun
`requests` hors de `socle/http.py`, tous les appels `http.*` ont un `timeout`.

Pas vérifié : le comportement contre les vraies API (Essai, ticket 08).
