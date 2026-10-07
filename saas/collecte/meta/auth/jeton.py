"""Le jeton Meta est-il encore bon, et jusqu'à quand ?

Meta n'a pas de refresh token : le jeton « long » obtenu à la connexion
(`saas/web/app/api/oauth/meta/callback/route.ts`, environ 60 jours) est le
seul. Quand il meurt, seul le client peut en refaire un — le worker ne peut que
le constater et le demander. Sans cette vérification, on ne le découvrait qu'à
la première erreur d'API, au milieu d'une récolte, canal par canal.

`/debug_token` rend l'état et l'échéance. La doc : « un jeton d'accès d'APP ou
le jeton utilisateur d'un développeur de l'app » est requis, `input_token` est
le jeton inspecté, la réponse porte `is_valid`, `expires_at`,
`data_access_expires_at` et `error`.
https://developers.facebook.com/docs/graph-api/reference/debug_token/
Le jeton d'app est `META_APP_ID|META_APP_SECRET` — les deux mêmes variables
que le web (`saas/web/lib/oauth.ts`, `reglagesMeta`). Côté worker, elles
doivent exister dans les secrets GitHub Actions.
"""
from __future__ import annotations

from datetime import datetime, timezone

import requests

from saas.commun.app_secrets import secret
from saas.collecte.etat_jeton import EtatJeton, INCONNU, MORT, VALIDE

_GRAPH = "https://graph.facebook.com/v24.0"

# DEUX JOURS DE TRAVAIL DE PRÉAVIS. La récolte d'un compte passe une fois par
# semaine (`profiles.fetch_schedule`) : un jeton qui meurt dans moins de 7 jours
# est mort au prochain passage. 14 jours laissent deux semaines — deux rapports,
# deux occasions — pour se reconnecter AVANT la panne au lieu d'après.
PREAVIS_JOURS = 14


def _horodatage(v) -> datetime | None:
    # La doc ne dit pas ce que vaut `expires_at = 0`. On ne lui invente pas de
    # sens (« n'expire jamais ») : 0 ou absent = échéance non communiquée.
    try:
        n = int(v or 0)
    except (TypeError, ValueError):
        return None
    return datetime.fromtimestamp(n, tz=timezone.utc) if n > 0 else None


def verifier(jeton: str | None, maintenant: datetime | None = None) -> EtatJeton:
    if not jeton:
        return EtatJeton(MORT, "aucun jeton Meta enregistré")
    app_id, app_secret = secret("meta.app_id"), secret("meta.app_secret")
    if not (app_id and app_secret):
        # Notre configuration, pas la connexion du client : on ne la marque pas.
        return EtatJeton(INCONNU, "META_APP_ID ou META_APP_SECRET absent — "
                                  "jeton Meta non vérifié")
    maintenant = maintenant or datetime.now(timezone.utc)
    try:
        corps = requests.get(
            f"{_GRAPH}/debug_token",
            params={"input_token": jeton, "access_token": f"{app_id}|{app_secret}"},
            timeout=20,
        ).json()
    except Exception as e:
        # Jamais le message brut : l'URL d'une exception requests porte les deux
        # jetons en clair.
        return EtatJeton(INCONNU, f"debug_token injoignable ({type(e).__name__})")
    if not isinstance(corps, dict):
        return EtatJeton(INCONNU, f"réponse Meta inattendue ({type(corps).__name__})")
    if corps.get("error"):
        # Erreur au niveau de l'APPEL (jeton d'app refusé, limite de débit) :
        # elle parle de nous, pas du jeton du client.
        return EtatJeton(INCONNU, "debug_token refusé : "
                         + str(corps["error"].get("message", "erreur Meta")))
    d = corps.get("data") or {}
    expire = _horodatage(d.get("expires_at"))
    acces = _horodatage(d.get("data_access_expires_at"))
    if not d.get("is_valid"):
        err = d.get("error") or {}
        return EtatJeton(MORT, err.get("message") or "jeton Meta invalide", expire)
    # Jeton valide mais accès aux données échu : chaque appel d'insights
    # échouerait. Pour le client, c'est la même chose qu'un jeton mort.
    if acces and acces <= maintenant:
        return EtatJeton(MORT, "l'accès de Pulse à tes données Meta a expiré", acces)
    if expire and expire <= maintenant:
        return EtatJeton(MORT, "jeton Meta expiré", expire)
    echeances = [x for x in (expire, acces) if x]
    return EtatJeton(VALIDE, None, min(echeances) if echeances else None)


def expire_bientot(etat: EtatJeton, maintenant: datetime | None = None) -> bool:
    if etat.etat != VALIDE or not etat.expire_le:
        return False
    maintenant = maintenant or datetime.now(timezone.utc)
    return (etat.expire_le - maintenant).days < PREAVIS_JOURS
