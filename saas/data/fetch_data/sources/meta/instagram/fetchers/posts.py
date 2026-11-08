"""`/{ig-user}/media` — l'inventaire des posts du compte Instagram (id, date)."""
from __future__ import annotations

from datetime import datetime

from saas.data.fetch_data.sources.meta.graph_client import GRAPH, AccesMeta, lire, pages
from saas.data.fetch_data.sources.meta.instagram.fetchers import boost
from saas.data.fetch_data.shared.date_ranges import Fenetre

# Plafond de pages sur l'inventaire des médias. À 100 par page, 60 pages =
# 6 000 posts : au-delà, ce n'est plus un compte de marque, et une boucle sans
# fin coûterait le passage de TOUS les autres utilisateurs. Le chiffre borne
# aussi le pire cas en temps — 60 requêtes à 30 s de délai d'attente.
_MEDIA_PAGES_MAX = 60


def recuperer(acces: AccesMeta, fenetre: Fenetre | None = None,
              limite: int | None = None) -> tuple[list[dict], list[str]]:
    """Tous les posts du compte, `[{id, timestamp}]`, dans l'ordre de Meta.

    L'inventaire est COMPLET par construction (`total_posts` est un décompte
    de tout l'historique) : `fenetre` ne s'applique pas.
    """
    params = {
        "fields": "id,timestamp",
        "access_token": acces.jeton,
        # LE POSTE LE PLUS BAVARD DE LA RÉCOLTE, POUR RIEN. Cette boucle
        # parcourt TOUT l'historique média du compte, et elle le faisait SANS
        # `limit`, donc par pages de 25, le défaut du Graph API : un compte à
        # 1 000 posts payait 40 allers-retours uniquement pour compter.
        #
        # 100 plutôt que 25 : la taille maximale de page n'est PAS fermement
        # documentée pour cette edge (la référence de la pagination par curseur
        # décrit `limit` comme « the maximum number of objects that may be
        # returned » et prévient de ne pas déduire la fin d'une page plus
        # courte que demandé). Ce qui rend le choix SANS RISQUE, c'est la
        # condition d'arrêt : la pagination s'arrête sur l'ABSENCE de `next`,
        # jamais sur un compte de lignes. Le pire cas est « aucun gain », pas
        # « données tronquées ».
        "limit": 100,
    }
    medias, err = pages(f"{GRAPH}/{acces.instagram}/media", params, timeout=30,
                        pages_max=_MEDIA_PAGES_MAX, limite=limite)
    return medias, ([err] if err else [])


# LE PASSAGE LÉGER QUOTIDIEN (spec § La récolte — Ce qui s'ajoute) lit la
# première page de l'inventaire, `limit=25`, pour trouver les posts neufs et
# ceux de moins de 8 × 24 h. Il lit la page SUIVANTE tant que la dernière
# reste plus jeune que la borne : un compte qui publie plus de trois fois par
# jour aurait sinon des posts de J+6 jamais relevés. Les champs de la fiche
# viennent avec l'inventaire, mêmes noms et même permission `instagram_basic`
# que `post_metrics.info_du_post` : le relevé d'un post coûte alors ses seuls
# appels insights (2, 1 pour un Reel), comme la spec le chiffre.
_CHAMPS_DE_LA_FICHE = ("id,timestamp,caption,media_type,media_url,thumbnail_url,"
                       "permalink,media_product_type")
_PAGE_DU_JOUR = 25
# Coupe-circuit : 8 pages = 200 posts en 8 jours, 25 par jour. Au-delà, la
# relecture du Jour de travail prend le relais ; une boucle sans fin, elle,
# coûterait le passage de tous les autres comptes.
_PAGES_DU_JOUR_MAX = 8


def recents(acces: AccesMeta, plus_jeune_que: datetime) -> tuple[list[dict], list[str]]:
    """Le haut de l'inventaire, avec la fiche de chaque post, jusqu'à la page
    qui contient le premier post publié avant `plus_jeune_que` (UTC).

    Retour `(medias, trous)` : une page refusée après la première rend ce qui a
    été lu ET le dit, comme `graph_client.pages`.
    """
    # `boost_ads_list` avec la fiche (ticket 02) ; un champ refusé fait échouer
    # toute la page : on la relit sans lui, le boost reste inconnu ce jour-là.
    # Les pages suivantes suivent `next`, qui porte les champs de la première.
    url = f"{GRAPH}/{acces.instagram}/media"
    params = {"fields": boost.avec_le_champ(_CHAMPS_DE_LA_FICHE), "limit": _PAGE_DU_JOUR,
              "access_token": acces.jeton}
    data, err = lire(url, params, timeout=30)
    marquer = boost.obtenu
    if err:
        data, err = lire(url, {**params, "fields": _CHAMPS_DE_LA_FICHE}, timeout=30)
        marquer = _tel_quel
    if err:
        return [], [err]
    medias = [marquer(m) for m in data.get("data") or []]
    for _ in range(_PAGES_DU_JOUR_MAX - 1):
        nxt = (data.get("paging") or {}).get("next")
        if not nxt or not medias or not _plus_jeune(medias[-1], plus_jeune_que):
            return medias, []
        # `next` est une URL complète, jeton compris : la relire avec `params`
        # écraserait la position.
        data, err = lire(nxt, None, timeout=30)
        if err:
            return medias, [f"inventaire tronqué à {len(medias)} post(s) : {err}"]
        lot = data.get("data") or []
        if not lot:
            return medias, []
        medias += [marquer(m) for m in lot]
    return medias, []


def page_du_rattrapage(acces: AccesMeta, apres: str | None,
                       taille: int) -> tuple[list[dict], str | None, str | None]:
    """Une page de l'inventaire, avec la fiche de chaque post, à partir du
    curseur `apres` (None = le haut) → `(medias, curseur suivant, erreur)`.

    · Le curseur suivant est `paging.cursors.after`, et seulement si la page
      porte un `next` : Meta rend encore `cursors.after` sur la dernière page,
      et la doc de la pagination par curseur dit que c'est l'absence de `next`
      qui marque la fin — pas une page plus courte que `limit`
      (https://developers.facebook.com/docs/graph-api/results). None = fin.
    · Le curseur, pas l'URL `next` : celle-ci porte le jeton, elle ne se garde
      pas en base. Le curseur s'envoie en `after`, avec nos propres champs.
    · Mêmes champs et même repli sur `boost_ads_list` que `recents`.
    """
    url = f"{GRAPH}/{acces.instagram}/media"
    params = {"fields": boost.avec_le_champ(_CHAMPS_DE_LA_FICHE), "limit": taille,
              "access_token": acces.jeton}
    if apres:
        params["after"] = apres
    data, err = lire(url, params, timeout=30)
    marquer = boost.obtenu
    if err:
        data, err = lire(url, {**params, "fields": _CHAMPS_DE_LA_FICHE}, timeout=30)
        marquer = _tel_quel
    if err:
        return [], None, err
    paging = data.get("paging") or {}
    suivant = (paging.get("cursors") or {}).get("after") if paging.get("next") else None
    return [marquer(m) for m in data.get("data") or []], suivant, None


def _tel_quel(media: dict) -> dict:
    return media


def _plus_jeune(media: dict, borne: datetime) -> bool:
    """Publié après la borne ? Une date illisible arrête la lecture : on ne
    paie pas une page de plus sur une date qu'on ne sait pas lire."""
    try:
        return datetime.fromisoformat(media.get("timestamp") or "") > borne
    except (TypeError, ValueError):
        return False
