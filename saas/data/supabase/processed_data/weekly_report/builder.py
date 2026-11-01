"""Construit le rapport hebdo précalculé (weekly_reports.payload).

Seul producteur de weekly_reports.payload : ce worker publie après le fetch
cron → Pulse est frais le Jour de travail sans que personne n'ouvre quoi que ce
soit. Fenêtre : 7 jours pleins qui finissent la veille du dernier Jour de
travail (`blocs/semaine.py`), jamais aujourd'hui.

CE RAPPORT NE CONSEILLE RIEN, IL CONSTATE. Un fichier par bloc du payload dans
`blocs/` ; ce module ne fait que caler la semaine, lire une fois ce que
plusieurs blocs partagent, et décider s'il y a un rapport à publier.
"""

from __future__ import annotations

from saas.data.supabase.processed_data.weekly_report.blocs.assemble import blocs_neufs
from saas.data.supabase.processed_data.weekly_report.blocs.canaux_muets import canaux_muets
from saas.data.supabase.processed_data.weekly_report.blocs.semaine import semaine_du_rapport
from saas.data.supabase.processed_data.weekly_report.reader import Lecteur


class _InsightsLusUneFois:
    """Le même Lecteur, dont les insights Meta et Google ne se lisent qu'une fois.

    `sources`, `canaux`, `frise` et `canaux_muets` les relisaient chacun : quatre
    passages paginés sur tout l'historique pour les mêmes lignes. Une lecture qui
    échoue échoue pareil pour chacun — l'exception est gardée et relevée, pour
    que chaque bloc garde son propre « une lecture ratée n'est pas une semaine
    sans diffusion »."""

    def __init__(self, lecteur: Lecteur):
        self._lecteur = lecteur
        self._lu: dict[str, tuple[list | None, Exception | None]] = {}

    def __getattr__(self, nom):
        return getattr(self._lecteur, nom)

    def _une_fois(self, nom: str):
        if nom not in self._lu:
            try:
                self._lu[nom] = (getattr(self._lecteur, nom)(), None)
            except Exception as e:
                self._lu[nom] = (None, e)
        lignes, erreur = self._lu[nom]
        if erreur is not None:
            raise erreur
        return lignes

    def meta_ads(self):
        return self._une_fois("meta_ads")

    def google_ads(self):
        return self._une_fois("google_ads")


def build_payload(lecteur: Lecteur) -> dict | None:
    """Le payload du rapport, ou None quand il n'y a rien à publier."""
    lecteur = _InsightsLusUneFois(lecteur)
    try:
        jour_de_travail = lecteur.jour_de_travail()
    except Exception:
        # Profil illisible : repli lundi, le défaut de la base. Mieux vaut la
        # semaine d'un lundi que pas de rapport.
        jour_de_travail = None
    semaine = semaine_du_rapport(jour_de_travail, lecteur.aujourd_hui())

    blocs = blocs_neufs(lecteur, semaine)
    # ON PUBLIE DÈS QU'UNE SOURCE EST BRANCHÉE, PAS DÈS QU'ELLE A DÉPENSÉ. Une
    # semaine sans diffusion est un vrai 0 CHF ; un jeton mort ou une panne se
    # disent sur la page (`sources[c].etat`) — retenir le rapport serait un
    # silence que le client ne sait pas lire. Sans source branchée (ou
    # connexions illisibles), la page montre la carte du compte neuf.
    if not blocs.get("sources"):
        return None

    # La clé d'écriture `(user_id, week_start)` suit la semaine, jamais le jour
    # de fabrication : republier avant le Jour de travail suivant écrase sa
    # propre ligne (upsert idempotent). `publish_weekly_report` la lit.
    week_start = semaine.lundi_iso.isoformat()
    return {
        **blocs,
        "version": 3,
        "week_start": week_start,
        # La page ne la lit plus ; l'escalade de la récolte, si (`blocs/canaux_muets.py`).
        "canaux_muets": canaux_muets(lecteur, semaine, week_start),
    }
