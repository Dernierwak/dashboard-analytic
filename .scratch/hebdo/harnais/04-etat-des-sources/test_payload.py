"""Harnais du ticket 04 — l'état des sources et le bandeau des totaux.

Hors ligne, depuis la racine du dépôt :
    python3.12 .scratch/hebdo/harnais/04-etat-des-sources/test_payload.py

Un compte servi le lundi, rapport du lundi 2 novembre 2026 : la semaine va du
26 octobre au 1er novembre. Meta écrit 10 CHF et 1 000 impressions par jour,
Google 5 CHF et 500 impressions — soit 70 CHF / 7 000 et 35 CHF / 3 500 sur
la semaine. Chaque cas change UNE chose (connexion, couverture, lignes) et
regarde `sources` et `totaux` dans le payload rendu par `build_payload`.
"""
import json
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from commun.faux_lecteur import FauxLecteur, Constats  # noqa: E402
from saas.data.supabase.processed_data.weekly_report.builder import build_payload  # noqa: E402

AUJOURD_HUI = date(2026, 11, 2)          # un lundi, Jour de travail
DEBUT, FIN = date(2026, 10, 26), date(2026, 11, 1)
PREMIER_JOUR = date(2026, 9, 1)

META = {"source": "meta", "created_at": "2026-05-03T12:00:00+00:00",
        "a_reconnecter_depuis": None}
GOOGLE = {"source": "google", "created_at": "2026-06-10T08:30:00+00:00",
          "a_reconnecter_depuis": None}


def couvert(source, flux, depuis=date(2026, 5, 1), jusqu_au=FIN):
    return {"source": source, "flux": flux, "sans_trou_depuis": depuis.isoformat(),
            "sans_trou_jusqu_au": jusqu_au.isoformat()}


TOUT_COUVERT = [couvert(s, f) for s in ("meta", "google") for f in ("insights", "journal")]


def jours(jusqu_au=AUJOURD_HUI, sauf=()):
    d = PREMIER_JOUR
    while d <= jusqu_au:
        if d not in sauf:
            yield d
        d += timedelta(days=1)


class Compte(FauxLecteur):
    def __init__(self, connexions=(META, GOOGLE), couverture=TOUT_COUVERT,
                 meta_sauf=()):
        super().__init__(AUJOURD_HUI, "Monday")
        self._connexions = list(connexions)
        self._couverture = list(couverture)
        self._meta_sauf = set(meta_sauf)

    def meta_ads(self):
        return [{"date_start": d.isoformat(), "campaign_id": "c1", "campaign_name": "Été",
                 "ad_id": "a1", "spend": "10.0", "impressions": "1000", "clicks": "20"}
                for d in jours(sauf=self._meta_sauf)]

    def google_ads(self):
        return [{"date_start": d.isoformat(), "campaign_id": "g1", "campaign_name": "Search",
                 "cost_micros": 5_000_000, "impressions": 500, "clicks": 10}
                for d in jours()]

    def connexions_etat(self):
        return [dict(c) for c in self._connexions]

    def couverture(self):
        return [dict(c) for c in self._couverture]


def sans(liste, source, flux):
    return [c for c in liste if not (c["source"] == source and c["flux"] == flux)]


def avec(liste, ligne):
    return sans(liste, ligne["source"], ligne["flux"]) + [ligne]


constat = Constats()

# ── Le cas nominal ───────────────────────────────────────────────────────────
p = build_payload(Compte())
constat(p.get("sources") == {
    "meta": {"etat": "recolte", "connecte_le": "2026-05-03", "journal": "couvert"},
    "google": {"etat": "recolte", "connecte_le": "2026-06-10", "journal": "couvert"},
}, f"deux sources récoltées et couvertes : {p.get('sources')}")
constat(p.get("totaux") == {"depense": {"meta": 70.0, "google": 35.0},
                            "impressions": {"meta": 7000, "google": 3500}},
        f"totaux de la semaine, jour du fetch exclu (§7) : {p.get('totaux')}")
constat("portee" not in (p.get("totaux") or {}), "pas de totaux.portee (carte 16)")

# ── Jeton mort ───────────────────────────────────────────────────────────────
mort = dict(META, a_reconnecter_depuis="2026-10-30T07:02:00+00:00")
p = build_payload(Compte(connexions=(mort, GOOGLE)))
constat(p["sources"]["meta"]["etat"] == "jeton_mort",
        f"jeton marqué à reconnecter → jeton_mort : {p['sources']['meta']}")
constat(p["totaux"]["depense"]["meta"] is None and p["totaux"]["impressions"]["meta"] is None,
        "jeton mort → totaux Meta null, pas 0 — même si des lignes existent")
constat(p["totaux"]["depense"]["google"] == 35.0, "Google, qui a répondu, garde son total")

# ── Panne : la couverture s'arrête la veille de la fin ───────────────────────
p = build_payload(Compte(couverture=avec(TOUT_COUVERT,
                                         couvert("meta", "insights", jusqu_au=FIN - timedelta(days=1)))))
constat(p["sources"]["meta"]["etat"] == "panne",
        f"couverture des insights au {FIN - timedelta(days=1)} → panne : {p['sources']['meta']}")
constat(p["totaux"]["depense"]["meta"] is None, "panne → dépense Meta null")

# ── Semaine récoltée en partie : la plage commence au milieu ─────────────────
p = build_payload(Compte(couverture=avec(TOUT_COUVERT,
                                         couvert("meta", "insights", depuis=DEBUT + timedelta(days=3)))))
constat(p["sources"]["meta"]["etat"] == "panne",
        "plage sans trou qui commence le 29/10 (après un trou) → panne")
constat(p["totaux"]["impressions"]["meta"] is None, "semaine en partie → impressions Meta null")

# ── Aucune couverture écrite (ticket 03 pas encore passé) ────────────────────
p = build_payload(Compte(couverture=sans(TOUT_COUVERT, "google", "insights")))
constat(p["sources"]["google"]["etat"] == "panne", "pas de ligne de couverture → panne")

# ── `0001-01-01` : pas de borne basse ────────────────────────────────────────
p = build_payload(Compte(couverture=avec(TOUT_COUVERT,
                                         couvert("meta", "insights", depuis=date(1, 1, 1)))))
constat(p["sources"]["meta"]["etat"] == "recolte", "sans_trou_depuis = 0001-01-01 → couvert")

# ── Source pas branchée ──────────────────────────────────────────────────────
p = build_payload(Compte(connexions=(META,)))
constat(set(p["sources"]) == {"meta"}, f"Google pas branché → absent de sources : {set(p['sources'])}")
constat("google" not in p["totaux"]["depense"] and "google" not in p["totaux"]["impressions"],
        f"…et absent des totaux, ni 0 ni null : {p['totaux']}")

# ── Le vrai 0 : Meta a répondu, n'a rien diffusé de la semaine ───────────────
semaine = {DEBUT + timedelta(days=i) for i in range(7)}
p = build_payload(Compte(meta_sauf=semaine))
constat(p["sources"]["meta"]["etat"] == "recolte", "aucune ligne Meta mais couvert → recolte")
constat(p["totaux"]["depense"]["meta"] == 0 and p["totaux"]["impressions"]["meta"] == 0,
        f"…et un vrai 0, pas null : {p['totaux']}")

# ── Le journal ───────────────────────────────────────────────────────────────
p = build_payload(Compte(couverture=avec(TOUT_COUVERT,
                                         couvert("meta", "journal", jusqu_au=FIN - timedelta(days=2)))))
constat(p["sources"]["meta"]["journal"] == "non_couvert"
        and p["sources"]["meta"]["etat"] == "recolte",
        "journal en retard → non_couvert, sans toucher l'état des insights")
p = build_payload(Compte(couverture=sans(TOUT_COUVERT, "google", "journal")))
constat(p["sources"]["google"]["journal"] == "non_couvert", "pas de couverture du journal → non_couvert")

# ── Lectures qui échouent ────────────────────────────────────────────────────
class CouvertureIllisible(Compte):
    def couverture(self):
        raise RuntimeError('relation "couverture_recolte" does not exist')


class ConnexionsIllisibles(Compte):
    def connexions_etat(self):
        raise RuntimeError("connected_accounts injoignable")


p = build_payload(CouvertureIllisible())
constat({s["etat"] for s in p["sources"].values()} == {"panne"}
        and set(p["totaux"]["depense"].values()) == {None},
        "couverture illisible (migration pas jouée) → tout en panne, rapport publié quand même")
p = build_payload(ConnexionsIllisibles())
# Inversé par le ticket 10 : la publication tient à une source branchée, et
# des connexions illisibles n'en prouvent aucune.
constat(p is None, "connexions illisibles → aucun rapport (le précédent reste affiché)")

# ── Jamais un jeton dans le payload (§7) ─────────────────────────────────────
class AvecJetons(Compte):
    def connexions_etat(self):
        return [dict(c, meta_token="SECRET", google_refresh_token="SECRET",
                     a_reconnecter_raison="refusé") for c in super().connexions_etat()]


texte = json.dumps(build_payload(AvecJetons()), default=str)
constat("SECRET" not in texte and "refusé" not in texte,
        "même si une ligne porte un jeton ou une raison, rien n'en sort dans le payload")

constat.conclure()
