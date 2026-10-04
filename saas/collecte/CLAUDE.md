# CLAUDE.md — saas/collecte/

Ce dossier fait de la **récolte brute, et rien d'autre**. Il va chercher les
données chez les plateformes et les écrit dans Supabase, telles quelles. Il ne
choisit pas de thème et ne met rien en forme — ça, c'est le travail de
`saas/traitement/`, qui LIT ce que la
récolte a écrit. Une ligne qui juge, classe ou résume n'a rien à faire ici.

Le projet est **Pulse**, un SaaS d'analyse marketing (voir `CLAUDE.md` à la
racine du dépôt pour le produit dans son ensemble).

## Structure

| Dossier | Quoi | Fichiers |
|---|---|---|
| `meta/` | Meta Ads + Instagram organique — même token utilisateur, même API Graph. | `fetch_meta_ads.py`, `fetch_instagram.py` |
| `google/` | Google Ads. | `fetch_google_ads.py` |
| `ga4/` | Google Analytics 4 — fetch ET le contexte que le rapport lit directement depuis les données GA4 stockées (voir plus bas). | `fetch_ga4.py`, `ga4.py` |
| `commun/` | OAuth Google, partagé par `google/` et `ga4/` — rien d'autre ici, le reste (secrets, lecture/écriture Supabase) a été remonté en `saas/commun/`, utilisé par tout le produit et pas seulement la récolte. | `fetch_token.py` |
| `automatisation/` | Orchestration — appelle les quatre canaux, gère le parallélisme, décide qui doit être récolté aujourd'hui, publie le rapport. | `fetch_all.py`, `suivi.py` |

## Les quatre plateformes

- **Meta Ads** (`meta/fetch_meta_ads.py`) — campagnes, dépenses, budgets,
  changements de campagne (`activities`, fenêtre 180 jours, un PARI ASSUMÉ
  faute de limite documentée par Meta — voir le pavé de commentaire dans
  `automatisation/fetch_all.py`).
- **Instagram organique** (`meta/fetch_instagram.py`) — posts, métriques,
  abonnés. Même jeton que Meta Ads, API distincte.
- **Google Ads** (`google/fetch_google_ads.py`) — campagnes, dépenses,
  budgets, `change_event` (fenêtre **30 jours maximum**, imposée par Google :
  une fenêtre plus large fait rejeter la requête ENTIÈRE, pas juste tronquer).
- **GA4** (`ga4/fetch_ga4.py` + `ga4/ga4.py`) — sessions, conversions, revenu,
  événements, par jour × source/medium. Partage le refresh token OAuth de
  Google Ads (`collecte/commun/fetch_token.py`), scope `analytics.readonly` en
  plus.

Chaque plateforme documente ses propres contraintes dans son fichier — ne pas
les recopier ici, elles se périment vite. Ce qui ne se périme pas, c'est ce
qu'on ne saura **jamais** mesurer : `docs/mesures-impossibles.md`.

## Le recouvrement — LA règle à connaître avant de toucher une date de reprise

Chaque plateforme reprend la récolte depuis « dernière date en base − N jours »,
jamais depuis « dernière date + 1 jour ». Deux raisons, toujours les mêmes :
la journée à moitié écoulée au moment du dernier passage reste gravée pour
toujours si on ne repasse pas dessus, et les plateformes RÉVISENT leurs
chiffres après coup (attribution qui continue d'arriver). Le nombre de jours
N est différent par plateforme et **documenté avec sa source** à côté de son
usage :
- Meta / Google Ads : voir le pavé « LE RECOUVREMENT » dans
  `automatisation/fetch_all.py`.
- GA4 : 12 jours, le plus long délai que Google documente noir sur blanc
  (`ga4/ga4.py`, constante `_RECOUVREMENT_JOURS_GA4` — les deux liens Google
  sont dans le commentaire juste au-dessus).

Le recouvrement ne coûte aucune tranche de plus : il tient dans celle que la
récolte demandait de toute façon (Meta, 28 jours : au plus une page de
pagination de plus — décompte dans le pavé). Les lignes réécrites REMPLACENT
les anciennes par upsert — elles ne s'additionnent pas.

## L'orchestration (`automatisation/`)

`fetch_all.py` est le point d'entrée réel, lancé par
`.github/workflows/weekly-fetch.yml` (cron quotidien 07:00 UTC — ne traite
que les comptes dont c'est le jour, `profiles.fetch_schedule`). Il récolte les
quatre canaux **en parallèle** (trois fils : Meta+Instagram en série, Google
Ads, GA4 — le detail et pourquoi *pas* quatre fils est commenté en tête du
fichier), puis publie le rapport (`saas/traitement/build_report.py` — importé
localement pour éviter un cycle).

**LA LABELLISATION ET LA CATÉGORISATION IA ONT DISPARU** avec le reste des
recommandations (2026-09-21), et avec elles les modes `--label-only` et
`--categorize-only`. Un thème se pose désormais à la main, sur la page Thèmes.
`run_weekly.py`, une démo bout-en-bout que personne n'appelait, est parti aussi.

`suivi.py` tient le journal de ce qui a été récolté par canal (`CANAUX`), lu
par `saas/web/app/comptes/page.tsx` pour afficher où en est chaque compte.

## Ce qui ne se négocie jamais ici (en plus des règles de la racine)

- **Un chiffre non mesuré n'est pas un zéro.** Une plateforme qui ne rend
  rien sur une fenêtre le DIT dans son message de retour — elle ne rend
  jamais silencieusement `0`.
- **`app_secrets.py` (`saas/commun/`) est le seul endroit qui lit les
  credentials.** Aucune clé, jeton ou secret ne se recopie ailleurs — ni en
  dur, ni dans un commentaire.
- **Chaque plateforme échoue seule.** Une erreur sur un canal n'empêche pas
  les trois autres de finir (voir `try/except` par fil dans `fetch_all.py`).
