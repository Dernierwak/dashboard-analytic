# saas/ — le produit (Next.js + collecte/traitement headless)

Ce dossier porte **Pulse** : `web/` (le portail Next.js, déployé sur Vercel),
`collecte/` (récolte brute par plateforme, lancée par GitHub Actions),
`traitement/` (assemble et publie le rapport depuis ce que `collecte/` a
récolté), `commun/` (lecture/écriture Supabase + secrets, utilisé par les deux)
et `emailing/` (email hebdo). L'ancien Streamlit a été retiré (voir
`STREAMLIT_REMOVAL.md` à la racine).

**`recos_ia/` N'EXISTE PLUS** (2026-09-21). Le moteur de recommandations, les
règles payantes, les constats, la labellisation IA, la catégorisation IA, le
persona et la mémoire de thème ont été retirés du produit. Pulse constate, il
ne conseille pas, et plus aucun appel à un modèle de langage n'y subsiste.

## ⚡ Fetch automatique (le « ça marche sans moi ») — FAIT

`saas/collecte/mise_a_jour.py` récolte **Meta Ads + Google Ads + GA4 +
Instagram** pour tous les comptes, **sans personne connecté**. Réutilise la
logique de fetch par canal de `saas/collecte/meta/` (`ads/`, `organique/instagram/`),
`saas/collecte/google/` (`ads/`, `analytics/`) et les utilitaires transverses de `saas/commun/`
(`app_secrets.py` pour les credentials, sans dépendance à une interface).

**Vérifier sans rien écrire** : `python3.12 saas/collecte/essai.py --user <uuid> -n 5`
(un JSON local, aucune écriture). **Lancer pour de vrai** (⚠ écrit dans la vraie
base et envoie l'email) :
```bash
# .env local (ou variables d'environnement) suffit pour Supabase + Google ; --force ignore le jour planifié
python3.12 saas/collecte/mise_a_jour.py --force
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
| 1 | Cron : fetch auto (`collecte/`) + **rapport précalculé** (`traitement/build_report.py` → table `weekly_reports`) | ✅ câblé au cron quotidien |
| 2 | **Email hebdo** responsive — lit le même payload `weekly_reports` | 🟡 rendu OK, envoi à brancher |
| 3 | Portail **Next.js** (Vercel) : `web/` = **Pulse** | ✅ en prod (auth, dashboards, rapport hebdo) |

## Structure

```
saas/
├── collecte/            récolte brute, rien d'autre — voir collecte/CLAUDE.md
│   ├── socle/            http.py (timeout, réessais 429), fenetre.py (tranches, reprise)
│   ├── meta/             graph.py, ads/ (un fichier par API), organique/instagram/
│   ├── ecriture/         meta.py, google.py, plateformes.py (tout ce qui écrit)
│   ├── google/           acces.py, auth/oauth.py, ads/ et analytics/ (GA4) — un fichier par API
│   ├── plan.py           quels canaux tournent, dans quel fil
│   ├── mise_a_jour.py    class MiseAJour (le cron) · recolte_complete.py · essai.py
│   └── automatisation/   passage.py, fils.py, alarmes.py, suivi.py (ce que les classes partagent)
├── traitement/           assemble et publie le rapport depuis collecte/ — voir traitement/CLAUDE.md
│   build_report.py, lecteur.py (le seam hors ligne), matrice.py (full-history), ga4_contexte.py
├── commun/               lecture/écriture Supabase + secrets, utilisé par les 2 domaines ci-dessus — voir commun/CLAUDE.md
│   app_secrets.py, fetch_data.py, insert_data.py
├── emailing/             render.py (email « L'essentiel ») + send.py (envoi) — voir emailing/CLAUDE.md
└── web/                  portail Next.js — voir web/CLAUDE.md
```

## Prévisualiser l'email

`run_weekly.py`, la démo bout-en-bout qui servait à ça, est partie avec les
recommandations : elle n'était câblée à aucun cron et son `run()` levait
`NotImplementedError`. Le seul chemin d'envoi est désormais
`traitement/build_report.py::publish_weekly_report`, atteint par `saas/collecte/automatisation/passage.py`.

Sans `RESEND_API_KEY`, `send.py` passe en **mode `dry`** : rien ne part, et la
ligne est quand même rangée dans `email_envois` en disant que rien n'est parti.

## Brancher l'envoi réel (Resend)

Resend = service qui envoie les emails de façon fiable (pas de spam). Gratuit
jusqu'à 3 000 mails/mois. Une fois le compte créé + le domaine connecté :

```bash
export EMAIL_PROVIDER=resend
export RESEND_API_KEY=re_xxxxxxxx
export EMAIL_FROM="rapport@ton-domaine.ch"
```

`send.py` est **agnostique** : pour passer à Postmark ou autre, on ajoute un cas,
le reste ne bouge pas.

## Variables d'environnement

| Variable | Rôle |
|----------|------|
| `EMAIL_PROVIDER` | `resend` ou `dry` (défaut : auto selon présence de la clé) |
| `RESEND_API_KEY` | clé Resend |
| `EMAIL_FROM` | adresse expéditrice (ton domaine) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | pour la récolte (Phase 1) |
