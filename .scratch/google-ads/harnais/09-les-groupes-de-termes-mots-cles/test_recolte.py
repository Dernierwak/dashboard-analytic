"""Ticket 09 — les termes de recherche × jour (`search_term_view`), sans réseau.

Lancer depuis la racine du dépôt :

    python3.12 -I .scratch/google-ads/harnais/09-les-groupes-de-termes-mots-cles/test_recolte.py

Réponses GAQL écrites à la main sur la forme REST de `searchStream` (liste de
lots, camelCase, int64 en chaînes). Rien ne part chez Google ni Supabase.
"""
from __future__ import annotations

import sys
from datetime import date, timedelta
from pathlib import Path

RACINE = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(RACINE))

import saas.data.fetch_data.sources.google.ads.fetchers._query as q  # noqa: E402
from saas.data.fetch_data.shared import http_client  # noqa: E402
from saas.data.fetch_data.sources.google.ads.fetchers import termes_recherche  # noqa: E402
from saas.data.fetch_data.sources.google.client import AccesGoogle  # noqa: E402
from saas.data.supabase.source_data.google import upsert_google_termes_recherche  # noqa: E402
from saas.data.supabase import _queries  # noqa: E402
from saas.data.supabase.fetch_state import state  # noqa: E402

q.secret = lambda k: "faux"  # sinon `entetes()` lit les vrais secrets

ECHECS: list[str] = []


def verifier(nom, obtenu, attendu):
    ok = obtenu == attendu
    print(("✓ " if ok else "✗ ") + nom + ("" if ok else f"\n    obtenu  : {obtenu!r}\n    attendu : {attendu!r}"))
    if not ok:
        ECHECS.append(nom)


# ── Le seam « réponse Google → lignes » ──────────────────────────────────────

def terme(cid, gid, texte, jour, mot=None, crit=None, type_mot=None, appariement=None, **metriques):
    segments = {"date": jour}
    if mot is not None:
        segments["keyword"] = {"adGroupCriterion": f"customers/1/adGroupCriteria/{gid}~{crit}",
                               "info": {"text": mot, "matchType": type_mot}}
    if appariement is not None:
        segments["searchTermMatchType"] = appariement
    return {"campaign": {"resourceName": f"customers/1/campaigns/{cid}", "id": cid},
            "adGroup": {"resourceName": f"customers/1/adGroups/{gid}", "id": gid, "name": f"Groupe {gid}"},
            "searchTermView": {"resourceName": f"customers/1/searchTermViews/{cid}~{gid}~x", "searchTerm": texte},
            "segments": segments,
            "metrics": metriques}


REPONSE = [{"results": [
    terme("222", "50", "location vélo électrique lausanne", "2026-10-05", "Location Vélo", "77", "PHRASE",
          "NEAR_PHRASE", impressions="400", clicks="21", costMicros="15500000", conversions=1.5),
    # Le même terme, apparié aussi par un autre mot-clé du même groupe : deux lignes.
    terme("222", "50", "location vélo électrique lausanne", "2026-10-05", "vélo électrique", "78", "BROAD",
          "BROAD", impressions="30", clicks="2", costMicros="900000", conversions=0),
]}, {"results": [
    # Accents et minuscules tels que Google les rend : aucune normalisation.
    terme("222", "50", "vélo gratuit ÉTÉ", "2026-10-06", "Location Vélo", "77", "PHRASE", "PHRASE",
          impressions="80", clicks="0", costMicros="0", conversions=0),
    # Sans mot-clé déclencheur (une campagne qui apparie sans mot-clé) et une
    # métrique absente de la réponse.
    terme("333", "60", "bike rental", "2026-10-06", impressions="12", clicks="1", costMicros="500000"),
]}]

lignes, err = termes_recherche.lignes_de(REPONSE)
verifier("aucune erreur, lots lus en entier", (err, len(lignes)), (None, 4))
l0 = lignes[0]
verifier("campagne, groupe d'annonces et jour lus par l'ID",
         (l0["campaign_id"], l0["ad_group_id"], l0["ad_group_name"], l0["date_start"]),
         ("222", "50", "Groupe 50", "2026-10-05"))
verifier("le terme et son mot-clé déclencheur (texte, type, critère)",
         (l0["search_term"], l0["keyword_text"], l0["keyword_match_type"], l0["keyword_criterion_id"]),
         ("location vélo électrique lausanne", "Location Vélo", "PHRASE", "77"))
verifier("le type d'appariement du terme, brut", l0["search_term_match_type"], "NEAR_PHRASE")
verifier("impressions, clics, coût (micros, jamais convertis ici), conversions",
         (l0["impressions"], l0["clicks"], l0["cost_micros"], l0["conversions"]), (400, 21, 15500000, 1.5))
verifier("un terme apparié par deux mots-clés fait deux lignes",
         [(l["keyword_criterion_id"], l["clicks"]) for l in lignes[:2]], [("77", 21), ("78", 2)])
verifier("le terme est recopié tel que Google l'a rendu (aucune normalisation)",
         lignes[2]["search_term"], "vélo gratuit ÉTÉ")
verifier("un 0 rendu par Google reste 0", (lignes[2]["clicks"], lignes[2]["cost_micros"]), (0, 0))
verifier("sans mot-clé déclencheur : clés vides (la contrainte d'unicité tient), jamais devinées",
         (lignes[3]["keyword_text"], lignes[3]["keyword_match_type"], lignes[3]["keyword_criterion_id"],
          lignes[3]["search_term_match_type"]),
         ("", "", "", ""))
verifier("une métrique absente reste None, jamais 0", lignes[3]["conversions"], None)
verifier("une ligne sans campagne, groupe ou terme lisible n'est pas écrite",
         termes_recherche.lignes_de([{"results": [
             {"searchTermView": {"searchTerm": "x"}, "segments": {"date": "2026-10-05"},
              "metrics": {"clicks": "3"}}]}]),
         ([], None))
verifier("une erreur au milieu du flux annule tout",
         termes_recherche.lignes_de([REPONSE[0], {"error": {"message": "INTERNAL"}}]), ([], "INTERNAL"))

# Au-delà de 10 000 : `searchStream` rend plusieurs lots de 10 000 au plus
# (carte, issue 19 : 10 106 lignes sur 90 jours chez A, lues sans erreur).
GROS = [{"results": [terme("222", "50", f"terme {i}", "2026-10-05", "m", "1", "EXACT", "EXACT", clicks="1")
                     for i in range(10_000)]},
        {"results": [terme("222", "50", f"terme {i}", "2026-10-06", "m", "1", "EXACT", "EXACT", clicks="1")
                     for i in range(106)]}]
verifier("au-delà d'un lot de 10 000 : toutes les lignes", len(termes_recherche.lignes_de(GROS)[0]), 10_106)


# ── La requête et les tranches ───────────────────────────────────────────────
class _Reponse:
    def __init__(self, corps):
        self._corps = corps

    def json(self):
        return self._corps


ENVOYE: list = []
REFUSER: set = set()


def faux_post(url, headers=None, json=None, timeout=None):
    ENVOYE.append((url, json["query"]))
    if any(f"'{d}'" in json["query"] for d in REFUSER):
        return _Reponse({"error": {"message": "QUOTA"}})
    return _Reponse(REPONSE)


http_client.post = faux_post

lignes_http, err_http = termes_recherche.tranche("jeton", "123", date(2026, 10, 1), date(2026, 10, 7))
verifier("tranche() rend les lignes du seam pur", (lignes_http, err_http), (lignes, None))
url, requete = ENVOYE[-1]
verifier("l'appel part en v26", url, "https://googleads.googleapis.com/v26/customers/123/googleAds:searchStream")
for champ in ("FROM search_term_view", "search_term_view.search_term", "campaign.id", "ad_group.id",
              "ad_group.name", "segments.keyword.ad_group_criterion", "segments.keyword.info.text",
              "segments.keyword.info.match_type", "segments.search_term_match_type", "segments.date",
              "metrics.impressions", "metrics.clicks", "metrics.cost_micros", "metrics.conversions",
              "'2026-10-01'", "'2026-10-07'"):
    verifier(f"la requête porte {champ}", champ in requete, True)

acces = AccesGoogle(jeton="jeton", client="123")
ENVOYE.clear()
fenetre = termes_recherche.Fenetre(date(2026, 1, 1), date(2026, 6, 30))  # 181 jours → 3 tranches
REFUSER.add("2026-04-01")
toutes, trous = termes_recherche.recuperer(acces, fenetre)
verifier("une requête par tranche de 90 jours", len(ENVOYE), 3)
verifier("une tranche refusée est NOMMÉE, pas jetée en silence", len(trous), 1)
verifier("le trou dit ses dates et la raison", ("2026-04-01" in trous[0], "QUOTA" in trous[0]), (True, True))
verifier("les tranches lues sont gardées", len(toutes), 2 * len(lignes))
REFUSER.clear()


# ── Les écritures ────────────────────────────────────────────────────────────
class FausseBase:
    """Refuse une colonne inconnue (PGRST204) et des clés variables dans un lot (PGRST102)."""

    COLONNES = {"user_id", "date_start", "campaign_id", "ad_group_id", "ad_group_name", "search_term",
                "keyword_criterion_id", "keyword_text", "keyword_match_type", "search_term_match_type",
                "impressions", "clicks", "cost_micros", "conversions"}

    def __init__(self):
        self.ecrit = []

    def table(self, nom):
        self.nom = nom
        return self

    def upsert(self, lot, on_conflict=None):
        if len({frozenset(l) for l in lot}) > 1:
            raise Exception("PGRST102 All object keys must match")
        for l in lot:
            for k in l:
                if k not in self.COLONNES:
                    raise Exception(f"PGRST204 Could not find the '{k}' column")
        self.ecrit.append((self.nom, lot, on_conflict))
        return self

    def execute(self):
        return self


CLE = "user_id,date_start,ad_group_id,search_term,keyword_criterion_id,search_term_match_type"
base = FausseBase()
upsert_google_termes_recherche(base, "uid", lignes + lignes[:1])
table, ecrites, conflit = base.ecrit[0]
verifier("écrites dans google_ads_search_terms", table, "google_ads_search_terms")
verifier("une ligne par jour × groupe × terme × mot-clé × appariement", conflit, CLE)
verifier("un doublon de clé dans le lot n'est écrit qu'une fois", len(ecrites), 4)
verifier("les deux mots-clés d'un même terme restent deux lignes",
         [e["keyword_criterion_id"] for e in ecrites[:2]], ["77", "78"])
verifier("une métrique absente s'écrit NULL, jamais 0", ecrites[3]["conversions"], None)
verifier("un 0 s'écrit 0", ecrites[2]["clicks"], 0)

base = FausseBase()
upsert_google_termes_recherche(base, "uid", termes_recherche.lignes_de(GROS)[0])
verifier("un gros lot part en morceaux de 1 000 au plus", [len(e[1]) for e in base.ecrit][-2:], [1000, 106])

base = FausseBase()
upsert_google_termes_recherche(base, "uid", [])
verifier("rien à écrire : aucun appel", base.ecrit, [])


# ── La reprise : sa propre date, 30 jours de recouvrement ────────────────────
class BaseDeLecture:
    def __init__(self, dates):
        self.dates = dates
        self.lue = None

    def table(self, nom):
        self.lue = nom
        return self

    def select(self, *_):
        return self

    def eq(self, *_):
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, *_):
        return self

    def execute(self):
        class R:
            pass
        r = R()
        r.data = [{"date_start": d} for d in sorted(self.dates, reverse=True)[:1]]
        return r


b = BaseDeLecture(["2026-10-01", "2026-10-07"])
verifier("le point de reprise se lit dans la table des termes",
         (_queries.fetch_google_search_terms_latest_date(b, "uid"), b.lue),
         ("2026-10-07", "google_ads_search_terms"))
verifier("table vide : pas de point de reprise", _queries.fetch_google_search_terms_latest_date(BaseDeLecture([]), "uid"), None)
verifier("ré-exporté par fetch_state.state",
         state.fetch_google_search_terms_latest_date is _queries.fetch_google_search_terms_latest_date, True)


# ── L'étape dans `sync.recolter` ─────────────────────────────────────────────
from saas.data.fetch_data.sources.google.ads import sync  # noqa: E402

APPELS: dict = {}
AUJOURDHUI = date.today()
sync.get_access_token_from_refresh = lambda r: "jeton"
sync.photo_budget = lambda *a, **k: None
sync.statuts.fetch_campaign_statuses = lambda *a: ({}, None)
sync.journal_changements = lambda *a, **k: False
sync.avancer_couverture = lambda *a, **k: None
sync.insights_campagnes.recuperer = lambda acces, f: ([], [])
sync.insights_annonces.recuperer = lambda acces, f: ([], [])
sync.actions_conversion.recuperer = lambda acces: ([], None)
sync.conversions_par_action.recuperer = lambda acces, f: ([], [])
sync.groupes_elements.recuperer = lambda acces, f: ([], [])
sync.clusters_termes.recuperer = lambda acces, f: ([], [])  # étape du ticket 10
for nom in ("fetch_google_ads_latest_date", "fetch_google_ads_ad_insights_latest_date",
            "fetch_google_conversions_par_action_latest_date", "fetch_google_asset_groups_latest_date"):
    setattr(sync, nom, lambda sb, uid: None)
sync.fetch_google_search_terms_latest_date = lambda sb, uid: "2026-10-07"


def faux_recuperer(acces, f):
    APPELS["fenetre"] = (f.debut, f.fin)
    return lignes, ["2026-01-01→2026-03-31 : QUOTA"]


sync.termes_recherche.recuperer = faux_recuperer
sync.upsert_google_termes_recherche = lambda sb, uid, rows: APPELS.setdefault("ecrit", rows)

mot = sync.recolter(None, "uid", "refresh", "123")
verifier("reprise depuis SA date − 30 jours, jusqu'à aujourd'hui",
         APPELS.get("fenetre"), (date(2026, 10, 7) - timedelta(days=30), AUJOURDHUI))
verifier("les lignes lues sont écrites", APPELS.get("ecrit"), lignes)
verifier("le mot de fin compte les lignes de termes", "4 lignes termes de recherche" in mot, True)
verifier("le mot de fin nomme la tranche refusée", "termes de recherche REFUSÉE" in mot, True)

APPELS.clear()
sync.recolter(None, "uid", "refresh", "123", depuis=date(2024, 1, 1))
verifier("une récolte complète (`depuis`) part de `depuis`", APPELS.get("fenetre")[0], date(2024, 1, 1))

print("\nTOUT EST VERT" if not ECHECS else f"\n{len(ECHECS)} ÉCHEC(S)")
sys.exit(1 if ECHECS else 0)
