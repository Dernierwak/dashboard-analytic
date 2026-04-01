import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import streamlit as st

from components.auth import Dashboard
from components.sidebar import show_sidebar
from components.dashboard import show_dashboard, follower_module
from scripts.insert_data import insert_instagram_org
from scripts.stripe import verify_and_get_metadata
from meta_script.fetch_token import exchange_code_for_token, get_long_lives_token, get_oauth_url
from meta_script.fetch_instagram import OrganicInstagramm
from components.schedule import schedule


DASHBOARD_CSS = """
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    /* ── Base ── */
    .stApp, .stApp > *, [data-testid="stAppViewContainer"] {
        background-color: #ffffff !important;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    [data-testid="stHeader"] { background: #ffffff !important; border-bottom: 1px solid #eaeaea; }
    [data-testid="stSidebar"] { background: #fafafa !important; border-right: 1px solid #eaeaea; }
    [data-testid="stSidebar"] * { color: #37352f !important; }

    /* ── Typography ── */
    h1, h2, h3, h4 { color: #191919 !important; font-weight: 600 !important; }
    p, span, div, label, li { color: #37352f; }

    /* ── Tabs ── */
    [data-testid="stTabs"] [data-baseweb="tab-list"] {
        background: #ffffff !important;
        border-bottom: 1px solid #eaeaea;
        gap: 4px;
    }
    [data-testid="stTabs"] [data-baseweb="tab"] {
        background: transparent !important;
        color: #6b6b6b !important;
        border-radius: 8px 8px 0 0;
        font-weight: 500;
        padding: 10px 20px;
    }
    [data-testid="stTabs"] [aria-selected="true"] {
        color: #191919 !important;
        border-bottom: 2px solid #191919 !important;
        background: transparent !important;
    }

    /* ── Buttons ── */
    [data-testid="stButton"] > button {
        background: #0066ff !important;
        color: #ffffff !important;
        border: none !important;
        border-radius: 8px !important;
        font-weight: 500 !important;
        padding: 8px 20px !important;
        font-family: 'Inter', sans-serif !important;
        transition: all 0.2s !important;
    }
    [data-testid="stButton"] > button:hover {
        background: #0052cc !important;
        box-shadow: 0 2px 8px rgba(0,102,255,0.25) !important;
    }
    [data-testid="stButton"] > button[kind="secondary"] {
        background: #ffffff !important;
        color: #191919 !important;
        border: 1px solid #eaeaea !important;
    }
    [data-testid="stLinkButton"] > a {
        background: #ffffff !important;
        color: #191919 !important;
        border: 1px solid #eaeaea !important;
        border-radius: 8px !important;
        font-weight: 500 !important;
        text-decoration: none !important;
        transition: all 0.2s !important;
    }
    [data-testid="stLinkButton"] > a:hover { border-color: #191919 !important; }

    /* ── Selectbox ── */
    [data-testid="stSelectbox"] > div > div {
        background: #ffffff !important;
        border: 1px solid #eaeaea !important;
        border-radius: 8px !important;
        color: #191919 !important;
    }

    /* ── Slider ── */
    [data-testid="stSlider"] { background: transparent !important; }
    [data-testid="stSlider"] [data-baseweb="slider"] { background: transparent !important; }
    [data-testid="stSlider"] [data-testid="stTickBar"] { background: transparent !important; }
    [data-testid="stSlider"] div[data-baseweb="slider"] > div:first-child {
        background: #eaeaea !important;
    }
    [data-testid="stSlider"] div[role="slider"] {
        background: #191919 !important;
        border-color: #191919 !important;
    }
    [data-testid="stSlider"] label { color: #6b6b6b !important; font-size: 0.85rem !important; }
    [data-testid="stSlider"] [data-testid="stMarkdownContainer"] p { color: #191919 !important; font-size: 0.82rem !important; }

    /* ── Text inputs ── */
    [data-testid="stTextInput"] > div > div > input {
        background: #ffffff !important;
        border: 1px solid #eaeaea !important;
        border-radius: 8px !important;
        color: #191919 !important;
    }
    [data-testid="stTextInput"] > div > div > input:focus { border-color: #191919 !important; box-shadow: none !important; }

    /* ── Metrics ── */
    [data-testid="stMetric"] {
        background: #fafafa !important;
        border: 1px solid #eaeaea !important;
        border-radius: 12px !important;
        padding: 20px 24px !important;
    }
    [data-testid="stMetricLabel"] > div { font-size: 0.82rem !important; color: #6b6b6b !important; }
    [data-testid="stMetricValue"] { font-size: 1.6rem !important; font-weight: 700 !important; color: #191919 !important; }

    /* ── Plotly charts ── */
    [data-testid="stPlotlyChart"] { background: #ffffff !important; border-radius: 12px !important; }
    [data-testid="stPlotlyChart"] > div { background: #ffffff !important; }

    /* ── Dataframe ── */
    [data-testid="stDataFrame"] { border: 1px solid #eaeaea !important; border-radius: 12px !important; overflow: hidden; }
    [data-testid="stDataFrame"] th { color: #191919 !important; font-weight: 600 !important; }
    [data-testid="stDataFrame"] td { color: #37352f !important; }

    /* ── Info / success / warning ── */
    [data-testid="stAlert"] { border-radius: 10px !important; border: 1px solid #eaeaea !important; }

    /* ── Custom components ── */
    .kpi-card {
        background: #fafafa;
        border: 1px solid #eaeaea;
        border-radius: 12px;
        padding: 24px 28px;
        transition: border-color 0.2s, box-shadow 0.2s;
        height: 100%;
    }
    .kpi-card:hover { border-color: #191919; box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
    .kpi-label { font-size: 0.82rem; color: #6b6b6b !important; margin-bottom: 8px; font-weight: 500; }
    .kpi-value { font-size: 2rem; font-weight: 700; color: #191919 !important; line-height: 1.1; }
    .kpi-delta { font-size: 0.82rem; margin-top: 6px; font-weight: 500; }
    .kpi-delta.positive { color: #16a34a !important; }
    .kpi-delta.negative { color: #dc2626 !important; }

    .section-title { font-size: 1rem; font-weight: 600; color: #191919 !important; margin-bottom: 12px; margin-top: 4px; }

    .source-badge {
        background: #f0f4ff; color: #0066ff !important;
        border-radius: 20px; padding: 4px 14px;
        font-size: 0.78rem; font-weight: 600;
        display: inline-block;
    }
    .account-name { font-weight: 600; color: #191919 !important; font-size: 1rem; }
    .account-meta { font-size: 0.82rem; color: #6b6b6b !important; margin-top: 2px; }
    .post-metric { font-size: 1.5rem; font-weight: 700; color: #191919 !important; margin: 8px 0 4px; }
    .post-type { font-size: 0.78rem; color: #6b6b6b !important; }
</style>
"""

if __name__ == "__main__":

    st.set_page_config(page_title="Dashboard Analytics", page_icon="📊", layout="wide")
    st.markdown(DASHBOARD_CSS, unsafe_allow_html=True)

    # ── Restaurer session depuis state Meta OAuth ───────────────────────────
    if "code" in st.query_params and "state" in st.query_params and "refresh_token" not in st.query_params:
        st.query_params["refresh_token"] = st.query_params["state"]

    # ── Auth + client Supabase ──────────────────────────────────────────────
    dash = Dashboard()
    dash.main()
    client = dash.client

    # ── Callback OAuth Meta ─────────────────────────────────────────────────
    if "code" in st.query_params and "session" in st.session_state:
        code = st.query_params["code"]
        with st.spinner("Connexion Meta..."):
            data = exchange_code_for_token(code)
        if "access_token" in data:
            long_token = get_long_lives_token(data["access_token"])
            st.session_state["meta_long_token"] = long_token
            st.session_state["_save_meta_token"] = True
            session = st.session_state["session"]
            st.query_params.clear()
            st.query_params["refresh_token"] = session.refresh_token
            st.rerun()
        else:
            st.error(f"Erreur Meta : {data}")
            del st.query_params["code"]

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

        # Sauvegarder nouveau token dans connected_accounts
        if st.session_state.get("_save_meta_token"):
            try:
                org = OrganicInstagramm(
                    meta_long_token=st.session_state["meta_long_token"],
                    supabase_client=client,
                    supabase_user_id=user_id,
                )
                org._fetch_id_instagram()
                org._fetch_id_business()
                # Vérifier si ce compte Instagram existe déjà
                existing = client.table("connected_accounts").select("id").eq("user_id", user_id).eq("instagram_business_id", org.meta_id_business).execute()
                if existing.data:
                    new_account_id = existing.data[0]["id"]
                    client.table("connected_accounts").update({
                        "meta_token": st.session_state["meta_long_token"],
                        "account_name": org.meta_account_name,
                    }).eq("id", new_account_id).execute()
                else:
                    acc = client.table("connected_accounts").insert({
                        "user_id": user_id,
                        "meta_token": st.session_state["meta_long_token"],
                        "account_name": org.meta_account_name,
                        "instagram_business_id": org.meta_id_business,
                    }).execute()
                    new_account_id = acc.data[0]["id"]
                client.table("profiles").update({"active_account_id": new_account_id}).eq("id", user_id).execute()
            except Exception as e:
                st.error(f"Erreur connexion Meta : {e}")
            del st.session_state["_save_meta_token"]

        # Vérifier paiement Stripe
        if st.query_params.get("payment") == "success" and "session_id" in st.query_params:
            meta = verify_and_get_metadata(st.query_params["session_id"])
            if meta:
                client.table("profiles").update({"is_paid": True}).eq("id", user_id).execute()
                is_paid = True
                st.session_state["trigger_fetch"] = True
                st.session_state["has_fetched"] = False
                if "checkout_url" in st.session_state:
                    del st.session_state["checkout_url"]
                st.success("Paiement confirmé ! Bienvenue dans le plan Pro.")
            else:
                st.warning("Paiement non vérifié. Contactez le support si vous avez payé.")
            st.query_params.clear()
            st.query_params["refresh_token"] = session.refresh_token
        elif st.query_params.get("payment") == "cancelled":
            st.info("Paiement annulé.")
            st.query_params.clear()
            st.query_params["refresh_token"] = session.refresh_token

        # ── Sidebar ─────────────────────────────────────────────────────────
        show_sidebar(client, session, is_paid)

        # ── Contenu principal ────────────────────────────────────────────────
        st.title("Dashboard Analytics")
        schedule(supabase=client, user_id=user_id, has_fetched=st.session_state.get("has_fetched", False))
       
        # ── end
        
        tab_account, tab_insta = st.tabs(["Mon compte", "Instagram Organic"])

        # ── Tab Mon compte ───────────────────────────────────────────────────
        with tab_account:
            st.markdown("<div class='section-title'>Informations du compte</div>", unsafe_allow_html=True)
            col1, col2, col3 = st.columns(3)
            col1.metric("Email", session.user.email)
            col2.metric("Plan", "Pro" if is_paid else "Gratuit")
            col3.metric("Posts max", "50" if is_paid else "10")

            st.markdown("<br>", unsafe_allow_html=True)
            st.markdown("<div class='section-title'>Sources connectées</div>", unsafe_allow_html=True)

            accounts_resp = client.table("connected_accounts").select("id, account_name, instagram_business_id, created_at, total_posts_id_instagram").eq("user_id", user_id).execute()
            accounts_data = accounts_resp.data or []

            pt_insta, pt_meta_ads, pt_google = st.tabs(["Instagram Organic", "Meta Ads", "Google Ads"])

            with pt_insta:
                insta_accounts = [a for a in accounts_data if a.get("instagram_business_id")]
                if insta_accounts:
                    for acc in insta_accounts:
                        name = acc.get("account_name") or "Compte Instagram"
                        date = acc.get("created_at", "")[:10]
                        col_info, col_btn = st.columns([5, 1])
                        total_posts = acc.get("total_posts_id_instagram", {})
                        with col_info:
                            st.markdown(f"<div class='account-name'>{name}</div><div class='account-meta'>Connecté le {date}</div>", unsafe_allow_html=True)
                            st.markdown(f"You have: {total_posts} post")
                        with col_btn:
                            if st.button("Retirer", key=f"disc_{acc['id']}"):
                                client.table("profiles").update({"active_account_id": None}).eq("id", user_id).execute()
                                client.table("connected_accounts").delete().eq("id", acc["id"]).execute()
                                if st.session_state.get("meta_long_token"):
                                    del st.session_state["meta_long_token"]
                                st.rerun()
                else:
                    st.markdown("<div style='color:#6b6b6b;padding:12px 0'>Aucun compte connecté.</div>", unsafe_allow_html=True)
                st.markdown("<br>", unsafe_allow_html=True)
                st.link_button("+ Connecter un compte Instagram", get_oauth_url(state=st.session_state["session"].refresh_token))

            with pt_meta_ads:
                st.info("Bientôt disponible")

            with pt_google:
                st.info("Bientôt disponible")

        # ── Tab Instagram Organic ────────────────────────────────────────────
        with tab_insta:
            if "meta_long_token" in st.session_state:
                follower_module(client=client, user_id=user_id)
                st.divider()
                if st.session_state.pop("trigger_fetch", False):
                    try:
                        org = OrganicInstagramm(
                            meta_long_token=st.session_state["meta_long_token"],
                            supabase_client=client,
                            supabase_user_id=user_id,
                        )
                        org.fetch_insta_post_insight()
                        if org.new_results:
                            insert_instagram_org(supabase=client, results=org.new_results)
                        st.session_state["has_fetched"] = True
                        st.caption(f"{org.limit} posts affichés sur {org.total_posts} au total · Plan {'Pro' if is_paid else 'Gratuit — max 10 posts'}")
                        st.rerun()
                    except Exception as e:
                        if "JWT expired" in str(e):
                            user = dash.supabase.auth.refresh_session(
                                refresh_token=st.session_state["session"].refresh_token
                            )
                            st.session_state["session"] = user.session
                            st.query_params["refresh_token"] = user.session.refresh_token
                            st.rerun()
                        else:
                            st.error(f"Erreur : {e}")

                show_dashboard(client, user_id, is_paid=is_paid)
            else:
                st.info("Connectez votre compte Meta dans la barre latérale pour commencer.")
