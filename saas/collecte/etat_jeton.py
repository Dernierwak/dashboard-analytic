"""Ce qu'on sait d'un jeton avant de récolter — commun à Meta et à Google.

Trois états, pas deux. « Mort » et « on n'a pas pu savoir » ne demandent pas
le même geste : le premier exige que le client se reconnecte (Meta et Google
veulent un clic humain, le worker ne peut pas refaire l'auth), le second ne
demande rien à personne — une panne réseau ou un identifiant d'app absent de
NOTRE côté ne doit jamais faire croire au client que sa connexion est cassée.

Vit à la racine de `collecte/` faute de socle sur cette branche : il rejoindra
`collecte/socle/` à la fusion avec la restructuration
(`.scratch/recolte/tickets/03-le-jeton-se-verifie.md`).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

VALIDE = "valide"
MORT = "mort"
INCONNU = "inconnu"


@dataclass(frozen=True)
class EtatJeton:
    etat: str                          # VALIDE | MORT | INCONNU
    raison: str | None = None          # dite au client si MORT, au journal si INCONNU
    expire_le: datetime | None = None  # None = la plateforme ne l'a pas dit

    @property
    def a_reconnecter(self) -> bool:
        return self.etat == MORT
