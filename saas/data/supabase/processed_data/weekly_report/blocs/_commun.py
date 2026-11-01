"""Ce que `sources.py`, `canaux.py` et `frise.py` lisent tous les trois dans une
ligne d'insights : son jour, sa dépense, et la régie qui la rend.

Ils en avaient chacun leur copie ; la revue de la branche d'intégration a
trouvé trois `_nombre` qui faisaient d'une dépense illisible un 0 — un chiffre
fabriqué (`CLAUDE.md` §7). Une seule règle, donc, et un seul endroit.

UNE DÉPENSE ABSENTE OU ILLISIBLE REND `None`, JAMAIS 0. La ligne qui la porte
est ignorée par l'appelant : elle ne compte ni comme 0 ni comme valeur. Les
colonnes sont `NOT NULL DEFAULT 0` en base, donc le cas ne devrait pas naître
de la récolte ; s'il naît quand même (colonne migrée de travers, ligne écrite à
la main), il ne doit pas se lire « rien dépensé ».
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Callable

from saas.data.supabase.processed_data.weekly_report.blocs.semaine import Semaine

# `cost_micros` compte en millionièmes : 1 000 000 = une unité de la devise.
MICROS_PAR_UNITE = 1_000_000


def nombre(valeur) -> float | None:
    """Le nombre que porte la cellule, ou `None` si elle est vide ou illisible."""
    if valeur is None or valeur == "":
        return None
    try:
        return float(valeur)
    except (TypeError, ValueError):
        return None


def depense_meta(ligne: dict) -> float | None:
    return nombre(ligne.get("spend"))


def depense_google(ligne: dict) -> float | None:
    """`cost_micros` est en millionièmes de la DEVISE DU COMPTE Google Ads
    (`customer.currency_code`) ; rien ne la convertit. Le rapport l'écrit en
    CHF, comme toute l'app (`lib/couts.ts`, `lib/channels.ts`) : c'est vrai
    pour un compte facturé en francs, et faux sans le dire pour un autre."""
    micros = nombre(ligne.get("cost_micros"))
    return None if micros is None else micros / MICROS_PAR_UNITE


@dataclass(frozen=True)
class Regie:
    """Où lire les insights d'une régie, et comment en tirer la dépense."""
    lire: Callable[[object], list[dict]]
    depense: Callable[[dict], float | None]


REGIES: dict[str, Regie] = {
    "meta": Regie(lire=lambda lecteur: lecteur.meta_ads(), depense=depense_meta),
    "google": Regie(lire=lambda lecteur: lecteur.google_ads(), depense=depense_google),
}


def jour_iso(ligne: dict) -> str:
    """Le jour de la ligne tel que la régie l'a écrit (`date_start`, sans
    fuseau à convertir : les insights sont déjà au jour du compte)."""
    return str(ligne.get("date_start") or "")[:10]


def jour_tel_qu_ecrit(valeur) -> date | None:
    """Les dix premiers caractères lus comme une date, sans conversion de
    fuseau ; `None` si ce n'en est pas une."""
    try:
        return date.fromisoformat(str(valeur)[:10]) if valeur else None
    except ValueError:
        return None


def dans_la_semaine(jour: str, semaine: Semaine) -> bool:
    """`jour` en ISO ; les deux bornes comprises."""
    return semaine.debut.isoformat() <= jour <= semaine.fin.isoformat()
