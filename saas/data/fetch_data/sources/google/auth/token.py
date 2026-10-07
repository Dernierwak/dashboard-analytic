"""Le refresh token Google rend-il encore un jeton d'accès ?

Le worker renouvelle seul le jeton d'accès (une heure) à partir du refresh
token. Ce qu'il ne peut pas faire, c'est remplacer un refresh token mort : il
faut que le client se reconnecte. La doc Google dit ce qui le tue — accès
révoqué, six mois sans usage, trop de jetons vivants, accès limité dans le
temps échu, politique d'administrateur — et que le projet en statut
« Testing » délivre des refresh tokens qui expirent en 7 jours. Dans tous ces
cas, « the call will fail with an error type `invalid_grant` ».
https://developers.google.com/identity/protocols/oauth2 (« Refresh token
expiration »)

Une panne réseau, un 5xx ou un identifiant client absent de NOTRE côté ne sont
pas un jeton mort : ils rendent INCONNU et ne marquent rien.
"""
from __future__ import annotations

import requests

from saas.config.secrets import secret
from saas.data.fetch_data.shared.token_status import TokenStatus, INCONNU, MORT, VALIDE

_TOKEN_URL = "https://oauth2.googleapis.com/token"

# Les deux erreurs qui demandent le client. `admin_policy_enforced` est rendue
# quand un administrateur Workspace a restreint les services des scopes
# demandés — même doc, même remède : se reconnecter (ou faire lever la règle).
_ERREURS_DU_CLIENT = {"invalid_grant", "admin_policy_enforced"}


def verifier(refresh_token: str | None) -> tuple[TokenStatus, str | None]:
    """Rend (état, jeton d'accès) — le jeton d'accès sert à la récolte qui suit,
    pour ne pas le redemander une seconde fois."""
    if not refresh_token:
        return TokenStatus(MORT, "aucun jeton Google enregistré"), None
    client_id = secret("google_ads.client_id")
    client_secret = secret("google_ads.client_secret")
    if not (client_id and client_secret):
        return TokenStatus(INCONNU, "GOOGLE_ADS_CLIENT_ID ou GOOGLE_ADS_CLIENT_SECRET "
                                  "absent — jeton Google non vérifié"), None
    try:
        r = requests.post(_TOKEN_URL, data={
            "refresh_token": refresh_token,
            "client_id": client_id,
            "client_secret": client_secret,
            "grant_type": "refresh_token",
        }, timeout=15)
        corps = r.json()
    except Exception as e:
        return TokenStatus(INCONNU, f"Google injoignable ({type(e).__name__})"), None
    if not isinstance(corps, dict):
        return TokenStatus(INCONNU, f"réponse Google inattendue ({type(corps).__name__})"), None
    if corps.get("access_token"):
        return TokenStatus(VALIDE), corps["access_token"]
    erreur = corps.get("error")
    if erreur in _ERREURS_DU_CLIENT:
        detail = corps.get("error_description") or erreur
        return TokenStatus(MORT, f"Google refuse le jeton : {detail}"), None
    # invalid_client, unauthorized_client… : notre configuration d'app.
    return TokenStatus(INCONNU, f"Google a répondu {r.status_code} ({erreur or 'sans code'})"), None
