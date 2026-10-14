"""La mise à jour — le cron quotidien : chaque compte, le jour qu'il a choisi.

Branché sur `.github/workflows/weekly-fetch.yml` (07:00 UTC, tous les jours) :
pour chaque utilisateur dont c'est le Jour de travail (`profiles.fetch_schedule`),
reprend la récolte là où la base s'arrête, MOINS le recouvrement de chaque
plateforme (`shared/date_ranges.py`, pavé « LE RECOUVREMENT »), puis publie le
rapport. C'est le « ça marche sans moi ».

    python3.12 saas/data/fetch_data/cockpit/scheduled_update.py                 # le cron
    python3.12 saas/data/fetch_data/cockpit/scheduled_update.py --force         # tous, quel que soit le jour
    python3.12 saas/data/fetch_data/cockpit/scheduled_update.py --user UID      # un compte, sans attendre son jour
    python3.12 saas/data/fetch_data/cockpit/scheduled_update.py --report-only UID   # republie le rapport, ~30 s

⚠ Écrit dans la vraie base. Pour vérifier sans rien écrire :
`check_data_collection.py`.

Variables d'env requises :
  SUPABASE_URL            (sinon lu dans .env [supabase].url)
  SUPABASE_SERVICE_KEY    (clé service_role — bypass RLS pour lire tous les users)
  GOOGLE_ADS_*            (client_id, client_secret, developer_token) pour Google

Remplace, avec `full_history.py`, `automatisation/fetch_all.py` (ticket 07
de `.scratch/recolte/`).
"""
from __future__ import annotations

import argparse
import sys
import traceback
from datetime import datetime
from pathlib import Path

# Racine du dépôt sur le path : le script se lance par son chemin.
sys.path.insert(0, str(Path(__file__).resolve().parents[4]))

from saas.data.fetch_data.orchestration import account_sync as passage  # noqa: E402
from saas.data.fetch_data.orchestration import error_reporter as alarmes  # noqa: E402
from saas.data.fetch_data.orchestration.concurrent_runner import client_service  # noqa: E402


def _due_today(fetch_schedule: str | None) -> bool:
    """True si c'est le jour de mise à jour de l'utilisateur.
    Pas de jour défini → on prend lundi par défaut (évite de fetch tous les jours)."""
    today = datetime.utcnow().strftime("%A")  # 'Monday', ...
    return (fetch_schedule or "Monday") == today


class ScheduledUpdate:
    """Reprend chaque compte dû là où sa base s'arrête, moins le recouvrement."""

    def __init__(self, force: bool = False, seul: str | None = None,
                 rapport_seulement: bool = False) -> None:
        self.force = force or bool(seul)      # un seul compte : pas d'attente de son jour
        self.seul = seul
        self.rapport_seulement = rapport_seulement

    def executer(self) -> None:
        sb = client_service()
        profils = (sb.table("profiles").select("id, fetch_schedule").execute().data) or []
        if self.seul:
            profils = [p for p in profils if p["id"] == self.seul]
        passage.entete(len(profils), " · rapport seulement" if self.rapport_seulement else "")
        if not self.rapport_seulement:
            passage.avertir_secrets_google()

        for p in profils:
            uid = p["id"]
            if not self.force and not _due_today(p.get("fetch_schedule")):
                continue
            # `rapport_seulement` : republie juste le rapport à partir des
            # données déjà en base (aucun appel aux plateformes). Aucun bouton
            # de l'app ne le déclenche ; c'est un mode de VÉRIFICATION, lancé
            # depuis l'onglet GitHub Actions.
            logs = (passage.republier(sb, uid) if self.rapport_seulement
                    else passage.passer(sb, uid, depuis=None))
            if logs:
                print(f"  {uid} → " + " | ".join(logs))
        print("Terminé.")


def main(argv: list[str] | None = None) -> int:
    lecteur = argparse.ArgumentParser(description="La mise à jour quotidienne.")
    lecteur.add_argument("--force", action="store_true",
                         help="ignore le Jour de travail : tous les comptes")
    lecteur.add_argument("--user", metavar="UID", help="un seul compte, sans attendre son jour")
    lecteur.add_argument("--report-only", metavar="UID",
                         help="republie le rapport de ce compte, sans rien récolter")
    args = lecteur.parse_args(argv)
    try:
        ScheduledUpdate(force=args.force, seul=args.report_only or args.user,
                        rapport_seulement=bool(args.report_only)).executer()
    except Exception:
        traceback.print_exc()
        return 1
    return 1 if alarmes.signaler() else 0


if __name__ == "__main__":
    sys.exit(main())
