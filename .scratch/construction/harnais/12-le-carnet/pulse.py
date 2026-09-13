"""Rendre `saas/` importable depuis ce dossier — le dépôt n'est pas un paquet
installé, et le harnais ne veut rien installer."""
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[4]
if str(RACINE) not in sys.path:
    sys.path.insert(0, str(RACINE))

SOURCE_RAPPORT = RACINE / "saas" / "traitement" / "build_report.py"
SOURCE_FETCH = RACINE / "saas" / "commun" / "fetch_data.py"
SOURCE_MEMOIRE = RACINE / "saas" / "recos_ia" / "theme_memoire.py"

WEB = RACINE / "saas" / "web"
SOURCE_CARNET = WEB / "lib" / "carnet.ts"
SOURCE_MODULE = WEB / "components" / "carnet.tsx"
SOURCE_LIGNE = WEB / "components" / "carnet-ligne.tsx"
SOURCE_AJOUT = WEB / "components" / "note-ajout.tsx"
SOURCE_ACTIONS = WEB / "app" / "actions.ts"
SOURCE_REPORT_TS = WEB / "lib" / "report.ts"


def page(nom):
    """Le source d'une page, par son dossier sous `app/` (« . » pour l'accueil)."""
    dossier = WEB / "app" if nom == "." else WEB / "app" / nom
    return (dossier / "page.tsx").read_text(encoding="utf-8")
