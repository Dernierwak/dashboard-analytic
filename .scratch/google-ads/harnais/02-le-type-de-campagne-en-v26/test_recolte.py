"""Ticket 02 — « réponse Google → lignes à écrire », sans réseau.

Lancer depuis la racine du dépôt :

    python3.12 -I .scratch/google-ads/harnais/02-le-type-de-campagne-en-v26/test_recolte.py

Les réponses GAQL sont écrites à la main sur la forme REST de `searchStream`
(liste de lots, clés camelCase, int64 en chaînes) et sur ce que l'essai réel v26
a relevé (carte, issue 10) : un compteur revient `0` explicite, un champ non
rempli revient ABSENT. Rien ne part chez Google, rien ne s'écrit chez Supabase.
"""
from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

RACINE = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(RACINE))

import saas.data.fetch_data.sources.google.ads.fetchers._query as q  # noqa: E402
from saas.data.fetch_data.shared import http_client  # noqa: E402
from saas.data.fetch_data.sources.google.ads.fetchers import campaigns  # noqa: E402
from saas.data.supabase.source_data.google import upsert_google_ads  # noqa: E402

q.secret = lambda k: "faux"  # sinon `entetes()` lit les vrais secrets

ECHECS: list[str] = []


def verifier(nom, obtenu, attendu):
    ok = obtenu == attendu
    print(("✓ " if ok else "✗ ") + nom + ("" if ok else f"\n    obtenu  : {obtenu!r}\n    attendu : {attendu!r}"))
    if not ok:
        ECHECS.append(nom)


def resultat(cid, jour, type_, **metriques):
    r = {"campaign": {"resourceName": f"customers/1/campaigns/{cid}", "id": cid, "name": f"Camp {cid}", "status": "ENABLED"},
         "segments": {"date": jour}, "metrics": metriques}
    if type_ is not None:
        r["campaign"]["advertisingChannelType"] = type_
    return r


REPONSE = [{"results": [
    # Search : tout est rempli, `conversionsValue` à 0 explicite (essai : jamais vide).
    resultat("111", "2026-11-02", "SEARCH", impressions="1000", clicks="50", costMicros="1500000",
             conversions=4.5, conversionsValue=0, allConversions=31.25, viewThroughConversions="0"),
    # PMax : Google n'a pas rendu les trois colonnes de conversion nouvelles.
    resultat("222", "2026-11-02", "PERFORMANCE_MAX", impressions="200", clicks="3", costMicros="250000",
             conversions=1.0),
    # Un type que l'écran ne nomme pas : recopié tel quel.
    resultat("333", "2026-11-02", "SHOPPING", impressions="10", clicks="1", costMicros="10000"),
    # Le type lui-même absent de la réponse.
    resultat("444", "2026-11-02", None, impressions="5", clicks="0", costMicros="0"),
]}]


# ── La version de l'API ──────────────────────────────────────────────────────
verifier("toute la récolte Google Ads parle à v26", q.BASE, "https://googleads.googleapis.com/v26")

# ── Le seam pur : réponse → lignes ───────────────────────────────────────────
lignes, err = campaigns.lignes_de(REPONSE)
par_id = {l["campaign_id"]: l for l in lignes}
verifier("aucune erreur sur une réponse saine", err, None)
verifier("une ligne par résultat, aucune inventée", sorted(par_id), ["111", "222", "333", "444"])
verifier("le type Search est recopié brut", par_id["111"]["advertising_channel_type"], "SEARCH")
verifier("le type PMax est recopié brut", par_id["222"]["advertising_channel_type"], "PERFORMANCE_MAX")
verifier("un type hors des cinq est recopié brut", par_id["333"]["advertising_channel_type"], "SHOPPING")
verifier("un type absent reste None, jamais deviné", par_id["444"]["advertising_channel_type"], None)
verifier("valeur de conversion à 0 explicite → 0.0", par_id["111"]["conversions_value"], 0.0)
verifier("all_conversions lue", par_id["111"]["all_conversions"], 31.25)
verifier("view_through_conversions en chaîne \"0\" → 0.0", par_id["111"]["view_through_conversions"], 0.0)
verifier("valeur de conversion absente → None, jamais 0", par_id["222"]["conversions_value"], None)
verifier("all_conversions absente → None", par_id["222"]["all_conversions"], None)
verifier("view_through_conversions absente → None", par_id["222"]["view_through_conversions"], None)
verifier("le coût reste en micros (converti une seule fois, à la page)", par_id["111"]["cost_micros"], 1500000)

# Un jour omis par Google (toutes les métriques à 0) n'est pas écrit à 0.
lignes_omis, _ = campaigns.lignes_de([{"results": [resultat("111", "2026-11-02", "SEARCH", impressions="1")]}])
verifier("un jour omis par Google ne produit aucune ligne",
         sorted(l["date_start"] for l in lignes_omis), ["2026-11-02"])
verifier("une réponse sans résultat rend zéro ligne", campaigns.lignes_de([{}]), ([], None))

verifier("une erreur de l'API est rendue, sans ligne",
         campaigns.lignes_de({"error": {"message": "PERMISSION_DENIED"}}), ([], "PERMISSION_DENIED"))
verifier("une erreur au milieu du flux est rendue, sans ligne",
         campaigns.lignes_de([{"results": REPONSE[0]["results"]}, {"error": {"message": "INTERNAL"}}]), ([], "INTERNAL"))


# ── La requête demande les champs, dans la même requête que l'existant ───────
class _Reponse:
    def __init__(self, corps):
        self._corps = corps

    def json(self):
        return self._corps


ENVOYE = {}


def faux_post(url, headers=None, json=None, timeout=None):
    ENVOYE["url"], ENVOYE["query"] = url, json["query"]
    return _Reponse(REPONSE)


http_client.post = faux_post
lignes_http, err_http = campaigns.tranche("jeton", "123", date(2026, 11, 1), date(2026, 11, 3))
verifier("tranche() rend les mêmes lignes que le seam pur", (lignes_http, err_http), (lignes, None))
verifier("l'appel part en v26", ENVOYE["url"], "https://googleads.googleapis.com/v26/customers/123/googleAds:searchStream")
for champ in ("campaign.advertising_channel_type", "metrics.conversions_value", "metrics.all_conversions",
              "metrics.view_through_conversions", "metrics.impressions", "metrics.cost_micros", "metrics.conversions"):
    verifier(f"la requête unique demande {champ}", champ in ENVOYE["query"], True)


# ── L'écriture : NULL reste NULL ─────────────────────────────────────────────
class FausseBase:
    """Refuse une colonne absente du schéma (PGRST204) et des clés qui varient
    d'une ligne à l'autre dans un lot (PGRST102), comme PostgREST."""

    COLONNES = {"user_id", "date_start", "campaign_id", "campaign_name", "impressions", "clicks", "conversions",
                "cost_micros", "ctr", "avg_cpc_micros", "advertising_channel_type", "conversions_value",
                "all_conversions", "view_through_conversions"}

    def __init__(self):
        self.ecrit = []

    def table(self, nom):
        self.nom = nom
        return self

    def upsert(self, lignes, on_conflict=None):
        cles = {frozenset(l) for l in lignes}
        if len(cles) > 1:
            raise Exception("PGRST102 All object keys must match")
        for l in lignes:
            for k in l:
                if k not in self.COLONNES:
                    raise Exception(f"PGRST204 Could not find the '{k}' column")
        self.ecrit.append((self.nom, lignes, on_conflict))
        return self

    def execute(self):
        return self


base = FausseBase()
upsert_google_ads(base, "uid", lignes)
table, ecrites, conflit = base.ecrit[0]
ecrit = {r["campaign_id"]: r for r in ecrites}
verifier("écrit dans google_ads_insights", table, "google_ads_insights")
verifier("même clé de conflit qu'avant", conflit, "user_id,date_start,campaign_id")
verifier("le type est écrit brut", ecrit["222"]["advertising_channel_type"], "PERFORMANCE_MAX")
verifier("un type absent s'écrit NULL", ecrit["444"]["advertising_channel_type"], None)
verifier("une valeur absente s'écrit NULL, pas 0", ecrit["222"]["conversions_value"], None)
verifier("all_conversions absente s'écrit NULL", ecrit["222"]["all_conversions"], None)
verifier("view_through absente s'écrit NULL", ecrit["222"]["view_through_conversions"], None)
verifier("un 0 lu s'écrit 0", ecrit["111"]["conversions_value"], 0.0)
verifier("all_conversions lue s'écrit telle quelle", ecrit["111"]["all_conversions"], 31.25)

print("\nTOUT EST VERT" if not ECHECS else f"\n{len(ECHECS)} ÉCHEC(S)")
sys.exit(1 if ECHECS else 0)
