"""L'API Graph de Meta : un appel, une pagination, et ce qu'il faut pour se connecter.

Meta Ads et Instagram parlent tous les deux à `graph.facebook.com` avec le même
jeton. La pagination y était écrite cinq fois (`_meta_chunk`,
`_meta_campagnes`, `_pages`, `fetch_activities`, l'inventaire Instagram), et
chaque copie avait oublié autre chose : un plafond de pages ici, la page vide
qui tourne à vide là, l'objet `error` rendu en HTTP 200 ailleurs. Elle n'existe
plus qu'ici.
"""
from __future__ import annotations

from dataclasses import dataclass

from saas.collecte.socle import http
from saas.collecte.socle.http import sans_jeton

GRAPH = "https://graph.facebook.com/v24.0"


@dataclass(frozen=True)
class AccesMeta:
    """Ce qu'il faut à un fichier d'API Meta pour lire.

    `compte` (act_…) et `fuseau` viennent de `ads/comptes.py` ; `instagram`
    est l'`instagram_business_id` de `connected_accounts`.
    """
    jeton: str
    compte: str | None = None
    fuseau: str | None = None
    instagram: str | None = None


def lire(url: str, params: dict | None, *, timeout: float) -> tuple[dict | None, str | None]:
    """Un GET Graph → (objet, erreur). N'échoue jamais en levant.

    Meta répond souvent 200 avec un objet `error` (jeton expiré, limite) : il
    devient l'erreur rendue. Un proxy peut aussi rendre du JSON valide qui n'est
    pas un objet. Aucun message ne porte l'URL en clair — elle contient le jeton.
    """
    try:
        data = http.get(url, params=params, timeout=timeout).json()
    except Exception as e:
        return None, sans_jeton(f"{type(e).__name__}: {e}")
    if not isinstance(data, dict):
        return None, f"réponse Meta inattendue ({type(data).__name__})"
    if data.get("error"):
        err = data["error"]
        return None, (err.get("message") if isinstance(err, dict) else None) or "erreur Meta"
    return data, None


def pages(url: str, params: dict, *, timeout: float, pages_max: int | None = None,
          limite: int | None = None) -> tuple[list[dict], str | None]:
    """Les `data` de toutes les pages, `paging.next` suivi jusqu'au bout.

    Retour : (lignes, erreur) — `erreur` à None quand la liste est ENTIÈRE.
    Une liste tronquée rend ce qu'elle a lu ET le dit : « ce compte n'a que 200
    campagnes » et « on s'est arrêté à 200 » ne doivent jamais se confondre.

    · Le curseur `next` est une URL COMPLÈTE, jeton compris : la relire avec
      `params` écraserait la position et relirait la page 1 sans fin.
    · Une page VIDE qui porte encore un `next` arrête la lecture : Graph sait
      rendre un curseur épuisé qui tourne à vide, et la boucle ne finissait
      jamais (le cas a été vu sur `/activities`).
    · `pages_max` est un coupe-circuit, pas une limite de produit.
    · `limite` (l'essai) arrête après N éléments ; ce n'est pas une troncature.
    """
    data, err = lire(url, params, timeout=timeout)
    if err:
        return [], err
    lignes = list(data.get("data") or [])
    nxt = (data.get("paging") or {}).get("next")
    lues = 1
    while nxt and (limite is None or len(lignes) < limite):
        if pages_max is not None and lues >= pages_max:
            return lignes, (f"liste tronquée à {len(lignes)} élément(s) : {pages_max} "
                            f"pages suivies sans fin de curseur")
        page, err = lire(nxt, None, timeout=timeout)
        if err:
            return lignes, f"liste tronquée à {len(lignes)} élément(s) : {err}"
        lot = page.get("data") or []
        if not lot:
            break
        lignes += lot
        lues += 1
        nxt = (page.get("paging") or {}).get("next")
    return (lignes[:limite] if limite is not None else lignes), None
