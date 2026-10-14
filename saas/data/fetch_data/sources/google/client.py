"""Ce qu'il faut à un fichier d'API Google pour lire."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class AccesGoogle:
    """Le jeton d'accès court (1 h, `auth/oauth.py`), et ce qu'il vise.

    `client` : le customer_id Google Ads ; `propriete` : la propriété GA4 ;
    `login` : le compte gestionnaire (MCC) quand il faut le nommer.
    """
    jeton: str
    client: str | None = None
    propriete: str | None = None
    login: str | None = None
