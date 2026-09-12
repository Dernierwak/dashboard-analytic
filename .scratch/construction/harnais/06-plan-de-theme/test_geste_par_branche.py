"""Le geste est une propriété de la BRANCHE, pas de la clé.

`roas` écrit quatre gestes selon le chiffre du jour. Découper sa clé en trois
effacerait l'historique des retours du client (`reco_feedback` est indexé par
clé) : la clé reste une, la branche déclare. Ce fichier fait tourner les vraies
règles sur des chiffres choisis pour tomber sur chaque branche, et lit le geste
qui en sort.
"""
import pandas as pd

import pulse  # noqa: F401
from t import ok, egal, bilan

from saas.traitement.build_report import (
    EFFORTS, LEVIERS_IA, METRICS_IA, NATURES_IA, ROLES_IA,
    _METRIC_REGLE, _attach_grammaire, _effort_de, _est_conseil, _spec_mesure,
)
from saas.recos_ia.reco_engine import _rule_gaspillage, _rule_roas


def campagnes(depense=1000.0, cpc=1.0):
    """Deux campagnes : assez de dépense pour que les planchers soient franchis."""
    return pd.DataFrame([
        {"campaign_name": "Été", "spend": depense * 0.8, "cpc": cpc, "clicks": 400,
         "impressions": 40000, "ctr": 1.0},
        {"campaign_name": "Hiver", "spend": depense * 0.2, "cpc": cpc, "clicks": 100,
         "impressions": 10000, "ctr": 1.0},
    ])


def ga4(revenu=None, conversions=None):
    return {"connected": True, "paid_revenue": revenu, "paid_conversions": conversions,
            "by_campaign": {}}


def cinq_colonnes(nom, r):
    """Une reco sortie d'une règle porte bien ses cinq colonnes après la pose."""
    _attach_grammaire(r)
    ok(f"{nom} · levier", r.get("levier") in LEVIERS_IA, r.get("levier"))
    ok(f"{nom} · geste", r.get("nature") in NATURES_IA, r.get("nature"))
    ok(f"{nom} · preuve", r.get("role") in ROLES_IA, r.get("role"))
    ok(f"{nom} · durée", _effort_de(r) in EFFORTS, _effort_de(r))
    spec = _spec_mesure(_METRIC_REGLE.get(r.get("key")))
    ok(f"{nom} · indicateur", spec is not None and spec[0] in METRICS_IA)
    ok(f"{nom} · servi", _est_conseil(r))


def test_roas_ecrit_quatre_gestes_sous_une_seule_cle():
    # Dépense 1 000 CHF ; le revenu place la branche.
    branches = [
        ("ROAS 4,0 — au-dessus de 3", ga4(revenu=4000.0), "augmenter"),
        ("ROAS 1,5 — rentable sans marge", ga4(revenu=1500.0), "couper"),
        ("ROAS 0,4 — sous 1", ga4(revenu=400.0), "couper"),
        # `revenu=0.0` et non `None` : GA4 muet sur la fenêtre est le terrain
        # de `_rule_ga4_muet`, pas celui-ci — ici la mesure est là, elle vaut zéro.
        ("revenu non suivi, conversions oui", ga4(revenu=0.0, conversions=12.0), "corriger"),
        ("zéro conversion attribuée", ga4(revenu=0.0, conversions=0.0), "corriger"),
    ]
    vus = set()
    for nom, contexte, attendu in branches:
        r = _rule_roas(campagnes(), contexte)
        ok(f"{nom} · la règle parle", r is not None)
        if r is None:
            continue
        egal(f"{nom} · une seule clé", r["key"], "roas")
        egal(f"{nom} · geste", r["nature"], attendu)
        egal(f"{nom} · preuve constatable", r["role"], "generale")
        cinq_colonnes(nom, r)
        vus.add(r["nature"])
    # Le fait qui justifie la mécanique : une clé, plusieurs gestes.
    ok("roas écrit plus d'un geste", len(vus) >= 3, sorted(vus))


def test_gaspillage_ecrit_le_sien_aussi():
    # CPC de la pire campagne ≥ 2× la médiane et ≥ 50 CHF dépensés. Il faut
    # TROIS campagnes : sur deux, la médiane est leur moyenne, et aucune valeur
    # ne peut alors valoir le double de la médiane.
    df = pd.DataFrame([
        {"campaign_name": "Chère", "spend": 300.0, "cpc": 5.0, "clicks": 60,
         "impressions": 20000, "ctr": 0.3},
        {"campaign_name": "Normale", "spend": 300.0, "cpc": 1.0, "clicks": 300,
         "impressions": 20000, "ctr": 1.5},
        {"campaign_name": "Sage", "spend": 200.0, "cpc": 1.0, "clicks": 200,
         "impressions": 15000, "ctr": 1.3},
    ])
    branches = [
        ("chère et zéro conversion", ga4(revenu=0.0, conversions=0.0), "couper"),
        ("chère mais elle convertit", ga4(revenu=900.0, conversions=9.0), "tester"),
        ("sans GA4", None, "tester"),
    ]
    for nom, contexte, attendu in branches:
        r = _rule_gaspillage(df, contexte)
        ok(f"gaspillage · {nom} · la règle parle", r is not None)
        if r is None:
            continue
        egal(f"gaspillage · {nom} · une seule clé", r["key"], "gaspillage")
        egal(f"gaspillage · {nom} · geste", r["nature"], attendu)
        cinq_colonnes(f"gaspillage · {nom}", r)


def test_aucune_branche_ne_reclame_un_sixieme_geste():
    # « vérifier » n'est pas un geste : la branche « zéro conversion », qui
    # commence par « vérifie le tracking », déclare bien `corriger`.
    r = _rule_roas(campagnes(), ga4(revenu=0.0, conversions=0.0))
    ok("la branche existe", r is not None)
    ok("le sixième geste n'existe pas", r is not None and r["nature"] in NATURES_IA,
       (r or {}).get("nature"))
    ok("« vérifier » n'est pas dans la liste", "vérifier" not in NATURES_IA)


if __name__ == "__main__":
    test_roas_ecrit_quatre_gestes_sous_une_seule_cle()
    test_gaspillage_ecrit_le_sien_aussi()
    test_aucune_branche_ne_reclame_un_sixieme_geste()
    raise SystemExit(0 if bilan("Le geste par branche") else 1)
