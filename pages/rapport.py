import math
import streamlit as st
import pandas as pd
import requests
from datetime import date, timedelta

from scripts.fetch_data import fetch_meta_ads, fetch_post_metrics, fetch_daily_followers

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


def _health_score(avg_ctr, avg_cpc, followers_delta, avg_engagement):
    scores = []
    if avg_ctr > 0:
        scores.append(min(100, avg_ctr / 3.0 * 100))
    if avg_cpc > 0:
        scores.append(max(0, 100 - (avg_cpc / 3.0) * 100))
    if followers_delta is not None:
        scores.append(70 if followers_delta > 0 else 40)
    if avg_engagement > 0:
        scores.append(min(100, avg_engagement / 3.0 * 100))
    return int(sum(scores) / len(scores)) if scores else 50


def _score_ring(value, color):
    r, cx, cy = 28, 34, 34
    c = 2 * math.pi * r
    off = c - (value / 100) * c
    return (
        f'<svg width="68" height="68" viewBox="0 0 68 68">'
        f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="#f3f2ed" stroke-width="6"/>'
        f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{color}" stroke-width="6"'
        f' stroke-dasharray="{c:.2f}" stroke-dashoffset="{off:.2f}"'
        f' stroke-linecap="round" transform="rotate(-90 {cx} {cy})"/>'
        f'</svg>'
    )


def _delta_badge(val, unit="", invert=False):
    if val is None or val == 0:
        return '<span style="font-size:11.5px;color:#8b8e98;">—</span>'
    good = val > 0 if not invert else val < 0
    color = "#1a7a4a" if good else "#c0392b"
    sign = "+" if val > 0 else ""
    return f'<span style="font-size:11.5px;color:{color};font-weight:500;">{sign}{val}{unit} vs sem. dern.</span>'


def _reco_card(idx, kicker, kicker_color, title, body, action_label):
    return f"""
    <div style="background:#fff;border:1px solid rgba(14,15,18,0.08);border-radius:14px;
                padding:20px;display:grid;grid-template-columns:auto 1fr;gap:18px;
                align-items:start;margin-bottom:10px;">
      <div style="width:36px;height:36px;border-radius:10px;
                  background:{kicker_color}1a;color:{kicker_color};
                  display:grid;place-items:center;
                  font-family:'Instrument Serif',Georgia,serif;font-size:20px;font-weight:500;
                  flex-shrink:0;">{idx}</div>
      <div>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px;">
          <span style="background:{kicker_color}1a;color:{kicker_color};
                       font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;">{kicker}</span>
        </div>
        <div style="font-size:15px;font-weight:600;letter-spacing:-0.2px;margin-bottom:6px;color:#0e0f12;">{title}</div>
        <div style="font-size:13px;color:#5a5d66;line-height:1.55;">{body}</div>
      </div>
    </div>"""


def _event_row(icon, color, title, body, last=False):
    border = "" if last else "border-bottom:1px solid rgba(14,15,18,0.08);"
    return f"""
    <div style="display:grid;grid-template-columns:auto 1fr;gap:14px;
                padding:14px 18px;{border}align-items:center;">
      <div style="width:28px;height:28px;border-radius:8px;background:#f7f7f4;
                  display:grid;place-items:center;color:{color};font-size:14px;font-weight:700;">{icon}</div>
      <div style="font-size:13px;color:#0e0f12;"><b>{title}</b> {body}</div>
    </div>"""


def show_rapport(client, user_id: str, is_paid: bool = False):
    today = date.today()
    week_ago = today - timedelta(days=7)

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

    # ── Métriques Meta Ads (7 derniers jours) ────────────────────────────────
    total_spend = 0.0
    total_clicks = 0
    total_impressions = 0
    avg_ctr = 0.0
    avg_cpc = 0.0
    df_camp = pd.DataFrame()

    if df_meta_raw is not None and not df_meta_raw.empty:
        for col in ["impressions", "clicks", "spend"]:
            if col in df_meta_raw.columns:
                df_meta_raw[col] = pd.to_numeric(df_meta_raw[col], errors="coerce").fillna(0)
        df_meta_raw["date_start"] = pd.to_datetime(df_meta_raw["date_start"], errors="coerce")
        df_meta = df_meta_raw[df_meta_raw["date_start"] >= pd.Timestamp(week_ago)]

        if not df_meta.empty:
            total_spend = df_meta["spend"].sum()
            total_clicks = int(df_meta["clicks"].sum())
            total_impressions = int(df_meta["impressions"].sum())
            avg_ctr = (total_clicks / total_impressions * 100) if total_impressions > 0 else 0.0
            avg_cpc = (total_spend / total_clicks) if total_clicks > 0 else 0.0

            df_camp = df_meta.groupby("campaign_name", as_index=False).agg(
                spend=("spend", "sum"), clicks=("clicks", "sum"), impressions=("impressions", "sum")
            )
            df_camp["ctr"] = df_camp.apply(lambda r: r["clicks"] / r["impressions"] * 100 if r["impressions"] > 0 else 0, axis=1)
            df_camp["cpc"] = df_camp.apply(lambda r: r["spend"] / r["clicks"] if r["clicks"] > 0 else 0, axis=1)

    # ── Métriques Instagram ───────────────────────────────────────────────────
    followers_current = 0
    followers_delta = 0
    avg_engagement = 0.0

    if not df_follows.empty:
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
                if r["reach"] > 0 else 0, axis=1
            )
            avg_engagement = df_insta["eng"].mean()

    has_data = total_spend > 0 or followers_current > 0

    # ── Score santé ───────────────────────────────────────────────────────────
    score = _health_score(avg_ctr, avg_cpc,
                          followers_delta if not df_follows.empty else None,
                          avg_engagement)
    if score >= 80:   score_label, score_color = "Excellent", "#1a7a4a"
    elif score >= 65: score_label, score_color = "Bon", "#1a7a4a"
    elif score >= 45: score_label, score_color = "À surveiller", "#b86b00"
    else:             score_label, score_color = "Faible", "#c0392b"

    # ── Semaine label ────────────────────────────────────────────────────────
    week_num = today.isocalendar()[1]
    d0 = today - timedelta(days=6)
    week_label = f"Semaine {week_num} · {d0.day} → {today.day} {MONTHS_FR[today.month]}"

    # ── Résumé IA ─────────────────────────────────────────────────────────────
    cache_key = f"rapport_summary_{user_id}_{today.isoformat()}"
    summary = st.session_state.get(cache_key)

    if summary is None and has_data:
        prompt = (
            "Génère exactement 1 phrase de résumé hebdo en français (max 25 mots), "
            "directe et actionnable pour un gestionnaire de PME. "
            f"Données : CPC={avg_cpc:.2f} CHF, CTR={avg_ctr:.2f}%, "
            f"dépenses={total_spend:.0f} CHF, abonnés delta={followers_delta}, "
            f"engagement={avg_engagement:.1f}%. "
            "Commence par un fait fort, termine par une action concrète. "
            "Pas de formule de politesse, pas de guillemets."
        )
        result = _call_gemini(prompt)
        if result:
            st.session_state[cache_key] = result
            summary = result

    if not summary:
        if total_spend > 0:
            summary = f"Tes campagnes coûtent {avg_cpc:.2f} CHF/clic avec {avg_ctr:.1f}% CTR — analyse les campagnes inefficaces lundi."
        elif followers_current > 0:
            summary = f"+{followers_delta} abonnés cette semaine — continue le format qui génère le plus de portée."
        else:
            summary = "Connecte tes comptes Meta et Instagram pour voir ton résumé personnalisé."

    # ── Recommandations IA ────────────────────────────────────────────────────
    reco_cache_key = f"rapport_recos_{user_id}_{today.isoformat()}"
    recos_raw = st.session_state.get(reco_cache_key)

    if recos_raw is None and has_data:
        reco_prompt = (
            "Tu es un expert marketing PME. Génère exactement 3 recommandations hebdo en français. "
            "Format strict pour chaque recommandation (sépare par |||) :\n"
            "KICKER | TITRE | CORPS (max 30 mots)\n"
            "KICKER = emoji + label court (ex: 🛑 Couper le gaspillage)\n"
            f"Données semaine : dépenses={total_spend:.0f} CHF, CTR={avg_ctr:.2f}%, "
            f"CPC={avg_cpc:.2f} CHF, clics={total_clicks}, abonnés delta={followers_delta}, "
            f"engagement Instagram={avg_engagement:.1f}%. "
            "Chaque recommandation doit être concrète et réalisable en moins de 20 min. "
            "Réponds uniquement avec les 3 lignes formatées, séparées par |||."
        )
        result = _call_gemini(reco_prompt)
        if result:
            st.session_state[reco_cache_key] = result
            recos_raw = result

    recos = []
    if recos_raw:
        for line in recos_raw.split("|||"):
            parts = [p.strip() for p in line.strip().split("|")]
            if len(parts) >= 3:
                recos.append({"kicker": parts[0], "title": parts[1], "body": parts[2]})

    # Fallback recos si pas de données ou Gemini échoue
    if not recos:
        if total_spend > 0:
            recos = [
                {"kicker": "🛑 Auditer", "title": "Vérifie tes campagnes les plus coûteuses",
                 "body": f"Identifie les campagnes avec CPC > {avg_cpc*2:.0f} CHF et mets-les en pause si le CTR est faible."},
                {"kicker": "📈 Scaler", "title": "Double le budget de ta meilleure campagne",
                 "body": "Augmente de 30% le budget de la campagne avec le meilleur CTR cette semaine."},
                {"kicker": "📅 Planifier", "title": "Programme ton prochain post Instagram",
                 "body": "Publie un Reel en semaine entre 18h et 20h pour maximiser l'engagement."},
            ]
        else:
            recos = [
                {"kicker": "🔌 Connecter", "title": "Connecte ton compte Meta Ads",
                 "body": "Va dans Mon compte → Connecter Meta pour voir tes données publicitaires."},
                {"kicker": "📸 Importer", "title": "Récupère tes données Instagram",
                 "body": "Clique sur Récupérer mes données dans l'onglet Instagram."},
                {"kicker": "🎯 Objectif", "title": "Définis ton objectif hebdo",
                 "body": "Fixe un CPC cible et un nombre de nouveaux abonnés pour la semaine."},
            ]

    # ── "Ce qui a changé" events ─────────────────────────────────────────────
    events = []
    if not df_camp.empty and len(df_camp) >= 2:
        avg_cpc_all = df_camp[df_camp["cpc"] > 0]["cpc"].mean() or 1
        worst = df_camp.loc[df_camp["cpc"].idxmax()]
        best = df_camp.loc[df_camp["ctr"].idxmax()]
        if worst["cpc"] > avg_cpc_all * 4 and worst["cpc"] > 3:
            events.append({"icon": "↓", "color": "#c0392b",
                           "title": f"« {worst['campaign_name'][:35]} »",
                           "body": f"CPC à {worst['cpc']:.2f} CHF — {worst['cpc']/avg_cpc_all:.0f}× la moyenne. À couper."})
        if best["ctr"] > avg_ctr * 1.5 and best["ctr"] > 0:
            events.append({"icon": "↑", "color": "#1a7a4a",
                           "title": f"« {best['campaign_name'][:35]} »",
                           "body": f"CTR à {best['ctr']:.1f}% — meilleure campagne. Augmente le budget."})

    if followers_delta > 5:
        events.append({"icon": "↑", "color": "#1a7a4a",
                       "title": f"+{followers_delta} nouveaux abonnés",
                       "body": "Croissance organique positive cette semaine."})
    elif followers_delta < -5:
        events.append({"icon": "↓", "color": "#c0392b",
                       "title": f"{followers_delta} abonnés perdus",
                       "body": "Analyse le contenu et les créneaux de publication."})

    if avg_engagement > 3:
        events.append({"icon": "★", "color": "#3b5bff",
                       "title": f"Engagement Instagram à {avg_engagement:.1f}%",
                       "body": "3× au-dessus du benchmark TPE. Continue ce format."})

    # ── CSS inline Pulse ─────────────────────────────────────────────────────
    st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600&display=swap');
    .p-eyebrow { font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#8b8e98;font-weight:600;margin-bottom:6px; }
    .p-h1 { font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:32px;letter-spacing:-0.02em;margin:0 0 4px;line-height:1.15;color:#0e0f12; }
    .p-hero { display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:22px; }
    .p-score-num { font-family:'JetBrains Mono',monospace;font-size:30px;font-weight:500;line-height:1;letter-spacing:-0.02em;color:#0e0f12; }
    .p-strip { display:grid;grid-template-columns:minmax(0,1.2fr) repeat(3,1fr);border:1px solid rgba(14,15,18,0.08);border-radius:14px;overflow:hidden;background:#fff;margin-bottom:24px; }
    .p-strip-col { padding:18px;border-right:1px solid rgba(14,15,18,0.08); }
    .p-strip-col:last-child { border-right:none; }
    .p-strip-label { font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#8b8e98;font-weight:600;margin-bottom:6px; }
    .p-strip-val { font-family:'JetBrains Mono',monospace;font-size:22px;letter-spacing:-0.02em;font-weight:500;color:#0e0f12;margin-bottom:4px; }
    .p-section-title { font-size:13px;font-weight:600;letter-spacing:-0.1px;color:#0e0f12;display:flex;align-items:center;gap:8px;margin-bottom:12px; }
    .p-section-muted { color:#8b8e98;font-family:'JetBrains Mono',monospace;font-weight:400;font-size:12px; }
    </style>
    """, unsafe_allow_html=True)

    # ── Hero ─────────────────────────────────────────────────────────────────
    st.markdown(f"""
    <div class="p-hero">
      <div>
        <div class="p-eyebrow">{week_label}</div>
        <div class="p-h1">Voici ce qui compte cette semaine.</div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;flex-shrink:0;">
        <div style="text-align:right;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#8b8e98;font-weight:600;">Santé du compte</div>
          <div class="p-score-num">{score}<span style="color:#8b8e98;font-size:18px;">/100</span></div>
          <div style="font-size:11.5px;color:{score_color};font-weight:500;margin-top:2px;">↑ {score_label}</div>
        </div>
        {_score_ring(score, score_color)}
      </div>
    </div>
    """, unsafe_allow_html=True)

    # ── Strip TL;DR ───────────────────────────────────────────────────────────
    abonnes_val = f"+{followers_delta}" if followers_delta > 0 else (str(followers_delta) if followers_delta != 0 else "—")
    followers_d = _delta_badge(followers_delta)
    spend_val = f"CHF {total_spend:,.0f}" if total_spend > 0 else "—"
    clicks_val = str(total_clicks) if total_clicks > 0 else "—"

    st.markdown(f"""
    <div class="p-strip">
      <div class="p-strip-col" style="background:#f7f7f4;">
        <div class="p-strip-label">Le résumé en une phrase</div>
        <div style="font-size:15px;line-height:1.45;font-weight:500;color:#0e0f12;">{summary}</div>
      </div>
      <div class="p-strip-col">
        <div class="p-strip-label">Dépensé</div>
        <div class="p-strip-val">{spend_val}</div>
        <div style="font-size:11.5px;color:#8b8e98;">Meta Ads · 7j</div>
      </div>
      <div class="p-strip-col">
        <div class="p-strip-label">Clics</div>
        <div class="p-strip-val">{clicks_val}</div>
        <div style="font-size:11.5px;color:#8b8e98;">CTR {avg_ctr:.2f}%</div>
      </div>
      <div class="p-strip-col">
        <div class="p-strip-label">Abonnés</div>
        <div class="p-strip-val">{abonnes_val}</div>
        {followers_d}
      </div>
    </div>
    """, unsafe_allow_html=True)

    # ── 3 actions pour lundi ──────────────────────────────────────────────────
    col_title, col_btn = st.columns([4, 1])
    with col_title:
        st.markdown('<div class="p-section-title">Tes 3 actions pour lundi</div>', unsafe_allow_html=True)
    with col_btn:
        if st.button("↺ Régénérer", key="btn_regen_recos", use_container_width=True):
            st.session_state.pop(reco_cache_key, None)
            st.rerun()

    KICKER_COLORS = ["#c0392b", "#1a7a4a", "#3b5bff"]
    cards_html = ""
    for i, r in enumerate(recos[:3]):
        cards_html += _reco_card(i + 1, r["kicker"], KICKER_COLORS[i], r["title"], r["body"], "Appliquer")
    st.markdown(cards_html, unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)

    # ── Cette semaine vs la précédente ───────────────────────────────────────
    if has_data:
        import plotly.graph_objects as go

        DAY_ABBR = ["L", "M", "M", "J", "V", "S", "D"]
        c1, c2 = st.columns(2)

        # CPC par jour (Meta Ads)
        with c1:
            st.markdown(
                '<div class="p-section-title">Coût par clic (CPC)'
                '<span class="p-section-muted"> · cette semaine</span></div>',
                unsafe_allow_html=True,
            )
            if df_meta_raw is not None and not df_meta_raw.empty:
                _df_cpc = (
                    df_meta_raw[df_meta_raw["date_start"] >= pd.Timestamp(week_ago)]
                    .groupby(df_meta_raw["date_start"].dt.date, as_index=False)
                    .agg(spend=("spend", "sum"), clicks=("clicks", "sum"))
                )
                _df_cpc["cpc"] = _df_cpc.apply(
                    lambda r: r["spend"] / r["clicks"] if r["clicks"] > 0 else 0, axis=1
                )
                _df_cpc["dow"] = pd.to_datetime(_df_cpc["date_start"]).dt.dayofweek
                _df_cpc["lbl"] = _df_cpc["dow"].apply(lambda d: DAY_ABBR[d])
                best_idx = _df_cpc["cpc"].idxmin() if not _df_cpc.empty else None
                bar_colors = [
                    "#3b5bff" if i == best_idx else "rgba(14,15,18,0.1)"
                    for i in _df_cpc.index
                ]
                fig_cpc = go.Figure(go.Bar(
                    x=_df_cpc["lbl"], y=_df_cpc["cpc"],
                    marker_color=bar_colors,
                    text=_df_cpc["cpc"].apply(lambda v: f"{v:.2f}"),
                    textposition="outside", textfont=dict(size=9, color="#0e0f12"),
                ))
                fig_cpc.update_layout(
                    height=160, margin=dict(l=0, r=0, t=24, b=0),
                    paper_bgcolor="#fff", plot_bgcolor="#fff",
                    showlegend=False, template="plotly_white",
                    xaxis=dict(showgrid=False, color="#8b8e98", tickfont=dict(size=10)),
                    yaxis=dict(showgrid=True, gridcolor="#f4f3f1", color="#8b8e98", tickfont=dict(size=9)),
                )
                st.plotly_chart(fig_cpc, use_container_width=True, config={"displayModeBar": False})
                best_cpc = _df_cpc["cpc"].min() if not _df_cpc.empty else avg_cpc
                st.markdown(
                    f'<div style="padding:10px 12px;background:#faf9f6;border-radius:8px;'
                    f'font-size:12px;color:#5a5d66;line-height:1.5;">'
                    f'<b style="color:#0e0f12">Ton CPC moyen : {avg_cpc:.2f} CHF</b> · '
                    f'Meilleur jour : {best_cpc:.2f} CHF. '
                    f'Combien tu paies en moyenne quand quelqu\'un clique sur ta pub.</div>',
                    unsafe_allow_html=True,
                )
            else:
                st.markdown(
                    '<div style="color:#8b8e98;font-size:13px;padding:12px 0">Pas de données Meta Ads cette semaine.</div>',
                    unsafe_allow_html=True,
                )

        # Engagement Instagram par jour
        with c2:
            st.markdown(
                '<div class="p-section-title">Engagement Instagram'
                '<span class="p-section-muted"> · cette semaine</span></div>',
                unsafe_allow_html=True,
            )
            if not df_insta.empty and "date" in df_insta.columns and "eng" in df_insta.columns:
                _df_eng = df_insta.copy()
                _df_eng["_dt"] = pd.to_datetime(_df_eng["date"], errors="coerce")
                _df_eng = _df_eng.dropna(subset=["_dt"])
                _df_eng["_d"] = _df_eng["_dt"].dt.date
                _df_eng["dow"] = _df_eng["_dt"].dt.dayofweek
                _daily_eng = _df_eng.groupby("dow")["eng"].mean().reset_index()
                _daily_eng["lbl"] = _daily_eng["dow"].apply(lambda d: DAY_ABBR[d])
                best_eng_idx = _daily_eng["eng"].idxmax() if not _daily_eng.empty else None
                bar_colors_eng = [
                    "#0e0f12" if i == best_eng_idx else "rgba(14,15,18,0.1)"
                    for i in _daily_eng.index
                ]
                fig_eng = go.Figure(go.Bar(
                    x=_daily_eng["lbl"], y=_daily_eng["eng"],
                    marker_color=bar_colors_eng,
                    text=_daily_eng["eng"].apply(lambda v: f"{v:.1f}%"),
                    textposition="outside", textfont=dict(size=9, color="#0e0f12"),
                ))
                fig_eng.update_layout(
                    height=160, margin=dict(l=0, r=0, t=24, b=0),
                    paper_bgcolor="#fff", plot_bgcolor="#fff",
                    showlegend=False, template="plotly_white",
                    xaxis=dict(showgrid=False, color="#8b8e98", tickfont=dict(size=10)),
                    yaxis=dict(showgrid=True, gridcolor="#f4f3f1", color="#8b8e98", tickfont=dict(size=9)),
                )
                st.plotly_chart(fig_eng, use_container_width=True, config={"displayModeBar": False})
                best_eng_day = DAY_ABBR[int(_daily_eng.loc[best_eng_idx, "dow"])] if best_eng_idx is not None else "—"
                best_eng_val = _daily_eng["eng"].max() if not _daily_eng.empty else avg_engagement
                st.markdown(
                    f'<div style="padding:10px 12px;background:#faf9f6;border-radius:8px;'
                    f'font-size:12px;color:#5a5d66;line-height:1.5;">'
                    f'<b style="color:#0e0f12">Pic le {best_eng_day} à {best_eng_val:.1f} %.</b> '
                    f'Likes + commentaires + saves divisés par ta portée. '
                    f'Plus c\'est élevé, plus l\'algo te pousse.</div>',
                    unsafe_allow_html=True,
                )
            else:
                st.markdown(
                    '<div style="color:#8b8e98;font-size:13px;padding:12px 0">Pas de données Instagram cette semaine.</div>',
                    unsafe_allow_html=True,
                )

    st.markdown("<br>", unsafe_allow_html=True)

    # ── Ce qui a changé ───────────────────────────────────────────────────────
    if events:
        st.markdown('<div class="p-section-title">Ce qui a changé cette semaine</div>', unsafe_allow_html=True)
        rows_html = "".join(_event_row(e["icon"], e["color"], e["title"], e["body"], i == len(events) - 1)
                            for i, e in enumerate(events))
        st.markdown(
            f'<div style="background:#fff;border:1px solid rgba(14,15,18,0.08);border-radius:14px;overflow:hidden;">'
            f'{rows_html}</div>',
            unsafe_allow_html=True
        )
    elif not has_data:
        st.info("Connecte tes comptes Meta et Instagram dans **Mon compte** pour voir ton rapport hebdo personnalisé.")
