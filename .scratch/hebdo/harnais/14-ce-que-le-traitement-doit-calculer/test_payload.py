"""Harnais du ticket 14 — ce que `build_payload` produit AUJOURD'HUI, exécuté.

Hors ligne : un faux `Lecteur` gréé sur des lignes fixes, sans base ni secret.
    python3.12 .scratch/hebdo/harnais/14-ce-que-le-traitement-doit-calculer/test_payload.py
(depuis la racine du worktree). Chaque `constat` est un écart entre le
traitement actuel et la page validée (ticket 08) que la table du ticket 14
cite ; le harnais échoue si l'un d'eux ne tient plus.
"""
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
from saas.data.supabase.processed_data.weekly_report.builder import build_payload  # noqa: E402

# Le compte : Jour de travail = jeudi. Le fetch du jeudi 29 octobre écrit, comme
# en service (`Fenetre(since, today)`), une ligne Meta pour le jour même — partielle.
JOUR_FETCH = date(2026, 10, 29)
# Un historique qui commence en 2025 : la frise d'aujourd'hui remonte à
# janvier N-1, resserrée sur le premier événement.
DEBUT = date(2025, 6, 1)


def meta_rows():
    rows = []
    for i in range((JOUR_FETCH - DEBUT).days + 1):
        d = DEBUT + timedelta(days=i)
        # Deux campagnes HOMONYMES (deux ID, un nom) et une campagne RENOMMÉE
        # (un ID, deux noms) : le ticket 04 veut trois barres… et en aurait deux.
        nom_c3 = "Ancien nom" if d < date(2026, 9, 1) else "Nouveau nom"
        for cid, nom, ad in (("c1", "Été", "a1"), ("c2", "Été", "a2"), ("c3", nom_c3, "a3")):
            rows.append({"date_start": d.isoformat(), "campaign_id": cid, "campaign_name": nom,
                         "ad_id": ad, "spend": 10.0, "impressions": 1000, "clicks": 20})
    return rows


class FauxLecteur:
    def __init__(self, aujourd_hui):
        self._auj = aujourd_hui

    def meta_ads(self): return meta_rows()
    def publications(self):
        return [{"date": (JOUR_FETCH - timedelta(days=3)).isoformat() + "T10:00:00+0000",
                 "type": "IMAGE", "likes": 10, "comments": 1, "saved": 0, "reach": 300}]
    def abonnes(self):
        return [{"fetched_at": datetime(2026, 10, 29, 7, tzinfo=timezone.utc).isoformat(), "followers": 500}]
    def google_ads(self): return []
    def objectif(self): return None
    def jour_de_travail(self): return "Thursday"
    def canaux_muets(self): return {}
    def ga4_contexte(self, since, until): return None
    def ga4_insights(self): return []
    def dates_declarees(self, table): return []
    def rapports_publies(self, avant, limite=8): return []
    def aujourd_hui(self): return self._auj


echecs = []


def constat(vrai, texte):
    print(("✓ " if vrai else "✗ ") + texte)
    if not vrai:
        echecs.append(texte)


jeudi = build_payload(FauxLecteur(JOUR_FETCH))
samedi = build_payload(FauxLecteur(JOUR_FETCH + timedelta(days=2)))

print("clés publiées :", sorted(jeudi))
constat(set(jeudi) >= {"metrics_read", "metrics_prev", "metrics_series", "kpis", "changements",
                       "canaux_muets", "kpi_focus", "verdict", "frise"},
        "le payload porte encore tout ce que la page validée retire ou remplace")

constat((jeudi["since"], jeudi["until"]) == ("2026-10-22", "2026-10-28"),
        f"publié le Jour de travail : semaine {jeudi['since']} → {jeudi['until']} (jeudi → mercredi, juste)")
# Inversé par le ticket 01 : la semaine est calée sur le Jour de travail.
constat((samedi["since"], samedi["until"]) == ("2026-10-22", "2026-10-28"),
        f"refait le samedi sans nouvelle récolte : semaine {samedi['since']} → {samedi['until']} "
        "— elle ne glisse plus, le jour du fetch reste dehors (ticket 01)")

noms = sorted(c["nom"] for c in jeudi["frise"]["campagnes"])
constat(noms == ["Ancien nom", "Nouveau nom", "Été"],
        f"la frise identifie par NOM : {noms} — 2 homonymes fusionnés, 1 renommée coupée en deux")
constat(all("id" not in c and "statut" not in c for c in jeudi["frise"]["campagnes"]),
        "une campagne de la frise n'a ni ID ni statut")
constat(all(set(p) == {"plateforme", "date", "type"} for p in jeudi["frise"]["posts"]),
        "un post de la frise n'a que plateforme, date, type — ni visuel ni lien")
constat(jeudi["frise"]["debut"] < "2026-01-01",
        f"la frise couvre deux ans (depuis {jeudi['frise']['debut']}), la page une année")

print()
if echecs:
    sys.exit(f"{len(echecs)} constat(s) ne tiennent plus — la table du ticket 14 est à revoir.")
print("tous les constats tiennent.")
