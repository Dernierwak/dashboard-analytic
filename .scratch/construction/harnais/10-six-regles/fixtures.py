"""Les constructeurs du harnais — rien de plus.

Les CHIFFRES restent dans chaque test, jamais ici : un test dont les nombres
sont cachés dans une fixture ne dit plus contre quel seuil il se place, et c'est
exactement ce qu'on veut pouvoir relire. Même règle que le harnais 07.
"""


def annonce(cle, nom, *, groupe="Groupe A", canal="google", campagne="Campagne A",
            impressions=0, clics=0, depense=0.0, conversions=None, jeune=False):
    """Une Annonce telle que `_annonces_theme` la rend."""
    return {"cle": cle, "nom": nom, "groupe": groupe, "canal": canal,
            "campagne": campagne, "impressions": impressions, "clics": clics,
            "depense": depense, "conversions": conversions, "jeune": jeune}


def usure(cle, nom, *, groupe="Groupe A", campagne="Campagne A", impressions=0,
          portee_cumul=0.0, clics=0, depense=0.0, cpc_avant=None, jeune=False):
    """Une Annonce Meta telle que `_usure_theme` la rend — avec la SOMME des
    portées quotidiennes, jamais la portée unique de la semaine."""
    return {"cle": cle, "nom": nom, "groupe": groupe, "canal": "meta",
            "campagne": campagne, "impressions": impressions,
            "portee_cumul": portee_cumul, "clics": clics, "depense": depense,
            "cpc_avant": cpc_avant, "jeune": jeune}


def campagne_budget(nom, *, canal="meta", pose_jour=0.0, depense_jour=0.0,
                    jours=7, releve_le="2026-09-08"):
    """Une ligne telle que `_budget_campagnes_theme` la rend."""
    return {"canal": canal, "nom": nom, "pose_jour": pose_jour,
            "depense_jour": depense_jour, "jours": jours, "releve_le": releve_le}


def creneau(jour, *, occurrences=4, depense=0.0, clics=0):
    """Un jour de la semaine tel que `_creneaux_theme` le rend. 0 = lundi."""
    return {"jour": jour, "occurrences": occurrences, "depense": depense,
            "clics": clics}
