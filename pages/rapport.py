import calendar
import streamlit as st
import pandas as pd
import requests
from datetime import date, timedelta

from scripts.fetch_data import (
    fetch_meta_ads, fetch_post_metrics, fetch_daily_followers,
    fetch_objectif, fetch_reco_feedback, fetch_reco_comments,
    fetch_google_ads, fetch_channel_budgets, budget_for_month,
    fetch_reco_decisions, fetch_campaign_config, fetch_google_campaign_config,
)
from scripts.insert_data import update_objectif, save_reco_feedback, save_reco_comment, upsert_weekly_report
from components.reco_engine import build_recos, PLATFORM_ICON, CONFIDENCE, OBJECTIFS, KEY_LABELS
from components.user_persona import build_user_persona, regenerate_user_persona
from components.layout import inject_hierarchy_css

MONTHS_FR = {1:"jan",2:"fév",3:"mar",4:"avr",5:"mai",6:"jun",
             7:"jul",8:"aoû",9:"sep",10:"oct",11:"nov",12:"déc"}


def _call_gemini(prompt: str) -> str | None:
    try:
        api_key = st.secrets["gemini"]["api_key"]
        resp = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
            json={"contents": [{"parts": [{"text": prompt}]}]},
            timeout=20,
        )
        return resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
    except Exception:
        return None


# Couleur d'accent par plateforme source (icône ◎ ▣ ◆ ◇)
_PLATFORM_COLOR = {"instagram": "#7b4fff", "meta": "#1a56ff", "google": "#1a7a4a",
                   "pub": "#1a56ff", "ia": "#8b6f00"}


def _reco_card(idx, reco):
    """Carte 'guide, pas ordre' : observation · pourquoi · avant d'agir · angle mort.

    En-tête = icône source (langage visuel du dash) + jauge de confiance
    (● Solide / ◐ À creuser / ○ Piste, géométrique monochrome).
    Tolérant : si la reco vient de l'IA (champs réduits), on dégrade proprement.
    """
    platform = reco.get("platform", "ia")
    icon = PLATFORM_ICON.get(platform, "◇")
    accent = _PLATFORM_COLOR.get(platform, "#8b8e98")
    conf = CONFIDENCE.get(reco.get("confidence", "piste"), CONFIDENCE["piste"])
    is_ai = reco.get("source") == "ai"

    src_badge = (
        "<span style='font-size:10px;font-weight:600;letter-spacing:0.04em;color:#7b4fff;"
        "background:rgba(123,79,255,0.10);padding:2px 8px;border-radius:999px;'>IA</span>"
        if is_ai else
        "<span style='font-size:10px;font-weight:600;letter-spacing:0.04em;color:#5a5d66;"
        "background:rgba(14,15,18,0.06);padding:2px 8px;border-radius:999px;'>Règle</span>"
    )
    conf_chip = (
        f"<span style='margin-left:auto;display:inline-flex;align-items:center;gap:5px;"
        f"font-size:11px;font-weight:600;color:#5a5d66;'>"
        f"<span style='font-size:13px;color:#0e0f12;'>{conf['symbol']}</span>{conf['label']}</span>"
    )

    # Corps : structure guide si dispo, sinon fallback body simple (recos IA)
    def _line(label, txt, color="#5a5d66", strong_label=True):
        if not txt:
            return ""
        lbl = (f"<span style='font-weight:600;color:#0e0f12;'>{label} </span>"
               if strong_label and label else "")
        return (f"<div style='font-size:13px;color:{color};line-height:1.55;margin-top:6px;'>"
                f"{lbl}{txt}</div>")

    if reco.get("observation"):
        body_html = (
            _line("", reco.get("observation"), color="#0e0f12")
            + _line("Pourquoi —", reco.get("pourquoi"))
            + _line("Avant d'agir —", reco.get("verifier"))
        )
        # Repère chiffré (cible à viser) — encadré bleu
        repere = reco.get("repere")
        if repere:
            body_html += (
                f"<div style='font-size:12.5px;color:#0e0f12;line-height:1.5;margin-top:10px;"
                f"background:rgba(26,86,255,0.05);border:1px solid rgba(26,86,255,0.14);"
                f"border-radius:9px;padding:9px 11px;'>"
                f"<span style='font-weight:600;color:#1a56ff;'>Repère — </span>{repere}</div>"
            )
        angle = reco.get("angle_mort")
        if angle:
            body_html += (
                f"<div style='font-size:12px;color:#8b8e98;line-height:1.5;margin-top:10px;"
                f"padding-top:9px;border-top:1px dashed rgba(14,15,18,0.10);'>"
                f"<span style='font-weight:600;color:#b86b00;'>Angle mort — </span>{angle}</div>"
            )
    else:
        body_html = _line("", reco.get("body", ""), color="#5a5d66")

    return f"""
    <div style="background:#fff;border:1px solid rgba(14,15,18,0.08);border-radius:14px;
                padding:18px 20px;display:grid;grid-template-columns:auto 1fr;gap:16px;
                align-items:start;margin-bottom:10px;">
      <div style="width:36px;height:36px;border-radius:10px;
                  background:{accent}14;color:{accent};
                  display:grid;place-items:center;font-size:18px;flex-shrink:0;">{icon}</div>
      <div>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
          {src_badge}{conf_chip}
        </div>
        <div style="font-size:15px;font-weight:600;letter-spacing:-0.2px;color:#0e0f12;">{reco.get('title','')}</div>
        {body_html}
      </div>
    </div>"""


def _event_row(icon, color, title, body, last=False):
    """Ligne mise en valeur : liseré coloré, pastille teintée, titre prominent."""
    border = "" if last else "border-bottom:1px solid rgba(14,15,18,0.06);"
    return f"""
    <div style="display:grid;grid-template-columns:auto 1fr;gap:14px;
                padding:15px 18px 15px 16px;{border}align-items:flex-start;
                border-left:3px solid {color};">
      <div style="width:30px;height:30px;border-radius:9px;background:{color}16;
                  display:grid;place-items:center;color:{color};font-size:15px;
                  font-weight:700;flex-shrink:0;margin-top:1px;">{icon}</div>
      <div>
        <div style="font-size:14px;font-weight:600;color:#0e0f12;letter-spacing:-0.1px;line-height:1.3;">{title}</div>
        <div style="font-size:12.5px;color:#5a5d66;line-height:1.5;margin-top:2px;">{body}</div>
      </div>
    </div>"""


def show_rapport(client, user_id: str, is_paid: bool = False):
    today = date.today()

    # ── Chargement données ────────────────────────────────────────────────────
    df_meta_raw = None
    df_insta = pd.DataFrame()
    df_follows = pd.DataFrame()

    try:
        meta_data = fetch_meta_ads(client, user_id)
        if meta_data:
            df_meta_raw = pd.DataFrame(meta_data)
    except Exception:
        pass

    try:
        insta_data = fetch_post_metrics(client, user_id)
        df_insta = pd.DataFrame(insta_data or [])
    except Exception:
        pass

    try:
        follows_data = fetch_daily_followers(client, user_id)
        df_follows = pd.DataFrame(follows_data or [])
    except Exception:
        pass

    # ── Fenêtre de comparaison : cap sur la DERNIÈRE date de données réelle ──
    # On compare au maximum jusqu'à la date des dernières données (souvent hier),
    # jamais aujourd'hui (journée incomplète → biaiserait les perfs vers le bas).
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

    # Fin de fenêtre = dernière date dispo, plafonnée à hier (exclut aujourd'hui)
    last_full_day = min(last_data_date, yesterday)
    cur_since = last_full_day - timedelta(days=6)
    prev_until = cur_since - timedelta(days=1)
    prev_since = prev_until - timedelta(days=6)

    # ── Métriques Meta Ads (7 derniers jours) ────────────────────────────────
    total_spend = 0.0
    total_clicks = 0
    total_impressions = 0
    avg_ctr = 0.0
    avg_cpc = 0.0
    df_camp = pd.DataFrame()

    spend_delta_pct = None
    clicks_delta_pct = None
    ctr_delta_pct = None

    if df_meta_raw is not None and not df_meta_raw.empty:
        for col in ["impressions", "clicks", "spend"]:
            if col in df_meta_raw.columns:
                df_meta_raw[col] = pd.to_numeric(df_meta_raw[col], errors="coerce").fillna(0)
        df_meta_raw["date_start"] = pd.to_datetime(df_meta_raw["date_start"], errors="coerce")
        # 7 jours pleins (hors jour du fetch)
        df_meta = df_meta_raw[
            (df_meta_raw["date_start"] >= pd.Timestamp(cur_since))
            & (df_meta_raw["date_start"] <= pd.Timestamp(last_full_day))
        ]
        df_meta_prev = df_meta_raw[
            (df_meta_raw["date_start"] >= pd.Timestamp(prev_since))
            & (df_meta_raw["date_start"] <= pd.Timestamp(prev_until))
        ]

        if not df_meta.empty:
            total_spend = df_meta["spend"].sum()
            total_clicks = int(df_meta["clicks"].sum())
            total_impressions = int(df_meta["impressions"].sum())
            avg_ctr = (total_clicks / total_impressions * 100) if total_impressions > 0 else 0.0
            avg_cpc = (total_spend / total_clicks) if total_clicks > 0 else 0.0

            # Évolution vs les 7 jours pleins précédents (mêmes bornes, même durée)
            if not df_meta_prev.empty:
                prev_spend = df_meta_prev["spend"].sum()
                prev_clicks = int(df_meta_prev["clicks"].sum())
                prev_impr = int(df_meta_prev["impressions"].sum())
                prev_ctr = (prev_clicks / prev_impr * 100) if prev_impr > 0 else 0.0
                if prev_spend > 0:
                    spend_delta_pct = round((total_spend - prev_spend) / prev_spend * 100)
                if prev_clicks > 0:
                    clicks_delta_pct = round((total_clicks - prev_clicks) / prev_clicks * 100)
                if prev_ctr > 0:
                    ctr_delta_pct = round((avg_ctr - prev_ctr) / prev_ctr * 100)

            df_camp = df_meta.groupby("campaign_name", as_index=False).agg(
                spend=("spend", "sum"), clicks=("clicks", "sum"), impressions=("impressions", "sum")
            )
            df_camp["ctr"] = df_camp.apply(lambda r: r["clicks"] / r["impressions"] * 100 if r["impressions"] > 0 else 0, axis=1)
            df_camp["cpc"] = df_camp.apply(lambda r: r["spend"] / r["clicks"] if r["clicks"] > 0 else 0, axis=1)

    # ── Google Ads : fusionné dans df_camp → le moteur voit TOUTE la pub ─────
    # (ROAS = revenu payant GA4 / dépense Meta+Google ; règles CPC cross-canal).
    # df_goog est aussi réutilisé plus bas (module Coûts + module thèmes).
    df_goog = pd.DataFrame()
    try:
        df_goog = pd.DataFrame(fetch_google_ads(client, user_id) or [])
    except Exception:
        df_goog = pd.DataFrame()
    if not df_goog.empty and "cost_micros" in df_goog.columns:
        df_goog["date_start"] = pd.to_datetime(df_goog["date_start"], errors="coerce")
        df_goog["_chf"] = pd.to_numeric(df_goog["cost_micros"], errors="coerce").fillna(0) / 1_000_000
        for _col in ["impressions", "clicks"]:
            if _col in df_goog.columns:
                df_goog[_col] = pd.to_numeric(df_goog[_col], errors="coerce").fillna(0)
        _gwin = df_goog[(df_goog["date_start"] >= pd.Timestamp(cur_since))
                        & (df_goog["date_start"] <= pd.Timestamp(last_full_day))].copy()
        if not _gwin.empty and "campaign_id" in _gwin.columns:
            _gnames = {}
            try:
                _gnames = {str(_cid): (_c or {}).get("campaign_name") or f"Campagne {_cid}"
                           for _cid, _c in (fetch_google_campaign_config(client, user_id) or {}).items()}
            except Exception:
                pass
            _gwin["_cid"] = _gwin["campaign_id"].astype(str)
            _gagg = _gwin.groupby("_cid", as_index=False).agg(
                spend=("_chf", "sum"), clicks=("clicks", "sum"), impressions=("impressions", "sum"))
            _gagg["campaign_name"] = _gagg["_cid"].map(lambda c: _gnames.get(c, f"Campagne {c}"))
            _gagg["ctr"] = _gagg.apply(lambda r: r["clicks"] / r["impressions"] * 100 if r["impressions"] > 0 else 0, axis=1)
            _gagg["cpc"] = _gagg.apply(lambda r: r["spend"] / r["clicks"] if r["clicks"] > 0 else 0, axis=1)
            _gcols = ["campaign_name", "spend", "clicks", "impressions", "ctr", "cpc"]
            df_camp = (pd.concat([df_camp, _gagg[_gcols]], ignore_index=True)
                       if not df_camp.empty else _gagg[_gcols])

    # ── Métriques Instagram ───────────────────────────────────────────────────
    followers_current = 0
    followers_delta = 0
    avg_engagement = 0.0

    if not df_follows.empty:
        df_follows = df_follows.sort_values("fetched_at", ascending=False)
        followers_current = int(df_follows.iloc[0]["followers"])
        if len(df_follows) >= 7:
            followers_delta = followers_current - int(df_follows.iloc[6]["followers"])

    week_eng = None       # engagement moyen des posts de la semaine
    week_reach = None     # portée moyenne des posts de la semaine
    hist_reach = None     # portée moyenne historique (le "post moyen" du compte)
    week_posts_count = 0
    df_week_posts = pd.DataFrame()

    if not df_insta.empty:
        for col in ["likes", "reach", "comments", "saved"]:
            if col in df_insta.columns:
                df_insta[col] = pd.to_numeric(df_insta[col], errors="coerce").fillna(0)
        if "reach" in df_insta.columns:
            df_insta["eng"] = df_insta.apply(
                lambda r: (r.get("likes", 0) + r.get("comments", 0) + r.get("saved", 0)) / r["reach"] * 100
                if r["reach"] > 0 else 0, axis=1
            )
            avg_engagement = df_insta["eng"].mean()
            hist_reach = df_insta["reach"].mean()

            # Posts publiés sur les 7 jours pleins → comparés au post moyen du compte
            if "date" in df_insta.columns:
                _dt = pd.to_datetime(df_insta["date"], errors="coerce")
                mask_week = (_dt.dt.date >= cur_since) & (_dt.dt.date <= last_full_day)
                df_week_posts = df_insta[mask_week]
                week_posts_count = len(df_week_posts)
                if week_posts_count > 0:
                    week_eng = df_week_posts["eng"].mean()
                    week_reach = df_week_posts["reach"].mean()

    has_data = total_spend > 0 or followers_current > 0

    # ── Semaine label ────────────────────────────────────────────────────────
    week_num = today.isocalendar()[1]
    week_label = (
        f"Semaine {week_num} · {cur_since.day} → {last_full_day.day} "
        f"{MONTHS_FR[last_full_day.month]} · 7 jours pleins"
    )

    # ═════════════════════════════════════════════════════════════════════════
    # RECOMMANDATIONS — règles déterministes (components/reco_engine.py)
    #   • FAITS : règles → conseils guides (pourquoi + repère + confiance)
    #   • L'IA ne fait QUE synthétiser "ce qui a marché" (pas un avis de plus)
    #   • Rendu : Vue d'ensemble → L'essentiel (digest) → Détail par canal
    # Si l'IA tombe, le rapport reste 100 % complet grâce aux règles.
    # ═════════════════════════════════════════════════════════════════════════

    # ── Profil : objectif + feedback (boucle d'apprentissage) ────────────────
    week_start = (today - timedelta(days=today.weekday()))  # lundi de cette semaine
    _ws_iso = week_start.isoformat()
    objectif = fetch_objectif(client, user_id) if (client and user_id) else None
    feedback = fetch_reco_feedback(client, user_id) if (client and user_id) else {}

    # Commentaires : map {reco_key: commentaire} de la semaine courante (pré-remplissage)
    _all_comments = fetch_reco_comments(client, user_id) if (client and user_id) else []
    comment_map = {
        c["reco_key"]: c["comment"]
        for c in _all_comments
        if str(c.get("week_start", ""))[:10] == _ws_iso and (c.get("comment") or "").strip()
    }

    # Persona utilisateur dérivé des commentaires → adapte le ton de l'IA au type d'user.
    persona = (
        build_user_persona(client, user_id, _call_gemini, objectif, comments=_all_comments)
        if (client and user_id) else None
    )

    # Résumé du feedback pour l'IA (lisible)
    _done = [KEY_LABELS.get(k, k) for k, v in feedback.items() if v == "done"]
    _skip = [KEY_LABELS.get(k, k) for k, v in feedback.items() if v == "not_for_me"]
    fb_txt = ""
    if _done:
        fb_txt += f" Déjà traité récemment : {', '.join(_done)}."
    if _skip:
        fb_txt += f" Jugé non pertinent (ne pas réinsister) : {', '.join(_skip)}."
    obj_txt = OBJECTIFS[objectif]["label"] if objectif in OBJECTIFS else "non défini"

    # ── Couche 1 : FAITS ─────────────────────────────────────────────────────
    # ga4 : None tant que Google Analytics n'est pas connecté → les recos pub
    # sont plafonnées à "À creuser" + un nudge propose de le brancher.
    # Connecté → {connected, paid_conversions, paid_revenue, ...} sur la même
    # fenêtre 7 jours pleins → les conseils pub passent "Solide".
    try:
        from components.ga4 import build_ga4_context
        ga4_ctx = build_ga4_context(client, user_id, cur_since, last_full_day)
    except Exception:
        ga4_ctx = None
    rule_recos = build_recos(
        df_camp=df_camp if not df_camp.empty else None,
        avg_ctr=avg_ctr,
        df_insta=df_insta if not df_insta.empty else None,
        df_week_posts=df_week_posts,
        followers_current=followers_current,
        ga4=ga4_ctx,
        objectif=objectif,
        feedback=feedback,
    )
    facts_txt = " ; ".join(r["title"] for r in rule_recos)

    # ── Brief IA — fait / marché / priorité (pas une reco de plus) ───────────
    # L'IA ne pond pas un avis supplémentaire : elle synthétise ce qui a marché,
    # reconnaît ce qui a été traité (boutons Fait), et nomme LA priorité — qui
    # vient des recos déterministes (elle ne l'invente pas).
    # Cache : régénéré si le persona, l'objectif OU les faits (recos) changent.
    _top_todo = sorted(rule_recos, key=lambda r: r["priority"])[0]["title"] if rule_recos else None
    _persona_sig = str(abs(hash(persona)) % 100000) if persona else "na"
    _facts_sig = str(abs(hash(facts_txt + (_top_todo or ""))) % 100000)
    wins_cache = f"rapport_wins_{user_id}_{today.isoformat()}_{objectif or 'na'}_{_persona_sig}_{_facts_sig}"
    wins_txt = st.session_state.get(wins_cache)
    if wins_txt is None and has_data:
        # Personnalisation : on injecte le profil de l'utilisateur + son objectif + ce
        # qu'il a déjà jugé, pour que le ton et les priorités collent à SON type.
        _perso_line = (
            f"Profil de cet utilisateur — adapte ton ton et tes priorités en conséquence :\n{persona}\n"
            if persona else ""
        )
        _prio_line = (
            f"La priorité n°1 de la semaine (déjà calculée, ne la change pas) : {_top_todo}. "
            if _top_todo else ""
        )
        wins_prompt = (
            "Tu es un consultant marketing pour une PME. Rédige le brief de la semaine en "
            "3 phrases maximum (français, ton concret et direct, pas de guillemets) : "
            "1) ce qui a MARCHÉ cette semaine et vaut d'être reproduit ; "
            "2) si des actions ont déjà été traitées, reconnais-le en un mot ; "
            "3) termine par la priorité n°1, formulée simplement. "
            "Vocabulaire précis exigé : un ROAS sous 1 se dit « inférieur à 1 », "
            "jamais « négatif » ; ne déforme aucun chiffre fourni. "
            f"{_perso_line}"
            f"Objectif principal du compte : {obj_txt}.{fb_txt} "
            f"{_prio_line}"
            f"Données : abonnés {followers_delta:+d}, engagement {avg_engagement:.1f}%, "
            f"CTR {avg_ctr:.2f}%, dépense {total_spend:.0f} CHF. "
            "Si rien n'a vraiment marché, dis-le simplement — pas de flatterie artificielle."
        )
        r = _call_gemini(wins_prompt)
        if r:
            st.session_state[wins_cache] = r
            wins_txt = r

    # ── Signaux de la semaine (sert au fallback "ce qui a marché") ───────────
    events = []
    if not df_camp.empty and len(df_camp) >= 2:
        avg_cpc_all = df_camp[df_camp["cpc"] > 0]["cpc"].mean() or 1
        worst = df_camp.loc[df_camp["cpc"].idxmax()]
        best = df_camp.loc[df_camp["ctr"].idxmax()]
        if worst["cpc"] > avg_cpc_all * 4 and worst["cpc"] > 3:
            events.append({"icon": "↓", "color": "#c0392b",
                           "title": f"« {worst['campaign_name'][:35]} »",
                           "body": f"CPC à {worst['cpc']:.2f} CHF — {worst['cpc']/avg_cpc_all:.0f}× la moyenne. À regarder de près."})
        if best["ctr"] > avg_ctr * 1.5 and best["ctr"] > 0:
            events.append({"icon": "↑", "color": "#1a7a4a",
                           "title": f"« {best['campaign_name'][:35]} »",
                           "body": f"CTR à {best['ctr']:.1f}% — ta meilleure accroche cette semaine."})

    if followers_delta > 5:
        events.append({"icon": "↑", "color": "#1a7a4a",
                       "title": f"+{followers_delta} nouveaux abonnés",
                       "body": "Croissance organique positive cette semaine."})
    elif followers_delta < -5:
        events.append({"icon": "↓", "color": "#c0392b",
                       "title": f"{followers_delta} abonnés perdus",
                       "body": "Analyse le contenu et les créneaux de publication."})

    # Posts de la semaine vs le post moyen du compte (organic)
    if week_reach is not None and hist_reach and hist_reach > 0:
        _reach_diff = (week_reach - hist_reach) / hist_reach * 100
        if _reach_diff >= 15:
            events.append({"icon": "↑", "color": "#1a7a4a",
                           "title": f"Tes posts de la semaine portent {_reach_diff:+.0f}% vs ton post moyen",
                           "body": f"Portée moyenne {week_reach:,.0f} vs {hist_reach:,.0f} d'habitude. Reproduis ce format."})
        elif _reach_diff <= -15:
            events.append({"icon": "↓", "color": "#c0392b",
                           "title": f"Tes posts de la semaine portent {_reach_diff:.0f}% vs ton post moyen",
                           "body": f"Portée moyenne {week_reach:,.0f} vs {hist_reach:,.0f} d'habitude. Regarde ce qui a changé (format, heure, sujet)."})

    # Engagement des posts de la semaine vs TA moyenne (l'insight le plus parlant)
    if week_eng is not None and avg_engagement > 0:
        _eng_diff = (week_eng - avg_engagement) / avg_engagement * 100
        if _eng_diff >= 10:
            events.append({"icon": "↑", "color": "#1a7a4a",
                           "title": f"Tes posts engagent {_eng_diff:+.0f}% vs ton habitude",
                           "body": f"{week_eng:.1f}% cette semaine contre {avg_engagement:.1f}% en moyenne. Ce que tu fais en ce moment plaît."})
        elif _eng_diff <= -10:
            events.append({"icon": "↓", "color": "#b86b00",
                           "title": f"Tes posts engagent {_eng_diff:.0f}% vs ton habitude",
                           "body": f"{week_eng:.1f}% cette semaine contre {avg_engagement:.1f}% en moyenne. Une semaine plus faible — à confirmer sur la durée."})
    elif avg_engagement > 3:
        events.append({"icon": "↑", "color": "#1a7a4a",
                       "title": f"Engagement Instagram à {avg_engagement:.1f}%",
                       "body": "Solide pour un compte de ta taille — l'algorithme pousse ce type de contenu."})

    # Sépare les signaux positifs (→ "Ce qui a marché") des correctifs (→ recos)
    wins_events = [e for e in events if e.get("color") == "#1a7a4a"]

    # ── CSS inline Pulse ─────────────────────────────────────────────────────
    st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600&display=swap');
    .p-eyebrow { font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#8b8e98;font-weight:600;margin-bottom:6px; }
    .p-h1 { font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:32px;letter-spacing:-0.02em;margin:0 0 4px;line-height:1.15;color:#0e0f12; }
    .p-hero { display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:22px; }
    .p-section-title { font-size:13px;font-weight:600;letter-spacing:-0.1px;color:#0e0f12;display:flex;align-items:center;gap:8px;margin-bottom:12px; }
    .p-section-muted { color:#8b8e98;font-family:'JetBrains Mono',monospace;font-weight:400;font-size:12px; }
    </style>
    """, unsafe_allow_html=True)
    inject_hierarchy_css()  # alignement à droite des popovers ⓘ

    # ── Verdict (executive summary, 1 phrase) ────────────────────────────────
    # Best practice rapport hebdo : verdict + driver principal AVANT les chiffres.
    # Déterministe : on prend le signal le plus fort parmi les deltas connus.
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
        _driver_val, _driver_name = max(_signals, key=lambda s: abs(s[0]))
        if _driver_val >= 10:
            verdict = f"Semaine en progression — portée par {_driver_name} ({_driver_val:+.0f} %)."
        elif _driver_val <= -10:
            verdict = f"Semaine en retrait — {_driver_name} ({_driver_val:.0f} %), le reste tient."
        else:
            verdict = "Semaine stable — dans tes normes habituelles."
        if followers_delta and abs(followers_delta) >= 5:
            verdict += f" {'+' if followers_delta > 0 else ''}{followers_delta} abonnés."
    elif followers_delta:
        verdict = f"{'+' if followers_delta > 0 else ''}{followers_delta} abonnés cette semaine."
    else:
        verdict = "Première semaine de données — le rapport s'affinera avec l'historique."

    # Cohérence : un verdict « en progression » à côté d'une alerte solide se
    # contredit en lecture rapide → le verdict nomme le point rouge.
    _alert_reco = next((r for r in rule_recos
                        if r.get("confidence") == "solide"
                        and str(r.get("title", "")).startswith("Alerte")), None)
    if _alert_reco:
        verdict += (" Un point rouge à traiter : "
                    f"{KEY_LABELS.get(_alert_reco.get('key'), 'voir le brief ci-dessous')}.")

    # ── Hero ─────────────────────────────────────────────────────────────────
    # À droite : mini-suivi des conseils (la boucle Utile / Pas pour moi / Fait
    # devient visible — remplace l'ancien score "santé" incompréhensible).
    _n_done = sum(1 for v in feedback.values() if v == "done")
    _n_useful = sum(1 for v in feedback.values() if v == "useful")
    _n_skip = sum(1 for v in feedback.values() if v == "not_for_me")
    if _n_done or _n_useful or _n_skip:
        _suivi_bits = []
        if _n_done:
            _suivi_bits.append(f'<span style="color:#1a7a4a;font-weight:600;">✓ {_n_done} appliqué{"s" if _n_done > 1 else ""}</span>')
        if _n_useful:
            _suivi_bits.append(f'<span style="color:#1a56ff;font-weight:600;">● {_n_useful} utile{"s" if _n_useful > 1 else ""}</span>')
        if _n_skip:
            _suivi_bits.append(f'<span style="color:#8b8e98;font-weight:500;">✕ {_n_skip} écarté{"s" if _n_skip > 1 else ""}</span>')
        suivi_html = (
            '<div style="text-align:right;flex-shrink:0;">'
            '<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;'
            'color:#8b8e98;font-weight:600;margin-bottom:6px;">Suivi des conseils</div>'
            '<div style="font-size:12.5px;display:flex;gap:12px;justify-content:flex-end;">'
            + "".join(_suivi_bits) + "</div>"
            '<div style="font-size:11px;color:#8b8e98;margin-top:4px;">via les boutons sous chaque conseil</div>'
            "</div>"
        )
    else:
        suivi_html = ""

    st.markdown(f"""
    <div class="p-hero">
      <div>
        <div class="p-eyebrow">{week_label} · lecture ~3 min</div>
        <div class="p-h1">Voici ce qui compte cette semaine.</div>
        <div style="font-size:14px;color:#5a5d66;margin-top:6px;line-height:1.5;">{verdict}</div>
      </div>
      {suivi_html}
    </div>
    """, unsafe_allow_html=True)

    # Regroupement des recos par canal (détail) + liste à plat (digest "à faire")
    by_section = {"instagram": [], "meta": []}
    for r in rule_recos:
        p = r.get("platform")
        if p == "instagram":
            by_section["instagram"].append(r)
        elif p in ("meta", "google", "pub"):
            by_section["meta"].append(r)
    insta_items = sorted(by_section["instagram"], key=lambda r: r["priority"])[:2]
    # 3 pour la pub : la reco ROAS (GA4) s'ajoute à gaspillage/scaler sans les masquer
    meta_items = sorted(by_section["meta"], key=lambda r: r["priority"])[:3]
    # Digest : 3 actions max (best practice) — tout le reste vit dans le détail
    todos = sorted(insta_items + meta_items, key=lambda r: r["priority"])[:3]

    # (La publication SaaS du payload est faite en FIN de rapport — après le
    #  calcul des thèmes et de la boucle de la preuve, pour publier le tout.)

    # ═══ SECTION 1 — L'ESSENTIEL (verdict → actions, avant les chiffres) ════
    st.markdown(
        '<div class="p-section-title" style="font-size:14px;margin:6px 0 12px;">'
        "L'essentiel — 30 secondes</div>",
        unsafe_allow_html=True,
    )

    # Colonne gauche : le brief IA (fait / marché / priorité), sinon signaux positifs
    if wins_txt:
        wins_html = f"<div style='font-size:13.5px;color:#0e0f12;line-height:1.6;'>{wins_txt}</div>"
        wins_title = ("Le brief de la semaine "
                      "<span style='font-size:9px;font-weight:600;color:#7b4fff;background:rgba(123,79,255,0.10);"
                      "padding:2px 7px;border-radius:999px;letter-spacing:0.04em;'>IA</span>")
        wins_accent = "#7b4fff"
    elif wins_events:
        wins_html = "".join(
            f"<div style='display:flex;gap:8px;margin-bottom:7px;font-size:13px;color:#0e0f12;line-height:1.4;'>"
            f"<span style='color:#1a7a4a;font-weight:700;'>↑</span><span>{e['title']}</span></div>"
            for e in wins_events[:4]
        )
        wins_title, wins_accent = "Ce qui a marché", "#1a7a4a"
    else:
        wins_html = "<div style='font-size:13px;color:#8b8e98;'>Pas de signal positif marquant cette semaine.</div>"
        wins_title, wins_accent = "Ce qui a marché", "#1a7a4a"

    # Colonne droite : à faire — avec l'état ✓ si le conseil est déjà traité
    if todos:
        todo_rows = ""
        for n, r in enumerate(todos, 1):
            ic = PLATFORM_ICON.get(r.get("platform"), "◇")
            _is_done = feedback.get(r.get("key", "")) == "done"
            _txt_style = ("text-decoration:line-through;color:#8b8e98;font-weight:400;"
                          if _is_done else "color:#0e0f12;font-weight:500;")
            _num = ("<span style='color:#1a7a4a;font-weight:700;font-size:12px;'>✓</span>"
                    if _is_done else
                    f"<span style='font-family:var(--font-mono,monospace);font-size:12px;color:#8b8e98;'>{n}</span>")
            todo_rows += (
                f"<div style='display:flex;gap:9px;align-items:baseline;margin-bottom:9px;'>"
                f"{_num}"
                f"<span style='font-size:14px;color:#5a5d66;'>{ic}</span>"
                f"<span style='font-size:13px;{_txt_style}line-height:1.4;'>{r['title']}</span></div>"
            )
        todo_html = todo_rows
    else:
        todo_html = "<div style='font-size:13px;color:#8b8e98;'>Rien d'urgent — tes comptes tournent dans tes normes.</div>"

    st.markdown(f"""
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:8px;">
      <div style="background:#fff;border:1px solid rgba(14,15,18,0.08);border-left:3px solid {wins_accent};
                  border-radius:14px;padding:18px 20px;box-shadow:0 1px 3px rgba(14,15,18,0.03);">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;
                    color:{wins_accent};font-weight:600;margin-bottom:12px;">{wins_title}</div>
        {wins_html}
      </div>
      <div style="background:#fff;border:1px solid rgba(14,15,18,0.08);border-radius:14px;
                  padding:18px 20px;box-shadow:0 1px 3px rgba(14,15,18,0.03);">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;
                    color:#1a56ff;font-weight:600;margin-bottom:12px;">À faire cette semaine</div>
        {todo_html}
      </div>
    </div>
    """, unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)

    # ═══ SECTION 2 — MODULE COÛTS DU MOIS (pilotage rapide) ═════════════════
    # Un seul module pour l'instant (sobre — on ajoutera après) : dépensé vs
    # budget du mois, tous canaux, avec le repère "% du mois écoulé" (comme la
    # page Coûts). Remplace l'ancien strip Dépensé/Clics/Abonnés qui mélangeait
    # les scopes (abonnés Insta à côté de clics pub) sans rien piloter.
    _month_start = today.replace(day=1)
    _time_pct = today.day / calendar.monthrange(today.year, today.month)[1]
    month_spend = {}
    if df_meta_raw is not None and not df_meta_raw.empty:
        _mm = df_meta_raw["date_start"] >= pd.Timestamp(_month_start)
        _v = float(df_meta_raw.loc[_mm, "spend"].sum())
        if _v > 0:
            month_spend["meta"] = _v
    # df_goog déjà chargé en amont (fusionné dans df_camp pour le moteur)
    try:
        if not df_goog.empty and "_chf" in df_goog.columns:
            _dg_m = df_goog[df_goog["date_start"] >= pd.Timestamp(_month_start)]
            _v = float(_dg_m["_chf"].sum())
            if _v > 0:
                month_spend["google"] = _v
    except Exception:
        pass
    try:
        _buds = fetch_channel_budgets(client, user_id)
    except Exception:
        _buds = []
    _month_iso = _month_start.isoformat()
    _budget_month = sum(budget_for_month(_buds, ch, _month_iso) for ch in ("meta", "google"))
    _spend_month = sum(month_spend.values())

    if _spend_month > 0 or _budget_month > 0:
        _ch_names = {"meta": "▣ Meta", "google": "◆ Google"}
        _split = " · ".join(f"{_ch_names[c]} {v:,.0f}".replace(",", " ")
                            for c, v in month_spend.items()) or "aucune dépense ce mois"
        if _budget_month > 0:
            _pct = _spend_month / _budget_month
            if _pct > 1.0:
                _b_color, _b_txt = "#c0392b", "⚠ Budget dépassé"
            elif _pct > _time_pct + 0.10:
                _b_color, _b_txt = "#b86b00", "↑ En avance sur le mois"
            elif _pct < _time_pct - 0.15:
                _b_color, _b_txt = "#8b8e98", "↓ Sous-dépense"
            else:
                _b_color, _b_txt = "#1a7a4a", "✓ En ligne"
            _bar_html = (
                f'<div style="font-size:12px;color:{_b_color};font-weight:600;margin-bottom:5px;">'
                f'{_b_txt} — {_spend_month:,.0f} / {_budget_month:,.0f} CHF ({_pct*100:.0f} %)</div>'.replace(",", " ")
                + f'<div style="position:relative;height:6px;background:rgba(14,15,18,0.06);border-radius:99px;overflow:visible;">'
                f'<div style="height:100%;width:{min(_pct,1)*100:.1f}%;background:{_b_color};border-radius:99px;"></div>'
                f'<div style="position:absolute;top:-3px;left:{_time_pct*100:.1f}%;width:2px;height:12px;'
                f'background:#0e0f12;border-radius:1px;"></div></div>'
                f'<div style="font-size:10.5px;color:#8b8e98;margin-top:4px;">'
                f'repère ▏= {_time_pct*100:.0f} % du mois écoulé · {_split}</div>'
            )
        else:
            _bar_html = (
                f'<div style="font-size:13px;color:#0e0f12;font-weight:600;margin-bottom:2px;">'
                f'{_spend_month:,.0f} CHF dépensés ce mois</div>'.replace(",", " ")
                + f'<div style="font-size:11.5px;color:#8b8e98;">{_split} · '
                'définis un budget dans <b>Coûts</b> pour suivre ton pacing</div>'
            )
        _mod_col, _mod_btn = st.columns([5, 1.1])
        with _mod_col:
            st.markdown(
                f'<div style="background:#fff;border:1px solid rgba(14,15,18,0.08);border-radius:14px;'
                f'padding:16px 20px;box-shadow:0 1px 3px rgba(14,15,18,0.03);">'
                f'<div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;'
                f'color:#8b8e98;font-weight:600;margin-bottom:10px;">'
                f'Coûts · {MONTHS_FR[today.month]} {today.year}</div>'
                f'{_bar_html}</div>',
                unsafe_allow_html=True,
            )
        with _mod_btn:
            if st.button("Ouvrir Coûts →", key="btn_open_couts", use_container_width=True):
                st.session_state["page"] = "couts"
                st.rerun()

    # ═══ MODULE 2 — CE QUE CHAQUE THÈME RAPPORTE (labels × ventes GA4) ══════
    # La question que tout client pose : « où va mon argent, et qu'est-ce
    # qu'il rapporte ? » — par THÈME (labels unifiés), pas par plateforme.
    # Dépense = Meta + Google (fenêtre 7j pleins) ; revenu = GA4 by_campaign,
    # relié au thème via le nom de campagne (utm_campaign).
    try:
        _meta_cfg = fetch_campaign_config(client, user_id) or {}
        _goog_cfg = fetch_google_campaign_config(client, user_id) or {}
    except Exception:
        _meta_cfg, _goog_cfg = {}, {}

    def _norm_camp(s):
        return str(s or "").strip().lower()

    theme_rows, _rev_orphan = [], 0.0
    if ga4_ctx and ga4_ctx.get("by_campaign"):
        # Dépense par thème sur la fenêtre
        _sp_lbl = {}
        if not df_camp.empty:
            for _, _r in df_camp.iterrows():
                _l = (_meta_cfg.get(_r["campaign_name"], {}) or {}).get("label")
                if _l:
                    _sp_lbl[_l] = _sp_lbl.get(_l, 0.0) + float(_r["spend"])
        if not df_goog.empty and "campaign_id" in df_goog.columns:
            _gw = df_goog[(df_goog["date_start"] >= pd.Timestamp(cur_since))
                          & (df_goog["date_start"] <= pd.Timestamp(last_full_day))].copy()
            if not _gw.empty:
                _gw["_cid"] = _gw["campaign_id"].astype(str)
                for _cid, _chf in _gw.groupby("_cid")["_chf"].sum().items():
                    _l = (_goog_cfg.get(_cid, {}) or {}).get("label")
                    if _l and _chf > 0:
                        _sp_lbl[_l] = _sp_lbl.get(_l, 0.0) + float(_chf)

        # Revenu GA4 par thème (nom de campagne → label)
        _name_lbl = {_norm_camp(n): (c or {}).get("label")
                     for n, c in _meta_cfg.items() if (c or {}).get("label")}
        for _cid, _c in _goog_cfg.items():
            if (_c or {}).get("label") and _c.get("campaign_name"):
                _name_lbl.setdefault(_norm_camp(_c["campaign_name"]), _c["label"])
        _rv_lbl = {}
        for _camp, _d in ga4_ctx["by_campaign"].items():
            _rev = float(_d.get("revenue") or 0)
            _l = _name_lbl.get(_norm_camp(_camp))
            if _l:
                _rv_lbl[_l] = _rv_lbl.get(_l, 0.0) + _rev
            else:
                _rev_orphan += _rev

        theme_rows = sorted(
            ({"label": _l, "spend": _s, "rev": _rv_lbl.get(_l, 0.0)}
             for _l, _s in _sp_lbl.items() if _s > 0),
            key=lambda r: -r["spend"],
        )[:4]

    if theme_rows:
        def _fmt_chf(v):
            return f"{v:,.0f}".replace(",", " ")

        _rows_html = ""
        for _t in theme_rows:
            _roas = (_t["rev"] / _t["spend"]) if _t["spend"] > 0 else None
            if _t["rev"] <= 0:
                _chip = ('<span style="font-family:\'JetBrains Mono\',monospace;font-size:12px;'
                         'color:#b0b3bc;">— pas de vente attribuée</span>')
            else:
                _rc = "#1a7a4a" if _roas >= 3 else ("#0e0f12" if _roas >= 1 else "#c0392b")
                _chip = (f'<span style="font-family:\'JetBrains Mono\',monospace;font-size:12px;'
                         f'font-weight:600;color:{_rc};">● ROAS {_roas:.1f}</span>')
            _rows_html += (
                f'<div style="display:flex;align-items:baseline;gap:14px;padding:8px 0;'
                f'border-bottom:1px solid rgba(14,15,18,0.05);">'
                f'<span style="font-size:13px;font-weight:600;color:#0e0f12;flex:1.4;">{_t["label"]}</span>'
                f'<span style="font-family:\'JetBrains Mono\',monospace;font-size:12.5px;color:#5a5d66;flex:1.6;text-align:right;">'
                f'{_fmt_chf(_t["spend"])} CHF → {_fmt_chf(_t["rev"])} CHF</span>'
                f'<span style="flex:1;text-align:right;">{_chip}</span></div>'
            )
        _orphan_note = ""
        if _rev_orphan > 0:
            _orphan_note = (
                f'<div style="font-size:11px;color:#8b8e98;margin-top:8px;">'
                f'+ {_fmt_chf(_rev_orphan)} CHF attribués à des campagnes sans thème — '
                f'ajoute un label à ces campagnes pour les relier.</div>'
            )
        st.markdown(
            f'<div style="background:#fff;border:1px solid rgba(14,15,18,0.08);border-radius:14px;'
            f'padding:16px 20px;margin-top:10px;box-shadow:0 1px 3px rgba(14,15,18,0.03);">'
            f'<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:6px;">'
            f'<div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;'
            f'color:#8b8e98;font-weight:600;">Ce que chaque thème rapporte · 7 jours pleins</div>'
            f'<div style="font-size:10.5px;color:#b0b3bc;">attribution GA4 · dernier clic</div></div>'
            f'{_rows_html}{_orphan_note}</div>',
            unsafe_allow_html=True,
        )

    # ═══ SECTION — TES DÉCISIONS, CE QUE ÇA A DONNÉ (boucle de la preuve) ═══
    # Chaque conseil marqué « Fait » une semaine passée est re-mesuré : on
    # recalcule son KPI sur la semaine de la décision (données stockées) et on
    # le compare à la semaine courante. Le rapport rend des comptes — dans les
    # deux sens : effet visible OU pas encore d'effet, dit honnêtement.
    _PROOF_KPI = {
        # reco_key: (kpi, libellé, unité, sens souhaité, format)
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
        """KPIs recalculés sur une fenêtre passée, depuis les données stockées."""
        k = {}
        if df_meta_raw is not None and not df_meta_raw.empty:
            _m = df_meta_raw[(df_meta_raw["date_start"] >= pd.Timestamp(w_since))
                             & (df_meta_raw["date_start"] <= pd.Timestamp(w_until))]
            _sp, _cl = float(_m["spend"].sum()), int(_m["clicks"].sum())
            k["spend"] = _sp
            k["cpc"] = (_sp / _cl) if _cl > 0 else None
        if not df_insta.empty and "date" in df_insta.columns and "eng" in df_insta.columns:
            _dtp = pd.to_datetime(df_insta["date"], errors="coerce")
            _p = df_insta[(_dtp.dt.date >= w_since) & (_dtp.dt.date <= w_until)]
            k["posts"] = float(len(_p))
            k["eng"] = float(_p["eng"].mean()) if len(_p) else None
            k["reach"] = float(_p["reach"].mean()) if len(_p) and "reach" in _p.columns else None
        try:
            from components.ga4 import build_ga4_context as _bgc
            _g = _bgc(client, user_id, w_since, w_until)
        except Exception:
            _g = None
        if _g and _g.get("paid_revenue") is not None and k.get("spend", 0) > 0:
            k["roas"] = float(_g["paid_revenue"]) / k["spend"]
        _pu = (_g or {}).get("funnel", {}).get("purchase")
        k["purchases"] = float(_pu) if _pu is not None else None
        return k

    decisions = fetch_reco_decisions(client, user_id) if (client and user_id) else []
    outcomes, pending = [], []
    _cur_kpis = None
    for _dec in decisions[:4]:
        _spec = _PROOF_KPI.get(_dec["reco_key"])
        if not _spec:
            continue
        try:
            _w0 = date.fromisoformat(_dec["week_start"])
        except Exception:
            continue
        if _w0 >= week_start:
            pending.append(_dec["reco_key"])   # décidé cette semaine → mesure au prochain rapport
            continue
        _kpi, _lbl_k, _unit, _dir, _f = _spec
        if _cur_kpis is None:
            _cur_kpis = _kpis_window(cur_since, last_full_day)
        _then = _kpis_window(_w0, _w0 + timedelta(days=6)).get(_kpi)
        _now = _cur_kpis.get(_kpi)
        if _then is None or _now is None:
            continue
        _delta = ((_now - _then) / _then * 100) if abs(_then) > 1e-9 else None
        _better = _delta is not None and ((_delta <= -5) if _dir == "down" else (_delta >= 5))
        _worse = _delta is not None and ((_delta >= 5) if _dir == "down" else (_delta <= -5))
        outcomes.append({
            "key": _dec["reco_key"], "week": _w0, "label_k": _lbl_k, "unit": _unit,
            "then": _f.format(_then), "now": _f.format(_now),
            "delta": _delta, "better": _better, "worse": _worse,
        })

    if outcomes or pending:
        _pt, _pi = st.columns([6, 0.4])
        with _pt:
            st.markdown(
                '<div class="p-section-title" style="font-size:14px;margin:18px 0 10px;">'
                "Tes décisions — ce que ça a donné</div>",
                unsafe_allow_html=True,
            )
        with _pi:
            with st.popover("ⓘ", help="Comment lire ce suivi"):
                st.markdown(
                    "Chaque conseil que tu marques **Fait** est re-mesuré la semaine "
                    "suivante : son indicateur au moment de ta décision vs maintenant.  \n\n"
                    "**Lecture honnête** : c'est un avant/après, pas une preuve — la "
                    "saisonnalité, le contenu et le marché jouent aussi. Mais sur la "
                    "durée, c'est le meilleur indicateur de ce qui marche *chez toi*."
                )
        _proof_html = ""
        for _o in outcomes[:3]:
            if _o["better"]:
                _ic, _col, _verdict = "✓", "#1a7a4a", "effet visible"
            elif _o["worse"]:
                _ic, _col, _verdict = "▸", "#b86b00", "pas encore d'effet — à surveiller"
            else:
                _ic, _col, _verdict = "≈", "#8b8e98", "stable pour l'instant"
            _dtx = f" ({_o['delta']:+.0f} %)" if _o["delta"] is not None else ""
            _unit = f" {_o['unit']}" if _o["unit"] else ""
            _wk = f"sem. du {_o['week'].day} {MONTHS_FR[_o['week'].month]}"
            _title_k = KEY_LABELS.get(_o["key"], _o["key"]).capitalize()
            _proof_html += _event_row(
                _ic, _col,
                f"{_title_k} — {_verdict}",
                f"Décidé {_wk} · {_o['label_k']} : {_o['then']}{_unit} → "
                f"<b>{_o['now']}{_unit}</b>{_dtx}",
            )
        if _proof_html:
            st.markdown(
                f'<div style="background:#fff;border:1px solid rgba(14,15,18,0.08);'
                f'border-radius:14px;overflow:hidden;">{_proof_html}</div>',
                unsafe_allow_html=True,
            )
        for _pk in pending[:2]:
            st.markdown(
                f'<div style="font-size:12px;color:#8b8e98;margin-top:6px;">'
                f'◷ « {KEY_LABELS.get(_pk, _pk)} » — décidé cette semaine, '
                f'effet mesuré dès le prochain rapport.</div>',
                unsafe_allow_html=True,
            )

    # ═══ SECTION 3 — LE DÉTAIL, CANAL PAR CANAL ═════════════════════════════
    col_title, col_btn, col_info = st.columns([4, 1, 0.4])
    with col_title:
        st.markdown('<div class="p-section-title">Le détail, canal par canal</div>', unsafe_allow_html=True)
    with col_btn:
        if st.button("↺ Régénérer", key="btn_regen_recos", use_container_width=True):
            st.session_state.pop(wins_cache, None)
            st.rerun()
    with col_info:
        with st.popover("ⓘ", help="Comment lire ces conseils"):
            st.markdown(
                "Chaque conseil est un **guide, pas un ordre** : il t'explique ce qu'il "
                "voit, pourquoi, et comment vérifier avant d'agir.  \n\n"
                "**Une section par canal** (Instagram, Meta Ads…) — chacune avec ses "
                "propres conseils.  \n\n"
                "**Niveau de confiance** :  \n"
                "● **Solide** — données suffisantes, signal franc  \n"
                "◐ **À creuser** — un indice, mais je n'ai pas toute l'image "
                "(ex. tes ventes via Google Analytics)  \n"
                "○ **Piste** — petit échantillon ou suggestion à tester  \n\n"
                "**Règle** = calculé depuis tes chiffres · **IA** = suggestion générative.  \n\n"
                "Les boutons **Utile / Pas pour moi / Fait** sous chaque conseil "
                "m'aident à m'ajuster : « Pas pour moi » fait redescendre ce type de "
                "conseil les semaines suivantes. Ton **objectif** remonte les conseils qui le servent."
            )

    # Sélecteur d'objectif — re-pondère les conseils (réglé une fois, modifiable)
    _obj_labels = {"Équilibré (aucun objectif)": None}
    for _k, _v in OBJECTIFS.items():
        _obj_labels[_v["label"]] = _k
    _obj_keys = list(_obj_labels.keys())
    _cur_label = next((lbl for lbl, k in _obj_labels.items() if k == objectif), _obj_keys[0])

    def _on_objectif_change():
        try:
            update_objectif(client, user_id, _obj_labels[st.session_state["sel_objectif"]])
        except Exception:
            pass

    col_obj, _sp = st.columns([2.4, 3])
    with col_obj:
        st.selectbox(
            "Mon objectif",
            options=_obj_keys,
            index=_obj_keys.index(_cur_label),
            key="sel_objectif",
            on_change=_on_objectif_change,
            help="Oriente les conseils vers ce qui compte le plus pour toi. Modifiable à tout moment.",
        )

    # ── Mon profil : persona dérivé des commentaires, qui personnalise l'IA ───
    if client and user_id:
        with st.expander("🧭 Mon profil — ce que l'IA a compris de moi", expanded=False):
            if persona:
                st.markdown(persona)
            else:
                st.caption(
                    "Encore aucun profil. Laisse un mot (💬) sous les conseils : "
                    "au fil de tes commentaires, l'IA cerne ton profil et adapte ses retours."
                )
            if st.button("↻ Régénérer mon profil", key="persona_regen",
                         help="Recalcule le profil à partir de tous tes commentaires."):
                new_p = regenerate_user_persona(client, user_id, _call_gemini, objectif)
                if new_p:
                    st.toast("Profil mis à jour ✓", icon="✅")
                    st.rerun()
                else:
                    st.toast("Ajoute d'abord quelques commentaires 💬", icon="ℹ️")

    # Rend une carte + ses boutons de feedback (Utile / Pas pour moi / Fait)
    def _render_reco(r, idx):
        st.markdown(_reco_card(idx, r), unsafe_allow_html=True)
        rkey = r.get("key", "")
        if rkey and client and user_id:
            current = feedback.get(rkey)
            b1, b2, b3, _bsp = st.columns([1, 1.4, 0.9, 4])
            _ws = week_start.isoformat()
            with b1:
                if st.button("Utile", key=f"fb_u_{rkey}_{idx}", use_container_width=True,
                             type="primary" if current == "useful" else "secondary"):
                    save_reco_feedback(client, user_id, rkey, "useful", _ws); st.rerun()
            with b2:
                if st.button("Pas pour moi", key=f"fb_n_{rkey}_{idx}", use_container_width=True,
                             type="primary" if current == "not_for_me" else "secondary"):
                    save_reco_feedback(client, user_id, rkey, "not_for_me", _ws); st.rerun()
            with b3:
                if st.button("Fait", key=f"fb_d_{rkey}_{idx}", use_container_width=True,
                             type="primary" if current == "done" else "secondary"):
                    save_reco_feedback(client, user_id, rkey, "done", _ws); st.rerun()

            # ── Commentaire libre → nourrit ton profil (💬) ──────────────────
            existing_comment = comment_map.get(rkey, "")
            _label = "💬 Ton mot" + (" ✓" if existing_comment else "")
            with st.expander(_label, expanded=False):
                txt = st.text_area(
                    "Dis-moi ce que tu en penses (ce que tu aimes, ce qui ne te parle pas…)",
                    value=existing_comment,
                    key=f"cmt_{rkey}_{idx}",
                    height=80,
                    label_visibility="visible",
                )
                if st.button("Envoyer", key=f"cmt_send_{rkey}_{idx}", type="primary"):
                    save_reco_comment(client, user_id, rkey, _ws, txt)
                    st.toast("Merci — ça affine ton profil.", icon="💬")
                    st.rerun()

    def _section_header(icon, name, n):
        st.markdown(
            f'<div style="display:flex;align-items:center;gap:9px;margin:22px 0 12px;">'
            f'<span style="font-size:17px;color:#5a5d66;">{icon}</span>'
            f'<span style="font-size:15px;font-weight:600;color:#0e0f12;">{name}</span>'
            f'<span style="font-size:11px;color:#8b8e98;background:rgba(14,15,18,0.05);'
            f'border-radius:20px;padding:1px 8px;">{n}</span></div>',
            unsafe_allow_html=True,
        )

    SECTIONS = [
        ("instagram", "◎", "Instagram organique", insta_items),
        ("meta", "▣", "Publicité (Meta · Google)", meta_items),
    ]
    _idx = 0
    rendered_any = False
    for skey, icon, name, items in SECTIONS:
        if not items:
            continue
        rendered_any = True
        _section_header(icon, name, len(items))
        for r in items:
            _idx += 1
            _render_reco(r, _idx)

    if not rendered_any:
        if has_data:
            st.success(
                "Aucune alerte cette semaine — tes comptes tournent dans tes normes. "
                "Profites-en pour préparer ta prochaine création."
            )
        else:
            st.info("Connecte tes comptes Meta et Instagram dans **Mon compte** pour voir ton rapport hebdo personnalisé.")

    # ── Publication SaaS : le rapport précalculé (payload JSON) ──────────────
    # Pont vers Pulse (saas/web) : l'ouverture du rapport publie EXACTEMENT ce
    # qui est affiché ici — y compris les thèmes et la boucle de la preuve.
    # Le worker cron (saas/worker/build_report.py) publie le même schéma.
    # Table absente (migration pas passée) → on ignore sans casser le rapport.
    if client and user_id and has_data:
        _pub_sig = (f"{_ws_iso}_{_facts_sig}_{_n_done}_{_n_useful}_{_n_skip}_"
                    f"{1 if wins_txt else 0}_{len(theme_rows)}_{len(outcomes)}_{len(pending)}")
        if st.session_state.get("weekly_report_pub_sig") != _pub_sig:
            _payload = {
                "version": 1,
                "week_label": week_label,
                "since": cur_since.isoformat(),
                "until": last_full_day.isoformat(),
                "verdict": verdict,
                "brief": wins_txt,
                "suivi": {"applique": _n_done, "utile": _n_useful, "ecarte": _n_skip},
                "todo": [
                    {"key": r["key"], "title": r["title"], "platform": r["platform"],
                     "done": feedback.get(r["key"]) == "done"}
                    for r in todos
                ],
                "recos": [
                    {k: r.get(k) for k in (
                        "key", "platform", "title", "observation", "pourquoi",
                        "verifier", "repere", "angle_mort", "confidence", "priority")}
                    for r in sorted(insta_items + meta_items, key=lambda r: r["priority"])
                ],
                "themes": (
                    {"rows": [{"label": t["label"], "spend": round(float(t["spend"]), 2),
                               "rev": round(float(t["rev"]), 2)} for t in theme_rows],
                     "orphan": round(float(_rev_orphan), 2)}
                    if theme_rows else None
                ),
                "preuve": (
                    {"outcomes": [
                        {"key": o["key"],
                         "title": KEY_LABELS.get(o["key"], o["key"]).capitalize(),
                         "week_label": f"sem. du {o['week'].day} {MONTHS_FR[o['week'].month]}",
                         "kpi": o["label_k"], "unit": o["unit"],
                         "then": o["then"], "now": o["now"],
                         "delta": round(o["delta"], 1) if o["delta"] is not None else None,
                         "verdict": ("better" if o["better"]
                                     else "worse" if o["worse"] else "stable")}
                        for o in outcomes[:3]
                    ],
                     "pending": [{"key": k, "title": KEY_LABELS.get(k, k)}
                                 for k in pending[:2]]}
                    if (outcomes or pending) else None
                ),
            }
            try:
                upsert_weekly_report(client, user_id, _ws_iso, _payload)
                st.session_state["weekly_report_pub_sig"] = _pub_sig
            except Exception:
                pass
