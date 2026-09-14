"""Rendre `saas/` importable, et réutiliser le faux lecteur du ticket 16.

Le harnais 16 a déjà bâti un compte entier sur des lignes fixes
(`lecteur_fige.py`). Le recopier ici en ferait deux qui dérivent ; on l'importe.
Ce ticket n'ajoute qu'une chose à ce compte : **un canal qui s'arrête d'écrire
avant la fenêtre**, et le dire.
"""
import sys
from pathlib import Path

ICI = Path(__file__).resolve().parent
RACINE = ICI.parents[3]
HARNAIS_16 = ICI.parent / "16-le-seam-du-payload"

for chemin in (RACINE, HARNAIS_16):
    if str(chemin) not in sys.path:
        sys.path.insert(0, str(chemin))
