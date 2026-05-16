import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import streamlit as st

from components.auth import AuthDashboard
from components.sidebar import show_sidebar, show_main_nav
from components.styles import DASHBOARD_CSS
from components.callbacks import handle_meta_oauth_callback, handle_meta_page_selection, handle_stripe_payment
from components.account_tab import show_account_tab
from components.instagram_tab import show_instagram_tab
from components.meta_ads import show_meta_ads_tab, meta_ads_source_fragment
from components.schedule import schedule
from scripts.fetch_data import fetch_meta_ads
from meta_script.fetch_token import get_oauth_url
from scripts.stripe import create_checkout_session, cancel_subscription
from pages.rapport import show_rapport

CONNECT_META_CSS = """
<style>
.page-h { padding: 28px 0 24px; }
.h-eyebrow { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #8b8e98; margin-bottom: 6px; }
.page-h h1 { font-family: "Instrument Serif", Georgia, serif; font-size: 2rem; font-weight: 400; color: #0e0f12; margin: 0 0 6px; line-height: 1.2; }
.h-sub { font-size: 14px; color: #5a5d66; margin: 0; }
.card { background: #fff; border: 1px solid rgba(14,15,18,0.08); border-radius: 14px; padding: 28px; }
.meta-logo { width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg,#0052d4,#7b4fff,#ff6b35); display: inline-block; margin-bottom: 16px; }
.perm-list { list-style: none; padding: 0; margin: 16px 0 0; }
.perm-list li { font-size: 13px; color: #5a5d66; padding: 4px 0; display: flex; align-items: center; gap: 8px; }
.perm-ok { color: #1a7a4a; font-weight: 700; }
.perm-no { color: #c0392b; font-weight: 700; }
</style>
"""


if __name__ == "__main__":

    st.set_page_config(page_title="Dashboard Analytics", page_icon="📊", layout="wide")
    st.markdown(DASHBOARD_CSS, unsafe_allow_html=True)

    if "code" in st.query_params and "state" in st.query_params and "refresh_token" not in st.query_params:
        st.query_params["refresh_token"] = st.query_params["state"]

    dash = AuthDashboard()
    dash.main()
    client = dash.client

    handle_meta_oauth_callback()

    if client:
        session = st.session_state["session"]
        user_id = session.user.id

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

        # ── Sidebar navigation (remplace st.tabs) ────────────────────────────
        if "page" not in st.session_state:
            st.session_state["page"] = "rapport"

        show_main_nav(insta_accounts, has_meta_ads)

        page = st.session_state["page"]

        # Guard: si la page demandée n'est plus accessible, fallback rapport
        if page == "instagram" and not insta_accounts:
            page = "rapport"
            st.session_state["page"] = "rapport"
        if page == "meta_ads" and not has_meta_ads:
            page = "rapport"
            st.session_state["page"] = "rapport"

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

        elif page == "connect":
            st.session_state["active_section"] = "connect_meta"
            st.markdown(CONNECT_META_CSS, unsafe_allow_html=True)

            st.markdown("""
            <div class='page-h'>
                <div class='h-eyebrow'>Configuration · Étape 1</div>
                <h1>Connecte ton compte Meta en 30 secondes.</h1>
                <p class='h-sub'>Autorise l'accès en lecture à tes campagnes publicitaires et à ton compte Instagram.</p>
            </div>
            """, unsafe_allow_html=True)

            col_card, col_space = st.columns([2, 1])
            with col_card:
                st.markdown("""
                <div class='card'>
                    <div class='meta-logo'></div>
                    <div style='font-size:16px;font-weight:600;color:#0e0f12;margin-bottom:6px;'>Meta Business</div>
                    <div style='font-size:13px;color:#5a5d66;margin-bottom:16px;'>Connecte Facebook / Instagram Ads pour analyser tes campagnes directement dans le dashboard.</div>
                    <ul class='perm-list'>
                        <li><span class='perm-ok'>✓</span> Lire tes campagnes publicitaires</li>
                        <li><span class='perm-ok'>✓</span> Lire ton compte Instagram Business</li>
                        <li><span class='perm-ok'>✓</span> Accéder aux insights et métriques</li>
                        <li><span class='perm-no'>✗</span> Publier en ton nom</li>
                        <li><span class='perm-no'>✗</span> Lire tes messages privés</li>
                    </ul>
                </div>
                """, unsafe_allow_html=True)
                st.markdown("<br>", unsafe_allow_html=True)
                st.link_button(
                    "🔗 Connecter avec Meta",
                    get_oauth_url(state=st.session_state["session"].refresh_token),
                    type="primary",
                )

            if "meta_long_token" in st.session_state:
                st.markdown("<br>", unsafe_allow_html=True)
                st.success("✅ Compte Meta connecté")
                meta_ads_source_fragment(
                    token=st.session_state["meta_long_token"],
                    supabase=client,
                    user_id=user_id,
                )

                st.markdown("<br>", unsafe_allow_html=True)
                if insta_accounts:
                    st.markdown("<div class='section-title' style='font-size:14px;font-weight:600;color:#0e0f12;margin-bottom:10px;'>Comptes Instagram connectés</div>", unsafe_allow_html=True)
                    for acc in insta_accounts:
                        name = acc.get("account_name") or "Compte Instagram"
                        date_str = acc.get("created_at", "")[:10]
                        total_posts = acc.get("total_posts_id_instagram", 0)
                        col_info, col_btn = st.columns([5, 1])
                        with col_info:
                            st.markdown(
                                f"<div class='account-name'>{name}</div>"
                                f"<div class='account-meta'>Connecté le {date_str} · {total_posts} posts</div>",
                                unsafe_allow_html=True,
                            )
                        with col_btn:
                            if st.button("Retirer", key=f"disc_connect_{acc['id']}"):
                                client.table("profiles").update({"active_account_id": None}).eq("id", user_id).execute()
                                client.table("connected_accounts").delete().eq("id", acc["id"]).execute()
                                if st.session_state.get("meta_long_token"):
                                    del st.session_state["meta_long_token"]
                                st.rerun()

                if insta_accounts and st.button("Récupérer mes données Instagram", type="primary", key="btn_fetch_insta_connect"):
                    st.session_state["trigger_fetch"] = True
                    st.rerun()

        elif page == "settings":
            st.session_state["active_section"] = "settings"
            st.markdown("""
            <div style='padding:28px 0 20px;'>
                <div style='font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#8b8e98;margin-bottom:6px;'>Paramètres</div>
                <div style='font-family:"Instrument Serif",Georgia,serif;font-size:2rem;font-weight:400;color:#0e0f12;margin:0 0 6px;line-height:1.2;'>Ton compte et ton abonnement.</div>
            </div>
            """, unsafe_allow_html=True)
            show_account_tab(session, client, user_id, is_paid, insta_accounts, accounts_data, dash=dash)
