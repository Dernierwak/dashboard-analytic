import streamlit as st
import requests
import stripe

from meta_script.fetch_token import exchange_code_for_token, get_long_lives_token
from meta_script.fetch_instagram import OrganicInstagramm


def handle_meta_oauth_callback():
    """Échange le code OAuth Meta contre un long-lived token."""
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


def handle_meta_page_selection(client, user_id):
    """Affiche la sélection de page Facebook et connecte le compte Instagram."""
    if not st.session_state.get("_save_meta_token"):
        return False

    token = st.session_state["meta_long_token"]

    if "fb_pages_list" not in st.session_state:
        try:
            r = requests.get(
                "https://graph.facebook.com/v24.0/me/accounts",
                params={"fields": "id,name", "access_token": token}
            )
            st.session_state["fb_pages_list"] = r.json().get("data", [])
        except Exception:
            st.session_state["fb_pages_list"] = []

    pages = st.session_state.get("fb_pages_list", [])

    if not pages:
        st.error("Aucune Page Facebook trouvée. Tu dois avoir une Page Facebook liée à ton compte.")
        del st.session_state["_save_meta_token"]
        return False

    st.info("Choisis la Page Facebook liée à ton compte Instagram Business.")
    page_names = {p["name"]: p["id"] for p in pages}
    selected_name = st.selectbox("Page Facebook", options=list(page_names.keys()), key="connect_fb_page")
    if st.button("Confirmer la connexion", type="primary", key="btn_confirm_page"):
        st.session_state["selected_fb_page_id"] = page_names[selected_name]
        try:
            org = OrganicInstagramm(
                meta_long_token=token,
                supabase_client=client,
                supabase_user_id=user_id,
            )
            org._fetch_id_instagram()
            org._fetch_id_business()
            existing = client.table("connected_accounts").select("id").eq("user_id", user_id).eq("instagram_business_id", org.meta_id_business).execute()
            if existing.data:
                new_account_id = existing.data[0]["id"]
                client.table("connected_accounts").update({
                    "meta_token": token,
                    "account_name": org.meta_account_name,
                }).eq("id", new_account_id).execute()
            else:
                acc = client.table("connected_accounts").insert({
                    "user_id": user_id,
                    "meta_token": token,
                    "account_name": org.meta_account_name,
                    "instagram_business_id": org.meta_id_business,
                }).execute()
                new_account_id = acc.data[0]["id"]
            client.table("profiles").update({"active_account_id": new_account_id}).eq("id", user_id).execute()
            del st.session_state["_save_meta_token"]
            st.session_state.pop("fb_pages_list", None)
            st.success(f"Compte '{org.meta_account_name}' connecté !")
            st.rerun()
        except Exception as e:
            st.error(f"Erreur connexion Meta : {e}")
    st.stop()
    return True


def handle_stripe_payment(client, user_id, session):
    """Vérifie le retour Stripe et met à jour is_paid."""
    if st.query_params.get("payment") == "success" and "session_id" in st.query_params:
        session_id = st.query_params["session_id"]
        stripe.api_key = st.secrets.stripe.api_key
        is_paid = False
        try:
            s = stripe.checkout.Session.retrieve(session_id)
            if s.payment_status == "paid":
                client.table("profiles").update({"is_paid": True}).eq("id", user_id).execute()
                is_paid = True
                if "checkout_url" in st.session_state:
                    del st.session_state["checkout_url"]
                st.success("Paiement confirmé ! Bienvenue dans le plan Pro.")
            else:
                st.warning(f"Statut paiement : {s.payment_status}. Contactez le support.")
        except Exception as e:
            st.error(f"Erreur vérification Stripe : {type(e).__name__}: {e}")
        st.query_params.clear()
        st.query_params["refresh_token"] = session.refresh_token
        return is_paid
    elif st.query_params.get("payment") == "cancelled":
        st.info("Paiement annulé.")
        st.query_params.clear()
        st.query_params["refresh_token"] = session.refresh_token
    return None
