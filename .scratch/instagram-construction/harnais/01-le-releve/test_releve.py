"""Ticket 01 — « réponse Graph → lignes à écrire », sans réseau.

Lancer depuis la racine du dépôt :

    python3.12 -I .scratch/instagram-construction/harnais/01-le-releve/test_releve.py

`http_client.get` est remplacé par un faux qui rend des réponses Graph écrites
à la main (formes relevées par l'essai réel, `.scratch/instagram/issues/17`) :
rien ne part chez Meta, rien ne s'écrit chez Supabase.
"""
from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

RACINE = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(RACINE))

from saas.data.fetch_data.shared import http_client  # noqa: E402
from saas.data.fetch_data.sources.meta.graph_client import AccesMeta  # noqa: E402
from saas.data.fetch_data.sources.meta.instagram.fetchers import post_metrics  # noqa: E402
from saas.data.fetch_data.sources.meta.instagram import sync  # noqa: E402

ACCES = AccesMeta(jeton="faux", instagram="17840000000000000")
ERREUR_100_FOLLOWS = {"error": {"code": 100, "message":
                      "(#100) does not support the follows metric for this media product type"}}
ERREUR_190 = {"error": {"code": 190, "message": "Error validating access token"}}


class _Reponse:
    def __init__(self, corps):
        self._corps = corps

    def json(self):
        return self._corps


def _valeurs(**metriques):
    return {"data": [{"name": k, "period": "lifetime", "values": [{"value": v}]}
                     for k, v in metriques.items()]}


class FauxGraph:
    """Rend, pour chaque liste de métriques demandée, la réponse prévue ;
    garde la trace des appels pour vérifier ce qui a été DEMANDÉ."""

    def __init__(self, reponses: dict[frozenset, dict]):
        self.reponses = reponses
        self.appels: list[frozenset] = []

    def __call__(self, url, *, timeout, params=None, headers=None):
        demandees = frozenset(params["metric"].split(","))
        self.appels.append(demandees)
        return _Reponse(self.reponses[demandees])


PRINCIPALES = frozenset("reach,views,likes,comments,saved,shares".split(","))
REEL = PRINCIPALES | {"ig_reels_avg_watch_time"}
ABONNES = frozenset({"follows", "profile_visits"})


def _lire(media_product_type, reponses):
    faux = FauxGraph(reponses)
    http_client.get = faux
    return post_metrics.metriques_du_post(ACCES, "1", media_product_type), faux.appels


ECHECS: list[str] = []


def verifier(nom, obtenu, attendu):
    if obtenu != attendu:
        ECHECS.append(nom)
        print(f"✗ {nom}\n    obtenu  : {obtenu!r}\n    attendu : {attendu!r}")
    else:
        print(f"✓ {nom}")


# ── R1 : les métriques choisies par media_product_type ──────────────────────

m, appels = _lire("REELS", {REEL: _valeurs(reach=120, views=300, likes=9, comments=1,
                                           saved=2, shares=3, ig_reels_avg_watch_time=4100)})
verifier("Reel : un seul appel, temps de visionnage compris, jamais follows", appels, [REEL])
verifier("Reel : la vidéo retrouve ses j'aime, follows absent = None",
         m, {"reach": 120, "views": 300, "likes": 9, "comments": 1, "saved": 2, "shares": 3,
             "avg_watch_time": 4100, "follows": None, "profile_visits": None})

m, appels = _lire("REELS", {REEL: {"error": {"code": 100, "message": "(#100) metric not supported"}},
                            PRINCIPALES: _valeurs(reach=120, views=300, likes=9, comments=1,
                                                  saved=2, shares=3)})
verifier("Reel : temps de visionnage refusé → la portée n'est pas emportée",
         (m["reach"], m["avg_watch_time"]), (120, None))

m, appels = _lire("FEED", {PRINCIPALES: _valeurs(reach=50, views=80, likes=4, comments=0,
                                                 saved=1, shares=0),
                           ABONNES: _valeurs(follows=0, profile_visits=7)})
verifier("Fil : deux appels, follows et visites du profil à part", appels, [PRINCIPALES, ABONNES])
verifier("Fil : 0 rendu reste 0 (follows, comments, shares)",
         (m["follows"], m["comments"], m["shares"], m["profile_visits"]), (0, 0, 0, 7))
verifier("Fil : pas de temps de visionnage demandé → None", m["avg_watch_time"], None)

# ── R4 : sans media_product_type, FEED sans follows ─────────────────────────

m, appels = _lire(None, {PRINCIPALES: _valeurs(reach=50, views=80, likes=4, comments=0,
                                               saved=1, shares=0)})
verifier("Sans media_product_type : un appel FEED, follows jamais demandé", appels, [PRINCIPALES])
verifier("Sans media_product_type : follows None", m["follows"], None)

# ── R2, R3 : une métrique non rendue reste absente ──────────────────────────

m, _ = _lire("FEED", {PRINCIPALES: _valeurs(reach=50, views=80),
                      ABONNES: ERREUR_100_FOLLOWS})
verifier("Métrique absente de la réponse → None, jamais 0",
         (m["likes"], m["saved"], m["shares"]), (None, None, None))
verifier("Erreur 100 sur follows → follows et visites None, la portée reste",
         (m["follows"], m["profile_visits"], m["reach"]), (None, None, 50))

# ── Une panne n'est pas une absence ─────────────────────────────────────────

m, _ = _lire("FEED", {PRINCIPALES: ERREUR_190})
verifier("Appel principal en erreur → aucune métrique (None), pas des zéros", m, None)

m, _ = _lire("FEED", {PRINCIPALES: _valeurs(reach=50, views=80, likes=4, comments=0,
                                            saved=1, shares=0),
                      ABONNES: ERREUR_190})
verifier("Second appel en erreur hors 100 → la lecture entière est perdue", m, None)


def _panne(url, *, timeout, params=None, headers=None):
    raise ConnectionError("réseau coupé")


http_client.get = _panne
verifier("Exception réseau → None, la récolte ne s'arrête pas",
         post_metrics.metriques_du_post(ACCES, "1", "FEED"), None)

# ── Le relevé : une ligne datée, l'âge réel ─────────────────────────────────

INFO = {"id": "1", "media_type": "VIDEO", "media_product_type": "REELS",
        "caption": "x" * 600, "timestamp": "2026-11-01T07:00:00+0000",
        "permalink": "https://www.instagram.com/reel/abc/"}
METRIQUES = {"reach": 120, "views": 300, "likes": 9, "comments": 1, "saved": 2, "shares": 3,
             "avg_watch_time": 4100, "follows": None, "profile_visits": None}
RELEVE_A = datetime(2026, 11, 9, 9, 30, tzinfo=timezone.utc)

fiche, releve = sync.lignes_du_post("u-1", INFO, METRIQUES, RELEVE_A)
verifier("Relevé : âge réel en heures (un passage manqué donne J+8, jamais un faux J+7)",
         releve["age_heures"], 194.5)
verifier("Relevé : clé user/post/releve_a",
         (releve["user_id"], releve["post_id"], releve["releve_a"]),
         ("u-1", "1", "2026-11-09T09:30:00+00:00"))
verifier("Relevé : follows d'un Reel reste None", releve["follows"], None)
verifier("Fiche : dernier relevé daté, métriques à jour",
         (fiche["releve_a"], fiche["reach"], fiche["likes"], fiche["follows"]),
         ("2026-11-09T09:30:00+00:00", 120, 9, None))
verifier("Fiche : légende coupée à 500, lien et produit envoyés",
         (len(fiche["caption"]), fiche["permalink"], fiche["media_product_type"]),
         (500, INFO["permalink"], "REELS"))

fiche, releve = sync.lignes_du_post("u-1", INFO, None, RELEVE_A)
verifier("Lecture en erreur : pas de relevé", releve, None)
verifier("Lecture en erreur : la fiche n'envoie aucune métrique ni releve_a",
         sorted(k for k in fiche if k in METRIQUES or k == "releve_a"), [])

fiche, releve = sync.lignes_du_post("u-1", {**INFO, "timestamp": ""}, METRIQUES, RELEVE_A)
verifier("Date de publication illisible : âge None, pas inventé", releve["age_heures"], None)

fiche, releve = sync.lignes_du_post("u-1", ERREUR_190, METRIQUES, RELEVE_A)
verifier("Fiche en erreur (post supprimé, jeton) : rien à écrire", (fiche, releve), (None, None))

# ── L'écriture sur une base sans la section 23 ──────────────────────────────

from saas.data.supabase.source_data import meta  # noqa: E402


class FausseBase:
    """Refuse toute colonne absente de `colonnes`, comme PostgREST (PGRST204)."""

    def __init__(self, colonnes, tables=("instagram_organic_posts",)):
        self.colonnes, self.tables, self.ecrit = set(colonnes), tables, []
        self._table = None

    def table(self, nom):
        self._table = nom
        return self

    def _ecrire(self, lignes):
        if self._table not in self.tables:
            raise Exception("{'code': 'PGRST205', 'message': \"Could not find the table "
                            f"'public.{self._table}' in the schema cache\"}}")
        for r in lignes if self._table == "instagram_organic_posts" else []:
            for k in r:
                if k not in self.colonnes:
                    raise Exception(f"{{'code': 'PGRST204', 'message': \"Could not find the '{k}' "
                                    "column of 'instagram_organic_posts' in the schema cache\"}")
        self.ecrit.append((self._table, lignes))
        return self

    def upsert(self, lignes, on_conflict=None):
        return self._ecrire(lignes)

    def insert(self, lignes):
        return self._ecrire(lignes)

    def execute(self):
        return self


AVANT_23 = {"post_id", "user_id", "type", "caption", "date", "media_url", "reach", "views",
            "likes", "comments", "saved", "follows", "permalink", "media_product_type"}
fiche, releve = sync.lignes_du_post("u-1", INFO, METRIQUES, RELEVE_A)
base = FausseBase(AVANT_23)
meta.insert_instagram_org(base, [fiche])
verifier("Base sans la 23 : le post s'écrit, lien et produit gardés",
         sorted(base.ecrit[0][1][0]) if base.ecrit else None,
         sorted(k for k in fiche if k in AVANT_23))
meta.insert_instagram_releves(base, [releve])
verifier("Base sans la 23 : le relevé ne fait pas tomber la récolte", len(base.ecrit), 1)

base = FausseBase(AVANT_23 | set(meta.COLONNES_SECTION_23),
                  tables=("instagram_organic_posts", "instagram_post_releves"))
meta.insert_instagram_releves(base, [releve, releve])
verifier("Base avec la 23 : les relevés s'ajoutent par insert",
         [(t, len(lignes)) for t, lignes in base.ecrit], [("instagram_post_releves", 2)])

print()
print("TOUT EST VERT" if not ECHECS else f"{len(ECHECS)} ÉCHEC(S)")
sys.exit(1 if ECHECS else 0)
