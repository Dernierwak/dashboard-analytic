"""Accès aux secrets — headless, sans dépendance à une interface.

Ordre de résolution pour secret("google_ads.developer_token") :
  1. variable d'env  GOOGLE_ADS_DEVELOPER_TOKEN  (worker / GitHub Actions)
  2. .streamlit/secrets.toml  /  ~/.streamlit/secrets.toml  (worker en local, sans env)
  3. default
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

    # 2) lecture directe du secrets.toml (worker en local, sans env)
    cur = _toml_secrets()
    for part in parts:
        if isinstance(cur, dict) and part in cur:
            cur = cur[part]
        else:
            return default
    return cur
