"""Ticket 06 — le premier passage d'un compte, et avant-hier relu à chaque passage.

Lancer depuis la racine du dépôt :

    python3.12 -I .scratch/instagram-construction/harnais/06-le-premier-passage/test_premier_passage.py

Couture : `releve_compte.releve_du_compte(sb, uid, acces, maintenant)`, avec
`http_client.get` remplacé par un faux Graph qui répond selon les paramètres
(formes de l'essai réel, `.scratch/instagram/essai/essai_reel.py`, `issues/17`)
et les écritures / la lecture Supabase remplacées. Puis
`source_data/instagram_compte` sur une fausse base.

La remontée des abonnés est vérifiée sur un cas écrit à la main (§ 2) : les
totaux attendus sont calculés ici, à la main, pas par la règle du code.
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
from saas.data.fetch_data.sources.meta.instagram import releve_compte  # noqa: E402
from saas.data.supabase.source_data import instagram_compte  # noqa: E402

ECHECS: list[str] = []


def verifier(nom, obtenu, attendu):
    if obtenu != attendu:
        ECHECS.append(nom)
        print(f"✗ {nom}\n    obtenu  : {obtenu!r}\n    attendu : {attendu!r}")
    else:
        print(f"✓ {nom}")


# Mardi 10 novembre 2026, 07:00 UTC : hier = 9, avant-hier = 8.
MAINTENANT = datetime(2026, 11, 10, 7, 0, tzinfo=timezone.utc)
AUJOURDHUI = date(2026, 11, 10)
HIER, AVANT_HIER = date(2026, 11, 9), date(2026, 11, 8)
ACCES = AccesMeta(jeton="faux", instagram="ig")
UN_JOUR = timedelta(days=1)


def _jour(ts) -> date:
    return datetime.fromtimestamp(int(ts), tz=timezone.utc).date()


class _Reponse:
    def __init__(self, corps):
        self._corps = corps

    def json(self):
        return self._corps


ERREUR = {"error": {"code": 1, "message": "An unknown error occurred"}}

# Le cas écrit à la main : gagnés / perdus des 5 jours les plus récents.
MOUVEMENTS_A_LA_MAIN = {
    date(2026, 11, 9): (7, 2),
    date(2026, 11, 8): (3, 1),
    date(2026, 11, 7): (0, 5),
    date(2026, 11, 6): (10, 0),
    date(2026, 11, 5): (4, 4),
}
ABONNES_DU_PASSAGE = 1840


class FauxGraph:
    """Répond à `/{ig}/insights` selon (métrique, ventilation, fenêtre) et à
    `/{ig}` pour `followers_count`. `pannes` : jeux de clés à rendre en erreur."""

    def __init__(self, pannes=(), sans_non_follower=(), abonnes=ABONNES_DU_PASSAGE):
        self.pannes = set(pannes)
        self.sans_non_follower = set(sans_non_follower)
        self.abonnes = abonnes
        self.appels: list = []

    def __call__(self, url, *, timeout, params=None, headers=None):
        if not urlparse(url).path.endswith("/insights"):
            assert params.get("fields") == "followers_count", params
            self.appels.append(("fiche",))
            if "fiche" in self.pannes:
                return _Reponse(ERREUR)
            return _Reponse({"followers_count": self.abonnes, "id": "ig"})
        debut, fin = _jour(params["since"]), _jour(params["until"])
        assert params.get("period") == "day", params
        assert fin <= AUJOURDHUI, f"le jour en cours n'est jamais lu : {params}"
        metrique, ventilation = params["metric"], params.get("breakdown")
        cle = (metrique, ventilation, debut, fin)
        self.appels.append(cle)
        if cle in self.pannes or (metrique, ventilation, debut) in self.pannes:
            return _Reponse(ERREUR)
        if params.get("metric_type") != "total_value":
            # Série jour par jour : `end_time` = fin de la journée, à 08:00 UTC
            # le lendemain (forme relevée, `recolte.md` § 1, account.py).
            assert metrique == "reach", params
            assert (fin - debut).days <= 30, f"fenêtre de plus de 30 jours : {params}"
            valeurs = []
            j = debut
            while j < fin:
                fin_journee = datetime(j.year, j.month, j.day, 8, tzinfo=timezone.utc) + UN_JOUR
                valeurs.append({"value": 1000 + j.day,
                                "end_time": fin_journee.strftime("%Y-%m-%dT%H:%M:%S+0000")})
                j += UN_JOUR
            return _Reponse({"data": [{"name": "reach", "period": "day", "values": valeurs}]})
        assert (fin - debut).days == 1 or (metrique == "reach" and not ventilation), params
        if metrique == "follows_and_unfollows":
            g, p = MOUVEMENTS_A_LA_MAIN.get(debut, (1, 0))
            resultats = [{"dimension_values": ["FOLLOWER"], "value": g}]
            if debut not in self.sans_non_follower:
                resultats.append({"dimension_values": ["NON_FOLLOWER"], "value": p})
            return _Reponse({"data": [{"name": metrique, "total_value": {
                "breakdowns": [{"dimension_keys": ["follow_type"], "results": resultats}]}}]})
        if ventilation:
            return _Reponse({"data": [{"name": metrique, "total_value": {"breakdowns": [{
                "results": [{"dimension_values": ["AD"], "value": 5}]}]}}]})
        valeur = 4210 if (fin - debut).days == 7 else (100 + debut.day if metrique == "reach"
                                                       else debut.day)
        return _Reponse({"data": [{"name": metrique, "total_value": {"value": valeur}}]})


ECRIT: dict[str, list] = {"jours": [], "periodes": []}
LU: list = []
releve_compte.ecrire_jours_du_compte = lambda sb, lignes: ECRIT["jours"].extend(lignes)
releve_compte.ecrire_periode_du_compte = lambda sb, ligne: ECRIT["periodes"].append(ligne)


def passer(graph, deja_en_base=False):
    """`deja_en_base` : True = une ligne avant avant-hier existe ; False = aucune ;
    une exception = la lecture tombe."""
    ECRIT["jours"].clear()
    ECRIT["periodes"].clear()
    LU.clear()

    def a_des_jours_avant(sb, uid, jour):
        LU.append(jour)
        if isinstance(deja_en_base, Exception):
            raise deja_en_base
        return deja_en_base

    releve_compte.a_des_jours_avant = a_des_jours_avant
    http_client.get = graph
    mot = releve_compte.releve_du_compte(None, "u-1", ACCES, maintenant=MAINTENANT)
    par_jour: dict[str, dict] = {}
    for ligne in ECRIT["jours"]:
        par_jour.setdefault(ligne["jour"], {}).update(ligne)
    return mot, par_jour


# ── 1 · Chaque passage relit avant-hier ─────────────────────────────────────
graph = FauxGraph()
mot, jours = passer(graph, deja_en_base=True)
verifier("Compte déjà en base : hier ET avant-hier écrits, rien d'autre",
         sorted(jours), ["2026-11-08", "2026-11-09"])
verifier("Avant-hier relu en entier, sans les abonnés (followers_count est celui du passage, posé sur hier)",
         jours["2026-11-08"],
         {"user_id": "u-1", "jour": "2026-11-08", "reach": 108, "total_interactions": 8,
          "gagnes": 3, "perdus": 1, "reach_ad": 5, "interactions_ad": 5})
verifier("Hier garde les abonnés du passage", jours["2026-11-09"]["abonnes"], 1840)
verifier("12 appels : 5 par jour relu, followers_count, la période des 7 jours",
         len(graph.appels), 12)
verifier("La détection regarde avant avant-hier", LU, [AVANT_HIER])
verifier("Pas de premier passage : le mot n'en parle pas", "premier passage" in mot, False)

# ── 2 · Premier passage : 90 jours, et la remontée écrite à la main ─────────
graph = FauxGraph()
mot, jours = passer(graph, deja_en_base=False)
debut = AUJOURDHUI - timedelta(days=90)
verifier("90 jours écrits, du 12 août à hier, jamais aujourd'hui",
         (len(jours), min(jours), max(jours)), (90, debut.isoformat(), "2026-11-09"))
verifier("La portée vient de la série, rattachée au jour qui finit à end_time",
         (jours["2026-08-12"]["reach"], jours["2026-10-31"]["reach"]), (1012, 1031))
verifier("Les interactions, un appel par jour", jours["2026-09-15"]["total_interactions"], 15)
series = [c for c in graph.appels if c[0] == "reach" and c[1] is None and (c[3] - c[2]).days > 1
          and (c[3] - c[2]).days != 7]
verifier("La portée remonte en 3 appels de 30 jours au plus (88 jours avant avant-hier)",
         [((c[3] - c[2]).days) for c in series], [30, 30, 28])
interactions = [c for c in graph.appels if c[0] == "total_interactions" and c[1] is None]
verifier("Interactions : 90 appels (88 remontés + hier + avant-hier)", len(interactions), 90)
follows = [c for c in graph.appels if c[0] == "follows_and_unfollows"]
verifier("follows_and_unfollows : 30 jours, chacun lu une seule fois",
         (len(follows), len(set(follows))), (30, 30))
# À la main : 1840 (hier, le passage)
#   8 nov = 1840 − 7 + 2 = 1835 ; 7 nov = 1835 − 3 + 1 = 1833
#   6 nov = 1833 − 0 + 5 = 1838 ; 5 nov = 1838 − 10 + 0 = 1828
#   4 nov = 1828 − 4 + 4 = 1828 ; puis −1 par jour (1 gagné, 0 perdu)
verifier("Remontée des abonnés, cas écrit à la main",
         [jours[d]["abonnes"] for d in ("2026-11-09", "2026-11-08", "2026-11-07",
                                        "2026-11-06", "2026-11-05", "2026-11-04",
                                        "2026-11-03")],
         [1840, 1835, 1833, 1838, 1828, 1828, 1827])
avec_abonnes = sorted(d for d, l in jours.items() if l.get("abonnes") is not None)
# 30 jours de mouvements (9 nov → 11 oct) donnent 30 totaux de plus : jusqu'au 10 oct.
verifier("Abonnés sur 31 jours : hier et les 30 que les mouvements permettent",
         (len(avec_abonnes), avec_abonnes[0]), (31, "2026-10-10"))
verifier("Gagnés / perdus seulement sur les 30 jours qu'Instagram rend",
         sorted(d for d, l in jours.items() if "gagnes" in l)[0], "2026-10-11")
verifier("Les jours remontés ne portent pas la part AD (pas demandée au premier passage)",
         "reach_ad" in jours["2026-09-15"], False)
verifier("Le mot dit le premier passage et la remontée",
         ("premier passage" in mot, "88" in mot, "abonnés" in mot), (True, True, True))

# ── 3 · Un jour manquant arrête la courbe là ────────────────────────────────
graph = FauxGraph(pannes={("follows_and_unfollows", "follow_type", date(2026, 11, 6))})
mot, jours = passer(graph, deja_en_base=False)
verifier("Mouvements du 6 en erreur : abonnés connus jusqu'au 6, plus rien avant",
         sorted(d for d, l in jours.items() if l.get("abonnes") is not None),
         ["2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09"])
verifier("… rien n'est interpolé au-delà, mais les gagnés des jours d'avant restent écrits",
         ("abonnes" in jours["2026-11-05"], jours["2026-11-05"]["gagnes"]), (False, 4))
verifier("… et le mot dit où la courbe s'arrête", "2026-11-06" in mot, True)

graph = FauxGraph(sans_non_follower={date(2026, 11, 8)})
mot, jours = passer(graph, deja_en_base=False)
verifier("NON_FOLLOWER absent le 8 : la courbe s'arrête au 8 (absent n'est pas 0)",
         sorted(d for d, l in jours.items() if l.get("abonnes") is not None),
         ["2026-11-08", "2026-11-09"])

graph = FauxGraph(pannes={"fiche"})
mot, jours = passer(graph, deja_en_base=False)
verifier("followers_count non rendu : aucune remontée, aucun total inventé",
         [d for d, l in jours.items() if "abonnes" in l], [])
verifier("… mais les 90 jours de portée s'écrivent quand même", len(jours), 90)

# ── 4 · Une tranche de portée en erreur ne laisse pas de faux chiffres ──────
premiere = (debut, debut + timedelta(days=30))
graph = FauxGraph(pannes={("reach", None) + premiere})
mot, jours = passer(graph, deja_en_base=False)
verifier("Tranche en erreur : ses 30 jours sans portée, les autres l'ont",
         ("reach" in jours["2026-08-12"], "reach" in jours["2026-09-10"],
          jours["2026-09-11"]["reach"]), (False, False, 1011))
verifier("… et la colonne n'est pas envoyée (pas de NULL) pour ces jours",
         jours["2026-08-12"], {"user_id": "u-1", "jour": "2026-08-12",
                               "total_interactions": 12})

# ── 5 · La détection qui tombe ──────────────────────────────────────────────
graph = FauxGraph()
mot, jours = passer(graph, deja_en_base=RuntimeError("réseau"))
verifier("Lecture de la base en erreur : pas de premier passage (pas 130 appels à l'aveugle)",
         (sorted(jours), len(graph.appels)), (["2026-11-08", "2026-11-09"], 12))
verifier("… et le mot le dit", "premier passage" in mot and "non" in mot.lower(), True)


# ── 6 · L'écriture et la lecture en base ────────────────────────────────────
class Base:
    def __init__(self, data=None, leve=None):
        self.data, self.leve = data or [], leve
        self.ops: list = []

    def table(self, nom):
        self.ops.append(("table", nom))
        return self

    def __getattr__(self, nom):
        def appel(*args, **kwargs):
            self.ops.append((nom, args, kwargs))
            return self
        return appel

    def execute(self):
        if self.leve:
            raise Exception(self.leve)
        return self


b = Base(data=[{"jour": "2026-10-01"}])
verifier("a_des_jours_avant : une ligne avant la date → True",
         instagram_compte.a_des_jours_avant(b, "u", AVANT_HIER), True)
verifier("… filtre sur le compte et sur jour < date, une ligne suffit",
         [op for op in b.ops if op[0] in ("eq", "lt", "limit")],
         [("eq", ("user_id", "u"), {}), ("lt", ("jour", "2026-11-08"), {}), ("limit", (1,), {})])
verifier("a_des_jours_avant : aucune ligne → False",
         instagram_compte.a_des_jours_avant(Base(), "u", AVANT_HIER), False)

b = Base()
instagram_compte.ecrire_jours_du_compte(b, [
    {"user_id": "u", "jour": "2026-09-01", "reach": 1, "total_interactions": 2},
    {"user_id": "u", "jour": "2026-09-02", "total_interactions": 3},
    {"user_id": "u", "jour": "2026-09-03", "reach": 4, "total_interactions": 5},
])
lots = [(op[1][0], op[2]) for op in b.ops if op[0] == "upsert"]
verifier("Un lot par jeu de colonnes : PostgREST écrirait NULL pour une clé absente d'une ligne",
         sorted((len(l), sorted(l[0])) for l, _ in lots),
         [(1, ["jour", "total_interactions", "user_id"]),
          (2, ["jour", "reach", "total_interactions", "user_id"])])
verifier("… chaque lot s'upserte sur (user_id, jour)",
         {o["on_conflict"] for _, o in lots}, {"user_id,jour"})
b = Base(leve="{'code': 'PGRST205', 'message': 'Could not find the table'}")
try:
    instagram_compte.ecrire_jours_du_compte(b, [{"user_id": "u", "jour": "2026-09-01"}])
    leve = False
except Exception:
    leve = True
verifier("Section 23 pas jouée : le dit et continue", leve, False)

print()
print("TOUT EST VERT" if not ECHECS else f"{len(ECHECS)} ÉCHEC(S)")
sys.exit(1 if ECHECS else 0)
