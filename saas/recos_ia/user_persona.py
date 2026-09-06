"""Profil client vivant — calibre le TON et le NIVEAU DE DÉTAIL du brief IA.

Deux couches (voir wayfinder `.scratch/recos-generales/issues/05-profil-client-vivant.md`) :
- une base FIXE, l'onboarding express (secteur, budget, temps, frustration),
  saisie une fois et jamais redérivée ;
- un état ÉVOLUTIF (niveau de maîtrise, ton, priorités, à éviter), recalculé
  par l'IA à chaque appel de ce module — en pratique une fois par semaine,
  puisque `build_report.py` ne l'appelle qu'à la génération du rapport.

Le module reste découplé de l'appel IA concret : on lui passe
`call_ai(prompt) -> str|None` (dans le rapport, c'est `_call_gemini`). Pas
d'import de Gemini ici — module headless.
"""

from __future__ import annotations

from saas.commun.fetch_data import (
    fetch_onboarding_profile,
    fetch_reco_comments,
    fetch_user_profile,
)
from saas.commun.insert_data import save_user_profile

try:  # libellés lisibles des conseils (facultatif — dégrade proprement)
    from saas.recos_ia.reco_engine import KEY_LABELS, OBJECTIFS
except Exception:  # pragma: no cover
    KEY_LABELS, OBJECTIFS = {}, {}

_ONBOARDING_FIELDS = ("business_type", "budget_range", "time_budget", "frustration")


def _base_txt(onboarding: dict) -> str:
    bits = []
    if onboarding.get("business_type"):
        bits.append(f"secteur {onboarding['business_type']}")
    if onboarding.get("budget_range"):
        bits.append(f"budget pub {onboarding['budget_range']} CHF/mois")
    if onboarding.get("time_budget"):
        bits.append(f"temps disponible {onboarding['time_budget']}")
    if onboarding.get("frustration"):
        bits.append(f"frustration principale {onboarding['frustration']}")
    return ", ".join(bits) or "non renseigné"


def _theme_avis_txt(theme_feedback: dict[tuple[str, str], str]) -> str:
    """Regroupe {(reco_key, theme): reaction} par thème — reste séparé de
    l'avis sur les constats généraux (voir décision du ticket) pour que
    l'IA ne confonde pas un rejet de thème avec un rejet de constat."""
    par_theme: dict[str, list[str]] = {}
    for (key, theme), reaction in theme_feedback.items():
        par_theme.setdefault(theme, []).append(f"{KEY_LABELS.get(key, key)}:{reaction}")
    if not par_theme:
        return "aucun avis par thème encore"
    return "; ".join(f"{t} ({', '.join(r)})" for t, r in list(par_theme.items())[:10])


def _build_prompt(
    comments: list[dict],
    objectif: str | None,
    onboarding: dict,
    feedback: dict[str, str],
    verdicts: dict[str, str],
    insight_feedback: dict[str, str],
    theme_feedback: dict[tuple[str, str], str],
) -> str:
    obj_label = (OBJECTIFS.get(objectif or "") or {}).get("label", "non défini")

    lignes = []
    for c in comments[:40]:
        label = KEY_LABELS.get(c.get("reco_key", ""), c.get("reco_key", "conseil"))
        reaction = c.get("reaction") or "—"
        txt = (c.get("comment") or "").strip().replace("\n", " ")
        lignes.append(f"- [{label} · {reaction}] {txt}")
    corpus = "\n".join(lignes) or "aucun commentaire encore laissé"

    fb_txt = "; ".join(
        f"{KEY_LABELS.get(k, k)}: {v}" for k, v in list(feedback.items())[:20]
    ) or "aucune réaction encore"
    verdict_txt = "; ".join(
        f"{KEY_LABELS.get(k, k)} → {v}" for k, v in list(verdicts.items())[:20]
    ) or "aucun verdict mesuré encore"
    # Avis sur les CONSTATS GÉNÉRAUX (insights.py) — distinct de l'avis par thème.
    constats_txt = "; ".join(
        f"{k}: {v}" for k, v in list(insight_feedback.items())[:20]
    ) or "aucun avis encore"
    theme_txt = _theme_avis_txt(theme_feedback)

    return (
        "Tu construis le PROFIL CLIENT VIVANT d'un utilisateur d'un dashboard "
        "marketing. Ce profil calibre le TON et le NIVEAU DE DÉTAIL des futurs "
        "conseils — n'invente jamais un fait absent des données ci-dessous.\n\n"
        f"Profil déclaré à l'inscription (base fixe) : {_base_txt(onboarding)}. "
        f"Objectif principal : {obj_label}.\n\n"
        f"Réactions récentes aux conseils : {fb_txt}\n"
        f"Verdicts mesurés de ses actions, 14 jours après (better/worse/stable) : {verdict_txt}\n"
        f"Avis sur les CONSTATS GÉNÉRAUX du compte : {constats_txt}\n"
        f"Avis PAR THÈME (ne pas confondre avec les constats généraux ci-dessus) : {theme_txt}\n\n"
        "Commentaires libres (du plus récent au plus ancien) :\n"
        f"{corpus}\n\n"
        "Rédige un profil court et actionnable (français, 4 à 6 puces, pas "
        "d'intro). Couvre : niveau de maîtrise du sujet (débutant→expert, "
        "d'après les réactions et verdicts ci-dessus, pas seulement "
        "l'onboarding), ton qui lui parle, ce qui l'intéresse vraiment "
        "(précise si ça vient d'un constat général ou d'un thème précis), et "
        "ce qu'il faut ÉVITER (sujets, thèmes, formats, ton). Reste factuel, "
        "pas de flatterie, pas de guillemets."
    )


def _has_signal(
    comments: list[dict],
    onboarding: dict,
    feedback: dict,
    verdicts: dict,
    insight_feedback: dict,
    theme_feedback: dict,
) -> bool:
    return bool(
        comments or feedback or verdicts or insight_feedback or theme_feedback
        or any(onboarding.get(f) for f in _ONBOARDING_FIELDS)
    )


def build_user_persona(
    client,
    user_id,
    call_ai,
    objectif: str | None = None,
    comments: list[dict] | None = None,
    onboarding: dict | None = None,
    feedback: dict[str, str] | None = None,
    verdicts: dict[str, str] | None = None,
    insight_feedback: dict[str, str] | None = None,
    theme_feedback: dict[tuple[str, str], str] | None = None,
) -> str | None:
    """Retourne le profil client vivant (stocké ou recalculé). None si pas de matière.

    Conçu pour être appelé une fois par semaine, à la génération du rapport
    (`build_report.py`) — le rythme d'appel EST le rythme de mise à jour de
    l'état évolutif, pas une logique de cache interne à ce module.

    `comments`/`onboarding` sont refetchés si absents ; `feedback`/`verdicts`/
    `insight_feedback`/`theme_feedback` sont déjà calculés par l'appelant
    (build_report.py les a sous la main) et passés tels quels, {} par défaut.
    """
    if not (client and user_id and callable(call_ai)):
        return None
    if comments is None:
        try:
            comments = fetch_reco_comments(client, user_id)
        except Exception:
            comments = []
    if onboarding is None:
        try:
            onboarding = fetch_onboarding_profile(client, user_id)
        except Exception:
            onboarding = {}
    feedback = feedback or {}
    verdicts = verdicts or {}
    insight_feedback = insight_feedback or {}
    theme_feedback = theme_feedback or {}

    stored, _updated_at = fetch_user_profile(client, user_id)
    if not _has_signal(comments, onboarding, feedback, verdicts, insight_feedback, theme_feedback):
        return stored  # rien à raconter — on garde ce qui existe (souvent rien)

    persona = call_ai(_build_prompt(
        comments, objectif, onboarding, feedback, verdicts, insight_feedback, theme_feedback,
    ))
    if not persona:
        return stored  # l'IA a échoué → on garde l'ancien profil
    persona = persona.strip()
    try:
        save_user_profile(client, user_id, persona)
    except Exception:
        pass
    return persona


def regenerate_user_persona(
    client,
    user_id,
    call_ai,
    objectif: str | None = None,
    onboarding: dict | None = None,
    feedback: dict[str, str] | None = None,
    verdicts: dict[str, str] | None = None,
    insight_feedback: dict[str, str] | None = None,
    theme_feedback: dict[tuple[str, str], str] | None = None,
) -> str | None:
    """Force la régénération (bouton « Régénérer mon profil »)."""
    if not (client and user_id and callable(call_ai)):
        return None
    try:
        comments = fetch_reco_comments(client, user_id)
    except Exception:
        comments = []
    if onboarding is None:
        try:
            onboarding = fetch_onboarding_profile(client, user_id)
        except Exception:
            onboarding = {}
    persona = call_ai(_build_prompt(
        comments, objectif, onboarding,
        feedback or {}, verdicts or {}, insight_feedback or {}, theme_feedback or {},
    ))
    if persona:
        persona = persona.strip()
        try:
            save_user_profile(client, user_id, persona)
        except Exception:
            pass
        return persona
    return None
