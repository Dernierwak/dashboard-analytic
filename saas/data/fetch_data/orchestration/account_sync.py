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
import time
from datetime import date, datetime

from saas.data.fetch_data.orchestration import error_reporter as alarmes
from saas.data.fetch_data.orchestration import execution_plan as plans
from saas.data.fetch_data.orchestration.concurrent_runner import executer
from saas.data.supabase.fetch_state.state import CANAUX, Suivi
from saas.data.fetch_data.shared.http_client import sans_jeton
from saas.data.fetch_data.shared.token_status import INCONNU, TokenStatus
from saas.data.fetch_data.sources.google.ads import sync as recolte_google
from saas.data.fetch_data.sources.google.auth import token as jeton_google
from saas.data.fetch_data.sources.google.analytics import sync as recolte_ga4
from saas.data.fetch_data.sources.meta.ads import sync as recolte_meta
from saas.data.fetch_data.sources.meta.auth import token as jeton_meta
from saas.data.fetch_data.sources.meta.graph_client import AccesMeta
from saas.data.fetch_data.sources.meta.instagram import releve_compte
from saas.data.fetch_data.sources.meta.instagram import sync as recolte_instagram
from saas.data.supabase.source_data.account import marquer_a_reconnecter
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
    connected_accounts. provider='google' porte les jetons Google (Ads + GA4).

    `id` et `a_reconnecter_depuis` servent au marquage d'un jeton mort : écrire
    sur la bonne ligne, et ne jamais écraser la date du premier constat."""
    try:
        return sb.table("connected_accounts").select(
            "id, provider, meta_token, instagram_business_id, "
            "google_refresh_token, google_customer_id, ga4_property_id, "
            "a_reconnecter_depuis"
        ).eq("user_id", uid).execute().data or []
    except Exception:
        return []


def verifier_jetons(lignes: list[dict]) -> dict[str, TokenStatus]:
    """L'état du jeton de chaque ligne, par `id` — AVANT le plan, qui le lit.

    Un appel par jeton (`/debug_token` Meta, un refresh Google). Le refresh
    Google est refait par `recolte_google.recolter` : un appel de plus, pour ne
    pas toucher au `sync.py` de Google Ads. Une exception inattendue n'est pas
    un jeton mort : INCONNU, rien ne sera marqué, et le message nomme le type
    d'erreur, jamais son texte — qui peut porter une URL avec le jeton.
    """
    etats: dict[str, TokenStatus] = {}
    for a in lignes:
        try:
            if a.get("meta_token"):
                etats[a["id"]] = jeton_meta.verifier(a["meta_token"])
            elif a.get("provider") == "google" and a.get("google_refresh_token"):
                etats[a["id"]] = jeton_google.verifier(a["google_refresh_token"])[0]
        except Exception as e:
            etats[a["id"]] = TokenStatus(INCONNU, f"vérification en erreur ({type(e).__name__})")
    return etats


def _marquer(sb, uid: str, le_plan: plans.ExecutionPlan) -> list[tuple[int, str]]:
    """Marque « à reconnecter » chaque ligne au jeton mort → lignes de journal
    pour celles qui n'ont pas pu l'être (la page Comptes ne le dirait pas)."""
    journal: list[tuple[int, str]] = []
    for connexion, raison in le_plan.a_marquer:
        canal = "meta" if connexion.get("meta_token") else "google"
        try:
            ecrit = marquer_a_reconnecter(sb, uid, connexion, raison)
            if not ecrit:
                journal.append((_RANG[canal], f"{canal}: marquage à reconnecter NON "
                                              f"écrit — 0 ligne touchée"))
        except Exception as e:
            journal.append((_RANG[canal], f"{canal}: marquage à reconnecter NON écrit "
                                          f"({type(e).__name__})"))
    return journal


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


def leger(sb, uid: str) -> list[str]:
    """Le passage léger quotidien d'un compte → les lignes du journal.

    Instagram seul, chaque jour, Jour de travail ou non (spec § La récolte —
    Ce qui s'ajoute) : relevé des posts jeunes, puis relevé du compte pour
    hier. Il NE TOUCHE NI À `fetch_progress` NI AU RAPPORT, exprès :
    `fetch_canaux_muets` et `lib/canaux-muets.ts` ne lisent que le dernier
    `run_id` — une ligne « instagram » d'un passage léger ferait oublier
    l'échec Meta du Jour de travail, et la page Meta comme le rapport se
    remettraient à montrer des chiffres troués. Le journal du worker suffit.

    La ligne porte la DURÉE du passage : c'est elle qui fixera la taille d'un
    bloc du Rattrapage (ticket 08 de `.scratch/instagram-construction/`).
    """
    lignes = [a for a in connexions(sb, uid)
              if a.get("meta_token") and a.get("instagram_business_id")]
    if not lignes:
        return []
    le_plan = plans.planifier(lignes, verifier_jetons(lignes))
    journal = [mot for canal, mot in le_plan.journal if canal == "meta"]
    journal += [mot for _, mot in _marquer(sb, uid, le_plan)]
    for tache in (t for f in le_plan.fils for t in f if t.canal == "instagram"):
        c = tache.connexion
        acces = AccesMeta(jeton=c["meta_token"], instagram=c["instagram_business_id"])
        debut = time.monotonic()
        # Les posts puis le compte (ticket 05), chacun dans son `try` : une
        # panne de l'inventaire n'empêche pas la journée d'hier du compte de
        # s'écrire, et inversement. Une seule ligne, une seule durée : c'est
        # le passage entier qui fixera le bloc du Rattrapage.
        mots = []
        for nom, relever in (("instagram léger", recolte_instagram.releve_quotidien),
                             ("compte", releve_compte.releve_du_compte)):
            try:
                mots.append(relever(sb, uid, acces))
            except Exception as e:
                # Un compte qui tombe ne coupe pas les suivants. Le type et le
                # texte passent par `sans_jeton` : une exception `requests`
                # recopie l'URL appelée, jeton compris (`CLAUDE.md` §7).
                mots.append(sans_jeton(f"{nom} KO: {type(e).__name__}: {e}"))
        journal.append(f"instagram léger en {time.monotonic() - debut:.1f} s — "
                       + " · ".join(mots))
    return journal


def passer(sb, uid: str, depuis: date | None = None) -> list[str]:
    """Le passage complet d'un compte → les lignes du journal, dans l'ordre de `CANAUX`.

    LE JOURNAL PORTE SON CANAL, il ne se devine pas : en parallèle, l'ordre
    d'exécution est celui des latences réseau. Chaque ligne est rangée avec son
    canal et le tout est trié dans l'ordre de `CANAUX` — le même que le
    panneau, de sorte que deux récoltes se comparent ligne à ligne.
    """
    logs: list[str] = []
    lignes = connexions(sb, uid)
    le_plan = plans.planifier(lignes, verifier_jetons(lignes))
    suivi = Suivi(uid)
    journal: list[tuple[int, str]] = [(_RANG[c], mot) for c, mot in le_plan.journal]
    journal += _marquer(sb, uid, le_plan)

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
