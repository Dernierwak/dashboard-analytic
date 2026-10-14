# CLAUDE.md — saas/data/fetch_data/

Ce dossier fait de la **récolte brute, et rien d'autre**. Il va chercher les
données chez les plateformes et les écrit dans Supabase, telles quelles. Il ne
met rien en forme — ça, c'est le travail de `saas/data/supabase/processed_data/weekly_report/`, qui LIT ce que
la récolte a écrit. Une ligne qui juge, classe ou résume n'a rien à faire ici.

Le projet est **Pulse**, un SaaS d'analyse marketing (voir `CLAUDE.md` à la
racine du dépôt pour le produit dans son ensemble). La forme de ce dossier a été
décidée dans `.scratch/recolte/map.md`.

## La forme : les interfaces d'abord, puis les implémentations

| Où | Quoi |
|---|---|
| `cockpit/` | Les trois commandes : `scheduled_update.py` (cron), `full_history.py` (historique complet), `check_data_collection.py` (JSON local, aucune écriture). |
| `orchestration/` | Le déroulement partagé : `execution_plan.py`, `account_sync.py`, `concurrent_runner.py`, `error_reporter.py`. Le suivi persistant vit dans `../supabase/fetch_state/state.py`. |
| `shared/` | Commun à toutes les plateformes. `http_client.py` est le SEUL chemin HTTP ; `date_ranges.py` porte les fenêtres et la reprise ; `token_status.py` distingue un jeton valide, mort ou inconnu. |
| `../supabase/source_data/` | **Tout ce qui envoie la récolte à Supabase** — `meta.py`, `google.py`, `platform.py`. |
| `sources/meta/` | Meta Ads + Instagram — même jeton et même API Graph. `graph_client.py` porte le client et la pagination ; chaque canal expose `sync.py` et range ses lectures dans `fetchers/`. |
| `sources/google/` | Google Ads + GA4 — même refresh token. `client.py` porte l'accès ; chaque canal expose `sync.py` et range ses lectures dans `fetchers/`. |

**Le contrat d'un fetcher :** `recuperer(acces, fenetre=None, limite=None)
-> (lignes, trous)`. Il **lit et ne touche jamais Supabase** — c'est ce qui
permet à l'essai d'appeler le vrai code sans rien écrire. `trous` est une liste
de messages : une tranche refusée se dit, elle ne disparaît pas. Les rares
fichiers qui lisent ce qu'un autre a nommé (`meta/ads/images.py`,
`instagram/metrics.py`) le disent dans leur docstring.

**L'ordre des appels d'un canal** est écrit dans son `sync.py`, à côté de la
dépendance qui l'impose. `execution_plan.py` ordonne les canaux, pas les appels.

La forme d'un canal est toujours la même :

```text
canal/
├── sync.py       # choisit la fenêtre, appelle les fetchers, enregistre
└── fetchers/     # un fichier par donnée lue sur la plateforme
```

## Les trois points d'entrée

Ils importent les MÊMES fonctions (`orchestration/account_sync.py`) ; seule la date
de départ change.

- **`cockpit/scheduled_update.py`** — lancé par `.github/workflows/weekly-fetch.yml`
  (`mode: mise_a_jour`, cron 07:00 UTC) : chaque compte dont c'est le Jour de
  travail (`profiles.fetch_schedule`, `_due_today`) reprend là où sa base
  s'arrête moins le recouvrement, puis le rapport est publié.
  `--user` (récolte d'amorçage, déclenchée par le web), `--force`,
  `--report-only`.
- **`cockpit/full_history.py`** — `mode: complete` : un compte (`--user`
  obligatoire), tout l'historique depuis `--depuis` (37 mois par défaut, la
  limite de Meta). Écrit, publie et envoie comme la mise à jour.
- **`cockpit/check_data_collection.py`** — en local seulement, jamais dans le workflow (le dépôt est
  public) : N éléments par API, un JSON, aucune écriture.

Ce qu'une correction de la récolte change ne se voit qu'après un passage du
worker ; ce qu'elle lit, l'essai le montre avant.

## Les quatre plateformes

- **Meta Ads** (`sources/meta/ads/`) — campagnes, dépenses, budgets, créas,
  changements (`activities`, fenêtre 180 jours, un PARI ASSUMÉ faute de limite
  documentée — `_CHANGES_JOURS_META`, `meta/ads/sync.py`).
- **Instagram organique** (`sources/meta/instagram/`) — posts, métriques,
  abonnés. Même jeton que Meta Ads, API distincte.
- **Google Ads** (`sources/google/ads/`) — campagnes, dépenses, budgets, `change_event`
  (fenêtre **30 jours maximum**, imposée par Google : une fenêtre plus large
  fait rejeter la requête ENTIÈRE, pas juste tronquer).
- **GA4** (`sources/google/analytics/`) — sessions, conversions, revenu, événements,
  par jour × source/medium. Partage le refresh token de Google Ads
  (`google/auth/oauth.py`), scope `analytics.readonly` en plus.

Chaque plateforme documente ses propres contraintes dans son fichier — ne pas
les recopier ici, elles se périment vite. Ce qui ne se périme pas, c'est ce
qu'on ne saura **jamais** mesurer : `docs/mesures-impossibles.md`.

## Le recouvrement — LA règle à connaître avant de toucher une date de reprise

Chaque plateforme reprend la récolte depuis « dernière date en base − N jours »,
jamais depuis « dernière date + 1 jour » : la journée à moitié écoulée au
dernier passage resterait gravée, et les plateformes RÉVISENT leurs chiffres
après coup. Le principe et son coût : pavé « LE RECOUVREMENT » de
`socle/date_ranges.py`. N, avec sa source, à côté de chaque usage :
- Meta : 28 jours (`meta/ads/sync.py`, `_RECOUVREMENT_JOURS_META`).
- Google Ads : 30 jours (`google/ads/sync.py`, `_RECOUVREMENT_JOURS_GOOGLE`).
- GA4 : 12 jours (`google/analytics/sync.py`, `_RECOUVREMENT_JOURS_GA4`).

Les lignes réécrites REMPLACENT les anciennes par upsert — elles ne
s'additionnent pas. C'est aussi ce qui rattrape un trou après une reconnexion.

`saas/data/supabase/fetch_state/state.py` tient le journal de ce qui a été récolté par canal
(`CANAUX`), lu par `saas/web/app/comptes/page.tsx` pour afficher où en est
chaque compte.

## Ce qui ne se négocie jamais ici (en plus des règles de la racine)

- **Un chiffre non mesuré n'est pas un zéro.** Une plateforme qui ne rend
  rien sur une fenêtre le DIT dans son message de retour — elle ne rend
  jamais silencieusement `0`. (Instagram y manque encore :
  `.scratch/recolte/tickets/10-…`.)
- **Aucun appel HTTP hors de `socle/http_client.py`**, et aucun sans `timeout`.
- **Aucun fichier d'API n'écrit** : l'envoi à Supabase vit dans `saas/data/supabase/source_data/`.
- **`saas/config/secrets.py` est le seul endroit qui lit les
  credentials.** Aucune clé, jeton ou secret ne se recopie ailleurs — ni en
  dur, ni dans un commentaire, ni un fragment dans un message d'erreur.
- **Chaque plateforme échoue seule.** Une erreur sur un canal n'empêche pas
  les autres de finir (`try/except` par canal dans `automatisation/concurrent_runner.py`).
