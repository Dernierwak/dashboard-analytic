"""Un compte réaliste, et un compte sans Google Analytics.

Toutes les dates tombent dans l'ANNÉE EN COURS et AVANT aujourd'hui : c'est ce
qui rend la comparaison avec `build_matrix` honnête. La fenêtre GA4 de
`build_matrix` part du 1er janvier, la vue prend tout l'historique — un jeu à
cheval sur deux années comparerait deux périmètres et pas deux arithmétiques.
Ce décalage-là est vérifié à part (`test_ecarts.py`).
"""
from datetime import date, timedelta

A = "11111111-1111-4111-8111-111111111111"   # compte avec GA4
B = "22222222-2222-4222-8222-222222222222"   # compte sans GA4

AUJ = date.today()
J = [AUJ - timedelta(days=n) for n in range(1, 40)]      # J[0] = hier
ANNEE = AUJ.year


def _dans_l_annee(d):
    return d.year == ANNEE


JOURS = [d for d in J if _dans_l_annee(d)]
assert len(JOURS) >= 10, "lancer ce harnais en janvier demande un jeu plus court"

META_CFG = [
    # user, campaign_name, label
    (A, "Ete_Velo",       "E-bike"),
    (A, "ETE_VELO ",      "E-bike"),      # homonyme à la casse près : Meta en fait DEUX
    (A, "Newsletter_FR",  "Newsletter"),
    (A, "Sans_theme",     None),          # pas d'étiquette → hors de tout thème
    (A, "Etiquette_vide", ""),            # étiquette vide → pareil
    (A, "Petit_budget",   "Curiosite"),   # restera sous les 100 CHF
    (B, "Promo_B",        "Promo"),
]

GOOGLE_CFG = [
    # user, campaign_id, campaign_name, label
    (A, "g-1", "Ete_Velo",   "E-bike"),   # même nom UTM que la campagne Meta
    (A, "g-2", "Search_Marque", "Marque"),
    (A, "g-3", "",            "Marque"),  # config sans nom : ne rattache rien
    (B, "g-9", "Promo_B",     "Promo"),
]

META_ADS = [
    # user, date, campaign_name, spend, clicks, impressions
    (A, JOURS[0], "Ete_Velo",       60.00,  120, 10000),
    (A, JOURS[1], "Ete_Velo",       45.50,   80,  7000),
    (A, JOURS[2], "ETE_VELO ",      12.25,   10,  1200),
    (A, JOURS[3], "Newsletter_FR", 150.00,  300, 40000),
    (A, JOURS[4], "Sans_theme",    900.00, 1000, 99000),
    (A, JOURS[5], "Etiquette_vide",800.00,  900, 88000),
    (A, JOURS[6], "Petit_budget",   40.00,   20,  3000),
    (B, JOURS[0], "Promo_B",       220.00,  400, 50000),
]

GOOGLE_ADS = [
    # user, date, campaign_id, cost_micros, clicks, impressions
    (A, JOURS[0], "g-1",  30_000_000,  50,  4000),
    (A, JOURS[2], "g-2", 120_500_000, 210, 33000),
    (A, JOURS[3], "g-3",  10_000_000,   5,   900),
    (B, JOURS[1], "g-9",  80_000_000, 100, 12000),
]

GA4 = [
    # user, date, source, medium, campaign, revenue
    (A, JOURS[0], "google",   "cpc",         "Ete_Velo",      400.00),
    (A, JOURS[1], "facebook", "paid_social", "ete_velo",      120.00),  # casse ≠, même campagne
    (A, JOURS[2], "google",   "cpc",         "Search_Marque", 900.00),
    (A, JOURS[3], "google",   "cpc",         "Newsletter_FR",   0.00),
    (A, JOURS[4], "google",   "organic",     "Ete_Velo",     5000.00),  # pas payant → ignoré
    (A, JOURS[5], "google",   "cpc",         "",             3000.00),  # sans campagne → ignoré
]

GA4_EVENTS = [
    # user, date, campaign, event_name, count, value
    (A, JOURS[0], "Newsletter_FR", "generate_lead", 40,   0.00),   # mesuré, sans valeur
    (A, JOURS[1], "Search_Marque", "purchase",       6, 750.00),   # mesuré, avec valeur
    (A, JOURS[2], "Search_Marque", "view_item",    100,   0.00),
]

THEME_EVENTS = [
    # user, label, event_name, rang
    (A, "Newsletter", "generate_lead", "principal"),   # ne remplace rien (0 CHF)
    (A, "Marque",     "purchase",      "principal"),   # remplace le revenu générique
    (A, "E-bike",     "view_item",     "secondaire"),  # un secondaire ne remplace jamais
]

POSTS = [
    # user, post_id, date, type, labels, reach, eng
    (A, "p1", JOURS[0], "IMAGE", ["E-bike"],              1201, 3.5),
    (A, "p2", JOURS[1], "REEL",  ["E-bike", "Lifestyle"], 4400, 6.25),
    (A, "p3", JOURS[2], "REEL",  ["Lifestyle"],           None, 2.0),   # portée absente = 0
    (A, "p4", JOURS[3], "IMAGE", [],                       900, 1.0),   # aucun thème
    (B, "p9", JOURS[0], "IMAGE", ["Promo"],               2000, 4.0),
]
