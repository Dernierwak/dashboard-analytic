# CLAUDE.md — saas/collecte/

Ce dossier fait de la **récolte brute, et rien d'autre**. Il va chercher les
données chez les plateformes et les écrit dans Supabase, telles quelles. Il ne
met rien en forme — ça, c'est le travail de `saas/traitement/`, qui LIT ce que
la récolte a écrit. Une ligne qui juge, classe ou résume n'a rien à faire ici.

Le projet est **Pulse**, un SaaS d'analyse marketing (voir `CLAUDE.md` à la
racine du dépôt pour le produit dans son ensemble). La forme de ce dossier a été
décidée dans `.scratch/recolte/map.md`.

## La forme : par plateforme, puis par canal, puis un fichier par API

| Où | Quoi |
|---|---|
| `socle/` | Commun à toutes les plateformes, rien de propre à une régie. `http.py` : le SEUL chemin HTTP (timeout obligatoire, 429/5xx et limites Meta réessayés, `sans_jeton`). `fenetre.py` : `Fenetre`, les tranches de 90 jours, la reprise, et les pavés « LE RECOUVREMENT » et « PROFONDEUR D'HISTORIQUE ». |
| `meta/` | Meta Ads + Instagram — même jeton, même API Graph. `graph.py` : `AccesMeta` et LA pagination Graph. `ads/` : comptes, budgets, activites, creas, images, insights, campagnes, et `recolte.py`. `organique/instagram/` : posts, compte, metriques, et `recolte.py`. |
| `google/` | Google Ads + GA4 — même refresh token. `acces.py` : `AccesGoogle`. `auth/oauth.py` : le refresh token. `ads/` : gaql (version d'API, en-têtes), budgets, statuts, changements, insights_campagnes, insights_annonces, et `recolte.py`. `analytics/` (GA4) : rapport, insights, evenements, catalogue, et `recolte.py`. |
| `ecriture/` | **Tout ce qui écrit** — tables et stockage : `meta.py`, `google.py`, `plateformes.py` (budgets planifiés et changements, partagés par Meta et Google). |
| `plan.py` | Quels canaux tournent, dans quel fil, et pourquoi les autres non. Pur, sans réseau. |
| `mise_a_jour.py` | `class MiseAJour` — le cron. |
| `recolte_complete.py` | `class RecolteComplete` — tout l'historique d'un compte. |
| `essai.py` | `class Essai` — N éléments par API → un JSON local, rien en base. |
| `automatisation/` | Ce que les classes partagent : `passage.py` (le passage d'un compte), `fils.py` (les trois fils), `alarmes.py` (la sortie rouge), `suivi.py` (`fetch_progress`). |

**Le contrat d'un fichier d'API :** `recuperer(acces, fenetre=None, limite=None)
-> (lignes, trous)`. Il **lit et ne touche jamais Supabase** — c'est ce qui
permet à l'essai d'appeler le vrai code sans rien écrire. `trous` est une liste
de messages : une tranche refusée se dit, elle ne disparaît pas. Les rares
fichiers qui lisent ce qu'un autre a nommé (`meta/ads/images.py`,
`instagram/metriques.py`) le disent dans leur docstring.

**L'ordre des appels d'un canal** est écrit dans son `recolte.py`, à côté de la
dépendance qui l'impose. `plan.py` ordonne les canaux, pas les appels.

## Les trois points d'entrée

Ils importent les MÊMES fonctions (`automatisation/passage.py`) ; seule la date
de départ change.

- **`mise_a_jour.py`** — lancé par `.github/workflows/weekly-fetch.yml`
  (`mode: mise_a_jour`, cron 07:00 UTC) : chaque compte dont c'est le Jour de
  travail (`profiles.fetch_schedule`, `_due_today`) reprend là où sa base
  s'arrête moins le recouvrement, puis le rapport est publié et l'email part.
  `--user` (récolte d'amorçage, déclenchée par le web), `--force`,
  `--report-only`.
- **`recolte_complete.py`** — `mode: complete` : un compte (`--user`
  obligatoire), tout l'historique depuis `--depuis` (37 mois par défaut, la
  limite de Meta). Écrit, publie et envoie comme la mise à jour.
- **`essai.py`** — en local seulement, jamais dans le workflow (le dépôt est
  public) : N éléments par API, un JSON, aucune écriture.

Ce qu'une correction de la récolte change ne se voit qu'après un passage du
worker ; ce qu'elle lit, l'essai le montre avant.

## Les quatre plateformes

- **Meta Ads** (`meta/ads/`) — campagnes, dépenses, budgets, créas,
  changements (`activities`, fenêtre 180 jours, un PARI ASSUMÉ faute de limite
  documentée — `_CHANGES_JOURS_META`, `meta/ads/recolte.py`).
- **Instagram organique** (`meta/organique/instagram/`) — posts, métriques,
  abonnés. Même jeton que Meta Ads, API distincte.
- **Google Ads** (`google/ads/`) — campagnes, dépenses, budgets, `change_event`
  (fenêtre **30 jours maximum**, imposée par Google : une fenêtre plus large
  fait rejeter la requête ENTIÈRE, pas juste tronquer).
- **GA4** (`google/analytics/`) — sessions, conversions, revenu, événements,
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
`socle/fenetre.py`. N, avec sa source, à côté de chaque usage :
- Meta : 28 jours (`meta/ads/recolte.py`, `_RECOUVREMENT_JOURS_META`).
- Google Ads : 30 jours (`google/ads/recolte.py`, `_RECOUVREMENT_JOURS_GOOGLE`).
- GA4 : 12 jours (`google/analytics/recolte.py`, `_RECOUVREMENT_JOURS_GA4`).

Les lignes réécrites REMPLACENT les anciennes par upsert — elles ne
s'additionnent pas. C'est aussi ce qui rattrape un trou après une reconnexion.

`automatisation/suivi.py` tient le journal de ce qui a été récolté par canal
(`CANAUX`), lu par `saas/web/app/comptes/page.tsx` pour afficher où en est
chaque compte.

## Ce qui ne se négocie jamais ici (en plus des règles de la racine)

- **Un chiffre non mesuré n'est pas un zéro.** Une plateforme qui ne rend
  rien sur une fenêtre le DIT dans son message de retour — elle ne rend
  jamais silencieusement `0`. (Instagram y manque encore :
  `.scratch/recolte/tickets/10-…`.)
- **Aucun appel HTTP hors de `socle/http.py`**, et aucun sans `timeout`.
- **Aucun fichier d'API n'écrit** : l'écriture vit dans `ecriture/`.
- **`app_secrets.py` (`saas/commun/`) est le seul endroit qui lit les
  credentials.** Aucune clé, jeton ou secret ne se recopie ailleurs — ni en
  dur, ni dans un commentaire, ni un fragment dans un message d'erreur.
- **Chaque plateforme échoue seule.** Une erreur sur un canal n'empêche pas
  les autres de finir (`try/except` par canal dans `automatisation/fils.py`).
