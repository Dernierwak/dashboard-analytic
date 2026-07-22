"""Construit et publie le rapport hebdo précalculé (weekly_reports.payload) — headless.

Réplique de la préparation de pages/rapport.py : mêmes fenêtres (7 jours pleins
ancrés sur la dernière donnée, jamais aujourd'hui), même moteur de recos, même
structure de payload. Deux producteurs, un consommateur :
  • le Streamlit publie à l'ouverture du rapport (pont, avec persona IA) ;
  • ce worker publie après le fetch cron → Pulse est frais le lundi matin
    sans que personne n'ouvre quoi que ce soit.

Différence assumée : le brief IA du worker n'utilise pas le persona utilisateur
(il vit dans la session Streamlit) — fallback déterministe si Gemini échoue.

Usage :
  python saas/worker/build_report.py --user <uuid> [--print]
  python saas/worker/build_report.py --all
"""

from __future__ import annotations
import sys
import json
from datetime import date, timedelta
from pathlib import Path

# Permet d'importer scripts/ et components/ quel que soit le cwd
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

import pandas as pd  # noqa: E402
import requests  # noqa: E402

from scripts.app_secrets import secret  # noqa: E402
from scripts.fetch_data import (  # noqa: E402
    fetch_meta_ads, fetch_post_metrics, fetch_daily_followers,
    fetch_objectif, fetch_reco_feedback, fetch_google_ads,
    fetch_campaign_config, fetch_google_campaign_config, fetch_reco_decisions,
    fetch_insight_feedback,
)
from scripts.insert_data import upsert_weekly_report  # noqa: E402
from components.reco_engine import build_recos, KEY_LABELS, OBJECTIFS  # noqa: E402
from saas.worker.insights import build_matrix, build_constats  # noqa: E402

MONTHS_FR = {1: "jan", 2: "fév", 3: "mar", 4: "avr", 5: "mai", 6: "jun",
             7: "jul", 8: "aoû", 9: "sep", 10: "oct", 11: "nov", 12: "déc"}


def _call_gemini(prompt: str) -> str | None:
    api_key = secret("gemini.api_key")
    if not api_key:
        return None
    try:
        resp = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
            json={"contents": [{"parts": [{"text": prompt}]}]},
            timeout=20,
        )
        return resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
    except Exception:
        return None


# Champs d'une reco tels que stockés dans le payload (miroir du dict _reco()).
RECO_FIELDS = ("key", "platform", "title", "observation", "pourquoi", "verifier",
               "repere", "angle_mort", "confidence", "priority", "source")


def _strip_reco(r: dict) -> dict:
    return {k: r.get(k) for k in RECO_FIELDS}


def _theme_ai_recos(theme: str, camps: list, tsummary: dict | None,
                    obj_txt: str, want: int = 3) -> list[dict]:
    """Jusqu'à `want` pistes IA DISTINCTES pour un thème, en UN seul appel Gemini
    (léger, thinking off). [] si Gemini échoue → jamais bloquant."""
    import json as _json
    if want <= 0:
        return []
    facts = "; ".join(
        f"{c['name']} [{c['channel']}] {c['spend']:.0f} CHF, CTR {c.get('ctr', 0):.1f} %"
        + (f", revenu {c['revenue']:.0f} CHF" if c.get("revenue") is not None else "")
        for c in camps[:12]) or "aucune campagne pub sur ce thème"
    s = tsummary or {}
    roas_txt = f", ROAS {s['roas']:.1f}" if s.get("roas") is not None else ""
    raw = _call_gemini(
        "Tu es un consultant marketing senior pour une PME suisse. "
        f"On travaille UNIQUEMENT sur le thème « {theme} » (objectif du compte : {obj_txt}). "
        f"Ce thème sur tout l'historique : {s.get('spend', 0):.0f} CHF dépensés"
        f"{roas_txt}, {s.get('posts', 0)} posts. "
        f"Ses campagnes : {facts}. "
        f"Propose {want} idées DISTINCTES et concrètes pour améliorer CE thème cette "
        "semaine (chacune sur un levier différent : cible, créa, budget, canal, format…). "
        "Réponds UNIQUEMENT avec un tableau JSON de "
        f"{want} objets, chacun avec ces clés : "
        '{"title","observation","pourquoi","verifier","angle_mort"}. '
        "Titres courts. Français, ton direct, ne déforme aucun chiffre fourni."
    )
    if not raw:
        return []
    try:
        txt = raw.strip()
        if txt.startswith("```"):
            txt = txt.strip("`")
            txt = txt[4:] if txt.lower().startswith("json") else txt
        arr = _json.loads(txt.strip())
        if isinstance(arr, dict):  # tolérance : un seul objet renvoyé
            arr = [arr]
        out = []
        for i, d in enumerate(arr[:want]):
            if not isinstance(d, dict):
                continue
            if all(d.get(k) for k in ("title", "observation", "pourquoi", "verifier", "angle_mort")):
                out.append({
                    "key": f"ai_{theme}_{i + 1}", "platform": "ia",
                    "title": str(d["title"])[:90],
                    "observation": str(d["observation"]), "pourquoi": str(d["pourquoi"]),
                    "verifier": str(d["verifier"]), "repere": "",
                    "angle_mort": str(d["angle_mort"]),
                    "confidence": "piste", "priority": 9 + i, "source": "ai",
                })
        return out
    except Exception:
        return []


def build_payload(sb, user_id: str) -> dict | None:
    """Prépare le payload du rapport hebdo. None si pas assez de données."""
    today = date.today()

    # ── Chargement (mêmes fetchers que le rapport) ────────────────────────────
    df_meta_raw = None
    df_insta = pd.DataFrame()
    df_follows = pd.DataFrame()
    try:
        meta_data = fetch_meta_ads(sb, user_id)
        if meta_data:
            df_meta_raw = pd.DataFrame(meta_data)
    except Exception:
        pass
    try:
        df_insta = pd.DataFrame(fetch_post_metrics(sb, user_id) or [])
    except Exception:
        pass
    try:
        df_follows = pd.DataFrame(fetch_daily_followers(sb, user_id) or [])
    except Exception:
        pass
    df_google = pd.DataFrame()
    try:
        df_google = pd.DataFrame(fetch_google_ads(sb, user_id) or [])
    except Exception:
        pass

    # ── Fenêtre : 7 jours pleins ancrés sur la dernière donnée (jamais aujourd'hui)
    yesterday = today - timedelta(days=1)
    _data_dates = []
    if df_meta_raw is not None and "date_start" in df_meta_raw.columns:
        _d = pd.to_datetime(df_meta_raw["date_start"], errors="coerce").max()
        if pd.notna(_d):
            _data_dates.append(_d.date())
    if not df_insta.empty and "date" in df_insta.columns:
        _d = pd.to_datetime(df_insta["date"], errors="coerce", utc=True).max()
        if pd.notna(_d):
            _data_dates.append(_d.date())
    if not df_follows.empty and "fetched_at" in df_follows.columns:
        _d = pd.to_datetime(df_follows["fetched_at"], errors="coerce", utc=True).max()
        if pd.notna(_d):
            _data_dates.append(_d.date())
    last_data_date = max(_data_dates) if _data_dates else yesterday

    last_full_day = min(last_data_date, yesterday)
    cur_since = last_full_day - timedelta(days=6)
    prev_until = cur_since - timedelta(days=1)
    prev_since = prev_until - timedelta(days=6)

    # ── Meta Ads : agrégats + par campagne ────────────────────────────────────
    total_spend = 0.0
    total_clicks = 0
    total_impr = 0
    avg_ctr = 0.0
    clicks_delta_pct = None
    df_camp = pd.DataFrame()
    if df_meta_raw is not None and not df_meta_raw.empty:
        for col in ["impressions", "clicks", "spend"]:
            if col in df_meta_raw.columns:
                df_meta_raw[col] = pd.to_numeric(df_meta_raw[col], errors="coerce").fillna(0)
        df_meta_raw["date_start"] = pd.to_datetime(df_meta_raw["date_start"], errors="coerce")
        df_meta = df_meta_raw[
            (df_meta_raw["date_start"] >= pd.Timestamp(cur_since))
            & (df_meta_raw["date_start"] <= pd.Timestamp(last_full_day))
        ]
        df_meta_prev = df_meta_raw[
            (df_meta_raw["date_start"] >= pd.Timestamp(prev_since))
            & (df_meta_raw["date_start"] <= pd.Timestamp(prev_until))
        ]
        if not df_meta.empty:
            total_spend = float(df_meta["spend"].sum())
            total_clicks = int(df_meta["clicks"].sum())
            total_impr = int(df_meta["impressions"].sum())
            avg_ctr = (total_clicks / total_impr * 100) if total_impr > 0 else 0.0
            if not df_meta_prev.empty:
                prev_clicks = int(df_meta_prev["clicks"].sum())
                if prev_clicks > 0:
                    clicks_delta_pct = round((total_clicks - prev_clicks) / prev_clicks * 100)
            df_camp = df_meta.groupby("campaign_name", as_index=False).agg(
                spend=("spend", "sum"), clicks=("clicks", "sum"), impressions=("impressions", "sum")
            )
            df_camp["ctr"] = df_camp.apply(
                lambda r: r["clicks"] / r["impressions"] * 100 if r["impressions"] > 0 else 0, axis=1)
            df_camp["cpc"] = df_camp.apply(
                lambda r: r["spend"] / r["clicks"] if r["clicks"] > 0 else 0, axis=1)

    # ── Google Ads : mêmes fenêtres (KPIs email) + FUSION dans df_camp ────────
    # → le moteur voit toute la pub (ROAS = revenu payant / dépense Meta+Google).
    g_spend = 0.0
    g_clicks = 0
    g_impr = 0
    if not df_google.empty and "date_start" in df_google.columns:
        df_google["date_start"] = pd.to_datetime(df_google["date_start"], errors="coerce")
        for col in ["cost_micros", "clicks", "impressions"]:
            if col in df_google.columns:
                df_google[col] = pd.to_numeric(df_google[col], errors="coerce").fillna(0)
        df_g = df_google[
            (df_google["date_start"] >= pd.Timestamp(cur_since))
            & (df_google["date_start"] <= pd.Timestamp(last_full_day))
        ].copy()
        if not df_g.empty:
            g_spend = float(df_g["cost_micros"].sum()) / 1_000_000.0
            g_clicks = int(df_g["clicks"].sum())
            g_impr = int(df_g["impressions"].sum())
            if "campaign_id" in df_g.columns:
                try:
                    gnames = {str(k): (v or {}).get("campaign_name") or f"Campagne {k}"
                              for k, v in (fetch_google_campaign_config(sb, user_id) or {}).items()}
                except Exception:
                    gnames = {}
                df_g["_cid"] = df_g["campaign_id"].astype(str)
                gagg = df_g.groupby("_cid", as_index=False).agg(
                    spend=("cost_micros", "sum"), clicks=("clicks", "sum"),
                    impressions=("impressions", "sum"))
                gagg["spend"] = gagg["spend"] / 1_000_000.0
                gagg["campaign_name"] = gagg["_cid"].map(lambda c: gnames.get(c, f"Campagne {c}"))
                gagg["ctr"] = gagg.apply(
                    lambda r: r["clicks"] / r["impressions"] * 100 if r["impressions"] > 0 else 0, axis=1)
                gagg["cpc"] = gagg.apply(
                    lambda r: r["spend"] / r["clicks"] if r["clicks"] > 0 else 0, axis=1)
                gcols = ["campaign_name", "spend", "clicks", "impressions", "ctr", "cpc"]
                df_camp = (pd.concat([df_camp, gagg[gcols]], ignore_index=True)
                           if not df_camp.empty else gagg[gcols])

    # ── Instagram ─────────────────────────────────────────────────────────────
    followers_current = 0
    followers_delta = 0
    avg_engagement = 0.0
    week_eng = None
    week_reach = None
    hist_reach = None
    df_week_posts = pd.DataFrame()
    if not df_follows.empty and "followers" in df_follows.columns:
        df_follows = df_follows.sort_values("fetched_at", ascending=False)
        followers_current = int(df_follows.iloc[0]["followers"])
        if len(df_follows) >= 7:
            followers_delta = followers_current - int(df_follows.iloc[6]["followers"])
    if not df_insta.empty:
        for col in ["likes", "reach", "comments", "saved"]:
            if col in df_insta.columns:
                df_insta[col] = pd.to_numeric(df_insta[col], errors="coerce").fillna(0)
        if "reach" in df_insta.columns:
            df_insta["eng"] = df_insta.apply(
                lambda r: (r.get("likes", 0) + r.get("comments", 0) + r.get("saved", 0)) / r["reach"] * 100
                if r["reach"] > 0 else 0, axis=1)
            avg_engagement = float(df_insta["eng"].mean())
            hist_reach = float(df_insta["reach"].mean())
            if "date" in df_insta.columns:
                _dt = pd.to_datetime(df_insta["date"], errors="coerce")
                mask_week = (_dt.dt.date >= cur_since) & (_dt.dt.date <= last_full_day)
                df_week_posts = df_insta[mask_week]
                if len(df_week_posts) > 0:
                    week_eng = float(df_week_posts["eng"].mean())
                    week_reach = float(df_week_posts["reach"].mean())

    has_data = total_spend > 0 or g_spend > 0 or followers_current > 0
    if not has_data:
        return None

    week_num = today.isocalendar()[1]
    week_label = (
        f"Semaine {week_num} · {cur_since.day} → {last_full_day.day} "
        f"{MONTHS_FR[last_full_day.month]} · 7 jours pleins"
    )

    # ── Profil + GA4 + recos (même moteur que le rapport) ────────────────────
    objectif = None
    feedback: dict = {}
    try:
        objectif = fetch_objectif(sb, user_id)
        feedback = fetch_reco_feedback(sb, user_id)
    except Exception:
        pass
    try:
        from components.ga4 import build_ga4_context
        ga4_ctx = build_ga4_context(sb, user_id, cur_since, last_full_day)
    except Exception:
        ga4_ctx = None

    # ── Configs campagnes (labels) — servent la matrice ET le bloc thèmes ─────
    try:
        meta_cfg = fetch_campaign_config(sb, user_id) or {}
        goog_cfg = {str(k): v for k, v in (fetch_google_campaign_config(sb, user_id) or {}).items()}
    except Exception:
        meta_cfg, goog_cfg = {}, {}

    # ── Vision globale : matrice full-history + constats validables ──────────
    # Toute la profondeur disponible (Ads depuis le 1er janvier, posts stockés),
    # pas la fenêtre 7 jours. Les verdicts du client (insight_feedback) sont
    # réappliqués à chaque régénération — un constat rejeté reste écarté.
    matrix = None
    constats: list = []
    priority_labels: list = []
    try:
        hist_since = date(today.year, 1, 1)
        try:
            from components.ga4 import build_ga4_context as _bgc_full
            ga4_full = _bgc_full(sb, user_id, hist_since, last_full_day)
        except Exception:
            ga4_full = None
        matrix = build_matrix(df_meta_raw, df_google,
                              df_insta if not df_insta.empty else None,
                              meta_cfg, goog_cfg, ga4_full, last_full_day)
        ins_fb = fetch_insight_feedback(sb, user_id)
        # Thèmes prioritaires (max 3, choisis page Thèmes) — stockés dans
        # insight_feedback sous la clé priority_label:<nom> : le client ne peut
        # pas tout travailler, l'analyse se concentre sur ses priorités.
        priority_labels = sorted({
            k.split(":", 1)[1] for k, v in ins_fb.items()
            if k.startswith("priority_label:") and v == "agree" and ":" in k
        })[:3]
        constats = build_constats(matrix, ins_fb, priority_labels)
    except Exception:
        matrix, constats = None, []

    rule_recos = build_recos(
        df_camp=df_camp if not df_camp.empty else None,
        avg_ctr=avg_ctr,
        df_insta=df_insta if not df_insta.empty else None,
        df_week_posts=df_week_posts,
        followers_current=followers_current,
        ga4=ga4_ctx,
        objectif=objectif,
        feedback=feedback,
        vision=constats,
    )

    # ── Recos PAR THÈME : le client travaille label par label, cross-canal ────
    # Chaque thème prioritaire (≤3 ; sinon les 3 plus gros) reçoit ses propres
    # conseils, calculés sur SES campagnes (Meta+Google) et SES posts seulement.
    # Les conseils « réglages » (GA4, funnel) sont sortis dans un bloc à part.
    SETUP_KEYS = {"ga4_muet", "connecter_ga4", "funnel"}
    _obj_txt0 = OBJECTIFS[objectif]["label"] if objectif in OBJECTIFS else "non défini"

    def _nrm(s):
        return str(s or "").strip().lower()

    name2label = {}
    for _n, _c in (meta_cfg or {}).items():
        if (_c or {}).get("label"):
            name2label[_nrm(_n)] = _c["label"]
    for _cid, _c in (goog_cfg or {}).items():
        if (_c or {}).get("label") and (_c or {}).get("campaign_name"):
            name2label[_nrm(_c["campaign_name"])] = _c["label"]

    theme_list = list(priority_labels)
    if not theme_list and matrix and matrix.get("themes"):
        theme_list = [t["label"] for t in matrix["themes"][:3] if (t.get("spend") or 0) > 0]

    matrix_campaigns = (matrix or {}).get("campaigns", [])
    matrix_themes_by = {_nrm(t["label"]): t for t in (matrix or {}).get("themes", [])}

    themes_focus = []
    for lbl in theme_list:
        nlbl = _nrm(lbl)
        t_camps = [c for c in matrix_campaigns if _nrm(c.get("label")) == nlbl]

        # Sous-ensembles de la semaine pour faire tourner les règles sur ce thème
        tc = None
        if df_camp is not None and not df_camp.empty:
            _mask = df_camp["campaign_name"].map(lambda n: name2label.get(_nrm(n)) == lbl)
            tc = df_camp[_mask]
            tc = tc if not tc.empty else None

        def _has(labels, _l=lbl):
            return isinstance(labels, (list, tuple)) and _l in labels
        ti = pd.DataFrame()
        tw = pd.DataFrame()
        if df_insta is not None and not df_insta.empty and "labels" in df_insta.columns:
            ti = df_insta[df_insta["labels"].map(_has)]
        if df_week_posts is not None and not df_week_posts.empty and "labels" in df_week_posts.columns:
            tw = df_week_posts[df_week_posts["labels"].map(_has)]

        t_recos = build_recos(
            df_camp=tc, avg_ctr=avg_ctr,
            df_insta=ti if not ti.empty else None,
            df_week_posts=tw, followers_current=followers_current,
            ga4=ga4_ctx, objectif=objectif, feedback=feedback, vision=constats,
        )
        t_recos = sorted((r for r in t_recos if r.get("key") not in SETUP_KEYS),
                         key=lambda r: r["priority"])
        # On vise 3 conseils par thème : les règles d'abord, puis on COMPLÈTE avec
        # autant de pistes IA distinctes que nécessaire (souvent 3, car les règles
        # se déclenchent rarement sur un seul thème).
        _need = max(0, 3 - len(t_recos))
        try:
            _ai = _theme_ai_recos(lbl, t_camps, matrix_themes_by.get(nlbl), _obj_txt0, want=_need)
        except Exception:
            _ai = []
        t_recos = (t_recos + _ai)[:3]

        tt = matrix_themes_by.get(nlbl, {})
        summary = {
            "spend": tt.get("spend"), "revenue": tt.get("revenue"), "roas": tt.get("roas"),
            "ctr": tt.get("ctr"), "posts": tt.get("posts"),
            "reach_avg": tt.get("reach_avg"), "eng_avg": tt.get("eng_avg"),
            "spend_week": round(float(tc["spend"].sum()), 2) if tc is not None else 0.0,
            "best_campaign": t_camps[0]["name"] if t_camps else None,
            "n_campaigns": len(t_camps),
        }
        themes_focus.append({
            "label": lbl,
            "is_priority": lbl in priority_labels,
            "summary": summary,
            "campaigns": [
                {k: c.get(k) for k in ("name", "channel", "key", "label",
                                       "label_source", "spend", "revenue", "ctr", "cpc")}
                for c in t_camps[:8]
            ],
            "recos": [_strip_reco(r) for r in t_recos],
        })

    # Réglages de base : les conseils « socle » (GA4 muet, connexion, funnel),
    # sortis du flux par thème — ce sont des prérequis, pas du pilotage hebdo.
    reglages = [_strip_reco(r) for r in sorted(rule_recos, key=lambda r: r["priority"])
                if r.get("key") in SETUP_KEYS][:3]

    # ── Verdict déterministe (même logique que le rapport) ───────────────────
    _signals = []
    if week_eng is not None and avg_engagement > 0:
        _signals.append(((week_eng - avg_engagement) / avg_engagement * 100,
                         "l'engagement Instagram"))
    if week_reach is not None and hist_reach:
        _signals.append(((week_reach - hist_reach) / hist_reach * 100,
                         "la portée de tes posts"))
    if clicks_delta_pct:
        _signals.append((clicks_delta_pct, "les clics publicitaires"))
    if _signals:
        _val, _name = max(_signals, key=lambda s: abs(s[0]))
        if _val >= 10:
            verdict = f"Semaine en progression — portée par {_name} ({_val:+.0f} %)."
        elif _val <= -10:
            verdict = f"Semaine en retrait — {_name} ({_val:.0f} %), le reste tient."
        else:
            verdict = "Semaine stable — dans tes normes habituelles."
        if followers_delta and abs(followers_delta) >= 5:
            verdict += f" {'+' if followers_delta > 0 else ''}{followers_delta} abonnés."
    elif followers_delta:
        verdict = f"{'+' if followers_delta > 0 else ''}{followers_delta} abonnés cette semaine."
    else:
        verdict = "Première semaine de données — le rapport s'affinera avec l'historique."
    _alert = next((r for r in rule_recos
                   if r.get("confidence") == "solide"
                   and str(r.get("title", "")).startswith("Alerte")), None)
    if _alert:
        verdict += (" Un point rouge à traiter : "
                    f"{KEY_LABELS.get(_alert.get('key'), 'voir le brief ci-dessous')}.")

    # ── Sélection (2 insta + 3 pub, digest 3) — comme le rapport ─────────────
    by_section = {"instagram": [], "meta": []}
    for r in rule_recos:
        p = r.get("platform")
        if p == "instagram":
            by_section["instagram"].append(r)
        elif p in ("meta", "google", "pub"):
            by_section["meta"].append(r)
    insta_items = sorted(by_section["instagram"], key=lambda r: r["priority"])[:2]
    meta_items = sorted(by_section["meta"], key=lambda r: r["priority"])[:3]
    todos = sorted(insta_items + meta_items, key=lambda r: r["priority"])[:3]

    # ── Brief IA (sans persona en headless) + fallback déterministe ──────────
    _done = [KEY_LABELS.get(k, k) for k, v in feedback.items() if v == "done"]
    _skip = [KEY_LABELS.get(k, k) for k, v in feedback.items() if v == "not_for_me"]
    fb_txt = ""
    if _done:
        fb_txt += f" Déjà traité récemment : {', '.join(_done)}."
    if _skip:
        fb_txt += f" Jugé non pertinent (ne pas réinsister) : {', '.join(_skip)}."
    obj_txt = OBJECTIFS[objectif]["label"] if objectif in OBJECTIFS else "non défini"
    _top_todo = todos[0]["title"] if todos else None
    _prio_line = (
        f"La priorité n°1 de la semaine (déjà calculée, ne la change pas) : {_top_todo}. "
        if _top_todo else ""
    )
    # La vision globale cadre l'IA : elle s'appuie sur ce que le client a validé,
    # jamais sur ce qu'il a rejeté.
    _v_ok = [c for c in constats if c["status"] in ("agree", "new") and c["kind"] != "angle_mort"]
    _v_no = [c for c in constats if c["status"] == "reject"]
    vision_txt = ""
    if priority_labels:
        vision_txt += (" Thèmes PRIORITAIRES choisis par le client (concentre tes conseils "
                       f"dessus, ignore le reste sauf urgence) : {', '.join(priority_labels)}.")
    if _v_ok:
        vision_txt += (" Vision long terme du compte (validée, appuie-toi dessus) : "
                       + " | ".join(f"{c['title']} — {c['detail']}" for c in _v_ok) + ".")
    if _v_no:
        vision_txt += (" Constats REJETÉS par le client (ne t'appuie JAMAIS dessus) : "
                       + " | ".join(c["title"] for c in _v_no) + ".")
    brief = _call_gemini(
        "Tu es un consultant marketing pour une PME. Rédige le brief de la semaine en "
        "3 phrases maximum (français, ton concret et direct, pas de guillemets) : "
        "1) ce qui a MARCHÉ cette semaine et vaut d'être reproduit ; "
        "2) si des actions ont déjà été traitées, reconnais-le en un mot ; "
        "3) termine par la priorité n°1, formulée simplement. "
        "Vocabulaire précis exigé : un ROAS sous 1 se dit « inférieur à 1 », "
        "jamais « négatif » ; ne déforme aucun chiffre fourni. "
        f"Objectif principal du compte : {obj_txt}.{fb_txt}{vision_txt} "
        f"{_prio_line}"
        f"Données : abonnés {followers_delta:+d}, engagement {avg_engagement:.1f}%, "
        f"CTR {avg_ctr:.2f}%, dépense {total_spend:.0f} CHF. "
        "Si rien n'a vraiment marché, dis-le simplement — pas de flatterie artificielle."
    )
    if not brief:
        bits = []
        if followers_delta > 0:
            bits.append(f"+{followers_delta} abonnés cette semaine")
        if avg_engagement >= 3:
            bits.append(f"engagement à {avg_engagement:.1f}%")
        if avg_ctr >= 2:
            bits.append(f"un CTR pub de {avg_ctr:.1f}%")
        brief = ("Bonne nouvelle : " + ", ".join(bits) + "." if bits
                 else "Semaine calme — rien de marquant, mais rien qui dérape non plus.")
        if _top_todo:
            brief += f" Priorité n°1 : {_top_todo}."

    # ── Reco IA : UNE suggestion générative en complément des règles ─────────
    # Badge IA + confiance « piste » (c'est une idée à tester, pas un fait).
    # Ne répète pas les conseils des règles ; JSON strict, sinon on s'en passe.
    ai_reco = None
    try:
        import json as _json
        # Digest COMPLET de la matrice full-history : l'IA voit la totalité des
        # campagnes et posts, pas un top 3 — sa suggestion peut porter sur
        # n'importe lequel (couverture demandée par le client).
        matrix_facts = ""
        if matrix:
            mcamps = matrix["campaigns"]
            lines = [
                f"{c['name']} [{c['channel']}] : {c['spend']:.0f} CHF, CPC {c['cpc']:.2f}, "
                f"CTR {c['ctr']:.1f} %"
                + (f", revenu {c['revenue']:.0f} CHF" if c.get("revenue") is not None else "")
                + (f", thème {c['label']}" if c.get("label") else "")
                for c in mcamps[:25]
            ]
            if len(mcamps) > 25:
                _rest = mcamps[25:]
                lines.append(f"+ {len(_rest)} autres campagnes ({sum(c['spend'] for c in _rest):.0f} CHF cumulés)")
            th = " ; ".join(
                f"{t['label']} ({t['spend']:.0f} CHF"
                + (f", ROAS {t['roas']:.1f}" if t.get("roas") is not None else "")
                + (f", {t['posts']} posts" if t.get("posts") else "") + ")"
                for t in matrix["themes"][:8])
            fm = " ; ".join(
                f"{f['format']} ({f['posts']} posts, portée moy {f['reach_avg']:.0f})"
                for f in matrix["formats"])
            cov = matrix["coverage"]
            matrix_facts = (
                f" Historique complet ({matrix['period']['days']} jours) — tu vois la TOTALITÉ : "
                f"{cov['campaigns_total']} campagnes et {cov['posts_total']} posts. "
                f"Campagnes : {' | '.join(lines) or 'aucune'}. "
                f"Thèmes : {th or 'aucun'}. Formats : {fm or 'aucun'}.")
        known = " ; ".join(r["title"] for r in rule_recos)
        ai_raw = _call_gemini(
            "Tu es un consultant marketing senior pour une PME suisse. "
            f"Faits de la semaine : dépense pub {float(df_camp['spend'].sum()) if not df_camp.empty else 0:.0f} CHF, "
            f"CTR {avg_ctr:.2f} %, abonnés Instagram {followers_delta:+d}, "
            f"engagement moyen {avg_engagement:.1f} %."
            f"{matrix_facts}{vision_txt} "
            f"Objectif du client : {obj_txt}. "
            f"Conseils DÉJÀ donnés cette semaine (n'en répète aucun) : {known or 'aucun'}. "
            "Propose UNE seule idée d'action originale, concrète et faisable cette semaine, "
            "cohérente avec la vision long terme validée. "
            "Réponds UNIQUEMENT avec un objet JSON (aucun texte autour) avec exactement ces clés : "
            '{"title": "titre court", '
            '"observation": "le fait chiffré qui motive cette idée — uniquement des chiffres fournis ci-dessus", '
            '"pourquoi": "pourquoi ça peut marcher", '
            '"verifier": "comment la tester à petite échelle avant de généraliser", '
            '"angle_mort": "ce que cette idée ignore"}. '
            "Français, ton direct, ne déforme aucun chiffre."
        )
        if ai_raw:
            txt = ai_raw.strip()
            if txt.startswith("```"):
                txt = txt.strip("`")
                txt = txt[4:] if txt.lower().startswith("json") else txt
            data = _json.loads(txt.strip())
            if all(data.get(k) for k in ("title", "observation", "pourquoi", "verifier", "angle_mort")):
                ai_reco = {
                    "key": "ai", "platform": "ia",
                    "title": str(data["title"])[:90],
                    "observation": str(data["observation"]),
                    "pourquoi": str(data["pourquoi"]),
                    "verifier": str(data["verifier"]),
                    "repere": "",
                    "angle_mort": str(data["angle_mort"]),
                    "confidence": "piste", "priority": 9, "source": "ai",
                }
    except Exception:
        ai_reco = None

    _n_done = sum(1 for v in feedback.values() if v == "done")
    _n_useful = sum(1 for v in feedback.values() if v == "useful")
    _n_skip = sum(1 for v in feedback.values() if v == "not_for_me")

    # ── Thèmes : dépense par label × revenu GA4 (même logique que le rapport) ─
    # (meta_cfg / goog_cfg déjà chargés plus haut pour la matrice)
    themes = None
    if ga4_ctx and ga4_ctx.get("by_campaign"):
        def _norm(s):
            return str(s or "").strip().lower()
        sp_lbl: dict = {}
        if not df_camp.empty:
            for _, r in df_camp.iterrows():
                lbl = (meta_cfg.get(r["campaign_name"], {}) or {}).get("label")
                if lbl:
                    sp_lbl[lbl] = sp_lbl.get(lbl, 0.0) + float(r["spend"])
        if not df_google.empty and "campaign_id" in df_google.columns:
            gw = df_google[
                (df_google["date_start"] >= pd.Timestamp(cur_since))
                & (df_google["date_start"] <= pd.Timestamp(last_full_day))
            ].copy()
            if not gw.empty:
                gw["_cid"] = gw["campaign_id"].astype(str)
                gw["_chf"] = pd.to_numeric(gw["cost_micros"], errors="coerce").fillna(0) / 1_000_000.0
                for cid, chf in gw.groupby("_cid")["_chf"].sum().items():
                    lbl = (goog_cfg.get(cid, {}) or {}).get("label")
                    if lbl and chf > 0:
                        sp_lbl[lbl] = sp_lbl.get(lbl, 0.0) + float(chf)
        name_lbl = {_norm(n): (c or {}).get("label")
                    for n, c in meta_cfg.items() if (c or {}).get("label")}
        for cid, c in goog_cfg.items():
            if (c or {}).get("label") and c.get("campaign_name"):
                name_lbl.setdefault(_norm(c["campaign_name"]), c["label"])
        rv_lbl, orphan = {}, 0.0
        for camp, dd in ga4_ctx["by_campaign"].items():
            rev = float(dd.get("revenue") or 0)
            lbl = name_lbl.get(_norm(camp))
            if lbl:
                rv_lbl[lbl] = rv_lbl.get(lbl, 0.0) + rev
            else:
                orphan += rev
        t_rows = sorted(
            ({"label": lbl, "spend": round(s, 2), "rev": round(rv_lbl.get(lbl, 0.0), 2)}
             for lbl, s in sp_lbl.items() if s > 0),
            key=lambda r: -r["spend"],
        )[:4]
        if t_rows:
            themes = {"rows": t_rows, "orphan": round(orphan, 2)}

    # ── Boucle de la preuve : les « Fait » des semaines passées, re-mesurés ───
    PROOF_KPI = {
        "gaspillage":     ("cpc", "CPC moyen", "CHF", "down", "{:.2f}"),
        "roas":           ("roas", "ROAS", "", "up", "{:.1f}"),
        "scaler":         ("roas", "ROAS", "", "up", "{:.1f}"),
        "funnel":         ("purchases", "achats (GA4)", "", "up", "{:.0f}"),
        "silence":        ("posts", "posts publiés", "", "up", "{:.0f}"),
        "creneau":        ("eng", "engagement moyen", "%", "up", "{:.1f}"),
        "format_gagnant": ("eng", "engagement moyen", "%", "up", "{:.1f}"),
        "page_endormie":  ("reach", "portée moyenne", "", "up", "{:,.0f}"),
    }

    def _kpis_window(w_since, w_until):
        k = {}
        if df_meta_raw is not None and not df_meta_raw.empty:
            m = df_meta_raw[(df_meta_raw["date_start"] >= pd.Timestamp(w_since))
                            & (df_meta_raw["date_start"] <= pd.Timestamp(w_until))]
            sp, cl = float(m["spend"].sum()), int(m["clicks"].sum())
            k["spend"] = sp
            k["cpc"] = (sp / cl) if cl > 0 else None
        if not df_insta.empty and "date" in df_insta.columns and "eng" in df_insta.columns:
            dtp = pd.to_datetime(df_insta["date"], errors="coerce")
            p = df_insta[(dtp.dt.date >= w_since) & (dtp.dt.date <= w_until)]
            k["posts"] = float(len(p))
            k["eng"] = float(p["eng"].mean()) if len(p) else None
            k["reach"] = float(p["reach"].mean()) if len(p) and "reach" in p.columns else None
        try:
            from components.ga4 import build_ga4_context as _bgc
            g = _bgc(sb, user_id, w_since, w_until)
        except Exception:
            g = None
        if g and g.get("paid_revenue") is not None and k.get("spend", 0) > 0:
            k["roas"] = float(g["paid_revenue"]) / k["spend"]
        pu = (g or {}).get("funnel", {}).get("purchase")
        k["purchases"] = float(pu) if pu is not None else None
        return k

    week_start_monday = today - timedelta(days=today.weekday())
    try:
        decisions = fetch_reco_decisions(sb, user_id)
    except Exception:
        decisions = []
    outcomes, pending = [], []
    cur_kpis = None
    for dec in decisions[:4]:
        spec = PROOF_KPI.get(dec["reco_key"])
        if not spec:
            continue
        try:
            w0 = date.fromisoformat(dec["week_start"])
        except Exception:
            continue
        if w0 >= week_start_monday:
            pending.append(dec["reco_key"])
            continue
        kpi, lbl_k, unit, direction, fmt = spec
        if cur_kpis is None:
            cur_kpis = _kpis_window(cur_since, last_full_day)
        then = _kpis_window(w0, w0 + timedelta(days=6)).get(kpi)
        now = cur_kpis.get(kpi)
        if then is None or now is None:
            continue
        delta = ((now - then) / then * 100) if abs(then) > 1e-9 else None
        better = delta is not None and ((delta <= -5) if direction == "down" else (delta >= 5))
        worse = delta is not None and ((delta >= 5) if direction == "down" else (delta <= -5))
        outcomes.append({
            "key": dec["reco_key"],
            "title": KEY_LABELS.get(dec["reco_key"], dec["reco_key"]).capitalize(),
            "week_label": f"sem. du {w0.day} {MONTHS_FR[w0.month]}",
            "kpi": lbl_k, "unit": unit,
            "then": fmt.format(then), "now": fmt.format(now),
            "delta": round(delta, 1) if delta is not None else None,
            "verdict": "better" if better else ("worse" if worse else "stable"),
        })
    preuve = (
        {"outcomes": outcomes[:3],
         "pending": [{"key": k, "title": KEY_LABELS.get(k, k)} for k in pending[:2]]}
        if (outcomes or pending) else None
    )

    # ── Vision + matrice compacte pour le payload ────────────────────────────
    vision = None
    if constats:
        _p_since = matrix["period"]["since"] if matrix else None
        try:
            _d = date.fromisoformat(_p_since) if _p_since else None
            period_label = (f"depuis le {_d.day} {MONTHS_FR[_d.month]}" if _d else "")
        except Exception:
            period_label = ""
        vision = {
            "generated_at": today.isoformat(),
            "period_label": period_label,
            "priorities": priority_labels,
            "constats": constats,
        }
    matrice = None
    if matrix:
        matrice = {
            "period": matrix["period"],
            "themes": matrix["themes"][:6],
            "formats": matrix["formats"][:6],
            "campaigns": matrix["campaigns"][:6],
            "slots": matrix["slots"][:3],
            "coverage": matrix["coverage"],
        }

    _all_clicks = total_clicks + g_clicks
    _all_impr = total_impr + g_impr
    return {
        "version": 2,
        "vision": vision,
        "matrice": matrice,
        "kpis": {
            # Chiffres bruts (l'email les met en forme) — mêmes fenêtres que Pulse
            "spend": round(total_spend + g_spend, 2),
            "clicks": _all_clicks,
            "ctr": (_all_clicks / _all_impr * 100) if _all_impr > 0 else 0.0,
            "followers_delta": followers_delta,
            "followers_total": followers_current,
        },
        "week_label": week_label,
        "since": cur_since.isoformat(),
        "until": last_full_day.isoformat(),
        "verdict": verdict,
        "brief": brief,
        "suivi": {"applique": _n_done, "utile": _n_useful, "ecarte": _n_skip},
        "todo": [
            {"key": r["key"], "title": r["title"], "platform": r["platform"],
             "done": feedback.get(r["key"]) == "done"}
            for r in todos
        ],
        "recos": [
            {k: r.get(k) for k in (
                "key", "platform", "title", "observation", "pourquoi",
                "verifier", "repere", "angle_mort", "confidence", "priority", "source")}
            for r in sorted(insta_items + meta_items, key=lambda r: r["priority"])
        ] + ([ai_reco] if ai_reco else []),
        # Le cœur du rapport v2 : conseils regroupés PAR THÈME (cross-canal).
        "themes_focus": themes_focus,
        "reglages": reglages,
        "themes": themes,
        "preuve": preuve,
    }


def _display_name(sb, user_id: str, fallback_email: str | None) -> str:
    """Nom pour le « Bonjour … » : compte Instagram connecté, sinon début de l'email."""
    try:
        rows = (sb.table("connected_accounts")
                .select("account_name, instagram_business_id")
                .eq("user_id", user_id).execute().data) or []
        for r in rows:
            if r.get("instagram_business_id") and r.get("account_name"):
                return r["account_name"]
    except Exception:
        pass
    return (fallback_email or "").split("@")[0] or "toi"


def publish_weekly_report(sb, user_id: str, email_to: str | None = None) -> str:
    """Construit + publie le rapport d'un utilisateur ; envoie l'email si email_to.

    L'email lit le MÊME payload que Pulse (une seule source de vérité).
    Sans RESEND_API_KEY, send_email passe en dry-run → aucun envoi, juste un log.
    """
    payload = build_payload(sb, user_id)
    if payload is None:
        return "rapport: pas de données"
    week_start = (date.today() - timedelta(days=date.today().weekday())).isoformat()
    upsert_weekly_report(sb, user_id, week_start, payload)
    log = f"rapport publié ({len(payload['recos'])} conseils)"

    if email_to:
        import os
        from emailing.render import email_from_payload
        from emailing.send import send_email
        app_url = os.getenv("EMAIL_APP_URL", "https://dashboard-analytic-green.vercel.app")
        subject, html = email_from_payload(_display_name(sb, user_id, email_to), payload, app_url)
        res = send_email(to=email_to, subject=subject, html=html)
        log += (f" · email {res['provider']}: "
                f"{'envoyé' if res['ok'] and res['provider'] != 'dry' else res['detail']}")
    return log


def _service_client():
    import os
    from supabase import create_client
    url = os.getenv("SUPABASE_URL") or secret("supabase.url")
    key = os.getenv("SUPABASE_SERVICE_KEY") or secret("supabase.service_role")
    if not url or not key:
        raise SystemExit("SUPABASE_URL / SUPABASE_SERVICE_KEY manquants (env ou secrets.toml)")
    return create_client(url, key)


if __name__ == "__main__":
    args = sys.argv[1:]
    sb = _service_client()
    if "--all" in args:
        profiles = (sb.table("profiles").select("id").execute().data) or []
        for p in profiles:
            print(f"{p['id']} → {publish_weekly_report(sb, p['id'])}")
    elif "--user" in args:
        uid = args[args.index("--user") + 1]
        if "--print" in args:
            payload = build_payload(sb, uid)
            print(json.dumps(payload, ensure_ascii=False, indent=2, default=str))
        else:
            print(publish_weekly_report(sb, uid))
    else:
        print(__doc__)
