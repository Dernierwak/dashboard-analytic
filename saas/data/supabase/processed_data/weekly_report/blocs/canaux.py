"""`canaux[c]` : volumes de la semaine, et CTR, CPC, CPM placés parmi les 12
semaines précédentes (ticket 05).

L'ÉTAT DE LA SOURCE N'EST PAS RECALCULÉ ICI : il vient de `blocs/sources.py`,
passé par `assemble`. Une source qui n'est pas `recolte` (jeton mort, panne)
rend des volumes et des valeurs `None`, jamais 0 (`CLAUDE.md` §7) ; une source
`recolte` sans aucune ligne dans la semaine rend un vrai 0 de volume et des
ratios `None` — rien diffusé, rien à diviser.

UN RATIO DONT LE DÉNOMINATEUR VAUT 0 EST `None`, pas 0 et pas +∞. Chaque
semaine de l'historique est calée sur le Jour de travail et calculée sur SES
propres totaux ; une semaine sans ratio (aucune ligne, avant la connexion,
dénominateur nul) n'entre pas — elle ne compte pas dans `n`.

QUARTILES EN MÉTHODE « EXCLUSIVE » (spec hebdo) : `statistics.quantiles(…,
method="exclusive")`, celle du prototype validé ; contrôle [1…6] → 1,75 / 3,5
/ 5,25, là où `percentile_cont` de Postgres (inclusive) donnerait 2,25 / 4,75.
Sous 6 semaines, ni quartiles ni état : on ne juge pas sur trop peu.

LE PAYLOAD NE DIT QUE LA POSITION (`au_dessus` / `dans` / `en_dessous`) ; le
sens — un CTR haut est mieux, un CPC ou un CPM bas aussi — se décide à
l'affichage.

Google n'entre pas au module aujourd'hui (spec, « hors périmètre ») : il y
viendra avec les mêmes clés en s'ajoutant à `_LIGNES` (sa régie est déjà dans
`_commun.REGIES`).
"""

from __future__ import annotations

import statistics

from saas.data.supabase.processed_data.weekly_report.blocs._commun import (
    REGIES, Regie, dans_la_semaine, jour_iso, nombre,
)
from saas.data.supabase.processed_data.weekly_report.blocs.semaine import (
    Semaine, semaines_precedentes,
)

FENETRE = 12          # semaines de l'historique (spec hebdo, « Ratios »)
MINIMUM = 6           # semaines pour une semaine type (spec, tableau des états)
RATIOS = ("ctr", "cpc", "cpm")

# Les régies qui entrent au module : Meta seul (voir plus haut). Lecture et
# dépense sont celles de `_commun.REGIES`, les mêmes que pour `sources`.
_LIGNES = {canal: REGIES[canal] for canal in ("meta",)}


def _volumes(regie: Regie, ligne: dict) -> tuple[float, float, float] | None:
    """(dépense, impressions, clics), ou None si l'un est illisible : la ligne
    n'entre alors dans aucune semaine — ni 0, ni valeur, et les trois totaux
    décrivent les mêmes lignes."""
    valeurs = (regie.depense(ligne), nombre(ligne.get("impressions")), nombre(ligne.get("clicks")))
    return None if None in valeurs else valeurs


def canaux(lecteur, semaine: Semaine, sources: dict | None) -> dict | None:
    etats = (sources or {}).get("sources") or {}
    par_canal = {canal: _canal(lecteur, semaine, canal, etats[canal]["etat"])
                 for canal in _LIGNES if canal in etats}
    return par_canal or None


def _canal(lecteur, semaine: Semaine, canal: str, etat: str) -> dict:
    regie = _LIGNES[canal]
    try:
        lues = [(jour_iso(l), _volumes(regie, l)) for l in (regie.lire(lecteur) or [])]
        lignes = [(jour, v) for jour, v in lues if v is not None]
    except Exception:
        # Une lecture ratée n'est pas une semaine sans diffusion.
        lignes = None

    historique = [] if lignes is None else [
        _totaux(lignes, s) for s in semaines_precedentes(semaine, FENETRE)]
    courante = _totaux(lignes, semaine) if lignes is not None and etat == "recolte" else None

    volumes = ({"depense": None, "impressions": None, "clics": None} if courante is None
               else {"depense": round(courante[0], 2), "impressions": int(courante[1]),
                     "clics": int(courante[2])})
    return {"volumes": volumes,
            "ratios": {nom: _ratio(nom, courante, historique) for nom in RATIOS}}


def _totaux(lignes: list[tuple[str, tuple]], semaine: Semaine) -> tuple[float, float, float]:
    dans = [v for jour, v in lignes if dans_la_semaine(jour, semaine)]
    return (sum(v[0] for v in dans), sum(v[1] for v in dans), sum(v[2] for v in dans))


def _calcul(nom: str, totaux: tuple[float, float, float] | None) -> float | None:
    if totaux is None:
        return None
    depense, impressions, clics = totaux
    numerateur, denominateur, echelle = {
        "ctr": (clics, impressions, 100),
        "cpc": (depense, clics, 1),
        "cpm": (depense, impressions, 1000),
    }[nom]
    if not denominateur:
        return None
    return numerateur / denominateur * echelle


def quartiles(valeurs: list[float]) -> tuple[float, float, float] | None:
    """(q1, médiane, q3) en méthode exclusive, ou None sous `MINIMUM` valeurs."""
    if len(valeurs) < MINIMUM:
        return None
    q1, mediane, q3 = statistics.quantiles(valeurs, n=4, method="exclusive")
    return q1, mediane, q3


def _ratio(nom: str, courante, historique: list) -> dict:
    valeur = _calcul(nom, courante)
    # La plus ancienne d'abord : l'ordre de lecture d'une frise.
    semaines = [v for v in (_calcul(nom, t) for t in reversed(historique)) if v is not None]
    q = quartiles(semaines)
    etat = None
    if q is not None and valeur is not None:
        etat = "au_dessus" if valeur > q[2] else "en_dessous" if valeur < q[0] else "dans"
    return {
        "valeur": _arrondi(valeur),
        "semaines": [_arrondi(v) for v in semaines],
        "n": len(semaines),
        "q1": _arrondi(q[0]) if q else None,
        "mediane": _arrondi(q[1]) if q else None,
        "q3": _arrondi(q[2]) if q else None,
        "etat": etat,
    }


def _arrondi(valeur: float | None) -> float | None:
    # 6 décimales : un CPC sous le centime reste lisible, le JSON reste court.
    return None if valeur is None else round(valeur, 6)
