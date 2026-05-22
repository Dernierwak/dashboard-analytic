"""OAuth Google Ads — flow web app.

Étapes :
1. get_oauth_url(state)   → URL d'autorisation Google
2. User clique, autorise, Google redirige avec ?code=...
3. exchange_code(code)    → access_token + refresh_token (long-lived)
4. get_access_token_from_refresh(refresh_token) → access_token court-terme à chaque requête API
"""

from urllib.parse import urlencode
import requests
import streamlit as st


# Scopes requis pour lire les données Google Ads
_GOOGLE_ADS_SCOPES = [
    "https://www.googleapis.com/auth/adwords",
]


def _client_id() -> str:
    return st.secrets.google_ads.client_id


def _client_secret() -> str:
    return st.secrets.google_ads.client_secret


def _redirect_uri() -> str:
    """URL de redirect OAuth. Configurée dans Google Cloud Console + secrets.toml."""
    # Si configuré dans secrets, utiliser cette valeur. Sinon localhost.
    try:
        return st.secrets.google_ads.redirect_uri
    except Exception:
        return "http://localhost:8501"


def get_oauth_url(state: str) -> str:
    """Construit l'URL d'autorisation OAuth Google."""
    params = {
        "client_id":     _client_id(),
        "redirect_uri":  _redirect_uri(),
        "response_type": "code",
        "scope":         " ".join(_GOOGLE_ADS_SCOPES),
        "access_type":   "offline",     # IMPORTANT pour obtenir un refresh_token
        "prompt":        "consent",     # Force le consent (sinon pas de refresh_token au 2e login)
        "state":         state,
    }
    return f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"


def exchange_code(code: str) -> dict:
    """Échange le code OAuth contre access_token + refresh_token.
    Returns: dict avec 'access_token', 'refresh_token', 'expires_in' (sec) ou {'error': ...}
    """
    url = "https://oauth2.googleapis.com/token"
    data = {
        "code":          code,
        "client_id":     _client_id(),
        "client_secret": _client_secret(),
        "redirect_uri":  _redirect_uri(),
        "grant_type":    "authorization_code",
    }
    try:
        r = requests.post(url, data=data, timeout=15)
        return r.json()
    except Exception as e:
        return {"error": str(e)}


def get_access_token_from_refresh(refresh_token: str) -> str | None:
    """Convertit un refresh_token en access_token court-terme (1h).
    À appeler avant chaque batch de requêtes Google Ads API.
    """
    url = "https://oauth2.googleapis.com/token"
    data = {
        "refresh_token": refresh_token,
        "client_id":     _client_id(),
        "client_secret": _client_secret(),
        "grant_type":    "refresh_token",
    }
    try:
        r = requests.post(url, data=data, timeout=15)
        resp = r.json()
        return resp.get("access_token")
    except Exception:
        return None
