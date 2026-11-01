"""Harnais des corrections de la revue de la branche d'intégration hebdo.

Hors ligne, depuis la racine du dépôt :
    python3.12 .scratch/hebdo/harnais/11-revue-integration/test_payload.py

Ce qu'il exécute :
  1. chaque lecture paginée du Lecteur est triée sur une clé totale (`CLAUDE.md` §8) ;
  2. une source débranchée ne se voit nulle part, même avec des lignes en base
     (spec, user story 48) ;
  3. une dépense absente ou illisible n'est jamais un 0 : la ligne est ignorée
     (`CLAUDE.md` §7).

Compte servi le jeudi ; le rapport du jeudi 29 octobre 2026 mesure la semaine
du 22 au 28 octobre.
"""
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from commun.faux_lecteur import FauxLecteur, Constats  # noqa: E402
from saas.data.supabase.processed_data.weekly_report.builder import build_payload  # noqa: E402
from saas.data.supabase.processed_data.weekly_report import reader  # noqa: E402

JOUR_FETCH = date(2026, 10, 29)
DEBUT, FIN = date(2026, 10, 22), date(2026, 10, 28)
SEMAINE = [DEBUT + timedelta(days=i) for i in range(7)]


def connexion(source):
    return {"source": source, "created_at": "2026-01-05T08:00:00+00:00", "a_reconnecter_depuis": None}


def couvert(source, flux):
    return {"source": source, "flux": flux, "sans_trou_depuis": "2026-01-01",
            "sans_trou_jusqu_au": FIN.isoformat()}


def meta(jour, cid="m1", spend="10", impressions="1000", clicks="20"):
    return {"date_start": jour.isoformat(), "campaign_id": cid, "campaign_name": cid,
            "ad_id": f"a_{cid}", "spend": spend, "impressions": impressions, "clicks": clicks}


def google(jour, cid="g1", micros=5_000_000):
    return {"date_start": jour.isoformat(), "campaign_id": cid, "campaign_name": cid,
            "cost_micros": micros, "impressions": 500, "clicks": 10}


POST = {"post_id": "p1", "date": "2026-10-24T08:00:00+0000", "type": "IMAGE",
        "media_url": "https://x.test/p1.jpg", "permalink": "https://www.instagram.com/p/p1/"}


class Compte(FauxLecteur):
    def __init__(self, branchees=("meta", "google"), meta_rows=(), google_rows=(),
                 posts=(), config_google=()):
        super().__init__(JOUR_FETCH, "Thursday")
        self._branchees = branchees
        self._meta, self._google, self._posts = list(meta_rows), list(google_rows), list(posts)
        self._cfg = {"google_campaign_config": list(config_google)}

    def connexions_etat(self): return [connexion(s) for s in self._branchees]

    def couverture(self):
        couv = [couvert(s, f) for s in ("meta", "google") for f in ("insights", "journal")]
        return couv + [couvert("instagram", "posts")]

    def meta_ads(self): return self._meta
    def google_ads(self): return self._google
    def publications(self): return self._posts
    def campagnes_config(self, table): return self._cfg.get(table, [])


constat = Constats()

# ── 1. Pagination sur une clé totale ─────────────────────────────────────────
class Requete:
    """Retient la table et les `order` ; rend une page vide."""

    def __init__(self, journal, table):
        self._j = journal
        self._j[table] = []
        self._table = table

    def order(self, colonne, **_k):
        self._j[self._table].append(colonne)
        return self

    @property
    def not_(self):
        # Une propriété dans supabase-py (`.not_.is_(…)`), pas une méthode.
        return self

    def __getattr__(self, _nom):
        # select, eq, gte, lt, is_, range… : tous rendent la requête.
        return lambda *a, **k: self

    def execute(self):
        return type("R", (), {"data": []})()


class Client:
    def __init__(self): self.ordres = {}
    def table(self, nom): return Requete(self.ordres, nom)


def ordres(lire):
    client = Client()
    lire(reader.LecteurSupabase(client, "u1"))
    return client.ordres


o = ordres(lambda l: l.campagnes_config("google_campaign_config"))["google_campaign_config"]
constat(o[:1] == ["campaign_id"] and "campaign_name" in o,
        f"campagnes_config triée sur campaign_id, campaign_name en départage (clé d'avant l'étape B) : {o}")
o = ordres(lambda l: l.creas())["meta_ads_creatives"]
constat(o == ["ad_id"], f"creas triée sur ad_id, la clé de la table : {o}")
o = ordres(lambda l: l.changements(DEBUT, FIN))["platform_changes"]
constat(o == ["occurred_at", "channel", "change_id"],
        f"changements : occurred_at, puis la clé (channel, change_id) : {o}")
o = ordres(lambda l: l.statuts_google())["platform_changes"]
constat(o == ["occurred_at", "change_id"],
        f"statuts_google (canal fixé) : occurred_at, puis change_id : {o}")

# ── 2. Une source débranchée ne se voit nulle part ───────────────────────────
lignes_meta = [meta(j) for j in SEMAINE]
lignes_google = [google(j) for j in SEMAINE]
cfg_google = [{"campaign_id": "g1", "campaign_name": "Google", "effective_status": "ENABLED",
               "start_date": "2026-03-01", "end_date": None}]

p = build_payload(Compte(branchees=("meta",), meta_rows=lignes_meta, google_rows=lignes_google,
                         config_google=cfg_google))
plateformes = {c["plateforme"] for c in p["frise"]["campagnes"]}
constat("google" not in plateformes and "meta" in plateformes,
        f"Google débranché avec des lignes et une config en base : aucune campagne Google dans la frise — {plateformes}")
constat("google" not in p["sources"] and "google" not in p["totaux"]["depense"],
        "ni dans `sources`, ni dans les totaux")

p = build_payload(Compte(branchees=("meta", "google"), meta_rows=lignes_meta,
                         google_rows=lignes_google, config_google=cfg_google))
constat({c["plateforme"] for c in p["frise"]["campagnes"]} == {"meta", "google"},
        "les deux branchées : les deux dans la frise")

p = build_payload(Compte(branchees=("google",), google_rows=lignes_google, posts=[POST]))
constat("posts" not in p.get("frise", {}),
        "Meta débranché, des posts en base : pas de clé posts, donc pas d'onglet Organique")
constat(all(c["plateforme"] == "google" for c in p["frise"]["campagnes"]),
        "et aucune campagne Meta")

p = build_payload(Compte(branchees=("meta",), meta_rows=lignes_meta, posts=[POST]))
constat(len(p["frise"].get("posts") or []) == 1, "Meta branché : les posts restent")

# ── 3. Une dépense absente ou illisible n'est jamais un 0 ────────────────────
# Dans la semaine : une ligne lisible (10 CHF, 1 000 impressions), une dépense
# absente, une dépense illisible — sur une autre campagne, qui ne dépense rien
# de lisible.
illisibles = [meta(DEBUT, "m1"),
              meta(DEBUT + timedelta(days=1), "m_x", spend=None, impressions="5000"),
              meta(DEBUT + timedelta(days=2), "m_x", spend="abc", impressions="7000")]
google_illisible = [google(DEBUT, "g1"), google(DEBUT + timedelta(days=1), "g_x", micros=None)]
p = build_payload(Compte(meta_rows=illisibles, google_rows=google_illisible))

constat(p["totaux"]["depense"]["meta"] == 10.0 and p["totaux"]["impressions"]["meta"] == 1000,
        f"totaux Meta : la ligne illisible n'entre ni en dépense ni en impressions — "
        f"{p['totaux']['depense']['meta']} / {p['totaux']['impressions']['meta']}")
constat(p["totaux"]["depense"]["google"] == 5.0 and p["totaux"]["impressions"]["google"] == 500,
        f"totaux Google : cost_micros absent → ligne ignorée — "
        f"{p['totaux']['depense']['google']} / {p['totaux']['impressions']['google']}")
v = p["canaux"]["meta"]["volumes"]
constat(v == {"depense": 10.0, "impressions": 1000, "clics": 20},
        f"carte Meta : volumes sur les seules lignes lisibles — {v}")
ids = {c["id"] for c in p["frise"]["campagnes"]}
constat("m_x" not in ids and "g_x" not in ids,
        f"frise : une campagne qui n'a que des dépenses illisibles n'est pas dessinée à 0 — {sorted(ids)}")

constat.conclure()
