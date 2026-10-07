"""`/act_…/ads?fields=creative{…}` — ce que dit chaque annonce → meta_ads_creatives et _assets."""
from __future__ import annotations

from saas.data.fetch_data.sources.meta.graph_client import GRAPH, AccesMeta, pages
from saas.data.fetch_data.shared.date_ranges import Fenetre

# ── Les créas (/ads?fields=creative{…}) → meta_ads_creatives et _assets ──────
#
# Ce que dit une annonce, pas ce qu'elle a mesuré : aucun chiffre ne sort
# d'ici (`.scratch/meta-ads/spec.md`, « Les créas »). Les champs et leurs
# sources sont dans `.scratch/meta-ads/recherche/champs-api-meta.md` § 4.

# `creative` est un CHAMP de l'annonce, pas une connexion : l'expansion le lit
# pour toute une page d'annonces en une requête, au lieu d'un appel par annonce.
# `call_to_action` n'est pas dans la liste de la recherche : c'est lui qui porte
# le bouton et, quand `link` manque, l'adresse (`value.link`).
_CHAMPS_CREA = (
    "id,name,object_type,object_story_id,title,body,image_hash,video_id,link_url,"
    "call_to_action_type,"
    "object_story_spec{"
    "link_data{message,name,description,link,image_hash,call_to_action,"
    "child_attachments{name,description,link,image_hash,video_id}},"
    "photo_data{caption,image_hash},"
    "video_data{video_id,title,message,link_description,image_hash,call_to_action}},"
    "asset_feed_spec{images{hash},videos{video_id,thumbnail_hash},"
    "bodies{text},titles{text},descriptions{text},link_urls{website_url},"
    "call_to_action_types}"
)

# 100 annonces par page : la réponse embarque une créa entière par annonce,
# carrousels compris. 50 pages = 5 000 annonces ; c'est un coupe-circuit contre
# un curseur qui tourne à vide (voir `_ACTIVITES_PAGES_MAX`), pas une limite.
_ANNONCES_PAR_PAGE = 100
_ANNONCES_PAGES_MAX = 50

def _ou_null(v) -> str | None:
    """Une chaîne vide de Meta n'est pas un texte : elle s'écrit NULL."""
    return str(v) if v not in (None, "") else None


def _cta(bouton) -> tuple[str | None, str | None]:
    """`call_to_action` → (type du bouton, adresse du bouton)."""
    if not isinstance(bouton, dict):
        return None, None
    return _ou_null(bouton.get("type")), _ou_null((bouton.get("value") or {}).get("link"))


def _montage(crea: dict) -> str:
    """Lequel des trois montages porte le contenu.

    `asset_feed_spec` passe devant : une créa dynamique porte aussi un
    `object_story_spec`, réduit à la page qui publie, sans texte.

    `publication` : la créa pointe une publication existante (`object_story_id`,
    « ID of a Facebook Page post to use in an ad », recherche § 4 a) — le
    post boosté. Son texte vit dans le post, pas dans la créa ; la ranger en
    `flat` ferait lire des champs vides comme une créa vide. On ne teste pas
    `effective_object_story_id` : Meta le rend pour toute créa diffusée.
    """
    if crea.get("asset_feed_spec"):
        return "asset_feed"
    histoire = crea.get("object_story_spec") or {}
    if any(histoire.get(k) for k in ("link_data", "photo_data", "video_data")):
        return "object_story"
    if crea.get("object_story_id"):
        return "publication"
    return "flat"


def _contenu_de(crea: dict, montage: str) -> dict:
    if montage == "object_story":
        return _contenu_object_story(crea["object_story_spec"])
    return _contenu_flat(crea)


def _contenu_object_story(histoire: dict) -> dict:
    """`object_story_spec` → les colonnes de contenu, `vignette_hash` en plus.

    Le titre d'un lien s'appelle `name`, pas `title` (recherche § 4 b) ; une
    photo n'a pas de titre, sa légende est la description.
    """
    if histoire.get("link_data"):
        lien = histoire["link_data"]
        bouton, lien_bouton = _cta(lien.get("call_to_action"))
        return {"titre": lien.get("name"), "texte": lien.get("message"),
                "description": lien.get("description"),
                "lien_url": lien.get("link") or lien_bouton,
                "call_to_action": bouton, "image_hash": lien.get("image_hash")}
    if histoire.get("video_data"):
        video = histoire["video_data"]
        bouton, lien_bouton = _cta(video.get("call_to_action"))
        # L'`image_hash` d'une vidéo est sa VIGNETTE (« to use as thumbnail »,
        # recherche § 4 b) : la ranger en visuel de l'annonce montrerait une
        # image fixe là où le client a mis une vidéo.
        return {"titre": video.get("title"), "texte": video.get("message"),
                "description": video.get("link_description"), "lien_url": lien_bouton,
                "call_to_action": bouton, "video_id": video.get("video_id"),
                "vignette_hash": video.get("image_hash")}
    photo = histoire.get("photo_data") or {}
    return {"description": photo.get("caption"), "image_hash": photo.get("image_hash")}


def _contenu_flat(crea: dict) -> dict:
    return {"titre": crea.get("title"), "texte": crea.get("body"),
            "lien_url": crea.get("link_url"),
            "call_to_action": crea.get("call_to_action_type"),
            "image_hash": crea.get("image_hash"), "video_id": crea.get("video_id")}


def _asset(provenance: str, kind: str, rang: int, **contenu) -> dict:
    return {"provenance": provenance, "asset_kind": kind, "rang": rang, **contenu}


def _assets_asset_feed(flux: dict) -> list[dict]:
    """Les variantes d'une créa dynamique, chacune à son rang dans la liste de Meta."""
    out: list[dict] = []
    for kind, cle in (("body", "bodies"), ("title", "titles"), ("description", "descriptions")):
        for rang, a in enumerate(flux.get(cle) or []):
            out.append(_asset("asset_feed", kind, rang, texte=a.get("text")))
    for rang, a in enumerate(flux.get("images") or []):
        out.append(_asset("asset_feed", "image", rang, image_hash=a.get("hash")))
    for rang, a in enumerate(flux.get("videos") or []):
        out.append(_asset("asset_feed", "video", rang, video_id=a.get("video_id"),
                          vignette_hash=a.get("thumbnail_hash")))
    for rang, a in enumerate(flux.get("link_urls") or []):
        out.append(_asset("asset_feed", "link_url", rang, lien_url=a.get("website_url")))
    for rang, bouton in enumerate(flux.get("call_to_action_types") or []):
        out.append(_asset("asset_feed", "call_to_action", rang, texte=bouton))
    return out


def _assets_carrousel(cartes: list[dict]) -> list[dict]:
    """Une ligne `carousel_card` par carte (titre, visuel, lien), et sa
    description au même rang. La table n'a qu'une colonne `texte` : la clé
    `(provenance, asset_kind, rang)` loge les deux sans changer le schéma."""
    out: list[dict] = []
    for rang, carte in enumerate(cartes):
        out.append(_asset("child_attachment", "carousel_card", rang,
                          texte=carte.get("name"), image_hash=carte.get("image_hash"),
                          video_id=carte.get("video_id"), lien_url=carte.get("link")))
        if carte.get("description"):
            out.append(_asset("child_attachment", "description", rang,
                              texte=carte["description"]))
    return out


def _bruts_de(crea: dict, montage: str) -> list[dict]:
    if montage == "asset_feed":
        return _assets_asset_feed(crea["asset_feed_spec"])
    lien = (crea.get("object_story_spec") or {}).get("link_data") or {}
    return _assets_carrousel(lien.get("child_attachments") or [])


_COLONNES_ASSET = ("texte", "image_hash", "video_id", "lien_url")


def _asset_ecrit(user_id: str, ad_id: str, brut: dict, stockees: dict[str, str]) -> dict:
    """Toutes les colonnes, toujours : PostgREST écrit NULL pour une clé
    absente d'une ligne mais présente dans le lot."""
    ligne = {"user_id": user_id, "ad_id": ad_id, "provenance": brut["provenance"],
             "asset_kind": brut["asset_kind"], "rang": brut["rang"]}
    for col in _COLONNES_ASSET:
        ligne[col] = _ou_null(brut.get(col))
    ligne["image_url"] = _url_stockee(stockees, ligne["image_hash"])
    ligne["vignette_url"] = _url_stockee(stockees, brut.get("vignette_hash"))
    return ligne


def _url_stockee(stockees: dict[str, str], image_hash: str | None) -> str | None:
    return stockees.get(image_hash) if image_hash else None


def _annonces_lisibles(annonces: list[dict]):
    """(ad_id, créa) de chaque annonce qui a les deux, une fois chacune."""
    vues: set[str] = set()
    for annonce in annonces:
        ad_id, crea = annonce.get("id"), annonce.get("creative")
        if not ad_id or not isinstance(crea, dict) or str(ad_id) in vues:
            continue
        vues.add(str(ad_id))
        yield str(ad_id), crea


def lignes_creas(
    user_id: str, annonces: list[dict], stockees: dict[str, str],
) -> tuple[list[dict], list[dict], int]:
    """La réponse de `/ads?fields=id,creative{…}` → (meta_ads_creatives,
    meta_ads_creative_assets, nombre d'annonces sans id).

    Pure, sans réseau : c'est le seam de test des créas (harnais
    `.scratch/meta-ads/harnais/05-les-creas/`). `stockees` associe un
    `image_hash` à son URL dans Supabase Storage.

    UNE IMAGE PAS ENCORE STOCKÉE S'ÉCRIT SANS URL, jamais avec celle de Meta :
    `AdImage.url` est « a temporary URL » (recherche § 5). L'écrire ferait un
    visuel qui s'affiche aujourd'hui et casse dans six mois sans que rien ne
    le distingue d'un visuel durable. Le hash, lui, reste : le passage suivant
    réessaie.
    """
    creas: list[dict] = []
    assets: list[dict] = []
    sans_id = sum(1 for a in annonces if not a.get("id"))
    for ad_id, crea in _annonces_lisibles(annonces):
        montage = _montage(crea)
        contenu = _contenu_de(crea, montage)
        image_hash = _ou_null(contenu.get("image_hash"))
        creas.append({
            "user_id": user_id,
            "ad_id": ad_id,
            "creative_id": _ou_null(crea.get("id")),
            "creative_name": _ou_null(crea.get("name")),
            "montage": montage,
            "object_type": _ou_null(crea.get("object_type")),
            "titre": _ou_null(contenu.get("titre")),
            "texte": _ou_null(contenu.get("texte")),
            "description": _ou_null(contenu.get("description")),
            "lien_url": _ou_null(contenu.get("lien_url")),
            "call_to_action": _ou_null(contenu.get("call_to_action")),
            "image_hash": image_hash,
            "image_url": _url_stockee(stockees, image_hash),
            "video_id": _ou_null(contenu.get("video_id")),
            "vignette_url": _url_stockee(stockees, contenu.get("vignette_hash")),
        })
        assets += [_asset_ecrit(user_id, ad_id, b, stockees) for b in _bruts_de(crea, montage)]
    return creas, assets, sans_id


def hashes_des_creas(annonces: list[dict]) -> set[str]:
    """Tous les `image_hash` qu'une page de créas référence — visuels ET
    vignettes de vidéo. Pure : c'est la liste de ce qui doit être en stockage."""
    hashes: set[str] = set()
    for _, crea in _annonces_lisibles(annonces):
        montage = _montage(crea)
        contenu = _contenu_de(crea, montage)
        candidats = [contenu.get("image_hash"), contenu.get("vignette_hash")]
        for brut in _bruts_de(crea, montage):
            candidats += [brut.get("image_hash"), brut.get("vignette_hash")]
        hashes |= {str(h) for h in candidats if h}
    return hashes


def recuperer(acces: AccesMeta, fenetre: Fenetre | None = None,
              limite: int | None = None) -> tuple[list[dict], list[str]]:
    """Chaque annonce du compte avec sa créa — UNE requête par page d'annonces.

    Une liste tronquée s'écrit quand même : seules les annonces relues voient
    leurs assets remplacés (`remplacer_creas`), les autres gardent ceux du
    passage d'avant. `fenetre` n'a pas de sens ici : une créa n'est pas datée.
    """
    if not (acces.jeton and acces.compte):
        return [], ["token ou ad_account_id manquant"]
    params = {"access_token": acces.jeton, "fields": f"id,creative{{{_CHAMPS_CREA}}}",
              "limit": _ANNONCES_PAR_PAGE}
    annonces, err = pages(f"{GRAPH}/{acces.compte}/ads", params, timeout=60,
                          pages_max=_ANNONCES_PAGES_MAX, limite=limite)
    return annonces, ([err] if err else [])
