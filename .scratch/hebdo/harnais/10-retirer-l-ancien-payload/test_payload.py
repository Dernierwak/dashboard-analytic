"""Harnais du ticket 10 — l'ancien payload quitte le rapport.

Hors ligne, depuis la racine du dépôt :
    python3.12 .scratch/hebdo/harnais/10-retirer-l-ancien-payload/test_payload.py

Ce qu'il exécute : aucune clé sortante ; la publication tient aux blocs neufs
(la semaine + au moins une source branchée), plus à une dépense ; l'escalade du
canal muet relit toujours `canaux_muets` ; les insights se lisent une fois ; la
lecture des publications est paginée ; le Lecteur a perdu ses lectures mortes.
"""
import importlib.util
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from commun.faux_lecteur import FauxLecteur, Constats  # noqa: E402
from saas.data.supabase.processed_data.weekly_report.builder import build_payload  # noqa: E402
from saas.data.supabase.processed_data.weekly_report import reader  # noqa: E402

JOUR_FETCH = date(2026, 10, 29)                 # un jeudi → semaine 22 → 28 octobre
DEBUT, FIN = date(2026, 10, 22), date(2026, 10, 28)
META = {"source": "meta", "created_at": "2026-01-10T08:00:00+00:00", "a_reconnecter_depuis": None}
GOOGLE = {"source": "google", "created_at": "2026-02-01T08:00:00+00:00", "a_reconnecter_depuis": None}


def couvert(source, flux, jusqu_au=FIN):
    return {"source": source, "flux": flux, "sans_trou_depuis": "2026-01-01",
            "sans_trou_jusqu_au": jusqu_au.isoformat()}


def ligne_meta(jour, spend=10.0):
    return {"date_start": jour.isoformat(), "campaign_id": "c1", "campaign_name": "Été",
            "ad_id": "a1", "spend": spend, "impressions": 1000, "clicks": 20}


class Compte(FauxLecteur):
    """Meta branché ; lignes et couverture au choix. Compte les lectures."""

    def __init__(self, connexions=(META,), lignes=(), couverture=None, muets=None, historique=()):
        super().__init__(JOUR_FETCH, "Thursday")
        self._connexions = [dict(c) for c in connexions]
        self._lignes = list(lignes)
        self._couverture = (couverture if couverture is not None
                            else [couvert("meta", "insights"), couvert("meta", "journal")])
        self._muets = muets or {}
        self._historique = list(historique)
        self.appels = {"meta_ads": 0, "google_ads": 0}

    def meta_ads(self):
        self.appels["meta_ads"] += 1
        return self._lignes

    def google_ads(self):
        self.appels["google_ads"] += 1
        return []

    def connexions_etat(self): return self._connexions
    def couverture(self): return self._couverture
    def canaux_muets(self): return self._muets
    def rapports_publies(self, avant, limite=8): return self._historique


constat = Constats()
SEMAINE = [DEBUT + timedelta(days=i) for i in range(7)]

# ── Aucune clé sortante ─────────────────────────────────────────────────────
SORTANTES = {"verdict", "verdict_pct", "verdict_metric", "verdict_tone", "kpi_focus",
             "metrics_read", "metrics_prev", "metrics_series", "kpis", "changements",
             "week_label", "since", "until"}
PERMISES = {"semaine", "sources", "totaux", "canaux", "frise", "week_start", "version",
            "canaux_muets"}
avec_tout = Compte(lignes=[ligne_meta(j) for j in SEMAINE])
p = build_payload(avec_tout)
constat(p is not None and not (SORTANTES & set(p)),
        f"aucune clé sortante : {sorted(SORTANTES & set(p or {}))}")
constat(p is not None and set(p) <= PERMISES,
        f"rien d'autre que les blocs neufs, la clé d'écriture et l'escalade : {sorted(p or {})}")
constat(p is not None and "frise" in p and "campagnes" in p["frise"],
        "la clé `frise` est celle des blocs neufs (campagnes de l'année)")

# ── Les insights se lisent une fois ─────────────────────────────────────────
# Google n'est pas branché sur ce compte : depuis la revue d'intégration
# (user story 48), la frise ne lit plus une régie débranchée.
constat(avec_tout.appels == {"meta_ads": 1, "google_ads": 0},
        f"meta_ads() lu une seule fois par rapport, google_ads() (pas branché) jamais : {avec_tout.appels}")

# ── La publication tient aux blocs neufs ────────────────────────────────────
p = build_payload(Compte(lignes=[]))
constat(p is not None and p["totaux"]["depense"]["meta"] == 0,
        "semaine sans diffusion d'une source qui a répondu → publié, 0 CHF : "
        f"{p and p['totaux']['depense']}")

mort = dict(META, a_reconnecter_depuis="2026-10-27T07:00:00+00:00")
p = build_payload(Compte(connexions=(mort,), lignes=[]))
constat(p is not None and p["sources"]["meta"]["etat"] == "jeton_mort",
        f"jeton mort sans dépense → publié, la page l'explique : {p and p['sources']}")

p = build_payload(Compte(lignes=[], couverture=[couvert("meta", "insights", FIN - timedelta(days=2))]))
constat(p is not None and p["sources"]["meta"]["etat"] == "panne",
        f"panne sans dépense → publié : {p and p['sources']}")

p = build_payload(Compte(connexions=(), lignes=[ligne_meta(j) for j in SEMAINE]))
constat(p is None, "aucune source branchée → aucun rapport, même avec des lignes en base")


class ConnexionsIllisibles(Compte):
    def connexions_etat(self):
        raise RuntimeError("base injoignable")


constat(build_payload(ConnexionsIllisibles(lignes=[ligne_meta(j) for j in SEMAINE])) is None,
        "connexions illisibles → aucun rapport plutôt qu'une page sans état")

# ── L'escalade relit toujours `canaux_muets` ────────────────────────────────
historique = [{"week_start": "2026-10-19", "payload": {"canaux_muets": [{"canal": "meta"}]}},
              {"week_start": "2026-10-12", "payload": {"canaux_muets": []}}]
p = build_payload(Compte(lignes=[ligne_meta(date(2026, 10, 24))],
                         muets={"meta": "META_TOKEN expiré"}, historique=historique))
muets = (p or {}).get("canaux_muets")
constat(muets == [{"canal": "meta", "nom": "Meta Ads", "mot": "META_TOKEN expiré",
                   "depuis": "2026-10-24", "chiffres_tus": True, "semaines_muettes": 2}],
        f"canal muet → nommé, borné, compté sur les rapports publiés : {muets}")
p = build_payload(Compte(lignes=[ligne_meta(j) for j in SEMAINE]))
constat(p is not None and p.get("canaux_muets") == [],
        "aucun canal muet → liste vide, toujours présente (l'escalade y lit « revenu »)")
p = build_payload(Compte(lignes=[ligne_meta(FIN)], muets={"meta": "500"}))
constat(p is not None and p["canaux_muets"][0]["chiffres_tus"] is False,
        "muet après avoir tout écrit → signalé, ne tait rien")

# ── Le Lecteur a perdu ses lectures mortes ──────────────────────────────────
mortes = [m for m in ("objectif", "ga4_contexte", "ga4_insights", "abonnes", "dates_declarees")
          if hasattr(reader.LecteurSupabase, m) or hasattr(reader.Lecteur, m)]
constat(not mortes, f"le Lecteur ne porte plus objectif, GA4, abonnés, dates déclarées : {mortes}")
constat(importlib.util.find_spec("saas.data.supabase.processed_data.weekly_report._ga4") is None,
        "`_ga4.py` a quitté l'arbre")


# ── `publications()` est paginée (plafond PostgREST, `CLAUDE.md` §8) ────────
class FausseRequete:
    def __init__(self, lignes): self._lignes, self._plage = lignes, None
    def select(self, *_a, **_k): return self
    def eq(self, *_a, **_k): return self
    def order(self, *_a, **_k): return self
    def range(self, debut, fin): self._plage = (debut, fin); return self

    def execute(self):
        debut, fin = self._plage or (0, 999)
        fin = min(fin, debut + 999)             # PostgREST tronque à 1 000 en silence
        return type("R", (), {"data": self._lignes[debut:fin + 1]})()


class FauxClient:
    def __init__(self, n): self._lignes = [{"post_id": str(i)} for i in range(n)]
    def table(self, _nom): return FausseRequete(self._lignes)


lus = reader.LecteurSupabase(FauxClient(2_345), "u1").publications()
constat(len(lus) == 2_345, f"2 345 posts en base → {len(lus)} lus")

constat.conclure()
