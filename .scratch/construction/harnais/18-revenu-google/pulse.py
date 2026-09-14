"""Rendre `saas/` importable depuis ce dossier, et réutiliser le faux lecteur
du harnais 16 plutôt que d'en tenir une seconde copie.

POURQUOI ON IMPORTE LE VOISIN. `lecteur_fige.py` fait descendre TOUT le compte
des campagnes décrites — les totaux par thème, le contexte GA4, la fenêtre. Une
copie divergerait au premier ticket qui touche l'un des deux, et les deux
harnais ne prouveraient plus la même chose sur le même compte. C'est le premier
partage entre deux harnais du dépôt ; il porte sur un GRÉEMENT, jamais sur une
assertion.
"""
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[4]
HARNAIS_16 = Path(__file__).resolve().parent.parent / "16-le-seam-du-payload"
for chemin in (RACINE, HARNAIS_16):
    if str(chemin) not in sys.path:
        sys.path.insert(0, str(chemin))

SOURCE_RAPPORT = RACINE / "saas" / "traitement" / "build_report.py"
