# Setup Google Ads API

Procédure pour activer l'intégration Google Ads dans le dashboard.

## 1. Compte Google Ads
Tu dois avoir accès à un compte Google Ads (perso ou client). Si client : demande accès en lecture via leur compte Manager (MCC).

## 2. Developer Token (le plus long : 24-48h)
1. Connecte-toi sur https://ads.google.com/
2. **Tools & Settings → Setup → API Center** (`Tools → Configuration → API Center` en FR)
3. Demande un Developer Token. Au début il est en mode **Test** (10 requêtes/jour).
4. Pour passer en **Standard access** (production), remplis le formulaire avec :
   - Description : "Dashboard Analytics — lecture seule des insights Google Ads pour clients d'agence"
   - URL de l'app : ton URL Streamlit Cloud
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
     - `http://localhost:8501` (dev)
     - `https://ton-app.streamlit.app` (prod)
5. Copie le **Client ID** + **Client Secret**

## 4. Manager Account (MCC) — optionnel
Si tu utilises un compte Manager pour gérer plusieurs clients :
- Tu auras besoin du `login_customer_id` (le numéro à 10 chiffres du MCC, sans tirets)
- Si pas de MCC, laisse vide

## 5. Configuration `.streamlit/secrets.toml`

Ajoute cette section :

```toml
[google_ads]
developer_token = "xxxxxxxxxxxxxxxxxxxxxxxx"
client_id = "xxxxxxxxxxxx-xxxxxxx.apps.googleusercontent.com"
client_secret = "GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx"
login_customer_id = "1234567890"  # MCC ID (sans tirets). Optionnel.
redirect_uri = "https://ton-app.streamlit.app"  # ou http://localhost:8501 en dev
```

## 6. Migration SQL Supabase

Dans Supabase Dashboard → SQL Editor, exécute le contenu de :
```
supabase/migrations/google_ads.sql
```

Cette migration crée :
- Table `google_ads_insights` (1 ligne par campagne × jour)
- Table `google_campaign_config` (label + budget + statut par campagne)
- Colonnes `profiles.google_refresh_token` et `profiles.google_customer_id`
- RLS policies

## 7. Test

1. Lance Streamlit
2. Va sur **Paramètres → Google Ads**
3. Tu dois voir la card "Connecter avec Google"
4. Clique, autorise → tu reviens sur l'app
5. Sélectionne ton compte Google Ads dans la liste
6. Confirme → auto-fetch se lance, tu atterris sur la page Google Ads avec tes données

## Troubleshooting

- **"Le developer token est en mode test"** : tu n'as accès qu'à 10 requêtes/jour. Demande le passage en Standard.
- **"User does not have access to customer"** : ton compte Google n'a pas accès à ce customer_id. Demande à l'admin du compte Google Ads de t'ajouter.
- **"OAuth flow not redirecting back"** : vérifie que le `redirect_uri` dans secrets.toml correspond EXACTEMENT à celui configuré dans Google Cloud Console (HTTPS, slash de fin, etc.)
- **Pas de `refresh_token` dans la réponse** : Google ne renvoie le refresh_token qu'au **premier consentement**. Si déjà connecté, va sur https://myaccount.google.com/permissions, révoque l'accès, puis reconnecte-toi.
