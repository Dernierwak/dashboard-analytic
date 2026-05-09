import time

import streamlit as st
import requests
import json
import pandas as pd
import plotly.express as px

from scripts.insert_data import upsert_meta_ads
from scripts.fetch_data import fetch_meta_ads, fetch_meta_ads_latest_date
from components.insights_panel import show_insights_panel


@st.fragment
def meta_ads_source_fragment(token, supabase=None, user_id=None):
    # Charger depuis Supabase si données déjà présentes
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

        # Fetch incrémental : depuis la dernière date en Supabase
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
            # 1. Persister dans Supabase
            if supabase and user_id:
                try:
                    upsert_meta_ads(supabase, user_id, rows)
                except Exception as e:
                    st.error(f"❌ Sauvegarde Supabase échouée : {e}")
                    st.stop()

            # 2. Recharger depuis Supabase (historique complet)
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


def show_meta_ads_dashboard(df: pd.DataFrame | None = None):
    """Dashboard Meta Ads — vue budget unifiée."""

    if df is None or (isinstance(df, pd.DataFrame) and df.empty):
        st.info("Connectez votre compte Meta Ads dans 'Mon compte' pour voir les données.")
        return

    # ── Typage ──────────────────────────────────────────────────────────────
    for col in ["impressions", "clicks", "spend", "reach", "link_clicks"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    df["date_start"] = pd.to_datetime(df["date_start"], errors="coerce")

    # ── Nettoyage clés orphelines ────────────────────────────────────────────
    for k in ["mad_perf_metric", "mad_cost_metric", "mad_adsets", "mad_ads"]:
        st.session_state.pop(k, None)

    # ── Filtres ──────────────────────────────────────────────────────────────
    from datetime import date, timedelta
    fc1, fc2, fc3 = st.columns(3)
    df_view = df.copy()

    with fc1:
        period_opts = {"7 jours": 7, "30 jours": 30, "90 jours": 90, "Tout": None}
        sel_period = st.selectbox("Période", list(period_opts.keys()), index=1, key="mad_period")
        days = period_opts[sel_period]
        if days:
            cutoff = pd.Timestamp(date.today() - timedelta(days=days))
            df_view = df_view[df_view["date_start"] >= cutoff]

    with fc2:
        if "effective_status" in df.columns and df["effective_status"].notna().any():
            status_opts = sorted(df["effective_status"].dropna().unique())
            sel_status = st.multiselect("Statut", options=status_opts, key="mad_status")
            if sel_status:
                df_view = df_view[df_view["effective_status"].isin(sel_status)]
        else:
            st.multiselect("Statut", options=[], key="mad_status", disabled=True, placeholder="—")

    with fc3:
        sel_campaigns = st.multiselect("Campagne", options=sorted(df["campaign_name"].dropna().unique()), key="mad_campaigns")
        if sel_campaigns:
            df_view = df_view[df_view["campaign_name"].isin(sel_campaigns)]

    st.session_state["meta_ads_df_view"] = df_view

    if df_view.empty:
        st.warning("Aucune donnée pour ces filtres.")
        return

    # ── Métriques agrégées ───────────────────────────────────────────────────
    total_spend       = df_view["spend"].sum()
    total_clicks      = df_view["clicks"].sum()
    total_impressions = df_view["impressions"].sum()
    avg_ctr  = (total_clicks / total_impressions * 100) if total_impressions > 0 else 0.0
    avg_cpc  = (total_spend / total_clicks)              if total_clicks > 0       else 0.0
    avg_cpm  = (total_spend / total_impressions * 1000)  if total_impressions > 0  else 0.0

    if "effective_status" in df_view.columns and df_view["effective_status"].notna().any():
        nb_active = int(df_view[df_view["effective_status"] == "ACTIVE"]["campaign_name"].nunique())
    else:
        nb_active = int(df_view["campaign_name"].nunique())

    # ── Agrégat quotidien ────────────────────────────────────────────────────
    df_daily = (
        df_view.groupby("date_start", as_index=False)
        .agg(spend=("spend", "sum"), clicks=("clicks", "sum"), impressions=("impressions", "sum"))
    )
    df_daily = df_daily.sort_values("date_start")

    # ── Agrégat par campagne + signal ────────────────────────────────────────
    df_camp = (
        df_view.groupby("campaign_name", as_index=False)
        .agg(spend=("spend", "sum"), clicks=("clicks", "sum"), impressions=("impressions", "sum"))
    )
    df_camp["ctr"] = df_camp.apply(lambda r: r["clicks"] / r["impressions"] * 100 if r["impressions"] > 0 else 0, axis=1)
    df_camp["cpc"] = df_camp.apply(lambda r: r["spend"] / r["clicks"] if r["clicks"] > 0 else 0, axis=1)
    df_camp["cpm"] = df_camp.apply(lambda r: r["spend"] / r["impressions"] * 1000 if r["impressions"] > 0 else 0, axis=1)

    avg_ctr_all = df_camp["ctr"].mean() if not df_camp.empty else 0.0
    _cpc_pos = df_camp[df_camp["cpc"] > 0]["cpc"]
    avg_cpc_all = _cpc_pos.mean() if not _cpc_pos.empty else 0.0

    if len(df_camp) >= 2:
        def _signal(row):
            good_ctr = row["ctr"] >= avg_ctr_all
            good_cpc = (row["cpc"] <= avg_cpc_all) if row["cpc"] > 0 else True
            if good_ctr and good_cpc:   return "✅ Efficace"
            elif good_ctr or good_cpc:  return "⚠️ Correcte"
            else:                       return "🔴 À revoir"
        df_camp["Signal"] = df_camp.apply(_signal, axis=1)
    else:
        df_camp["Signal"] = "—"

    # ── KPI strip ────────────────────────────────────────────────────────────
    if total_spend == 0:
        st.info("Aucune dépense sur cette période.")
        return

    def _kpi(label: str, value: str) -> str:
        return (
            f'<div class="kpi-cell-strip">'
            f'<div class="kpi-label-strip">{label}</div>'
            f'<div class="kpi-value-strip">{value}</div>'
            f'</div>'
        )

    st.markdown(f"""
    <div class="kpi-strip-row">
        {_kpi("Dépenses CHF", f"CHF {total_spend:,.0f}")}
        {_kpi("Campagnes actives", str(nb_active))}
        {_kpi("CTR moyen", f"{avg_ctr:.2f}%")}
        {_kpi("CPC moyen", f"CHF {avg_cpc:.2f}")}
        {_kpi("CPM moyen", f"CHF {avg_cpm:.2f}")}
    </div>
    """, unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)

    # ── Table campagnes ──────────────────────────────────────────────────────
    st.markdown('<div class="section-title">Campagnes</div>', unsafe_allow_html=True)

    df_display = df_camp.rename(columns={
        "campaign_name": "Campagne",
        "spend": "Dépenses CHF",
        "ctr": "CTR %",
        "cpc": "CPC CHF",
        "cpm": "CPM CHF",
        "impressions": "Impressions",
    }).sort_values("Dépenses CHF", ascending=False)

    st.dataframe(
        df_display[["Campagne", "Dépenses CHF", "CTR %", "CPC CHF", "CPM CHF", "Impressions", "Signal"]],
        use_container_width=True,
        hide_index=True,
        column_config={
            "Dépenses CHF": st.column_config.NumberColumn(format="CHF %.2f"),
            "CTR %":        st.column_config.NumberColumn(format="%.2f %%"),
            "CPC CHF":      st.column_config.NumberColumn(format="CHF %.2f"),
            "CPM CHF":      st.column_config.NumberColumn(format="CHF %.2f"),
            "Impressions":  st.column_config.NumberColumn(format="%d"),
            "Signal":       st.column_config.TextColumn("Signal"),
        }
    )

    st.markdown("<br>", unsafe_allow_html=True)

    # ── Charts côte à côte ───────────────────────────────────────────────────
    col_left, col_right = st.columns([1, 1])

    with col_left:
        fig_trend = px.line(
            df_daily, x="date_start", y="spend",
            markers=True,
            labels={"date_start": "", "spend": "CHF"},
            color_discrete_sequence=["#1a56ff"],
            title="Dépenses quotidiennes",
        )
        fig_trend.update_layout(
            margin=dict(l=0, r=0, t=32, b=0), height=260,
            xaxis_title=None, plot_bgcolor="white", paper_bgcolor="white",
        )
        fig_trend.update_xaxes(showgrid=False)
        fig_trend.update_yaxes(gridcolor="#f0f0f0")
        st.plotly_chart(fig_trend, use_container_width=True, config={"displayModeBar": False})

    with col_right:
        if len(df_camp) >= 2:
            color_map = {
                "✅ Efficace": "#1a7a4a",
                "⚠️ Correcte": "#e0a800",
                "🔴 À revoir": "#c0392b",
                "—":           "#999999",
            }
            fig_scatter = px.scatter(
                df_display,
                x="CPC CHF", y="CTR %",
                size="Dépenses CHF", size_max=40,
                text="Campagne",
                color="Signal",
                color_discrete_map=color_map,
                labels={"CPC CHF": "CPC (CHF) →", "CTR %": "CTR (%) ↑"},
                title="Efficacité par campagne",
                hover_data={"Dépenses CHF": ":.2f", "Impressions": True},
            )
            fig_scatter.update_traces(textposition="top center", textfont_size=9)
            if avg_ctr_all > 0:
                fig_scatter.add_hline(y=avg_ctr_all, line_dash="dot", line_color="#c8c8c8", line_width=1)
            if avg_cpc_all > 0:
                fig_scatter.add_vline(x=avg_cpc_all, line_dash="dot", line_color="#c8c8c8", line_width=1)
            fig_scatter.update_layout(
                margin=dict(l=0, r=0, t=32, b=0), height=260,
                plot_bgcolor="white", paper_bgcolor="white", showlegend=False,
            )
            fig_scatter.update_xaxes(gridcolor="#f0f0f0")
            fig_scatter.update_yaxes(gridcolor="#f0f0f0")
            st.plotly_chart(fig_scatter, use_container_width=True, config={"displayModeBar": False})
        else:
            fig_ctr = px.bar(
                df_display.sort_values("CTR %"),
                x="CTR %", y="Campagne", orientation="h",
                labels={"CTR %": "CTR (%)", "Campagne": ""},
                color_discrete_sequence=["#1a56ff"],
                title="CTR par campagne",
            )
            fig_ctr.update_layout(
                margin=dict(l=0, r=0, t=32, b=0), height=260,
                plot_bgcolor="white", paper_bgcolor="white", showlegend=False,
            )
            fig_ctr.update_xaxes(gridcolor="#f0f0f0")
            fig_ctr.update_yaxes(showgrid=False)
            st.plotly_chart(fig_ctr, use_container_width=True, config={"displayModeBar": False})


def show_meta_ads_tab(is_paid: bool = False):
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

    show_meta_ads_dashboard(df)
