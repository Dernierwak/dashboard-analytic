"""`boost_ads_list` — les annonces qu'Instagram rattache à un post.

Un CHAMP du média, pas une métrique insights : il se demande avec la fiche
(`/{media-id}` ou `/{ig-user}/media`), donc au même appel, sans relecture de
plus (`.scratch/instagram/issues/19`, point 3). Aucun chiffre payant n'en sort :
seulement « boosté ou non » (spec, vocabulaire « Boosté »).
"""
from __future__ import annotations

CHAMP = "boost_ads_list"
# Essai réel du 2026-11-06 (`.scratch/instagram/issues/17`, point 9) : une
# seule annonce `error` vue, sur un Reel de juillet 2025. Tranché par
# `.scratch/instagram/issues/22` : seule, elle ne marque pas le post — rien ne
# dit qu'elle a tourné, et notre base Meta Ads ne permet pas de le vérifier.
_STATUT_SANS_DIFFUSION = "error"


def avec_le_champ(champs: str) -> str:
    return f"{champs},{CHAMP}"


def obtenu(media: dict) -> dict:
    """Le média d'une réponse qui a ACCEPTÉ le champ.

    Meta n'écrit pas toujours un champ vide : demandé et absent, il veut dire
    « aucune annonce listée ». On le pose donc, pour que seule l'absence née
    d'un repli (champ refusé) se lise comme « inconnu ».
    """
    if CHAMP in media or media.get("error"):
        return media
    return {**media, CHAMP: {"data": []}}


def est_booste(media: dict) -> bool | None:
    """Au moins une annonce hors `error` → True ; aucune → False ; champ non
    obtenu → None (on ne sait pas, ce n'est pas « non boosté », `CLAUDE.md` §7).

    Dédoublonné par `ad_id` (la même annonce revient jusqu'à 6 fois, essai
    réel) et statuts en minuscules : une annonce compte si l'une de ses
    mentions n'est pas `error`.
    """
    if CHAMP not in media:
        return None
    statuts: dict[str, set[str]] = {}
    for rang, annonce in enumerate((media.get(CHAMP) or {}).get("data") or []):
        cle = str(annonce.get("ad_id") or f"sans-id-{rang}")
        statuts.setdefault(cle, set()).add(str(annonce.get("ad_status") or "").lower())
    return any(s != {_STATUT_SANS_DIFFUSION} for s in statuts.values())
