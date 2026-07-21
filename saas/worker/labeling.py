"""Labellisation IA des contenus — headless, appelé par le worker de fetch.

Donne un thème (label) à chaque post Instagram et chaque campagne Meta/Google
qui n'en a pas encore, en UN appel Gemini batch par tranche de 80 items.
Les thèmes réutilisent la liste maîtresse profiles.labels ; l'IA peut en
proposer quelques nouveaux, ajoutés à la liste.

Règle d'or : un label posé par l'humain (label_source='user') n'est JAMAIS
réécrit. L'IA marque les siens label_source='ai' → corrigibles dans Pulse
(le sélecteur repasse la ligne en 'user').

Tout est best-effort : sans clé Gemini, sans données ou sur JSON invalide,
on log et on continue — le fetch n'échoue jamais à cause des labels.
"""

from __future__ import annotations
import json
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.app_secrets import secret  # noqa: E402
from scripts.fetch_data import _all_pages  # noqa: E402

_CHUNK = 80          # items max par appel Gemini
_MAX_NEW_THEMES = 5  # nouveaux thèmes max par appel (sinon la liste explose)


def call_gemini_json(prompt: str, timeout: int = 90) -> dict | None:
    """Appel Gemini avec réponse JSON attendue. None si pas de clé / échec / JSON invalide.

    thinkingBudget 0 : classer par thème n'a pas besoin de « réflexion » — sans ça,
    2.5-flash brûle ~8k jetons de thinking par batch (10× le coût, parfois > 45 s).
    responseMimeType json : sortie JSON native, plus de fences à nettoyer (on garde
    le nettoyage en repli).
    """
    api_key = secret("gemini.api_key")
    if not api_key:
        return None
    try:
        resp = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "thinkingConfig": {"thinkingBudget": 0},
                },
            },
            timeout=timeout,
        )
        txt = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
        if txt.startswith("```"):
            txt = txt.strip("`")
            txt = txt[4:] if txt.lower().startswith("json") else txt
        data = json.loads(txt.strip())
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def _is_ai_editable(source) -> bool:
    """True si l'IA a le droit d'écrire (jamais sur un choix humain)."""
    return source != "user"


def _collect_candidates(sb, user_id: str) -> tuple[list[dict], dict]:
    """Items sans thème que l'IA peut labelliser + contexte (liste maîtresse, configs).

    Les campagnes sont énumérées depuis les tables d'insights (pas les configs :
    une config n'existe qu'après un premier label) → couverture complète.
    """
    labels: list[str] = []
    business = ""
    try:
        r = sb.table("profiles").select("labels, business_type, objectif").eq("id", user_id).execute().data
        row = (r or [{}])[0]
        labels = list(row.get("labels") or [])
        # Contexte déclaré à l'onboarding → des thèmes qui collent au business
        _biz = {"ecommerce": "e-commerce", "local": "commerce local",
                "services": "services / B2B", "createur": "créateur / média"}
        _obj = {"ventes": "générer des ventes", "notoriete": "gagner en notoriété",
                "engagement": "faire réagir sa communauté"}
        bits = []
        if row.get("business_type"):
            bits.append(_biz.get(row["business_type"], row["business_type"]))
        if row.get("objectif"):
            bits.append(f"objectif : {_obj.get(row['objectif'], row['objectif'])}")
        business = ", ".join(bits)
    except Exception:
        try:
            r = sb.table("profiles").select("labels").eq("id", user_id).execute().data
            labels = list((r or [{}])[0].get("labels") or [])
        except Exception:
            pass

    # Posts Instagram — id (pk), caption, type, labels, label_source
    posts = []
    try:
        posts = (sb.table("instagram_organic_posts")
                 .select("id, caption, type, labels, label_source")
                 .eq("user_id", user_id).execute().data) or []
    except Exception:
        try:  # migration label_source pas encore passée
            posts = (sb.table("instagram_organic_posts")
                     .select("id, caption, type, labels")
                     .eq("user_id", user_id).execute().data) or []
        except Exception:
            posts = []

    # Campagnes Meta : noms distincts depuis les insights (PAGINÉ — Supabase
    # tronque à 1000 lignes, ce qui faisait rater des campagnes), croisés config
    meta_names: set[str] = set()
    try:
        rows = _all_pages(lambda: sb.table("meta_ads_insights")
                          .select("campaign_name").eq("user_id", user_id)
                          .order("date_start", desc=True))
        meta_names = {r["campaign_name"] for r in rows if r.get("campaign_name")}
    except Exception:
        pass
    meta_cfg: dict[str, dict] = {}
    try:
        rows = (sb.table("meta_campaign_config")
                .select("campaign_name, label, label_source")
                .eq("user_id", user_id).execute().data) or []
        meta_cfg = {r["campaign_name"]: r for r in rows}
    except Exception:
        pass

    # Campagnes Google : ids distincts depuis les insights (paginé, même raison)
    goog_ids: set[str] = set()
    try:
        rows = _all_pages(lambda: sb.table("google_ads_insights")
                          .select("campaign_id").eq("user_id", user_id)
                          .order("date_start", desc=True))
        goog_ids = {str(r["campaign_id"]) for r in rows if r.get("campaign_id")}
    except Exception:
        pass
    goog_cfg: dict[str, dict] = {}
    try:
        rows = (sb.table("google_campaign_config")
                .select("campaign_id, campaign_name, label, label_source")
                .eq("user_id", user_id).execute().data) or []
        goog_cfg = {str(r["campaign_id"]): r for r in rows}
    except Exception:
        pass

    candidates: list[dict] = []
    for p in posts:
        if (p.get("labels") or []) or not _is_ai_editable(p.get("label_source")):
            continue
        caption = str(p.get("caption") or "").strip()
        # Sans légende, l'IA classe au format/contexte (souvent un thème générique) —
        # mieux qu'un post invisible pour toujours dans l'angle mort de couverture.
        desc = f"\"{caption[:120]}\"" if caption else "(sans légende)"
        candidates.append({"kind": "post", "id": p["id"],
                           "desc": f"[{p.get('type') or 'POST'}] {desc}"})
    for name in sorted(meta_names):
        cfg = meta_cfg.get(name, {})
        if cfg.get("label") or not _is_ai_editable(cfg.get("label_source")):
            continue
        candidates.append({"kind": "meta", "id": name, "desc": f"[Campagne Meta] «{name}»"})
    for cid in sorted(goog_ids):
        cfg = goog_cfg.get(cid, {})
        if cfg.get("label") or not _is_ai_editable(cfg.get("label_source")):
            continue
        cname = cfg.get("campaign_name") or f"Campagne {cid}"
        candidates.append({"kind": "google", "id": cid, "name": cname,
                           "desc": f"[Campagne Google] «{cname}»"})

    return candidates, {"labels": labels, "business": business}


def _classify_chunk(items: list[dict], known_labels: list[str],
                    business: str = "") -> tuple[dict[str, str], list[str]]:
    """Un appel Gemini pour un lot d'items → ({ref: thème}, nouveaux thèmes retenus)."""
    lines = "\n".join(f"{i + 1}. {it['desc']}" for i, it in enumerate(items))
    existing = ", ".join(f"«{l}»" for l in known_labels) or "aucun pour l'instant"
    biz = f"Le client : {business}. " if business else ""
    data = call_gemini_json(
        "Tu classes les contenus marketing d'une PME suisse par THÈME (sujet business : "
        "produit, gamme, offre, événement… — jamais le format ni le canal). "
        f"{biz}"
        f"Thèmes existants, à réutiliser en priorité : {existing}. "
        f"Si aucun ne convient, propose au plus {_MAX_NEW_THEMES} nouveaux thèmes courts "
        "(1 à 3 mots, français, sans emoji). Chaque item reçoit EXACTEMENT un thème. "
        "Réponds UNIQUEMENT avec un objet JSON (aucun texte autour) : "
        '{"themes_nouveaux": ["…"], "labels": {"1": "thème", "2": "thème", …}} '
        "— les clés de \"labels\" sont les numéros des items ci-dessous.\n"
        f"Items :\n{lines}"
    )
    if not data or not isinstance(data.get("labels"), dict):
        return {}, []
    new_themes = [str(t).strip() for t in (data.get("themes_nouveaux") or [])
                  if str(t).strip()][:_MAX_NEW_THEMES]
    allowed = {l.strip() for l in known_labels} | set(new_themes)
    assign: dict[str, str] = {}
    for num, theme in data["labels"].items():
        theme = str(theme).strip()
        if theme not in allowed:
            continue  # thème fantôme → on ignore plutôt que polluer la liste
        try:
            idx = int(num) - 1
        except (TypeError, ValueError):
            continue
        if 0 <= idx < len(items):
            assign[f"{items[idx]['kind']}::{items[idx]['id']}"] = theme
    used = {t for t in assign.values()}
    return assign, [t for t in new_themes if t in used]


def auto_label(sb, user_id: str) -> str:
    """Labellise tous les contenus sans thème. Retourne une ligne de log."""
    if not secret("gemini.api_key"):
        return "labels: pas de clé Gemini"
    try:
        candidates, ctx = _collect_candidates(sb, user_id)
    except Exception as e:
        return f"labels KO: {e}"
    if not candidates:
        return "labels: à jour"

    known = list(ctx["labels"])
    assignments: dict[str, str] = {}
    created: list[str] = []
    for i in range(0, len(candidates), _CHUNK):
        chunk = candidates[i:i + _CHUNK]
        assign, new_themes = _classify_chunk(chunk, known, ctx.get("business", ""))
        assignments.update(assign)
        for t in new_themes:
            if t not in known:
                known.append(t)
                created.append(t)
    # Seconde passe : Gemini oublie parfois des numéros dans un gros batch —
    # on relance UNE fois sur les oubliés (couverture complète demandée).
    missed = [c for c in candidates if f"{c['kind']}::{c['id']}" not in assignments]
    if missed and assignments:
        for i in range(0, len(missed), _CHUNK):
            assign, new_themes = _classify_chunk(missed[i:i + _CHUNK], known, ctx.get("business", ""))
            assignments.update(assign)
            for t in new_themes:
                if t not in known:
                    known.append(t)
                    created.append(t)
    if not assignments:
        return "labels: Gemini n'a rien renvoyé d'exploitable"

    # Nouveaux thèmes → liste maîtresse (union triée, patron createLabel)
    if created:
        try:
            sb.table("profiles").update(
                {"labels": sorted(set(ctx["labels"]) | set(known))}
            ).eq("id", user_id).execute()
        except Exception:
            pass

    n_ok = 0
    by_item = {f"{c['kind']}::{c['id']}": c for c in candidates}
    for ref, theme in assignments.items():
        item = by_item.get(ref)
        if not item:
            continue
        try:
            if item["kind"] == "post":
                # Garde-fou write-time : ne jamais toucher un choix humain
                (sb.table("instagram_organic_posts")
                 .update({"labels": [theme], "label_source": "ai"})
                 .eq("id", item["id"]).eq("user_id", user_id)
                 .or_("label_source.is.null,label_source.neq.user")
                 .execute())
            elif item["kind"] == "meta":
                sb.table("meta_campaign_config").upsert(
                    {"user_id": user_id, "campaign_name": item["id"],
                     "label": theme, "label_source": "ai"},
                    on_conflict="user_id,campaign_name").execute()
            else:
                sb.table("google_campaign_config").upsert(
                    {"user_id": user_id, "campaign_id": item["id"],
                     "campaign_name": item.get("name") or f"Campagne {item['id']}",
                     "label": theme, "label_source": "ai"},
                    on_conflict="user_id,campaign_id").execute()
            n_ok += 1
        except Exception:
            continue

    extra = f", {len(created)} nouveaux thèmes ({', '.join(created)})" if created else ""
    return f"labels: {n_ok}/{len(candidates)} classés par l'IA{extra}"
