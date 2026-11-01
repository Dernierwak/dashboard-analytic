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
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from saas.data.supabase.processed_data.weekly_report.builder import build_payload  # noqa: E402
# Les lectures des blocs neufs (config, créas, couverture…) en valeur neutre.
from commun.faux_lecteur import FauxLecteur as LecteurNeutre  # noqa: E402

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


class FauxLecteur(LecteurNeutre):
    def __init__(self, aujourd_hui):
        self._auj = aujourd_hui

    def meta_ads(self): return meta_rows()
    def publications(self):
        return [{"date": (JOUR_FETCH - timedelta(days=3)).isoformat() + "T10:00:00+0000",
                 "type": "IMAGE", "likes": 10, "comments": 1, "saved": 0, "reach": 300}]
    def connexions_etat(self):
        return [{"source": "meta", "created_at": datetime(2025, 6, 1, tzinfo=timezone.utc).isoformat(),
                 "a_reconnecter_depuis": None}]
    def jour_de_travail(self): return "Thursday"
    def aujourd_hui(self): return self._auj


echecs = []


def constat(vrai, texte):
    print(("✓ " if vrai else "✗ ") + texte)
    if not vrai:
        echecs.append(texte)


jeudi = build_payload(FauxLecteur(JOUR_FETCH))
samedi = build_payload(FauxLecteur(JOUR_FETCH + timedelta(days=2)))

print("clés publiées :", sorted(jeudi))
# Inversé par le ticket 10 : l'ancien payload a quitté le rapport. Seule
# `canaux_muets` reste — l'escalade de la récolte la relit (pas la page).
SORTANTES = {"metrics_read", "metrics_prev", "metrics_series", "kpis", "changements",
             "kpi_focus", "verdict", "verdict_pct", "verdict_metric", "verdict_tone",
             "week_label", "since", "until"}
constat(not (SORTANTES & set(jeudi)),
        f"le payload ne porte plus rien de ce que la page validée retire : {sorted(SORTANTES & set(jeudi))}")

semaine_44 = {"debut": "2026-10-22", "fin": "2026-10-28", "numero": 44}
constat(jeudi["semaine"] == semaine_44,
        f"publié le Jour de travail : semaine {jeudi['semaine']} (jeudi → mercredi, juste)")
# Inversé par le ticket 01 : la semaine est calée sur le Jour de travail.
constat(samedi["semaine"] == semaine_44,
        f"refait le samedi sans nouvelle récolte : semaine {samedi['semaine']} "
        "— elle ne glisse plus, le jour du fetch reste dehors (ticket 01)")

# Inversés par le ticket 07 : la frise identifie par ID, sur une seule année.
noms = sorted(c["nom"] for c in jeudi["frise"]["campagnes"])
constat(noms == ["Nouveau nom", "Été", "Été"],
        f"la frise identifie par ID : {noms} — 2 homonymes en deux barres, 1 renommée en une (ticket 07)")
constat(all(c.get("id") for c in jeudi["frise"]["campagnes"])
        and all("statut" not in c for c in jeudi["frise"]["campagnes"]),
        "chaque campagne porte son ID ; sans config récoltée, pas de statut (« statut inconnu »)")
# Les posts ont quitté la frise avec l'ancienne forme ; le ticket 08 les remet,
# sans aucun chiffre.
constat([set(p) for p in jeudi["frise"].get("posts", [])]
        == [{"plateforme", "date", "format", "visuel", "lien"}],
        "la frise porte les posts de l'année, sans aucun chiffre (ticket 08)")
constat(jeudi["frise"]["annee"] == 2026 and "debut" not in jeudi["frise"],
        f"la frise couvre une seule année : {jeudi['frise']['annee']} (ticket 07)")

print()
if echecs:
    sys.exit(f"{len(echecs)} constat(s) ne tiennent plus — la table du ticket 14 est à revoir.")
print("tous les constats tiennent.")
