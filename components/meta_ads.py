import time

import streamlit as st
import requests
import json
import pandas as pd
import plotly.express as px

from scripts.insert_data import upsert_meta_ads
from scripts.fetch_data import fetch_meta_ads, fetch_meta_ads_latest_date
from components.insights_panel import show_insights_panel

PULSE_CSS = """
<style>
.page-h { padding: 28px 0 24px; }
.h-eyebrow { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: var(--ink-4, #8b8e98); margin-bottom: 6px; }
.page-h h1 { font-family: var(--font-display, "Instrument Serif", Georgia, serif); font-size: 2rem; font-weight: 400; color: var(--ink, #0e0f12); margin: 0 0 6px; line-height: 1.2; }
.h-sub { font-size: 14px; color: var(--ink-3, #5a5d66); margin: 0; }
.kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin: 20px 0; }
.kpi { background: #fff; border: 1px solid var(--line, rgba(14,15,18,0.08)); border-radius: var(--r-lg, 14px); padding: 18px 20px; }
.k-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.7px; color: var(--ink-4, #8b8e98); margin-bottom: 8px; }
.k-value { font-family: var(--font-mono, "JetBrains Mono", monospace); font-size: 1.75rem; font-weight: 600; color: var(--ink, #0e0f12); line-height: 1.1; margin-bottom: 6px; }
.k-foot { font-size: 12px; color: var(--ink-4, #8b8e98); }
.delta { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; }
.delta.up { background: #e7f3ec; color: #1a7a4a; }
.delta.down { background: #fbe9e6; color: #c0392b; }
.card { background: #fff; border: 1px solid var(--line, rgba(14,15,18,0.08)); border-radius: var(--r-lg, 14px); padding: 20px; margin-bottom: 12px; }
.section { margin: 28px 0 16px; }
.section-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 14px; }
.section-title { font-size: 15px; font-weight: 600; color: var(--ink, #0e0f12); }
.st-count { font-size: 12px; color: var(--ink-4, #8b8e98); background: var(--line, rgba(14,15,18,0.06)); border-radius: 20px; padding: 2px 8px; }
.chip { display: inline-block; padding: 2px 9px; border-radius: 20px; font-size: 11px; font-weight: 600; }
.chip.good { background: #e7f3ec; color: #1a7a4a; }
.chip.bad { background: #fbe9e6; color: #c0392b; }
.chip.warn { background: #fbf1de; color: #b86b00; }
.chip.outline { background: transparent; color: var(--ink-3, #5a5d66); border: 1px solid var(--line, rgba(14,15,18,0.12)); }
.camp-row { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
.camp-name { font-weight: 600; font-size: 14px; color: var(--ink, #0e0f12); }
.camp-metrics { display: flex; gap: 20px; flex-wrap: wrap; }
.camp-metric { font-size: 12px; color: var(--ink-3, #5a5d66); }
.camp-metric span { font-family: var(--font-mono, "JetBrains Mono", monospace); font-weight: 600; color: var(--ink, #0e0f12); }
.bar { background: var(--line, rgba(14,15,18,0.06)); border-radius: 6px; height: 6px; overflow: hidden; margin-top: 10px; }
.bar > span { display: block; height: 100%; border-radius: 6px; }
.hint { background: #f0f4ff; border-radius: 10px; padding: 12px 16px; display: flex; gap: 10px; align-items: flex-start; margin: 16px 0; }
.hint-ico { font-size: 16px; flex-shrink: 0; }
.hint p { font-size: 13px; color: #2c3e8c; margin: 0; }
</style>
"""


@st.fragment
def meta_ads_source_fragment(token, supabase=None, user_id=None):
    if supabase and user_id and "meta_ads_df" not in st.session_state:
        try:
            persisted = fetch_meta_ads(supabase, user_id)
            if persisted:
                st.session_state["meta_ads_df"] = pd.DataFrame(persisted)
        except Exception:
            pass

    r = requests.get(
        "https://graph.facebook.com/v24.0/me/adaccounts",
        params={"fields": "id,name", "access_token": token}
    )
    ad_accounts = r.json().get("data", [])

    if ad_accounts:
        for acc in ad_accounts:
            r2 = requests.get(
                f"https://graph.facebook.com/v24.0/{acc['id']}/campaigns",
                params={"fields": "id", "access_token": token, "limit": 1000}
            )
            nb_campaigns = len(r2.json().get("data", []))
            st.markdown(f"<div class='account-name'>{acc['name']}</div><div class='account-meta'>{nb_campaigns} campagne(s)</div>", unsafe_allow_html=True)
    else:
        st.markdown("<div style='color:#6b6b6b;padding:12px 0'>Aucun compte publicitaire trouvé.</div>", unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)

    has_data = st.session_state.get("meta_ads_df") is not None
    btn_label = "Rafraîchir les données Meta Ads" if has_data else "Récupérer les données Meta Ads"
    force_full = has_data and st.checkbox("Récupérer tout l'historique (1 an)", key="chk_force_full")
    if st.button(btn_label, type="primary", key="btn_fetch_meta_ads"):
        if not ad_accounts:
            st.warning("Aucun compte publicitaire trouvé.")
            return
        progress_bar = st.progress(0, text="Connexion à Meta Ads...")
        ad_account_id = ad_accounts[0]["id"]
        url = f"https://graph.facebook.com/v24.0/{ad_account_id}/insights"

        from datetime import date, timedelta
        today = date.today()
        latest_date = fetch_meta_ads_latest_date(supabase, user_id) if (supabase and user_id and not force_full) else None
        if latest_date:
            since = date.fromisoformat(latest_date) + timedelta(days=1)
        else:
            since = today - timedelta(days=365)

        if since > today:
            progress_bar.empty()
            st.info("✅ Données déjà à jour.")
            return

        time_range = {"since": since.isoformat(), "until": today.isoformat()}
        st.caption(f"🔍 DEBUG — Fetch du {since} au {today}")
        params = {
            "access_token": token,
            "level": "ad",
            "fields": "campaign_name,adset_name,ad_name,impressions,clicks,reach,spend,actions,date_start,effective_status",
            "time_increment": 1,
            "time_range": json.dumps(time_range),
        }
        progress_bar.progress(20, text="Compte trouvé, récupération des données...")
        result = requests.get(url=url, params=params).json()
        if "error" in result:
            st.error(f"Erreur API Meta : {result['error'].get('message', 'inconnue')} (code {result['error'].get('code', '?')})")
            progress_bar.empty()
            return
        rows = result.get("data", [])
        progress_bar.progress(50, text=f"Chargement des données... ({len(rows)} lignes)")
        next_url = result.get("paging", {}).get("next")
        while next_url:
            page = requests.get(next_url).json()
            rows += page.get("data", [])
            next_url = page.get("paging", {}).get("next")
            progress_bar.progress(min(80, 50 + len(rows) // 100), text=f"Chargement... ({len(rows)} lignes)")
        for row in rows:
            link_click_item = next(
                (item for item in row.get("actions", []) if item.get("action_type") == "link_click"),
                None,
            )
            row["link_clicks"] = int(link_click_item.get("value", 0)) if link_click_item else 0
        if rows:
            progress_bar.progress(100, text=f"✓ {len(rows)} entrées chargées")
            time.sleep(0.5)
            progress_bar.empty()
            if supabase and user_id:
                try:
                    upsert_meta_ads(supabase, user_id, rows)
                except Exception as e:
                    st.error(f"❌ Sauvegarde Supabase échouée : {e}")
                    st.stop()

            if supabase and user_id:
                try:
                    persisted = fetch_meta_ads(supabase, user_id)
                    df_loaded = pd.DataFrame(persisted) if persisted else pd.DataFrame(rows)
                except Exception:
                    df_loaded = pd.DataFrame(rows)
            else:
                df_loaded = pd.DataFrame(rows)

            st.session_state["meta_ads_df"] = df_loaded
            st.rerun()
        else:
            progress_bar.empty()
            st.info("Aucune donnée disponible.")
            st.session_state.pop("meta_ads_df", None)


def _health_score(ctr: float, cpc: float) -> int:
    ctr_score = min(100, ctr / 3 * 100)
    if cpc > 0:
        cpc_score = max(0, 100 - cpc * 20)
    else:
        cpc_score = 50
    return int(min(100, max(0, (ctr_score + cpc_score) / 2)))


def _bar_color(score: int) -> str:
    if score >= 70:
        return "#1a7a4a"
    if score >= 40:
        return "#b86b00"
    return "#c0392b"


def _status_chip(status: str) -> str:
    s = (status or "").upper()
    if s == "ACTIVE":
        return "<span class='chip good'>Actif</span>"
    if s in ("PAUSED", "CAMPAIGN_PAUSED", "ADSET_PAUSED"):
        return "<span class='chip outline'>En pause</span>"
    return "<span class='chip warn'>Alerte</span>"


def show_meta_ads_tab(is_paid: bool = False):
    st.markdown(PULSE_CSS, unsafe_allow_html=True)

    df_raw = st.session_state.get("meta_ads_df")

    col_hero, col_period = st.columns([3, 1])
    with col_period:
        period_label = st.selectbox(
            "Période",
            ["7 derniers jours", "24 dernières heures", "30 derniers jours", "90 derniers jours"],
            key="meta_period_sel",
            label_visibility="collapsed",
        )

    period_days = {"24 dernières heures": 1, "7 derniers jours": 7, "30 derniers jours": 30, "90 derniers jours": 90}
    days = period_days.get(period_label, 7)

    if df_raw is None or (isinstance(df_raw, pd.DataFrame) and df_raw.empty):
        with col_hero:
            st.markdown(f"""
            <div class='page-h'>
                <div class='h-eyebrow'>Meta Ads · {period_label}</div>
                <h1>Connecte ton compte Meta pour voir tes campagnes.</h1>
            </div>
            """, unsafe_allow_html=True)
        st.info("Connecte ton compte Meta Ads dans l'onglet **Connecter Meta** pour voir les données.")
        return

    df = df_raw.copy()
    for col in ["impressions", "clicks", "spend", "reach", "link_clicks"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    df["date_start"] = pd.to_datetime(df["date_start"], errors="coerce")

    from datetime import date, timedelta
    cutoff = pd.Timestamp(date.today() - timedelta(days=days))
    df = df[df["date_start"] >= cutoff]

    if df.empty:
        with col_hero:
            st.markdown(f"""
            <div class='page-h'>
                <div class='h-eyebrow'>Meta Ads · {period_label}</div>
                <h1>Aucune donnée sur cette période.</h1>
            </div>
            """, unsafe_allow_html=True)
        return

    total_spend = df["spend"].sum()
    total_clicks = int(df["clicks"].sum())
    total_impressions = int(df["impressions"].sum())
    avg_ctr = (total_clicks / total_impressions * 100) if total_impressions > 0 else 0.0
    avg_cpc = (total_spend / total_clicks) if total_clicks > 0 else 0.0
    nb_campaigns = df["campaign_name"].nunique() if "campaign_name" in df.columns else 0

    with col_hero:
        st.markdown(f"""
        <div class='page-h'>
            <div class='h-eyebrow'>Meta Ads · {period_label}</div>
            <h1>{nb_campaigns} campagne{"s" if nb_campaigns > 1 else ""} en cours, {total_spend:,.0f} CHF dépensés.</h1>
            <p class='h-sub'>{total_clicks:,} clics · CTR {avg_ctr:.2f}% · CPC {avg_cpc:.2f} CHF</p>
        </div>
        """, unsafe_allow_html=True)

    st.markdown(f"""
    <div class='kpi-grid'>
        <div class='kpi'>
            <div class='k-label'>Dépensé</div>
            <div class='k-value'>{total_spend:,.2f}</div>
            <div class='k-foot'>CHF</div>
        </div>
        <div class='kpi'>
            <div class='k-label'>Clics</div>
            <div class='k-value'>{total_clicks:,}</div>
            <div class='k-foot'>sur {total_impressions:,} imp.</div>
        </div>
        <div class='kpi'>
            <div class='k-label'>CTR moyen</div>
            <div class='k-value'>{avg_ctr:.2f}</div>
            <div class='k-foot'>%</div>
        </div>
        <div class='kpi'>
            <div class='k-label'>CPC moyen</div>
            <div class='k-value'>{avg_cpc:.2f}</div>
            <div class='k-foot'>CHF / clic</div>
        </div>
    </div>
    """, unsafe_allow_html=True)

    df_daily = (
        df.groupby("date_start", as_index=False)
        .agg(spend=("spend", "sum"), clicks=("clicks", "sum"), impressions=("impressions", "sum"))
    )
    df_daily["ctr"] = df_daily.apply(lambda r: r["clicks"] / r["impressions"] * 100 if r["impressions"] > 0 else 0, axis=1)
    df_daily["cpc"] = df_daily.apply(lambda r: r["spend"] / r["clicks"] if r["clicks"] > 0 else 0, axis=1)
    df_daily = df_daily.sort_values("date_start")

    st.markdown("<div class='section'><div class='section-head'><span class='section-title'>Évolution quotidienne</span></div></div>", unsafe_allow_html=True)

    metric_map = {"Dépenses (CHF)": "spend", "Clics": "clicks", "CTR (%)": "ctr", "CPC (CHF)": "cpc"}
    sel_metric = st.selectbox("Métrique évolution", list(metric_map.keys()), key="meta_daily_metric", label_visibility="collapsed")
    y_col = metric_map[sel_metric]

    fig = px.area(
        df_daily, x="date_start", y=y_col,
        labels={"date_start": "", y_col: sel_metric},
        color_discrete_sequence=["#3b5bff"],
    )
    fig.update_traces(fill="tozeroy", line=dict(width=2), fillcolor="rgba(59,91,255,0.12)")
    fig.update_layout(
        paper_bgcolor="#ffffff", plot_bgcolor="#ffffff",
        margin=dict(l=0, r=0, t=8, b=0), height=220,
        xaxis=dict(showgrid=False, color="#8b8e98"),
        yaxis=dict(gridcolor="rgba(14,15,18,0.05)", color="#8b8e98"),
        font=dict(family="Inter, sans-serif", color="#5a5d66"),
        showlegend=False,
    )
    st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})

    if "campaign_name" not in df.columns:
        return

    df_camp = (
        df.groupby("campaign_name", as_index=False)
        .agg(
            spend=("spend", "sum"),
            clicks=("clicks", "sum"),
            impressions=("impressions", "sum"),
            effective_status=("effective_status", "last") if "effective_status" in df.columns else ("spend", "count"),
        )
    )
    df_camp["ctr"] = df_camp.apply(lambda r: r["clicks"] / r["impressions"] * 100 if r["impressions"] > 0 else 0, axis=1)
    df_camp["cpc"] = df_camp.apply(lambda r: r["spend"] / r["clicks"] if r["clicks"] > 0 else 0, axis=1)
    df_camp["score"] = df_camp.apply(lambda r: _health_score(r["ctr"], r["cpc"]), axis=1)

    nb_active = int((df_camp.get("effective_status", pd.Series([])) == "ACTIVE").sum()) if "effective_status" in df_camp.columns else nb_campaigns

    st.markdown(f"""
    <div class='section'>
        <div class='section-head'>
            <span class='section-title'>Campagnes</span>
            <span class='st-count'>{nb_active} actives</span>
        </div>
    </div>
    """, unsafe_allow_html=True)

    for _, row in df_camp.iterrows():
        score = int(row["score"])
        bar_color = _bar_color(score)
        status_html = _status_chip(row.get("effective_status", ""))
        ctr_val = row["ctr"]
        cpc_val = row["cpc"]
        spend_val = row["spend"]
        clicks_val = int(row["clicks"])

        st.markdown(f"""
        <div class='card'>
            <div class='camp-row'>
                <span class='camp-name'>{row['campaign_name']}</span>
                <span>{status_html}</span>
            </div>
            <div class='camp-metrics'>
                <div class='camp-metric'>Dépensé&nbsp;<span>{spend_val:,.2f} CHF</span></div>
                <div class='camp-metric'>Clics&nbsp;<span>{clicks_val:,}</span></div>
                <div class='camp-metric'>CTR&nbsp;<span>{ctr_val:.2f}%</span></div>
                <div class='camp-metric'>CPC&nbsp;<span>{cpc_val:.2f} CHF</span></div>
            </div>
            <div style='display:flex;align-items:center;gap:10px;margin-top:10px;'>
                <div class='bar' style='flex:1'><span style='width:{score}%;background:{bar_color}'></span></div>
                <span style='font-size:11px;font-family:var(--font-mono,"JetBrains Mono",monospace);color:{bar_color};font-weight:600;min-width:30px;text-align:right;'>{score}</span>
            </div>
        </div>
        """, unsafe_allow_html=True)

    with st.expander("💡 Insights IA", expanded=False):
        show_insights_panel(
            df_meta=df,
            is_paid=is_paid,
            section="meta_ads",
            use_sidebar=False,
        )
