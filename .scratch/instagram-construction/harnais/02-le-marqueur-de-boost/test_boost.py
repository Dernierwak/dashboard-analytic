"""Ticket 02 — le marqueur de boost, sans réseau ni base.

Lancer depuis la racine du dépôt :

    python3.12 -I .scratch/instagram-construction/harnais/02-le-marqueur-de-boost/test_boost.py

Quatre coutures :
  1. `boost.est_booste` — la règle (pure) : au moins une annonce hors `error`,
     dédoublonnée par `ad_id`, statut en minuscules ; champ non obtenu = inconnu ;
  2. `sync.lignes_du_post` — le booléen du moment dans le relevé, `booste_vu_le`
     posé la première fois seulement, jamais envoyé pour le vider ;
  3. les fetchers — `boost_ads_list` demandé au même appel que la fiche
     (`info_du_post`, `posts.recents`), repli sans lui s'il est refusé ;
  4. `sync.releve_quotidien` — la date déjà en base n'est pas réécrite, et une
     base sans la section 23 se lit quand même.
Les réponses suivent l'essai réel (`.scratch/instagram/issues/17`, point 9) :
entrée `{ad_id, ad_status}`, même annonce répétée, statuts en minuscules.
"""
from __future__ import annotations

import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

RACINE = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(RACINE))

from saas.data.fetch_data.shared import http_client  # noqa: E402
from saas.data.fetch_data.sources.meta.graph_client import AccesMeta  # noqa: E402
from saas.data.fetch_data.sources.meta.instagram import sync  # noqa: E402
from saas.data.fetch_data.sources.meta.instagram.fetchers import boost  # noqa: E402
from saas.data.fetch_data.sources.meta.instagram.fetchers import post_metrics, posts  # noqa: E402

ECHECS: list[str] = []


def verifier(nom, obtenu, attendu):
    if obtenu != attendu:
        ECHECS.append(nom)
        print(f"✗ {nom}\n    obtenu  : {obtenu!r}\n    attendu : {attendu!r}")
    else:
        print(f"✓ {nom}")


def _liste(*statuts, meme_annonce=False):
    return {"boost_ads_list": {"data": [
        {"ad_id": "a" if meme_annonce else f"a{i}", "ad_status": s} for i, s in enumerate(statuts)]}}


# ── 1 · La règle ────────────────────────────────────────────────────────────
verifier("Une annonce `error` seule ne marque pas", boost.est_booste(_liste("error")), False)
verifier("La même annonce `error` répétée ne marque pas",
         boost.est_booste(_liste("error", "error", "error", meme_annonce=True)), False)
verifier("Une annonce terminée marque (Meta garde les annonces terminées)",
         boost.est_booste(_liste("completed")), True)
verifier("`error` à côté d'une annonce archivée : boosté",
         boost.est_booste(_liste("error", "archived")), True)
verifier("Statut en majuscules : lu en minuscules", boost.est_booste(_liste("ERROR")), False)
verifier("Liste vide : aucun boost vu", boost.est_booste({"boost_ads_list": {"data": []}}), False)
verifier("Champ non obtenu (repli sans lui) : inconnu, pas « non boosté »",
         boost.est_booste({"id": "1"}), None)

# ── 2 · Le relevé et la fiche ───────────────────────────────────────────────
INFO = {"id": "1", "media_type": "IMAGE", "media_product_type": "FEED", "caption": "c",
        "timestamp": "2026-11-01T07:00:00+0000"}
METRIQUES = {"reach": 10, "views": 20, "likes": 1, "comments": 0, "saved": 0, "shares": 0,
             "avg_watch_time": None, "follows": 0, "profile_visits": 0}
RELEVE_A = datetime(2026, 11, 9, 9, 30, tzinfo=timezone.utc)

fiche, releve = sync.lignes_du_post("u", {**INFO, **_liste("active")}, METRIQUES, RELEVE_A)
verifier("Boost vu la première fois : le relevé dit vrai, la fiche prend la date du relevé",
         (releve["booste"], fiche.get("booste_vu_le")), (True, "2026-11-09"))

fiche, releve = sync.lignes_du_post("u", {**INFO, **_liste("completed")}, METRIQUES, RELEVE_A,
                                    booste_vu_le="2026-10-02")
verifier("Boost déjà vu : la date en base n'est pas renvoyée (donc pas déplacée)",
         (releve["booste"], "booste_vu_le" in fiche), (True, False))

fiche, releve = sync.lignes_du_post("u", {**INFO, "boost_ads_list": {"data": []}}, METRIQUES,
                                    RELEVE_A, booste_vu_le="2026-10-02")
verifier("Relevé sans annonce : faux au relevé, `booste_vu_le` jamais envoyé (donc jamais vidé)",
         (releve["booste"], "booste_vu_le" in fiche), (False, False))

fiche, releve = sync.lignes_du_post("u", {**INFO, **_liste("error")}, METRIQUES, RELEVE_A)
verifier("Annonce `error` seule : ni marque ni date",
         (releve["booste"], "booste_vu_le" in fiche), (False, False))

fiche, releve = sync.lignes_du_post("u", INFO, METRIQUES, RELEVE_A)
verifier("Champ refusé : relevé à None, aucune date",
         (releve["booste"], "booste_vu_le" in fiche), (None, False))

fiche, releve = sync.lignes_du_post("u", {**INFO, **_liste("active")}, None, RELEVE_A)
verifier("Métriques refusées mais boost lu au même appel : la date se pose, pas de relevé",
         (releve, fiche.get("booste_vu_le")), (None, "2026-11-09"))


# ── 3 · Les fetchers : au même appel, repli s'il est refusé ─────────────────
class _Reponse:
    def __init__(self, corps):
        self._corps = corps

    def json(self):
        return self._corps


REFUS = {"error": {"code": 100, "message": "(#100) Tried accessing nonexisting field (boost_ads_list)"}}


class FauxGraph:
    """Refuse `boost_ads_list` si `refuse`, sinon rend `corps` (un objet ou une page)."""

    def __init__(self, corps, refuse=False):
        self.corps, self.refuse, self.champs = corps, refuse, []

    def __call__(self, url, *, timeout, params=None, headers=None):
        champs = (params or {}).get("fields", "")
        self.champs.append(champs)
        if self.refuse and "boost_ads_list" in champs.split(","):
            return _Reponse(REFUS)
        return _Reponse(self.corps)


ACCES = AccesMeta(jeton="faux", instagram="ig")

graph = FauxGraph({**INFO, **_liste("completed", "completed", meme_annonce=True)})
http_client.get = graph
info = post_metrics.info_du_post(ACCES, "1")
verifier("Fiche : boost_ads_list demandé au même appel, un seul appel",
         (len(graph.champs), "boost_ads_list" in graph.champs[0].split(",")), (1, True))
verifier("Fiche : boost lu", boost.est_booste(info), True)

graph = FauxGraph(INFO)
http_client.get = graph
verifier("Fiche obtenue sans le champ : aucune annonce listée → aucun boost vu",
         boost.est_booste(post_metrics.info_du_post(ACCES, "1")), False)

graph = FauxGraph(INFO, refuse=True)
http_client.get = graph
info = post_metrics.info_du_post(ACCES, "1")
verifier("Fiche : champ refusé → relue sans lui, la fiche arrive quand même",
         (len(graph.champs), info.get("id"), boost.est_booste(info)), (2, "1", None))

MAINTENANT = datetime(2026, 11, 10, 7, 0, tzinfo=timezone.utc)
jeune = (MAINTENANT - timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%S+0000")
graph = FauxGraph({"data": [{**INFO, "timestamp": jeune, **_liste("active")},
                            {**INFO, "id": "2", "timestamp": jeune}]})
http_client.get = graph
medias, trous = posts.recents(ACCES, MAINTENANT - timedelta(hours=192))
verifier("Inventaire du jour : boost_ads_list dans les champs, boosts lus",
         ("boost_ads_list" in graph.champs[0].split(","), [boost.est_booste(m) for m in medias]),
         (True, [True, False]))

graph = FauxGraph({"data": [{**INFO, "timestamp": jeune}]}, refuse=True)
http_client.get = graph
medias, trous = posts.recents(ACCES, MAINTENANT - timedelta(hours=192))
verifier("Inventaire du jour : champ refusé → relu sans lui, boost inconnu, pas de trou",
         (len(graph.champs), [boost.est_booste(m) for m in medias], trous), (2, [None], []))


# ── 4 · Le passage léger : la date en base n'est jamais réécrite ────────────
class FauxGraphLeger:
    def __call__(self, url, *, timeout, params=None, headers=None):
        if urlparse(url).path.endswith("/media"):
            return _Reponse({"data": [
                {**INFO, "id": "10", "timestamp": jeune, **_liste("active")},
                {**INFO, "id": "11", "timestamp": jeune, **_liste("active")},
                {**INFO, "id": "12", "timestamp": jeune, "boost_ads_list": {"data": []}}]})
        noms = params["metric"].split(",")
        return _Reponse({"data": [{"name": n, "values": [{"value": 1}]} for n in noms]})


class BaseDesPosts:
    """Les posts en base ; refuse la colonne `booste_vu_le` si `sans_23` (code 42703)."""

    def __init__(self, lignes, sans_23=False):
        self.lignes, self.sans_23, self.selects = lignes, sans_23, []

    def table(self, _nom):
        return self

    def select(self, colonnes):
        self._colonnes = colonnes
        return self

    def eq(self, *_):
        return self

    def in_(self, _c, ids):
        self._ids = set(ids)
        return self

    def order(self, *_, **__):
        return self

    def limit(self, _n):
        self._ids = {str(r["post_id"]) for r in self.lignes[:1]}
        return self

    def execute(self):
        self.selects.append(self._colonnes)
        if self.sans_23 and "booste_vu_le" in self._colonnes:
            raise Exception("{'code': '42703', 'message': "
                            "'column instagram_organic_posts.booste_vu_le does not exist'}")
        self.data = [r for r in self.lignes if str(r["post_id"]) in self._ids]
        return self


STOCK = "https://x.supabase.co/storage/v1/object/public/post-images/u/"
ECRIT: dict[str, list] = {"fiches": [], "releves": []}
sync.insert_instagram_org = lambda supabase, results: ECRIT["fiches"].extend(results)
sync.insert_instagram_releves = lambda sb, releves: ECRIT["releves"].extend(releves)
sync.televerser_image_instagram = lambda sb, uid, pid, url: f"stock/{pid}.jpg"
http_client.get = FauxGraphLeger()

base = BaseDesPosts([{"post_id": 10, "media_url": STOCK + "10.jpg", "booste_vu_le": "2026-10-01"},
                     {"post_id": 11, "media_url": STOCK + "11.jpg", "booste_vu_le": None},
                     {"post_id": 12, "media_url": STOCK + "12.jpg", "booste_vu_le": "2026-09-15"}])
sync.releve_quotidien(base, "u", ACCES, maintenant=MAINTENANT)
verifier("Léger : relevés au booléen du moment",
         {r["post_id"]: r["booste"] for r in ECRIT["releves"]}, {"10": True, "11": True, "12": False})
verifier("Léger : seule la première vue pose la date ; une date en base n'est ni déplacée ni vidée",
         {f["post_id"]: f.get("booste_vu_le") for f in ECRIT["fiches"]},
         {"10": None, "11": "2026-11-10", "12": None})
verifier("Léger : `booste_vu_le` lu dans la même lecture que l'image",
         any("booste_vu_le" in s and "media_url" in s for s in base.selects), True)

ECRIT["fiches"].clear()
ECRIT["releves"].clear()
# Le 10 publié avant les autres : 11 et 12, absents, sont plus récents que la
# base et s'importent (le léger ne prend que ceux-là, revue de code).
base = BaseDesPosts([{"post_id": 10, "media_url": STOCK + "10.jpg",
                      "date": "2026-11-01T00:00:00+00:00"}], sans_23=True)
sync.releve_quotidien(base, "u", ACCES, maintenant=MAINTENANT)
verifier("Base sans la 23 : la lecture se refait sans la colonne, le passage continue",
         sorted(r["post_id"] for r in ECRIT["releves"]), ["10", "11", "12"])

print()
print("TOUT EST VERT" if not ECHECS else f"{len(ECHECS)} ÉCHEC(S)")
sys.exit(1 if ECHECS else 0)
