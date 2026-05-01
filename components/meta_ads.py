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
    """Dashboard complet Meta Ads — 2 tabs : Performance | Coûts."""

    if df is None or (isinstance(df, pd.DataFrame) and df.empty):
        st.info("Connectez votre compte Meta Ads dans 'Mon compte' pour voir les données.")
        return

    # ── Typage ──────────────────────────────────────────────────────────────
    for col in ["impressions", "clicks", "spend", "reach", "link_clicks"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    df["date_start"] = pd.to_datetime(df["date_start"], errors="coerce")

    # ── Filtres partagés (cascade) ───────────────────────────────────────────
    fc1, fc2, fc3, fc4 = st.columns(4)
    df_view = df.copy()

    with fc1:
        if "effective_status" in df.columns and df["effective_status"].notna().any():
            status_opts = sorted(df["effective_status"].dropna().unique())
            sel_status = st.multiselect("Statut", options=status_opts, key="mad_status")
            if sel_status:
                df_view = df_view[df_view["effective_status"].isin(sel_status)]
        else:
            st.multiselect("Statut", options=[], key="mad_status", disabled=True, placeholder="—")
    with fc2:
        sel_campaigns = st.multiselect("Campagne", options=sorted(df["campaign_name"].dropna().unique()), key="mad_campaigns")
        if sel_campaigns:
            df_view = df_view[df_view["campaign_name"].isin(sel_campaigns)]
    with fc3:
        sel_adsets = st.multiselect("Ad Set", options=sorted(df_view["adset_name"].dropna().unique()), key="mad_adsets")
        if sel_adsets:
            df_view = df_view[df_view["adset_name"].isin(sel_adsets)]
    with fc4:
        sel_ads = st.multiselect("Publicité", options=sorted(df_view["ad_name"].dropna().unique()), key="mad_ads")
        if sel_ads:
            df_view = df_view[df_view["ad_name"].isin(sel_ads)]

    st.session_state["meta_ads_df_view"] = df_view

    if df_view.empty:
        st.warning("Aucune donnée pour ces filtres.")
        return

    # ── Métriques agrégées ───────────────────────────────────────────────────
    total_spend       = df_view["spend"].sum()
    total_clicks      = df_view["clicks"].sum()
    total_impressions = df_view["impressions"].sum()
    total_reach       = df_view["reach"].sum() if "reach" in df_view.columns else 0
    avg_ctr  = (total_clicks / total_impressions * 100) if total_impressions > 0 else 0.0
    avg_cpc  = (total_spend / total_clicks)              if total_clicks > 0       else 0.0
    avg_cpm  = (total_spend / total_impressions * 1000)  if total_impressions > 0  else 0.0

    # ── Agrégat quotidien (partagé par les 2 tabs) ───────────────────────────
    df_daily = (
        df_view.groupby("date_start", as_index=False)
        .agg(spend=("spend", "sum"), clicks=("clicks", "sum"), impressions=("impressions", "sum"))
    )
    df_daily["ctr"] = df_daily.apply(lambda r: r["clicks"] / r["impressions"] * 100 if r["impressions"] > 0 else 0, axis=1)
    df_daily["cpc"] = df_daily.apply(lambda r: r["spend"] / r["clicks"] if r["clicks"] > 0 else 0, axis=1)
    df_daily["cpm"] = df_daily.apply(lambda r: r["spend"] / r["impressions"] * 1000 if r["impressions"] > 0 else 0, axis=1)
    df_daily = df_daily.sort_values("date_start")

    # ── Agrégat par campagne ─────────────────────────────────────────────────
    df_camp = (
        df_view.groupby("campaign_name", as_index=False)
        .agg(spend=("spend", "sum"), clicks=("clicks", "sum"), impressions=("impressions", "sum"))
    )
    df_camp["ctr"] = df_camp.apply(lambda r: r["clicks"] / r["impressions"] * 100 if r["impressions"] > 0 else 0, axis=1)
    df_camp["cpc"] = df_camp.apply(lambda r: r["spend"] / r["clicks"] if r["clicks"] > 0 else 0, axis=1)
    df_camp["cpm"] = df_camp.apply(lambda r: r["spend"] / r["impressions"] * 1000 if r["impressions"] > 0 else 0, axis=1)

    # ── Tableau par publicité (partagé) ──────────────────────────────────────
    available_cols = [c for c in ["campaign_name", "adset_name", "ad_name", "impressions", "clicks", "reach", "link_clicks", "spend"] if c in df_view.columns]
    df_table = df_view[available_cols].copy()
    df_table = df_table.rename(columns={
        "campaign_name": "Campagne", "adset_name": "Ensemble", "ad_name": "Publicité",
        "impressions": "Impressions", "clicks": "Clics", "reach": "Reach",
        "link_clicks": "Clics lien", "spend": "Dépenses (CHF)",
    })
    df_by_ad = df_table.groupby("Publicité", as_index=False).agg({
        "Campagne": "first", "Ensemble": "first",
        "Impressions": "sum", "Clics": "sum", "Reach": "sum",
        "Clics lien": "sum", "Dépenses (CHF)": "sum",
    })
    df_by_ad["CTR (%)"] = df_by_ad.apply(lambda r: round(r["Clics"] / r["Impressions"] * 100, 2) if r["Impressions"] > 0 else 0.0, axis=1)
    df_by_ad["CPC (CHF)"] = df_by_ad.apply(lambda r: round(r["Dépenses (CHF)"] / r["Clics"], 2) if r["Clics"] > 0 else 0.0, axis=1)
    df_by_ad["CPM (CHF)"] = df_by_ad.apply(lambda r: round(r["Dépenses (CHF)"] / r["Impressions"] * 1000, 2) if r["Impressions"] > 0 else 0.0, axis=1)

    # ── Tabs ─────────────────────────────────────────────────────────────────
    tab_perf, tab_cost = st.tabs(["📊 Performance", "💸 Coûts"])

    # ════════════════════════════════════════════════════════════════════════
    with tab_perf:
        k1, k2, k3, k4 = st.columns(4)
        k1.metric("Impressions",   f"{int(total_impressions):,}")
        k2.metric("Reach",         f"{int(total_reach):,}")
        k3.metric("Clics",         f"{int(total_clicks):,}")
        k4.metric("CTR moyen",     f"{avg_ctr:.2f} %")

        st.markdown("<br>", unsafe_allow_html=True)

        # Évolution
        perf_opts = {"Impressions": "impressions", "Clics": "clicks", "CTR (%)": "ctr"}
        sel_perf = st.selectbox("Métrique", list(perf_opts.keys()), key="mad_perf_metric", label_visibility="collapsed")
        fig_perf = px.line(df_daily, x="date_start", y=perf_opts[sel_perf], markers=True,
                           labels={"date_start": "Date", perf_opts[sel_perf]: sel_perf},
                           color_discrete_sequence=["#1a56ff"])
        fig_perf.update_layout(margin=dict(l=0, r=0, t=10, b=0), height=260,
                               xaxis_title=None, plot_bgcolor="white", paper_bgcolor="white")
        fig_perf.update_xaxes(showgrid=False)
        fig_perf.update_yaxes(gridcolor="#f0f0f0")
        st.plotly_chart(fig_perf, use_container_width=True)

        # CTR par campagne
        fig_ctr = px.bar(df_camp.sort_values("ctr"), x="ctr", y="campaign_name", orientation="h",
                         labels={"ctr": "CTR (%)", "campaign_name": ""},
                         color_discrete_sequence=["#1a56ff"], title="CTR par campagne")
        fig_ctr.update_layout(margin=dict(l=0, r=0, t=40, b=0), height=max(200, len(df_camp) * 40),
                               plot_bgcolor="white", paper_bgcolor="white", showlegend=False)
        fig_ctr.update_xaxes(gridcolor="#f0f0f0")
        fig_ctr.update_yaxes(showgrid=False)
        st.plotly_chart(fig_ctr, use_container_width=True)

        # Tableau performance
        cols_perf = [c for c in ["Publicité", "Campagne", "Ensemble", "Impressions", "Clics", "Reach", "Clics lien", "CTR (%)"] if c in df_by_ad.columns]
        st.dataframe(df_by_ad[cols_perf], use_container_width=True, hide_index=True)

    # ════════════════════════════════════════════════════════════════════════
    with tab_cost:
        k1, k2, k3 = st.columns(3)
        k1.metric("Dépenses totales", f"{total_spend:,.2f} CHF")
        k2.metric("CPC moyen",        f"{avg_cpc:.2f} CHF")
        k3.metric("CPM moyen",        f"{avg_cpm:.2f} CHF")

        st.markdown("<br>", unsafe_allow_html=True)

        # Évolution
        cost_opts = {"Dépenses (CHF)": "spend", "CPC (CHF)": "cpc", "CPM (CHF)": "cpm"}
        sel_cost = st.selectbox("Métrique", list(cost_opts.keys()), key="mad_cost_metric", label_visibility="collapsed")
        fig_cost = px.line(df_daily, x="date_start", y=cost_opts[sel_cost], markers=True,
                           labels={"date_start": "Date", cost_opts[sel_cost]: sel_cost},
                           color_discrete_sequence=["#0a0a0a"])
        fig_cost.update_layout(margin=dict(l=0, r=0, t=10, b=0), height=260,
                               xaxis_title=None, plot_bgcolor="white", paper_bgcolor="white")
        fig_cost.update_xaxes(showgrid=False)
        fig_cost.update_yaxes(gridcolor="#f0f0f0")
        st.plotly_chart(fig_cost, use_container_width=True)

        # Dépenses par campagne
        fig_spend = px.bar(df_camp.sort_values("spend"), x="spend", y="campaign_name", orientation="h",
                           labels={"spend": "Dépenses (CHF)", "campaign_name": ""},
                           color_discrete_sequence=["#0a0a0a"], title="Dépenses par campagne")
        fig_spend.update_layout(margin=dict(l=0, r=0, t=40, b=0), height=max(200, len(df_camp) * 40),
                                plot_bgcolor="white", paper_bgcolor="white", showlegend=False)
        fig_spend.update_xaxes(gridcolor="#f0f0f0")
        fig_spend.update_yaxes(showgrid=False)
        st.plotly_chart(fig_spend, use_container_width=True)

        # Tableau coûts
        cols_cost = [c for c in ["Publicité", "Campagne", "Ensemble", "Dépenses (CHF)", "CPC (CHF)", "CPM (CHF)", "Clics"] if c in df_by_ad.columns]
        st.dataframe(df_by_ad[cols_cost], use_container_width=True, hide_index=True)


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
