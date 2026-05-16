import time

import streamlit as st
import requests
import json
import pandas as pd
import plotly.graph_objects as go

from scripts.insert_data import upsert_meta_ads
from scripts.fetch_data import fetch_meta_ads, fetch_meta_ads_latest_date
from components.insights_panel import show_insights_panel


# ── Pulse CSS ──────────────────────────────────────────────────────────────────
PULSE_CSS = """<style>
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&family=Inter:wght@400;500;600&display=swap');
:root {
    --brand:#3b5bff;--good:#1a7a4a;--good-soft:#e7f3ec;
    --bad:#c0392b;--bad-soft:#fbe9e6;--warn:#b86b00;--warn-soft:#fbf1de;
    --ink:#0e0f12;--ink-3:#5a5d66;--ink-4:#8b8e98;
    --line:rgba(14,15,18,0.08);
    --font-mono:"JetBrains Mono",ui-monospace,monospace;
    --font-display:"Instrument Serif",Georgia,serif;
}
.page-h { padding:28px 0 24px; }
.h-eyebrow {
    font-size:11.5px;font-weight:600;text-transform:uppercase;
    letter-spacing:0.08em;color:#8b8e98;margin-bottom:10px;
    font-family:var(--font-mono);
}
.page-h h1 {
    font-family:var(--font-display) !important;
    font-size:2rem !important;font-weight:400 !important;
    color:#0e0f12 !important;line-height:1.2 !important;
    margin:0 0 10px !important;
}
.h-sub { font-size:13.5px;color:#5a5d66;line-height:1.6;margin:0;max-width:560px; }

/* ── Seg: st.radio horizontal → pill buttons ── */
div[data-testid="stRadio"] > label { display:none; }
div[data-testid="stRadio"] > div[role="radiogroup"] {
    background:rgba(14,15,18,0.06);border-radius:8px;
    padding:3px;gap:2px;display:inline-flex;flex-direction:row;
    flex-wrap:nowrap;
}
div[data-testid="stRadio"] [data-baseweb="radio"] {
    background:transparent;border-radius:6px;padding:5px 14px;
    margin:0;
}
div[data-testid="stRadio"] [data-baseweb="radio"] > div:first-child { display:none; }
div[data-testid="stRadio"] [data-baseweb="radio"] label {
    font-size:12.5px;font-weight:500;color:#5a5d66;
    cursor:pointer;padding:0;line-height:1;
}
div[data-testid="stRadio"] [aria-checked="true"][data-baseweb="radio"] {
    background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.1);
}
div[data-testid="stRadio"] [aria-checked="true"][data-baseweb="radio"] label {
    color:#0e0f12;font-weight:600;
}

/* ── KPI grid ── */
.kpi-grid {
    display:grid;grid-template-columns:repeat(4,1fr);
    gap:12px;margin-bottom:28px;
}
.kpi-p {
    background:#fff;border:1px solid rgba(14,15,18,0.08);
    border-radius:14px;padding:16px 20px;
}
.kpi-p .kp-lbl {
    font-size:11px;font-weight:600;text-transform:uppercase;
    letter-spacing:0.06em;color:#8b8e98;margin-bottom:8px;
}
.kpi-p .kp-val {
    font-family:var(--font-mono);font-size:1.7rem;
    font-weight:500;color:#0e0f12;line-height:1;letter-spacing:-0.02em;
}
.kpi-p .kp-unit { font-size:1rem;color:#8b8e98;margin-left:3px; }
.kpi-p .kp-delta { margin-top:8px;font-size:11.5px;font-weight:500; }
.kp-good { color:#1a7a4a; } .kp-bad { color:#c0392b; } .kp-neu { color:#8b8e98; }

/* ── Sections ── */
.section { margin-bottom:32px; }
.section-head {
    display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;
}
.section-title {
    font-size:14px;font-weight:600;color:#0e0f12;
    display:flex;align-items:center;gap:8px;
}
.st-count { font-size:11.5px;color:#8b8e98;font-weight:400; }

/* ── Card ── */
.card { background:#fff;border:1px solid rgba(14,15,18,0.08);border-radius:14px;padding:20px; }

/* ── Chips ── */
.chip {
    display:inline-flex;align-items:center;gap:4px;
    padding:3px 9px;border-radius:999px;
    font-size:11.5px;font-weight:500;
    background:rgba(14,15,18,0.06);color:#0e0f12;white-space:nowrap;
}
.chip.good { background:#e7f3ec;color:#1a7a4a; }
.chip.bad  { background:#fbe9e6;color:#c0392b; }
.chip.warn { background:#fbf1de;color:#b86b00; }
.chip.outline { background:transparent;border:1px solid rgba(14,15,18,0.12);color:#5a5d66; }
.chip.tiny { font-size:10px;padding:2px 7px; }

/* ── Health bar ── */
.bar { width:100%;height:3px;background:rgba(14,15,18,0.08);border-radius:99px;overflow:hidden; }
.bar span { display:block;height:100%;border-radius:99px; }

/* ── Campaign rows ── */
.camp-row {
    background:#fff;border:1px solid rgba(14,15,18,0.08);border-radius:14px;
    padding:14px 18px;margin-bottom:8px;
    display:grid;
    grid-template-columns:minmax(0,2fr) auto repeat(4,88px) 72px;
    gap:16px;align-items:center;
}
.camp-row.paused { opacity:0.62; }
.cell-lbl {
    font-size:10px;text-transform:uppercase;letter-spacing:0.06em;
    color:#8b8e98;font-weight:600;margin-bottom:4px;
}
.cell-val { font-family:var(--font-mono);font-size:13px;font-weight:500;color:#0e0f12; }
.cell-r { text-align:right; }

/* ── Coût tab ── */
.cout-section-title {
    font-size:13px;font-weight:600;color:#0e0f12;margin-bottom:12px;margin-top:24px;
}
.cout-bar-wrap {
    width:100%;height:6px;background:rgba(14,15,18,0.08);
    border-radius:99px;overflow:hidden;margin-top:6px;
}
.cout-bar-fill { display:block;height:100%;border-radius:99px;transition:width 0.3s; }
.cout-ok   { color:#1a7a4a;font-size:11.5px;font-weight:600; }
.cout-over { color:#c0392b;font-size:11.5px;font-weight:600; }
.cout-low  { color:#b86b00;font-size:11.5px;font-weight:600; }
</style>"""


# ── Helpers ───────────────────────────────────────────────────────────────────

def _status_chip(status: str) -> str:
    s = (status or "").upper()
    if s == "ACTIVE":
        return '<span class="chip good">● Active</span>'
    if "PAUSED" in s:
        return '<span class="chip outline">⏸ En pause</span>'
    return '<span class="chip bad">▲ Alerte</span>'


def _camp_note(row, avg_ctr: float, avg_cpc: float) -> tuple[str, str]:
    cpc, ctr = row["cpc"], row["ctr"]
    if avg_cpc > 0 and cpc > avg_cpc * 3 and cpc > 5:
        return "À couper — CPC anormalement élevé", "#c0392b"
    if avg_ctr > 0 and ctr >= avg_ctr * 1.5:
        return "Augmente le budget — meilleure perf.", "#1a7a4a"
    if avg_ctr > 0 and ctr < avg_ctr * 0.5 and ctr > 0:
        return "Revoir le ciblage ou la créa", "#b86b00"
    if cpc == 0 and ctr == 0:
        return "En pause — aucune donnée sur la période", "#8b8e98"
    return "Performances correctes", "#8b8e98"


def _sparkline_svg(data: list[float], color: str = "#3b5bff", w: int = 56, h: int = 22) -> str:
    """Tiny SVG sparkline (path + fill) matching the Pulse KPI design."""
    if not data or len(data) < 2:
        return ""
    mn, mx = min(data), max(data)
    rng = mx - mn or 1
    pts = [(i / (len(data) - 1)) * w for i in range(len(data))]
    ypts = [h - ((v - mn) / rng) * (h - 2) - 1 for v in data]
    coords = " ".join(f"{x:.1f},{y:.1f}" for x, y in zip(pts, ypts))
    path = "M " + " L ".join(f"{x:.1f},{y:.1f}" for x, y in zip(pts, ypts))
    fill = path + f" L{w},{h} L0,{h} Z"
    return (
        f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" style="display:block">'
        f'<path d="{fill}" fill="{color}" opacity="0.15"/>'
        f'<path d="{path}" fill="none" stroke="{color}" stroke-width="1.4" '
        f'stroke-linecap="round" stroke-linejoin="round"/>'
        f'</svg>'
    )


def _health(row, avg_ctr: float, avg_cpc: float) -> tuple[int | None, str]:
    scores = []
    if row["impressions"] > 0 and avg_ctr > 0:
        scores.append(min(100, row["ctr"] / avg_ctr * 60))
    if row["clicks"] > 0 and avg_cpc > 0:
        scores.append(max(0, 100 - (row["cpc"] / avg_cpc - 1) * 50))
    if not scores:
        return None, "#8b8e98"
    score = int(sum(scores) / len(scores))
    color = "#1a7a4a" if score >= 70 else "#b86b00" if score >= 40 else "#c0392b"
    return score, color


def _kpi(label: str, value: str, unit: str = "", delta: float | None = None,
         invert: bool = False, spark: list[float] | None = None,
         spark_color: str = "#3b5bff") -> str:
    delta_html = ""
    if delta is not None and delta != 0:
        good = (delta > 0) if not invert else (delta < 0)
        cls = "kp-good" if good else "kp-bad"
        sign = "+" if delta > 0 else ""
        delta_html = f'<div class="kp-delta {cls}">{sign}{delta:.1f}% vs période préc.</div>'
    spark_html = ""
    if spark:
        svg = _sparkline_svg(spark, color=spark_color)
        spark_html = f'<div class="kp-spark">{svg}</div>'
    return (
        f'<div class="kpi-p">'
        f'{spark_html}'
        f'<div class="kp-lbl">{label}</div>'
        f'<div class="kp-val">{value}<span class="kp-unit">{unit}</span></div>'
        f'{delta_html}'
        f'</div>'
    )


def _cell(label: str, value: str) -> str:
    return (
        f'<div class="cell-r">'
        f'<div class="cell-lbl">{label}</div>'
        f'<div class="cell-val">{value}</div>'
        f'</div>'
    )


# ── Data fetch fragment ────────────────────────────────────────────────────────

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
            st.markdown(
                f"<div class='account-name'>{acc['name']}</div>"
                f"<div class='account-meta'>{nb_campaigns} campagne(s)</div>",
                unsafe_allow_html=True,
            )
    else:
        st.markdown(
            "<div style='color:#6b6b6b;padding:12px 0'>Aucun compte publicitaire trouvé.</div>",
            unsafe_allow_html=True,
        )

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
        params = {
            "access_token": token,
            "level": "ad",
            # effective_status n'est pas un champ Insights — on le fetch via /campaigns séparément
            "fields": "campaign_name,adset_name,ad_name,impressions,clicks,reach,spend,actions,date_start",
            "time_increment": 1,
            "time_range": json.dumps(time_range),
        }
        progress_bar.progress(20, text="Compte trouvé, récupération des données...")
        result = requests.get(url=url, params=params).json()
        if "error" in result:
            st.error(f"Erreur API Meta : {result['error'].get('message', 'inconnue')}")
            progress_bar.empty()
            return
        rows = result.get("data", [])
        progress_bar.progress(50, text=f"Chargement des données... ({len(rows)} lignes)")
        next_url = result.get("paging", {}).get("next")
        while next_url:
            page = requests.get(next_url).json()
            rows += page.get("data", [])
            next_url = page.get("paging", {}).get("next")
            progress_bar.progress(min(75, 50 + len(rows) // 100), text=f"Chargement... ({len(rows)} lignes)")

        # Fetch statuts depuis /campaigns (effective_status non supporté par /insights)
        progress_bar.progress(80, text="Récupération des statuts de campagnes...")
        camp_url = f"https://graph.facebook.com/v24.0/{ad_account_id}/campaigns"
        camp_resp = requests.get(camp_url, params={
            "access_token": token,
            "fields": "name,effective_status",
            "limit": 200,
        }).json()
        status_map = {c["name"]: c.get("effective_status", "UNKNOWN") for c in camp_resp.get("data", [])}

        for row in rows:
            link_click_item = next(
                (item for item in row.get("actions", []) if item.get("action_type") == "link_click"),
                None,
            )
            row["link_clicks"] = int(link_click_item.get("value", 0)) if link_click_item else 0
            row["effective_status"] = status_map.get(row.get("campaign_name", ""), "UNKNOWN")
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


# ── Dashboard ─────────────────────────────────────────────────────────────────

def show_meta_ads_dashboard(df: pd.DataFrame | None = None):
    if df is None or (isinstance(df, pd.DataFrame) and df.empty):
        st.info("Connectez votre compte Meta Ads dans 'Mon compte' pour voir les données.")
        return

    # ── Typage ──────────────────────────────────────────────────────────────
    for col in ["impressions", "clicks", "spend", "reach", "link_clicks"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    df["date_start"] = pd.to_datetime(df["date_start"], errors="coerce")

    # ── Période selector (.seg) ──────────────────────────────────────────────
    from datetime import date, timedelta
    period_opts = {"24h": 1, "7j": 7, "30j": 30, "90j": 90}
    col_period, col_status, col_camp = st.columns([2, 2, 3])
    with col_period:
        sel_period = st.radio(
            "Période", list(period_opts.keys()),
            index=1, horizontal=True, key="mad_period",
        )
    days = period_opts[sel_period]
    cutoff = pd.Timestamp(date.today() - timedelta(days=days))
    df_view = df[df["date_start"] >= cutoff].copy()

    with col_status:
        if "effective_status" in df.columns and df["effective_status"].notna().any():
            status_opts = sorted(df["effective_status"].dropna().unique())
            sel_status = st.multiselect(
                "Statut", options=status_opts, key="mad_status",
                placeholder="Tous les statuts",
            )
            if sel_status:
                df_view = df_view[df_view["effective_status"].isin(sel_status)]

    with col_camp:
        sel_campaigns = st.multiselect(
            "Campagne", options=sorted(df["campaign_name"].dropna().unique()),
            key="mad_campaigns", placeholder="Toutes les campagnes",
        )
        if sel_campaigns:
            df_view = df_view[df_view["campaign_name"].isin(sel_campaigns)]

    if df_view.empty:
        st.warning("Aucune donnée pour ces filtres.")
        return

    # ── Agrégats globaux ─────────────────────────────────────────────────────
    total_spend       = df_view["spend"].sum()
    total_clicks      = int(df_view["clicks"].sum())
    total_impressions = int(df_view["impressions"].sum())
    avg_ctr  = (total_clicks / total_impressions * 100) if total_impressions > 0 else 0.0
    avg_cpc  = (total_spend / total_clicks) if total_clicks > 0 else 0.0

    if total_spend == 0:
        st.info("Aucune dépense sur cette période.")
        return

    nb_active = 0
    if "effective_status" in df_view.columns:
        nb_active = int(df_view[df_view["effective_status"] == "ACTIVE"]["campaign_name"].nunique())
    nb_paused = int(df_view["campaign_name"].nunique()) - nb_active

    # ── Agrégat quotidien (avant KPI grid pour sparklines) ───────────────────
    df_daily = (
        df_view.groupby("date_start", as_index=False)
        .agg(spend=("spend","sum"), clicks=("clicks","sum"), impressions=("impressions","sum"))
    ).sort_values("date_start")
    df_daily["ctr"] = df_daily.apply(
        lambda r: r["clicks"] / r["impressions"] * 100 if r["impressions"] > 0 else 0, axis=1)
    df_daily["cpc"] = df_daily.apply(
        lambda r: r["spend"] / r["clicks"] if r["clicks"] > 0 else 0, axis=1)

    spark_spend  = df_daily["spend"].tail(7).tolist()
    spark_clicks = df_daily["clicks"].tail(7).tolist()
    spark_ctr    = df_daily["ctr"].tail(7).tolist()
    spark_cpc    = df_daily["cpc"].tail(7).tolist()

    # ── Hero ────────────────────────────────────────────────────────────────
    st.markdown(
        f'<div class="page-h">'
        f'<div class="h-eyebrow">Meta Ads · {sel_period} derniers jours</div>'
        f'<h1>{nb_active} campagne{"s" if nb_active != 1 else ""} en cours, {total_spend:,.0f} CHF dépensés.</h1>'
        f'<p class="h-sub">'
        f'CTR moyen <b>{avg_ctr:.2f} %</b> · CPC moyen <b>{avg_cpc:.2f} CHF</b>. '
        f'{nb_paused} campagne{"s" if nb_paused != 1 else ""} en pause sur la période.'
        f'</p>'
        f'</div>',
        unsafe_allow_html=True,
    )

    # ── KPI grid ────────────────────────────────────────────────────────────
    st.markdown(
        f'<div class="kpi-grid">'
        f'{_kpi("Dépensé", f"{total_spend:,.0f}", "CHF", spark=spark_spend)}'
        f'{_kpi("Clics", f"{total_clicks:,}", spark=spark_clicks, spark_color="#0e0f12")}'
        f'{_kpi("CTR moyen", f"{avg_ctr:.2f}", "%", spark=spark_ctr, spark_color="#1a7a4a")}'
        f'{_kpi("CPC moyen", f"{avg_cpc:.2f}", "CHF", invert=True, spark=spark_cpc, spark_color="#c0392b")}'
        f'</div>',
        unsafe_allow_html=True,
    )

    # ── Chart section ────────────────────────────────────────────────────────
    metric_map = {
        "Dépenses (CHF)": ("spend", "CHF"),
        "Clics":          ("clicks", ""),
        "CTR (%)":        ("ctr", "%"),
        "CPC (CHF)":      ("cpc", "CHF"),
    }
    col_title, col_metric = st.columns([3, 2])
    with col_title:
        st.markdown('<div class="section-title">Évolution quotidienne</div>', unsafe_allow_html=True)
    with col_metric:
        sel_metric_label = st.radio(
            "Métrique", list(metric_map.keys()),
            horizontal=True, key="mad_metric",
        )

    metric_col, metric_unit = metric_map[sel_metric_label]
    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=df_daily["date_start"], y=df_daily[metric_col],
        mode="lines+markers",
        line=dict(color="#3b5bff", width=2),
        marker=dict(size=4, color="#fff", line=dict(color="#3b5bff", width=2)),
        fill="tozeroy",
        fillcolor="rgba(59,91,255,0.07)",
        hovertemplate=f"%{{x|%d %b}}<br>%{{y:.2f}} {metric_unit}<extra></extra>",
    ))
    fig.update_layout(
        template="plotly_white", height=240,
        margin=dict(l=0, r=0, t=10, b=0),
        paper_bgcolor="#ffffff", plot_bgcolor="#ffffff",
        font=dict(color="#666", family="Inter, sans-serif"),
        xaxis=dict(showgrid=False, color="#999", linecolor="rgba(0,0,0,0.07)"),
        yaxis=dict(showgrid=True, gridcolor="#f4f3f1", color="#999"),
        showlegend=False,
    )
    st.markdown('<div class="card" style="padding:16px 20px 8px;">', unsafe_allow_html=True)
    st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
    st.markdown('</div>', unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)

    # ── Agrégat par campagne ─────────────────────────────────────────────────
    df_camp = (
        df_view.groupby("campaign_name", as_index=False)
        .agg(spend=("spend","sum"), clicks=("clicks","sum"), impressions=("impressions","sum"))
    )
    df_camp["ctr"] = df_camp.apply(
        lambda r: r["clicks"] / r["impressions"] * 100 if r["impressions"] > 0 else 0, axis=1)
    df_camp["cpc"] = df_camp.apply(
        lambda r: r["spend"] / r["clicks"] if r["clicks"] > 0 else 0, axis=1)

    _cpc_pos = df_camp[df_camp["cpc"] > 0]["cpc"]
    avg_ctr_all = df_camp["ctr"].mean() if not df_camp.empty else 0.0
    avg_cpc_all = _cpc_pos.mean() if not _cpc_pos.empty else 0.0

    # Récupérer statut le plus fréquent par campagne
    camp_status = {}
    if "effective_status" in df_view.columns:
        for camp, grp in df_view.groupby("campaign_name"):
            mode = grp["effective_status"].mode()
            camp_status[camp] = mode.iloc[0] if not mode.empty else ""

    # Trier : actives d'abord, puis par dépenses décroissantes
    def _sort_key(r):
        status = camp_status.get(r["campaign_name"], "")
        return (0 if status == "ACTIVE" else 1, -r["spend"])
    df_camp_sorted = df_camp.copy()
    df_camp_sorted["_sort"] = df_camp_sorted.apply(_sort_key, axis=1)
    df_camp_sorted = df_camp_sorted.sort_values("_sort").drop(columns=["_sort"])

    nb_active_camp = sum(1 for c in df_camp_sorted["campaign_name"] if camp_status.get(c, "") == "ACTIVE")
    nb_paused_camp = len(df_camp_sorted) - nb_active_camp

    st.markdown(
        f'<div class="section-head">'
        f'<div class="section-title">Campagnes '
        f'<span class="st-count">{nb_active_camp} actives · {nb_paused_camp} en pause</span>'
        f'</div></div>',
        unsafe_allow_html=True,
    )

    rows_html = ""
    for _, row in df_camp_sorted.iterrows():
        status = camp_status.get(row["campaign_name"], "")
        note_text, note_color = _camp_note(row, avg_ctr_all, avg_cpc_all)
        score, health_color = _health(row, avg_ctr_all, avg_cpc_all)
        is_paused = "PAUSED" in status.upper()

        health_html = (
            f'<div style="font-family:var(--font-mono);font-size:13px;font-weight:500;color:{health_color};">{score}/100</div>'
            f'<div class="bar" style="margin-top:3px;"><span style="width:{score}%;background:{health_color};"></span></div>'
            if score is not None else '<div style="font-size:11.5px;color:#8b8e98;">—</div>'
        )

        rows_html += f"""
        <div class="camp-row{'  paused' if is_paused else ''}">
          <div>
            <div style="font-size:13.5px;font-weight:600;margin-bottom:4px;">{row['campaign_name']}</div>
            <div style="display:flex;gap:8px;align-items:center;">
              <span style="font-size:11.5px;color:{note_color};">{note_text}</span>
            </div>
          </div>
          <div>{_status_chip(status)}</div>
          {_cell("Dépensé", f"{row['spend']:,.0f} CHF" if row['spend'] > 0 else "—")}
          {_cell("Clics", f"{int(row['clicks']):,}" if row['clicks'] > 0 else "—")}
          {_cell("CTR", f"{row['ctr']:.2f} %" if row['ctr'] > 0 else "—")}
          {_cell("CPC", f"{row['cpc']:.2f} CHF" if row['cpc'] > 0 else "—")}
          <div class="cell-r">
            <div class="cell-lbl">Santé</div>
            {health_html}
          </div>
        </div>"""

    st.markdown(rows_html, unsafe_allow_html=True)


# ── Coût tab ──────────────────────────────────────────────────────────────────

def _show_cout_tab(df: pd.DataFrame | None) -> None:
    if df is None or (isinstance(df, pd.DataFrame) and df.empty):
        st.info("Aucune donnée disponible. Récupère tes données Meta Ads d'abord.")
        return

    from datetime import date, timedelta

    df = df.copy()
    for col in ["impressions", "clicks", "spend", "reach", "link_clicks"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    df["date_start"] = pd.to_datetime(df["date_start"], errors="coerce")

    period_opts = {"7j": 7, "30j": 30, "90j": 90}
    sel_period = st.radio("Période", list(period_opts.keys()), index=1, horizontal=True, key="cout_period")
    days = period_opts[sel_period]
    cutoff = pd.Timestamp(date.today() - timedelta(days=days))
    df_v = df[df["date_start"] >= cutoff].copy()

    if df_v.empty:
        st.warning("Aucune donnée pour cette période.")
        return

    total_spend       = df_v["spend"].sum()
    total_impressions = int(df_v["impressions"].sum())
    total_clicks      = int(df_v["clicks"].sum())
    total_link_clicks = int(df_v["link_clicks"].sum()) if "link_clicks" in df_v.columns else 0
    reach             = int(df_v["reach"].sum()) if "reach" in df_v.columns else 0

    days_elapsed = max(1, (df_v["date_start"].max() - df_v["date_start"].min()).days + 1)
    proj_30  = (total_spend / days_elapsed) * 30
    avg_cpm  = (total_spend / total_impressions * 1000) if total_impressions > 0 else 0.0
    avg_cpc  = (total_spend / total_clicks) if total_clicks > 0 else 0.0
    freq     = total_impressions / reach if reach > 0 else 0.0
    cpv      = (total_spend / total_link_clicks) if total_link_clicks > 0 else None

    # ── Bloc 1 : KPI globaux ──────────────────────────────────────────────────
    st.markdown('<div class="cout-section-title">Vue globale des dépenses</div>', unsafe_allow_html=True)
    c1, c2, c3, c4 = st.columns(4)
    kpis = [
        (c1, "Total dépensé", f"{total_spend:,.0f}", "CHF"),
        (c2, "Projeté 30j",   f"{proj_30:,.0f}",    "CHF"),
        (c3, "CPM moyen",     f"{avg_cpm:.2f}",      "CHF"),
        (c4, "CPC moyen",     f"{avg_cpc:.2f}",      "CHF"),
    ]
    for col, lbl, val, unit in kpis:
        with col:
            st.markdown(
                f'<div class="kpi-p"><div class="kp-lbl">{lbl}</div>'
                f'<div class="kp-val">{val}<span class="kp-unit"> {unit}</span></div></div>',
                unsafe_allow_html=True,
            )

    # ── Bloc 2 : Budget global ────────────────────────────────────────────────
    st.markdown("<br>", unsafe_allow_html=True)
    budget_global = st.number_input(
        "Budget global (CHF)", min_value=0.0, step=100.0,
        key="budget_global", format="%.0f",
        help="Saisis ton budget pour voir le taux de consommation",
    )
    if budget_global > 0:
        pct = min(total_spend / budget_global, 1.0)
        bar_color = "#c0392b" if pct >= 1.0 else "#3b5bff"
        st.markdown(
            f'<div style="font-size:12px;color:#5a5d66;margin-bottom:4px;">'
            f'{total_spend:,.0f} / {budget_global:,.0f} CHF — <b>{pct*100:.0f}%</b> consommé</div>'
            f'<div class="cout-bar-wrap"><span class="cout-bar-fill" style="width:{pct*100:.1f}%;background:{bar_color};"></span></div>',
            unsafe_allow_html=True,
        )

    # ── Bloc 3 : Pacing par campagne ──────────────────────────────────────────
    st.markdown('<div class="cout-section-title">Pacing par campagne</div>', unsafe_allow_html=True)
    df_camp = (
        df_v.groupby("campaign_name", as_index=False)
        .agg(spend=("spend", "sum"))
        .sort_values("spend", ascending=False)
    )

    hcols = st.columns([3, 2, 2, 3])
    for col_h, lbl in zip(hcols, ["Campagne", "Dépensé", "Budget max (CHF)", "Pacing"]):
        col_h.markdown(
            f'<div style="font-size:10px;font-weight:600;text-transform:uppercase;'
            f'letter-spacing:0.06em;color:#8b8e98;padding-bottom:6px;">{lbl}</div>',
            unsafe_allow_html=True,
        )

    for _, row in df_camp.iterrows():
        camp_name = row["campaign_name"]
        safe_key  = camp_name.replace(" ", "_")[:40]
        spend     = row["spend"]
        c_name, c_spend, c_bud, c_pacing = st.columns([3, 2, 2, 3])

        with c_name:
            st.markdown(
                f'<div style="font-size:13px;font-weight:500;color:#0e0f12;padding-top:6px;">{camp_name}</div>',
                unsafe_allow_html=True,
            )
        with c_spend:
            st.markdown(
                f'<div style="font-size:13px;font-family:var(--font-mono);padding-top:6px;">{spend:,.0f} CHF</div>',
                unsafe_allow_html=True,
            )
        with c_bud:
            bud_max = st.number_input(
                "Budget max", min_value=0.0, step=100.0, format="%.0f",
                key=f"bud_{safe_key}", label_visibility="collapsed",
            )
        with c_pacing:
            if bud_max > 0:
                pct_c = spend / bud_max
                bar_color = "#c0392b" if pct_c > 1 else "#1a7a4a" if pct_c >= 0.7 else "#b86b00"
                status_cls = "cout-over" if pct_c > 1 else "cout-ok" if pct_c >= 0.7 else "cout-low"
                status_txt = "⚠ Dépassé" if pct_c > 1 else "✓ OK" if pct_c >= 0.7 else "↓ Sous-dépense"
                st.markdown(
                    f'<div style="font-size:12px;color:#5a5d66;margin-top:6px;">'
                    f'<span class="{status_cls}">{status_txt}</span> — {pct_c*100:.0f}%</div>'
                    f'<div class="cout-bar-wrap"><span class="cout-bar-fill" '
                    f'style="width:{min(pct_c,1)*100:.1f}%;background:{bar_color};"></span></div>',
                    unsafe_allow_html=True,
                )
            else:
                st.markdown(
                    '<div style="font-size:11.5px;color:#8b8e98;padding-top:6px;">— saisis un budget max</div>',
                    unsafe_allow_html=True,
                )

    # ── Bloc 4 : Métriques de coût ────────────────────────────────────────────
    st.markdown('<div class="cout-section-title">Métriques de coût</div>', unsafe_allow_html=True)
    cost_cols = st.columns(4)
    metrics = [
        ("CPM",        f"{avg_cpm:.2f}",            "CHF", "Coût pour 1 000 impressions"),
        ("CPC",        f"{avg_cpc:.2f}",             "CHF", "Coût par clic"),
        ("Fréquence",  f"{freq:.2f}",                "x",   "Impressions / portée unique"),
        ("CPV",        f"{cpv:.2f}" if cpv else "—", "CHF" if cpv else "", "Coût par clic sur le lien"),
    ]
    for col, (lbl, val, unit, tip) in zip(cost_cols, metrics):
        with col:
            st.markdown(
                f'<div class="kpi-p"><div class="kp-lbl" title="{tip}">{lbl}</div>'
                f'<div class="kp-val">{val}<span class="kp-unit"> {unit}</span></div></div>',
                unsafe_allow_html=True,
            )


# ── Tab entry point ───────────────────────────────────────────────────────────

def show_meta_ads_tab(is_paid: bool = False):
    st.markdown(PULSE_CSS, unsafe_allow_html=True)
    df = st.session_state.get("meta_ads_df")

    _, col_insights_btn = st.columns([5, 1])
    with col_insights_btn:
        with st.popover("💡 Insights", use_container_width=True):
            show_insights_panel(
                df_meta=df,
                is_paid=is_paid,
                section="meta_ads",
                use_sidebar=False,
            )

    tab_perf, tab_cout = st.tabs(["Performance", "Coût"])
    with tab_perf:
        show_meta_ads_dashboard(df)
    with tab_cout:
        _show_cout_tab(df)
