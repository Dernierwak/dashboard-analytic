"""Ticket 02 — le socle : fenêtres et HTTP. Hors ligne, aucune vraie attente.

    python3.12 .scratch/recolte/harnais/02_socle.py
"""
import json
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from saas.collecte.socle import fenetre, http

J = date(2026, 10, 7)

# ── fenetre.tranches ──────────────────────────────────────────────────────
assert fenetre.tranches(J, J) == [(J, J)]
t = fenetre.tranches(date(2026, 1, 1), date(2026, 3, 31))           # 90 j pile
assert t == [(date(2026, 1, 1), date(2026, 3, 31))], t
t = fenetre.tranches(date(2026, 1, 1), date(2026, 4, 1))            # 91 j
assert t == [(date(2026, 1, 1), date(2026, 3, 31)), (date(2026, 4, 1), date(2026, 4, 1))], t
assert fenetre.tranches(date(2026, 10, 8), J) == []
# ── fenetre.depart_recolte ───────────────────────────────────────────────
assert fenetre.depart_recolte(None, J, 28) == date(2026, 1, 1)
assert fenetre.depart_recolte("2026-10-01", J, 28) == date(2026, 9, 3)
assert fenetre.depart_recolte("2026-12-01", J, 28) == date(2026, 11, 3)  # futur : reculé, pas borné
assert fenetre.tranches(fenetre.depart_recolte("2026-12-01", J, 28), J) == []
# ── fenetre.date_forcee ──────────────────────────────────────────────────
assert fenetre.date_forcee("2026-01-01", J, 1126) == date(2026, 1, 1)
for mauvaise in ("2026-13-01", "2026-10-08", "2020-01-01"):
    try:
        fenetre.date_forcee(mauvaise, J, 1126)
        raise AssertionError(mauvaise)
    except ValueError:
        pass
print("fenetre ok")


# ── http : faux transport ────────────────────────────────────────────────
class Rep:
    def __init__(self, code, corps=b"{}", entetes=None):
        self.status_code, self.content, self.headers = code, corps, entetes or {}

    def json(self):
        return json.loads(self.content)


class FausseSession:
    def __init__(self, reponses):
        self.reponses, self.appels = list(reponses), 0

    def request(self, methode, url, **kw):
        assert "timeout" in kw
        self.appels += 1
        return self.reponses.pop(0) if len(self.reponses) > 1 else self.reponses[0]


attentes = []
http._dormir = attentes.append


def essai(reponses, url="https://googleads.googleapis.com/x"):
    attentes.clear()
    s = FausseSession(reponses)
    http._local.session = s
    r = http.get(url, timeout=5)
    return r, s.appels, list(attentes)


r, n, a = essai([Rep(429, entetes={"Retry-After": "3"}), Rep(200)])
assert (r.status_code, n, a) == (200, 2, [3.0]), (r.status_code, n, a)
r, n, a = essai([Rep(429), Rep(429), Rep(200)])
assert (r.status_code, n, a) == (200, 3, [2.0, 4.0]), (r.status_code, n, a)
r, n, a = essai([Rep(500), Rep(200)])
assert (r.status_code, n, a) == (200, 2, [2.0])
r, n, a = essai([Rep(429)])                                  # sans fin → rendue
assert (r.status_code, n, a) == (429, 4, [2.0, 4.0, 8.0]), (r.status_code, n, a)
r, n, a = essai([Rep(429, entetes={"Retry-After": "3600"})])  # trop long → pas attendu
assert (r.status_code, n, a) == (429, 1, [])
r, n, a = essai([Rep(404)])                                  # pas une limite
assert (r.status_code, n, a) == (404, 1, [])

META = "https://graph.facebook.com/v24.0/act_1/insights"
lim = b'{"error":{"code":80000,"message":"too many calls"}}'
r, n, a = essai([Rep(400, lim), Rep(200, b'{"data":[]}')], META)
assert (r.status_code, n, a) == (200, 2, [2.0]), (r.status_code, n, a)
buc = {"X-Business-Use-Case-Usage": json.dumps(
    {"act_1": [{"type": "ads_insights", "estimated_time_to_regain_access": 30}]})}
r, n, a = essai([Rep(400, lim, buc)], META)                  # 30 min annoncées → rendue
assert (r.status_code, n, a) == (400, 1, [])
autre = b'{"error":{"code":190,"message":"jeton expire"}}'
r, n, a = essai([Rep(400, autre)], META)                     # jeton mort : pas réessayé
assert (r.status_code, n) == (400, 1)
r, n, a = essai([Rep(400, lim)])                             # code Meta hors Meta : ignoré
assert n == 1
print("http ok")

assert http.sans_jeton("x?access_token=EAAsecret&y=1") == "x?access_token=…&y=1"
print("TOUT VERT")
