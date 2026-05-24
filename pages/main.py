import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import streamlit as st

from components.auth import AuthDashboard
from components.sidebar import show_sidebar, show_main_nav
from components.styles import DASHBOARD_CSS
from components.callbacks import (
    handle_meta_oauth_callback,
    handle_meta_page_selection,
    handle_stripe_payment,
    handle_google_oauth_callback,
    handle_google_customer_selection,
)
from components.account_tab import show_account_tab
from components.instagram_tab import show_instagram_tab, run_instagram_fetch
from components.meta_ads import show_meta_ads_tab, run_meta_ads_fetch
from components.google_ads import show_google_ads_tab, run_google_ads_fetch
from components.schedule import schedule
from scripts.fetch_data import fetch_meta_ads, fetch_google_refresh_token, fetch_google_ads
from scripts.stripe import create_checkout_session, cancel_subscription
from pages.rapport import show_rapport


if __name__ == "__main__":

    st.set_page_config(page_title="Dashboard Analytics", page_icon="📊", layout="wide")
    st.markdown(DASHBOARD_CSS, unsafe_allow_html=True)

    # Restaure session Supabase depuis state OAuth (Meta ET Google passent state=refresh_token)
    if "code" in st.query_params and "state" in st.query_params and "refresh_token" not in st.query_params:
        st.query_params["refresh_token"] = st.query_params["state"]

    dash = AuthDashboard()
    dash.main()
    client = dash.client

    handle_meta_oauth_callback()

    if client:
        session = st.session_state["session"]
        user_id = session.user.id

        # Callbacks Google Ads (OAuth + sélection customer)
        handle_google_oauth_callback(client, user_id)
        handle_google_customer_selection(client, user_id)

        try:
            client.table("profiles").upsert(
                {"id": user_id, "email": session.user.email},
                on_conflict="id"
            ).execute()
        except Exception as e:
            st.warning(f"Profil non mis à jour : {e}")

        profile_resp = client.table("profiles").select("is_paid, active_account_id, fetch_schedule").eq("id", user_id).execute()
        profile = profile_resp.data[0] if profile_resp.data else {}
        is_paid = profile.get("is_paid", False)
        if "fetch_schedule" not in st.session_state:
            st.session_state["fetch_schedule"] = profile.get("fetch_schedule")
        if "has_fetched" not in st.session_state:
            count = client.table("instagram_organic_posts").select("post_id", count="exact").eq("user_id", user_id).execute()
            st.session_state["has_fetched"] = (count.count or 0) > 0

        active_account_id = profile.get("active_account_id")
        if active_account_id and "meta_long_token" not in st.session_state:
            acc_resp = client.table("connected_accounts").select("meta_token").eq("id", active_account_id).execute()
            if acc_resp.data:
                st.session_state["meta_long_token"] = acc_resp.data[0]["meta_token"]

        if "meta_ads_df" not in st.session_state:
            try:
                import pandas as pd
                ads_data = fetch_meta_ads(client, user_id)
                if ads_data:
                    st.session_state["meta_ads_df"] = pd.DataFrame(ads_data)
            except Exception:
                pass

        handle_meta_page_selection(client, user_id)

        stripe_result = handle_stripe_payment(client, user_id, session)
        if stripe_result is not None:
            is_paid = is_paid or stripe_result

        show_sidebar()

        st.title("Dashboard Analytics")
        schedule(supabase=client, user_id=user_id, has_fetched=st.session_state.get("has_fetched", False))

        accounts_resp = client.table("connected_accounts").select("id, account_name, instagram_business_id, created_at, total_posts_id_instagram").eq("user_id", user_id).execute()
        accounts_data = accounts_resp.data or []
        insta_accounts = [a for a in accounts_data if a.get("instagram_business_id")]
        has_meta_ads = "meta_long_token" in st.session_state

        # Google Ads connecté ?
        gad_refresh, gad_customer = fetch_google_refresh_token(client, user_id)
        has_google_ads = bool(gad_refresh and gad_customer)

        # Charger google_ads_df depuis Supabase si pas en session
        if has_google_ads and "google_ads_df" not in st.session_state:
            try:
                import pandas as pd
                gads_data = fetch_google_ads(client, user_id)
                if gads_data:
                    st.session_state["google_ads_df"] = pd.DataFrame(gads_data)
            except Exception:
                pass

        # ── Sidebar navigation ────────────────────────────────────────────
        if "page" not in st.session_state:
            st.session_state["page"] = "rapport"

        show_main_nav(insta_accounts, has_meta_ads, has_google_ads=has_google_ads)

        # ── Auto-fetch après OAuth réussi (flag posé par callbacks.py) ──────
        if st.session_state.pop("_auto_fetch_after_oauth", False) and st.session_state.get("meta_long_token"):
            with st.status("Configuration de ton compte…", expanded=True) as status:
                st.write("✓ Connexion Meta établie")
                # 1. Meta Ads
                st.write("Récupération de tes campagnes Meta Ads…")
                try:
                    result = run_meta_ads_fetch(
                        token=st.session_state["meta_long_token"],
                        supabase=client, user_id=user_id,
                    )
                    if result.get("success"):
                        st.write(f"✓ Meta Ads : {result.get('message', '')}")
                    else:
                        st.write(f"⚠ Meta Ads : {result.get('message', 'erreur')}")
                except Exception as e:
                    st.write(f"⚠ Meta Ads : {e}")
                # 2. Instagram
                st.write("Récupération de tes posts Instagram…")
                try:
                    biz_id = insta_accounts[0].get("instagram_business_id") if insta_accounts else None
                    run_instagram_fetch(client, user_id, dash, instagram_business_id=biz_id, is_paid=is_paid)
                    st.write("✓ Instagram chargé")
                except Exception as e:
                    st.write(f"⚠ Instagram : {e}")
                status.update(label="✓ Tout est prêt", state="complete", expanded=False)
            # Atterrir sur Meta Ads pour voir les données
            st.session_state["page"] = "meta_ads"
            st.rerun()

        # ── Auto-fetch Google Ads après OAuth ────────────────────────────────
        if st.session_state.pop("_auto_fetch_google_after_oauth", False) and has_google_ads:
            with st.status("Configuration Google Ads…", expanded=True) as status:
                st.write("✓ Connexion Google établie")
                st.write("Récupération de tes campagnes Google Ads…")
                try:
                    result = run_google_ads_fetch(
                        client, user_id,
                        refresh_token=gad_refresh,
                        customer_id=gad_customer,
                        force_full=True,
                    )
                    if result.get("success"):
                        st.write(f"✓ Google Ads : {result.get('message', '')}")
                    else:
                        st.write(f"⚠ Google Ads : {result.get('message', '')}")
                except Exception as e:
                    st.write(f"⚠ Google Ads : {e}")
                status.update(label="✓ Tout est prêt", state="complete", expanded=False)
            st.session_state["page"] = "google_ads"
            st.rerun()

        page = st.session_state["page"]

        # Guard: si la page demandée n'est plus accessible, fallback rapport
        if page == "instagram" and not insta_accounts:
            page = "rapport"
            st.session_state["page"] = "rapport"
        if page == "meta_ads" and not has_meta_ads:
            page = "rapport"
            st.session_state["page"] = "rapport"
        if page == "google_ads" and not has_google_ads:
            page = "rapport"
            st.session_state["page"] = "rapport"
        # Plus de page "connect" : si quelqu'un l'a en session (state legacy), fallback
        if page == "connect":
            page = "settings"
            st.session_state["page"] = "settings"

        if page == "rapport":
            st.session_state["active_section"] = "rapport"
            show_rapport(client, user_id, is_paid)

        elif page == "instagram":
            st.session_state["active_section"] = "instagram"
            if len(insta_accounts) > 1:
                names = [a.get("account_name") or f"Compte {i+1}" for i, a in enumerate(insta_accounts)]
                sel_idx = st.selectbox(
                    "Compte",
                    options=range(len(insta_accounts)),
                    format_func=lambda i: names[i],
                    key="sel_insta_account",
                    label_visibility="collapsed",
                )
                selected_account = insta_accounts[sel_idx]
            else:
                selected_account = insta_accounts[0] if insta_accounts else {}
            insta_biz_id = selected_account.get("instagram_business_id")
            acc_name = selected_account.get("account_name") or "Instagram"
            show_instagram_tab(client, user_id, is_paid, dash, instagram_business_id=insta_biz_id, account_name=acc_name)

        elif page == "meta_ads":
            st.session_state["active_section"] = "meta_ads"
            show_meta_ads_tab(is_paid=is_paid, client=client, user_id=user_id)

        elif page == "google_ads":
            st.session_state["active_section"] = "google_ads"
            show_google_ads_tab(is_paid=is_paid, client=client, user_id=user_id)

        elif page == "settings":
            st.session_state["active_section"] = "settings"
            st.markdown("""
            <div style='padding:28px 0 20px;'>
                <div style='font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#8b8e98;margin-bottom:6px;'>Paramètres</div>
                <div style='font-family:"Instrument Serif",Georgia,serif;font-size:2rem;font-weight:400;color:#0e0f12;margin:0 0 6px;line-height:1.2;'>Ton compte et ton abonnement.</div>
            </div>
            """, unsafe_allow_html=True)
            show_account_tab(session, client, user_id, is_paid, insta_accounts, accounts_data, dash=dash)
