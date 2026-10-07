"""Ticket 01 — une tranche refusée se dit. Hors ligne, sans réseau ni Supabase.

    python3.12 .scratch/recolte/harnais/01_trous.py
"""
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from saas.collecte.google.acces import AccesGoogle
from saas.collecte.google.ads import insights_annonces, insights_campagnes
from saas.collecte.google.ads import recolte as fa
from saas.collecte.google.analytics import recolte as ga4
from saas.collecte.socle.fenetre import Fenetre

# Depuis le ticket 06, la boucle de tranches Google vit dans
# `insights_campagnes.recuperer` / `insights_annonces.recuperer`, et la récolte
# Google dans `google/ads/recolte.py` ; GA4 dans `google/analytics/recolte.py`.

AUJ = date(2026, 10, 7)
DEBUT = date(2026, 1, 1)          # 280 jours → 4 tranches de 90 j


def faux_google(refus: set):
    def appel(_access, _cid, since, until, _login=None):
        if since in refus:
            return [], "RESOURCE_EXHAUSTED"
        return [{"d": since.isoformat()}], None
    return appel


# ── Google ────────────────────────────────────────────────────────────────
A = AccesGoogle(jeton="a", client="c")
insights_campagnes.tranche = faux_google(set())
rows, trous = insights_campagnes.recuperer(A, Fenetre(DEBUT, AUJ))
assert len(rows) == 4 and trous == [], (rows, trous)

insights_campagnes.tranche = faux_google({date(2026, 4, 1)})
rows, trous = insights_campagnes.recuperer(A, Fenetre(DEBUT, AUJ))
assert len(rows) == 3, rows
assert trous == ["2026-04-01→2026-06-29 : RESOURCE_EXHAUSTED"], trous

insights_campagnes.tranche = faux_google(set())
rows, trous = insights_campagnes.recuperer(A, Fenetre(AUJ, AUJ))
assert len(rows) == 1 and trous == []

# Le mot de fin du canal nomme les trous.
insights_campagnes.tranche = faux_google({date(2026, 4, 1)})
insights_annonces.tranche = faux_google(set())
for nom, val in {
    "get_access_token_from_refresh": lambda r: "jeton",
    "photo_budget": lambda *a, **k: None,
    "journal_changements": lambda *a, **k: None,
    "fetch_google_ads_latest_date": lambda *a: None,
    "fetch_google_ads_ad_insights_latest_date": lambda *a: None,
    "depart_recolte": lambda latest, today, n: DEBUT,
    "upsert_google_ads": lambda *a: None,
    "upsert_google_ads_ad_insights": lambda *a: None,
}.items():
    setattr(fa, nom, val)
fa.statuts.fetch_campaign_statuses = lambda *a: ({}, None)
mot = fa.recolter(None, "u", "r", "c")
assert "1 tranche(s) campagnes REFUSÉE(S)" in mot, mot
assert "annonces REFUSÉE" not in mot, mot
print("google ok —", mot)

# ── GA4 ───────────────────────────────────────────────────────────────────
def faux_ga4(refus: set):
    def appel(_t, _p, since, until):
        if since in refus:
            return [], "quota"
        return [{"d": since.isoformat()}], None
    return appel


def ga4_avec(refus_ins: set, refus_ev: set) -> dict:
    ga4.get_access_token_from_refresh = lambda r: "jeton"
    ga4.catalogue_api.fetch_ga4_event_catalog = lambda *a: ([], None)
    ga4.fetch_ga4_latest_date = lambda *a: None
    ga4.insights.tranche = faux_ga4(refus_ins)
    ga4.evenements.tranche = faux_ga4(refus_ev)
    ga4.upsert_ga4_insights = lambda *a: None
    ga4.upsert_ga4_events = lambda *a: None
    return ga4.recolter(None, "u", "r", "p", since_date=DEBUT)


r = ga4_avec(set(), set())
assert r["success"] and "REFUSÉE" not in r["message"], r
r = ga4_avec({date(2026, 4, 1)}, set())
assert "1 tranche(s) insights REFUSÉE(S) : 2026-04-01→2026-06-29 : quota" in r["message"], r
r = ga4_avec(set(), {DEBUT})
assert "1 tranche(s) événements REFUSÉE(S)" in r["message"], r
r = ga4_avec({DEBUT, date(2026, 4, 1), date(2026, 6, 30), date(2026, 9, 28)}, set())
assert not r["success"] and "ne rend rien" not in r["message"], r
assert "4 tranche(s) insights REFUSÉE(S)" in r["message"], r
print("ga4 ok —", r["message"])
print("TOUT VERT")
