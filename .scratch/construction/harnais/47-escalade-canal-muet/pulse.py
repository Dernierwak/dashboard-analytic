"""Rendre `saas/` importable, et réutiliser les deux harnais qui précèdent.

Le ticket 16 a bâti un compte entier sur des lignes fixes (`lecteur_fige.py`),
le ticket 20 lui a ajouté un canal qui s'arrête d'écrire (`gree.py`). Ce
ticket-ci n'ajoute qu'une chose par-dessus : **les rapports déjà publiés des
semaines d'avant**, qui sont la seule preuve d'où se compte une série.

Les chemins sont AJOUTÉS, jamais insérés en tête : le dossier du script est
déjà `sys.path[0]`, et l'y pousser ferait charger le `t.py` du ticket 20 à la
place du nôtre — deux fichiers de même nom vivent dans chaque harnais.
"""
import sys
from pathlib import Path

ICI = Path(__file__).resolve().parent
RACINE = ICI.parents[3]

for chemin in (RACINE, ICI.parent / "16-le-seam-du-payload",
               ICI.parent / "20-canal-muet"):
    if str(chemin) not in sys.path:
        sys.path.append(str(chemin))
