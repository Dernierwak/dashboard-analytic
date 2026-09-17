"""Rendre `saas/` importable depuis ce dossier, ET le faux lecteur du harnais 16.

Le lecteur figé n'est PAS recopié ici : une deuxième copie dériverait de la
première en silence, et c'est précisément le défaut que `lecteur_fige.py`
s'interdit à lui-même (« tout descend des lignes d'entrée »).
"""
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[4]
HARNAIS_16 = Path(__file__).resolve().parent.parent / "16-le-seam-du-payload"
for _chemin in (RACINE, HARNAIS_16):
    if str(_chemin) not in sys.path:
        sys.path.insert(0, str(_chemin))

SOURCE_RAPPORT = RACINE / "saas" / "traitement" / "build_report.py"
