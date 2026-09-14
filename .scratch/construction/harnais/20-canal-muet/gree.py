"""Gréer un compte dont UN canal payant s'est tu, et rien d'autre.

CE QUE « MUET » VEUT DIRE ICI, ET POURQUOI ÇA NE SE SIMULE PAS EN VIDANT UNE
LISTE. Un canal dont la récolte échoue ne perd pas son historique : il a écrit
jusqu'au dernier passage réussi, puis plus rien. Ses lignes s'arrêtent donc
AVANT la fenêtre du rapport, pendant que celles des autres canaux vont jusqu'au
bout. C'est cette forme-là qui produit le faux verdict — un compte simplement
vide ne la reproduit pas.

ET SURTOUT : GA4 CONTINUE D'ÉCRIRE. `LecteurFige.ga4_contexte` calcule le revenu
à partir des campagnes décrites, sans jamais regarder si leurs lignes de dépense
sont là. C'est exactement l'asymétrie du terrain — le revenu entier, le
dénominateur amputé — et c'est elle qui fait GONFLER le ROAS au lieu de le faire
tomber. Le harnais n'a rien eu à truquer pour l'obtenir.
"""
from datetime import timedelta

from lecteur_fige import LecteurFige, compte


class LecteurMuet:
    """Un `LecteurFige` dont un canal s'arrête d'écrire, et qui le déclare.

    Tout est délégué au lecteur d'origine sauf trois méthodes : les deux qui
    servent les lignes des canaux payants (tronquées) et `canaux_muets`.
    """

    def __init__(self, fond: LecteurFige, muets: dict, coupe):
        self._fond = fond
        self._muets = dict(muets)
        self._coupe = coupe   # dernier jour réellement écrit par le canal muet

    def __getattr__(self, nom):
        return getattr(self._fond, nom)

    def _tronque(self, lignes):
        return [l for l in lignes
                if l.get("date_start", "") <= self._coupe.isoformat()]

    def meta_ads(self):
        lignes = self._fond.meta_ads()
        return self._tronque(lignes) if "meta" in self._muets else lignes

    def google_ads(self):
        lignes = self._fond.google_ads()
        return self._tronque(lignes) if "google" in self._muets else lignes

    def google_annonces(self):
        lignes = self._fond.google_annonces()
        return self._tronque(lignes) if "google" in self._muets else lignes

    def canaux_muets(self):
        return dict(self._muets)


def compte_muet(campagnes, *, muets, aujourd_hui, jours_de_trou=7, **reste):
    """Le compte du harnais 16, avec `muets` silencieux depuis `jours_de_trou`.

    `muets` : {canal: mot de la fin}, la forme que `fetch_progress` rend.
    """
    fond = compte(campagnes, aujourd_hui=aujourd_hui, **reste)
    derniere = aujourd_hui - timedelta(days=1)
    return LecteurMuet(fond, muets, derniere - timedelta(days=jours_de_trou))


def compte_sain(campagnes, *, aujourd_hui, **reste):
    """Le même compte, sans aucun canal muet. Le témoin de chaque mesure.

    Il passe par `LecteurMuet` avec un dictionnaire vide plutôt que par `compte`
    directement : sans ça, le témoin n'aurait pas la méthode `canaux_muets` et
    ne vérifierait pas tout à fait le même chemin de code.
    """
    fond = compte(campagnes, aujourd_hui=aujourd_hui, **reste)
    return LecteurMuet(fond, {}, aujourd_hui)
