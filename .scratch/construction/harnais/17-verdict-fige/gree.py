"""Le compte du ticket 17 : un thème, des lignes de `suivi_actions`, et un
lecteur qui ENREGISTRE la condensation de mémoire au lieu de l'appeler.

Le faux lecteur du harnais 16 rend `memoire_theme` muet — c'est ce qu'il faut
pour prouver qu'un rapport tient sans IA. Ici la question est justement
« combien d'appels, et avec quel historique ? » : il faut donc les compter.
"""
from datetime import date

from lecteur_fige import Campagne, compte

# Après `_BASCULE_PUB` (2026-09-19) : une action `cpc` ou `roas` décidée avant
# cette date part SANS verdict automatique (périmètres de dépense différents,
# ticket 01). Un harnais qui daterait son compte d'aujourd'hui ne verrait donc
# jamais tomber un verdict `cpc` — il prouverait une bascule, pas un verdict.
AUJOURD_HUI = date(2026, 10, 15)
DECIDE_LE = "2026-09-25"
ECHEANCE = "2026-10-09"

# Le thème mesuré : 30 CHF et 100 clics par jour, donc un CPC de 0,30 sur toute
# fenêtre. Tout `baseline` d'ici se compare à ce 0,30 — aucun chiffre attendu
# n'est écrit à la main à côté du compte.
CPC_DU_THEME = 0.30


class LecteurMemoire:
    """Le lecteur du harnais 16, plus le journal des condensations."""

    def __init__(self, *, socle, verdict_refuse=False):
        self._socle = socle
        self.memoires: list[tuple] = []
        # `verdict_refuse` rejoue le refus RLS : l'`update` ne lève rien et ne
        # touche aucune ligne (`CLAUDE.md` § 8). C'est le seul moyen de vérifier
        # que la mémoire du thème ne se nourrit pas d'un verdict qui n'a pas pris.
        self._verdict_refuse = verdict_refuse

    def __getattr__(self, nom):
        return getattr(self._socle, nom)

    def memoire_theme(self, theme, historique, faits):
        self.memoires.append((theme, historique, faits))
        return None

    def ecrire_verdict(self, action_id, verdict):
        if self._verdict_refuse:
            return False
        return self._socle.ecrire_verdict(action_id, verdict)

    @property
    def ecrits(self):
        return self._socle.ecrits

    def verdicts_ecrits(self):
        return [(e[1], e[2]) for e in self._socle.ecrits if e[0] == "verdict"]

    def historique(self, theme):
        """L'historique passé à la condensation de ce thème, ou `None` si la
        mémoire de ce thème n'a pas été touchée."""
        for nom, hist, _faits in self.memoires:
            if nom == theme:
                return hist or []
        return None


def action(**champs):
    """Une ligne de `suivi_actions` FAITE et arrivée à échéance.

    Les valeurs par défaut sont celles du cas nominal : une hypothèse `cpc`
    posée sur le thème mesuré, décidée après la bascule, dont l'échéance est
    passée et dont la colonne `verdict` est encore vide.
    """
    ligne = {
        "id": "a-1", "title": "Baisser le budget de la Search",
        "theme": "Été", "reco_key": "gaspillage",
        "metric": "cpc", "metric_label": "CPC", "direction": "down",
        "baseline": 0.40,
        "status": "done", "decided_at": DECIDE_LE, "done_at": DECIDE_LE,
        "check_at": ECHEANCE, "verdict": None,
        "detail": {"levier": "argent"},
    }
    ligne.update(champs)
    return ligne


def theme_plan(*themes, resume=None, colonne_resume=True):
    """Les lignes `theme_plan` telles que `fetch_theme_plan` les rend.

    `colonne_resume=False` reproduit la base où la migration n'est pas jouée :
    la fonction retombe sur un `select` SANS `resume`, donc la clé est absente
    des lignes — pas présente à `None`. La distinction n'est pas cosmétique,
    c'est elle qui dit si une écriture de mémoire peut aboutir.
    """
    lignes = {}
    for t in themes:
        ligne = {"theme": t, "reco_key": "gaspillage", "levier": "argent",
                 "decided_at": DECIDE_LE, "snapshot": {}}
        if colonne_resume:
            ligne["resume"] = resume
        lignes[t.strip().lower()] = ligne
    return lignes


def campagne(theme, *, revenu=40.0):
    """30 CHF et 100 clics par jour — assez pour être jugée, CPC de 0,30."""
    return Campagne(f"{theme} – Search", theme=theme, depense_jour=30.0,
                    clics_jour=100, impressions_jour=4000, revenu_jour=revenu)


def gree(*, suivi=(), plan=None, themes=("Été",), revenu=40.0, notes=(),
         verdict_refuse=False):
    return LecteurMemoire(verdict_refuse=verdict_refuse, socle=compte(
        [campagne(t, revenu=revenu) for t in themes],
        etoiles=list(themes), aujourd_hui=AUJOURD_HUI,
        suivi=list(suivi), notes=list(notes),
        plan_de_theme=plan if plan is not None else theme_plan(*themes),
    ))
