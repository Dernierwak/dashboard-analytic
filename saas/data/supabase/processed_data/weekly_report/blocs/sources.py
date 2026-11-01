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

INSTAGRAM A UNE ENTRÉE DANS `sources`, JAMAIS DANS `totaux` (carte 16) : elle
ne sert qu'à l'onglet Organique (ticket 08), pour qu'une semaine sans post se
distingue d'une semaine pas encore récoltée. Instagram se récolte avec le jeton
Meta : il hérite de sa connexion et de sa marque « à reconnecter ». Il n'est
dit branché que si la récolte a écrit sa couverture `("instagram", "posts")` —
`connexions_etat` ne dit pas si un compte Instagram est lié, et sans couverture
rien ne prouverait une semaine vide. `posts` porte la plage couverte, parce que
le panneau juge chaque semaine choisie, pas seulement la semaine mesurée.
"""

from __future__ import annotations

from datetime import date

from saas.data.supabase.processed_data.weekly_report.blocs._commun import (
    REGIES, dans_la_semaine, jour_iso, nombre,
)
from saas.data.supabase.processed_data.weekly_report.blocs.semaine import Semaine

SOURCES = tuple(REGIES)


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

    instagram = _instagram(sources.get("meta"), connexions, couverture, semaine)

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

    if instagram is not None:
        sources["instagram"] = instagram
    return {"sources": sources,
            "totaux": {"depense": depense, "impressions": impressions}}


def _instagram(meta: dict | None, connexions: list[dict], couverture: list[dict],
               semaine: Semaine) -> dict | None:
    plage = next((c for c in couverture
                  if c.get("source") == "instagram" and c.get("flux") == "posts"), None)
    if meta is None or plage is None:
        return None
    lignes = [c for c in connexions if c.get("source") == "meta"]
    if any(l.get("a_reconnecter_depuis") for l in lignes):
        etat = "jeton_mort"
    elif _couvre(couverture, ("instagram", "posts"), semaine):
        etat = "recolte"
    else:
        etat = "panne"
    return {"etat": etat, "connecte_le": meta["connecte_le"],
            "posts": {"depuis": str(plage.get("sans_trou_depuis"))[:10],
                      "jusqu_au": str(plage.get("sans_trou_jusqu_au"))[:10]}}


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


def _sommes(lecteur, source: str, semaine: Semaine) -> tuple[float, int] | None:
    """(dépense, impressions) de la semaine, ou None si la lecture échoue —
    une lecture ratée n'est pas une semaine sans diffusion. La dépense est
    celle de la régie, sans conversion (`_commun.depense_google`). Une ligne
    dont la dépense ou les impressions sont illisibles n'entre pas, ni pour
    l'une ni pour l'autre : ni 0, ni valeur — et les deux totaux décrivent les
    mêmes lignes."""
    regie = REGIES[source]
    try:
        lignes = regie.lire(lecteur) or []
    except Exception:
        return None
    depense = impressions = 0.0
    for ligne in lignes:
        montant, vues = regie.depense(ligne), nombre(ligne.get("impressions"))
        if montant is None or vues is None or not dans_la_semaine(jour_iso(ligne), semaine):
            continue
        depense += montant
        impressions += vues
    return round(depense, 2), int(impressions)
