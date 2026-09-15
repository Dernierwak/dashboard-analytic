"""Trois définitions du repère, mises côte à côte sur un jeu de cas.

Ce script ne teste rien — il MESURE, pour trancher la question que le ticket 30
laisse ouverte et refuse de décider sur avis :

  A = médiane de TOUTES les comparables, candidate incluse  (l'état actuel)
  B = prix du clic des AUTRES, pondéré par leurs clics       (locomotive, adset_inegal)
  C = médiane des AUTRES, candidate exclue

Les chiffres restent dans le fichier, jamais dans une fixture : un cas dont les
nombres sont cachés ne dit plus contre quel seuil il se place.
"""
from statistics import median

RATIO = 2.0  # SEUILS["cpc_ratio"], recopié ici pour que le script reste hors ligne


def cpc(annonce: dict) -> float:
    return annonce["depense"] / annonce["clics"] if annonce["clics"] else 0.0


def cpc_pondere(lignes: list[dict]) -> float:
    clics = sum(a["clics"] for a in lignes)
    return sum(a["depense"] for a in lignes) / clics if clics else 0.0


def ad(nom: str, prix: float, clics: int = 100) -> dict:
    return {"nom": nom, "clics": clics, "depense": prix * clics}


CAS = [
    ("2 annonces, écart énorme (40 vs 4)", [ad("chere", 40), ad("saine", 4)]),
    ("2 annonces, écart honnête (5 vs 4)", [ad("chere", 5), ad("saine", 4)]),
    ("2 annonces, pile au seuil (8 vs 4)", [ad("chere", 8), ad("saine", 4)]),
    ("3 annonces, une brûle (40,4,4)",
     [ad("chere", 40), ad("a", 4), ad("b", 4)]),
    ("4 annonces, DEUX brûlent (40,40,4,4)",
     [ad("chere", 40), ad("autre", 40), ad("a", 4), ad("b", 4)]),
    ("5 annonces, une brûle (40,4,4,4,4)",
     [ad("chere", 40), ad("a", 4), ad("b", 4), ad("c", 4), ad("d", 4)]),
    ("3 annonces, petit voisin fou (20 / 50@2clics / 4)",
     [ad("chere", 20), ad("petit", 50, clics=2), ad("gros", 4)]),
    ("3 annonces, écart honnête (7,5,4)",
     [ad("chere", 7), ad("a", 5), ad("b", 4)]),
    ("6 annonces, TROIS brûlent (40,40,40,4,4,4)",
     [ad("c1", 40), ad("c2", 40), ad("c3", 40), ad("a", 4), ad("b", 4), ad("c", 4)]),
    # Les deux cas qui séparent VRAIMENT B de C : la livraison concentre le
    # trafic sur l'annonce qui marche, donc dans un Groupe réel les volumes de
    # clics sont très inégaux — c'est la forme courante, pas le cas de bord.
    ("volume inégal : 25 face à 1@10000 et deux 30@5",
     [ad("chere", 25, clics=400), ad("gros", 1, clics=10000),
      ad("mini1", 30, clics=5), ad("mini2", 30, clics=5)]),
    ("valeur extrême : 20 face à 3@9000, 3@8000, 40@3",
     [ad("chere", 20, clics=500), ad("gros1", 3, clics=9000),
      ad("gros2", 3, clics=8000), ad("mini", 40, clics=3)]),
]


def verdict(prix_pire: float, repere: float) -> str:
    if repere <= 0:
        return "tait"
    return "DIT " if prix_pire >= repere * RATIO else "tait"


print(f"{'cas':46} {'pire':>6} {'A':>6} {'B':>6} {'C':>6}   {'A':>4} {'B':>4} {'C':>4}")
print("-" * 92)
for titre, groupe in CAS:
    pire = max(groupe, key=cpc)
    autres = [a for a in groupe if a is not pire]
    reperes = (
        median(cpc(x) for x in groupe),
        cpc_pondere(autres),
        median(cpc(x) for x in autres),
    )
    verdicts = [verdict(cpc(pire), r) for r in reperes]
    print(f"{titre:46} {cpc(pire):6.2f} " + " ".join(f"{r:6.2f}" for r in reperes)
          + "   " + " ".join(f"{v:>4}" for v in verdicts))

print("\nDIT = la règle parle, tait = la règle se tait")
