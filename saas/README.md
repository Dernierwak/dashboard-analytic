# saas/ — le produit (Next.js + worker headless)

Ce dossier porte **Pulse** : `web/` (le portail Next.js, déployé sur Vercel) et
`worker/` (récolte + rapport, lancé par GitHub Actions). L'ancien Streamlit a
été retiré (voir `STREAMLIT_REMOVAL.md` à la racine) — les accès aux API des
plateformes (`meta_script/`, `google_script/`, `scripts/`) vivent maintenant
sous `saas/`, appelés par le worker.

## ⚡ Fetch automatique (le « ça marche sans moi ») — FAIT

`saas/worker/fetch_all.py` récolte **Meta Ads + Google Ads + GA4 + Instagram**
pour tous les comptes, **sans personne connecté**. Réutilise la logique de fetch
headless de `saas/meta_script/`, `saas/google_script/` et `saas/scripts/`
(`saas/scripts/app_secrets.py` pour les credentials, sans dépendance à une
interface).

**Tester en local** (⚠ écrit dans la vraie base) :
```bash
# .env local (ou variables d'environnement) suffit pour Supabase + Google ; --force ignore le jour planifié
python saas/worker/fetch_all.py --force
```

**Activer l'automatisation (GitHub Actions)** — `.github/workflows/weekly-fetch.yml`
tourne chaque jour à 07:00 UTC et ne traite que les users dont c'est le jour
(`profiles.fetch_schedule`, défaut lundi). À configurer dans **Settings → Secrets and
variables → Actions** du repo :

| Secret GitHub | Valeur |
|---|---|
| `SUPABASE_URL` | URL du projet Supabase |
| `SUPABASE_SERVICE_KEY` | clé **service_role** (bypass RLS) |
| `GOOGLE_ADS_CLIENT_ID` / `GOOGLE_ADS_CLIENT_SECRET` | OAuth Google |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | developer token Google Ads |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | (optionnel) ID MCC |

Meta Ads + Instagram n'ont besoin d'aucun secret app (token utilisateur en base).

## Ce qu'on construit (roadmap)

| Phase | Quoi | Statut |
|-------|------|--------|
| 1 | Worker cron : fetch auto + **rapport précalculé** (`worker/build_report.py` → table `weekly_reports`) | ✅ câblé au cron quotidien |
| 2 | **Email hebdo** responsive — lit le même payload `weekly_reports` | 🟡 rendu OK, envoi à brancher |
| 3 | Portail **Next.js** (Vercel) : `web/` = **Pulse** | ✅ en prod (auth, KPIs, conseils, réactions) |

## Structure

```
saas/
├── core/        moteur de recos (reco_engine.py), ga4.py, user_persona.py — headless
├── emailing/    render.py (email « L'essentiel ») + send.py (envoi)
└── worker/      fetch_all.py (récolte cron) + build_report.py (rapport)
                 + run_weekly.py (démo recos → email → envoi, pas encore câblé au cron)
```

## Tester l'email de démo (sans compte, sans risque)

`worker/run_weekly.py::run()` (chargement multi-users) n'est pas câblé — voir
« Ce qui reste à câbler » plus bas. Son `__main__` reste utile pour prévisualiser
le rendu email sur un utilisateur fictif :

```bash
cd saas
pip install -r requirements.txt
python worker/run_weekly.py
```

- Sans clé d'email configurée → **mode `dry-run`** : rien n'est envoyé, mais
  un aperçu est écrit dans `saas/worker/_preview.html`. Ouvre-le dans un navigateur
  pour voir l'email (teste-le aussi en réduisant la fenêtre = vue mobile).

## Brancher l'envoi réel (Resend)

Resend = service qui envoie les emails de façon fiable (pas de spam). Gratuit
jusqu'à 3 000 mails/mois. Une fois le compte créé + le domaine connecté :

```bash
export EMAIL_PROVIDER=resend
export RESEND_API_KEY=re_xxxxxxxx
export EMAIL_FROM="rapport@ton-domaine.ch"
python worker/run_weekly.py
```

`send.py` est **agnostique** : pour passer à Postmark ou autre, on ajoute un cas,
le reste ne bouge pas.

## Ce qui reste à câbler (Phase 1)

- `worker/run()` : lister les users Supabase (service key) + charger leurs données
  (réutiliser les requêtes de `../scripts/fetch_data.py`) puis appeler `weekly_for_user`.
- Brancher `run()` sur un cron (Railway cron / Supabase scheduled / GitHub Actions), lundi 07:00.
- Optionnel : remplacer `build_wins_text` (déterministe) par l'IA, comme dans `worker/build_report.py` (`_call_gemini`).

## Variables d'environnement

| Variable | Rôle |
|----------|------|
| `EMAIL_PROVIDER` | `resend` ou `dry` (défaut : auto selon présence de la clé) |
| `RESEND_API_KEY` | clé Resend |
| `EMAIL_FROM` | adresse expéditrice (ton domaine) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | pour le worker (Phase 1) |
