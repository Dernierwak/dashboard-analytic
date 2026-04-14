import streamlit as st

from meta_script.fetch_token import get_oauth_url
from components.meta_ads import meta_ads_source_fragment


def show_account_tab(session, client, user_id, is_paid, insta_accounts, accounts_data):
    st.markdown("<div class='section-title'>Informations du compte</div>", unsafe_allow_html=True)
    col1, col2, col3 = st.columns(3)
    col1.metric("Email", session.user.email)
    col2.metric("Plan", "Pro" if is_paid else "Gratuit")
    col3.metric("Posts max", "50" if is_paid else "10")

    st.markdown("<br>", unsafe_allow_html=True)
    st.markdown("<div class='section-title'>Sources connectées</div>", unsafe_allow_html=True)

    pt_insta, pt_meta_ads, pt_google = st.tabs(["Instagram Organic", "Meta Ads", "Google Ads"])

    with pt_insta:
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
        if insta_accounts and st.button("Récupérer mes données Instagram", type="primary", key="btn_fetch_insta_source"):
            st.session_state["trigger_fetch"] = True
            st.rerun()

    with pt_meta_ads:
        if "meta_long_token" in st.session_state:
            meta_ads_source_fragment(token=st.session_state["meta_long_token"])
        else:
            st.markdown("<div style='color:#6b6b6b;padding:12px 0'>Aucun compte connecté.</div>", unsafe_allow_html=True)
            st.markdown("<br>", unsafe_allow_html=True)
            st.link_button("+ Connecter Meta Ads", get_oauth_url(state=st.session_state["session"].refresh_token))

    with pt_google:
        st.info("Bientôt disponible")
