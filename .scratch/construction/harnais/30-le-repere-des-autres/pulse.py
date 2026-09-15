"""Rendre `saas/` importable depuis ce dossier — le dépôt n'est pas un paquet
installé, et le harnais ne veut rien installer."""
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[4]
if str(RACINE) not in sys.path:
    sys.path.insert(0, str(RACINE))

SOURCE_RAPPORT = RACINE / "saas" / "traitement" / "build_report.py"
SOURCE_MOTEUR = RACINE / "saas" / "recos_ia" / "reco_engine.py"
