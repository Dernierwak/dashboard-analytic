"""Ticket 03 — le jeton se vérifie. Hors ligne : aucun appel réseau réel.

    python3.12 .scratch/recolte/harnais/03_jeton.py
"""
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
os.environ.update({"META_APP_ID": "app", "META_APP_SECRET": "s",
                   "GOOGLE_ADS_CLIENT_ID": "c", "GOOGLE_ADS_CLIENT_SECRET": "s"})

from saas.collecte.meta.auth import jeton as meta
from saas.collecte.google.auth import jeton as google
from saas.collecte.etat_jeton import INCONNU, MORT, VALIDE

MAINTENANT = datetime(2026, 10, 7, tzinfo=timezone.utc)
ts = lambda d: int((MAINTENANT + timedelta(days=d)).timestamp())


class Rep:
    def __init__(self, corps, status=200):
        self.corps, self.status_code = corps, status

    def json(self):
        return self.corps


def repond(corps, status=200):
    return lambda *a, **k: Rep(corps, status)


def coupe(*a, **k):
    raise ConnectionError("https://graph.facebook.com/?access_token=SECRET")


# ── Meta ──────────────────────────────────────────────────────────────────
meta.requests.get = repond({"data": {"is_valid": True, "expires_at": ts(40),
                                     "data_access_expires_at": ts(80)}})
e = meta.verifier("tok", MAINTENANT)
assert e.etat == VALIDE and e.expire_le == MAINTENANT + timedelta(days=40), e
assert not meta.expire_bientot(e, MAINTENANT)

meta.requests.get = repond({"data": {"is_valid": True, "expires_at": ts(10)}})
e = meta.verifier("tok", MAINTENANT)
assert e.etat == VALIDE and meta.expire_bientot(e, MAINTENANT), e

meta.requests.get = repond({"data": {"is_valid": False, "expires_at": ts(-2),
                                     "error": {"message": "Session has expired"}}})
e = meta.verifier("tok", MAINTENANT)
assert e.etat == MORT and e.raison == "Session has expired" and e.a_reconnecter, e

meta.requests.get = repond({"data": {"is_valid": False,
                                     "error": {"message": "user has not authorized application"}}})
assert meta.verifier("tok", MAINTENANT).etat == MORT          # révoqué

meta.requests.get = repond({"data": {"is_valid": True, "expires_at": 0,
                                     "data_access_expires_at": ts(-1)}})
e = meta.verifier("tok", MAINTENANT)
assert e.etat == MORT, e                                     # accès aux données échu

meta.requests.get = repond({"data": {"is_valid": True, "expires_at": 0}})
e = meta.verifier("tok", MAINTENANT)
assert e.etat == VALIDE and e.expire_le is None, e           # 0 = non communiqué

meta.requests.get = coupe
e = meta.verifier("tok", MAINTENANT)
assert e.etat == INCONNU and not e.a_reconnecter and "SECRET" not in e.raison, e

meta.requests.get = repond({"error": {"message": "Invalid OAuth access token"}}, 400)
assert meta.verifier("tok", MAINTENANT).etat == INCONNU      # jeton d'APP refusé

assert meta.verifier(None).etat == MORT
os.environ.pop("META_APP_SECRET")
meta.secret.__globals__["_dotenv"].cache_clear()
assert meta.verifier("tok").etat == INCONNU                  # notre config
print("meta ok")

# ── Google ────────────────────────────────────────────────────────────────
google.requests.post = repond({"access_token": "ya29", "expires_in": 3599})
e, acces = google.verifier("r")
assert e.etat == VALIDE and acces == "ya29", e

google.requests.post = repond({"error": "invalid_grant",
                               "error_description": "Token has been expired or revoked."}, 400)
e, acces = google.verifier("r")
assert e.etat == MORT and acces is None and "expired or revoked" in e.raison, e

google.requests.post = repond({"error": "invalid_client"}, 401)
assert google.verifier("r")[0].etat == INCONNU               # notre config

google.requests.post = repond({"error": "internal_failure"}, 503)
assert google.verifier("r")[0].etat == INCONNU

google.requests.post = coupe
e, _ = google.verifier("r")
assert e.etat == INCONNU and not e.a_reconnecter, e          # réseau ≠ jeton mort

assert google.verifier("")[0].etat == MORT
print("google ok")
print("TOUT VERT")
