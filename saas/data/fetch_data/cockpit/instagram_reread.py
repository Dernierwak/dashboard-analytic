"""La relecture de tous les posts Instagram en base — sans image, sans rapport.

    python3.12 saas/data/fetch_data/cockpit/instagram_reread.py               # tous les comptes Instagram
    python3.12 saas/data/fetch_data/cockpit/instagram_reread.py --user UID    # un seul

Lancée à la main depuis l'onglet GitHub Actions (`weekly-fetch.yml`, drapeau
`relecture_instagram`) après la section 23 de la migration : c'est la
relecture unique (spec § La récolte — Ce qui s'ajoute, ticket 03 de
`.scratch/instagram-construction/`), et le même mode servira au trimestriel
(ticket 07). Chaque post en base est relu par le chemin du relevé
(`sync.relire_tous`) : 2 appels pour un Reel, 3 pour le fil.

CE QU'ELLE NE FAIT PAS, exprès : ni `fetch_progress` ni rapport — une ligne
`instagram` d'un `run_id` neuf ferait oublier l'échec Meta du Jour de travail
(`fetch_canaux_muets` ne lit que le dernier `run_id`, ticket 04).

⚠ Écrit dans la vraie base.
"""
from __future__ import annotations

import argparse
import sys
import time
import traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))

from saas.data.fetch_data.orchestration import account_sync as passage  # noqa: E402
from saas.data.fetch_data.orchestration import execution_plan as plans  # noqa: E402
from saas.data.fetch_data.orchestration.concurrent_runner import client_service  # noqa: E402
from saas.data.fetch_data.shared.http_client import sans_jeton  # noqa: E402
from saas.data.fetch_data.sources.meta.graph_client import AccesMeta  # noqa: E402
from saas.data.fetch_data.sources.meta.instagram import sync as recolte_instagram  # noqa: E402
from saas.data.supabase.source_data.account import marquer_a_reconnecter  # noqa: E402


def relire_compte(sb, uid: str) -> tuple[list[str], bool]:
    """Relit les posts de chaque connexion Instagram du compte → (journal, en panne ?)."""
    lignes = [a for a in passage.connexions(sb, uid)
              if a.get("meta_token") and a.get("instagram_business_id")]
    if not lignes:
        return [], False
    # `planifier` écarte un jeton mort sans appel, et son journal annonce la
    # connexion « marquée à reconnecter » : on la marque donc vraiment, sinon
    # la ligne mentirait. Zéro ligne touchée ne lève rien (`CLAUDE.md` §8) :
    # ça se dit.
    le_plan = plans.planifier(lignes, passage.verifier_jetons(lignes))
    journal = [mot for canal, mot in le_plan.journal if canal == "meta"]
    for connexion, raison in le_plan.a_marquer:
        if not marquer_a_reconnecter(sb, uid, connexion, raison):
            journal.append("meta: marquage à reconnecter NON écrit — 0 ligne touchée")
    panne = False
    for tache in (t for f in le_plan.fils for t in f if t.canal == "instagram"):
        c = tache.connexion
        debut = time.monotonic()
        try:
            mot = recolte_instagram.relire_tous(
                sb, uid, AccesMeta(jeton=c["meta_token"], instagram=c["instagram_business_id"]))
        except Exception as e:
            # Une exception `requests` recopie l'URL appelée, jeton compris
            # (`CLAUDE.md` §7) ; un compte qui tombe ne coupe pas les suivants.
            mot, panne = sans_jeton(f"relecture KO: {type(e).__name__}: {e}"), True
        journal.append(f"instagram relecture en {time.monotonic() - debut:.0f} s — {mot}")
    return journal, panne


def main(argv: list[str] | None = None, sb=None) -> int:
    lecteur = argparse.ArgumentParser(description="Relit tous les posts Instagram en base.")
    lecteur.add_argument("--user", metavar="UID", help="un seul compte")
    args = lecteur.parse_args(argv)
    try:
        sb = sb or client_service()
        profils = (sb.table("profiles").select("id").execute().data) or []
        if args.user:
            profils = [p for p in profils if p["id"] == args.user]
        passage.entete(len(profils), " · relecture Instagram")
        en_panne = False
        for p in profils:
            journal, panne = relire_compte(sb, p["id"])
            en_panne |= panne
            for ligne in journal:
                print(f"  {p['id']} → {ligne}")
        print("Terminé.")
    except Exception:
        traceback.print_exc()
        return 1
    return 1 if en_panne else 0


if __name__ == "__main__":
    sys.exit(main())
