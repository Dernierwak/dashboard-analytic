# CLAUDE.md — saas/emailing/

Ce dossier fait une seule chose : **rendre et envoyer l'email hebdo**
(« L'essentiel » du rapport). Il ne calcule rien lui-même — ni KPI, ni reco —
il reçoit des valeurs déjà prêtes et les met en forme, ou les envoie. Deux
fichiers, deux responsabilités qui ne se mélangent jamais.

Le projet est **Pulse** (voir `CLAUDE.md` à la racine).

## `render.py` — la mise en forme

`build_email_html(account_name, week_label, kpis, wins_text, todos, app_url)`
construit le HTML complet. **Ne dépend QUE de données déjà calculées — pas de
Supabase ici, testable seul.** C'est volontaire : ce fichier ne doit jamais
avoir besoin d'un compte réel ou d'un jeton pour être vérifié.

- `kpis` : `{"spend": "CHF 465", "clicks": "3 342", "ctr": "3.59%", "followers": "+119"}`
- `todos` : `[{"title": "...", "channel": "meta"|"instagram"|"google"|"ia"}, ...]`

Email-safe : tables + styles inline + 600px, pensé pour Gmail / Outlook /
mobile — pas de CSS externe, pas de flexbox/grid (les clients mail ne les
rendent pas de façon fiable). Reprend la même hiérarchie que le rapport web :
Vue d'ensemble (KPI) · Ce qui a marché · À faire cette semaine · lien vers le
détail.

## `send.py` — l'envoi, agnostique du fournisseur

`send_email(to, subject, html) -> {"ok": bool, "provider": str, "detail": str}`.
Le fournisseur se choisit par variable d'environnement, jamais dans le code :

| Variable | Rôle |
|---|---|
| `EMAIL_PROVIDER` | `"resend"` (défaut si une clé est là) ou `"dry"` (log seulement, aucun envoi) |
| `RESEND_API_KEY` | clé Resend |
| `EMAIL_FROM` | adresse expéditrice — sans domaine vérifié chez Resend, seul `onboarding@resend.dev` est accepté (et uniquement vers l'email du compte Resend) |

**Sans clé configurée → mode `dry` automatique.** C'est ce qui permet de
tester tout le flux (recos → email → « envoi ») sans compte ni risque —
voir `saas/collecte/automatisation/run_weekly.py`, qui appelle ce module.

Pour ajouter un fournisseur (Postmark ou autre) : un cas de plus dans
`send_email`, le reste ne bouge pas — c'est explicitement pensé pour.

## Qui appelle ce dossier

Aujourd'hui, uniquement `saas/collecte/automatisation/run_weekly.py`, qui
n'est **pas encore câblé au cron** (voir `saas/README.md`, section « Ce qui
reste à câbler »). Le rapport hebdo publié sur `weekly_reports` par
`saas/traitement/build_report.py` est aujourd'hui lu par `saas/web/`, pas
encore par ce module — l'email et l'écran partagent la même source de
données mais pas encore le même pont.
