# CLAUDE.md — saas/commun/

Ce n'est pas un domaine métier — c'est la **couche d'accès Supabase et
secrets** que `saas/collecte/`, `saas/recos_ia/` et `saas/traitement/`
utilisent tous les trois. Rien ici ne décide, ne récolte ni ne recommande ;
ce dossier lit et écrit, point.

Le projet est **Pulse** (voir `CLAUDE.md` à la racine).

## Fichiers

- **`app_secrets.py`** — `secret("google_ads.developer_token")` résout dans
  l'ordre : variable d'env (`GOOGLE_ADS_DEVELOPER_TOKEN`, cas GitHub Actions)
  puis `.env` **à la racine du dépôt** (gitignoré, cas local) puis un défaut.
  **Seul endroit du produit qui lit un credential** — aucune clé ne se
  recopie ailleurs.
- **`fetch_data.py`** — toutes les lectures Supabase partagées (33 fonctions
  au moment où ce fichier est écrit) : dernières dates par table (pour le
  recouvrement de `collecte/`), données pour construire le rapport
  (`traitement/`), commentaires de feedback (`recos_ia/user_persona.py`).
- **`insert_data.py`** — toutes les écritures Supabase partagées (34
  fonctions) : upserts par plateforme, écriture du rapport publié
  (`upsert_weekly_report`), sauvegarde du profil persona.

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

Tout le monde côté Python : `saas/collecte/**`, `saas/recos_ia/**`,
`saas/traitement/build_report.py`. Rien dans `saas/web/` (TypeScript, accès
Supabase direct via `@supabase/ssr`) ni `saas/emailing/` (ne touche pas à
Supabase, voir `saas/emailing/CLAUDE.md`).
