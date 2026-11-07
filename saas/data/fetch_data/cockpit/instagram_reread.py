"""La relecture de tous les posts Instagram en base — sans image, sans rapport.

    python3.12 saas/data/fetch_data/cockpit/instagram_reread.py               # tous les comptes Instagram
    python3.12 saas/data/fetch_data/cockpit/instagram_reread.py --user UID    # un seul

Lancée à la main depuis l'onglet GitHub Actions (`weekly-fetch.yml`, drapeau
`relecture_instagram`) après la section 23 de la migration : c'est la
relecture unique (spec § La récolte — Ce qui s'ajoute, ticket 03 de
`.scratch/instagram-construction/`). Chaque post en base est relu par le
chemin du relevé (`sync.relire_tous`) : 2 appels pour un Reel, 3 pour le fil.

LE TRIMESTRIEL (ticket 07) : le cron (`scheduled_update.py`) appelle
`relire_si_du` pour chaque compte, chaque jour ; il ne relit que les
connexions dont `connected_accounts.relecture_instagram_le` date de 3 mois.
Une connexion à NULL n'est pas due : elle reçoit sa date au premier passage
complet réussi de son Jour de travail (`account_sync._appel`), qui vient de
tout relire de récent. La relecture de tout, d'un coup, reste le lancement à
la main (ticket 03), qui pose la date lui aussi.

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
from calendar import monthrange
from datetime import date, datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))

from saas.data.fetch_data.orchestration import account_sync as passage  # noqa: E402
from saas.data.fetch_data.orchestration import execution_plan as plans  # noqa: E402
from saas.data.fetch_data.orchestration.concurrent_runner import client_service  # noqa: E402
from saas.data.fetch_data.shared.http_client import sans_jeton  # noqa: E402
from saas.data.fetch_data.sources.meta.graph_client import AccesMeta  # noqa: E402
from saas.data.fetch_data.sources.meta.instagram import sync as recolte_instagram  # noqa: E402
from saas.data.supabase.source_data.account import (  # noqa: E402
    ColonneRelectureAbsente, dates_de_relecture_instagram, marquer_a_reconnecter,
    noter_relecture_instagram,
)


# Spec § La récolte — Ce qui s'ajoute, « La relecture » : « tous les 3 mois,
# tous les posts en base ». Des mois du calendrier, comme la spec les dit.
_TRIMESTRE_EN_MOIS = 3
_COLONNE_ABSENTE = ("instagram trimestriel: colonne connected_accounts.relecture_instagram_le "
                    "absente — lance saas/data/supabase/migrations/000_run_me_all.sql (§23)")


def trimestriel_du(derniere: str | None, maintenant: datetime) -> bool:
    """Le passage complet est-il dû ? `derniere` = la date lue en base.

    Jamais passé (NULL) → PAS dû (revue de code de instagram-construction) :
    après la section 23, toutes les connexions existantes sont à NULL, et
    « dû » les faisait toutes relire au premier cron. Sa date vient du premier
    passage complet réussi. Compté en JOURS, pas à la minute : le cron de
    07:00 UTC ne démarre pas toujours à la même minute, et un passage posé à
    07:12 ne doit pas repousser le suivant d'un jour entier parce que le cron
    de dans 3 mois démarre à 07:03.
    """
    if not derniere:
        return False
    jour = datetime.fromisoformat(derniere).date()
    return maintenant.date() >= _plus_mois(jour, _TRIMESTRE_EN_MOIS)


def _plus_mois(jour: date, mois: int) -> date:
    """`jour` + `mois` mois du calendrier ; le 31 août + 3 mois = le 30 novembre."""
    annees, rang = divmod(jour.month - 1 + mois, 12)
    annee, mois_vise = jour.year + annees, rang + 1
    return date(annee, mois_vise, min(jour.day, monthrange(annee, mois_vise)[1]))


def _connexions_instagram(sb, uid: str) -> list[dict]:
    return [a for a in passage.connexions(sb, uid)
            if a.get("meta_token") and a.get("instagram_business_id")]


def relire_si_du(sb, uid: str, maintenant: datetime) -> list[str]:
    """Le trimestriel du cron → les lignes du journal.

    Ne relit que les connexions dont le dernier passage complet, LU EN BASE,
    date de 3 mois ou plus (ou n'a jamais eu lieu). Une connexion en panne ne
    reçoit pas de date : elle sera reprise au cron suivant. Colonne absente →
    rien n'est relu : sans date lisible, le cron relirait tout chaque jour.
    """
    lignes = _connexions_instagram(sb, uid)
    if not lignes:
        return []
    try:
        dates = dates_de_relecture_instagram(sb, uid)
    except ColonneRelectureAbsente:
        return [_COLONNE_ABSENTE]
    dues = [c for c in lignes if trimestriel_du(dates.get(c["id"]), maintenant)]
    if not dues:
        return []
    journal, _ = _relire(sb, uid, dues, maintenant)
    return journal


def relire_compte(sb, uid: str, maintenant: datetime | None = None) -> tuple[list[str], bool]:
    """Relit les posts de chaque connexion Instagram du compte → (journal, en panne ?).

    Le lancement à la main (drapeau `relecture_instagram`) : dû ou non. C'est
    un passage complet, il pose donc sa date comme le trimestriel."""
    lignes = _connexions_instagram(sb, uid)
    if not lignes:
        return [], False
    return _relire(sb, uid, lignes, maintenant or datetime.now(timezone.utc))


def _relire(sb, uid: str, lignes: list[dict], maintenant: datetime) -> tuple[list[str], bool]:
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
        else:
            mot += _dater(sb, uid, c, maintenant)
        journal.append(f"instagram relecture en {time.monotonic() - debut:.0f} s — {mot}")
    return journal, panne


def _dater(sb, uid: str, connexion: dict, maintenant: datetime) -> str:
    """Pose la date du passage complet → ce que le journal doit en savoir.

    L'heure du DÉBUT du passage : un post publié pendant la relecture n'a pas
    été relu, la date ne doit pas prétendre le couvrir."""
    try:
        ecrite = noter_relecture_instagram(sb, uid, connexion["id"], maintenant)
    except ColonneRelectureAbsente:
        return " · date du passage NON écrite (colonne absente, §23)"
    return "" if ecrite else " · date du passage NON écrite — 0 ligne touchée"


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
