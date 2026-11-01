"""Le faux `Lecteur` commun aux harnais du chantier hebdo.

Toutes les méthodes du `Protocol` (`weekly_report/reader.py`) y sont, avec une
valeur neutre : un compte sans aucune donnée, servi le lundi. Chaque harnais
sous-classe et surcharge ce que son ticket regarde — personne ne modifie ce
fichier après le ticket 01 (`99-chevauchements`), pour que deux tickets en
parallèle ne s'y croisent pas.

    from commun.faux_lecteur import FauxLecteur, RACINE
"""
import sys
from datetime import date
from pathlib import Path

# .scratch/hebdo/harnais/commun/faux_lecteur.py → parents[4] = racine du dépôt.
RACINE = Path(__file__).resolve().parents[4]
if str(RACINE) not in sys.path:
    sys.path.insert(0, str(RACINE))


class FauxLecteur:
    def __init__(self, aujourd_hui: date, jour_de_travail: str | None = "Monday"):
        self._auj = aujourd_hui
        self._jt = jour_de_travail

    # La récolte
    def meta_ads(self): return []
    def publications(self): return []
    def abonnes(self): return []
    def google_ads(self): return []

    # Les réglages du compte
    def objectif(self): return None
    def canaux_muets(self): return {}
    def jour_de_travail(self): return self._jt
    def connexions_etat(self): return []

    # GA4
    def ga4_contexte(self, since, until): return None
    def ga4_insights(self): return []

    # Les lectures de tables
    def dates_declarees(self, table): return []
    def campagnes_config(self, table): return []
    def creas(self): return []
    def changements(self, debut, fin): return []
    def couverture(self): return []
    def rapports_publies(self, avant, limite=8): return []

    # L'horloge
    def aujourd_hui(self): return self._auj


class Constats:
    """Le `constat(...)` des harnais : imprime, retient l'échec, conclut."""

    def __init__(self):
        self.echecs: list[str] = []

    def __call__(self, vrai: bool, texte: str) -> None:
        print(("✓ " if vrai else "✗ ") + texte)
        if not vrai:
            self.echecs.append(texte)

    def conclure(self) -> None:
        print()
        if self.echecs:
            sys.exit(f"{len(self.echecs)} constat(s) ne tiennent pas.")
        print("tous les constats tiennent.")
