"""Le constructeur d'Annonce du harnais — rien de plus.

Les CHIFFRES restent dans chaque test, jamais ici : un test dont les nombres
sont cachés dans une fixture ne dit plus contre quel seuil il se place, et
c'est exactement ce qu'on veut pouvoir relire.
"""


def annonce(cle, nom, *, groupe="Groupe A", canal="google", campagne="Campagne A",
            impressions=0, clics=0, depense=0.0, conversions=None, jeune=False):
    return {"cle": cle, "nom": nom, "groupe": groupe, "canal": canal,
            "campagne": campagne, "impressions": impressions, "clics": clics,
            "depense": depense, "conversions": conversions, "jeune": jeune}
