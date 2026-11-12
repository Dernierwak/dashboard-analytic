"""Ticket 03 — les actions de conversion et les conversions par action, sans réseau.

Lancer depuis la racine du dépôt :

    python3.12 -I .scratch/google-ads/harnais/03-la-valeur-de-conversion-et-le-roas/test_recolte.py

Réponses GAQL écrites à la main sur la forme REST de `searchStream` (liste de
lots, camelCase, int64 en chaînes). Les réglages reprennent le relevé du compte
A (carte, issue 13) : achat « par événement », achat serveur à 0 imposé, clic
billet à 1 imposé, newsletter à 0 imposé. Rien ne part chez Google ni Supabase.
"""
from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

RACINE = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(RACINE))

import saas.data.fetch_data.sources.google.ads.fetchers._query as q  # noqa: E402
from saas.data.fetch_data.shared import http_client  # noqa: E402
from saas.data.fetch_data.sources.google.ads.fetchers import (  # noqa: E402
    campaigns, conversion_actions, conversions_par_action,
)
from saas.data.supabase.source_data.google import (  # noqa: E402
    upsert_google_conversion_actions, upsert_google_conversions_par_action,
)

q.secret = lambda k: "faux"  # sinon `entetes()` lit les vrais secrets

ECHECS: list[str] = []


def verifier(nom, obtenu, attendu):
    ok = obtenu == attendu
    print(("✓ " if ok else "✗ ") + nom + ("" if ok else f"\n    obtenu  : {obtenu!r}\n    attendu : {attendu!r}"))
    if not ok:
        ECHECS.append(nom)


# ── Les réglages des actions, lus tels quels ─────────────────────────────────

def action(aid, nom, categorie, statut, reglages):
    a = {"resourceName": f"customers/1/conversionActions/{aid}", "id": aid, "name": nom,
         "category": categorie, "status": statut}
    if reglages is not None:
        a["valueSettings"] = reglages
    return {"conversionAction": a}


REPONSE_ACTIONS = [{"results": [
    action("10", "achat (balise)", "PURCHASE", "ENABLED",
           {"defaultValue": 1, "defaultCurrencyCode": "CHF", "alwaysUseDefaultValue": False}),
    action("20", "achat (serveur)", "PURCHASE", "ENABLED",
           {"defaultValue": 0, "defaultCurrencyCode": "CHF", "alwaysUseDefaultValue": True}),
    action("30", "clic billet", "DEFAULT", "ENABLED",
           {"defaultValue": 1, "defaultCurrencyCode": "CHF", "alwaysUseDefaultValue": True}),
    # Une valeur fixe choisie par l'annonceur : une vraie valeur (issue 13, point 1).
    action("40", "devis", "SUBMIT_LEAD_FORM", "REMOVED",
           {"defaultValue": 250.5, "defaultCurrencyCode": "EUR", "alwaysUseDefaultValue": True}),
    # Réglages absents de la réponse : rien n'est deviné.
    action("50", "inconnue", "DEFAULT", "HIDDEN", None),
]}]

actions, err = conversion_actions.actions_de(REPONSE_ACTIONS)
par_action = {a["conversion_action_id"]: a for a in actions}
verifier("aucune erreur sur une réponse saine", err, None)
verifier("une ligne par action, toutes gardées (statut compris)", sorted(par_action), ["10", "20", "30", "40", "50"])
verifier("nom, catégorie, statut lus tels quels",
         (par_action["40"]["name"], par_action["40"]["category"], par_action["40"]["status"]),
         ("devis", "SUBMIT_LEAD_FORM", "REMOVED"))
verifier("« par événement » : always_use_default_value = False lu tel quel",
         par_action["10"]["always_use_default_value"], False)
verifier("défaut imposé : True lu tel quel", par_action["30"]["always_use_default_value"], True)
verifier("valeur par défaut 1 lue", par_action["30"]["default_value"], 1.0)
verifier("valeur par défaut 0 lue 0, pas None", par_action["20"]["default_value"], 0.0)
verifier("valeur fixe lue telle quelle", par_action["40"]["default_value"], 250.5)
verifier("devise lue", par_action["40"]["currency_code"], "EUR")
verifier("réglages absents → None partout, jamais deviné",
         (par_action["50"]["always_use_default_value"], par_action["50"]["default_value"], par_action["50"]["currency_code"]),
         (None, None, None))
verifier("une erreur de l'API est rendue, sans ligne",
         conversion_actions.actions_de({"error": {"message": "PERMISSION_DENIED"}}), ([], "PERMISSION_DENIED"))


# ── Les conversions par action × campagne × jour ─────────────────────────────

def par_act(cid, jour, aid, **metriques):
    return {"campaign": {"resourceName": f"customers/1/campaigns/{cid}", "id": cid},
            "segments": {"date": jour, "conversionAction": f"customers/1/conversionActions/{aid}"},
            "metrics": metriques}


REPONSE_PAR_ACTION = [{"results": [
    par_act("111", "2026-10-05", "10", conversions=2.5, conversionsValue=230.4),
    par_act("111", "2026-10-05", "20", conversions=2.5, conversionsValue=0),
    par_act("111", "2026-10-05", "30", conversions=7.33, conversionsValue=7.33),
    par_act("222", "2026-10-05", "30", conversions=1.0, conversionsValue=1.0),
]}, {"results": [
    par_act("111", "2026-10-06", "30", conversions="3", conversionsValue="3"),
    # Valeur absente : reste None.
    par_act("222", "2026-10-06", "20", conversions=1.0),
]}]

lignes, err = conversions_par_action.lignes_de(REPONSE_PAR_ACTION)
verifier("aucune erreur, lots lus en entier", (err, len(lignes)), (None, 6))
l0 = lignes[0]
verifier("une ligne porte jour, campagne, action (ID tiré du nom de ressource)",
         (l0["date_start"], l0["campaign_id"], l0["conversion_action_id"]), ("2026-10-05", "111", "10"))
verifier("conversions et valeur lues", (l0["conversions"], l0["conversions_value"]), (2.5, 230.4))
verifier("une valeur 0 reste 0", lignes[1]["conversions_value"], 0.0)
verifier("int64 en chaînes lus", lignes[4]["conversions"], 3.0)
verifier("une valeur absente reste None", lignes[5]["conversions_value"], None)
verifier("une erreur au milieu du flux annule tout",
         conversions_par_action.lignes_de([REPONSE_PAR_ACTION[0], {"error": {"message": "INTERNAL"}}]),
         ([], "INTERNAL"))

# La somme par action redonne `metrics.conversions` de la campagne × jour
# (carte, issue 19 : 0 clé en écart sur 4 111,19 conversions).
REPONSE_CAMPAGNES = [{"results": [
    {"campaign": {"id": "111", "name": "A", "status": "ENABLED", "advertisingChannelType": "SEARCH"},
     "segments": {"date": "2026-10-05"}, "metrics": {"impressions": "100", "conversions": 12.33}},
    {"campaign": {"id": "222", "name": "B", "status": "ENABLED", "advertisingChannelType": "PERFORMANCE_MAX"},
     "segments": {"date": "2026-10-05"}, "metrics": {"impressions": "50", "conversions": 1.0}},
    {"campaign": {"id": "111", "name": "A", "status": "ENABLED", "advertisingChannelType": "SEARCH"},
     "segments": {"date": "2026-10-06"}, "metrics": {"impressions": "80", "conversions": 3.0}},
    {"campaign": {"id": "222", "name": "B", "status": "ENABLED", "advertisingChannelType": "PERFORMANCE_MAX"},
     "segments": {"date": "2026-10-06"}, "metrics": {"impressions": "40", "conversions": 1.0}},
]}]
insights, _ = campaigns.lignes_de(REPONSE_CAMPAGNES)
somme: dict = {}
for l in lignes:
    cle = (l["date_start"], l["campaign_id"])
    somme[cle] = round(somme.get(cle, 0.0) + l["conversions"], 6)
verifier("la somme par action égale metrics.conversions, clé par clé",
         somme, {(r["date_start"], r["campaign_id"]): r["conversions"] for r in insights})


# ── Les requêtes ─────────────────────────────────────────────────────────────
class _Reponse:
    def __init__(self, corps):
        self._corps = corps

    def json(self):
        return self._corps


ENVOYE: list = []


def faux_post(url, headers=None, json=None, timeout=None):
    ENVOYE.append((url, json["query"]))
    return _Reponse(REPONSE_ACTIONS if "FROM conversion_action" in json["query"] else REPONSE_PAR_ACTION)


http_client.post = faux_post

lignes_http, err_http = conversions_par_action.tranche("jeton", "123", date(2026, 10, 1), date(2026, 10, 7))
verifier("tranche() rend les lignes du seam pur", (lignes_http, err_http), (lignes, None))
url, requete = ENVOYE[-1]
verifier("l'appel part en v26", url, "https://googleads.googleapis.com/v26/customers/123/googleAds:searchStream")
for champ in ("segments.conversion_action", "segments.date", "metrics.conversions", "metrics.conversions_value",
              "FROM campaign"):
    verifier(f"la requête par action porte {champ}", champ in requete, True)
for interdit in ("metrics.impressions", "metrics.clicks", "metrics.cost_micros"):
    verifier(f"la requête par action ne demande pas {interdit} (refusé par l'API)", interdit in requete, False)

from saas.data.fetch_data.sources.google.client import AccesGoogle  # noqa: E402

acces = AccesGoogle(jeton="jeton", client="123")
actions_http, err_a = conversion_actions.recuperer(acces)
verifier("recuperer() des actions rend les lignes du seam pur", (actions_http, err_a), (actions, None))
requete_actions = ENVOYE[-1][1]
for champ in ("conversion_action.id", "conversion_action.name", "conversion_action.category",
              "conversion_action.status", "conversion_action.value_settings.always_use_default_value",
              "conversion_action.value_settings.default_value",
              "conversion_action.value_settings.default_currency_code"):
    verifier(f"la requête des actions demande {champ}", champ in requete_actions, True)
verifier("aucun filtre sur le statut : une action retirée garde ses conversions passées",
         "WHERE" in requete_actions, False)


# ── Les écritures ────────────────────────────────────────────────────────────
class FausseBase:
    """Refuse une colonne inconnue (PGRST204) et des clés variables dans un lot (PGRST102)."""

    COLONNES = {
        "google_ads_conversion_actions": {"user_id", "conversion_action_id", "name", "category", "status",
                                          "always_use_default_value", "default_value", "currency_code"},
        "google_ads_conversions_by_action": {"user_id", "date_start", "campaign_id", "conversion_action_id",
                                             "conversions", "conversions_value"},
    }

    def __init__(self):
        self.ecrit = []

    def table(self, nom):
        self.nom = nom
        return self

    def upsert(self, lignes, on_conflict=None):
        if len({frozenset(l) for l in lignes}) > 1:
            raise Exception("PGRST102 All object keys must match")
        for l in lignes:
            for k in l:
                if k not in self.COLONNES[self.nom]:
                    raise Exception(f"PGRST204 Could not find the '{k}' column")
        self.ecrit.append((self.nom, lignes, on_conflict))
        return self

    def execute(self):
        return self


base = FausseBase()
upsert_google_conversion_actions(base, "uid", actions)
table, ecrites, conflit = base.ecrit[0]
ecrit = {r["conversion_action_id"]: r for r in ecrites}
verifier("actions écrites dans leur table", table, "google_ads_conversion_actions")
verifier("une ligne par action et par compte", conflit, "user_id,conversion_action_id")
verifier("réglages écrits tels quels",
         (ecrit["30"]["always_use_default_value"], ecrit["30"]["default_value"]), (True, 1.0))
verifier("réglages absents écrits NULL",
         (ecrit["50"]["always_use_default_value"], ecrit["50"]["default_value"]), (None, None))

base = FausseBase()
upsert_google_conversions_par_action(base, "uid", lignes + lignes[:1])
table, ecrites, conflit = base.ecrit[0]
verifier("conversions par action écrites dans leur table", table, "google_ads_conversions_by_action")
verifier("clé jour × campagne × action", conflit, "user_id,date_start,campaign_id,conversion_action_id")
verifier("un doublon de clé dans le lot n'est écrit qu'une fois", len(ecrites), 6)
verifier("une valeur absente s'écrit NULL", ecrites[5]["conversions_value"], None)

base = FausseBase()
beaucoup = [dict(lignes[0], date_start=f"2026-{1 + i // 28:02d}-{1 + i % 28:02d}", campaign_id=str(i % 7))
            for i in range(2500)]
upsert_google_conversions_par_action(base, "uid", beaucoup)
verifier("un gros lot part en morceaux de 1 000 au plus",
         [len(e[1]) for e in base.ecrit], [1000, 1000, 500])

print("\nTOUT EST VERT" if not ECHECS else f"\n{len(ECHECS)} ÉCHEC(S)")
sys.exit(1 if ECHECS else 0)
