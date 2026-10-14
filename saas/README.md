# saas/ — le produit (Next.js + pipeline de données headless)

Ce dossier porte **Pulse** : `web/` (le portail Next.js, déployé sur Vercel),
`data/fetch_data/` (récupération auprès des plateformes), `data/supabase/`
(envoi, contrôle du prochain fetch et préparation du rapport) et `config/`
(secrets). L'ancien Streamlit a été retiré (voir
`STREAMLIT_REMOVAL.md` à la racine).

**`recos_ia/` N'EXISTE PLUS** (2026-09-21). Le moteur de recommandations, les
règles payantes, les constats, la labellisation IA, la catégorisation IA, le
persona et la mémoire de thème ont été retirés du produit. Pulse constate, il
ne conseille pas, et plus aucun appel à un modèle de langage n'y subsiste.

## ⚡ Fetch automatique (le « ça marche sans moi ») — FAIT

`saas/data/fetch_data/cockpit/scheduled_update.py` récolte **Meta Ads + Google Ads + GA4 +
Instagram** pour tous les comptes, **sans personne connecté**. Réutilise la
logique de fetch par canal de `saas/data/fetch_data/sources/meta/` (`ads/`, `instagram/`),
`saas/data/fetch_data/sources/google/` (`ads/`, `analytics/`) et les modules
transverses `saas/data/supabase/` et `saas/config/secrets.py`.

**Vérifier sans rien écrire** : `python3.12 saas/data/fetch_data/cockpit/check_data_collection.py --user <uuid> -n 5`
(un JSON local, aucune écriture). **Lancer pour de vrai** (⚠ écrit dans la vraie
base) :
```bash
# .env local (ou variables d'environnement) suffit pour Supabase + Google ; --force ignore le jour planifié
python3.12 saas/data/fetch_data/cockpit/scheduled_update.py --force
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
| 1 | Cron : fetch auto (`data/fetch_data/`) + **rapport précalculé** (`data/supabase/processed_data/weekly_report/builder.py` → table `weekly_reports`) | ✅ câblé au cron quotidien |
| 2 | Portail **Next.js** (Vercel) : `web/` = **Pulse** | ✅ en prod (auth, dashboards, rapport hebdo) |

## Structure

```
saas/
├── data/
│   ├── fetch_data/       sources externes, orchestration et cockpit des commandes
│   └── supabase/
│       ├── source_data/       enregistre les données sources normalisées
│       ├── fetch_state/       reprend sans perte et journalise le passage
│       └── processed_data/    construit les résultats, dont `weekly_report/`
├── config/               secrets.py — seul lecteur de credentials
└── web/                  portail Next.js
```

## Variables d'environnement

| Variable | Rôle |
|----------|------|
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | pour la récolte (Phase 1) |
