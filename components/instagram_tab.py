import streamlit as st

from components.dashboard import show_dashboard, follower_module
from scripts.insert_data import insert_instagram_org
from meta_script.fetch_instagram import OrganicInstagramm


@st.fragment
def fetch_instagram_fragment(client, user_id, is_paid, dash, instagram_business_id=None):
    if st.session_state.pop("trigger_fetch", False):
        try:
            org = OrganicInstagramm(
                meta_long_token=st.session_state["meta_long_token"],
                supabase_client=client,
                supabase_user_id=user_id,
                instagram_business_id=instagram_business_id,
            )
            org.fetch_insta_post_insight()
            if org.new_results:
                insert_instagram_org(supabase=client, results=org.new_results)
            st.session_state["has_fetched"] = True
            st.caption(f"{org.limit} posts affichés sur {org.total_posts} au total · Plan {'Pro' if is_paid else 'Gratuit — max 10 posts'}")

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


def show_instagram_tab(client, user_id, is_paid, dash, instagram_business_id=None):
    follower_module(client=client, user_id=user_id)
    st.divider()
    fetch_instagram_fragment(client=client, user_id=user_id, is_paid=is_paid, dash=dash, instagram_business_id=instagram_business_id)
    show_dashboard(client, user_id, is_paid=is_paid)