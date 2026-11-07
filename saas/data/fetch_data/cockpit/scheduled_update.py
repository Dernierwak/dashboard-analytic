"""La mise à jour — le cron quotidien : chaque compte, le jour qu'il a choisi.

Branché sur `.github/workflows/weekly-fetch.yml` (07:00 UTC, tous les jours) :
pour chaque utilisateur dont c'est le Jour de travail (`profiles.fetch_schedule`),
reprend la récolte là où la base s'arrête, MOINS le recouvrement de chaque
plateforme (`shared/date_ranges.py`, pavé « LE RECOUVREMENT »), puis publie le
rapport. C'est le « ça marche sans moi ».

Chaque jour aussi, pour TOUS les comptes Instagram, le passage léger
(`account_sync.leger`) : relevé des posts de moins de 8 × 24 h et fiche des
posts neufs, sans rapport ni `fetch_progress` ; puis le trimestriel
(`instagram_reread.relire_si_du`) pour les connexions dont le dernier passage
complet date de 3 mois.

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
from datetime import datetime, timezone
from pathlib import Path

# Racine du dépôt sur le path : le script se lance par son chemin.
sys.path.insert(0, str(Path(__file__).resolve().parents[4]))

from saas.data.fetch_data.cockpit import instagram_reread  # noqa: E402
from saas.data.fetch_data.orchestration import account_sync as passage  # noqa: E402
from saas.data.fetch_data.orchestration import error_reporter as alarmes  # noqa: E402
from saas.data.fetch_data.orchestration.concurrent_runner import client_service  # noqa: E402


def _due_today(fetch_schedule: str | None, aujourdhui: datetime | None = None) -> bool:
    """True si c'est le jour de mise à jour de l'utilisateur.
    Pas de jour défini → on prend lundi par défaut (évite de fetch tous les jours)."""
    today = (aujourdhui or datetime.now(timezone.utc)).strftime("%A")  # 'Monday', ...
    return (fetch_schedule or "Monday") == today


class ScheduledUpdate:
    """Reprend chaque compte dû là où sa base s'arrête, moins le recouvrement ;
    et chaque jour, pour tous, le passage léger Instagram."""

    def __init__(self, force: bool = False, seul: str | None = None,
                 rapport_seulement: bool = False,
                 aujourdhui: datetime | None = None) -> None:
        self.force = force or bool(seul)      # un seul compte : pas d'attente de son jour
        self.seul = seul
        self.rapport_seulement = rapport_seulement
        self.aujourdhui = aujourdhui

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
            # LE PASSAGE LÉGER, TOUS LES JOURS ET POUR TOUS (spec § La récolte —
            # Ce qui s'ajoute) : sinon un post du mardi attendrait le Jour de
            # travail pour son premier relevé, et ses J+0…J+7 seraient perdus.
            # Le Jour de travail aussi : le léger garantit le relevé du jour
            # même si la récolte complète tombe en panne. Il passe
            # AVANT le complet et ne touche pas au rapport. `rapport_seulement`
            # n'appelle aucune plateforme : pas de léger.
            # LE TRIMESTRIEL, juste après : tous les posts en base, tous les
            # 3 mois, sur la date du dernier passage complet lue en base
            # (`instagram_reread.relire_si_du`). Avant le complet du Jour de
            # travail : un compte sans aucun post relit 0 post et reçoit sa
            # date, au lieu de relire dès le lendemain tout ce que sa première
            # récolte vient d'écrire.
            if not self.rapport_seulement:
                for ligne in passage.leger(sb, uid):
                    print(f"  {uid} → {ligne}")
                maintenant = self.aujourdhui or datetime.now(timezone.utc)
                for ligne in instagram_reread.relire_si_du(sb, uid, maintenant):
                    print(f"  {uid} → {ligne}")
            if not self.force and not _due_today(p.get("fetch_schedule"), self.aujourdhui):
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
