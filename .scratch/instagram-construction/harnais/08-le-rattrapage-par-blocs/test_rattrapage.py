"""Ticket 08 — le Rattrapage par blocs, sans réseau ni base.

Lancer depuis la racine du dépôt :

    python3.12 -I .scratch/instagram-construction/harnais/08-le-rattrapage-par-blocs/test_rattrapage.py

Coutures :
  1. `sync.posts_a_relire` — le passage complet d'un payant ne prend plus que
     les absents de moins de 30 jours (le reste est au Rattrapage) ;
  2. `sync.rattrapage(sb, uid, acces, connexion_id, maintenant)` — un bloc par
     passage, curseur repris en base, fin d'inventaire, gratuit exclu, curseur
     refusé, panne, colonne absente — `http_client.get` remplacé par un faux
     Graph, Supabase par un faux client ;
  3. `account_sync.leger` — le bloc s'ajoute au passage léger, avec sa durée ;
  4. la migration — les deux colonnes de la section 23 et leur contrôle.
"""
from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

RACINE = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(RACINE))

from saas.data.fetch_data.shared import http_client  # noqa: E402
from saas.data.fetch_data.shared.token_status import VALIDE, TokenStatus  # noqa: E402
from saas.data.fetch_data.sources.meta.graph_client import AccesMeta  # noqa: E402
from saas.data.fetch_data.sources.meta.instagram import sync  # noqa: E402
from saas.data.fetch_data.orchestration import account_sync  # noqa: E402

ECHECS: list[str] = []


def verifier(nom, obtenu, attendu):
    if obtenu != attendu:
        ECHECS.append(nom)
        print(f"✗ {nom}\n    obtenu  : {obtenu!r}\n    attendu : {attendu!r}")
    else:
        print(f"✓ {nom}")


MAINTENANT = datetime(2026, 11, 10, 7, 0, tzinfo=timezone.utc)
STOCK = "https://x.supabase.co/storage/v1/object/public/post-images/u/{}.jpg"
ACCES = AccesMeta(jeton="faux", instagram="ig")


def _publie(heures: float) -> str:
    return (MAINTENANT - timedelta(hours=heures)).strftime("%Y-%m-%dT%H:%M:%S+0000")


# ── 1 · Le passage complet d'un payant : les absents récents seulement ─────
# 300 posts, un toutes les 12 h : le 60e a 709 h (< 30 jours), le 61e 721 h.
inventaire = [{"id": str(i), "timestamp": _publie(1 + (i - 1) * 12)} for i in range(1, 301)]
connus = {str(i): {"media_url": STOCK.format(i)} for i in range(1, 41)}
liste = sync.posts_a_relire(inventaire, connus, MAINTENANT, is_paid=True)
verifier("Complet payant : les absents de moins de 30 jours s'ajoutent (41 à 60)",
         [p for p in liste if int(p) > 40], [str(i) for i in range(41, 61)])
verifier("Complet payant à l'arrivée : les 60 posts de moins de 30 jours, pas les 300",
         sync.posts_a_relire(inventaire, {}, MAINTENANT, is_paid=True),
         [str(i) for i in range(1, 61)])
verifier("Complet gratuit à l'arrivée : toujours ses 10 plus récents",
         sync.posts_a_relire(inventaire, {}, MAINTENANT, is_paid=False),
         [str(i) for i in range(1, 11)])


# ── 2 · Le Rattrapage ───────────────────────────────────────────────────────
class _Reponse:
    def __init__(self, corps):
        self._corps = corps

    def json(self):
        return self._corps


def _media(pid, heures):
    return {"id": pid, "timestamp": _publie(heures), "media_type": "IMAGE",
            "media_product_type": "FEED", "caption": f"post {pid}",
            "media_url": f"https://cdn.example/{pid}.jpg"}


# L'inventaire, en pages de 3 (le bloc est réglé à 3 pour le harnais) : la clé
# est le curseur `after` envoyé, None pour le haut de l'inventaire.
PAGES = {
    None: {"data": [_media("1", 10), _media("2", 20), _media("3", 30)],
           "paging": {"cursors": {"after": "c1"}, "next": "https://graph/ig/media?after=c1"}},
    "c1": {"data": [_media("4", 900), _media("5", 1000), _media("6", 1100)],
           "paging": {"cursors": {"after": "c2"}, "next": "https://graph/ig/media?after=c2"}},
    # Dernière page : Meta rend encore `cursors.after`, mais plus de `next`.
    "c2": {"data": [_media("7", 2000)], "paging": {"cursors": {"after": "c3"}}},
}


class FauxGraph:
    def __init__(self, insights_ok=True):
        self.insights_ok = insights_ok
        self.pages_lues: list = []
        self.insights = 0

    def __call__(self, url, *, timeout, params=None, headers=None):
        chemin = urlparse(url).path
        if chemin.endswith("/media"):
            apres = (params or {}).get("after")
            self.pages_lues.append(apres)
            self.limite = params.get("limit")
            if apres not in PAGES:
                return _Reponse({"error": {"code": 100, "message": "Invalid cursor"}})
            return _Reponse(PAGES[apres])
        if chemin.endswith("/insights"):
            self.insights += 1
            if not self.insights_ok:
                return _Reponse({"error": {"code": 190, "message": "jeton expiré"}})
            return _Reponse({"data": [{"name": n, "values": [{"value": 3}]}
                                      for n in params["metric"].split(",")]})
        raise AssertionError(f"appel inattendu : {chemin}")


class Base:
    """`profiles`, `connected_accounts` et la lecture des posts de la page."""

    def __init__(self, is_paid=True, curseur=None, fini_le=None, posts=(),
                 colonnes=True, update_touche=True):
        self.is_paid, self.colonnes, self.update_touche = is_paid, colonnes, update_touche
        self.etat = {"rattrapage_instagram_curseur": curseur,
                     "rattrapage_instagram_fini_le": fini_le}
        self.posts = set(posts)
        self.updates: list[dict] = []

    def table(self, nom):
        self._nom, self._update, self._ids = nom, None, None
        return self

    def select(self, colonnes):
        self._colonnes = colonnes
        return self

    def update(self, champs):
        self._update = champs
        return self

    def eq(self, *_):
        return self

    def in_(self, _col, ids):
        self._ids = set(ids)
        return self

    def execute(self):
        if self._nom == "profiles":
            self.data = [{"is_paid": self.is_paid}]
        elif self._nom == "connected_accounts":
            if not self.colonnes:
                champ = "rattrapage_instagram_curseur"
                raise Exception(f"{{'code': '42703', 'message': 'column {champ} does not exist'}}")
            if self._update is not None:
                self.updates.append(self._update)
                self.etat.update(self._update)
                self.data = [{"id": "m"}] if self.update_touche else []
            else:
                self.data = [{"id": "m", **self.etat}]
        elif self._nom == "instagram_organic_posts":
            self.data = [{"post_id": int(p), "media_url": STOCK.format(p)}
                         for p in self.posts if p in (self._ids or set())]
        else:
            raise AssertionError(f"table inattendue : {self._nom}")
        return self


ECRIT: dict[str, list] = {"fiches": [], "releves": [], "images": []}


def _effacer():
    for v in ECRIT.values():
        v.clear()


sync.insert_instagram_org = lambda supabase, results: ECRIT["fiches"].extend(results)
sync.insert_instagram_releves = lambda sb, releves: ECRIT["releves"].extend(releves)
sync.televerser_image_instagram = (lambda sb, uid, pid, url:
                                   ECRIT["images"].append(pid) or STOCK.format(pid))
sync._TAILLE_DU_BLOC = 3


def passer(base, graph=None):
    http_client.get = graph or FauxGraph()
    return sync.rattrapage(base, "u-1", ACCES, "m", maintenant=MAINTENANT), http_client.get


# Gratuit : rien n'est lu, rien n'est écrit.
base = Base(is_paid=False)
mot, graph = passer(base)
verifier("Gratuit exclu : aucun appel, aucun curseur écrit",
         (graph.pages_lues, base.updates, "gratuit" in mot), ([], [], True))

# Payant, 3 plus récents déjà en base : la page du haut est sautée (1 appel),
# le bloc suivant est importé, le curseur s'arrête après lui.
base = Base(posts={"1", "2", "3"})
_effacer()
mot, graph = passer(base)
verifier("Passage 1 : page connue sautée, le bloc suivant lu, puis arrêt",
         graph.pages_lues, [None, "c1"])
verifier("Passage 1 : les pages demandent la taille du bloc", graph.limite, 3)
verifier("Passage 1 : les 3 absents importés (fiche, relevé, image)",
         ([f["post_id"] for f in ECRIT["fiches"]], len(ECRIT["releves"]), ECRIT["images"]),
         (["4", "5", "6"], 3, ["4", "5", "6"]))
verifier("Passage 1 : curseur gardé en base, pas fini",
         base.etat, {"rattrapage_instagram_curseur": "c2", "rattrapage_instagram_fini_le": None})

# Passage 2 : reprend où le précédent s'est arrêté ; plus de `next` → fini.
base.posts |= {"4", "5", "6"}
_effacer()
mot, graph = passer(base)
verifier("Passage 2 : reprise au curseur gardé", graph.pages_lues, ["c2"])
verifier("Passage 2 : le dernier post importé", [f["post_id"] for f in ECRIT["fiches"]], ["7"])
verifier("Passage 2 : fin d'inventaire — curseur vidé, date de fin posée",
         base.etat, {"rattrapage_instagram_curseur": None,
                     "rattrapage_instagram_fini_le": MAINTENANT.isoformat()})

# Passage 3 : fini, plus rien n'est lu.
mot, graph = passer(base)
verifier("Passage 3 : Rattrapage fini, aucun appel", (graph.pages_lues, "fini" in mot), ([], True))

# Curseur refusé par Meta (post supprimé, curseur périmé) : reprise du haut.
base = Base(curseur="perime", posts={"1", "2", "3"})
_effacer()
mot, graph = passer(base)
# « perime » deux fois : la page refusée est relue sans `boost_ads_list` (un
# champ refusé fait échouer toute la page) avant de conclure au curseur.
verifier("Curseur refusé : reprise du haut de l'inventaire, et ça se dit",
         (graph.pages_lues, "reprise du haut" in mot), (["perime", "perime", None, "c1"], True))
verifier("Curseur refusé : le bloc est quand même importé",
         [f["post_id"] for f in ECRIT["fiches"]], ["4", "5", "6"])

# Inventaire refusé même du haut (jeton) : lève, le curseur ne bouge pas.
base = Base(curseur="perime")
http_client.get = FauxGraph()
PAGES_SAUVES, PAGES[None] = PAGES[None], {"error": {"code": 190, "message": "jeton"}}
try:
    sync.rattrapage(base, "u-1", ACCES, "m", maintenant=MAINTENANT)
    leve = False
except ValueError:
    leve = True
PAGES[None] = PAGES_SAUVES
verifier("Inventaire refusé : lève, curseur intact", (leve, base.updates), (True, []))

# Panne des insights sur tout le bloc : rien d'écrit, curseur laissé AVANT la
# page — elle sera relue demain. La page connue sautée, elle, est acquise.
base = Base(posts={"1", "2", "3"})
_effacer()
mot, graph = passer(base, FauxGraph(insights_ok=False))
verifier("Panne du bloc : aucune fiche, aucun relevé, aucune image",
         (ECRIT["fiches"], ECRIT["releves"], ECRIT["images"]), ([], [], []))
verifier("Panne du bloc : curseur posé avant le bloc, il sera repris",
         base.etat["rattrapage_instagram_curseur"], "c1")

# Colonnes absentes (section 23 non jouée) : rien n'est lu.
base = Base(colonnes=False)
mot, graph = passer(base)
verifier("Colonnes absentes : aucun appel, le mot nomme la migration",
         (graph.pages_lues, "000_run_me_all.sql" in mot), ([], True))

# L'update touche zéro ligne (`CLAUDE.md` §8) : ça se dit.
base = Base(posts={"1", "2", "3"}, update_touche=False)
mot, graph = passer(base)
verifier("Curseur non écrit (0 ligne) : le mot le dit", "NON écrit" in mot, True)

# Coupe-circuit : une suite de pages toutes connues s'arrête au plafond, et la
# progression est gardée.
sync._PAGES_PAR_PASSAGE_MAX = 1
base = Base(posts={"1", "2", "3"})
mot, graph = passer(base)
verifier("Plafond de pages : arrêt après 1 page, curseur avancé",
         (graph.pages_lues, base.etat["rattrapage_instagram_curseur"]), ([None], "c1"))


# ── 3 · Le bloc dans le passage léger ───────────────────────────────────────
VU: list = []
account_sync.recolte_instagram.releve_quotidien = lambda sb, uid, acces: "insta léger: 0 posts"
account_sync.releve_compte.releve_du_compte = lambda sb, uid, acces: "compte: ok"
account_sync.recolte_instagram.rattrapage = (
    lambda sb, uid, acces, connexion_id: VU.append((acces.instagram, connexion_id))
    or "rattrapage: 3 posts importés")
account_sync.jeton_meta.verifier = lambda jeton: TokenStatus(VALIDE, "")
account_sync._marquer = lambda sb, uid, plan: []
account_sync.connexions = lambda sb, uid: [
    {"id": "m", "provider": "meta", "meta_token": "ok", "instagram_business_id": "ig-1"}]
logs = account_sync.leger(None, "u-1")
verifier("Léger : un bloc du Rattrapage par connexion Instagram", VU, [("ig-1", "m")])
verifier("Léger : la ligne porte le bloc et sa propre durée",
         len(logs) == 1 and "rattrapage: 3 posts importés en " in logs[0], True)


def _panne(*_):
    raise RuntimeError("boum")


account_sync.recolte_instagram.rattrapage = _panne
logs = account_sync.leger(None, "u-1")
verifier("Léger : une panne du bloc n'emporte ni les posts ni le compte",
         ("rattrapage KO" in logs[0], "insta léger" in logs[0], "compte: ok" in logs[0]),
         (True, True, True))


# ── 4 · La migration ────────────────────────────────────────────────────────
sql = (RACINE / "saas/data/supabase/migrations/000_run_me_all.sql").read_text()
compact = sql.replace(" ", "")
verifier("Section 23 : les deux colonnes du Rattrapage, ajout seul, et leur contrôle",
         ("ADD COLUMN IF NOT EXISTS rattrapage_instagram_curseur text DEFAULT NULL" in sql,
          "ADD COLUMN IF NOT EXISTS rattrapage_instagram_fini_le timestamptz DEFAULT NULL" in sql,
          "('c','connected_accounts','rattrapage_instagram_curseur')" in compact,
          "('c','connected_accounts','rattrapage_instagram_fini_le')" in compact),
         (True, True, True, True))

print()
print("TOUT EST VERT" if not ECHECS else f"{len(ECHECS)} ÉCHEC(S)")
sys.exit(1 if ECHECS else 0)
