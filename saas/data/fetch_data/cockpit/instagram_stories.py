"""La récolte horaire des stories Instagram — chaque connexion Instagram, chaque heure.

    python3.12 saas/data/fetch_data/cockpit/instagram_stories.py               # toutes les connexions
    python3.12 saas/data/fetch_data/cockpit/instagram_stories.py --user UID    # un seul compte

Branchée sur `.github/workflows/instagram-stories.yml` (cron à la minute 17,
et à la main depuis l'onglet GitHub Actions). Spec
`.scratch/instagram-stories/spec.md` § La récolte : pour chaque connexion avec
un `instagram_business_id` et un jeton, les stories en ligne sont listées, les
nouvelles ajoutées avec leur vignette, celles de 20 h de vie ou plus relevées
(`sources/meta/instagram/stories.py`).

CE QU'ELLE NE FAIT PAS, exprès : ni `fetch_progress`, ni rapport, ni
vérification du jeton par `/debug_token` — le cron quotidien marque les jetons
morts ; ici, un jeton refusé est une ligne de journal, l'heure suivante
réessaie.

Deux connexions peuvent porter le même compte Instagram (constaté le
2026-11-25) : comme pour les posts, chaque `user_id` a ses lignes.

⚠ Écrit dans la vraie base.
"""
from __future__ import annotations

import argparse
import sys
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))

from saas.data.fetch_data.sources.meta.graph_client import AccesMeta  # noqa: E402
from saas.data.fetch_data.sources.meta.instagram import stories as recolte  # noqa: E402
from saas.data.fetch_data.sources.meta.instagram.fetchers.stories import masquer  # noqa: E402
from saas.data.supabase.source_data.instagram_stories import TableStoriesAbsente  # noqa: E402


def connexions(sb, seul: str | None = None) -> list[dict]:
    """Les connexions Instagram avec un jeton, une par (user_id, compte
    Instagram) : deux lignes identiques ne feraient que relire deux fois."""
    requete = (sb.table("connected_accounts")
               .select("user_id, instagram_business_id, meta_token")
               .not_.is_("instagram_business_id", "null"))
    if seul:
        requete = requete.eq("user_id", seul)
    vues, retenues = set(), []
    for c in requete.execute().data or []:
        cle = (c.get("user_id"), c.get("instagram_business_id"))
        if c.get("meta_token") and cle not in vues:
            vues.add(cle)
            retenues.append(c)
    return retenues


def passer(sb, lignes: list[dict], maintenant: datetime) -> tuple[list[str], int]:
    """Chaque connexion, chacune dans son `try` → (journal, connexions en erreur).

    Une connexion en erreur n'arrête pas les autres (spec § La récolte, point
    4). Une table absente, si : elle manquerait pour toutes.
    """
    journal, en_erreur = [], 0
    for c in lignes:
        jeton = c["meta_token"]
        debut = time.monotonic()
        try:
            mot = recolte.recolter(sb, c["user_id"], AccesMeta(
                jeton=jeton, instagram=c["instagram_business_id"]), maintenant).ligne()
        except TableStoriesAbsente:
            raise
        except Exception as e:
            # Une exception `requests` recopie l'URL appelée, jeton compris, et
            # Meta peut citer le jeton nu dans un message (`CLAUDE.md` §7).
            mot, en_erreur = masquer(f"stories KO: {type(e).__name__}: {e}", jeton), en_erreur + 1
        journal.append(f"{c['user_id']} (instagram {c['instagram_business_id']}) → "
                       f"{mot} [{time.monotonic() - debut:.0f} s]")
    return journal, en_erreur


def main(argv: list[str] | None = None, sb=None, maintenant: datetime | None = None) -> int:
    """→ code de sortie. 1 si la table manque, si tout a planté, ou si TOUTES
    les connexions sont en erreur (panne générale : secrets, API). Une seule
    connexion en erreur reste 0 : sinon un jeton mort rougirait le job 24 fois
    par jour, et l'alerte qui compte se noierait."""
    lecteur = argparse.ArgumentParser(description="La récolte horaire des stories Instagram.")
    lecteur.add_argument("--user", metavar="UID", help="un seul compte")
    args = lecteur.parse_args(argv)
    try:
        if sb is None:
            from saas.data.fetch_data.orchestration.concurrent_runner import client_service
            sb = client_service()
        maintenant = maintenant or datetime.now(timezone.utc)
        lignes = connexions(sb, args.user)
        print(f"[{maintenant:%Y-%m-%d %H:%M} UTC] {len(lignes)} connexion(s) Instagram · stories")
        journal, en_erreur = passer(sb, lignes, maintenant)
        for ligne in journal:
            print(f"  {ligne}")
        print("Terminé.")
    except TableStoriesAbsente as e:
        print(str(e))
        return 1
    except Exception:
        traceback.print_exc()
        return 1
    return 1 if lignes and en_erreur == len(lignes) else 0


if __name__ == "__main__":
    sys.exit(main())
