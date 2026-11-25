"""L'écriture des stories Instagram — table `instagram_stories` et bucket privé
`instagram-stories` (section 27 de `000_run_me_all.sql`, spec
`.scratch/instagram-stories/spec.md` § La base).

Tant que la section 27 n'est pas jouée, la table n'existe pas (PGRST205) :
`TableStoriesAbsente` le dit, et la commande s'arrête au lieu de refaire
l'erreur pour chaque compte, chaque heure.
"""
from __future__ import annotations

import io

TABLE = "instagram_stories"
BUCKET = "instagram-stories"

# Spec § La récolte, point 2 : la vignette « réduite à 720 px de large en
# JPEG ». L'image de l'essai pesait 829 Ko, une vidéo jusqu'à 12 Mo
# (`.scratch/instagram-stories/issues/02`, point 4) : on ne garde que l'image
# qui s'affiche dans le Panneau.
_LARGEUR_MAX = 720
# Qualité JPEG : non mesurée sur des stories. 85 est le réglage courant d'une
# vignette web ; à revoir sur la taille réelle des fichiers dans le bucket.
_QUALITE_JPEG = 85


class TableStoriesAbsente(RuntimeError):
    """La section 27 n'est pas jouée : rien ne peut s'écrire."""


def _table_absente(e: Exception) -> bool:
    msg = str(e).lower()
    return "pgrst205" in msg or "could not find the table" in msg


def _executer(requete):
    try:
        return requete.execute()
    except Exception as e:
        if _table_absente(e):
            raise TableStoriesAbsente(
                "table instagram_stories absente — lance la section 27 de "
                "saas/data/supabase/migrations/000_run_me_all.sql") from None
        raise


def connues(sb, uid: str, ids: list[str]) -> dict[str, dict]:
    """`{story_id: {image_path}}` des stories déjà en base parmi `ids`.

    Les stories en ligne d'un compte se comptent en dizaines au plus : sous le
    plafond de 1 000 lignes de PostgREST (`CLAUDE.md` §8)."""
    if not ids:
        return {}
    lignes = _executer(sb.table(TABLE).select("story_id, image_path")
                       .eq("user_id", uid).in_("story_id", ids)).data or []
    return {str(r["story_id"]): r for r in lignes}


def ajouter(sb, lignes: list[dict]) -> None:
    """Les stories nouvelles. `ignore_duplicates` : une story déjà là (deux
    passages qui se croisent) garde sa ligne et son `vue_le`."""
    if lignes:
        _executer(sb.table(TABLE).upsert(lignes, on_conflict="user_id,story_id",
                                         ignore_duplicates=True))


def ecrire_releves(sb, lignes: list[dict]) -> None:
    """Le relevé écrase le précédent (spec § La récolte, point 3). Toutes les
    lignes portent les mêmes clés : PostgREST écrirait NULL pour une clé
    absente d'une ligne et présente dans une autre du même lot."""
    if lignes:
        _executer(sb.table(TABLE).upsert(lignes, on_conflict="user_id,story_id"))


def poser_image(sb, uid: str, story_id: str, chemin: str) -> bool:
    """`image_path` d'une story déjà en base → True si une ligne a été touchée.
    Un `update` qui ne touche rien ne lève rien (`CLAUDE.md` §8)."""
    reponse = _executer(sb.table(TABLE).update({"image_path": chemin})
                        .eq("user_id", uid).eq("story_id", story_id))
    return bool(reponse.data)


def chemin_image(uid: str, story_id: str) -> str:
    """`{user_id}/{story_id}.jpg` : le premier segment est ce que lit la
    politique de lecture du bucket (`a_acces`, section 27)."""
    return f"{uid}/{story_id}.jpg"


def reduire(contenu: bytes) -> bytes | None:
    """L'image téléchargée → un JPEG de 720 px de large au plus, ou None si ce
    n'est pas une image lisible. Une image plus étroite n'est pas agrandie."""
    from PIL import Image, ImageOps   # import tardif : seul le job horaire en a besoin

    try:
        with Image.open(io.BytesIO(contenu)) as image:
            image = ImageOps.exif_transpose(image).convert("RGB")
            if image.width > _LARGEUR_MAX:
                hauteur = round(image.height * _LARGEUR_MAX / image.width)
                image = image.resize((_LARGEUR_MAX, hauteur), Image.Resampling.LANCZOS)
            sortie = io.BytesIO()
            image.save(sortie, format="JPEG", quality=_QUALITE_JPEG)
            return sortie.getvalue()
    except Exception:
        return None


def televerser_image(sb, uid: str, story_id: str, contenu: bytes) -> str | None:
    """Réduit et range la vignette → son chemin dans le bucket, ou None.

    Bucket PRIVÉ (spec § La base) : on garde le chemin, pas une URL publique ;
    la page lira par URL signée."""
    jpeg = reduire(contenu)
    if jpeg is None:
        return None
    chemin = chemin_image(uid, story_id)
    try:
        sb.storage.from_(BUCKET).upload(
            path=chemin, file=jpeg,
            file_options={"content-type": "image/jpeg", "upsert": "true"})
    except Exception:
        return None
    return chemin
