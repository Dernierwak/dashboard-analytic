"""Rendre `saas/` importable depuis ce dossier.

Ce harnais ne partage pas le gréement des harnais 16/17 : il ne construit
aucun payload. Il n'a besoin que d'un faux client Supabase, parce que le
défaut du ticket 43 est une ÉCRITURE — ce que `labeling.py` pose dans
`google_campaign_config`, pas ce que le rapport en lit ensuite.
"""
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[4]
if str(RACINE) not in sys.path:
    sys.path.insert(0, str(RACINE))
