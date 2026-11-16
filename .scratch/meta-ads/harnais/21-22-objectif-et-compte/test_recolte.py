"""Harnais des tickets 21 et 22 — l'objectif déclaré, et le compte publicitaire choisi.

Hors ligne : aucun appel à Meta ni à Supabase. Le client Graph est remplacé par
un faux qui note les adresses demandées ; la base par une fausse qui rend ce
qu'on lui dit, ou lève l'erreur `42703` d'une colonne absente.
    python3.12 .scratch/meta-ads/harnais/21-22-objectif-et-compte/test_recolte.py
(depuis la racine du dépôt).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
from saas.data.fetch_data.sources.meta.ads import sync  # noqa: E402
from saas.data.fetch_data.sources.meta.ads.fetchers import accounts, campaigns  # noqa: E402
from saas.data.fetch_data.sources.meta.graph_client import AccesMeta  # noqa: E402
from saas.data.supabase import _queries  # noqa: E402

JETON = "EAAB-faux-jeton-meta"
echecs: list[str] = []


def constat(nom: str, vrai: bool) -> None:
    print(("ok   " if vrai else "ÉCHEC ") + nom)
    if not vrai:
        echecs.append(nom)


class ColonneAbsente(Exception):
    code = "42703"


class Requete:
    """Une requête PostgREST réduite à ce que les deux lectures appellent."""
    def __init__(self, base, table):
        self.base, self.table = base, table

    def select(self, colonnes):
        self.colonnes = colonnes
        return self

    def eq(self, *_):
        return self

    def limit(self, *_):
        return self

    def execute(self):
        return self.base.repondre(self.table, self.colonnes)


class Base:
    def __init__(self, reponses):
        self.reponses = reponses

    def table(self, nom):
        return Requete(self, nom)

    def repondre(self, table, colonnes):
        r = self.reponses[(table, colonnes)]
        if isinstance(r, Exception):
            raise r
        return type("R", (), {"data": r})()


# ── Ticket 21 : l'objectif voyage avec le statut ─────────────────────────────
print("— 21 · l'objectif déclaré")
lignes, sans_id = campaigns.lignes_config_meta("u1", [
    {"id": "1", "name": "Trafic", "effective_status": "ACTIVE", "objective": "OUTCOME_TRAFFIC"},
    {"id": "2", "name": "Sans objectif", "effective_status": "PAUSED"},
    {"id": "3", "name": "Vide", "objective": ""},
])
constat("l'objectif est recopié brut", lignes[0]["objective"] == "OUTCOME_TRAFFIC")
constat("un objectif absent s'écrit NULL, pas un objectif supposé", lignes[1]["objective"] is None)
constat("une chaîne vide s'écrit NULL", lignes[2]["objective"] is None)
constat("le statut et l'ID ne bougent pas",
        lignes[0]["effective_status"] == "ACTIVE" and lignes[0]["campaign_id"] == "1" and sans_id == 0)

constat("colonne présente → on l'écrit",
        _queries.meta_objectif_present(Base({("meta_campaign_config", "objective"): []})) is True)
constat("colonne absente (42703) → on ne l'écrit pas",
        _queries.meta_objectif_present(Base({("meta_campaign_config", "objective"): ColonneAbsente()})) is False)
try:
    _queries.meta_objectif_present(Base({("meta_campaign_config", "objective"): ConnectionError("réseau")}))
    constat("une panne réseau n'est pas une colonne absente", False)
except ConnectionError:
    constat("une panne réseau n'est pas une colonne absente", True)


# ── Ticket 22 : le compte choisi ─────────────────────────────────────────────
print("— 22 · le compte publicitaire choisi")
CLE = ("connected_accounts", "meta_ad_account_id")
constat("un compte choisi se lit",
        _queries.fetch_compte_pub_meta_choisi(Base({CLE: [{"meta_ad_account_id": "act_22"}]}), 7) == "act_22")
constat("rien de choisi → None",
        _queries.fetch_compte_pub_meta_choisi(Base({CLE: [{"meta_ad_account_id": None}]}), 7) is None)
constat("ligne introuvable → None", _queries.fetch_compte_pub_meta_choisi(Base({CLE: []}), 7) is None)
constat("colonne absente (42703) → None, la récolte continue",
        _queries.fetch_compte_pub_meta_choisi(Base({CLE: ColonneAbsente()}), 7) is None)

appels: list[str] = []
reponses_graph: dict[str, tuple] = {}


def faux_lire(url, params, *, timeout):
    appels.append(url)
    return reponses_graph[url.rsplit("/", 1)[-1]]


accounts.lire = faux_lire
acces = AccesMeta(jeton=JETON)

reponses_graph["act_22"] = ({"id": "act_22", "timezone_name": "Europe/Zurich"}, None)
constat("le compte choisi rend son fuseau",
        accounts.compte_choisi(acces, "act_22") == ("act_22", "Europe/Zurich", None))

appels.clear()
compte, fuseau, err = accounts.compte_choisi(acces, "act_22/insights?x=1")
constat("un identifiant qui n'a pas la forme act_… ne part pas dans une URL",
        compte is None and err is not None and appels == [])

reponses_graph["act_99"] = (None, "Unsupported get request")
constat("un compte que le jeton ne voit plus rend l'erreur de Meta",
        accounts.compte_choisi(acces, "act_99") == (None, None, "Unsupported get request"))

# Le choix du passage : choisi → lui ; pas choisi → le premier, comme avant.
reponses_graph["adaccounts"] = ({"data": [{"id": "act_1", "timezone_name": "Europe/Paris"},
                                          {"id": "act_22", "timezone_name": "Europe/Zurich"}]}, None)
constat("choisi → c'est lui qui est lu, pas le premier de la liste",
        sync._compte_a_lire(Base({CLE: [{"meta_ad_account_id": "act_22"}]}), JETON, 7)
        == ("act_22", "Europe/Zurich"))
constat("rien de choisi → le premier de la liste, comme avant",
        sync._compte_a_lire(Base({CLE: [{"meta_ad_account_id": None}]}), JETON, 7)
        == ("act_1", "Europe/Paris"))
constat("section 26 pas jouée → le premier de la liste, comme avant",
        sync._compte_a_lire(Base({CLE: ColonneAbsente()}), JETON, 7) == ("act_1", "Europe/Paris"))
constat("sans ligne de connexion (appel d'avant le ticket) → le premier, sans lire la base",
        sync._compte_a_lire(Base({}), JETON, None) == ("act_1", "Europe/Paris"))
try:
    sync._compte_a_lire(Base({CLE: [{"meta_ad_account_id": "act_99"}]}), JETON, 7)
    constat("choisi mais illisible → échec, jamais un autre compte", False)
except RuntimeError as e:
    constat("choisi mais illisible → échec, jamais un autre compte", "act_" not in str(e))

print()
print(f"{len(echecs)} échec(s)" if echecs else "tout passe")
sys.exit(1 if echecs else 0)
