"""Ticket 10 — les Clusters de Google (`campaign_search_term_insight`,
`customer_search_term_insight`), sans réseau.

Lancer depuis la racine du dépôt :

    python3.12 -I .scratch/google-ads/harnais/10-les-groupes-de-termes-clusters/test_recolte.py

Réponses GAQL écrites à la main sur la forme REST de `searchStream` (liste de
lots, camelCase, int64 en chaînes). Rien ne part chez Google ni Supabase.
Faits d'API : carte, issue 19 (pas de coût, une campagne par requête, la
série par jour exige un seul cluster, fourre-tout au libellé vide sans terme).
"""
from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

RACINE = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(RACINE))

import saas.data.fetch_data.sources.google.ads.fetchers._query as q  # noqa: E402
from saas.data.fetch_data.shared import http_client  # noqa: E402
from saas.data.fetch_data.sources.google.ads.fetchers import clusters_termes as ct  # noqa: E402
from saas.data.fetch_data.sources.google.client import AccesGoogle  # noqa: E402
from saas.data.supabase.source_data.google import upsert_google_clusters_termes  # noqa: E402

q.secret = lambda k: "faux"  # sinon `entetes()` lit les vrais secrets

ECHECS: list[str] = []


def verifier(nom, obtenu, attendu):
    ok = obtenu == attendu
    print(("✓ " if ok else "✗ ") + nom + ("" if ok else f"\n    obtenu  : {obtenu!r}\n    attendu : {attendu!r}"))
    if not ok:
        ECHECS.append(nom)


# ── La fenêtre : 90 jours pleins, le jour en cours exclu ─────────────────────
f = ct.fenetre_de(date(2026, 11, 11))
verifier("la fenêtre finit la veille (jour en cours exclu)", f.fin, date(2026, 11, 10))
verifier("la fenêtre compte 90 jours pleins (issue 19 : 13.08 → 10.11)", f.debut, date(2026, 8, 13))

# ── Le seam « réponses Google → lignes » ─────────────────────────────────────
CLUSTERS_CAMPAGNE = [{"results": [
    {"campaignSearchTermInsight": {"id": "11", "categoryLabel": "location vélo", "campaignId": "222"},
     "metrics": {"impressions": "1000", "clicks": "120", "conversions": 6.5}},
    # Le fourre-tout : libellé vide, conservé.
    {"campaignSearchTermInsight": {"id": "99", "categoryLabel": "", "campaignId": "222"},
     "metrics": {"impressions": "300", "clicks": "40", "conversions": 0}},
    # Un cluster dont Google ne rend pas les conversions.
    {"campaignSearchTermInsight": {"id": "12", "categoryLabel": "vélo gratuit", "campaignId": "222"},
     "metrics": {"impressions": "50", "clicks": "3"}},
]}]
TERMES_CAMPAGNE = [{"results": [
    {"campaignSearchTermInsight": {"id": "11"}, "segments": {"searchTerm": "location vélo", "searchSubcategory": ""},
     "metrics": {"impressions": "400", "clicks": "60", "conversions": 3}},
    {"campaignSearchTermInsight": {"id": "11"}, "segments": {"searchTerm": "vélo lausanne", "searchSubcategory": ""},
     "metrics": {"impressions": "100", "clicks": "10", "conversions": 1}},
    # Le même terme, rangé aussi dans un autre cluster.
    {"campaignSearchTermInsight": {"id": "12"}, "segments": {"searchTerm": "vélo lausanne", "searchSubcategory": ""},
     "metrics": {"impressions": "20", "clicks": "1", "conversions": 0}},
]}]
FENETRE = ct.Fenetre(date(2026, 8, 13), date(2026, 11, 10))

lignes, err = ct.lignes_de(CLUSTERS_CAMPAGNE, TERMES_CAMPAGNE, "222", FENETRE)
verifier("aucune erreur", err, None)
verifier("une ligne par cluster", [l["cluster_id"] for l in lignes], ["11", "99", "12"])
verifier("aucun coût écrit, sur aucune ligne ni aucun terme",
         any("cost" in k for l in lignes for k in list(l) + [k2 for t in l["terms"] for k2 in t]), False)
verifier("le libellé et les chiffres du cluster",
         {k: lignes[0][k] for k in ("category_label", "impressions", "clicks", "conversions")},
         {"category_label": "location vélo", "impressions": 1000, "clicks": 120, "conversions": 6.5})
verifier("la campagne et la fenêtre sur chaque ligne",
         {(l["campaign_id"], l["window_start"], l["window_end"]) for l in lignes},
         {("222", "2026-08-13", "2026-11-10")})
verifier("le fourre-tout au libellé vide est conservé, sans terme",
         (lignes[1]["category_label"], lignes[1]["terms"], lignes[1]["clicks"]), ("", [], 40))
verifier("un 0 reste 0", lignes[1]["conversions"], 0.0)
verifier("une métrique absente → None, jamais 0", lignes[2]["conversions"], None)
verifier("les termes listés du cluster, tels que rendus",
         lignes[0]["terms"],
         [{"term": "location vélo", "impressions": 400, "clicks": 60, "conversions": 3.0},
          {"term": "vélo lausanne", "impressions": 100, "clicks": 10, "conversions": 1.0}])
verifier("un terme rangé dans deux clusters apparaît dans les deux",
         [t["term"] for t in lignes[2]["terms"]], ["vélo lausanne"])

CLUSTERS_COMPTE = [{"results": [
    {"customerSearchTermInsight": {"id": "7", "categoryLabel": "visite guidée"},
     "metrics": {"impressions": "10", "clicks": "2", "conversions": 0}},
]}]
TERMES_COMPTE = [{"results": [
    {"customerSearchTermInsight": {"id": "7"}, "segments": {"searchTerm": "visite"},
     "metrics": {"impressions": "4", "clicks": "1", "conversions": 0}},
]}]
compte, err = ct.lignes_de(CLUSTERS_COMPTE, TERMES_COMPTE, None, FENETRE)
verifier("niveau compte : campaign_id vide", (err, compte[0]["campaign_id"], compte[0]["cluster_id"]), (None, "", "7"))
verifier("niveau compte : les termes", [t["term"] for t in compte[0]["terms"]], ["visite"])
verifier("une erreur dans le flux annule tout",
         ct.lignes_de(CLUSTERS_CAMPAGNE + [{"error": {"message": "INTERNAL"}}], TERMES_CAMPAGNE, "222", FENETRE),
         ([], "INTERNAL"))


# ── Les requêtes ─────────────────────────────────────────────────────────────
class _Reponse:
    def __init__(self, corps):
        self._corps = corps

    def json(self):
        return self._corps


ENVOYE: list = []
# Le comportement simulé de Google : les termes sans filtre de cluster sont
# refusés (le cas le plus strict que la doc laisse ouvert), un par cluster passe.
TERMES_GLOBAUX_REFUSES = {"valeur": True}
REFUSER_CAMPAGNE: set = set()


def faux_post(url, headers=None, json=None, timeout=None):
    requete = json["query"]
    ENVOYE.append(requete)
    if "FROM campaign\n" in requete or requete.rstrip().endswith("FROM campaign") or "FROM campaign " in requete:
        return _Reponse([{"results": [{"campaign": {"id": "222"}, "metrics": {"impressions": "5"}},
                                      {"campaign": {"id": "333"}, "metrics": {"impressions": "5"}}]}])
    if any(f"campaign_id = {c}" in requete for c in REFUSER_CAMPAGNE):
        return _Reponse({"error": {"message": "QUOTA"}})
    termes = "segments.search_term" in requete
    compte = "customer_search_term_insight" in requete
    if termes:
        filtre = ".id = " in requete
        if not filtre and TERMES_GLOBAUX_REFUSES["valeur"]:
            return _Reponse({"error": {"message": "REQUIRES_FILTER_BY_SINGLE_RESOURCE"}})
        if compte:
            return _Reponse(TERMES_COMPTE)
        if filtre:
            cid = requete.split(".id = ")[1].split()[0]
            return _Reponse([{"results": [r for r in TERMES_CAMPAGNE[0]["results"]
                                          if r["campaignSearchTermInsight"]["id"] == cid]}])
        return _Reponse(TERMES_CAMPAGNE)
    return _Reponse(CLUSTERS_COMPTE if compte else CLUSTERS_CAMPAGNE)


http_client.post = faux_post
acces = AccesGoogle(jeton="jeton", client="123")

toutes, trous = ct.recuperer(acces, FENETRE)
verifier("aucun trou", trous, [])
verifier("le compte + deux campagnes Search", sorted({l["campaign_id"] for l in toutes}), ["", "222", "333"])
liste = [r for r in ENVOYE if "FROM campaign" in r and "insight" not in r][0]
verifier("les campagnes interrogées sont les Search de la fenêtre",
         all(x in liste for x in ("advertising_channel_type = 'SEARCH'", "'2026-08-13'", "'2026-11-10'")), True)
insights = [r for r in ENVOYE if "search_term_insight" in r]
verifier("aucune requête ne sélectionne segments.date (fenêtre agrégée)",
         any("SELECT" in r and "segments.date," in r.split("FROM")[0] for r in insights), False)
verifier("aucune requête ne demande le coût", any("cost" in r for r in insights), False)
verifier("chaque requête de campagne en filtre une seule",
         all(("campaign_id = 222" in r) != ("campaign_id = 333" in r)
             for r in insights if "campaign_search_term_insight" in r), True)
verifier("chaque requête porte la fenêtre",
         all("BETWEEN '2026-08-13' AND '2026-11-10'" in r for r in insights), True)
verifier("termes refusés sans filtre → relus un cluster à la fois",
         sorted(r.split(".id = ")[1].split()[0] for r in insights
                if "campaign_id = 222" in r and "search_term," in r and ".id = " in r),
         ["11", "12", "99"])
c222 = {l["cluster_id"]: l for l in toutes if l["campaign_id"] == "222"}
verifier("relus un par un, les termes retombent au bon cluster",
         ([t["term"] for t in c222["11"]["terms"]], [t["term"] for t in c222["12"]["terms"]]),
         (["location vélo", "vélo lausanne"], ["vélo lausanne"]))

ENVOYE.clear()
TERMES_GLOBAUX_REFUSES["valeur"] = False
toutes2, _ = ct.recuperer(acces, FENETRE)
verifier("termes acceptés sans filtre : une seule requête de termes par niveau",
         len([r for r in ENVOYE if "segments.search_term," in r]), 3)
verifier("même résultat par les deux chemins", toutes2, toutes)

ENVOYE.clear()
REFUSER_CAMPAGNE.add("333")
toutes3, trous3 = ct.recuperer(acces, FENETRE)
verifier("une campagne refusée est NOMMÉE", (len(trous3), "333" in trous3[0], "QUOTA" in trous3[0]), (1, True, True))
verifier("… et n'écrit rien (ses anciennes lignes gardent leur fenêtre)",
         sorted({l["campaign_id"] for l in toutes3}), ["", "222"])
REFUSER_CAMPAGNE.clear()


# ── Les écritures ────────────────────────────────────────────────────────────
class FausseBase:
    """Refuse une colonne inconnue (PGRST204) et des clés variables dans un lot (PGRST102)."""

    COLONNES = {"user_id", "campaign_id", "cluster_id", "category_label", "impressions", "clicks",
                "conversions", "terms", "window_start", "window_end"}

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


base = FausseBase()
upsert_google_clusters_termes(base, "uid", toutes + toutes[:1])
table, ecrites, conflit = base.ecrit[0]
verifier("écrites dans google_ads_search_term_clusters", table, "google_ads_search_term_clusters")
verifier("une ligne par niveau × cluster, réécrite à chaque passage", conflit, "user_id,campaign_id,cluster_id")
verifier("un doublon de clé n'est écrit qu'une fois", len(ecrites), len(toutes))
verifier("aucune colonne de coût", any("cost" in k for e in ecrites for k in e), False)
verifier("une métrique absente s'écrit NULL", [e["conversions"] for e in ecrites if e["cluster_id"] == "12" and e["campaign_id"] == "222"], [None])

base = FausseBase()
upsert_google_clusters_termes(base, "uid", [])
verifier("rien à écrire : aucun appel", base.ecrit, [])


# ── L'étape dans `sync.recolter` ─────────────────────────────────────────────
from saas.data.fetch_data.sources.google.ads import sync  # noqa: E402

APPELS: dict = {}
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
sync.termes_recherche.recuperer = lambda acces, f: ([], [])
for nom in ("fetch_google_ads_latest_date", "fetch_google_ads_ad_insights_latest_date",
            "fetch_google_conversions_par_action_latest_date", "fetch_google_asset_groups_latest_date",
            "fetch_google_search_terms_latest_date"):
    setattr(sync, nom, lambda sb, uid: None)


def faux_recuperer(acces, f):
    APPELS["fenetre"] = (f.debut, f.fin)
    return toutes, ["campagne 333 : QUOTA"]


sync.clusters_termes.recuperer = faux_recuperer
sync.upsert_google_clusters_termes = lambda sb, uid, rows: APPELS.setdefault("ecrit", rows)

mot = sync.recolter(None, "uid", "refresh", "123", depuis=date(2024, 1, 1))
attendu = ct.fenetre_de(date.today())
verifier("toujours les 90 derniers jours pleins, même en récolte complète",
         APPELS.get("fenetre"), (attendu.debut, attendu.fin))
verifier("les lignes lues sont écrites", APPELS.get("ecrit"), toutes)
verifier("le mot de fin compte les clusters", f"{len(toutes)} clusters de Google" in mot, True)
verifier("le mot de fin nomme le niveau refusé", "clusters REFUSÉ" in mot, True)

print("\nTOUT EST VERT" if not ECHECS else f"\n{len(ECHECS)} ÉCHEC(S)")
sys.exit(1 if ECHECS else 0)
