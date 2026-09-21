"""Rendre `saas/` importable. Ce harnais n'a besoin de rien d'autre : il
n'ouvre aucune base, il regarde ce que `Lecteur` DEMANDE à PostgREST."""
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[4]
if str(RACINE) not in sys.path:
    sys.path.insert(0, str(RACINE))
