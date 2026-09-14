"""Rendre `saas/` importable depuis ce dossier.

Ce harnais ne construit aucun payload : il n'a rien à emprunter aux harnais
16/17. Le défaut du ticket 21 vit dans la RÉCOLTE — ce que `fetch_all.py`
demande au Graph API et ce qu'il fait du reste. Il lui faut donc un faux Graph,
pas un faux lecteur.
"""
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[4]
if str(RACINE) not in sys.path:
    sys.path.insert(0, str(RACINE))
