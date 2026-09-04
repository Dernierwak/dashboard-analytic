# Setup Google Ads API

Procédure pour activer l'intégration Google Ads dans Pulse.

## 1. Compte Google Ads
Tu dois avoir accès à un compte Google Ads (perso ou client). Si client : demande accès en lecture via leur compte Manager (MCC).

## 2. Developer Token (le plus long : 24-48h)
1. Connecte-toi sur https://ads.google.com/
2. **Tools & Settings → Setup → API Center** (`Tools → Configuration → API Center` en FR)
3. Demande un Developer Token. Au début il est en mode **Test** (10 requêtes/jour).
4. Pour passer en **Standard access** (production), remplis le formulaire avec :
   - Description : "Pulse — lecture seule des insights Google Ads pour clients d'agence"
   - URL de l'app : ton URL Vercel (`saas/web`)
   - Type d'accès : `Read-only` (Basic)
5. Google répond en 24-48h. Copie le token (string ~22 caractères).

## 3. Google Cloud Console — OAuth credentials
1. https://console.cloud.google.com/ → crée un projet (ou utilise un existant)
2. **APIs & Services → Library** → cherche **"Google Ads API"** → **Enable**
3. **APIs & Services → OAuth consent screen** :
   - User type : **External**
   - Nom de l'app, email de support, scopes Google Ads (`/auth/adwords`)
   - Test users : ajoute ton email
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Type : **Web application**
   - Authorized redirect URIs :
     - `http://localhost:3000/api/oauth/google/callback` (dev)
     - `https://<ton-app>.vercel.app/api/oauth/google/callback` (prod)
5. Copie le **Client ID** + **Client Secret**

## 4. Manager Account (MCC) — optionnel
Si tu utilises un compte Manager pour gérer plusieurs clients :
- Tu auras besoin du `login_customer_id` (le numéro à 10 chiffres du MCC, sans tirets)
- Si pas de MCC, laisse vide

## 5. Configuration des identifiants — deux endroits distincts

L'OAuth (connexion d'un client depuis Pulse) et la récolte cron (GitHub Actions)
lisent des variables différentes, même si elles pointent vers le même projet
Google Cloud :

**Vercel** (`saas/web`, variables d'environnement du projet) — utilisées par
l'échange OAuth (`app/api/oauth/google/*`) :
```
GOOGLE_CLIENT_ID=xxxxxxxxxxxx-xxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx
```

**GitHub Actions** (secrets du repo, lus par `.github/workflows/weekly-fetch.yml`)
— utilisées par `saas/worker/fetch_all.py` pour la récolte :
```
GOOGLE_ADS_CLIENT_ID=xxxxxxxxxxxx-xxxxxxx.apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx
GOOGLE_ADS_DEVELOPER_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxx
GOOGLE_ADS_LOGIN_CUSTOMER_ID=1234567890   # MCC ID (sans tirets). Optionnel.
```
En local (worker lancé à la main), `saas/scripts/app_secrets.py` retombe sur
le `.env` à la racine (gitignoré) si les variables d'env sont absentes.

## 6. Migration SQL Supabase

Dans Supabase Dashboard → SQL Editor, exécute le contenu de :
```
supabase/migrations/000_run_me_all.sql
```
C'est le fichier unique et rejouable qui installe tout le schéma, y compris
les tables Google Ads (`google_ads_insights`, `google_campaign_config`,
`profiles.google_refresh_token`, `profiles.google_customer_id`) et leurs
policies RLS.

## 7. Test

1. Ouvre Pulse (`saas/web`, déployé sur Vercel)
2. Va sur **Comptes**
3. Tu dois voir la carte "Connecter Google"
4. Clique, autorise → tu reviens sur l'app
5. Sélectionne ton compte Google Ads dans la liste (`choisirCompteGoogle`)
6. Confirme → la connexion est enregistrée ; la récolte suit au prochain
   passage cron (ou via le bouton « Mes données », qui déclenche le worker)

## Troubleshooting

- **"Le developer token est en mode test"** : tu n'as accès qu'à 10 requêtes/jour. Demande le passage en Standard.
- **"User does not have access to customer"** : ton compte Google n'a pas accès à ce customer_id. Demande à l'admin du compte Google Ads de t'ajouter.
- **"OAuth flow not redirecting back"** : vérifie que l'URI de redirection configurée dans Google Cloud Console correspond EXACTEMENT à `https://<ton-app>.vercel.app/api/oauth/google/callback` (HTTPS, pas de slash de fin en trop).
- **Pas de `refresh_token` dans la réponse** : Google ne renvoie le refresh_token qu'au **premier consentement**. Si déjà connecté, va sur https://myaccount.google.com/permissions, révoque l'accès, puis reconnecte-toi.
