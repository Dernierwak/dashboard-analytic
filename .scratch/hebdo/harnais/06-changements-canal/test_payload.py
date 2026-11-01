"""Harnais du ticket 06 — les changements sur la carte du canal.

Hors ligne, depuis la racine du dépôt :
    python3.12 .scratch/hebdo/harnais/06-changements-canal/test_payload.py

Un compte Meta servi le lundi, rapport du lundi 2 novembre 2026 : la semaine va
du 26 octobre au 1er novembre. Zurich est passé à l'heure d'hiver le 25 octobre
(UTC+1) : 23:30 UTC y tombe le lendemain à 00:30. Chaque cas change UNE chose.
"""
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from commun.faux_lecteur import FauxLecteur, Constats  # noqa: E402
from saas.data.supabase.processed_data.weekly_report.builder import build_payload  # noqa: E402
from saas.data.supabase.processed_data.weekly_report.blocs.changements import changements_par_canal  # noqa: E402
from saas.data.supabase.processed_data.weekly_report.blocs.semaine import Semaine  # noqa: E402

AUJOURD_HUI = date(2026, 11, 2)
DEBUT, FIN = date(2026, 10, 26), date(2026, 11, 1)

META = {"source": "meta", "created_at": "2026-05-03T12:00:00+00:00", "a_reconnecter_depuis": None}


def couvert(flux):
    return {"source": "meta", "flux": flux, "sans_trou_depuis": "2026-01-01",
            "sans_trou_jusqu_au": FIN.isoformat()}


JOURNAL_COUVERT = [couvert("insights"), couvert("journal")]
JOURNAL_NON_COUVERT = [couvert("insights")]


def chg(occurred_at, categorie="budget", canal="meta", fuseau="Europe/Zurich", campagne=("c1", "Soldes"),
        niveau="campagne", objet=None, resume="Budget passé de 30 à 75 CHF"):
    campaign_id, campaign_name = campagne if campagne else (None, None)
    return {"channel": canal, "occurred_at": occurred_at, "fuseau": fuseau, "categorie": categorie,
            "campaign_id": campaign_id, "campaign_name": campaign_name, "niveau": niveau,
            "object_id": None, "object_name": objet, "resume": resume, "extra_data": None}


SEMAINE_CHARGEE = [
    # Dimanche 25 à 22:00 à Zurich : la semaine d'avant.
    chg("2026-10-25T21:00:00+00:00", resume="avant"),
    # Lundi 26 à 00:30 à Zurich, mais encore le 25 en UTC : dans la semaine.
    chg("2026-10-25T23:30:00+00:00", resume="lundi à 00:30"),
    chg("2026-10-28T10:00:00+00:00", categorie="statut", resume="Campagne mise en pause"),
    chg("2026-10-29T10:00:00+00:00", categorie="creation", resume="Annonce créée"),
    chg("2026-10-30T10:00:00+00:00", categorie="enchere", resume="Enchère plafonnée"),
    # Dimanche 1er à 23:30 UTC = lundi 2 à 00:30 à Zurich : le jour du fetch.
    chg("2026-11-01T23:30:00+00:00", resume="lundi 2 à Zurich"),
    # Une ligne d'avant le fuseau : découpée en UTC, donc le 1er.
    chg("2026-11-01T23:30:00+00:00", fuseau=None, resume="sans fuseau"),
]


class Compte(FauxLecteur):
    def __init__(self, journal=(), couverture=JOURNAL_COUVERT):
        super().__init__(AUJOURD_HUI, "Monday")
        self._journal, self._couverture = list(journal), list(couverture)
        self.fenetres = []

    def meta_ads(self):
        # Une semaine diffusée : sans dépense, `build_payload` ne publie rien.
        return [{"date_start": f"2026-10-{j}", "campaign_id": "c1", "ad_id": "a1",
                 "spend": "10", "impressions": "1000", "clicks": "10"} for j in range(26, 32)]

    def connexions_etat(self):
        return [dict(META)]

    def couverture(self):
        return [dict(c) for c in self._couverture]

    def changements(self, debut, fin):
        self.fenetres.append((debut, fin))
        return [dict(c) for c in self._journal]


def changements_meta(payload):
    return ((payload.get("canaux") or {}).get("meta") or {}).get("changements")


constat = Constats()

# ── Une semaine avec des changements ────────────────────────────────────────
compte = Compte(SEMAINE_CHARGEE)
p = build_payload(compte)
liste = changements_meta(p)
constat(compte.fenetres == [(DEBUT, FIN)], f"le Lecteur est interrogé sur la semaine : {compte.fenetres}")
constat(isinstance(liste, list), f"canaux.meta.changements existe : {liste!r}")
liste = liste or []
resumes = [c["resume"] for c in liste]
constat(resumes == ["lundi à 00:30", "Campagne mise en pause", "Annonce créée", "Enchère plafonnée", "sans fuseau"],
        f"le jour se juge au fuseau de la ligne, UTC sans fuseau, rangé par jour : {resumes}")
constat([c["jour"] for c in liste] == ["2026-10-26", "2026-10-28", "2026-10-29", "2026-10-30", "2026-11-01"],
        f"jours au fuseau du compte : {[c['jour'] for c in liste]}")
constat([c["categorie"] for c in liste] == ["budget", "autre", "autre", "enchere", "budget"],
        f"`statut` et `creation` se rangent sous `autre` : {[c['categorie'] for c in liste]}")
constat(liste[:1] == [{"jour": "2026-10-26", "categorie": "budget", "campaign_id": "c1", "campagne": "Soldes",
                       "objet": None, "resume": "lundi à 00:30"}],
        f"forme d'un changement : {liste[:1]}")
constat(p["sources"]["meta"]["journal"] == "couvert", "le journal est couvert")

# ── Hors campagne : « Compte publicitaire » au niveau du compte, sinon l'objet ─
# La récolte ne produit pas encore de niveau « compte » (activities.py) : la
# ligne est fabriquée ici pour que la règle tienne le jour où elle arrivera.
liste = changements_meta(build_payload(Compte([
    chg("2026-10-27T10:00:00+00:00", categorie="autre", campagne=None, niveau="compte",
        resume="Limite de dépense du compte modifiée"),
    chg("2026-10-27T11:00:00+00:00", categorie="audience", campagne=None, niveau="groupe",
        objet="Groupe Romandie", resume="Ciblage modifié"),
    chg("2026-10-27T12:00:00+00:00", campagne=None, niveau=None, resume="sans rien"),
]))) or []
constat([c["objet"] for c in liste] == ["Compte publicitaire", "Groupe Romandie", None],
        f"hors campagne : compte, sinon le nom de l'objet, sinon rien : {[c['objet'] for c in liste]}")
constat(all(c["campagne"] is None and c["campaign_id"] is None for c in liste), "hors campagne : ni id ni nom")
constat(not any("Hors campagne" in str(v) for c in liste for v in c.values()), "jamais « Hors campagne »")

# ── Journal non couvert : la liste vide ne se lit pas comme un vrai 0 ───────
p = build_payload(Compte(couverture=JOURNAL_NON_COUVERT))
constat(p["sources"]["meta"]["journal"] == "non_couvert" and changements_meta(p) == [],
        f"journal non couvert : la page le lit dans sources.meta.journal : "
        f"{p['sources']['meta']['journal']}, {changements_meta(p)!r}")

# ── Vrai 0 : couvert, et Meta n'a rien écrit ────────────────────────────────
p = build_payload(Compte())
constat(p["sources"]["meta"]["journal"] == "couvert" and changements_meta(p) == [],
        f"vrai 0 : liste vide, journal couvert : {changements_meta(p)!r}")


# ── Lecture qui échoue : aucune clé, jamais une liste vide ──────────────────
class Illisible(Compte):
    def changements(self, debut, fin):
        raise RuntimeError("base injoignable")


p = build_payload(Illisible(SEMAINE_CHARGEE))
meta = (p.get("canaux") or {}).get("meta") or {}
constat("volumes" in meta and "changements" not in meta,
        f"journal illisible → pas de clé `changements` (ce n'est pas un 0) : {sorted(meta)}")

# ── Google : les 10 premiers caractères, l'heure du compte stockée telle quelle ─
# Google n'a pas encore de carte (spec, hors périmètre) : le bloc se lit seul.
blocs = changements_par_canal(Compte([
    chg("2026-11-01T23:59:00+00:00", canal="google", fuseau=None, niveau=None, resume="tard le dimanche"),
    chg("2026-10-25T23:59:00+00:00", canal="google", fuseau=None, niveau=None, resume="semaine d'avant"),
]), Semaine(DEBUT, FIN)) or {}
constat([c["resume"] for c in blocs.get("google", [])] == ["tard le dimanche"]
        and blocs["google"][0]["jour"] == "2026-11-01",
        f"Google : jour = la date écrite, sans conversion : {blocs.get('google')}")
constat(blocs.get("meta") == [], f"chaque canal a sa liste, même vide : {blocs.get('meta')!r}")

constat.conclure()
