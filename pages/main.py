import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import streamlit as st

from components.auth import AuthDashboard
from components.sidebar import show_sidebar
from components.styles import DASHBOARD_CSS
from components.callbacks import handle_meta_oauth_callback, handle_meta_page_selection, handle_stripe_payment
from components.account_tab import show_account_tab
from components.instagram_tab import show_instagram_tab
from components.meta_ads import show_meta_ads_tab
from components.schedule import schedule


if __name__ == "__main__":

    st.set_page_config(page_title="Dashboard Analytics", page_icon="📊", layout="wide")
    st.markdown(DASHBOARD_CSS, unsafe_allow_html=True)

    # ── Restaurer session depuis state Meta OAuth ───────────────────────────
    if "code" in st.query_params and "state" in st.query_params and "refresh_token" not in st.query_params:
        st.query_params["refresh_token"] = st.query_params["state"]

    # ── Auth + client Supabase ──────────────────────────────────────────────
    dash = AuthDashboard()
    dash.main()
    client = dash.client

    # ── Callback OAuth Meta ─────────────────────────────────────────────────
    handle_meta_oauth_callback()

    # ── Contenu authentifié ─────────────────────────────────────────────────
    if client:
        session = st.session_state["session"]
        user_id = session.user.id

        # Upsert profil
        client.table("profiles").upsert({"id": user_id, "email": session.user.email}).execute()

        # Charger le profil
        profile_resp = client.table("profiles").select("is_paid, active_account_id, fetch_schedule").eq("id", user_id).execute()
        profile = profile_resp.data[0] if profile_resp.data else {}
        is_paid = profile.get("is_paid", False)
        if "fetch_schedule" not in st.session_state:
            st.session_state["fetch_schedule"] = profile.get("fetch_schedule")
        if "has_fetched" not in st.session_state:
            count = client.table("instagram_organic_posts").select("post_id", count="exact").eq("user_id", user_id).execute()
            st.session_state["has_fetched"] = (count.count or 0) > 0

        # Restaurer token Meta depuis connected_accounts
        active_account_id = profile.get("active_account_id")
        if active_account_id and "meta_long_token" not in st.session_state:
            acc_resp = client.table("connected_accounts").select("meta_token").eq("id", active_account_id).execute()
            if acc_resp.data:
                st.session_state["meta_long_token"] = acc_resp.data[0]["meta_token"]

        # Sélection page Facebook (bloque le render si nécessaire)
        handle_meta_page_selection(client, user_id)

        # Vérifier paiement Stripe
        stripe_result = handle_stripe_payment(client, user_id, session)
        if stripe_result is not None:
            is_paid = is_paid or stripe_result

        # ── Sidebar ─────────────────────────────────────────────────────────
        show_sidebar(client, session, is_paid)

        # ── Contenu principal ────────────────────────────────────────────────
        st.title("Dashboard Analytics")
        schedule(supabase=client, user_id=user_id, has_fetched=st.session_state.get("has_fetched", False))

        # ── Tabs dynamiques ─────────────────────────────────────────────────
        accounts_resp = client.table("connected_accounts").select("id, account_name, instagram_business_id, created_at, total_posts_id_instagram").eq("user_id", user_id).execute()
        accounts_data = accounts_resp.data or []
        insta_accounts = [a for a in accounts_data if a.get("instagram_business_id")]
        has_meta_ads = "meta_long_token" in st.session_state

        tab_names = ["Mon compte"]
        if insta_accounts:
            tab_names.append("Instagram Organic")
        if has_meta_ads:
            tab_names.append("Meta Ads")
        tabs = st.tabs(tab_names)
        tab_account = tabs[0]
        tab_insta = tabs[tab_names.index("Instagram Organic")] if "Instagram Organic" in tab_names else None
        tab_meta_ads = tabs[tab_names.index("Meta Ads")] if "Meta Ads" in tab_names else None

        with tab_account:
            show_account_tab(session, client, user_id, is_paid, insta_accounts, accounts_data)

        if tab_insta:
            with tab_insta:
                insta_biz_id = insta_accounts[0].get("instagram_business_id") if insta_accounts else None
                show_instagram_tab(client, user_id, is_paid, dash, instagram_business_id=insta_biz_id)

        if tab_meta_ads:
            with tab_meta_ads:
                show_meta_ads_tab()
