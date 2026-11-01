"""Harnais du ticket 03 — la règle de la couverture, exécutée hors ligne.

    python3.12 .scratch/hebdo/harnais/03-couverture/test_couverture.py
(depuis la racine du worktree). Aucune base, aucun secret : les fonctions
pures de `source_data/couverture.py`, puis `journal_changements` et
`avancer_couverture` sur une fausse table.
"""
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
from saas.data.fetch_data.shared.date_ranges import Fenetre  # noqa: E402
from saas.data.supabase.source_data.couverture import (  # noqa: E402
    Couverture, debut_des_posts_complets, etendre,
)

ECHECS = []


def constat(nom, obtenu, attendu):
    if obtenu != attendu:
        ECHECS.append(f"{nom} : obtenu {obtenu!r}, attendu {attendu!r}")


J = date(2026, 10, 29)  # jour du fetch


# ── etendre : la date n'avance que sans tranche refusée, ne recule jamais ────

constat("premier passage propre → jusqu'à la veille du fetch",
        etendre(None, Fenetre(date(2026, 10, 1), J), []),
        Couverture(date(2026, 10, 1), date(2026, 10, 28)))

constat("une tranche refusée → rien ne s'écrit",
        etendre(None, Fenetre(date(2026, 10, 1), J), ["tranche 2026-10-10 refusée"]),
        None)

constat("une tranche refusée → une couverture acquise ne bouge pas",
        etendre(Couverture(date(2026, 9, 1), date(2026, 10, 21)),
                Fenetre(date(2026, 10, 1), J), ["refus"]),
        None)

constat("passage propre qui recouvre l'acquis → la date avance, le début reste",
        etendre(Couverture(date(2026, 9, 1), date(2026, 10, 21)),
                Fenetre(date(2026, 10, 1), J), []),
        Couverture(date(2026, 9, 1), date(2026, 10, 28)))

constat("passage propre bout à bout (début = lendemain de l'acquis) → avance",
        etendre(Couverture(date(2026, 9, 1), date(2026, 10, 21)),
                Fenetre(date(2026, 10, 22), J), []),
        Couverture(date(2026, 9, 1), date(2026, 10, 28)))

constat("passage plus ancien que l'acquis → la date ne recule pas",
        etendre(Couverture(date(2026, 9, 1), date(2026, 10, 28)),
                Fenetre(date(2026, 9, 10), date(2026, 10, 20)), []),
        None)

constat("même passage rejoué le même jour → rien à écrire",
        etendre(Couverture(date(2026, 10, 1), date(2026, 10, 28)),
                Fenetre(date(2026, 10, 1), J), []),
        None)

constat("rejeu complet plus profond → le début recule, la fin reste",
        etendre(Couverture(date(2026, 9, 1), date(2026, 10, 28)),
                Fenetre(date(2026, 1, 1), J), []),
        Couverture(date(2026, 1, 1), date(2026, 10, 28)))

# Un trou entre l'acquis et le passage : on ne sait pas ce qu'il y a dedans.
# La nouvelle couverture repart du début du passage — elle ne prétend pas
# couvrir le trou, et la date de fin avance quand même.
constat("trou entre l'acquis et le passage → nouvelle plage, sans enjamber le trou",
        etendre(Couverture(date(2026, 8, 1), date(2026, 8, 31)),
                Fenetre(date(2026, 10, 1), J), []),
        Couverture(date(2026, 10, 1), date(2026, 10, 28)))

constat("fenêtre réduite au jour du fetch → rien de complet à dire",
        etendre(None, Fenetre(J, J), []),
        None)


# ── debut_des_posts_complets : depuis quand l'inventaire est en base ─────────

def media(pid, jour):
    return {"id": pid, "timestamp": f"{jour}T12:00:00+0000"}


INVENTAIRE = [media("3", "2026-10-20"), media("2", "2026-09-15"), media("1", "2026-08-02")]

constat("tous les posts en base → aucune borne basse",
        debut_des_posts_complets(INVENTAIRE, {"1", "2", "3"}),
        date.min)

constat("inventaire vide (aucun post publié) → aucune borne basse",
        debut_des_posts_complets([], set()),
        date.min)

constat("un post manquant → la couverture commence le lendemain de sa date",
        debut_des_posts_complets(INVENTAIRE, {"2", "3"}),
        date(2026, 8, 3))

constat("le plus récent manquant → tout ce qui est avant ne compte pas",
        debut_des_posts_complets(INVENTAIRE, {"1", "2"}),
        date(2026, 10, 21))

constat("l'ordre de l'inventaire n'y change rien",
        debut_des_posts_complets(list(reversed(INVENTAIRE)), {"2", "3"}),
        date(2026, 8, 3))


# ── journal_changements : l'échec, imprimé puis avalé, empêche la couverture ──

from saas.data.supabase.source_data.platform import journal_changements  # noqa: E402


def leve():
    raise RuntimeError("réseau coupé")


constat("journal complet (même vide) → écrit sans trou",
        journal_changements(None, "u", "meta", lambda: ([], [])), True)
constat("journal refusé → pas sans trou",
        journal_changements(None, "u", "meta", lambda: ([], ["refus"])), False)
constat("journal qui lève → avalé, mais pas sans trou",
        journal_changements(None, "u", "meta", leve), False)


# ── avancer_couverture : lit, n'écrit que ce qu'`etendre` accorde ────────────

from saas.data.supabase.source_data.couverture import avancer_couverture  # noqa: E402


class FausseTable:
    def __init__(self, base):
        self.base, self.ecrit = base, []

    def table(self, _nom):
        return self

    def select(self, *_):
        self._op = "lire"
        return self

    def eq(self, *_):
        return self

    def limit(self, _):
        return self

    def upsert(self, ligne, on_conflict):
        self._op, self._ligne = "ecrire", ligne
        return self

    def execute(self):
        class R:
            pass
        r = R()
        if self._op == "lire":
            r.data = self.base
        else:
            self.ecrit.append(self._ligne)
            r.data = [self._ligne]
        return r


sb = FausseTable([{"sans_trou_depuis": "2026-09-01", "sans_trou_jusqu_au": "2026-10-28"}])
avancer_couverture(sb, "u", ("meta", "insights"), Fenetre(date(2026, 10, 1), date(2026, 10, 22)), [])
constat("passage plus ancien que l'acquis → aucune écriture", sb.ecrit, [])

sb = FausseTable([])
avancer_couverture(sb, "u", ("google", "journal"), Fenetre(date(2026, 9, 29), J), [])
constat("première couverture → une ligne, veille du fetch",
        [(e["source"], e["flux"], e["sans_trou_depuis"], e["sans_trou_jusqu_au"]) for e in sb.ecrit],
        [("google", "journal", "2026-09-29", "2026-10-28")])


if ECHECS:
    print("ÉCHEC\n  " + "\n  ".join(ECHECS))
    sys.exit(1)
print("couverture : tous les constats tiennent.")
