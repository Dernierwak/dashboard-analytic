# 07: Le plan, et les trois classes

Type: task
Status: resolved
Blocked by: 06

**What to build:** `fetch_all.py` disparaît au profit de :

- `plan.py` — l'ORDRE des appels par plateforme (les statuts Google avant
  `change_event`, qui a besoin des noms ; la hiérarchie Meta avant les
  activités), et le choix des plateformes à récolter selon
  `connected_accounts` et l'état du jeton (ticket 03). Pur, sans réseau.
- `class MiseAJour` (`mise_a_jour.py`) — le cron : recouvrement seulement,
  jour de travail du compte (`_due_today`), rapport + email à la fin.
- `class RecolteComplete` (`recolte_complete.py`) — tout l'historique que la
  plateforme permet, un compte (`--user` obligatoire). Remplace `--meta-since`.
- Les deux classes **importent** les fichiers d'API et `plan.py` ; aucune ne
  contient un appel HTTP. Ce qui les distingue : la fenêtre, et ce qu'elles
  font en fin de course.
- `alarmes.py` (canaux qui durent, écritures sautées, sortie rouge) ; le relevé
  des ouvertures d'email part dans `saas/emailing/`.
- `weekly-fetch.yml` : une entrée `mode` (`mise_a_jour` / `complete` /
  `essai`) à la place de `meta_since`. Entrées toujours passées par
  l'environnement, jamais interpolées.

À trancher ici : la récolte complète peut dépasser une heure — doit-elle
reprendre là où elle s'est arrêtée ?

- [x] Harnais hors ligne de `plan.py` : Meta sans Instagram, Google sans GA4,
      jeton mort, aucune connexion
- [x] `python3.12 -m py_compile` — [ ] **Essai (ticket 08)** sur un vrai compte, puis `mise_a_jour` et
      `complete` sur un compte : même journal qu'avant

## Comment

**2026-10-07 — construit et vérifié hors ligne. L'Essai (08), puis un passage
`mise_a_jour` et un `complete` sur un compte, restent à faire.**

`automatisation/fetch_all.py` n'existe plus. À sa place :
```
saas/collecte/plan.py                 Tache, Plan, planifier(connexions) — pur
saas/collecte/mise_a_jour.py          class MiseAJour + _due_today + argparse
saas/collecte/recolte_complete.py     class RecolteComplete + argparse
saas/collecte/automatisation/passage.py  passer(sb, uid, depuis), republier(),
                                      relever_ouverture(), connexions()…
saas/collecte/automatisation/fils.py  le pavé « LA RÉCOLTE EN PARALLÈLE »,
                                      client_service(), _fil(), executer()
saas/collecte/automatisation/alarmes.py  écritures sautées, canaux qui durent,
                                      ouvertures, signaler() → rouge ou non
saas/emailing/releve.py               a_relever, mot_du_releve (règles pures)
```
Les deux classes IMPORTENT `passage.passer` ; la seule différence est
`depuis` (None : reprise moins le recouvrement ; une date : tout depuis elle).
Aucune ne contient d'appel HTTP (vérifié par l'AST dans le harnais).

Décisions prises en chemin :
- **La récolte complète ne reprend pas là où elle s'est arrêtée.** Toutes les
  écritures sont des upserts sur la clé de chaque table : relancer la même
  commande réécrit les mêmes lignes, sans doublon. Un état « fait jusqu'au … »
  coûterait une table et un cas à vérifier pour un gain que le décompte ne
  justifie pas (37 mois de régies ≈ 65 requêtes, quelques minutes —
  `socle/fenetre.py`, PROFONDEUR D'HISTORIQUE ; le poste long est Instagram,
  qui ne dépend pas de `--depuis`). Écrit en tête de `recolte_complete.py`.
- **`depuis` par défaut = 37 mois pour toutes les plateformes.** C'est la
  limite DOCUMENTÉE de Meta ; Google Ads n'en documente aucune et GA4 n'a pas
  été essayé au-delà — une tranche refusée y devient un trou nommé.
- **`depuis` ne touche pas les journaux de changements** : `change_event`
  garde 30 jours (une fenêtre plus large fait rejeter la requête entière),
  `/activities` garde 180 jours.
- **La récolte complète publie le rapport et envoie l'email**, comme le
  faisait `--meta-since` : aucun comportement ne change là.
- **L'essai n'est PAS un mode du workflow.** Il écrit un JSON de données
  client : sur le runner il meurt avec la machine, et l'artefact serait lisible
  par quiconque lit ce dépôt public. Il se lance en local. Le workflow a deux
  modes : `mise_a_jour` (défaut — le web n'envoie que `user_id`, rien ne
  change pour lui) et `complete` (+ `depuis`, à la place de `meta_since`).
- **Le relevé d'email ne part pas entièrement dans `saas/emailing/`.**
  `saas/emailing/` a une règle : aucun de ses fichiers ne touche Supabase. Les
  règles pures (`a_relever`, `mot_du_releve`) y vont (`releve.py`) ; la
  composition qui lit et écrit (`relever_ouverture`) reste dans l'orchestrateur
  (`passage.py`), comme l'écrivait déjà `evenements.py`.
- `_due_today` garde son nom : le web le cite dans huit commentaires.

Vérifié :
- `py_compile` sur `saas/collecte`, `saas/commun`, `saas/traitement`,
  `saas/emailing` ; `pyflakes` sans remarque ; les deux points d'entrée
  s'importent ; `.github/workflows/weekly-fetch.yml` se lit (YAML valide,
  entrées `mode, force, user_id, report_only, depuis`).
- `harnais/07_classes.py` → `TOUT VERT` : `planifier` (deux plateformes, Meta
  sans Instagram, Google sans GA4, jeton Google mort, aucune connexion, deux
  comptes Meta dédoublonnés) avec les raisons de saut recopiées mot pour mot ;
  `MiseAJour` contre une fausse base (seul le compte dont c'est le jour passe,
  aucun départ forcé, rapport + email, journal dans l'ordre de `CANAUX`, canal
  muet depuis 3 rapports → sortie 1) ; `--user`, `--report-only` (rien
  récolté, pas d'email) ; `RecolteComplete` (`--depuis` atteint Meta, Google et
  GA4, pas Instagram ; défaut 1126 jours) ; `--user ""` et `--depuis` hors
  limite refusés avant tout appel.
- `01`, `02`, `05`, `06` → `TOUT VERT` ; meta-ads 04/05/13 → 60 passed.

Pas fait — hors de mon périmètre (`saas/web/`) : `fetch_all.py` est cité dans
`saas/web/app/actions-compte.ts`, `components/channel-dash.tsx` l. 809,
`components/jour-recolte.tsx` l. 8, `lib/jour-de-travail.ts` l. 21,
`lib/report.ts` l. 297 (commentaires) — le chemin est désormais
`saas/collecte/mise_a_jour.py`.

Pas vérifié : un vrai passage. Après le merge, un `mode: mise_a_jour` avec
`user_id` puis un `mode: complete` sur le même compte doivent rendre le même
journal qu'avant — après l'Essai.
