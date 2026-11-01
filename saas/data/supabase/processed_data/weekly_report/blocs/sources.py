"""`sources` et `totaux` : l'état de chaque source branchée, et sa dépense et ses
impressions de la semaine (ticket 04).

L'ÉTAT, DANS CET ORDRE (spec hebdo, « état d'une source ») : jeton marqué à
reconnecter → `jeton_mort` ; couverture des insights qui ne contient pas toute
la semaine → `panne` ; sinon `recolte`. Ni « une ligne au dernier jour » (Meta
n'écrit rien un jour sans diffusion) ni `fetch_progress` (remis à zéro à
chaque passage, `fini` même avec des tranches refusées) ne peuvent servir :
seule la table de couverture du ticket 03 sépare une semaine sans diffusion
d'une semaine non récoltée.

LES TOTAUX NE SONT JAMAIS UN 0 D'ABSENCE (`CLAUDE.md` §7) : `None` dès que la
source n'est pas `recolte`. Une source `recolte` sans aucune ligne dans la
semaine rend un vrai 0. Seules dépense et impressions s'additionnent entre
plateformes ; la page fait la somme et nomme l'absente.

UNE SOURCE PAS BRANCHÉE N'A AUCUNE ENTRÉE, ni dans `sources` ni dans `totaux`.

Instagram n'y est pas : il n'entre pas dans les totaux (carte 16) ; son état,
s'il sert au panneau Organique, s'ajoutera avec lui (ticket 08).
"""

from __future__ import annotations

from datetime import date

from saas.data.supabase.processed_data.weekly_report.blocs.semaine import Semaine

SOURCES = ("meta", "google")


def sources_et_totaux(lecteur, semaine: Semaine) -> dict | None:
    # Sans connexions, on ne sait pas ce qui est branché : aucune clé, et la
    # page retombe sur « payload publié avant » plutôt que d'inventer un état.
    try:
        connexions = lecteur.connexions_etat() or []
    except Exception:
        return None
    # Une couverture illisible (table pas encore migrée, base injoignable) ne
    # prouve aucune semaine : toutes les sources tombent en `panne`, et le
    # rapport part quand même.
    try:
        couverture = lecteur.couverture() or []
    except Exception:
        couverture = []

    sources: dict[str, dict] = {}
    for source in SOURCES:
        lignes = [c for c in connexions if c.get("source") == source]
        if not lignes:
            continue
        sources[source] = {
            "etat": _etat(lignes, couverture, source, semaine),
            "connecte_le": _connecte_le(lignes),
            "journal": ("couvert" if _couvre(couverture, (source, "journal"), semaine)
                        else "non_couvert"),
        }

    depense: dict[str, float | None] = {}
    impressions: dict[str, int | None] = {}
    for source, etat in sources.items():
        if etat["etat"] != "recolte":
            depense[source] = impressions[source] = None
            continue
        sommes = _sommes(lecteur, source, semaine)
        if sommes is None:
            depense[source] = impressions[source] = None
            continue
        depense[source], impressions[source] = sommes

    return {"sources": sources,
            "totaux": {"depense": depense, "impressions": impressions}}


def _etat(lignes: list[dict], couverture: list[dict], source: str, semaine: Semaine) -> str:
    # Deux connexions Meta dont une marquée : une part des comptes n'est plus
    # lue, le total serait partiel sans le dire.
    if any(l.get("a_reconnecter_depuis") for l in lignes):
        return "jeton_mort"
    if not _couvre(couverture, (source, "insights"), semaine):
        return "panne"
    return "recolte"


def _couvre(couverture: list[dict], flux: tuple[str, str], semaine: Semaine) -> bool:
    """La plage sans trou contient-elle toute la semaine ? Une plage qui
    commence au milieu (après un trou) ou finit avant `fin` ne la contient pas."""
    source, nom = flux
    for c in couverture:
        if c.get("source") == source and c.get("flux") == nom:
            try:
                depuis = date.fromisoformat(str(c["sans_trou_depuis"])[:10])
                jusqu_au = date.fromisoformat(str(c["sans_trou_jusqu_au"])[:10])
            except (KeyError, ValueError):
                return False
            return depuis <= semaine.debut and jusqu_au >= semaine.fin
    return False


def _connecte_le(lignes: list[dict]) -> str | None:
    jours = sorted(str(l["created_at"])[:10] for l in lignes if l.get("created_at"))
    return jours[0] if jours else None


def _dans_la_semaine(ligne: dict, semaine: Semaine) -> bool:
    jour = str(ligne.get("date_start") or "")[:10]
    return semaine.debut.isoformat() <= jour <= semaine.fin.isoformat()


def _nombre(valeur) -> float:
    try:
        return float(valeur or 0)
    except (TypeError, ValueError):
        return 0.0


def _sommes(lecteur, source: str, semaine: Semaine) -> tuple[float, int] | None:
    """(dépense CHF, impressions) de la semaine, ou None si la lecture échoue —
    une lecture ratée n'est pas une semaine sans diffusion."""
    try:
        lignes = lecteur.meta_ads() if source == "meta" else lecteur.google_ads()
    except Exception:
        return None
    lignes = [l for l in (lignes or []) if _dans_la_semaine(l, semaine)]
    if source == "meta":
        depense = sum(_nombre(l.get("spend")) for l in lignes)
    else:
        # Google rend la dépense en micros de la devise du compte.
        depense = sum(_nombre(l.get("cost_micros")) for l in lignes) / 1_000_000
    impressions = sum(_nombre(l.get("impressions")) for l in lignes)
    return round(depense, 2), int(impressions)
