"""Harnais du ticket 07 — la frise des campagnes (`frise.annee`, `frise.campagnes`).

Hors ligne, depuis la racine du dépôt :
    python3.12 .scratch/hebdo/harnais/07-la-frise-des-campagnes/test_payload.py

Compte servi le jeudi ; le rapport du jeudi 29 octobre 2026 mesure la semaine
du 22 au 28 octobre. Chaque constat est une promesse de la page : une barre
par campagne, sous son nom actuel, avec un statut qu'on peut filtrer.
"""
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from commun.faux_lecteur import FauxLecteur, Constats  # noqa: E402
from saas.data.supabase.processed_data.weekly_report.builder import build_payload  # noqa: E402

JOUR_FETCH = date(2026, 10, 29)          # un jeudi : semaine du 22 au 28 octobre


def jours(debut, fin):
    return [debut + timedelta(days=i) for i in range((fin - debut).days + 1)]


def meta(jour, cid, nom, ad, spend=10.0):
    return {"date_start": jour.isoformat(), "campaign_id": cid, "campaign_name": nom,
            "ad_id": ad, "spend": spend, "impressions": 1000, "clicks": 20}


def config(cid, nom, statut=None, debut=None, fin=None):
    return {"campaign_id": cid, "campaign_name": nom, "effective_status": statut,
            "start_date": debut, "end_date": fin}


class Compte(FauxLecteur):
    """Un compte gréé sur des lignes fixes. Les insights peuvent aller jusqu'au
    jour du fetch compris (partiel), comme en service."""

    def __init__(self, meta_rows=(), google_rows=(), config_meta=(), config_google=(), creas=()):
        super().__init__(JOUR_FETCH, "Thursday")
        self._meta, self._google = list(meta_rows), list(google_rows)
        self._cfg = {"meta_campaign_config": list(config_meta),
                     "google_campaign_config": list(config_google)}
        self._creas = list(creas)

    # Une source branchée : depuis le ticket 10, c'est elle qui fait publier
    # le rapport, pas la dépense — la frise sort même sans dépense récente.
    # Les deux régies : seule une régie branchée entre dans la frise (user story 48).
    def connexions_etat(self):
        return [{"source": s, "created_at": "2025-01-01T00:00:00+00:00",
                 "a_reconnecter_depuis": None} for s in ("meta", "google")]

    def meta_ads(self): return self._meta
    def google_ads(self): return self._google
    def campagnes_config(self, table): return self._cfg.get(table, [])
    def creas(self): return self._creas


def frise(compte):
    return build_payload(compte)["frise"]


def par_id(f):
    return {c["id"]: c for c in f["campagnes"]}


constat = Constats()

# ── Identité par ID ──────────────────────────────────────────────────────────
# Les lignes du harnais 14 : deux homonymes « Été » (c1, c2) et une campagne
# renommée le 1er septembre (c3), sans ligne de config.
lignes = []
for d in jours(date(2026, 6, 1), JOUR_FETCH):
    lignes += [meta(d, "c1", "Été", "a1"), meta(d, "c2", "Été", "a2"),
               meta(d, "c3", "Ancien nom" if d < date(2026, 9, 1) else "Nouveau nom", "a3")]
f = frise(Compte(meta_rows=lignes))
noms = sorted((c["id"], c["nom"]) for c in f["campagnes"])
constat(noms == [("c1", "Été"), ("c2", "Été"), ("c3", "Nouveau nom")],
        f"deux homonymes → deux barres, une renommée → une barre sous son nom actuel : {noms}")
constat(f["annee"] == 2026, f"une seule année, celle de semaine.fin : {f['annee']}")
constat(all("statut" not in c for c in f["campagnes"]),
        "sans ligne de config, le statut n'a pas été récolté : clé absente (« statut inconnu »)")

f = frise(Compte(meta_rows=lignes, config_meta=[config("c3", "Nom de la config", "ACTIVE")]))
constat(par_id(f)["c3"]["nom"] == "Nom de la config",
        f"le nom actuel est celui de la config d'abord : {par_id(f)['c3']['nom']!r}")

# ── Entrée dans l'année ──────────────────────────────────────────────────────
f = par_id(frise(Compte(
    meta_rows=[meta(date(2026, 3, 2), "depense", "A dépensé en mars", "a")]
    + [meta(date(2025, 5, 2), "vieille", "A dépensé en 2025", "b")],
    config_meta=[
        config("vieille", "A dépensé en 2025", "ACTIVE", "2025-05-01"),              # sans fin
        config("debut", "Commence en 2026", "PAUSED", "2026-11-15"),
        config("fin", "Finit en 2026", "ACTIVE", "2025-11-01", "2026-01-31"),
        config("chevauche", "2025 → 2027", "ACTIVE", "2025-06-01", "2027-06-01"),
        config("passee", "Finie en 2025", "ACTIVE", "2025-01-01", "2025-12-31"),
        config("sans_date", "Sans aucune date", "ACTIVE"),
    ])))
constat(set(f) == {"depense", "debut", "fin", "chevauche"},
        f"entrent : dépense dans l'année, ou dates déclarées qui la touchent — {sorted(f)}")
constat("vieille" not in f,
        "une campagne « active » sans fin, sans dépense ni début dans l'année, n'entre pas")

# ── Statut, dans l'ordre de la spec ──────────────────────────────────────────
f = par_id(frise(Compte(
    config_google=[
        config("g_rem", "Supprimée, fin passée", "REMOVED", "2026-01-01", "2026-02-01"),
        config("g_fin", "Fin passée", "ENABLED", "2026-01-01", "2026-10-28"),
        config("g_vit", "Finit après la semaine", "ENABLED", "2026-01-01", "2026-10-29"),
        config("g_pau", "En pause", "PAUSED", "2026-02-01"),
        config("g_fut", "Début futur, statut nul", None, "2026-11-05"),
        config("g_nul", "Statut nul", None, "2026-02-01"),
    ],
    config_meta=[
        config("m_pb", "Problème", "WITH_ISSUES", "2026-04-01"),
        config("m_pbfin", "Problème mais finie", "WITH_ISSUES", "2026-04-01", "2026-05-01"),
        config("m_act_fut", "Active, début futur", "ACTIVE", "2026-12-01"),
    ])))
statuts = {k: c.get("statut") for k, c in f.items()}
constat(statuts == {"g_rem": "supprimee", "g_fin": "terminee", "g_vit": "en_cours",
                    "g_pau": "en_pause", "g_fut": "prevue", "g_nul": None,
                    "m_pb": "probleme", "m_pbfin": "terminee", "m_act_fut": "en_cours"},
        f"REMOVED avant la fin passée, fin passée avant WITH_ISSUES, statut avant début futur, "
        f"Google nul → dates sinon inconnu : {statuts}")
constat(f["g_fin"]["fin"] == "2026-10-28" and f["g_fin"]["fin_declaree"] is True,
        "finie le dernier jour de la semaine : terminée, fin déclarée pleine")

# ── Fin d'une supprimée (repli du ticket 17) ─────────────────────────────────
goo = [{"date_start": d.isoformat(), "campaign_id": "g1", "campaign_name": "Supprimée",
        "cost_micros": 5_000_000} for d in jours(date(2026, 3, 1), date(2026, 3, 10))]
f = par_id(frise(Compte(
    google_rows=goo,
    config_google=[config("g1", "Supprimée", "REMOVED", "2026-02-20", "2026-12-31"),
                   config("g2", "Jamais diffusée", "REMOVED", "2026-04-01")])))
constat((f["g1"]["fin"], f["g1"]["fin_declaree"]) == ("2026-03-10", False),
        f"supprimée : finit à son dernier jour de dépense — {f['g1']['fin']}")
constat((f["g2"]["debut"], f["g2"]["fin"]) == ("2026-04-01", "2026-04-01"),
        f"supprimée jamais diffusée : un repère au début — {f['g2']['debut']} → {f['g2']['fin']}")
constat(f["g1"]["visuels"] == [], "rien pour Google en visuels")
constat(sum(f["g1"]["depense_par_semaine"].values()) == 50.0,
        f"dépense Google = cost_micros / 1e6 : {f['g1']['depense_par_semaine']}")

# ── Début, fin et vivante sans fin ───────────────────────────────────────────
f = par_id(frise(Compte(
    meta_rows=[meta(d, "m1", "Sans config", "a") for d in jours(date(2026, 9, 3), JOUR_FETCH)],
    config_meta=[config("m2", "Vivante sans fin", "ACTIVE", "2026-05-01")])))
constat((f["m1"]["debut"], f["m1"]["fin"]) == ("2026-09-03", "2026-10-28"),
        f"sans config : du premier au dernier jour de dépense, le jour du fetch exclu — "
        f"{f['m1']['debut']} → {f['m1']['fin']}")
constat((f["m2"]["fin"], f["m2"]["fin_declaree"]) == (None, False),
        "vivante sans fin, jamais diffusée : `fin` nulle, la page tire les pointillés")

# ── Dépense par semaine, calée sur le Jour de travail ────────────────────────
f = par_id(frise(Compte(meta_rows=[
    meta(date(2026, 10, 22), "m", "x", "a", 7.0),   # 1er jour de la semaine mesurée
    meta(date(2026, 10, 28), "m", "x", "a", 3.0),   # dernier
    meta(date(2026, 10, 21), "m", "x", "a", 5.0),   # semaine précédente
    meta(date(2026, 10, 29), "m", "x", "a", 99.0),  # jour du fetch : hors rapport
    meta(date(2025, 12, 30), "m", "x", "a", 4.0),   # semaine du 25/12 au 31/12 : hors année
    meta(date(2026, 1, 1), "m", "x", "a", 2.0),     # semaine du 1er au 7 janvier
])))["m"]
constat(f["depense_par_semaine"] == {"2026-01-07": 2.0, "2026-10-21": 5.0, "2026-10-28": 10.0},
        f"clé = dernier jour de la semaine, semaines vides absentes, rien après semaine.fin : "
        f"{f['depense_par_semaine']}")
constat(f["debut"] == "2025-12-30",
        f"le début sans config est le premier jour de dépense, même avant l'année : {f['debut']}")

# ── Visuels : par dépense décroissante, sans doublon, 4 au plus ──────────────
annonces = [("a1", 1.0), ("a2", 50.0), ("a3", 30.0), ("a4", 20.0), ("a5", 10.0), ("a6", 5.0)]
f = par_id(frise(Compte(
    meta_rows=[meta(date(2026, 10, 1), "m", "x", ad, s) for ad, s in annonces],
    creas=[{"ad_id": "a1", "image_url": "i1"}, {"ad_id": "a2", "image_url": "i2"},
           {"ad_id": "a3", "image_url": "i2"},                       # même créa que a2
           {"ad_id": "a4", "image_url": None, "vignette_url": "v4"},
           {"ad_id": "a5", "image_url": "i5"}, {"ad_id": "a6", "image_url": "i6"}])))["m"]
constat(f["visuels"] == ["i2", "v4", "i5", "i6"],
        f"visuels par dépense décroissante, sans doublon, vignette en repli, 4 au plus : {f['visuels']}")

# ── Un compte sans campagne ──────────────────────────────────────────────────
p = build_payload(Compte(meta_rows=[meta(date(2026, 10, 25), "m", "x", "a", 0.0)]))
constat(p["frise"] == {"annee": 2026, "campagnes": []},
        f"une campagne sans dépense ni config n'a pas de barre ; la frise reste écrite : {p['frise']}")

constat.conclure()
