"""Rendre `saas/` importable depuis ce dossier — le dépôt n'est pas un paquet
installé, et le harnais ne veut rien installer.

C'est le premier harnais qui EXÉCUTE `build_payload` au lieu de lire son texte :
c'est tout l'objet du ticket 16.
"""
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[4]
if str(RACINE) not in sys.path:
    sys.path.insert(0, str(RACINE))

SOURCE_RAPPORT = RACINE / "saas" / "traitement" / "build_report.py"
SOURCE_LECTEUR = RACINE / "saas" / "traitement" / "lecteur.py"
