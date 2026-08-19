"""Le suivi de récolte — ce que le worker dit de lui-même pendant qu'il travaille.

POURQUOI CE MODULE EXISTE.
Jusqu'ici, l'écran ne savait qu'une chose de la récolte : le run GitHub
tourne-t-il, oui ou non. Tout le reste était mimé côté navigateur —
`avancement(sec)` dans `fetch-button.tsx` est une exponentielle sur le temps
écoulé, et la liste des étapes est horodatée à la main (« Google Ads » à 420 s).
Ça n'a jamais rien mesuré, et depuis que les canaux tournent en parallèle ces
étapes sont fausses par construction.

Ce module ouvre le seul canal honnête : le worker écrit où il en est, canal par
canal, dans `fetch_progress`. L'écran lit.

DEUX RÈGLES QUI NE SE NÉGOCIENT PAS ICI.

① Une écriture de suivi ne fait JAMAIS échouer une récolte. Perdre une ligne
   d'état coûte un panneau incomplet ; faire tomber la récolte coûte une semaine
   de données.

② Mais elle n'échoue pas en silence non plus. Le piège des `except: pass` a été
   corrigé au même endroit la veille — on ne le réintroduit pas. Le premier raté
   s'imprime en entier (type + message), les suivants sont comptés, et `bilan()`
   dit combien ont été perdues. Un journal noyé sous vingt fois la même erreur
   n'est pas plus lisible qu'un silence.
"""

from __future__ import annotations

import threading
import time
from datetime import datetime, timezone

# Les canaux, dans l'ordre où l'écran doit les lire. C'est aussi l'ordre dans
# lequel `run()` trie son journal : en parallèle, l'ordre d'exécution n'est plus
# un ordre, c'est le hasard des latences réseau.
CANAUX = ("meta", "instagram", "google", "ga4", "labels", "rapport")

# Combien de temps au minimum entre deux écritures d'ÉTAPE sur un même canal.
# Instagram appelle `note()` à chaque post ; sans ce plancher, un compte à
# 200 posts ferait 200 écritures Supabase pour un panneau qui se rafraîchit
# toutes les 12 secondes. Les changements d'ÉTAT (début, fin, échec), eux, ne
# sont jamais retenus : ce sont les seuls que l'écran ne peut pas deviner.
_INTERVALLE_ETAPE_S = 3.0


def _maintenant() -> str:
    return datetime.now(timezone.utc).isoformat()


class Suivi:
    """L'état de la récolte d'UN utilisateur, sur UN passage.

    Instancié une fois par utilisateur dans `run()`. Ses méthodes sont appelées
    depuis plusieurs fils — d'où le verrou, qui ne protège que la comptabilité
    interne (le plancher de fréquence et le compteur de ratés). Les écritures
    Supabase, elles, portent chacune sur une ligne différente : un canal n'est
    jamais touché par deux fils.
    """

    def __init__(self, uid: str, run_id: str | None = None) -> None:
        self.uid = uid
        self.run_id = run_id or _maintenant()
        self._verrou = threading.Lock()
        self._derniere_etape: dict[str, float] = {}
        self._perdues = 0
        self._premier_rate_dit = False

    # ── L'écriture, et son unique porte de sortie ────────────────────────────

    def _ecrire(self, sb, canal: str, champs: dict) -> None:
        """Upsert d'une ligne d'état. Ne lève jamais, ne se tait jamais tout à fait."""
        ligne = {
            "user_id": self.uid,
            "canal": canal,
            "run_id": self.run_id,
            "maj_a": _maintenant(),
            **champs,
        }
        try:
            (sb.table("fetch_progress")
               .upsert(ligne, on_conflict="user_id,canal")
               .execute())
        except Exception as e:
            with self._verrou:
                self._perdues += 1
                premier = not self._premier_rate_dit
                self._premier_rate_dit = True
            if premier:
                # En entier une fois : c'est ce message qui dit si la migration
                # fetch_progress.sql a été jouée ou non.
                print(f"    suivi non écrit ({canal}) — {type(e).__name__}: {e}")

    def bilan(self) -> None:
        """À appeler en fin de passage. Ne dit rien s'il n'y a rien à dire."""
        if self._perdues:
            print(f"    suivi : {self._perdues} écriture(s) d'état perdue(s) — "
                  f"le panneau de récolte sera incomplet pour ce passage.")

    # ── Les transitions ──────────────────────────────────────────────────────

    def planifie(self, sb, canaux: list[str]) -> None:
        """Pose TOUS les canaux prévus à « attente », en une seule écriture.

        C'est ce geste qui répare l'état laissé par un worker mort en cours de
        route : un « en cours » figé du passage précédent est écrasé ici, avec
        un `run_id` neuf. L'écran n'a donc jamais à deviner l'âge d'une ligne
        pour savoir qu'elle est périmée — il lui suffit de ne lire que le
        `run_id` le plus récent.
        """
        if not canaux:
            return
        maintenant = _maintenant()
        lignes = [{"user_id": self.uid, "canal": c, "run_id": self.run_id,
                   "etat": "attente", "etape": None, "mot_de_fin": None,
                   "debut_a": None, "fin_a": None, "maj_a": maintenant}
                  for c in canaux]
        try:
            (sb.table("fetch_progress")
               .upsert(lignes, on_conflict="user_id,canal")
               .execute())
        except Exception as e:
            with self._verrou:
                self._perdues += len(lignes)
                self._premier_rate_dit = True
            print(f"    suivi non écrit (plan de récolte) — {type(e).__name__}: {e}")

    def saute(self, sb, canal: str, pourquoi: str) -> None:
        """« Ce canal n'a pas été appelé, et voici pourquoi. »

        Distinct d'un échec : un canal sauté ne se répare pas au même endroit
        (une connexion à brancher, pas une API qui refuse).
        """
        self._ecrire(sb, canal, {"etat": "saute", "mot_de_fin": pourquoi,
                                 "fin_a": _maintenant()})

    def commence(self, sb, canal: str) -> None:
        self._ecrire(sb, canal, {"etat": "en_cours", "debut_a": _maintenant()})

    def note(self, sb, canal: str, etape: str) -> None:
        """Une étape franchie DANS le canal. Jamais un pourcentage.

        Le nombre d'appels d'un canal n'est pas connu d'avance : annoncer 47 %
        serait un chiffre fabriqué. Un nom d'étape (« budgets », « insights »)
        est une position réelle dans une séquence écrite dans le code. Instagram
        est le seul à pouvoir chiffrer, parce que la liste des posts à relire est
        connue AVANT d'entrer dans la boucle.
        """
        with self._verrou:
            t = time.monotonic()
            if t - self._derniere_etape.get(canal, 0.0) < _INTERVALLE_ETAPE_S:
                return
            self._derniere_etape[canal] = t
        self._ecrire(sb, canal, {"etat": "en_cours", "etape": etape})

    def termine(self, sb, canal: str, etat: str, mot: str) -> None:
        """`etat` vaut 'fini' ou 'echec'. Le mot de la fin est celui du journal."""
        self._ecrire(sb, canal, {"etat": etat, "mot_de_fin": mot,
                                 "fin_a": _maintenant()})
