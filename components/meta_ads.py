import streamlit as st
import requests
import json
import pandas as pd
import plotly.express as px
from datetime import date, timedelta

from scripts.insert_data import upsert_meta_ads
from scripts.fetch_data import fetch_meta_ads


@st.fragment
def meta_ads_source_fragment(token, supabase=None, user_id=None):
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

    if st.button("Récupérer les données Meta Ads", type="primary", key="btn_fetch_meta_ads"):
        if not ad_accounts:
            st.warning("Aucun compte publicitaire trouvé.")
            return
        with st.spinner("Chargement..."):
            ad_account_id = ad_accounts[0]["id"]
            url = f"https://graph.facebook.com/v24.0/{ad_account_id}/insights"
            params = {
                "access_token": token,
                "level": "ad",
                "fields": "campaign_name,adset_name,ad_name,impressions,clicks,reach,link_clicks,spend,date_start",
                "time_increment": 1,
            }
            result = requests.get(url=url, params=params).json()
            rows = result.get("data", [])
            next_url = result.get("paging", {}).get("next")
            while next_url:
                page = requests.get(next_url).json()
                rows += page.get("data", [])
                next_url = page.get("paging", {}).get("next")
            if rows:
                # 1. Persister dans Supabase
                if supabase and user_id:
                    try:
                        upsert_meta_ads(supabase, user_id, rows)
                    except Exception as e:
                        st.warning(f"Sauvegarde Supabase échouée : {e}")

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
                st.info("Aucune donnée sur cette période.")
                st.session_state.pop("meta_ads_df", None)


def show_meta_ads_dashboard(df: pd.DataFrame | None = None):
    """Dashboard complet Meta Ads avec filtres, KPIs, graphiques et tableau."""

    # ── Vérification données ────────────────────────────────────────────────
    if df is None or (isinstance(df, pd.DataFrame) and df.empty):
        st.info("Connectez votre compte Meta Ads dans 'Mon compte' pour voir les données.")
        return

    # ── Typage des colonnes numériques ──────────────────────────────────────
    for col in ["impressions", "clicks", "spend"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    df["date_start"] = pd.to_datetime(df["date_start"], errors="coerce")

    # ── 1. Filtres ──────────────────────────────────────────────────────────
    all_campaigns = sorted(df["campaign_name"].dropna().unique().tolist())
    selected_campaigns = st.multiselect(
        "Campagnes",
        options=all_campaigns,
        placeholder="Toutes",
        key="mad_campaigns",
    )

    # Appliquer le filtre campagnes
    df_view = df.copy()
    if selected_campaigns:
        df_view = df_view[df_view["campaign_name"].isin(selected_campaigns)]

    if df_view.empty:
        st.warning("Aucune donnée pour ces campagnes.")
        return

    # ── 2. KPIs ─────────────────────────────────────────────────────────────
    total_spend = df_view["spend"].sum()
    total_clicks = df_view["clicks"].sum()
    total_impressions = df_view["impressions"].sum()

    avg_ctr = (total_clicks / total_impressions * 100) if total_impressions > 0 else 0.0
    avg_cpc = (total_spend / total_clicks) if total_clicks > 0 else 0.0
    avg_cpm = (total_spend / total_impressions * 1000) if total_impressions > 0 else 0.0

    k1, k2, k3, k4 = st.columns(4)
    k1.metric("💸 Dépenses totales", f"{total_spend:,.2f} €")
    k2.metric("🖱️ CTR moyen", f"{avg_ctr:.2f} %")
    k3.metric("💰 CPC moyen", f"{avg_cpc:.2f} €")
    k4.metric("📣 CPM moyen", f"{avg_cpm:.2f} €")

    st.markdown("<br>", unsafe_allow_html=True)

    # ── 3. Évolution temporelle ─────────────────────────────────────────────
    st.markdown("#### Évolution temporelle")

    metric_options = {
        "Dépenses (€)": "spend",
        "CTR (%)": "ctr",
        "CPC (€)": "cpc",
        "Impressions": "impressions",
    }
    selected_metric_label = st.selectbox(
        "Métrique",
        options=list(metric_options.keys()),
        key="mad_trend_metric",
        label_visibility="collapsed",
    )
    selected_metric = metric_options[selected_metric_label]

    df_daily = (
        df_view.groupby("date_start", as_index=False)
        .agg(spend=("spend", "sum"), clicks=("clicks", "sum"), impressions=("impressions", "sum"))
    )
    df_daily["ctr"] = df_daily.apply(
        lambda r: r["clicks"] / r["impressions"] * 100 if r["impressions"] > 0 else 0, axis=1
    )
    df_daily["cpc"] = df_daily.apply(
        lambda r: r["spend"] / r["clicks"] if r["clicks"] > 0 else 0, axis=1
    )
    df_daily = df_daily.sort_values("date_start")

    fig_trend = px.line(
        df_daily,
        x="date_start",
        y=selected_metric,
        markers=True,
        labels={"date_start": "Date", selected_metric: selected_metric_label},
        color_discrete_sequence=["#0066ff"],
    )
    fig_trend.update_layout(
        margin=dict(l=0, r=0, t=10, b=0),
        height=280,
        xaxis_title=None,
        plot_bgcolor="white",
        paper_bgcolor="white",
    )
    fig_trend.update_xaxes(showgrid=False)
    fig_trend.update_yaxes(gridcolor="#f0f0f0")
    st.plotly_chart(fig_trend, use_container_width=True)

    st.markdown("<br>", unsafe_allow_html=True)

    # ── 4. Performance par campagne ─────────────────────────────────────────
    st.markdown("#### Performance par campagne")

    df_camp = (
        df_view.groupby("campaign_name", as_index=False)
        .agg(spend=("spend", "sum"), clicks=("clicks", "sum"), impressions=("impressions", "sum"))
    )
    df_camp["ctr"] = df_camp.apply(
        lambda r: r["clicks"] / r["impressions"] * 100 if r["impressions"] > 0 else 0, axis=1
    )
    df_camp = df_camp.sort_values("spend", ascending=True)

    col_bar1, col_bar2 = st.columns(2)

    with col_bar1:
        fig_spend = px.bar(
            df_camp,
            x="spend",
            y="campaign_name",
            orientation="h",
            labels={"spend": "Dépenses (€)", "campaign_name": ""},
            color_discrete_sequence=["#0066ff"],
            title="Dépenses par campagne",
        )
        fig_spend.update_layout(
            margin=dict(l=0, r=0, t=40, b=0),
            height=300,
            plot_bgcolor="white",
            paper_bgcolor="white",
            showlegend=False,
        )
        fig_spend.update_xaxes(gridcolor="#f0f0f0")
        fig_spend.update_yaxes(showgrid=False)
        st.plotly_chart(fig_spend, use_container_width=True)

    with col_bar2:
        fig_ctr = px.bar(
            df_camp,
            x="ctr",
            y="campaign_name",
            orientation="h",
            labels={"ctr": "CTR (%)", "campaign_name": ""},
            color_discrete_sequence=["#00c49f"],
            title="CTR par campagne",
        )
        fig_ctr.update_layout(
            margin=dict(l=0, r=0, t=40, b=0),
            height=300,
            plot_bgcolor="white",
            paper_bgcolor="white",
            showlegend=False,
        )
        fig_ctr.update_xaxes(gridcolor="#f0f0f0")
        fig_ctr.update_yaxes(showgrid=False)
        st.plotly_chart(fig_ctr, use_container_width=True)

    st.markdown("<br>", unsafe_allow_html=True)

    # ── 5. Tableau détaillé ─────────────────────────────────────────────────
    st.markdown("#### Tableau détaillé")

    df_table = df_view[["campaign_name", "adset_name", "ad_name", "impressions", "clicks", "spend"]].copy()
    df_table["CTR (%)"] = df_table.apply(
        lambda r: round(r["clicks"] / r["impressions"] * 100, 2) if r["impressions"] > 0 else 0.0, axis=1
    )
    df_table["CPC (€)"] = df_table.apply(
        lambda r: round(r["spend"] / r["clicks"], 2) if r["clicks"] > 0 else 0.0, axis=1
    )
    df_table["CPM (€)"] = df_table.apply(
        lambda r: round(r["spend"] / r["impressions"] * 1000, 2) if r["impressions"] > 0 else 0.0, axis=1
    )
    df_table["spend"] = df_table["spend"].round(2)
    df_table["impressions"] = df_table["impressions"].astype(int)
    df_table["clicks"] = df_table["clicks"].astype(int)
    df_table = df_table.rename(columns={
        "campaign_name": "Campagne",
        "adset_name": "Ensemble",
        "ad_name": "Publicité",
        "impressions": "Impressions",
        "clicks": "Clics",
        "spend": "Dépenses (€)",
    })

    st.dataframe(df_table, use_container_width=True, hide_index=True)


def show_meta_ads_tab():
    df = st.session_state.get("meta_ads_df")
    show_meta_ads_dashboard(df)
