# CLAUDE.md — saas/emailing/

Ce dossier fait une seule chose : **l'email hebdo** (« L'essentiel » du
rapport). Il ne calcule rien lui-même — il reçoit des valeurs déjà prêtes et
les met en forme, les envoie, ou relit ce qu'elles sont devenues.

**L'EMAIL S'EST ALLÉGÉ** avec le retrait des recommandations (2026-09-21) : la
liste « À faire cette semaine » et le brief rédigé par Gemini ont disparu. Il
porte les trois chiffres de la semaine, le verdict déterministe et l'alerte du
canal muet.
Trois fichiers, trois responsabilités qui ne se mélangent jamais. **Aucun des
trois ne touche Supabase** — ranger un fait est le travail de `saas/commun/`.

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

`send_email(to, subject, html) -> {"ok": bool, "provider": str, "detail": str, "id": str | None}`.
Le fournisseur se choisit par variable d'environnement, jamais dans le code :

| Variable | Rôle |
|---|---|
| `EMAIL_PROVIDER` | `"resend"` (défaut si une clé est là) ou `"dry"` (log seulement, aucun envoi) |
| `RESEND_API_KEY` | clé Resend |
| `EMAIL_FROM` | adresse expéditrice — sans domaine vérifié chez Resend, seul `onboarding@resend.dev` est accepté (et uniquement vers l'email du compte Resend) |

`send_email` rend aussi **`id`**, l'identifiant du fournisseur, à part de
`detail` : c'est le seul moyen de lui redemander plus tard ce que l'email est
devenu (voir `evenements.py`). `None` quand il n'y a rien à relire — dry-run,
ou envoi en échec.

**Sans clé configurée → mode `dry` automatique.** C'est ce qui permet de
tester tout le flux (rapport → email → « envoi ») sans compte ni risque —
le mode `dry` range quand même sa ligne dans `email_envois`, en disant que rien
n'est parti.

Pour ajouter un fournisseur (Postmark ou autre) : un cas de plus dans
`send_email`, le reste ne bouge pas — c'est explicitement pensé pour.

## `evenements.py` — ce qu'est devenu un email déjà envoyé

`etat_email(message_id)` redemande à Resend son `last_event` ; `etat_ouverture`
et `phrase_ouverture` le traduisent. **Pas de Supabase ici non plus** : ranger
le fait est le travail de `saas/commun/` (`email_envois`), le composer celui de
`saas/collecte/automatisation/passage.py`, qui relève au passage suivant du worker (règles pures : `releve.py`) — par l'API, pas par
webhook (ticket 50, `docs/adr/0007-…`).

**Ce vocabulaire n'a aucune valeur « pas ouvert », et c'est le point.** Une
ouverture est un pixel chargé : bloqué chez Gmail et Outlook, préchargé par un
volet de prévisualisation, et chez Resend **désactivé par défaut** tant qu'aucun
domaine n'est vérifié. Il dit donc `sans_reponse` (« le fournisseur n'a rien
remonté »), `en_route` (« l'envoi n'est pas terminé ») ou `inconnu` (« rien
d'exploitable ») — jamais « il n'a pas ouvert ».

`clique`, `signale_spam` et `pas_arrive`, eux, sont des **faits**, et
`ETATS_DEFINITIFS` dit lesquels arrêtent le relevé. Une plainte pour spam prouve
que l'email est **arrivé et regardé** : elle ne se range surtout pas avec les
rebonds. `FOURNISSEURS_RELISIBLES` dit ce qu'on sait interroger — aujourd'hui
Resend seul. Voir `docs/mesures-impossibles.md`.

## `releve.py` — quand relever, et comment le dire

`a_relever(envoi, maintenant)` et `mot_du_releve(envoi, evenement)` : les règles
PURES du relevé (ticket 50) — un silence n'est pas une réponse définitive, on ne
relit pas un email parti il y a une heure. Pas de Supabase non plus : lire la
ligne d'envoi et ranger le fait, c'est `relever_ouverture` dans
`saas/collecte/automatisation/passage.py`. Ces fonctions vivaient dans
`fetch_all.py` jusqu'au ticket 07 de `.scratch/recolte/`.

## Qui appelle ce dossier

`saas/traitement/build_report.py` (`publish_weekly_report`) est le **seul
chemin d'envoi**, et il l'est désormais sans concurrent : c'est lui que le cron
atteint, via `saas/collecte/automatisation/passage.py`, et lui qui range l'envoi dans `email_envois`.
`run_weekly.py`, qui appelait aussi `send_email` sans qu'aucun workflow ne
l'atteigne, est parti avec les recommandations (voir `saas/README.md`, section « Ce qui
reste à câbler »).

**L'email et l'écran lisent le MÊME payload** : `publish_weekly_report` passe à
`email_from_payload` exactement ce qu'il vient d'écrire sur `weekly_reports`.
Une seule source de vérité, donc aucun chiffre ne peut différer entre les deux.
