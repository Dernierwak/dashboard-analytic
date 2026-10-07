"""Ticket 06 — Google : un fichier par API, l'écriture à part. Hors ligne.

    python3.12 .scratch/recolte/harnais/06_google.py

Une récolte Google Ads et une récolte GA4 de bout en bout contre une fausse API
Google et une fausse base : les mêmes tables reçoivent les mêmes lignes qu'avant
le déménagement. Et le traitement ne tire plus rien de la récolte.
"""
import ast
import sys
from datetime import date, timedelta
from pathlib import Path

RACINE = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from faux import FausseBase, brancher_http  # noqa: E402

from saas.collecte.google.acces import AccesGoogle  # noqa: E402
from saas.collecte.google.ads import budgets, changements, insights_annonces, insights_campagnes, statuts  # noqa: E402
from saas.collecte.google.ads import recolte as recolte_google  # noqa: E402
from saas.collecte.google.analytics import catalogue, evenements, insights  # noqa: E402
from saas.collecte.google.analytics import recolte as recolte_ga4  # noqa: E402
from saas.collecte.socle.fenetre import Fenetre  # noqa: E402

AUJ = date.today()
secret_avant = recolte_google.get_access_token_from_refresh


def faux_google(methode, chemin, _p, corps):
    if chemin == "/token":
        return 200, {"access_token": "ACC"}
    q = (corps or {}).get("query", "")
    if "googleAds:searchStream" in chemin:
        if "FROM change_event" in q:
            return 200, [{"results": [{"changeEvent": {
                "changeDateTime": f"{AUJ} 10:00:00.000000",
                "changeResourceType": "CAMPAIGN_BUDGET",
                "changeResourceName": "customers/9/campaignBudgets/7",
                "changedFields": "amountMicros", "resourceChangeOperation": "UPDATE",
                "campaign": "customers/9/campaigns/1",
                "oldResource": {"campaignBudget": {"amountMicros": "10000000"}},
                "newResource": {"campaignBudget": {"amountMicros": "20000000"}}}}]}]
        if "FROM ad_group_ad" in q:
            return 200, [{"results": [{"campaign": {"id": "1", "name": "Été"},
                                       "adGroup": {"id": "g1", "name": "G"},
                                       "adGroupAd": {"ad": {"id": "a1"}},
                                       "segments": {"date": str(AUJ)},
                                       "metrics": {"impressions": "5", "costMicros": "1000000"}}]}]
        if "campaign_budget.amount_micros" in q:
            return 200, [{"results": [{"campaign": {"id": "1", "name": "Été", "status": "ENABLED",
                                                    "endDate": "2037-12-30"},
                                       "campaignBudget": {"amountMicros": "30000000"}}]}]
        if "metrics.impressions" in q:
            return 200, [{"results": [{"campaign": {"id": "1", "name": "Été", "status": "ENABLED"},
                                       "segments": {"date": str(AUJ)},
                                       "metrics": {"impressions": "10", "clicks": "2",
                                                   "costMicros": "4500000"}}]}]
        if "FROM campaign" in q:
            return 200, [{"results": [{"campaign": {"id": "1", "name": "Été", "status": "ENABLED",
                                                    "startDate": "2026-01-01"}}]}]
    if chemin.endswith(":runReport"):
        dims = [d["name"] for d in corps["dimensions"]]
        if dims == ["eventName"]:
            return 200, {"rows": [{"dimensionValues": [{"value": "purchase"}],
                                   "metricValues": [{"value": "3"}, {"value": "90"}]}]}
        if "eventName" in dims:
            return 200, {"rows": [{"dimensionValues": [{"value": AUJ.strftime("%Y%m%d")},
                                                       {"value": "google"}, {"value": "cpc"},
                                                       {"value": "Été"}, {"value": "purchase"}],
                                   "metricValues": [{"value": "3"}, {"value": "90"}]}]}
        return 200, {"rows": [{"dimensionValues": [{"value": AUJ.strftime("%Y%m%d")},
                                                   {"value": "google"}, {"value": "cpc"},
                                                   {"value": "Été"}],
                               "metricValues": [{"value": "12"}, {"value": "1"}, {"value": "90"}]}]}
    if chemin.endswith("/keyEvents"):
        return 200, {"keyEvents": [{"eventName": "purchase"}]}
    raise AssertionError(f"route inconnue {methode} {chemin} {q[:60]}")


# Le developer-token vient de `secret()` : en harnais, une valeur factice.
import saas.collecte.google.ads.gaql as gaql  # noqa: E402
gaql.secret = lambda cle, defaut=None: "factice"
import saas.collecte.google.auth.oauth as oauth  # noqa: E402
oauth.secret = lambda cle, defaut=None: "factice"

# ── chaque fichier d'API, et sa limite ────────────────────────────────────
brancher_http(faux_google)
A = AccesGoogle(jeton="ACC", client="9", propriete="properties/5")
F = Fenetre(AUJ - timedelta(days=7), AUJ)
assert budgets.recuperer(A)[0][0]["end_date"] is None             # sentinelle 2037
assert budgets.recuperer(A)[0][0]["daily_budget"] == 30.0
assert statuts.recuperer(A)[0][0]["start_date"] == "2026-01-01"
assert insights_campagnes.recuperer(A, F)[0][0]["cost_micros"] == 4500000
assert insights_annonces.recuperer(A, F, limite=1)[0][0]["ad_id"] == "a1"
ch, trous = changements.recuperer(A, F, noms_campagnes={"1": "Été"})
assert trous == [] and "Été" in ch[0]["resume"] and "20,00" in ch[0]["resume"], ch
assert insights.recuperer(A, F)[0][0]["sessions"] == 12
assert evenements.recuperer(A, F)[0][0]["event_name"] == "purchase"
assert catalogue.recuperer(A, F)[0][0]["cle"] is True
print("fichiers d'API ok")

# ── la récolte Google Ads de bout en bout ─────────────────────────────────
brancher_http(faux_google)
sb = FausseBase()
mot = recolte_google.recolter(sb, "u1", "REFRESH", "9")
# Base vide → départ au 1er janvier → une ligne par tranche de 90 jours.
n = len(__import__("saas.collecte.socle.fenetre", fromlist=["x"]).tranches(date(AUJ.year, 1, 1), AUJ))
assert mot == f"google: {n} lignes, {n} lignes annonces", mot
(_, _, (ins, _), _), = sb.ecrit("upsert", "google_ads_insights")
assert ins[0]["campaign_id"] == "1"
assert sb.ecrit("upsert", "google_ads_ad_insights")
assert sb.ecrit("upsert", "platform_budgets") and sb.ecrit("upsert", "platform_changes")
print("récolte google ok —", mot)

# ── la récolte GA4 de bout en bout ────────────────────────────────────────
brancher_http(faux_google)
sb = FausseBase()
r = recolte_ga4.recolter(sb, "u1", refresh_token="REFRESH", property_id="properties/5")
assert r["success"] and r["rows"] == n, r
assert "catalogue : 1 événements" in r["message"], r
assert sb.ecrit("upsert", "ga4_insights") and sb.ecrit("upsert", "ga4_events")
print("récolte ga4 ok —", r["message"])

# ── le traitement ne tire plus rien de la récolte ─────────────────────────
for f in (RACINE / "saas/traitement").glob("*.py"):
    for n in ast.walk(ast.parse(f.read_text())):
        if isinstance(n, (ast.Import, ast.ImportFrom)):
            mod = getattr(n, "module", None) or ""
            noms = [a.name for a in n.names]
            assert not mod.startswith("saas.collecte") and not any(
                x.startswith("saas.collecte") for x in noms), (f, mod)
from saas.traitement.lecteur import build_ga4_context  # noqa: E402,F401
print("traitement ok")
print("TOUT VERT")
