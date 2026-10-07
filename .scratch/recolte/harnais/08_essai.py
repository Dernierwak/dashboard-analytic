"""Ticket 08 — l'essai : N éléments par API, un JSON, rien en base. Hors ligne.

    python3.12 .scratch/recolte/harnais/08_essai.py

Contre une fausse API Meta + Google et une fausse base :
① aucune écriture Supabase, et `LectureSeule` lève sur toute tentative ;
② chaque fichier d'API est lu avec sa limite, et un JSON est écrit ;
③ les contrôles de complétude : égalité, écart, total absent ;
④ aucun jeton dans le JSON.
"""
import json
import sys
import tempfile
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from faux import FausseBase, brancher_http  # noqa: E402

from saas.collecte import essai  # noqa: E402
import saas.collecte.google.ads.gaql as gaql  # noqa: E402
import saas.collecte.google.auth.oauth as oauth  # noqa: E402

gaql.secret = lambda cle, defaut=None: "factice"
oauth.secret = lambda cle, defaut=None: "factice"
G = "/v24.0"
HIER = date.today() - timedelta(days=1)
JOUR = HIER.isoformat()
ECART = {"meta": 0.0}          # ce que le compte Meta déclare EN PLUS des annonces


def route(_m, chemin, p, corps):
    q = (corps or {}).get("query", "")
    if chemin == "/token":
        return 200, {"access_token": "ACCES-SECRET"}
    if chemin == f"{G}/me/adaccounts":
        return 200, {"data": [{"id": "act_1", "timezone_name": "Europe/Zurich"}]}
    if chemin == f"{G}/act_1/campaigns":
        return 200, {"data": [{"id": f"c{i}", "name": f"C{i}", "daily_budget": "100"}
                              for i in range(8)]}
    if chemin == f"{G}/act_1/activities":
        return 200, {"data": [{"event_type": "create_ad", "event_time": f"{JOUR}T10:00:00+0000",
                               "object_id": f"a{i}", "object_name": "A"} for i in range(8)]}
    if chemin == f"{G}/act_1/ads":
        return 200, {"data": [{"id": f"a{i}", "creative": {"image_hash": f"h{i}"}}
                              for i in range(8)]}
    if chemin == f"{G}/act_1/adimages":
        return 200, {"data": [{"hash": h, "url": f"https://cdn/{h}"}
                              for h in json.loads(p["hashes"])]}
    if chemin == f"{G}/act_1/insights":
        if p.get("level") == "account":
            return 200, {"data": [{"spend": str(8 * 2.5 + ECART["meta"])}]}
        return 200, {"data": [{"ad_id": f"a{i}", "date_start": JOUR, "spend": "2.5"}
                              for i in range(8)]}
    if chemin == f"{G}/ig1":
        return 200, {"followers_count": 10, "media_count": 6}
    if chemin == f"{G}/ig1/media":
        return 200, {"data": [{"id": f"10{i}", "timestamp": f"{JOUR}T10:00:00+0000"}
                              for i in range(6)]}
    if chemin.endswith("/insights"):
        return 200, {"data": [{"name": "reach", "value": 3}]}
    if chemin.startswith(f"{G}/10"):
        return 200, {"media_type": "IMAGE"}
    if "googleAds:searchStream" in chemin:
        if "FROM customer" in q:
            return 200, [{"results": [{"metrics": {"costMicros": "8000000"}}]}]
        if "FROM change_event" in q:
            return 200, [{"results": []}]
        if "FROM ad_group_ad" in q or "metrics.impressions" in q:
            return 200, [{"results": [{"campaign": {"id": str(i)}, "adGroup": {"id": "g"},
                                       "adGroupAd": {"ad": {"id": str(i)}},
                                       "segments": {"date": JOUR},
                                       "metrics": {"costMicros": "1000000"}} for i in range(8)]}]
        return 200, [{"results": [{"campaign": {"id": str(i), "name": "C"}} for i in range(8)]}]
    if chemin.endswith(":runReport"):
        dims = [d["name"] for d in corps.get("dimensions", [])]
        if not dims:
            # 10 sessions au total, 8 dans le détail : GA4 peut regrouper.
            return 200, {"rows": [{"metricValues": [{"value": "10"}]}]}
        if dims == ["eventName"]:
            return 200, {"rows": [{"dimensionValues": [{"value": "purchase"}],
                                   "metricValues": [{"value": "1"}, {"value": "0"}]}]}
        vals = [{"value": HIER.strftime("%Y%m%d")}, {"value": "s"}, {"value": "m"}, {"value": "c"}]
        if "eventName" in dims:
            vals.append({"value": "purchase"})
        return 200, {"rows": [{"dimensionValues": vals,
                               "metricValues": [{"value": "1"}] * 3} for _ in range(8)]}
    if chemin.endswith("/keyEvents"):
        return 200, {"keyEvents": []}
    raise AssertionError(f"route inconnue {chemin} {p} {q[:40]}")


CONNEXIONS = [{"provider": "meta", "meta_token": "EAA-JETON-META", "instagram_business_id": "ig1"},
              {"provider": "google", "google_refresh_token": "1//REFRESH-SECRET",
               "google_customer_id": "9", "ga4_property_id": "properties/5"}]

# ── ① + ② ────────────────────────────────────────────────────────────────
brancher_http(route)
sb = FausseBase({"connected_accounts": CONNEXIONS})
e = essai.Essai("u1-compte-essai", n=3, dossier=Path(tempfile.mkdtemp()))
rapport = e.executer(sb=sb)
assert sb.ecrits == [], sb.ecrits
assert rapport["fenetre"][1] == HIER.isoformat()                         # s'arrête hier
for nom in ("meta/budgets", "meta/campagnes", "meta/activites", "meta/creas", "meta/images",
            "meta/insights", "instagram/posts", "instagram/metriques",
            "google/budgets", "google/statuts", "google/insights_campagnes",
            "google/insights_annonces", "ga4/insights", "ga4/evenements"):
    assert rapport["api"][nom]["lu"], (nom, rapport["api"][nom])
    assert rapport["api"][nom]["elements"] <= 3, (nom, rapport["api"][nom]["elements"])
assert rapport["api"]["meta/insights"]["elements"] == 3
assert len(rapport["api"]["meta/creas"]["echantillon"]) == 2
chemin = e.ecrire(rapport)
assert chemin.exists() and chemin.parent == e.dossier
print("lecture et JSON ok")

lecture = essai.LectureSeule(FausseBase())
for ecrire in (lambda: lecture.table("x").upsert([{}]),
               lambda: lecture.table("x").select("*").eq("a", 1).delete(),
               lambda: lecture.storage.from_("post-images").upload(path="p", file=b"")):
    try:
        ecrire()
        raise AssertionError("écriture non interdite")
    except essai._Interdit:
        pass
print("lecture seule ok")

# ── ③ les contrôles ───────────────────────────────────────────────────────
c = rapport["controles"]
assert c["meta/depense"]["verdict"] == "complet", c["meta/depense"]
assert c["instagram/posts"] == {"verdict": "complet", "media_count": 6, "lu": 6, "ecart": 0}
assert c["google/cout_micros"]["verdict"] == "complet", c["google/cout_micros"]
assert c["ga4/sessions"]["verdict"] == "ÉCART" and c["ga4/sessions"]["ecart"] == -2.0, c["ga4/sessions"]

ECART["meta"] = 5.0                       # une annonce que la liste n'a pas rendue
brancher_http(route)
r2 = essai.Essai("u1", n=3).executer(sb=FausseBase({"connected_accounts": CONNEXIONS}))
assert r2["controles"]["meta/depense"]["verdict"] == "ÉCART"
assert r2["controles"]["meta/depense"]["ecart"] == -5.0

brancher_http(lambda m, ch, p, j: (200, {"error": {"message": "limite"}})
              if ch == f"{G}/act_1/insights" and p.get("level") == "account" else route(m, ch, p, j))
r3 = essai.Essai("u1", n=3, plateformes=["meta"]).executer(sb=FausseBase({"connected_accounts": CONNEXIONS}))
assert r3["controles"]["meta/depense"] == {"verdict": "non vérifiable", "raison": "limite", "lu": 20.0}
assert set(r3["controles"]) == {"meta/depense"}                         # --plateforme meta
print("contrôles ok")

# ── ④ aucun jeton dans le JSON ────────────────────────────────────────────
texte = chemin.read_text()
for secret in ("EAA-JETON-META", "REFRESH-SECRET", "ACCES-SECRET"):
    assert secret not in texte, secret
print(essai.resume(rapport))
print("TOUT VERT")
