"""Ticket 05 — les Groupes d'éléments PMax × jour, sans réseau.

Lancer depuis la racine du dépôt :

    python3.12 -I .scratch/google-ads/harnais/05-les-groupes-d-elements-pmax/test_recolte.py

Réponses GAQL écrites à la main sur la forme REST de `searchStream` (liste de
lots, camelCase, int64 en chaînes). Rien ne part chez Google ni Supabase.
"""
from __future__ import annotations

import sys
from datetime import date, timedelta
from pathlib import Path

RACINE = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(RACINE))

import saas.data.fetch_data.sources.google.ads.fetchers._query as q  # noqa: E402
from saas.data.fetch_data.shared import http_client  # noqa: E402
from saas.data.fetch_data.sources.google.ads.fetchers import groupes_elements  # noqa: E402
from saas.data.fetch_data.sources.google.client import AccesGoogle  # noqa: E402
from saas.data.supabase.source_data.google import upsert_google_groupes_elements  # noqa: E402
from saas.data.supabase import _queries  # noqa: E402
from saas.data.supabase.fetch_state import state  # noqa: E402

q.secret = lambda k: "faux"  # sinon `entetes()` lit les vrais secrets

ECHECS: list[str] = []


def verifier(nom, obtenu, attendu):
    ok = obtenu == attendu
    print(("✓ " if ok else "✗ ") + nom + ("" if ok else f"\n    obtenu  : {obtenu!r}\n    attendu : {attendu!r}"))
    if not ok:
        ECHECS.append(nom)


# ── Le seam « réponse Google → lignes » ──────────────────────────────────────

def groupe(cid, gid, nom, jour, **metriques):
    return {"assetGroup": {"resourceName": f"customers/1/assetGroups/{gid}", "id": gid, "name": nom,
                           "campaign": f"customers/1/campaigns/{cid}"},
            "segments": {"date": jour},
            "metrics": metriques}


REPONSE = [{"results": [
    groupe("222", "9001", "Été", "2026-10-05", impressions="1200", clicks="40", costMicros="15500000",
           conversions=3.5, conversionsValue=210.0),
    groupe("222", "9002", "Hiver", "2026-10-05", impressions="300", clicks="0", costMicros="0",
           conversions=0, conversionsValue=0),
    # Le 6 octobre, Google n'a rien rendu pour « Hiver » : aucune ligne ne
    # doit l'inventer à 0.
]}, {"results": [
    groupe("222", "9001", "Été (renommé)", "2026-10-07", impressions="900", clicks="31", costMicros="12000000",
           conversions="2", conversionsValue="140"),
    # Un autre PMax, et une valeur absente de la réponse.
    groupe("333", "9100", "Marque", "2026-10-07", impressions="50", clicks="2", costMicros="800000",
           conversions=0),
]}]

lignes, err = groupes_elements.lignes_de(REPONSE)
verifier("aucune erreur, lots lus en entier", (err, len(lignes)), (None, 4))
l0 = lignes[0]
verifier("chaque groupe est rattaché à sa campagne par l'ID (tiré de asset_group.campaign)",
         [(l["campaign_id"], l["asset_group_id"]) for l in lignes],
         [("222", "9001"), ("222", "9002"), ("222", "9001"), ("333", "9100")])
verifier("jour et nom lus", (l0["date_start"], l0["asset_group_name"]), ("2026-10-05", "Été"))
verifier("impressions, clics, coût (micros) lus, int64 en chaînes",
         (l0["impressions"], l0["clicks"], l0["cost_micros"]), (1200, 40, 15500000))
verifier("conversions et valeur lues", (l0["conversions"], l0["conversions_value"]), (3.5, 210.0))
verifier("un 0 rendu par Google reste 0 (coût, clics, valeur)",
         (lignes[1]["cost_micros"], lignes[1]["clicks"], lignes[1]["conversions_value"]), (0, 0, 0.0))
verifier("un jour omis par Google n'est pas écrit (aucune ligne Hiver le 6 ni le 7)",
         [l["date_start"] for l in lignes if l["asset_group_id"] == "9002"], ["2026-10-05"])
verifier("une valeur absente reste None, jamais 0", lignes[3]["conversions_value"], None)
verifier("un compteur absent reste None, jamais 0",
         groupes_elements.lignes_de([{"results": [groupe("222", "1", "x", "2026-10-05", clicks="3")]}])[0][0]["impressions"],
         None)
verifier("une ligne sans campagne lisible n'est rattachée à rien (pas écrite)",
         groupes_elements.lignes_de([{"results": [
             {"assetGroup": {"id": "7", "name": "orphelin"}, "segments": {"date": "2026-10-05"},
              "metrics": {"impressions": "5"}}]}]),
         ([], None))
verifier("une erreur au milieu du flux annule tout",
         groupes_elements.lignes_de([REPONSE[0], {"error": {"message": "INTERNAL"}}]), ([], "INTERNAL"))
verifier("une erreur seule est rendue, sans ligne",
         groupes_elements.lignes_de({"error": {"message": "PERMISSION_DENIED"}}), ([], "PERMISSION_DENIED"))


# ── La requête et les tranches ───────────────────────────────────────────────
class _Reponse:
    def __init__(self, corps):
        self._corps = corps

    def json(self):
        return self._corps


ENVOYE: list = []
REFUSER: set = set()


def faux_post(url, headers=None, json=None, timeout=None):
    ENVOYE.append((url, json["query"]))
    if any(f"'{d}'" in json["query"] for d in REFUSER):
        return _Reponse({"error": {"message": "QUOTA"}})
    return _Reponse(REPONSE)


http_client.post = faux_post

lignes_http, err_http = groupes_elements.tranche("jeton", "123", date(2026, 10, 1), date(2026, 10, 7))
verifier("tranche() rend les lignes du seam pur", (lignes_http, err_http), (lignes, None))
url, requete = ENVOYE[-1]
verifier("l'appel part en v26", url, "https://googleads.googleapis.com/v26/customers/123/googleAds:searchStream")
for champ in ("FROM asset_group", "asset_group.id", "asset_group.name", "asset_group.campaign", "segments.date",
              "metrics.impressions", "metrics.clicks", "metrics.cost_micros", "metrics.conversions",
              "metrics.conversions_value", "'2026-10-01'", "'2026-10-07'"):
    verifier(f"la requête porte {champ}", champ in requete, True)

acces = AccesGoogle(jeton="jeton", client="123")
ENVOYE.clear()
fenetre = groupes_elements.Fenetre(date(2026, 1, 1), date(2026, 6, 30))  # 181 jours → 3 tranches
REFUSER.add("2026-04-01")
toutes, trous = groupes_elements.recuperer(acces, fenetre)
verifier("une requête par tranche de 90 jours", len(ENVOYE), 3)
verifier("une tranche refusée est NOMMÉE, pas jetée en silence", len(trous), 1)
verifier("le trou dit ses dates et la raison", ("2026-04-01" in trous[0], "QUOTA" in trous[0]), (True, True))
verifier("les tranches lues sont gardées", len(toutes), 2 * len(lignes))
REFUSER.clear()


# ── Les écritures ────────────────────────────────────────────────────────────
class FausseBase:
    """Refuse une colonne inconnue (PGRST204) et des clés variables dans un lot (PGRST102)."""

    COLONNES = {"user_id", "date_start", "campaign_id", "asset_group_id", "asset_group_name",
                "impressions", "clicks", "cost_micros", "conversions", "conversions_value"}

    def __init__(self):
        self.ecrit = []

    def table(self, nom):
        self.nom = nom
        return self

    def upsert(self, lot, on_conflict=None):
        if len({frozenset(l) for l in lot}) > 1:
            raise Exception("PGRST102 All object keys must match")
        for l in lot:
            for k in l:
                if k not in self.COLONNES:
                    raise Exception(f"PGRST204 Could not find the '{k}' column")
        self.ecrit.append((self.nom, lot, on_conflict))
        return self

    def execute(self):
        return self


base = FausseBase()
upsert_google_groupes_elements(base, "uid", lignes + lignes[:1])
table, ecrites, conflit = base.ecrit[0]
verifier("écrites dans google_ads_asset_group_insights", table, "google_ads_asset_group_insights")
verifier("une ligne par groupe d'éléments × jour", conflit, "user_id,date_start,asset_group_id")
verifier("un doublon de clé dans le lot n'est écrit qu'une fois", len(ecrites), 4)
verifier("rattachée à sa campagne par l'ID", (ecrites[0]["campaign_id"], ecrites[0]["asset_group_id"]), ("222", "9001"))
verifier("une valeur absente s'écrit NULL, jamais 0", ecrites[3]["conversions_value"], None)
verifier("un 0 s'écrit 0", ecrites[1]["cost_micros"], 0)

base = FausseBase()
beaucoup = [dict(lignes[0], date_start=f"2026-{1 + i // 28:02d}-{1 + i % 28:02d}", asset_group_id=str(i % 7))
            for i in range(2500)]
upsert_google_groupes_elements(base, "uid", beaucoup)
verifier("un gros lot part en morceaux de 1 000 au plus", [len(e[1]) for e in base.ecrit], [1000, 1000, 500])

base = FausseBase()
upsert_google_groupes_elements(base, "uid", [])
verifier("rien à écrire : aucun appel", base.ecrit, [])


# ── La reprise : sa propre date, 30 jours de recouvrement ────────────────────
class BaseDeLecture:
    def __init__(self, dates):
        self.dates = dates
        self.lue = None

    def table(self, nom):
        self.lue = nom
        return self

    def select(self, *_):
        return self

    def eq(self, *_):
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, *_):
        return self

    def execute(self):
        class R:
            pass
        r = R()
        r.data = [{"date_start": d} for d in sorted(self.dates, reverse=True)[:1]]
        return r


b = BaseDeLecture(["2026-10-01", "2026-10-07"])
verifier("le point de reprise se lit dans la table des groupes d'éléments",
         (_queries.fetch_google_asset_groups_latest_date(b, "uid"), b.lue),
         ("2026-10-07", "google_ads_asset_group_insights"))
verifier("table vide : pas de point de reprise", _queries.fetch_google_asset_groups_latest_date(BaseDeLecture([]), "uid"), None)
verifier("ré-exporté par fetch_state.state", state.fetch_google_asset_groups_latest_date is _queries.fetch_google_asset_groups_latest_date, True)


# ── L'étape dans `sync.recolter` ─────────────────────────────────────────────
from saas.data.fetch_data.sources.google.ads import sync  # noqa: E402

APPELS: dict = {}
AUJOURDHUI = date.today()
sync.get_access_token_from_refresh = lambda r: "jeton"
sync.photo_budget = lambda *a, **k: None
sync.statuts.fetch_campaign_statuses = lambda *a: ({}, None)
sync.journal_changements = lambda *a, **k: False
sync.avancer_couverture = lambda *a, **k: None
sync.insights_campagnes.recuperer = lambda acces, f: ([], [])
sync.insights_annonces.recuperer = lambda acces, f: ([], [])
sync.actions_conversion.recuperer = lambda acces: ([], None)
sync.conversions_par_action.recuperer = lambda acces, f: ([], [])
sync.termes_recherche.recuperer = lambda acces, f: ([], [])  # étape du ticket 09
sync.clusters_termes.recuperer = lambda acces, f: ([], [])  # étape du ticket 10
for nom in ("fetch_google_ads_latest_date", "fetch_google_ads_ad_insights_latest_date",
            "fetch_google_conversions_par_action_latest_date", "fetch_google_search_terms_latest_date"):
    setattr(sync, nom, lambda sb, uid: None)
sync.fetch_google_asset_groups_latest_date = lambda sb, uid: "2026-10-07"


def faux_recuperer(acces, f):
    APPELS["fenetre"] = (f.debut, f.fin)
    return lignes, ["2026-01-01→2026-03-31 : QUOTA"]


sync.groupes_elements.recuperer = faux_recuperer
sync.upsert_google_groupes_elements = lambda sb, uid, rows: APPELS.setdefault("ecrit", rows)

mot = sync.recolter(None, "uid", "refresh", "123")
verifier("reprise depuis SA date − 30 jours, jusqu'à aujourd'hui",
         APPELS.get("fenetre"), (date(2026, 10, 7) - timedelta(days=30), AUJOURDHUI))
verifier("les lignes lues sont écrites", APPELS.get("ecrit"), lignes)
verifier("le mot de fin compte les lignes de groupes d'éléments", "4 lignes groupes d'éléments" in mot, True)
verifier("le mot de fin nomme la tranche refusée", "groupes d'éléments REFUSÉE" in mot, True)

APPELS.clear()
sync.recolter(None, "uid", "refresh", "123", depuis=date(2024, 1, 1))
verifier("une récolte complète (`depuis`) part de `depuis`", APPELS.get("fenetre")[0], date(2024, 1, 1))

print("\nTOUT EST VERT" if not ECHECS else f"\n{len(ECHECS)} ÉCHEC(S)")
sys.exit(1 if ECHECS else 0)
