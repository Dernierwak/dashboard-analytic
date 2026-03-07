# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Notes de session (18 février 2025)

### Approche pédagogique IMPORTANTE
**L'utilisateur veut apprendre et coder lui-même.** Ne pas écrire le code à sa place.
- Expliquer les concepts
- Poser des questions pour vérifier la compréhension
- Laisser l'utilisateur écrire le code
- Corriger et guider ensuite

### État actuel du projet
- ✅ Landing page déployée (funnel optimisé)
- ✅ GitHub repo: https://github.com/Dernierwak/dashboard-analytic
- ✅ Prêt pour Streamlit Cloud
- ❌ API Instagram : données fictives (à connecter)
- ❌ Stripe : boutons non connectés

### Prochaine étape : API Instagram
L'utilisateur comprend déjà :
- OAuth Meta (code existant dans `meta_script/fetch_token.py`)
- Stockage token dans Supabase (`profiles.meta_token`)
- Flow access/refresh token

**Exercice en cours :**
Écrire la fonction `get_long_lived_token(short_token)` dans `meta_script/fetch_token.py`
- Échanger short-lived token (1h) contre long-lived token (60 jours)
- URL: `https://graph.facebook.com/v24.0/oauth/access_token?grant_type=fb_exchange_token&...`

### Après le long-lived token
1. Appeler l'API Instagram avec le token pour récupérer les vraies données
2. Stocker/afficher dans le dashboard

---

## Project Overview

This is a Streamlit application integrating **Supabase** (authentication + database), **Stripe** (payments with Twint + card), and **Meta/Facebook OAuth** (for ads_management API access).

## Running the Application

```bash
# Main app (default Streamlit)
streamlit run main.py

# Alternative app with Stripe payment integration
streamlit run "streamlit supabase stripe app.py"

# Meta OAuth callback server (for local development with HTTPS)
python meta_script/callback_server.py
```

The app runs on `localhost:8501` by default. Meta OAuth uses `localhost:8502` with HTTPS (cert.pem/key.pem provided).

## Architecture

### Entry Points
- **main.py** - Main dashboard with Supabase auth, data display, and Meta OAuth integration
- **streamlit supabase stripe app.py** - Standalone premium access app with Stripe checkout (Twint/card)

### Modules
- **scripts/** - Supabase data operations
  - `fetch_data.py` - Fetches from `free_data` table
  - `insert_data.py` - Inserts user data to `free_data` table
- **meta_script/** - Meta/Facebook OAuth
  - `fetch_token.py` - OAuth URL builder and token exchange
  - `callback_server.py` - Flask server for OAuth callback redirect

### Configuration
Secrets stored in `.streamlit/secrets.toml`:
- `supabase.url`, `supabase.key` - Supabase credentials
- `stripe.api_key`, `stripe.publishable_key` - Stripe credentials
- `meta.app_id`, `meta.secret_key` - Meta/Facebook app credentials

### Database Tables (Supabase)
- `profiles` - User profiles with `is_paid`, `paid_at`, `meta_token` fields
- `free_data` - User data with `insta_likes`, `user_id` fields
- `paid_data` - Premium content (accessed via RLS)

### Authentication Flow
1. User signs up/logs in via Supabase Auth
2. Session stored in `st.session_state["session"]`
3. Refresh token persisted via `st.query_params["refresh_token"]`
4. Authenticated client uses Bearer token in Authorization header

### Meta OAuth Flow
1. User clicks "Connecter Meta" link to Facebook OAuth
2. Callback redirects to app with `code` parameter
3. Code exchanged for access_token via Graph API
4. Token stored in session and `profiles.meta_token`

## Dependencies

Main packages: `streamlit`, `supabase`, `stripe`, `requests`, `flask` (for callback server), `pandas`
