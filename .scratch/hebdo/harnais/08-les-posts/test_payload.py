"""Harnais du ticket 08 — les posts dans la frise (`frise.posts`) et l'état
Instagram du panneau Organique (`sources.instagram`).

Hors ligne, depuis la racine du dépôt :
    python3.12 .scratch/hebdo/harnais/08-les-posts/test_payload.py

Compte servi le jeudi ; le rapport du jeudi 29 octobre 2026 mesure la semaine
du 22 au 28 octobre.
"""
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from commun.faux_lecteur import FauxLecteur, Constats  # noqa: E402
from saas.data.supabase.processed_data.weekly_report.builder import build_payload  # noqa: E402

JOUR_FETCH = date(2026, 10, 29)
STOCK = "https://x.supabase.co/storage/v1/object/public/post-images/u/"


def post(pid, quand, type_, produit=None, lien=True):
    p = {"post_id": pid, "date": quand, "type": type_, "media_url": f"{STOCK}{pid}.jpg",
         "caption": "légende", "likes": 12, "views": 900, "reach": 400, "saved": 3}
    if produit is not None:
        p["media_product_type"] = produit
    if lien:
        p["permalink"] = f"https://www.instagram.com/p/{pid}/"
    return p


POSTS = [
    post(1, "2025-12-30T10:00:00+0000", "IMAGE"),                 # l'année d'avant
    post(2, "2026-02-14T09:00:00+0000", "CAROUSEL_ALBUM"),
    post(3, "2026-10-23T18:30:00+0000", "VIDEO", "REELS"),
    post(4, "2026-10-24T08:00:00+0000", "VIDEO", lien=False),      # ancien : jamais relu
    post(5, "2026-10-25T08:00:00+0000", "VIDEO", "FEED"),
    post(6, "2026-10-29T06:00:00+0000", "IMAGE"),                 # jour du fetch
    post(7, "2026-10-26T08:00:00+0000", "STORY_INCONNU"),
]

COUV_POSTS = {"source": "instagram", "flux": "posts",
              "sans_trou_depuis": "0001-01-01", "sans_trou_jusqu_au": "2026-10-28"}
COUV_META = {"source": "meta", "flux": "insights",
             "sans_trou_depuis": "2026-01-01", "sans_trou_jusqu_au": "2026-10-28"}


class Compte(FauxLecteur):
    def __init__(self, posts=POSTS, couverture=(COUV_POSTS, COUV_META), marque=None):
        super().__init__(JOUR_FETCH, "Thursday")
        self._posts, self._couv, self._marque = list(posts), list(couverture), marque

    def publications(self): return self._posts
    def couverture(self): return self._couv

    def connexions_etat(self):
        return [{"source": "meta", "created_at": "2026-03-02T08:00:00+00:00",
                 "a_reconnecter_depuis": self._marque}]


constat = Constats()
payload = build_payload(Compte())
posts = payload["frise"]["posts"]
par_jour = {p["date"]: p for p in posts}

constat([p["date"][:4] for p in posts] == ["2026"] * len(posts),
        "une seule année : celle de semaine.fin (le post du 30 décembre 2025 reste dehors)")
constat("2026-10-29" not in par_jour,
        "le jour du fetch n'entre pas : le rapport est figé à semaine.fin")
constat([p["date"] for p in posts] == sorted(p["date"] for p in posts), "posts triés par date")
constat(all(set(p) == {"plateforme", "date", "format", "visuel", "lien"} for p in posts),
        "chaque post porte plateforme, date, format, visuel, lien — et rien d'autre (aucun chiffre)")
constat(all(p["plateforme"] == "instagram" for p in posts), "plateforme = instagram")
constat(all(p["visuel"] and p["visuel"].startswith(STOCK) for p in posts), "visuel sur chaque post")
constat(all(p["lien"] for p in posts if p["date"] != "2026-10-24"),
        "lien (permalink) sur chaque post qui en a un")
constat(par_jour["2026-10-24"]["lien"] is None,
        "un post sans permalink rend lien None — pas de lien fabriqué")
constat(par_jour["2026-10-23"]["format"] == "REEL", "VIDEO + media_product_type REELS → REEL")
constat(par_jour["2026-10-24"]["format"] == "VIDEO",
        "VIDEO sans media_product_type reste VIDEO : on n'invente pas le Reel")
constat(par_jour["2026-10-25"]["format"] == "VIDEO", "VIDEO + FEED reste VIDEO")
constat(par_jour["2026-02-14"]["format"] == "CAROUSEL_ALBUM", "carrousel reconnu")
constat(par_jour["2026-10-26"]["format"] is None, "un type inconnu rend format None, pas un nom inventé")

ig = payload["sources"].get("instagram")
constat(ig is not None and ig["etat"] == "recolte", "Instagram couvert jusqu'à semaine.fin → recolte")
constat(bool(ig) and ig["connecte_le"] == "2026-03-02",
        "connecte_le = la connexion Meta qui porte Instagram")
constat(bool(ig) and ig["posts"] == {"depuis": "0001-01-01", "jusqu_au": "2026-10-28"},
        "la plage couverte des posts voyage, pour juger chaque semaine choisie")
constat("instagram" not in payload["totaux"]["depense"],
        "Instagram n'entre pas dans les totaux (carte 16)")
constat("instagram" not in (payload.get("canaux") or {}), "ni dans le module des canaux")

p2 = build_payload(Compte(couverture=(COUV_META, dict(COUV_POSTS, sans_trou_jusqu_au="2026-10-20"))))
constat(p2["sources"]["instagram"]["etat"] == "panne",
        "couverture des posts qui s'arrête avant semaine.fin → panne (« en cours de récupération »)")

p3 = build_payload(Compte(marque="2026-10-27T07:00:00+00:00"))
constat(p3["sources"]["instagram"]["etat"] == "jeton_mort", "jeton Meta marqué → Instagram jeton_mort")

p4 = build_payload(Compte(couverture=(COUV_META,)))
constat("instagram" not in p4["sources"],
        "aucune couverture Instagram → pas d'entrée : rien ne prouve une semaine vide")
constat(len(p4["frise"]["posts"]) == 5, "les posts récoltés restent dans la frise même sans couverture")

p5 = build_payload(Compte(posts=[], couverture=(COUV_META,)))
constat("posts" not in (p5.get("frise") or {}),
        "sans posts ni couverture Instagram : pas de clé posts, donc pas d'onglet Organique")

p6 = build_payload(Compte(posts=[]))
constat(p6["frise"]["posts"] == [], "Instagram couvert sans aucun post : liste vide (vrai zéro)")

constat.conclure()
