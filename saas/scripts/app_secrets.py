"""Accès aux secrets — headless, sans dépendance à une interface.

Ordre de résolution pour secret("google_ads.developer_token") :
  1. variable d'env  GOOGLE_ADS_DEVELOPER_TOKEN  (worker / GitHub Actions)
  2. .env à la racine du dépôt (KEY=VALUE, gitignoré) — worker en local, sans env
  3. default
"""

import functools
import os

_ROOT_ENV = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", ".env")
)


@functools.lru_cache(maxsize=1)
def _dotenv() -> dict:
    out = {}
    try:
        with open(_ROOT_ENV, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                out[key.strip()] = value.strip()
    except OSError:
        pass
    return out


def secret(path: str, default=None):
    """Récupère un secret par chemin pointé (ex. 'google_ads.client_id')."""
    env_key = path.replace(".", "_").upper()
    if os.environ.get(env_key):
        return os.environ[env_key]
    return _dotenv().get(env_key, default)
