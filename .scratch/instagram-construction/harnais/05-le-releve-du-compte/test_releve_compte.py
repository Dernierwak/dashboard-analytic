"""Ticket 05 — le relevé du compte : réponse Graph → ligne du jour, sans réseau ni base.

Lancer depuis la racine du dépôt :

    python3.12 -I .scratch/instagram-construction/harnais/05-le-releve-du-compte/test_releve_compte.py

Couture : `releve_compte.releve_du_compte(sb, uid, acces, maintenant)`, avec
`http_client.get` remplacé par un faux Graph (formes de réponse relevées par
l'essai réel, `.scratch/instagram/essai/essai_reel.py` et `issues/17`) et les
écritures Supabase capturées. Puis `account_sync.leger` : le relevé du compte
passe dans la même ligne de journal que celui des posts.
"""
from __future__ import annotations

import sys
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

RACINE = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(RACINE))

from saas.data.fetch_data.shared import http_client  # noqa: E402
from saas.data.fetch_data.shared.token_status import VALIDE, TokenStatus  # noqa: E402
from saas.data.fetch_data.sources.meta.graph_client import AccesMeta  # noqa: E402
from saas.data.fetch_data.sources.meta.instagram import releve_compte  # noqa: E402
from saas.data.fetch_data.orchestration import account_sync  # noqa: E402
from saas.data.supabase.source_data import instagram_compte  # noqa: E402

ECHECS: list[str] = []


def verifier(nom, obtenu, attendu):
    if obtenu != attendu:
        ECHECS.append(nom)
        print(f"✗ {nom}\n    obtenu  : {obtenu!r}\n    attendu : {attendu!r}")
    else:
        print(f"✓ {nom}")


# Un mardi à 07:00 UTC, l'heure du cron : hier = lundi 9 novembre.
MAINTENANT = datetime(2026, 11, 10, 7, 0, tzinfo=timezone.utc)
ACCES = AccesMeta(jeton="faux", instagram="ig")


def _ts(jour: date) -> int:
    return int(datetime(jour.year, jour.month, jour.day, tzinfo=timezone.utc).timestamp())


HIER = (_ts(date(2026, 11, 9)), _ts(date(2026, 11, 10)))
AVANT_HIER = (_ts(date(2026, 11, 8)), _ts(date(2026, 11, 9)))
SEPT_JOURS = (_ts(date(2026, 11, 3)), _ts(date(2026, 11, 10)))


class _Reponse:
    def __init__(self, corps):
        self._corps = corps

    def json(self):
        return self._corps


def _total(nom, valeur):
    return {"data": [{"name": nom, "period": "day", "total_value": {"value": valeur}}]}


def _ventile(nom, resultats):
    return {"data": [{"name": nom, "period": "day", "total_value": {"breakdowns": [{
        "dimension_keys": ["x"],
        "results": [{"dimension_values": [d], "value": v} for d, v in resultats]}]}}]}


ERREUR = {"error": {"code": 1, "message": "An unknown error occurred"}}

# Clé : (métrique, ventilation, (since, until)) — ou « fiche » pour `/{ig-user}`.
REPONSES = {
    "fiche": {"followers_count": 1840, "id": "ig"},
    ("reach", None, HIER): _total("reach", 812),
    ("reach", "media_product_type", HIER): _ventile(
        "reach", [("POST", 500), ("REEL", 300), ("AD", 120), ("STORY", 40)]),
    ("total_interactions", None, HIER): _total("total_interactions", 95),
    ("total_interactions", "media_product_type", HIER): _ventile(
        "total_interactions", [("POST", 60), ("AD", 0)]),
    ("follows_and_unfollows", "follow_type", HIER): _ventile(
        "follows_and_unfollows", [("FOLLOWER", 7), ("NON_FOLLOWER", 2)]),
    ("reach", None, SEPT_JOURS): _total("reach", 4210),
}
# Avant-hier est relu à chaque passage (ticket 06) : mêmes réponses qu'hier.
REPONSES.update({(cle[0], cle[1], AVANT_HIER): corps for cle, corps in list(REPONSES.items())
                 if cle != "fiche" and cle[2] == HIER})


class FauxGraph:
    def __init__(self, reponses):
        self.reponses = reponses
        self.appels: list = []

    def __call__(self, url, *, timeout, params=None, headers=None):
        chemin = urlparse(url).path
        if chemin.endswith("/insights"):
            cle = (params["metric"], params.get("breakdown"),
                   (int(params["since"]), int(params["until"])))
            assert params.get("metric_type") == "total_value", params
            assert params.get("period") == "day", params
        else:
            assert params.get("fields") == "followers_count", params
            cle = "fiche"
        self.appels.append(cle)
        if cle not in self.reponses:
            raise AssertionError(f"appel inattendu : {cle}")
        return _Reponse(self.reponses[cle])


ECRIT: dict[str, list] = {"jours": [], "periodes": []}
releve_compte.ecrire_jours_du_compte = lambda sb, lignes: ECRIT["jours"].extend(lignes)
# Compte déjà en base : pas de premier passage ici (c'est le harnais 06).
releve_compte.a_des_jours_avant = lambda sb, uid, jour: True
releve_compte.ecrire_periode_du_compte = lambda sb, ligne: ECRIT["periodes"].append(ligne)


def passer(reponses):
    ECRIT["jours"].clear()
    ECRIT["periodes"].clear()
    graph = FauxGraph(reponses)
    http_client.get = graph
    mot = releve_compte.releve_du_compte(None, "u-1", ACCES, maintenant=MAINTENANT)
    return graph, mot


# ── 1 · Tout est rendu ──────────────────────────────────────────────────────
graph, mot = passer(REPONSES)
verifier("Une ligne pour HIER (et avant-hier relu, ticket 06), jamais pour le jour en cours",
         [l["jour"] for l in ECRIT["jours"]], ["2026-11-09", "2026-11-08"])
verifier("La ligne du jour : portée, interactions, abonnés, gagnés, perdus, part AD",
         ECRIT["jours"][0],
         {"user_id": "u-1", "jour": "2026-11-09", "reach": 812, "total_interactions": 95,
          "abonnes": 1840, "gagnes": 7, "perdus": 2, "reach_ad": 120, "interactions_ad": 0})
verifier("La portée dédoublonnée des 7 jours finissant hier, telle que rendue",
         ECRIT["periodes"],
         [{"user_id": "u-1", "debut": "2026-11-03", "fin": "2026-11-09", "reach": 4210}])
verifier("Douze appels, un par chiffre (hier, avant-hier, abonnés, 7 jours)",
         len(graph.appels), 12)
verifier("Le mot dit le jour relevé", "2026-11-09" in mot and "compte" in mot, True)

# ── 2 · `AD` absent de la ventilation → NULL, pas 0 ─────────────────────────
sans_ad = dict(REPONSES)
sans_ad[("reach", "media_product_type", HIER)] = _ventile("reach", [("POST", 500)])
sans_ad[("total_interactions", "media_product_type", HIER)] = _ventile(
    "total_interactions", [("POST", 60)])
passer(sans_ad)
verifier("AD absent → reach_ad et interactions_ad à NULL",
         (ECRIT["jours"][0]["reach_ad"], ECRIT["jours"][0]["interactions_ad"]), (None, None))

# ── 3 · Une métrique non rendue reste NULL (jeu vide = absence mesurée) ─────
vide = dict(REPONSES)
vide[("follows_and_unfollows", "follow_type", HIER)] = {"data": []}
vide[("total_interactions", None, HIER)] = {"data": [{"name": "total_interactions",
                                                      "total_value": {}}]}
passer(vide)
verifier("Gagnés, perdus et interactions non rendus → NULL",
         {k: ECRIT["jours"][0][k] for k in ("gagnes", "perdus", "total_interactions")},
         {"gagnes": None, "perdus": None, "total_interactions": None})
verifier("Un 0 rendu reste 0, pas NULL", ECRIT["jours"][0]["interactions_ad"], 0)

# ── 4 · Un appel en ERREUR n'écrit pas NULL par-dessus une bonne valeur ─────
panne = dict(REPONSES)
panne[("reach", None, HIER)] = ERREUR
panne[("reach", "media_product_type", HIER)] = ERREUR
panne["fiche"] = ERREUR
panne[("reach", None, SEPT_JOURS)] = ERREUR
passer(panne)
verifier("Appel en erreur → la colonne n'est pas envoyée (la valeur en base reste)",
         sorted(ECRIT["jours"][0]),
         sorted(["user_id", "jour", "total_interactions", "gagnes", "perdus",
                 "interactions_ad"]))
verifier("Portée des 7 jours en erreur → aucune période écrite", ECRIT["periodes"], [])

# ── 5 · Un jour non lu n'a pas de ligne ─────────────────────────────────────
tout_en_panne = {cle: ERREUR for cle in REPONSES}
graph, mot = passer(tout_en_panne)
verifier("Tous les appels en erreur → aucune ligne, aucune période",
         (ECRIT["jours"], ECRIT["periodes"]), ([], []))
verifier("… et le mot le dit, sans lever", "compte" in mot and "erreur" in mot.lower(), True)

# ── 6 · L'écriture ──────────────────────────────────────────────────────────
class Base:
    def __init__(self, leve=None):
        self.leve = leve
        self.ops: list = []

    def table(self, nom):
        self._table = nom
        return self

    def upsert(self, ligne, **opts):
        self.ops.append((self._table, ligne, opts))
        return self

    def execute(self):
        if self.leve:
            raise Exception(self.leve)
        return self


b = Base()
instagram_compte.ecrire_jours_du_compte(b, [{"user_id": "u", "jour": "2026-11-09", "reach": 1}])
instagram_compte.ecrire_periode_du_compte(
    b, {"user_id": "u", "debut": "2026-11-03", "fin": "2026-11-09", "reach": 9})
verifier("Le jour s'upserte sur (user_id, jour) ; la période s'ajoute sans écraser",
         [(t, o) for t, _, o in b.ops],
         [("instagram_compte_jours", {"on_conflict": "user_id,jour"}),
          ("instagram_compte_periodes",
           {"on_conflict": "user_id,debut,fin", "ignore_duplicates": True})])
b = Base(leve="{'code': 'PGRST205', 'message': 'Could not find the table'}")
try:
    instagram_compte.ecrire_jours_du_compte(b, [{"user_id": "u", "jour": "2026-11-09"}])
    instagram_compte.ecrire_periode_du_compte(b, {"user_id": "u", "debut": "x", "fin": "y",
                                                  "reach": 1})
    leve = False
except Exception:
    leve = True
verifier("Section 23 pas encore jouée : le dit et continue, sans lever", leve, False)

# ── 7 · La migration ────────────────────────────────────────────────────────
sql = (RACINE / "saas/data/supabase/migrations/000_run_me_all.sql").read_text()
verifier("Section 23 : la table des périodes, sa RLS par a_acces, et le contrôle",
         ("CREATE TABLE IF NOT EXISTS public.instagram_compte_periodes" in sql,
          "ALTER TABLE public.instagram_compte_periodes ENABLE ROW LEVEL SECURITY" in sql,
          "ON public.instagram_compte_periodes" in sql and "USING (public.a_acces(user_id))" in sql,
          "('t','instagram_compte_periodes',NULL)" in sql.replace(" ", "")),
         (True, True, True, True))

# ── 8 · Le passage léger relève aussi le compte, dans la même ligne ─────────
VU: list[str] = []
account_sync.recolte_instagram.releve_quotidien = lambda sb, uid, acces: "insta léger: 0 posts"
account_sync.releve_compte.releve_du_compte = (
    lambda sb, uid, acces: VU.append(acces.instagram) or "compte: 2026-11-09 relevé")
account_sync.jeton_meta.verifier = lambda jeton: TokenStatus(VALIDE, "")
account_sync._marquer = lambda sb, uid, plan: []
account_sync.connexions = lambda sb, uid: [
    {"id": "m", "provider": "meta", "meta_token": "ok", "instagram_business_id": "ig-1"}]
logs = account_sync.leger(None, "u-1")
verifier("Léger : le compte est relevé, et la ligne unique porte les deux mots",
         (VU, len(logs), "insta léger" in logs[0] and "compte: 2026-11-09" in logs[0]),
         (["ig-1"], 1, True))


def _panne(sb, uid, acces):
    raise RuntimeError("boum")


account_sync.recolte_instagram.releve_quotidien = _panne
VU.clear()
logs = account_sync.leger(None, "u-1")
verifier("Léger : la panne des posts n'empêche pas le relevé du compte",
         (VU, "instagram léger KO" in logs[0], "compte: 2026-11-09" in logs[0]),
         (["ig-1"], True, True))

print()
print("TOUT EST VERT" if not ECHECS else f"{len(ECHECS)} ÉCHEC(S)")
sys.exit(1 if ECHECS else 0)
