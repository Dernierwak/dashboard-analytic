"""`/{ig-user}/stories` et `/{story-id}/insights` — les stories en ligne et leurs chiffres.

Spec `.scratch/instagram-stories/spec.md` § La récolte. Les appels et les
formes de réponse sont ceux de l'essai réel du 2026-11-25
(`.scratch/instagram-stories/issues/02`, `essai/essai_story.py`) : les douze
métriques demandées une par une ont toutes rendu `data[0].values[0].value`, et
`navigation` ventilée rend `total_value.breakdowns[0].results` avec
`dimension_values` = `["tap_forward"]`, `["tap_back"]`, `["tap_exit"]`,
`["swipe_forward"]`.

Ce fichier ne touche jamais Supabase : il rend ce que Meta a dit, et l'échec
quand il y en a un, sans jamais le jeton.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from saas.data.fetch_data.shared import http_client as http
from saas.data.fetch_data.shared.http_client import sans_jeton
from saas.data.fetch_data.sources.meta.graph_client import GRAPH, AccesMeta

_CHAMPS = "id,media_type,media_product_type,media_url,thumbnail_url,timestamp,permalink"

# Coupe-circuit de la pagination, pas une limite de produit : une boucle sans
# fin sur un curseur qui tourne à vide coûterait le passage de tous les autres
# comptes. 20 pages au défaut de Graph (25, non documenté pour cette edge) font
# 500 stories en ligne à la fois — l'essai en a vu 4.
_PAGES_MAX = 20

# Une métrique par appel (spec § La récolte, point 3) : un appel
# multi-métriques est refusé EN ENTIER dès qu'une seule l'est (erreur 100, vu
# sur les posts — `.scratch/instagram/issues/17`). Le nom Meta est le nom de la
# colonne ; `replies` n'est pas demandé : il rend 0 pour une story créée en
# Europe (essai, point 2 ; `docs/mesures-impossibles.md`).
METRIQUES = ("reach", "views", "shares", "total_interactions", "follows",
             "profile_visits", "link_clicks")
# `navigation` ventilée → une colonne par geste. Les quatre dimensions sont
# celles que l'essai a lues ; une autre, si Meta en ajoute, n'a pas de colonne.
NAVIGATION = {"tap_forward": "nav_tap_forward", "tap_back": "nav_tap_back",
              "tap_exit": "nav_tap_exit", "swipe_forward": "nav_swipe_forward"}
COLONNES = METRIQUES + tuple(NAVIGATION.values())

# « Not enough viewers » : selon la doc, Meta refuse les chiffres d'une story
# vue par moins de 5 comptes avec le code 10. L'essai ne l'a pas vu (aucune
# story sous 5 spectateurs) : c'est une absence mesurée, pas une panne.
CODE_PEU_DE_SPECTATEURS = 10


@dataclass
class Releve:
    """Les chiffres d'une story → `valeurs` (colonne → valeur ou None) et ce
    qui a échoué (`refus`, métrique → message sans jeton)."""
    valeurs: dict = field(default_factory=dict)
    refus: dict = field(default_factory=dict)
    codes: dict = field(default_factory=dict)

    def en_panne(self) -> bool:
        """Tout a été refusé, et pas pour « moins de 5 spectateurs » : jeton,
        limite ou réseau. Un relevé tout à NULL écraserait alors un relevé
        précédent qui avait des chiffres."""
        lues = len(METRIQUES) + 1
        return (len(self.refus) == lues
                and any(c != CODE_PEU_DE_SPECTATEURS for c in self.codes.values()))


def masquer(message: str, jeton: str) -> str:
    """`sans_jeton` ne masque le jeton que dans une URL (`access_token=…`). Un
    jeton NU dans un message d'erreur passait (essai hors ligne du 2026-11-25,
    `essai_story.py`) : sa valeur exacte est retirée en plus, où qu'elle soit."""
    propre = sans_jeton(message)
    return propre.replace(jeton, "…") if jeton else propre


def _lire(url: str, params: dict, jeton: str) -> tuple[dict | None, int | None, str | None]:
    """Un GET Graph → (objet, code d'erreur, message). Ne lève jamais.

    `graph_client.lire` jette le code d'erreur ; ici il sépare « moins de 5
    spectateurs » (10) d'une panne."""
    try:
        corps = http.get(url, params={**params, "access_token": jeton}, timeout=30).json()
    except Exception as e:
        return None, None, masquer(f"{type(e).__name__}: {e}", jeton)
    if not isinstance(corps, dict):
        return None, None, f"réponse Meta inattendue ({type(corps).__name__})"
    if corps.get("error"):
        err = corps["error"] if isinstance(corps["error"], dict) else {}
        return None, err.get("code"), masquer(err.get("message") or "erreur Meta", jeton)
    return corps, None, None


def recuperer(acces: AccesMeta) -> tuple[list[dict], list[str]]:
    """Les stories en ligne du compte → (stories, trous) — le contrat des
    fetchers (`fetch_data/CLAUDE.md`), sans fenêtre : Meta ne rend que les
    stories en ligne.

    `trous` vide quand la liste est ENTIÈRE ; une liste tronquée rend ce qui
    a été lu ET le dit. Pagination par le curseur `after`, jamais par l'URL
    `paging.next` : elle porte le jeton (spec § La récolte, point 1). La fin
    est l'absence de `next`, pas une page courte
    (https://developers.facebook.com/docs/graph-api/results)."""
    url = f"{GRAPH}/{acces.instagram}/stories"
    params = {"fields": _CHAMPS}
    stories: list[dict] = []
    for _ in range(_PAGES_MAX):
        data, _, err = _lire(url, params, acces.jeton)
        if err:
            if not stories:
                return [], [err]
            return stories, [f"liste tronquée à {len(stories)} story(s) : {err}"]
        lot = data.get("data") or []
        stories += lot
        paging = data.get("paging") or {}
        apres = (paging.get("cursors") or {}).get("after")
        if not lot or not paging.get("next") or not apres:
            return stories, []
        params = {"fields": _CHAMPS, "after": apres}
    return stories, [f"liste tronquée à {len(stories)} story(s) : {_PAGES_MAX} pages sans fin de curseur"]


def _valeur(item: dict):
    """La valeur d'une métrique, quelle que soit sa forme — None si absente.
    Un 0 rendu reste 0."""
    if item.get("value") is not None:
        return item["value"]
    valeurs = item.get("values") or []
    if valeurs and isinstance(valeurs[0], dict) and valeurs[0].get("value") is not None:
        return valeurs[0]["value"]
    total = item.get("total_value")
    return total.get("value") if isinstance(total, dict) else None


def _metrique(corps: dict, nom: str):
    for item in corps.get("data") or []:
        if item.get("name") == nom:
            return _valeur(item)
    return None


def _navigation(corps: dict) -> dict:
    """`navigation` ventilée → `{colonne: valeur}` ; une dimension absente vaut None."""
    ventilee = dict.fromkeys(NAVIGATION.values())
    for item in corps.get("data") or []:
        for b in (item.get("total_value") or {}).get("breakdowns") or []:
            for res in b.get("results") or []:
                dims = res.get("dimension_values") or []
                if len(dims) == 1 and dims[0] in NAVIGATION:
                    ventilee[NAVIGATION[dims[0]]] = res.get("value")
    return ventilee


def releve(acces: AccesMeta, story_id: str) -> Releve:
    """Les chiffres d'une story, une métrique par appel.

    Une métrique refusée ou rendue vide vaut None, jamais 0 (`CLAUDE.md` §7) ;
    elle ne fait pas tomber les autres."""
    url = f"{GRAPH}/{story_id}/insights"
    r = Releve()
    for nom in METRIQUES:
        corps, code, err = _lire(url, {"metric": nom}, acces.jeton)
        r.valeurs[nom] = None if err else _metrique(corps, nom)
        if err:
            r.refus[nom], r.codes[nom] = err, code
    corps, code, err = _lire(url, {"metric": "navigation", "metric_type": "total_value",
                                   "breakdown": "story_navigation_action_type"}, acces.jeton)
    r.valeurs.update(dict.fromkeys(NAVIGATION.values()) if err else _navigation(corps))
    if err:
        r.refus["navigation"], r.codes["navigation"] = err, code
    return r


def telecharger(url: str) -> bytes | None:
    """Le fichier d'une vignette, ou None. Le CDN de Meta le sert sans jeton
    (essai, point 4 : HTTP 200 sur `media_url` et `thumbnail_url`)."""
    try:
        r = http.get(url, timeout=30)
    except Exception:
        return None
    return r.content if r.status_code == 200 and r.content else None
