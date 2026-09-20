"""Rendre `saas/` importable. Rien d'autre.

Contrairement aux harnais 20 et 47, celui-ci n'a besoin d'aucun compte gréé :
tout ce qu'il vérifie est PUR — la traduction d'un événement de fournisseur, la
phrase qui en sort, et la décision de relever ou non. Ni base, ni secret, ni
réseau, et aucun `build_payload` à faire tourner.

Le chemin est AJOUTÉ, jamais inséré en tête : le dossier du script est déjà
`sys.path[0]`, et l'y pousser ferait charger le `t.py` d'un autre harnais à la
place du nôtre — plusieurs fichiers de même nom vivent dans ce dossier.
"""
import sys
from pathlib import Path

ICI = Path(__file__).resolve().parent
RACINE = ICI.parents[3]
if str(RACINE) not in sys.path:
    sys.path.append(str(RACINE))
