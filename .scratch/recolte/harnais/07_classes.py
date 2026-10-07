"""Ticket 07 — le plan et les trois classes. Hors ligne.

    python3.12 .scratch/recolte/harnais/07_classes.py

① `plan.planifier` : les mêmes canaux, les mêmes fils et les mêmes raisons de
saut qu'avant (recopiées de `run()` de `fetch_all.py`).
② `MiseAJour` et `RecolteComplete` contre une fausse base, les récoltes de canal
remplacées par des sondes : qui est passé, avec quel `depuis`, ce qui a été
publié, ce qui s'imprime, et le code de sortie.
③ Les lignes de commande : `--user` vide, `--depuis` hors limite.
"""
import ast
import io
import sys
from contextlib import redirect_stdout
from datetime import date, timedelta
from pathlib import Path

RACINE = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from faux import FausseBase  # noqa: E402

from saas.collecte import mise_a_jour, plan, recolte_complete  # noqa: E402
from saas.collecte.automatisation import alarmes, fils, passage  # noqa: E402

META = {"provider": "meta", "meta_token": "T", "instagram_business_id": "ig"}
META_SANS_IG = {"provider": "meta", "meta_token": "T"}
GOOGLE = {"provider": "google", "google_refresh_token": "R", "google_customer_id": "9",
          "ga4_property_id": "properties/5"}

# ── ① le plan ─────────────────────────────────────────────────────────────
p = plan.planifier([META, GOOGLE])
assert [[t.canal for t in f] for f in p.fils] == [["meta", "instagram"], ["google"], ["ga4"]]
assert p.sautes == [] and p.journal == [] and p.a_tente
assert p.prevus == ["meta", "instagram", "google", "ga4", "rapport"]

p = plan.planifier([META_SANS_IG, {**GOOGLE, "ga4_property_id": None}])
assert [[t.canal for t in f] for f in p.fils] == [["meta"], ["google"]]
assert [c for c, _ in p.sautes] == ["instagram", "ga4"]
assert "instagram_business_id" in p.sautes[0][1]
assert p.journal == [("ga4", "ga4 SAUTÉ : aucune propriété GA4 choisie — colonne(s) "
                             "vide(s) dans connected_accounts : ga4_property_id")]

p = plan.planifier([{**GOOGLE, "google_refresh_token": None}])     # jeton Google mort
assert p.fils == [] and not p.a_tente and p.prevus == []
assert [c for c, _ in p.sautes] == ["meta", "instagram", "google", "ga4"]
assert "aucun jeton Google (reconnexion à faire)" in p.journal[0][1]

p = plan.planifier([])                                             # aucune connexion
assert not p.a_tente and "aucune connexion Google sur ce compte" in p.journal[0][1]

p = plan.planifier([META, dict(META, meta_token="T2")])            # deux comptes Meta
assert p.prevus == ["meta", "instagram", "rapport"]                # dédoublonné
print("plan ok")

# ── ② les classes, contre une fausse base ─────────────────────────────────
APPELS = []


def sonde(canal):
    def f(sb, uid, *a, **k):
        APPELS.append((canal, uid, k.get("depuis", k.get("since_forcee", k.get("since_date")))))
        return {"message": "ok"} if canal == "ga4" else f"{canal}: ok"
    return f


passage.recolte_meta.recolter = sonde("meta")
passage.recolte_instagram.recolter = sonde("instagram")
passage.recolte_google.recolter = sonde("google")
passage.recolte_ga4.recolter = sonde("ga4")
PUBLIES = []


class FauxRapport:
    SEUIL_ESCALADE = 2

    @staticmethod
    def publish_weekly_report(sb, uid, email_to=None):
        PUBLIES.append((uid, email_to))
        return "rapport publié", [{"canal": "google", "semaines_muettes": 3, "mot": "x"}]


sys.modules["saas.traitement.build_report"] = FauxRapport
passage.relever_ouverture = lambda sb, uid, logs: None
AUJ = __import__("datetime").datetime.utcnow().strftime("%A")   # comme `_due_today`
AUTRE = "Sunday" if AUJ != "Sunday" else "Monday"


def base():
    sb = FausseBase({"profiles": [{"id": "u1", "fetch_schedule": AUJ},
                                  {"id": "u2", "fetch_schedule": AUTRE}],
                     "connected_accounts": [META, GOOGLE]})

    class Auth:
        class admin:
            @staticmethod
            def get_user_by_id(uid):
                class U:
                    class user:
                        email = f"{uid}@exemple.ch"
                return U
    sb.auth = Auth
    return sb


def lancer(classe_ou_main, *args):
    APPELS.clear(), PUBLIES.clear()
    alarmes._CANAUX_QUI_DURENT.clear()
    fils.client_service = lambda: SB
    mise_a_jour.client_service = lambda: SB
    recolte_complete.client_service = lambda: SB
    sortie = io.StringIO()
    with redirect_stdout(sortie):
        code = classe_ou_main(*args)
    return code, sortie.getvalue()


SB = base()
code, sortie = lancer(mise_a_jour.main, [])
assert code == 1, sortie                       # canal muet depuis 3 rapports → rouge
assert sorted({u for _, u, _ in APPELS}) == ["u1"], APPELS   # u2 : pas son jour
assert {c for c, _, _ in APPELS} == {"meta", "instagram", "google", "ga4"}
assert all(d is None for _, _, d in APPELS)    # mise à jour : reprise, pas de départ forcé
assert PUBLIES == [("u1", "u1@exemple.ch")]
assert "u1 → meta: ok | instagram: ok | google: ok | ga4: ok | rapport publié" in sortie, sortie
assert "!! ÉCHEC : 1 canal/canaux muets" in sortie
print("mise à jour ok")

SB = base()
code, sortie = lancer(mise_a_jour.main, ["--user", "u2"])
assert {u for _, u, _ in APPELS} == {"u2"}     # un seul compte, sans attendre son jour
SB = base()
code, sortie = lancer(mise_a_jour.main, ["--report-only", "u2"])
assert APPELS == [] and PUBLIES == [("u2", None)], (APPELS, PUBLIES)   # rien récolté, pas d'email
print("--user et --report-only ok")

SB = base()
code, sortie = lancer(recolte_complete.main, ["--user", "u2", "--depuis", "2025-01-01"])
assert {(c, d) for c, _, d in APPELS} == {("meta", date(2025, 1, 1)), ("instagram", None),
                                           ("google", date(2025, 1, 1)), ("ga4", date(2025, 1, 1))}
assert PUBLIES == [("u2", "u2@exemple.ch")]
SB = base()
code, _ = lancer(recolte_complete.main, ["--user", "u2"])
attendu = date.today() - timedelta(days=1126)
assert ("meta", "u2", attendu) in APPELS
print("récolte complète ok")

# ── ③ les lignes de commande ──────────────────────────────────────────────
code, sortie = lancer(recolte_complete.main, ["--user", ""])
assert code == 1 and "vise UN compte" in sortie and APPELS == []
code, sortie = lancer(recolte_complete.main, ["--user", "u2", "--depuis", "2019-01-01"])
assert code == 1 and "dépasse les 1126 jours" in sortie and APPELS == []
try:
    with redirect_stdout(io.StringIO()):
        recolte_complete.main([])
    raise AssertionError("--user exigé")
except SystemExit:
    pass
print("lignes de commande ok")

# ── aucune classe ne fait d'appel HTTP ────────────────────────────────────
for f in ("saas/collecte/mise_a_jour.py", "saas/collecte/recolte_complete.py",
          "saas/collecte/plan.py", "saas/collecte/automatisation/passage.py"):
    arbre = ast.parse((RACINE / f).read_text())
    noms = {getattr(n, "module", "") or "" for n in ast.walk(arbre)
            if isinstance(n, ast.ImportFrom)} | {a.name for n in ast.walk(arbre)
                                                 if isinstance(n, ast.Import) for a in n.names}
    assert not any(m in ("requests", "saas.collecte.socle.http") or m.endswith(".http")
                   for m in noms), (f, noms)
print("aucun HTTP dans les classes ok")
print("TOUT VERT")
