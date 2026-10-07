# CLAUDE.md — saas/commun/

Ce n'est pas un domaine métier — c'est la **couche d'accès Supabase et
secrets** que `saas/collecte/` et `saas/traitement/` utilisent tous les deux.
Rien ici ne décide ni ne récolte ; ce dossier lit et écrit, point.

Le projet est **Pulse** (voir `CLAUDE.md` à la racine).

## Fichiers

- **`app_secrets.py`** — `secret("google_ads.developer_token")` résout dans
  l'ordre : variable d'env (`GOOGLE_ADS_DEVELOPER_TOKEN`, cas GitHub Actions)
  puis `.env` **à la racine du dépôt** (gitignoré, cas local) puis un défaut.
  **Seul endroit du produit qui lit un credential** — aucune clé ne se
  recopie ailleurs.
- **`fetch_data.py`** — toutes les lectures Supabase partagées : dernières
  dates par table (pour le recouvrement de `collecte/`) et données pour
  construire le rapport (`traitement/`).
- **`insert_data.py`** — les écritures Supabase qui ne sont pas de la récolte :
  le rapport publié (`upsert_weekly_report`), l'email. Les écritures de la
  récolte vivent dans `saas/collecte/ecriture/`, à côté des fichiers d'API
  qu'elles servent (Meta depuis le ticket 05 de `.scratch/recolte/`, Google
  au ticket 06).

**Il reste ici des fonctions que plus personne n'appelle** — héritage de
l'ancien Streamlit, antérieur au retrait des recommandations. Elles n'ont pas
été touchées : les retirer est un ménage à part, pas un effet de bord.

## Piège déjà payé cher : `_ROOT_ENV` dépend de la profondeur du fichier

`app_secrets.py` calcule la racine du dépôt par
`os.path.dirname(__file__) + "/../.."` — **deux niveaux fixes**. Ce fichier
DOIT rester exactement à `saas/commun/app_secrets.py` (deux dossiers sous la
racine). Le déplacer plus profond (comme il l'a été un instant pendant cette
réorganisation, dans `saas/collecte/commun/`, trois niveaux) le fait pointer
sur `saas/.env` au lieu de `.env` — silencieusement : `_dotenv()` avale
l'erreur (`except OSError: pass`) et `secret()` retombe sur `default`, sans
jamais dire pourquoi un secret présent dans `.env` semble absent. Si ce
fichier bouge encore, recalculer `_ROOT_ENV` et le vérifier avec un chemin
absolu avant de committer — pas en confiance.

## Qui appelle ce dossier

Tout le monde côté Python : `saas/collecte/**`,
`saas/traitement/build_report.py`. Rien dans `saas/web/` (TypeScript, accès
Supabase direct via `@supabase/ssr`) ni `saas/emailing/` (ne touche pas à
Supabase, voir `saas/emailing/CLAUDE.md`) — c'est ici, et pas là-bas, que
vivent `upsert_envoi_email`, `maj_evenement_email` et
`fetch_dernier_envoi_email`, le rangement de ce que l'email hebdo est devenu
(ticket 50).
