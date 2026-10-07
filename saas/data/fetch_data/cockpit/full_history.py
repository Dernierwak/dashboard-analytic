"""La récolte complète — tout l'historique d'UN compte, depuis une date.

    python3.12 saas/data/fetch_data/cockpit/full_history.py --user UID
    python3.12 saas/data/fetch_data/cockpit/full_history.py --user UID --depuis 2025-01-01

Elle remplace `--meta-since` (rejeu Meta seul) et l'étend : Meta Ads, Google Ads
et GA4 repartent tous de `--depuis`. Elle importe EXACTEMENT les mêmes fonctions
que la mise à jour (`automatisation/account_sync.py`) ; seule la date de départ change.

⚠ Écrit dans la vraie base et publie le rapport. Pour vérifier sans rien
écrire : `check_data_collection.py`.

LA PROFONDEUR PAR DÉFAUT : 37 MOIS, et ce n'est une limite que chez Meta.
« The start date of the time range cannot be beyond 37 months from the current
date » — c'est `_PROFONDEUR_META_JOURS` (`meta/ads/sync.py`). Google Ads ne
documente aucun plafond sur `segments.date`, et GA4 n'a pas été essayé au-delà
(pas de jeton ici) : une tranche refusée y deviendrait un trou NOMMÉ (ticket 01),
pas un silence. Une seule date pour toutes les plateformes garde un historique
aligné ; elle se choisit plus courte avec `--depuis`.

CE QUI NE BOUGE PAS AVEC `--depuis` :
  · `change_event` de Google garde ses 30 jours — une fenêtre plus large y fait
    rejeter la requête ENTIÈRE (`google/ads/sync.py`) ;
  · les activités Meta gardent leurs 180 jours (`_CHANGES_JOURS_META`) ;
  · Instagram relit son inventaire entier à chaque passage, borné en posts.

UN REJEU META INCOMPLET NE S'ÉCRIT PAS (`meta/ads/sync.py`) : sur une tranche
refusée, rien n'est écrit et la run est rouge — on relance la même commande.

ELLE NE REPREND PAS LÀ OÙ ELLE S'EST ARRÊTÉE, et c'est voulu (ticket 07 de
`.scratch/recolte/`). Toutes les écritures sont des upserts sur la clé de chaque
table : relancer la même commande réécrit les mêmes lignes, sans doublon. Un
état « fait jusqu'au … » à tenir à jour coûterait une table et un cas de plus à
vérifier, pour un gain que le décompte ne justifie pas : 37 mois de régies,
c'est ~65 requêtes et quelques minutes (`socle/date_ranges.py`, pavé PROFONDEUR
D'HISTORIQUE) ; le poste long est Instagram, qui ne dépend pas de `--depuis`.
"""
from __future__ import annotations

import argparse
import sys
import traceback
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))

from saas.data.fetch_data.orchestration import account_sync as passage  # noqa: E402
from saas.data.fetch_data.orchestration import error_reporter as alarmes  # noqa: E402
from saas.data.fetch_data.orchestration.concurrent_runner import client_service  # noqa: E402
from saas.data.fetch_data.sources.meta.ads.sync import _PROFONDEUR_META_JOURS  # noqa: E402
from saas.data.fetch_data.shared.date_ranges import date_forcee  # noqa: E402


class FullHistory:
    """Reprend UN compte depuis `depuis` (37 mois par défaut), toutes plateformes."""

    def __init__(self, uid: str, depuis: date | None = None) -> None:
        self.uid = uid
        self.depuis = depuis or (date.today() - timedelta(days=_PROFONDEUR_META_JOURS))

    def executer(self) -> None:
        sb = client_service()
        profils = [p for p in ((sb.table("profiles").select("id").execute().data) or [])
                   if p["id"] == self.uid]
        passage.entete(len(profils), f" · récolte complète depuis le {self.depuis}")
        passage.avertir_secrets_google()
        for p in profils:
            logs = passage.passer(sb, p["id"], depuis=self.depuis)
            if logs:
                print(f"  {p['id']} → " + " | ".join(logs))
        print("Terminé.")


def main(argv: list[str] | None = None) -> int:
    lecteur = argparse.ArgumentParser(description="La récolte complète d'un compte.")
    # UN REJEU VISE UN COMPTE, ET CE N'EST PAS UNE COQUETTERIE : sans compte
    # désigné, il forcerait le passage de TOUS les profils. Un rejeu
    # d'historique ne doit pas pouvoir réécrire toute la clientèle.
    lecteur.add_argument("--user", metavar="UID", required=True)
    lecteur.add_argument("--depuis", metavar="AAAA-MM-JJ",
                         help=f"date de départ (défaut : {_PROFONDEUR_META_JOURS} jours, "
                              "la limite de Meta)")
    args = lecteur.parse_args(argv)
    if not args.user.strip():
        # Le workflow passe `--user ""` quand l'entrée est vide.
        print("!! --user est vide : la récolte complète vise UN compte.")
        return 1
    depuis = None
    if args.depuis:
        try:
            depuis = date_forcee(args.depuis, date.today(), _PROFONDEUR_META_JOURS)
        except ValueError as e:
            print(f"!! --depuis : {e}")
            return 1
    try:
        FullHistory(args.user, depuis).executer()
    except Exception:
        traceback.print_exc()
        return 1
    return 1 if alarmes.signaler() else 0


if __name__ == "__main__":
    sys.exit(main())
