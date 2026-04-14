import streamlit as st
import requests
import json
import pandas as pd


@st.fragment
def meta_ads_source_fragment(token):
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
    col1, col2 = st.columns(2)
    with col1:
        since_raw = st.date_input("Début", value=None, key="meta_ads_since")
    with col2:
        end_raw = st.date_input("Fin", value=None, key="meta_ads_end")

    if st.button("Récupérer les données Meta Ads", type="primary", key="btn_fetch_meta_ads"):
        if not since_raw or not end_raw:
            st.warning("Sélectionne une période.")
            return
        if not ad_accounts:
            st.warning("Aucun compte publicitaire trouvé.")
            return
        with st.spinner("Chargement..."):
            ad_account_id = ad_accounts[0]["id"]
            since = since_raw.strftime("%Y-%m-%d")
            end = end_raw.strftime("%Y-%m-%d")
            url = f"https://graph.facebook.com/v24.0/{ad_account_id}/insights"
            params = {
                "access_token": token,
                "level": "ad",
                "fields": "campaign_name,adset_name,ad_name,impressions,clicks,spend,date_start",
                "time_range": json.dumps({"since": since, "until": end}),
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
                st.session_state["meta_ads_df"] = pd.DataFrame(rows)
                st.rerun()
            else:
                st.info("Aucune donnée sur cette période.")
                st.session_state.pop("meta_ads_df", None)


def show_meta_ads_tab():
    if "meta_ads_df" in st.session_state:
        st.dataframe(st.session_state["meta_ads_df"], use_container_width=True, hide_index=True)
    else:
        st.info("Aucune donnée. Allez dans Mon compte → Sources → Meta Ads pour lancer un fetch.")
