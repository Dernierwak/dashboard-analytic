"""La récolte horaire des stories d'un compte Instagram : lister, ajouter, relever.

Spec `.scratch/instagram-stories/spec.md` § La récolte. Les appels vivent dans
`fetchers/stories.py`, l'écriture dans `saas/data/supabase/source_data/
instagram_stories.py` ; ce fichier décide quelle story s'ajoute et laquelle se
relève. Appelé chaque heure par `cockpit/instagram_stories.py`.

Pourquoi chaque heure, et pourquoi « 20 h ou plus » : une story disparaît à
24 h et l'API ne la rend plus ensuite (essai réel, `issues/02`). Toute story
de 20 h de vie ou plus est relue à chaque passage — au plus quatre fois —, et
le dernier relevé écrase le précédent : une fenêtre de 4 h tolère les retards
du cron GitHub (ticket `issues/06`). La dernière heure de vie n'est jamais
relevée (`docs/mesures-impossibles.md`).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta

from saas.data.fetch_data.sources.meta.graph_client import AccesMeta
from saas.data.fetch_data.sources.meta.instagram.fetchers import stories as graph
from saas.data.supabase.source_data import instagram_stories as base

# Spec § La récolte, point 3 : « Story de 20 h de vie ou plus → relevé ».
AGE_DU_RELEVE = timedelta(hours=20)


@dataclass
class Bilan:
    """Ce que le journal dit d'un compte (spec § La récolte, point 4)."""
    vues: int = 0
    nouvelles: int = 0
    relues: int = 0
    notes: list[str] = field(default_factory=list)

    def ligne(self) -> str:
        mot = (f"stories: {self.vues} vues, {self.nouvelles} nouvelles, "
               f"{self.relues} relues")
        return mot + (" — " + " ; ".join(self.notes) if self.notes else "")


def _publiee_a(story: dict) -> datetime | None:
    """L'horodatage de Meta (« 2026-11-25T12:27:13+0000 ») → datetime avec
    fuseau, ou None : sans date lisible, ni ligne (`publiee_a` est NOT NULL)
    ni âge — un âge inventé déclencherait un relevé trop tôt."""
    try:
        quand = datetime.fromisoformat(story.get("timestamp") or "")
    except ValueError:
        return None
    return quand if quand.tzinfo is not None else None


def url_de_vignette(story: dict) -> str | None:
    """`media_url` pour une image, `thumbnail_url` pour une vidéo (spec § La
    récolte, point 2). Une vidéo n'a parfois pas de `media_url` (son sous
    droits, essai point 1) : sa vignette vient quand même de `thumbnail_url`.
    Ni l'un ni l'autre → None, et `image_path` reste NULL."""
    if story.get("media_type") == "VIDEO":
        return story.get("thumbnail_url") or None
    return story.get("media_url") or None


def _vignette(sb, uid: str, story: dict) -> str | None:
    url = url_de_vignette(story)
    if not url:
        return None
    contenu = graph.telecharger(url)
    return base.televerser_image(sb, uid, str(story["id"]), contenu) if contenu else None


def ligne_de_releve(uid: str, story_id: str, publiee_a: datetime, releve: graph.Releve,
                    releve_a: datetime) -> dict:
    """Un relevé → la ligne qui écrase le précédent. Toutes les colonnes de
    chiffres y sont, à NULL quand Meta n'a rien rendu (jamais 0)."""
    return {
        "user_id": uid, "story_id": story_id, "publiee_a": publiee_a.isoformat(),
        "releve_a": releve_a.isoformat(),
        "age_heures": round((releve_a - publiee_a).total_seconds() / 3600, 2),
        **{col: releve.valeurs.get(col) for col in graph.COLONNES},
    }


def recolter(sb, uid: str, acces: AccesMeta, maintenant: datetime) -> Bilan:
    """Le passage horaire d'une connexion → son bilan.

    Lève si Meta refuse la liste des stories (jeton, limite) : l'appelant le
    journalise et passe à la connexion suivante. `maintenant` est l'heure du
    passage : `releve_a` et l'âge en viennent — un passage dure quelques
    secondes par compte, sans effet sur la borne de 20 h."""
    if not acces.instagram:
        raise ValueError("instagram_business_id requis")
    en_ligne, trous = graph.recuperer(acces)
    if trous and not en_ligne:
        raise ValueError("Instagram — l'API a refusé la liste des stories : " + trous[0])
    bilan = Bilan(vues=len(en_ligne), notes=list(trous))

    lisibles = [(s, quand) for s in en_ligne if s.get("id") and (quand := _publiee_a(s))]
    if len(lisibles) < len(en_ligne):
        bilan.notes.append(f"{len(en_ligne) - len(lisibles)} story(s) sans id ou date "
                           "lisible — ignorée(s)")
    deja = base.connues(sb, uid, [str(s["id"]) for s, _ in lisibles])

    nouvelles, sans_vignette = [], 0
    for story, quand in lisibles:
        story_id = str(story["id"])
        if story_id in deja:
            # Une vignette ratée à l'arrivée (CDN muet, image illisible) se
            # retente tant que la story est en ligne : après 24 h, l'URL ne
            # nous est plus rendue et l'image serait perdue.
            if not deja[story_id].get("image_path") and url_de_vignette(story):
                chemin = _vignette(sb, uid, story)
                if chemin and base.poser_image(sb, uid, story_id, chemin):
                    bilan.notes.append(f"vignette rattrapée pour {story_id}")
            continue
        chemin = _vignette(sb, uid, story)
        sans_vignette += chemin is None
        nouvelles.append({"user_id": uid, "story_id": story_id,
                          "publiee_a": quand.isoformat(),
                          "media_type": story.get("media_type"),
                          "permalink": story.get("permalink"), "image_path": chemin})
    base.ajouter(sb, nouvelles)
    bilan.nouvelles = len(nouvelles)
    if sans_vignette:
        bilan.notes.append(f"{sans_vignette} nouvelle(s) sans vignette")

    releves, en_panne, partiels, exemple = [], 0, 0, None
    for story, quand in lisibles:
        if maintenant - quand < AGE_DU_RELEVE:
            continue
        story_id = str(story["id"])
        releve = graph.releve(acces, story_id)
        if releve.en_panne():
            # Tout refusé, et pas pour « moins de 5 spectateurs » : un relevé
            # tout à NULL écraserait celui de l'heure d'avant. Rien n'est
            # écrit, le passage suivant réessaie.
            en_panne += 1
            exemple = exemple or next(iter(releve.refus.values()))
            continue
        partiels += bool(releve.refus)
        releves.append(ligne_de_releve(uid, story_id, quand, releve, maintenant))
    base.ecrire_releves(sb, releves)
    bilan.relues = len(releves)
    if partiels:
        bilan.notes.append(f"{partiels} relevé(s) avec métrique(s) refusée(s) — NULL")
    if en_panne:
        bilan.notes.append(f"{en_panne} relevé(s) refusé(s) en entier par Meta — "
                           f"relevé précédent gardé ({exemple})")
    return bilan
