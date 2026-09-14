"""Le gréement qui manquait au faux lecteur : les publications et les abonnés.

Le harnais 16 le disait en toutes lettres — *« les publications Instagram et les
abonnés ne sont pas gréés, donc toutes les règles organiques ne tournent pas
ici ; ce n'est plus une limite de structure, c'est du gréement à ajouter quand
un ticket en aura besoin. »* Ce ticket en a besoin : les deux Hypothèses que
`_GESTE_REGLE` déclare côté organique — `orga_essoufflement` et `page_endormie`
— sont exactement celles dont on veut voir la concurrence.

CE QUE LE GRÉEMENT CALCULE, ET CE QU'IL NE POSE PAS. Comme `lecteur_fige`, tout
descend des lignes : on décrit des publications (jour, portée), et les deux
règles se déclenchent parce que LEURS SEUILS sont franchis par ces lignes — pas
parce qu'on aurait posé un booléen à côté.
"""
from datetime import date, timedelta

from lecteur_fige import LecteurFige, compte

ABONNES = 1000


class LecteurOrganique(LecteurFige):
    """Un `LecteurFige` qui répond AUSSI sur l'organique, le plan et les verdicts.

    Les trois lectures que le faux lecteur rendait vides ou fixes et dont ce
    ticket a besoin pour décrire une situation : ce qu'on a publié, quelle
    Stratégie tourne déjà, et quel verdict est tombé.
    """

    def __init__(self, socle: LecteurFige, *, publications, abonnes,
                 plan=None, verdicts=None):
        self.__dict__.update(socle.__dict__)
        self._publications = list(publications)
        self._abonnes = list(abonnes)
        self._plan_de_theme = dict(plan or {})
        self._verdicts = dict(verdicts or {})

    def publications(self): return self._publications

    def abonnes(self): return self._abonnes

    def verdicts(self): return self._verdicts


def publications_essoufflees(theme: str, *, dernier_jour: date) -> list[dict]:
    """Des publications qui font parler LES DEUX règles organiques à la fois.

    Les seuils qu'elles franchissent, et le calcul qui les y amène :

    · `orga_essoufflement` (`_orga_rythme`, `build_report.py`) compare la
      cadence des 28 derniers jours à celle des 84 d'avant, ramenées au même
      dénominateur. Six publications de référence valent 6 × 28/84 = **2** par
      période de quatre semaines ; on en publie **4** récemment, soit un écart
      de +100 % — au-dessus du +40 % qui déclenche. Et la portée CUMULÉE ne
      suit pas : 4 × 20 = 80 contre 6 × 50 × 28/84 = 100. Publier plus sans
      toucher plus de monde, c'est la définition de la règle.
    · `page_endormie` (`_rule_page_endormie`, `reco_engine.py`) demande au moins
      cinq publications, cent abonnés, et une portée moyenne sous 10 % des
      abonnés. Dix publications, mille abonnés, portée moyenne
      (6 × 50 + 4 × 20) / 10 = **38**, soit 3,8 %.

    Les deux sortent donc du MÊME thème la même semaine, et c'est la situation
    que le ticket 27 décrit.
    """
    lignes = []

    def poster(jours_avant: int, portee: int):
        lignes.append({
            "date": (dernier_jour - timedelta(days=jours_avant)).isoformat(),
            "labels": [theme],
            "media_type": "IMAGE",
            "reach": portee, "likes": 2, "comments": 0, "saved": 0,
        })

    # La référence : six publications dans les 84 jours qui précèdent la
    # fenêtre récente (elle commence 28 jours avant le dernier jour plein).
    for jours in (30, 40, 50, 60, 70, 80):
        poster(jours, 50)
    # Et la cadence récente, montée à quatre — pour une portée en berne.
    for jours in (1, 5, 10, 20):
        poster(jours, 20)
    return lignes


def abonnes_stables(*, dernier_jour: date, n: int = ABONNES) -> list[dict]:
    """Un compte d'abonnés plat : `followers_current` se lit sur la ligne la
    plus récente, et `followers_delta` sur la septième — zéro ici, ce qui
    n'ouvre aucune règle et ne pollue donc pas la mesure."""
    return [{"fetched_at": (dernier_jour - timedelta(days=j)).isoformat(),
             "followers": n}
            for j in range(10)]


def compte_organique(campagnes, *, etoiles, aujourd_hui: date,
                     theme_organique: str, plan=None, verdicts=None, **reste):
    """Un compte entier : les campagnes du harnais 16, plus l'organique d'ici."""
    socle = compte(campagnes, etoiles=etoiles, aujourd_hui=aujourd_hui, **reste)
    dernier_jour = aujourd_hui - timedelta(days=1)
    return LecteurOrganique(
        socle,
        publications=publications_essoufflees(theme_organique,
                                              dernier_jour=dernier_jour),
        abonnes=abonnes_stables(dernier_jour=dernier_jour),
        plan=plan, verdicts=verdicts)
