"""`canaux[c].changements` : ce que la plateforme a écrit pendant la semaine.

Le jour d'un changement est celui du compte, celui des insights — donc du point
de la courbe où l'effet apparaît. Les deux plateformes ne l'écrivent pas pareil
(même règle que `saas/web/lib/changements-api.ts`, `jourDuCompte`) :
  · Meta écrit l'instant en UTC ; le jour se découpe dans le `fuseau` récolté
    avec la ligne, et une ligne d'avant le fuseau retombe sur l'UTC ;
  · Google écrit l'heure du compte SANS décalage, que le `timestamptz` garde
    telle quelle comme si c'était de l'UTC : la date écrite EST le jour du
    compte, la reconvertir la fausserait.

« Journal non couvert » ne se dit pas ici : `sources[canal].journal` le porte
déjà (`blocs/sources.py`), et une liste vide ne se lit qu'avec lui.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from saas.data.supabase.processed_data.weekly_report.blocs.semaine import Semaine

CANAUX = ("meta", "google")

# Les catégories de la spec hebdo (user story 23). La base en a deux de plus
# (CHECK `platform_changes_categorie_check`) : `statut` et `creation` se rangent
# sous `autre`, décision du coordinateur du chantier hebdo. Une catégorie
# inconnue aussi : la carte ne doit jamais tomber sur une clé qu'elle ignore.
CATEGORIES = ("budget", "enchere", "audience", "creatif", "objectif",
              "motcle", "diffusion", "calendrier", "autre")

COMPTE_PUBLICITAIRE = "Compte publicitaire"


def changements_par_canal(lecteur, semaine: Semaine) -> dict[str, list[dict]] | None:
    """`None` si le journal n'a pas pu être lu : la clé reste absente, pour
    qu'un journal illisible ne se lise jamais « aucun changement »."""
    try:
        lignes = lecteur.changements(semaine.debut, semaine.fin) or []
    except Exception:
        return None

    par_canal: dict[str, list[tuple[str, str, dict]]] = {canal: [] for canal in CANAUX}
    for ligne in lignes:
        canal = ligne.get("channel")
        jour = _jour(ligne)
        if canal not in par_canal or jour is None:
            continue
        if not semaine.debut <= jour <= semaine.fin:
            continue
        par_canal[canal].append((jour.isoformat(), str(ligne.get("occurred_at")), _changement(ligne, jour)))

    return {canal: [c for _, _, c in sorted(liste, key=lambda t: t[:2])]
            for canal, liste in par_canal.items()}


def _changement(ligne: dict, jour: date) -> dict:
    categorie = ligne.get("categorie")
    campaign_id = ligne.get("campaign_id")
    return {
        "jour": jour.isoformat(),
        "categorie": categorie if categorie in CATEGORIES else "autre",
        "campaign_id": str(campaign_id) if campaign_id not in (None, "") else None,
        "campagne": ligne.get("campaign_name") or None,
        "objet": COMPTE_PUBLICITAIRE if ligne.get("niveau") == "compte" else (ligne.get("object_name") or None),
        "resume": ligne.get("resume") or "",
    }


def _jour(ligne: dict) -> date | None:
    brut = ligne.get("occurred_at")
    if not brut:
        return None
    texte = str(brut)
    try:
        if ligne.get("channel") == "google":
            return date.fromisoformat(texte[:10])
        instant = datetime.fromisoformat(texte.replace("Z", "+00:00"))
    except ValueError:
        return None
    if instant.tzinfo is None:
        instant = instant.replace(tzinfo=timezone.utc)
    return instant.astimezone(_fuseau(ligne.get("fuseau"))).date()


def _fuseau(nom: str | None):
    if not nom:
        return timezone.utc
    try:
        return ZoneInfo(nom)
    except (ZoneInfoNotFoundError, ValueError):
        return timezone.utc
