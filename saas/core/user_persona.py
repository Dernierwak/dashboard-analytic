"""Persona utilisateur — dérivé des commentaires de feedback, pour personnaliser l'IA.

Idée (voir mémoire [[comment-profil-user-ia]]) : chaque retour laissé sur un conseil
peut porter un commentaire libre. On accumule ces commentaires (+ réactions + objectif),
et une IA en synthétise un PROFIL court : type d'utilisateur, niveau, ton préféré,
priorités, sujets à éviter. Ce profil est ensuite injecté dans les prompts du rapport
pour que les retours de l'IA collent au type d'user.

Le module est découplé de l'appel IA concret : on lui passe `call_ai(prompt) -> str|None`
(dans le rapport, c'est `_call_gemini`). Pas d'import de gemini ici — module headless.
"""

from __future__ import annotations

from datetime import datetime

from saas.scripts.fetch_data import fetch_reco_comments, fetch_user_profile
from saas.scripts.insert_data import save_user_profile

try:  # libellés lisibles des conseils (facultatif — dégrade proprement)
    from saas.core.reco_engine import KEY_LABELS, OBJECTIFS
except Exception:  # pragma: no cover
    KEY_LABELS, OBJECTIFS = {}, {}


def _parse_ts(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def _needs_regen(comments: list[dict], stored: str | None, updated_at: str | None) -> bool:
    """Régénère si on a des commentaires et qu'aucun profil à jour ne les couvre."""
    if not comments:
        return False
    if not stored:
        return True
    last_dt = max((_parse_ts(c.get("created_at")) for c in comments), default=None)
    prof_dt = _parse_ts(updated_at)
    if last_dt is None:
        return False
    if prof_dt is None:
        return True
    return last_dt > prof_dt  # un commentaire plus récent que le dernier calcul


def _build_prompt(comments: list[dict], objectif: str | None) -> str:
    obj_label = (OBJECTIFS.get(objectif or "") or {}).get("label", "non défini")
    lignes = []
    for c in comments[:40]:
        label = KEY_LABELS.get(c.get("reco_key", ""), c.get("reco_key", "conseil"))
        reaction = c.get("reaction") or "—"
        txt = (c.get("comment") or "").strip().replace("\n", " ")
        lignes.append(f"- [{label} · {reaction}] {txt}")
    corpus = "\n".join(lignes)
    return (
        "Tu construis le PROFIL d'un utilisateur d'un dashboard marketing, à partir des "
        "commentaires qu'il a laissés sur les conseils reçus. Objectif déclaré : "
        f"{obj_label}.\n\n"
        "Commentaires (du plus récent au plus ancien) :\n"
        f"{corpus}\n\n"
        "Rédige un profil court et actionnable (français, 3 à 5 puces, pas d'intro). "
        "Couvre : type/niveau de l'utilisateur (débutant→expert), ton qui lui parle, "
        "ce qui l'intéresse vraiment, et ce qu'il faut ÉVITER (sujets, formats, ton). "
        "Ce profil servira à adapter les futurs retours de l'IA. Reste factuel, pas de "
        "flatterie, pas de guillemets."
    )


def build_user_persona(client, user_id, call_ai, objectif: str | None = None,
                       comments: list[dict] | None = None) -> str | None:
    """Retourne le persona (stocké ou régénéré). None si pas de matière.

    - Lit les commentaires + le persona stocké.
    - Régénère via `call_ai` uniquement s'il y a un commentaire plus récent que le
      dernier calcul (économe en appels IA, correct entre sessions).
    - Persiste le résultat dans profiles.user_profile.
    - `comments` peut être fourni par l'appelant (évite une requête en double).
    """
    if not (client and user_id and callable(call_ai)):
        return None
    if comments is None:
        try:
            comments = fetch_reco_comments(client, user_id)
        except Exception:
            comments = []
    stored, updated_at = fetch_user_profile(client, user_id)

    if not _needs_regen(comments, stored, updated_at):
        return stored

    persona = call_ai(_build_prompt(comments, objectif))
    if not persona:
        return stored  # l'IA a échoué → on garde l'ancien profil
    persona = persona.strip()
    try:
        save_user_profile(client, user_id, persona)
    except Exception:
        pass
    return persona


def regenerate_user_persona(client, user_id, call_ai, objectif: str | None = None) -> str | None:
    """Force la régénération (bouton « Régénérer mon profil »)."""
    if not (client and user_id and callable(call_ai)):
        return None
    try:
        comments = fetch_reco_comments(client, user_id)
    except Exception:
        comments = []
    if not comments:
        return None
    persona = call_ai(_build_prompt(comments, objectif))
    if persona:
        persona = persona.strip()
        try:
            save_user_profile(client, user_id, persona)
        except Exception:
            pass
        return persona
    return None
