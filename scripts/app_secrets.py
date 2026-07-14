"""Accès aux secrets — fonctionne AVEC ou SANS Streamlit.

But : permettre au worker headless (cron) de lire les mêmes credentials que l'app,
sans dépendre de st.secrets / d'un ScriptRunContext Streamlit.

Ordre de résolution pour secret("google_ads.developer_token") :
  1. variable d'env  GOOGLE_ADS_DEVELOPER_TOKEN  (worker / GitHub Actions)
  2. st.secrets       (l'app Streamlit — robuste, comme avant)
  3. .streamlit/secrets.toml  /  ~/.streamlit/secrets.toml  (worker sans env)
  4. default
"""

import os
import functools

try:
    import tomllib  # Python 3.11+
except ModuleNotFoundError:  # pragma: no cover
    tomllib = None


@functools.lru_cache(maxsize=1)
def _toml_secrets() -> dict:
    paths = [
        os.path.join(".streamlit", "secrets.toml"),
        os.path.expanduser("~/.streamlit/secrets.toml"),
    ]
    for p in paths:
        try:
            if tomllib and os.path.exists(p):
                with open(p, "rb") as f:
                    return tomllib.load(f)
        except Exception:
            continue
    return {}


def secret(path: str, default=None):
    """Récupère un secret par chemin pointé (ex. 'google_ads.client_id')."""
    parts = path.split(".")

    # 1) variable d'environnement (GOOGLE_ADS_CLIENT_ID) — worker / CI
    env_key = path.replace(".", "_").upper()
    if os.environ.get(env_key):
        return os.environ[env_key]

    # 2) st.secrets — robuste dans l'app Streamlit (toute version Python).
    #    Hors Streamlit / sans secrets.toml, ça lève → on tombe sur le TOML.
    try:
        import streamlit as st  # import local : le worker n'en dépend pas
        cur = st.secrets
        for part in parts:
            cur = cur[part]
        if cur is not None:
            return cur
    except Exception:
        pass

    # 3) lecture directe du secrets.toml (worker headless sans env)
    cur = _toml_secrets()
    for part in parts:
        if isinstance(cur, dict) and part in cur:
            cur = cur[part]
        else:
            return default
    return cur
