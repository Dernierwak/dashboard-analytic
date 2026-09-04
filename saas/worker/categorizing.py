"""Catégorisation IA des conversions GA4 — headless, appelé par le worker de fetch.

Donne une CATÉGORIE (Ventes, Contacts, Engagement…) à chaque événement du
catalogue GA4 (`profiles.ga4_event_catalog`) qui n'en a pas encore, en UN appel
Gemini batch (le catalogue tient en quelques dizaines de lignes, jamais besoin
de tranches comme `labeling.py`). Les catégories réutilisent la liste
maîtresse `conversion_categories` ; l'IA peut en proposer de nouvelles.

MÊME PATRON QUE `labeling.py`, ET C'EST VOULU (voir l'en-tête de
`triggerClassify`, saas/web/app/actions.ts, pour pourquoi ce second
classifieur ne contredit pas « une seule classification IA ») : un événement
catégorisé à la main (`category_source='user'`) n'est JAMAIS réécrit — l'IA
marque les siens `category_source='ai'`, corrigibles depuis /conversions (le
menu déroulant repasse la ligne en 'user').

Tout est best-effort : sans clé Gemini, sans catalogue ou sur JSON invalide,
on log et on continue — le fetch n'échoue jamais à cause des catégories.
"""

from __future__ import annotations
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from saas.scripts.app_secrets import secret  # noqa: E402
from saas.worker.labeling import call_gemini_json  # noqa: E402


def _collect_candidates(sb, user_id: str) -> tuple[list[str], dict]:
    """Noms d'événements du catalogue sans AUCUNE ligne dans ga4_event_categories
    + contexte (catégories maîtresses déjà créées)."""
    categories: list[str] = []
    try:
        r = sb.table("conversion_categories").select("name").eq("user_id", user_id).execute().data
        categories = sorted({str(row["name"]) for row in (r or []) if row.get("name")})
    except Exception:
        pass

    catalogue: list[str] = []
    try:
        prof = (sb.table("profiles").select("ga4_event_catalog")
                .eq("id", user_id).limit(1).execute().data) or [{}]
        brut = prof[0].get("ga4_event_catalog") or {}
        catalogue = [str(e["nom"]) for e in (brut.get("evenements") or [])
                     if e.get("nom")]
    except Exception:
        pass
    if not catalogue:
        return [], {"categories": categories}

    dejas: dict[str, str] = {}
    try:
        r = (sb.table("ga4_event_categories").select("event_name, category, category_source")
             .eq("user_id", user_id).execute().data) or []
        dejas = {row["event_name"]: row for row in r}
    except Exception:
        pass

    # Uniquement les événements SANS AUCUNE ligne dans ga4_event_categories —
    # ni humaine (`_is_ai_editable` le refuserait de toute façon), ni déjà
    # posée par l'IA lors d'une récolte précédente : reclasser un événement
    # déjà catégorisé par l'IA coûterait un appel Gemini pour rien à chaque
    # récolte, sans jamais rien changer (même catalogue, même contexte).
    candidates = [nom for nom in catalogue if nom not in dejas]
    return candidates, {"categories": categories}


def _classify(items: list[str], known: list[str]) -> tuple[dict[str, str], list[str]]:
    """Un appel Gemini → ({événement: catégorie}, nouvelles catégories retenues)."""
    lines = "\n".join(f"{i + 1}. {nom}" for i, nom in enumerate(items))
    existing = ", ".join(f"«{c}»" for c in known) or "aucune pour l'instant"
    data = call_gemini_json(
        "Tu classes des événements Google Analytics 4 d'une PME suisse par CATÉGORIE "
        "de conversion (le GENRE de conversion : Ventes, Contacts, Engagement, "
        "Inscriptions… — jamais le nom technique de l'événement lui-même). "
        f"Catégories existantes, à réutiliser en priorité : {existing}. "
        "Si aucune ne convient, propose au plus 5 nouvelles catégories courtes "
        "(1 à 2 mots, français, sans emoji). Chaque événement reçoit EXACTEMENT une "
        "catégorie. Réponds UNIQUEMENT avec un objet JSON (aucun texte autour) : "
        '{"categories_nouvelles": ["…"], "categories": {"1": "catégorie", "2": "catégorie", …}} '
        "— les clés de \"categories\" sont les numéros des événements ci-dessous.\n"
        f"Événements :\n{lines}"
    )
    if not data or not isinstance(data.get("categories"), dict):
        return {}, []
    new_cats = [str(c).strip() for c in (data.get("categories_nouvelles") or [])
                if str(c).strip()][:5]
    allowed = {c.strip() for c in known} | set(new_cats)
    assign: dict[str, str] = {}
    for num, cat in data["categories"].items():
        cat = str(cat).strip()
        if cat not in allowed:
            continue
        try:
            idx = int(num) - 1
        except (TypeError, ValueError):
            continue
        if 0 <= idx < len(items):
            assign[items[idx]] = cat
    used = set(assign.values())
    return assign, [c for c in new_cats if c in used]


def auto_categorize(sb, user_id: str) -> str:
    """Catégorise tous les événements GA4 sans catégorie. Retourne une ligne de log."""
    if not secret("gemini.api_key"):
        return "categories: pas de clé Gemini"
    try:
        candidates, ctx = _collect_candidates(sb, user_id)
    except Exception as e:
        return f"categories KO: {e}"
    if not candidates:
        return "categories: à jour"

    known = list(ctx["categories"])
    assign, new_cats = _classify(candidates, known)
    if not assign:
        return "categories: Gemini n'a rien renvoyé d'exploitable"

    if new_cats:
        for c in new_cats:
            try:
                sb.table("conversion_categories").upsert(
                    {"user_id": user_id, "name": c}, on_conflict="user_id,name"
                ).execute()
            except Exception:
                pass

    n_ok = 0
    for nom, cat in assign.items():
        try:
            sb.table("ga4_event_categories").upsert(
                {"user_id": user_id, "event_name": nom, "category": cat,
                 "category_source": "ai"},
                on_conflict="user_id,event_name",
            ).execute()
            n_ok += 1
        except Exception:
            continue

    extra = f", {len(new_cats)} nouvelles catégories ({', '.join(new_cats)})" if new_cats else ""
    return f"categories: {n_ok}/{len(candidates)} classées par l'IA{extra}"
