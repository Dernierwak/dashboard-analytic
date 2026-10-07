"""L'exécution en parallèle : trois fils, chacun ses canaux en série et son client.

`executer(fils, suivi)` rend le journal `[(canal, mot)]` et ne lève jamais : un
canal qui tombe n'emporte pas les autres. Ce module vivait dans `fetch_all.py`
jusqu'au ticket 07 de `.scratch/recolte/`.
"""
from __future__ import annotations

import os
from concurrent.futures import ThreadPoolExecutor

from supabase import create_client

from saas.collecte.automatisation.suivi import Suivi
from saas.collecte.socle.http import sans_jeton
from saas.commun.app_secrets import secret

# ═══ LA RÉCOLTE EN PARALLÈLE — trois fils, et le compte est fait ══════════════
#
# Ce sont des appels réseau qui ATTENDENT : le GIL n'entre pas en jeu, des fils
# suffisent. Restaient trois questions, et deux d'entre elles ont changé la
# forme retenue.
#
# ① LE CLIENT SUPABASE EST-IL SÛR ENTRE PLUSIEURS FILS ? Pas tout à fait, et ça
#    se lit dans la bibliothèque installée (supabase 2.27.2 / httpx 0.28.1) :
#     · CE QUI EST SÛR — `postgrest/_sync/request_builder.py` construit un objet
#       `Headers` NEUF par requête et n'écrit jamais dans l'état partagé ; et le
#       transport `httpx` s'appuie sur `httpcore`, dont `ConnectionPool` protège
#       sa liste de connexions par un `ThreadLock` et dont les connexions HTTP/2
#       portent quatre verrous (`_init_lock`, `_state_lock`, `_read_lock`,
#       `_write_lock`). Deux `.execute()` simultanés ne se marchent pas dessus.
#     · CE QUI NE L'EST PAS — `supabase/_sync/client.py` construit ses
#       sous-clients PARESSEUSEMENT, en `if self._postgrest is None: … = …`,
#       SANS verrou. Trois fils qui touchent le même client au même instant pour
#       la PREMIÈRE fois en fabriquent chacun un, avec chacun son pool de
#       connexions ; deux sont abandonnés sans jamais être fermés. Même schéma
#       sur `.storage`, que la récolte Instagram utilise pour les images.
#    La réponse n'est donc PAS nette, et on ne parie pas : **un client par fil**,
#    créé dans le fil. Le coût est nul en réseau — `create_client` ne fait aucun
#    aller-retour (la session est lue dans un stockage mémoire vide) — et il
#    supprime la question au lieu de l'arbitrer.
#
# ② META ADS ET INSTAGRAM TAPENT LA MÊME API AVEC LE MÊME JETON. Les séparer
#    rapporte quoi, exactement ? La mesure de la veille, en appels par récolte :
#    Meta ~5-6, Google ~5-6, GA4 ~5, **Instagram 100 à 130**. Sur ~131 appels au
#    total, le chemin le plus long vaut 120 en trois fils (Meta+Instagram) contre
#    115 en quatre. Séparer Meta d'Instagram gagne donc ~4 % du chemin critique,
#    en échange d'une contention sur les compteurs de débit de Meta que personne
#    ici ne peut mesurer sans jeton. Un gain de 4 % ne s'achète pas avec un
#    risque non mesurable : **trois fils**.
#      · fil 1 — Meta Ads puis Instagram, EN SÉRIE ;
#      · fil 2 — Google Ads ;
#      · fil 3 — GA4.
#    (Google Ads et GA4 partagent le jeton Google mais pas l'API ni le quota :
#     l'un parle à googleads.googleapis.com, l'autre à analyticsdata.)
#
# ③ CE QUE ÇA FAIT GAGNER, HONNÊTEMENT. Instagram pèse 115 appels sur 131, soit
#    88 % du total. La loi d'Amdahl plafonne donc l'accélération à 1 / 0,88 =
#    1,14× — **environ 12 % au mieux, ~8 % avec la forme retenue**. Et l'appel
#    n'est qu'un PROXY grossier de la durée : le téléchargement d'image puis
#    l'envoi au stockage que fait Instagram durent bien plus qu'un GET Graph, ce
#    qui rend Instagram encore plus dominant, donc le gain encore plus petit.
#    Le vrai levier était ailleurs, et il est dans l'inventaire Instagram
#    (`meta/organique/instagram/posts.py`).
#
# UNE PLATEFORME QUI ÉCHOUE N'EMPORTE PAS LES AUTRES : chaque canal est attrapé
# dans son fil. Et le journal est TRIÉ À L'ARRIVÉE dans l'ordre de `CANAUX` —
# en parallèle, l'ordre d'exécution n'est plus un ordre, c'est le hasard des
# latences.
_FILS_MAX = 3


def client_service():
    url = os.getenv("SUPABASE_URL") or secret("supabase.url")
    # Le `.env` racine nomme la clé SUPABASE_SERVICE_ROLE_KEY (nom Supabase) ;
    # GitHub Actions la passe en SUPABASE_SERVICE_KEY. Sans le troisième nom,
    # l'essai lancé en local ne trouvait pas la clé pourtant présente.
    key = (os.getenv("SUPABASE_SERVICE_KEY") or secret("supabase.service_role")
           or secret("supabase.service_role_key"))
    if not url or not key:
        raise RuntimeError("SUPABASE_URL / SUPABASE_SERVICE_KEY manquants (env ou secrets.toml).")
    return create_client(url, key)


def _fil(taches: list, suivi: Suivi) -> list[tuple[str, str]]:
    """Un fil d'exécution : ses canaux joués EN SÉRIE, avec son PROPRE client.

    `taches` : [(canal, appel)] où `appel(sb, note) -> str` rend le mot de la fin.
    Retour   : [(canal, mot)] — jamais d'exception, quoi qu'il arrive dedans.

    Le client Supabase est créé ICI, dans le fil, et pas partagé : voir la note
    « LA RÉCOLTE EN PARALLÈLE » plus haut, point ①.
    """
    try:
        sb_fil = client_service()
    except Exception as e:
        # Sans client, ce fil ne peut RIEN faire — pas même écrire son propre
        # état, puisque l'écrire demanderait justement un client. Les lignes de
        # suivi restent donc à « attente » ; l'écran les lira comme
        # interrompues, ce qu'elles sont. Le journal, lui, dit pourquoi.
        return [(canal, sans_jeton(f"{canal} KO: client Supabase indisponible "
                                   f"({type(e).__name__}: {e})"))
                for canal, _ in taches]

    sorties: list[tuple[str, str]] = []
    for canal, appel in taches:
        suivi.commence(sb_fil, canal)
        try:
            mot = appel(sb_fil, lambda etape, c=canal: suivi.note(sb_fil, c, etape))
            sorties.append((canal, mot))
            suivi.termine(sb_fil, canal, "fini", mot)
        except Exception as e:
            # Le canal tombe, les deux autres fils continuent. C'est tout
            # l'intérêt d'attraper ici plutôt qu'autour de l'executor.
            #
            # ET C'EST ICI QUE LE JETON SORTIRAIT. Ce `mot` ne fait pas que
            # s'imprimer dans un journal public : `suivi.termine` l'écrit dans
            # `fetch_progress.mot_de_fin`, que l'app relit et montre. Une
            # exception `requests` recopie l'URL appelée, jeton compris — le
            # `refresh_token` Google autant que le jeton Meta. Sans ce filtre,
            # une coupure réseau publie un jeton de `connected_accounts` à
            # tout membre invité du compte (`CLAUDE.md` §7).
            mot = sans_jeton(f"{canal} KO: {e}")
            sorties.append((canal, mot))
            suivi.termine(sb_fil, canal, "echec", mot)
    return sorties


def executer(fils: list[list], suivi: Suivi) -> list[tuple[str, str]]:
    """Les fils en parallèle (au plus `_FILS_MAX`) → `[(canal, mot)]`.

    `map` rend les résultats DANS L'ORDRE DES FILS, pas dans l'ordre où ils
    finissent — mais chaque ligne porte son canal, donc l'ordre du journal ne
    dépend pas de celui-là.
    """
    sorties: list[tuple[str, str]] = []
    if not fils:
        return sorties
    with ThreadPoolExecutor(max_workers=min(_FILS_MAX, len(fils))) as ex:
        for lot in ex.map(lambda f: _fil(f, suivi), fils):
            sorties += lot
    return sorties
