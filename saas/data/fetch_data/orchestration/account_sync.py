"""Le passage d'UN compte : plan, récolte en parallèle, relevé, rapport.

Les fonctions que `ScheduledUpdate` et `FullHistory` partagent — elles les
IMPORTENT, aucune ne les recopie (David, 2026-10-07 : « des class différentes
et les fonctions similaires les importent »). Ce qui distingue les deux classes
tient dans un seul argument, `depuis` : None pour reprendre là où la base
s'arrête (moins le recouvrement), une date pour tout reprendre depuis elle.

Aucun appel HTTP ici : ils vivent dans les fichiers d'API des plateformes.
Ce code vivait dans `run()` de `fetch_all.py` jusqu'au ticket 07 de
`.scratch/recolte/`.
"""
from __future__ import annotations

import os
from datetime import date, datetime

from saas.data.fetch_data.orchestration import error_reporter as alarmes
from saas.data.fetch_data.orchestration import execution_plan as plans
from saas.data.fetch_data.orchestration.concurrent_runner import executer
from saas.data.supabase.fetch_state.state import CANAUX, Suivi
from saas.data.fetch_data.sources.google.ads import sync as recolte_google
from saas.data.fetch_data.sources.google.analytics import sync as recolte_ga4
from saas.data.fetch_data.sources.meta.ads import sync as recolte_meta
from saas.data.fetch_data.sources.meta.graph_client import AccesMeta
from saas.data.fetch_data.sources.meta.instagram import sync as recolte_instagram
from saas.config.secrets import secret

_RANG = {c: i for i, c in enumerate(CANAUX)}


def avertir_secrets_google() -> None:
    """Sans ces secrets, le refresh du jeton Google échoue et TOUT Google Ads +
    GA4 est sauté en silence. On le dit fort une fois, en tête de run."""
    requis = {
        "GOOGLE_ADS_CLIENT_ID": "google_ads.client_id",
        "GOOGLE_ADS_CLIENT_SECRET": "google_ads.client_secret",
        "GOOGLE_ADS_DEVELOPER_TOKEN": "google_ads.developer_token",
    }
    manquants = []
    for env, chemin in requis.items():
        try:
            valeur = os.getenv(env) or secret(chemin)
        except Exception:
            valeur = None
        if not valeur:
            manquants.append(env)
    if manquants:
        print("!! ATTENTION - secrets Google absents : " + ", ".join(manquants)
              + " -> Google Ads et GA4 ne seront PAS mis a jour "
                "(a ajouter dans les secrets GitHub du repo).")


def entete(nb_profils: int, mode: str = "") -> None:
    print(f"[{datetime.utcnow():%Y-%m-%d %H:%M} UTC] {nb_profils} profils{mode}")


def connexions(sb, uid: str) -> list[dict]:
    """Toutes les connexions de l'utilisateur (Meta + Google) vivent dans
    connected_accounts. provider='google' porte les jetons Google (Ads + GA4)."""
    try:
        return sb.table("connected_accounts").select(
            "provider, meta_token, instagram_business_id, "
            "google_refresh_token, google_customer_id, ga4_property_id"
        ).eq("user_id", uid).execute().data or []
    except Exception:
        return []


def _appel(tache: plans.IngestionTask, uid: str, depuis: date | None):
    """La tâche du plan → `appel(sb, note) -> mot`, la forme qu'attend `fils._fil`."""
    c = tache.connexion
    if tache.canal == "meta":
        def meta(sb, note):
            try:
                return recolte_meta.recolter(sb, uid, c["meta_token"], note=note,
                                             since_forcee=depuis)
            except recolte_meta.SchemaEnRetard:
                # Un schéma en retard fait finir la run en ROUGE : la note se
                # prend ici, l'exception continue jusqu'au fil qui la journalise.
                alarmes.note_ecriture_sautee(uid)
                raise
        return meta
    if tache.canal == "instagram":
        return lambda sb, note: recolte_instagram.recolter(
            sb, uid, AccesMeta(jeton=c["meta_token"], instagram=c["instagram_business_id"]),
            note=note)
    if tache.canal == "google":
        return lambda sb, note: recolte_google.recolter(
            sb, uid, c["google_refresh_token"], c["google_customer_id"], note=note,
            depuis=depuis)
    if tache.canal == "ga4":
        return lambda sb, note: "ga4: " + str(recolte_ga4.recolter(
            sb, uid, refresh_token=c["google_refresh_token"],
            property_id=c["ga4_property_id"], since_date=depuis).get("message", ""))
    raise ValueError(f"canal inconnu du plan : {tache.canal}")


def republier(sb, uid: str) -> list[str]:
    """Republie le rapport depuis les données en base, sans rien récolter."""
    logs: list[str] = []
    try:
        from saas.data.supabase.processed_data.weekly_report.publisher import publish_weekly_report
        mot, muets = publish_weekly_report(sb, uid)
        logs.append(mot)
        alarmes.note_canaux_qui_durent(uid, muets)
    except Exception as e:
        logs.append(f"rapport KO: {e}")
    return logs


def passer(sb, uid: str, depuis: date | None = None) -> list[str]:
    """Le passage complet d'un compte → les lignes du journal, dans l'ordre de `CANAUX`.

    LE JOURNAL PORTE SON CANAL, il ne se devine pas : en parallèle, l'ordre
    d'exécution est celui des latences réseau. Chaque ligne est rangée avec son
    canal et le tout est trié dans l'ordre de `CANAUX` — le même que le
    panneau, de sorte que deux récoltes se comparent ligne à ligne.
    """
    logs: list[str] = []
    le_plan = plans.planifier(connexions(sb, uid))
    suivi = Suivi(uid)
    journal: list[tuple[int, str]] = [(_RANG[c], mot) for c, mot in le_plan.journal]

    # `planifie` pose tous les canaux prévus à « attente » avec un run_id neuf.
    # C'est aussi ce qui EFFACE un « en cours » laissé par un worker mort au
    # passage précédent : l'écran ne lit que le run_id le plus récent.
    suivi.planifie(sb, le_plan.prevus)
    for canal, pourquoi in le_plan.sautes:
        suivi.saute(sb, canal, pourquoi)

    fils = [[(t.canal, _appel(t, uid, depuis)) for t in f] for f in le_plan.fils]
    journal += [(_RANG.get(canal, len(CANAUX)), mot) for canal, mot in executer(fils, suivi)]

    # LE RAPPORT PART, ET IL DIT CE QU'IL N'A PAS PU LIRE (ticket 20). Il ne se
    # retient plus quand une écriture a été sautée : `build_payload` lit
    # `fetch_progress` (état `echec` du dernier passage), fait taire chaque
    # mesure dont la source est muette et publie le trou sous `canaux_muets` —
    # pour TOUTES les causes à la fois (jeton expiré, 500, limite de débit,
    # schéma en retard). Retenir ne couvrait qu'une cause sur cinq et privait
    # le client du seul message capable de lui dire de reconnecter
    # (`.scratch/construction/issues/20-rapport-publie-sur-un-canal-muet.md`).
    if le_plan.a_tente:
        suivi.commence(sb, "rapport")
        try:
            from saas.data.supabase.processed_data.weekly_report.publisher import publish_weekly_report
            mot, muets = publish_weekly_report(sb, uid)
            alarmes.note_canaux_qui_durent(uid, muets)
            journal.append((_RANG["rapport"], mot))
            suivi.termine(sb, "rapport", "fini", mot)
        except Exception as e:
            mot = f"rapport KO: {e}"
            journal.append((_RANG["rapport"], mot))
            suivi.termine(sb, "rapport", "echec", mot)

    # Tri STABLE sur le seul rang : deux lignes d'un même canal gardent l'ordre
    # où elles ont été produites.
    journal.sort(key=lambda r: r[0])
    suivi.bilan()
    return logs + [mot for _, mot in journal]
