"""La semaine du rapport : 7 jours pleins qui finissent la veille du dernier
Jour de travail (≤ aujourd'hui), quel que soit le jour du recalcul.

Jamais ancrée sur la dernière donnée : le harnais du ticket 14 a montré qu'un
rapport refait le samedi glissait d'un jour et avalait le jour du fetch,
incomplet (`CLAUDE.md` §7). Une récolte en retard ne recule donc pas la
semaine — elle y laisse un trou, que l'état de la source dira (ticket 04).

LA PAGE NE REFAIT PAS CE CALCUL, elle lit `payload.semaine`. Seule la carte
« compte neuf », qui n'a pas de payload, l'applique côté web avec la même règle
(`lib/jour-de-travail.ts`). Écart connu : le web recule de 7 jours avant
07:00 UTC le Jour de travail, ce module n'a qu'une date — un `report_only`
lancé le Jour de travail avant 07:00 UTC mesure donc la semaine finie la
veille, comme le cron de 07:00 le fera.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

# Valeurs anglaises de `profiles.fetch_schedule` ; défaut 'Monday' en base
# (migration, section fetch_schedule), même repli que
# `scheduled_update._due_today` et `lib/jour-de-travail.ts JOUR_DEFAUT`.
JOURS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
JOUR_DEFAUT = "Monday"
UNE_SEMAINE = timedelta(days=7)


@dataclass(frozen=True)
class Semaine:
    debut: date
    fin: date

    @property
    def numero(self) -> int:
        return self.fin.isocalendar()[1]

    @property
    def lundi_iso(self) -> date:
        """La clé d'écriture `week_start` : le lundi ISO de la fin."""
        return self.fin - timedelta(days=self.fin.weekday())

    def en_payload(self) -> dict:
        return {"debut": self.debut.isoformat(), "fin": self.fin.isoformat(),
                "numero": self.numero}


def semaine_du_rapport(jour_de_travail: str | None, aujourd_hui: date) -> Semaine:
    jour = jour_de_travail if jour_de_travail in JOURS else JOUR_DEFAUT
    recul = (aujourd_hui.weekday() - JOURS.index(jour)) % 7
    fin = aujourd_hui - timedelta(days=recul + 1)
    return Semaine(debut=fin - timedelta(days=6), fin=fin)


def semaines_precedentes(semaine: Semaine, n: int) -> list[Semaine]:
    """Les `n` semaines avant `semaine`, la plus récente d'abord — chacune calée
    sur le même Jour de travail (moustache du ticket 05, frise du ticket 07)."""
    return [Semaine(semaine.debut - UNE_SEMAINE * k, semaine.fin - UNE_SEMAINE * k)
            for k in range(1, n + 1)]
