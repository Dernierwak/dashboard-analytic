"""Harnais du ticket 01 — la semaine calée sur le Jour de travail.

Hors ligne, depuis la racine du dépôt :
    python3.12 .scratch/hebdo/harnais/01-la-semaine/test_payload.py

Reprend le cas du harnais 14 (compte servi le jeudi, fetch du jeudi 29 octobre
qui écrit une ligne Meta partielle pour le jour même) : son constat « refait le
samedi, la semaine glisse » doit s'inverser, celui du jeudi rester vrai.
"""
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from commun.faux_lecteur import FauxLecteur, Constats  # noqa: E402
from saas.data.supabase.processed_data.weekly_report.builder import build_payload  # noqa: E402
from saas.data.supabase.processed_data.weekly_report.blocs.semaine import (  # noqa: E402
    Semaine, semaines_precedentes,
)

JOUR_FETCH = date(2026, 10, 29)          # un jeudi
DEBUT = date(2026, 9, 1)


class AvecMeta(FauxLecteur):
    """Une ligne Meta par jour jusqu'à `derniere` (le jour du fetch compris)."""

    def __init__(self, aujourd_hui, jour_de_travail="Thursday", derniere=JOUR_FETCH):
        super().__init__(aujourd_hui, jour_de_travail)
        self._derniere = derniere

    def meta_ads(self):
        return [{"date_start": (DEBUT + timedelta(days=i)).isoformat(), "campaign_id": "c1",
                 "campaign_name": "Été", "ad_id": "a1", "spend": 10.0,
                 "impressions": 1000, "clicks": 20}
                for i in range((self._derniere - DEBUT).days + 1)]

    # Meta branché : depuis le ticket 10, c'est une source branchée qui fait
    # publier le rapport.
    def connexions_etat(self):
        return [{"source": "meta", "created_at": "2026-09-01T00:00:00+00:00",
                 "a_reconnecter_depuis": None}]


class JourIllisible(AvecMeta):
    def jour_de_travail(self):
        raise RuntimeError("profiles injoignable")


constat = Constats()
SEMAINE_44 = {"debut": "2026-10-22", "fin": "2026-10-28", "numero": 44}

jeudi = build_payload(AvecMeta(JOUR_FETCH))
samedi = build_payload(AvecMeta(JOUR_FETCH + timedelta(days=2)))
mercredi = build_payload(AvecMeta(date(2026, 11, 4)))

constat(jeudi.get("semaine") == SEMAINE_44,
        f"publié le Jour de travail (jeudi 29/10) : semaine {jeudi.get('semaine')}")
constat(samedi.get("semaine") == SEMAINE_44,
        f"refait le samedi 31/10 : la semaine ne glisse plus — {samedi.get('semaine')}")
constat(mercredi.get("semaine") == SEMAINE_44,
        f"refait le mercredi 4/11, veille du Jour de travail suivant : {mercredi.get('semaine')}")

constat(samedi["week_start"] == jeudi["week_start"] == "2026-10-26",
        f"la clé d'écriture suit la fin : week_start {samedi['week_start']} (lundi ISO du 28/10)")

en_retard = build_payload(AvecMeta(JOUR_FETCH, derniere=date(2026, 10, 25)))
constat(en_retard.get("semaine") == SEMAINE_44,
        "une récolte en retard (dernière donnée le 25/10) ne recule pas la semaine : "
        f"{en_retard.get('semaine')}")

lundi_meme = build_payload(AvecMeta(date(2026, 10, 26), jour_de_travail="Monday"))
constat(lundi_meme.get("semaine") == {"debut": "2026-10-19", "fin": "2026-10-25", "numero": 43},
        f"servi le lundi, le jour même compte comme dernier Jour de travail : {lundi_meme.get('semaine')}")

for jt in (None, "Funday"):
    p = build_payload(AvecMeta(JOUR_FETCH, jour_de_travail=jt))
    constat(p.get("semaine", {}).get("fin") == "2026-10-25",
            f"Jour de travail {jt!r} → repli lundi : fin {p.get('semaine', {}).get('fin')}")
p = build_payload(JourIllisible(JOUR_FETCH))
constat(p.get("semaine", {}).get("fin") == "2026-10-25",
        f"profil illisible → repli lundi, le rapport sort quand même : fin {p.get('semaine', {}).get('fin')}")

constat(build_payload(FauxLecteur(JOUR_FETCH)) is None,
        "compte sans aucune donnée : pas de rapport (la page montre la carte « compte neuf »)")

# Inversé par le ticket 10 : tous les blocs sont construits, et l'ancien
# payload a quitté le rapport — sa fenêtre `since`/`until` comprise.
constat(not ({"since", "until", "week_label", "verdict", "kpis"} & set(jeudi)),
        f"aucune clé de l'ancien payload : {sorted(jeudi)}")

prec = semaines_precedentes(Semaine(date(2026, 10, 22), date(2026, 10, 28)), 2)
constat([(s.debut.isoformat(), s.fin.isoformat()) for s in prec]
        == [("2026-10-15", "2026-10-21"), ("2026-10-08", "2026-10-14")],
        "les semaines précédentes reculent de 7 jours en 7 jours, la plus récente d'abord")

constat.conclure()
