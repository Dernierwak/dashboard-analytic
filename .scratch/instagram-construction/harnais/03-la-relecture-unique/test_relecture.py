"""Ticket 03 — la relecture unique de tous les posts en base, sans réseau ni base.

Lancer depuis la racine du dépôt :

    python3.12 -I .scratch/instagram-construction/harnais/03-la-relecture-unique/test_relecture.py

Trois coutures :
  1. `sync.relire_tous` — les posts relus sont TOUS ceux de la base (au-delà de
     1 000 : pagination, `CLAUDE.md` §8) et SEULEMENT eux (aucun inventaire
     `/media`), 2 à 3 appels par post, sans image ; avec `http_client.get`
     remplacé par un faux Graph et les écritures Supabase capturées ;
  2. `cockpit/instagram_reread.py` — le mode : un compte ou tous, jamais de
     rapport ni de `fetch_progress`, un jeton mort sans appel ;
  3. `.github/workflows/weekly-fetch.yml` — le drapeau passe par l'environnement,
     jamais interpolé dans le script.
"""
from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import yaml

RACINE = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(RACINE))

from saas.data.fetch_data.shared import http_client  # noqa: E402
from saas.data.fetch_data.shared.token_status import MORT, VALIDE, TokenStatus  # noqa: E402
from saas.data.fetch_data.sources.meta.graph_client import AccesMeta  # noqa: E402
from saas.data.fetch_data.sources.meta.instagram import sync  # noqa: E402
from saas.data.fetch_data.cockpit import instagram_reread  # noqa: E402

ECHECS: list[str] = []


def verifier(nom, obtenu, attendu):
    if obtenu != attendu:
        ECHECS.append(nom)
        print(f"✗ {nom}\n    obtenu  : {obtenu!r}\n    attendu : {attendu!r}")
    else:
        print(f"✓ {nom}")


MAINTENANT = datetime(2026, 11, 10, 7, 0, tzinfo=timezone.utc)
UID = "u-1"


class _Reponse:
    def __init__(self, corps):
        self._corps = corps

    def json(self):
        return self._corps


# Les posts que le faux Graph connaît, par id : produit, et ce qu'il rend.
REELS = {"2", "5"}          # deux Reels
SUPPRIMES = {"4"}           # supprimé chez Meta : la fiche est refusée
BOOSTES = {"3", "6"}        # une annonce active ; « 6 » a déjà sa date en base
ANNONCE_ERREUR = {"7"}      # une annonce `error` seule : pas boosté


def _fiche(pid: str) -> dict:
    produit = "REELS" if pid in REELS else "FEED"
    fiche = {"id": pid, "media_type": "VIDEO" if pid in REELS else "IMAGE",
             "media_product_type": produit, "caption": f"post {pid}",
             "timestamp": "2026-01-01T00:00:00+0000",
             "permalink": f"https://www.instagram.com/p/{pid}/",
             "media_url": f"https://cdn.example/{pid}.jpg"}
    if pid in BOOSTES:
        fiche["boost_ads_list"] = {"data": [{"ad_id": "a1", "ad_status": "ACTIVE"}]}
    elif pid in ANNONCE_ERREUR:
        fiche["boost_ads_list"] = {"data": [{"ad_id": "a9", "ad_status": "ERROR"}]}
    return fiche


class FauxGraph:
    def __init__(self):
        self.appels: list[tuple[str, str]] = []   # (post_id ou chemin, nature)

    def __call__(self, url, *, timeout, params=None, headers=None):
        morceaux = urlparse(url).path.strip("/").split("/")
        if morceaux[-1] == "media":
            self.appels.append(("media", "inventaire"))
            raise AssertionError("la relecture ne lit pas l'inventaire")
        if morceaux[-1] == "insights":
            pid, metriques = morceaux[-2], params["metric"].split(",")
            self.appels.append((pid, "insights"))
            if pid in REELS and "follows" in metriques:
                return _Reponse({"error": {"code": 100, "message": "does not support"}})
            return _Reponse({"data": [{"name": n, "values": [{"value": 7}]}
                                      for n in metriques]})
        pid = morceaux[-1]
        self.appels.append((pid, "fiche"))
        if pid in SUPPRIMES:
            return _Reponse({"error": {"code": 100, "message": "Object does not exist"}})
        return _Reponse(_fiche(pid))


class BaseDesPosts:
    """La seule lecture de la relecture : les posts du compte, page par page.

    Comme PostgREST, elle ne rend JAMAIS plus de 1 000 lignes par requête : un
    `range` plus large est tronqué en silence (`CLAUDE.md` §8)."""

    PLAFOND = 1000

    def __init__(self, lignes):
        self.lignes = lignes
        self.tables: list[str] = []
        self.ranges: list[tuple[int, int]] = []

    def table(self, nom):
        self.tables.append(nom)
        self._debut, self._fin, self._uid, self._ordre = 0, None, None, None
        return self

    def select(self, *_):
        return self

    def eq(self, colonne, valeur):
        if colonne == "user_id":
            self._uid = valeur
        return self

    def order(self, colonne, **_):
        self._ordre = colonne
        return self

    def range(self, debut, fin):
        self.ranges.append((debut, fin))
        self._debut, self._fin = debut, fin
        return self

    def execute(self):
        lignes = [r for r in self.lignes if r["user_id"] == self._uid]
        if self._ordre:
            lignes.sort(key=lambda r: r[self._ordre])
        fin = self._fin + 1 if self._fin is not None else len(lignes)
        self.data = lignes[self._debut:min(fin, self._debut + self.PLAFOND)]
        return self


ECRIT: dict[str, list] = {"lots_fiches": [], "lots_releves": [], "images": []}
sync.insert_instagram_org = lambda supabase, results: ECRIT["lots_fiches"].append(list(results))
sync.insert_instagram_releves = lambda sb, releves: ECRIT["lots_releves"].append(list(releves))
sync.televerser_image_instagram = (lambda sb, uid, pid, url:
                                   ECRIT["images"].append(pid) or f"stock/{pid}.jpg")


def _fiches():
    return [f for lot in ECRIT["lots_fiches"] for f in lot]


def _releves():
    return [r for lot in ECRIT["lots_releves"] for r in lot]


ACCES = AccesMeta(jeton="faux", instagram="ig")

# ── 1 · Un petit compte : ce que la relecture écrit ─────────────────────────
graph = FauxGraph()
http_client.get = graph
lignes = [{"user_id": UID, "post_id": int(p), "media_url": f"https://cdn.example/{p}.jpg",
           "booste_vu_le": "2026-03-01" if p == "6" else None} for p in "1234567"]
# Un post d'un AUTRE compte, jamais relu.
lignes.append({"user_id": "autre", "post_id": 99, "media_url": None, "booste_vu_le": None})
base = BaseDesPosts(lignes)
mot = sync.relire_tous(base, UID, ACCES, maintenant=MAINTENANT)

par_post: dict[str, list[str]] = {}
for pid, nature in graph.appels:
    par_post.setdefault(pid, []).append(nature)
verifier("Seuls les posts du compte en base sont lus, aucun inventaire /media",
         sorted(par_post), ["1", "2", "3", "4", "5", "6", "7"])
# Un post supprimé coûte 2 fiches et aucun insights : la fiche refusée se
# relit sans `boost_ads_list` (repli du ticket 02), puis plus rien.
verifier("Appels : 3 pour un post du fil, 2 pour un Reel, 2 fiches seules pour un supprimé",
         {p: len(a) for p, a in par_post.items()},
         {"1": 3, "2": 2, "3": 3, "4": 2, "5": 2, "6": 3, "7": 3})
verifier("Sans image : aucun téléversement, aucune media_url envoyée",
         (ECRIT["images"], [f["post_id"] for f in _fiches() if "media_url" in f]), ([], []))
fiches = {f["post_id"]: f for f in _fiches()}
verifier("Post supprimé : ni fiche ni relevé (ses valeurs restent, le nettoyage les verra)",
         ("4" in fiches, "4" in {r["post_id"] for r in _releves()}), (False, False))
verifier("media_product_type, permalink, shares, profile_visits remplis sur un post du fil",
         {k: fiches["1"].get(k) for k in ("media_product_type", "permalink", "shares",
                                          "profile_visits")},
         {"media_product_type": "FEED", "permalink": "https://www.instagram.com/p/1/",
          "shares": 7, "profile_visits": 7})
verifier("Reel : j'aime lus, follows et profile_visits vidés (None, jamais 0)",
         {k: fiches["2"].get(k, "absent") for k in ("likes", "follows", "profile_visits")},
         {"likes": 7, "follows": None, "profile_visits": None})
verifier("booste_vu_le posé à la première vue, jamais renvoyé s'il est déjà en base, "
         "pas posé pour une annonce `error` seule",
         {p: fiches[p].get("booste_vu_le") for p in ("3", "6", "7")},
         {"3": "2026-11-10", "6": None, "7": None})
verifier("Chaque post relu a son relevé, avec son âge réel",
         sorted((r["post_id"], r["age_heures"]) for r in _releves()),
         [(p, 7519.0) for p in ("1", "2", "3", "5", "6", "7")])
verifier("Rien d'autre n'est lu que la table des posts (ni suivi, ni rapport, ni profil)",
         set(base.tables), {"instagram_organic_posts"})
verifier("Le mot dit ce qui a été fait", mot,
         "insta relecture: 7 posts en base, 6 relus, 1 refusé(s)")

# ── 2 · Au-delà de 1 000 posts : la pagination, et l'écriture par lots ──────
REELS.clear(), SUPPRIMES.clear(), BOOSTES.clear(), ANNONCE_ERREUR.clear()
graph = FauxGraph()
http_client.get = graph
ECRIT["lots_fiches"].clear(), ECRIT["lots_releves"].clear()
grande = BaseDesPosts([{"user_id": UID, "post_id": p, "media_url": None,
                        "booste_vu_le": None} for p in range(1, 2502)])
sync.relire_tous(grande, UID, ACCES, maintenant=MAINTENANT)
relus = {p for p, n in graph.appels if n == "fiche"}
verifier("2 501 posts en base : les 2 501 sont relus, aucun tronqué à 1 000",
         len(relus), 2501)
verifier("Chaque post relu une seule fois", sum(1 for _, n in graph.appels if n == "fiche"), 2501)
verifier("Lecture paginée par tranches de 1 000",
         grande.ranges, [(0, 999), (1000, 1999), (2000, 2999)])
verifier("Écriture par lots : une coupure du job ne perd pas tout ce qui a été relu",
         (len(ECRIT["lots_fiches"]) > 1, len(_fiches()), len(_releves())), (True, 2501, 2501))

# ── 3 · Le mode du cockpit ──────────────────────────────────────────────────
APPELS: list[tuple[str, str]] = []


class BaseDuMode:
    """Profils et connexions — ce que lit le cockpit avant d'appeler la relecture."""

    def __init__(self, profils, connexions):
        self.profils, self.connexions = profils, connexions
        self.tables: list[str] = []

    def table(self, nom):
        self.tables.append(nom)
        self._nom, self._uid = nom, None
        return self

    def select(self, *_):
        return self

    def update(self, _champs):
        # Le passage complet pose sa date (ticket 07) ; ce harnais ne la
        # vérifie pas, le harnais 07 le fait.
        return self

    def eq(self, colonne, valeur):
        self._uid = valeur
        return self

    def execute(self):
        if self._nom == "profiles":
            self.data = self.profils
        else:
            self.data = [c for c in self.connexions if c["user_id"] == self._uid]
        return self


def _faux_relire(sb, uid, acces, maintenant=None):
    APPELS.append((uid, acces.instagram))
    return f"insta relecture: {uid}"


MARQUES: list[str] = []
instagram_reread.recolte_instagram.relire_tous = _faux_relire
instagram_reread.marquer_a_reconnecter = (lambda sb, uid, connexion, raison:
                                          MARQUES.append(connexion["id"]) or True)
instagram_reread.passage.verifier_jetons = lambda lignes: {
    c["id"]: TokenStatus(MORT if c["meta_token"] == "mort" else VALIDE, "") for c in lignes}
connexions = [
    {"id": "c1", "user_id": "u-1", "provider": "meta", "meta_token": "bon",
     "instagram_business_id": "ig-1"},
    {"id": "c2", "user_id": "u-2", "provider": "meta", "meta_token": "bon",
     "instagram_business_id": None},                               # Meta Ads seul
    {"id": "c3", "user_id": "u-3", "provider": "meta", "meta_token": "mort",
     "instagram_business_id": "ig-3"},
    {"id": "c4", "user_id": "u-4", "provider": "meta", "meta_token": "bon",
     "instagram_business_id": "ig-4"},
]
profils = [{"id": u} for u in ("u-1", "u-2", "u-3", "u-4")]

sb = BaseDuMode(profils, connexions)
code = instagram_reread.main([], sb=sb)
verifier("Sans --user : chaque compte Instagram au jeton valide, et lui seul",
         APPELS, [("u-1", "ig-1"), ("u-4", "ig-4")])
verifier("Le jeton mort est marqué à reconnecter, comme son journal l'annonce",
         MARQUES, ["c3"])
verifier("Aucun suivi ni rapport : seules profiles et connected_accounts sont lues",
         set(sb.tables), {"profiles", "connected_accounts"})
verifier("Un jeton mort ne fait pas échouer le mode", code, 0)

APPELS.clear()
instagram_reread.main(["--user", "u-4"], sb=BaseDuMode(profils, connexions))
verifier("--user : ce compte seul", APPELS, [("u-4", "ig-4")])


def _en_panne(sb, uid, acces, maintenant=None):
    APPELS.append((uid, acces.instagram))
    raise RuntimeError("https://graph.facebook.com/x?access_token=SECRET boum")


APPELS.clear()
instagram_reread.recolte_instagram.relire_tous = _en_panne
code = instagram_reread.main([], sb=BaseDuMode(profils, connexions))
verifier("Un compte en panne ne coupe pas les suivants, et la run finit en rouge",
         (APPELS, code), ([("u-1", "ig-1"), ("u-4", "ig-4")], 1))

# ── 4 · Le drapeau du workflow ──────────────────────────────────────────────
flux = yaml.safe_load((RACINE / ".github/workflows/weekly-fetch.yml").read_text())
# PyYAML lit la clé `on` comme le booléen True (YAML 1.1).
entrees = (flux.get("on") or flux[True])["workflow_dispatch"]["inputs"]
etape = next(s for s in flux["jobs"]["fetch"]["steps"] if s.get("name") == "Run fetch worker")
verifier("Le drapeau existe, booléen, faux par défaut (le web dispatche sans lui)",
         {k: entrees["relecture_instagram"].get(k) for k in ("type", "default")},
         {"type": "boolean", "default": False})
verifier("Il passe par l'environnement", etape["env"].get("RELECTURE_IG"),
         "${{ inputs.relecture_instagram }}")
verifier("Aucune interpolation `${{ }}` dans le script", "${{" in etape["run"], False)
verifier("Le script lance le mode sur la chaîne \"true\" seulement",
         ('[ "$RELECTURE_IG" = "true" ]' in etape["run"],
          "instagram_reread.py" in etape["run"]), (True, True))

print()
if ECHECS:
    print(f"{len(ECHECS)} ÉCHEC(S)")
    sys.exit(1)
print("TOUT EST VERT")
