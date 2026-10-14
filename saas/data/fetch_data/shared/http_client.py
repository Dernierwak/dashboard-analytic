"""Le seul chemin HTTP de la récolte : timeout obligatoire, limites de débit réessayées.

POURQUOI UN SEUL CHEMIN. Chaque plateforme appelait `requests` à la main, et
chacune oubliait autre chose : quatre appels Instagram n'avaient pas de
`timeout` (un serveur muet tenait le worker jusqu'au plafond de 6 h du job
GitHub Actions), et une limite de débit faisait perdre la tranche entière, sans
nouvel essai. Ici, ces deux règles ne s'oublient plus.

CE QUI SE RÉESSAIE, ET RIEN D'AUTRE :
 · HTTP 429 et 5xx ;
 · une limite de débit Meta, que Graph rend dans le CORPS avec un code
   d'erreur, pas forcément en 429. Les codes sont ceux de la doc :
   https://developers.facebook.com/docs/graph-api/overview/rate-limiting/
   (lue le 2026-10-07) — plateforme 4, 17, 32, 613 ; Business Use Case 80000
   (Ads Insights), 80001 (Pages), 80002 (Instagram), 80003, 80004 (Ads
   Management), 80005, 80006, 80008, 80009, 80014.
Une exception réseau (coupure, timeout) n'est PAS réessayée : elle remonte à
l'appelant comme avant, qui en fait un trou nommé.

AU BOUT DES ESSAIS, LA DERNIÈRE RÉPONSE EST RENDUE, pas une exception neuve :
l'appelant lit déjà les erreurs dans la réponse et en fait un trou nommé
(ticket 01). Lever ici changerait ce contrat dans chaque fichier d'API.

POURQUOI UNE SESSION PAR FIL, ET PAS UNE SEULE. `requests` ne garantit pas
qu'une `Session` se partage entre fils ; la recommandation des mainteneurs est
« one Session per thread » (https://github.com/psf/requests/issues/2766). La
récolte tourne en trois fils (`automatisation/concurrent_runner.py`) : on ne parie pas,
`threading.local` en donne une à chacun. La Session garde la connexion ouverte
entre deux appels au même hôte — c'est son seul intérêt ici, le gain n'est pas
mesuré.
"""
from __future__ import annotations

import json
import re
import threading
import time
from urllib.parse import urlparse

import requests

# Quatre tentatives en tout : 2 + 4 + 8 = 14 s d'attente au pire sans
# indication du serveur. Au-delà, une limite qui dure n'est plus passagère et
# la tranche devient un trou nommé, rattrapé par le recouvrement suivant.
_TENTATIVES_MAX = 4
_ATTENTE_BASE_S = 2.0
# Une attente annoncée plus longue que ça ne s'attend pas : Meta compte
# `estimated_time_to_regain_access` en MINUTES, et bloquer un fil une demi-heure
# retarde aussi les canaux qui le suivent en série (Instagram derrière Meta).
_ATTENTE_MAX_S = 60.0

_CODES_LIMITE_META = {4, 17, 32, 613, 80000, 80001, 80002, 80003, 80004,
                      80005, 80006, 80008, 80009, 80014}
_HOTE_META = "graph.facebook.com"

_dormir = time.sleep
_local = threading.local()

_JETON_DANS_UNE_URL = re.compile(
    r"((?:access_token|appsecret_proof|refresh_token|token)=)[^&\s)\"']*", re.I)


def sans_jeton(message: str) -> str:
    """Un message d'erreur nomme la variable, jamais sa valeur — `CLAUDE.md` §7.

    CE N'EST PAS UNE PRÉCAUTION THÉORIQUE. `requests` construit l'URL complète
    avant de se connecter et la RECOPIE dans l'exception :

        ConnectionError : HTTPSConnectionPool(host='graph.facebook.com', …):
        Max retries exceeded with url: /v24.0/act_42/campaigns?access_token=EAA…

    Et le curseur `paging.next` de Meta porte le jeton par construction. Sans
    ce filtre, une coupure réseau pendant une récolte écrit le jeton Meta d'un
    client EN CLAIR dans le journal de run de GitHub Actions, qui est public.
    """
    return _JETON_DANS_UNE_URL.sub(r"\1…", message)


def _session() -> requests.Session:
    s = getattr(_local, "session", None)
    if s is None:
        s = _local.session = requests.Session()
    return s


def get(url: str, *, timeout: float, params: dict | None = None,
        headers: dict | None = None) -> requests.Response:
    """GET avec nouvel essai sur limite de débit. `timeout` n'a pas de défaut :
    c'est l'oubli qu'on veut rendre impossible."""
    return _avec_essais("GET", url, timeout=timeout, params=params, headers=headers)


def post(url: str, *, timeout: float, headers: dict | None = None,
         json: dict | None = None, data: dict | None = None) -> requests.Response:
    """POST avec nouvel essai. Les POST de la récolte sont des LECTURES
    (searchStream Google Ads, runReport GA4, rafraîchissement OAuth) : les
    rejouer n'écrit rien deux fois."""
    return _avec_essais("POST", url, timeout=timeout, headers=headers,
                        json=json, data=data)


def _avec_essais(methode: str, url: str, **kwargs) -> requests.Response:
    for tentative in range(1, _TENTATIVES_MAX + 1):
        reponse = _session().request(methode, url, **kwargs)
        if not _limite_atteinte(url, reponse) or tentative == _TENTATIVES_MAX:
            return reponse
        attente = _attente_annoncee(reponse)
        if attente is None:
            attente = _ATTENTE_BASE_S * 2 ** (tentative - 1)
        if attente > _ATTENTE_MAX_S:
            return reponse
        _dormir(attente)
    return reponse


def _limite_atteinte(url: str, reponse: requests.Response) -> bool:
    if reponse.status_code == 429 or reponse.status_code >= 500:
        return True
    return _code_erreur_meta(url, reponse) in _CODES_LIMITE_META


def _code_erreur_meta(url: str, reponse: requests.Response) -> int | None:
    # On ne relit que les corps qui COMMENCENT par l'objet `error` : une page
    # d'insights de 500 lignes n'est pas parsée une deuxième fois pour rien.
    if urlparse(url).hostname != _HOTE_META:
        return None
    if not reponse.content.lstrip()[:10].startswith(b'{"error"'):
        return None
    try:
        return int(reponse.json()["error"]["code"])
    except (ValueError, KeyError, TypeError):
        return None


def _attente_annoncee(reponse: requests.Response) -> float | None:
    """L'attente que le serveur annonce, en secondes, ou None s'il ne dit rien.

    `Retry-After` (secondes) chez Google ; chez Meta, la doc ne parle d'aucun
    `Retry-After` mais d'`estimated_time_to_regain_access`, en MINUTES, dans
    l'en-tête `X-Business-Use-Case-Usage` (même page que plus haut).
    """
    brut = reponse.headers.get("Retry-After")
    if brut:
        try:
            return float(brut)
        except ValueError:
            pass   # une date HTTP : rare, on retombe sur l'attente croissante
    buc = reponse.headers.get("X-Business-Use-Case-Usage")
    if buc:
        try:
            minutes = [u.get("estimated_time_to_regain_access") or 0
                       for usages in json.loads(buc).values() for u in usages]
        except (ValueError, AttributeError, TypeError):
            return None
        if minutes and max(minutes) > 0:
            return max(minutes) * 60.0
    return None
