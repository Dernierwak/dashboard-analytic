"""Ticket 04 — le passage léger quotidien, sans réseau ni base.

Lancer depuis la racine du dépôt :

    python3.12 -I .scratch/instagram-construction/harnais/04-le-passage-leger/test_passage_leger.py

Trois coutures :
  1. `sync.posts_du_jour` — quels posts sont relevés à quel âge (pur) ;
  2. `sync.releve_quotidien` — inventaire, appels Graph et lignes écrites, avec
     `http_client.get` remplacé par un faux Graph et les écritures Supabase
     capturées ;
  3. `ScheduledUpdate.executer` et `account_sync.leger` — un jour hors Jour de
     travail passe quand même, et le rapport n'est jamais touché par le léger.
"""
from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

RACINE = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(RACINE))

from saas.data.fetch_data.shared import http_client  # noqa: E402
from saas.data.fetch_data.shared.token_status import MORT, VALIDE, TokenStatus  # noqa: E402
from saas.data.fetch_data.sources.meta.graph_client import AccesMeta  # noqa: E402
from saas.data.fetch_data.sources.meta.instagram import sync  # noqa: E402
from saas.data.fetch_data.orchestration import account_sync  # noqa: E402
from saas.data.fetch_data.cockpit import scheduled_update  # noqa: E402

ECHECS: list[str] = []


def verifier(nom, obtenu, attendu):
    if obtenu != attendu:
        ECHECS.append(nom)
        print(f"✗ {nom}\n    obtenu  : {obtenu!r}\n    attendu : {attendu!r}")
    else:
        print(f"✓ {nom}")


MAINTENANT = datetime(2026, 11, 10, 7, 0, tzinfo=timezone.utc)   # un mardi


def _publie(heures: float) -> str:
    """Un horodatage au format de Meta (« +0000 », sans deux-points)."""
    return (MAINTENANT - timedelta(hours=heures)).strftime("%Y-%m-%dT%H:%M:%S+0000")


def _media(pid, heures, produit="FEED", media_type="IMAGE"):
    return {"id": pid, "timestamp": _publie(heures), "media_type": media_type,
            "media_product_type": produit, "caption": f"post {pid}",
            "permalink": f"https://www.instagram.com/p/{pid}/",
            "media_url": f"https://cdn.example/{pid}.jpg"}


# ── 1 · Quels posts sont relevés à quel âge ─────────────────────────────────
inventaire = [_media("1", 1), _media("2", 191), _media("3", 192), _media("4", 193),
              _media("5", 400), {"id": "6", "timestamp": "illisible"},
              {"id": "7", "timestamp": "illisible"}]
en_base = {"1", "2", "3", "4", "6"}
verifier("Relevés : moins de 8 × 24 h, ou absents de la base (fiche neuve)",
         [m["id"] for m in sync.posts_du_jour(inventaire, en_base, MAINTENANT)],
         ["1", "2", "5", "7"])


# ── 2 · Le relevé quotidien d'un compte ─────────────────────────────────────
class _Reponse:
    def __init__(self, corps):
        self._corps = corps

    def json(self):
        return self._corps


def _valeurs(noms):
    return {"data": [{"name": n, "period": "lifetime", "values": [{"value": 3}]}
                     for n in noms]}


class FauxGraph:
    """`/media` rend les pages prévues ; `/insights` rend 3 pour chaque métrique."""

    def __init__(self, pages):
        self.pages = pages
        self.appels: list[tuple[str, str]] = []   # (chemin, métriques ou « page N »)

    def __call__(self, url, *, timeout, params=None, headers=None):
        chemin = urlparse(url).path
        if chemin.endswith("/media"):
            # Page 1 : appelée avec ses paramètres ; les suivantes : l'URL `next` seule.
            n = 0 if params else int(url.rsplit("=", 1)[1])
            if params:
                self.params_inventaire = params
            self.appels.append((chemin, f"page {n}"))
            return _Reponse(self.pages[n])
        if chemin.endswith("/insights"):
            self.appels.append((chemin, params["metric"]))
            return _Reponse(_valeurs(params["metric"].split(",")))
        self.appels.append((chemin, "fiche"))
        raise AssertionError(f"appel inattendu : {chemin}")


class BaseDesPosts:
    """Ne répond qu'à la seule lecture du léger : les posts de l'inventaire déjà en base."""

    def __init__(self, lignes):
        self.lignes = lignes
        self.tables: list[str] = []

    def table(self, nom):
        self.tables.append(nom)
        return self

    def select(self, *_):
        return self

    def eq(self, *_):
        return self

    def in_(self, _colonne, ids):
        self._ids = set(ids)
        return self

    def limit(self, _n):
        self._ids = {str(r["post_id"]) for r in self.lignes[:1]}
        return self

    def execute(self):
        # PostgREST rend `post_id` (bigint) en entier ; le filtre part en chaînes.
        self.data = [r for r in self.lignes if str(r["post_id"]) in self._ids]
        return self


ECRIT: dict[str, list] = {"fiches": [], "releves": [], "images": []}
sync.insert_instagram_org = lambda supabase, results: ECRIT["fiches"].extend(results)
sync.insert_instagram_releves = lambda sb, releves: ECRIT["releves"].extend(releves)
sync.televerser_image_instagram = (lambda sb, uid, pid, url:
                                   ECRIT["images"].append(pid) or f"stock/{pid}.jpg")

STOCK = "https://x.supabase.co/storage/v1/object/public/post-images/u/"
pages = [
    # Page 1 : tout est jeune → la page suivante doit être lue.
    {"data": [_media("10", 2, "REELS", "VIDEO"), _media("11", 30)],
     "paging": {"next": "https://graph.facebook.com/v24.0/ig/media?after=1"}},
    # Page 2 : son plus ancien a passé 8 × 24 h → la lecture s'arrête là.
    {"data": [_media("12", 150), _media("13", 200), _media("14", 300)],
     "paging": {"next": "https://graph.facebook.com/v24.0/ig/media?after=2"}},
    {"data": [_media("99", 900)]},
]
graph = FauxGraph(pages)
http_client.get = graph
base = BaseDesPosts([{"post_id": 10, "media_url": STOCK + "10.jpg"},
                     {"post_id": 11, "media_url": STOCK + "11.jpg"},
                     {"post_id": 13, "media_url": STOCK + "13.jpg"}])
mot = sync.releve_quotidien(base, "u-1", AccesMeta(jeton="faux", instagram="ig"),
                            maintenant=MAINTENANT)

verifier("Inventaire : pages lues jusqu'au premier post de plus de 8 × 24 h",
         [a for c, a in graph.appels if c.endswith("/media")], ["page 0", "page 1"])
verifier("Inventaire : 25 par page, avec de quoi écrire une fiche sans autre appel",
         (graph.params_inventaire["limit"],
          set(graph.params_inventaire["fields"].split(",")) >= {
              "id", "timestamp", "caption", "media_type", "media_url", "thumbnail_url",
              "permalink", "media_product_type"}),
         (25, True))
insights = {}
for chemin, metriques in graph.appels:
    if chemin.endswith("/insights"):
        insights.setdefault(chemin.split("/")[-2], []).append(metriques)
verifier("Appels : 1 pour un Reel, 2 pour un post du fil, aucun pour un post vieux et en base",
         {pid: len(a) for pid, a in insights.items()}, {"10": 1, "11": 2, "12": 2, "14": 2})
verifier("Aucune fiche `/{media-id}` demandée : l'inventaire la porte",
         [c for c, a in graph.appels if a == "fiche"], [])
verifier("Relevés écrits : les jeunes et le neuf, pas le vieux déjà en base",
         sorted(r["post_id"] for r in ECRIT["releves"]), ["10", "11", "12", "14"])
verifier("Le relevé porte l'âge réel du post",
         {r["post_id"]: r["age_heures"] for r in ECRIT["releves"]},
         {"10": 2.0, "11": 30.0, "12": 150.0, "14": 300.0})
verifier("Image : seuls les posts absents du stockage font le trajet",
         sorted(ECRIT["images"]), ["12", "14"])
verifier("Base lue : la seule table des posts, rien d'autre (ni suivi, ni rapport)",
         set(base.tables), {"instagram_organic_posts"})
verifier("Le mot dit ce qui a été fait", mot, "insta léger: 4 posts relevés dont 2 neufs")

# Un compte jamais récolté attend son premier passage complet : le gratuit
# n'y prend que ses 10 plus récents (spec § Le compte gratuit), le léger n'y
# importerait pas 25 posts.
graph = FauxGraph(pages)
http_client.get = graph
ECRIT["releves"].clear()
mot = sync.releve_quotidien(BaseDesPosts([]), "u-2", AccesMeta(jeton="faux", instagram="ig"),
                            maintenant=MAINTENANT)
verifier("Compte sans aucun post en base : aucun appel, rien d'écrit, et ça se dit",
         (graph.appels, ECRIT["releves"], "premier passage" in mot), ([], [], True))

# Une panne de l'inventaire ne passe pas pour un compte sans post neuf.
http_client.get = lambda url, *, timeout, params=None, headers=None: _Reponse(
    {"error": {"code": 190, "message": "Error validating access token"}})
try:
    sync.releve_quotidien(base, "u-1", AccesMeta(jeton="faux", instagram="ig"),
                          maintenant=MAINTENANT)
    leve = None
except ValueError as e:
    leve = "refusé" in str(e)
verifier("Inventaire refusé : le léger lève, il ne dit pas « 0 post »", leve, True)


# ── 3 · Qui passe quel jour ─────────────────────────────────────────────────
VU: list[tuple[str, str]] = []
# `scheduled_update.passage` EST `account_sync` : on garde le vrai léger pour la suite.
LEGER = account_sync.leger
scheduled_update.passage.leger = lambda sb, uid: VU.append(("leger", uid)) or [f"léger {uid}"]
scheduled_update.passage.passer = lambda sb, uid, depuis=None: VU.append(("complet", uid)) or []
scheduled_update.passage.republier = lambda sb, uid: VU.append(("rapport", uid)) or []
scheduled_update.passage.entete = lambda *a: None
scheduled_update.passage.avertir_secrets_google = lambda: None


class Profils:
    def table(self, _):
        return self

    def select(self, *_):
        return self

    def execute(self):
        self.data = [{"id": "lundi", "fetch_schedule": "Monday"},
                     {"id": "mardi", "fetch_schedule": "Tuesday"}]
        return self


scheduled_update.client_service = Profils
scheduled_update.ScheduledUpdate(aujourdhui=MAINTENANT).executer()
verifier("Un mardi : le léger pour tous, le complet pour le seul compte du mardi",
         VU, [("leger", "lundi"), ("leger", "mardi"), ("complet", "mardi")])
VU.clear()
scheduled_update.ScheduledUpdate(seul="lundi", rapport_seulement=True,
                                 aujourdhui=MAINTENANT).executer()
verifier("Rapport seulement : aucun appel aux plateformes, donc pas de léger",
         VU, [("rapport", "lundi")])


# account_sync.leger : seuls les comptes Instagram, jamais de suivi ni de rapport.
APPELS_RELEVE: list[str] = []


def _releve(sb, uid, acces):
    APPELS_RELEVE.append(acces.instagram)
    if acces.instagram == "panne":
        raise RuntimeError("boum")
    return "insta léger: 1 posts relevés dont 0 neufs"


account_sync.leger = LEGER
account_sync.recolte_instagram.releve_quotidien = _releve
account_sync.jeton_meta.verifier = lambda jeton: TokenStatus(MORT if jeton == "mort" else VALIDE, "expiré")
account_sync._marquer = lambda sb, uid, plan: []
account_sync.Suivi = None                    # le toucher lèverait : le léger n'écrit aucun suivi
account_sync.publish_weekly_report = None


def _connexions(lignes):
    account_sync.connexions = lambda sb, uid: lignes


_connexions([{"id": "g", "provider": "google", "google_refresh_token": "r"},
             {"id": "m", "provider": "meta", "meta_token": "ok", "instagram_business_id": "ig-1"}])
logs = account_sync.leger(None, "u-1")
verifier("Léger : le compte Instagram est relevé, Google n'est pas appelé", APPELS_RELEVE, ["ig-1"])
verifier("Léger : une ligne de journal donne la durée du passage",
         len(logs) == 1 and logs[0].startswith("instagram léger en ") and " s — insta léger:" in logs[0],
         True)

APPELS_RELEVE.clear()
_connexions([{"id": "m", "provider": "meta", "meta_token": "ok"}])
verifier("Léger : sans compte Instagram, rien n'est appelé et rien n'est dit",
         (account_sync.leger(None, "u-1"), APPELS_RELEVE), ([], []))

_connexions([{"id": "m", "provider": "meta", "meta_token": "mort", "instagram_business_id": "ig-2"}])
logs = account_sync.leger(None, "u-1")
verifier("Léger : jeton mort → pas d'appel, le journal le dit",
         (APPELS_RELEVE, any("mort" in l for l in logs)), ([], True))

_connexions([{"id": "m", "provider": "meta", "meta_token": "ok", "instagram_business_id": "panne"}])
logs = account_sync.leger(None, "u-1")
verifier("Léger : une panne se journalise sans faire tomber les autres comptes",
         len(logs) == 1 and "instagram léger KO" in logs[0] and "RuntimeError" in logs[0], True)

print()
print("TOUT EST VERT" if not ECHECS else f"{len(ECHECS)} ÉCHEC(S)")
sys.exit(1 if ECHECS else 0)
