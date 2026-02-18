from supabase import Client, ClientOptions
import streamlit as st
import pandas as pd

##############################
# My Funciton
##############################
from scripts.fetch_data import fetch_free_data
from scripts.insert_data import insert_free_data

from meta_script.fetch_token import get_oauth_url, exchange_code_for_token





class Dashboard():
    
    def __init__(self):
        self.url = st.secrets.supabase.url
        self.token = st.secrets.supabase.key
        self.supabase = Client(self.url, self.token)
        self.client = None
        self.email: str | None = None
        self.password: str | None = None
        self.user: str | None = None

    def _authentification(self):
        self.user = self.supabase.auth.sign_up(
            {
                "email": self.email,
                "password": self.password
            })
        if self.user:
            st.session_state["session"] = self.user.session
            st.query_params["refresh_token"] = self.user.session.refresh_token
            st.rerun()
            
    def _sign_up(self):
        self.user = self.supabase.auth.sign_in_with_password(
            {
                "email": self.email,
                "password": self.password
            }
        )
        if self.user:
            st.session_state["session"] = self.user.session
            st.query_params["refresh_token"] = self.user.session.refresh_token
            st.rerun()
        
    def _auth_page(self):
        st.header("You can connect you")
        self.email = st.text_input("Email")
        self.password = st.text_input("Password", type="password")
        col1, col2 = st.columns(2)
        with col1:
            submit = st.button("creat account")
        
        with col2:
            sign_up = st.button("connect to your account")
    
        if submit:
            self._authentification()
        if sign_up:
            self._sign_up()
    
    def _login_page(self):
        st.header("Logged")
        session = st.session_state["session"]
        self.client = Client(self.url, self.token, options=ClientOptions(headers={"Authorization": f"Bearer {session.access_token}"}))
        with st.sidebar:
            st.subheader("Account Info")
            st.markdown(f"**User E-mail:**  \n{session.user.email}")
            st.markdown(f"**User ID:**  \n{session.user.id}")
            disconnect = st.button("disconnect")
        if disconnect:
            del st.session_state["session"]
            if "refresh_token" in st.query_params:
                del st.query_params["refresh_token"]
            st.rerun()
            
    def main(self):
        if "session" not in st.session_state and "refresh_token" in st.query_params:
            try:
                refresh_token = st.query_params.refresh_token
                user = self.supabase.auth.refresh_session(refresh_token=refresh_token)
                st.session_state["session"] = user.session
            except Exception:
                del st.query_params["refresh_token"]
                
        if "session" in st.session_state:
            self._login_page()
        else:
            self._auth_page()
            


if __name__ == "__main__":
    # 1. Gérer le callback OAuth Meta (prioritaire)
    if "code" in st.query_params and "session" in st.session_state:
        code = st.query_params["code"]
        with st.spinner("Connexion Meta..."):
            data = exchange_code_for_token(code)
        if "access_token" in data:
            st.session_state["meta_token"] = data["access_token"]
            st.session_state["_save_meta_token"] = True
            # Restaurer le refresh_token dans l'URL après OAuth
            session = st.session_state["session"]
            st.query_params.clear()
            st.query_params["refresh_token"] = session.refresh_token
            st.success("Meta connecté!")
            st.rerun()
        else:
            st.error(f"Erreur Meta: {data}")
            del st.query_params["code"]

    # 2. App principale
    dash = Dashboard()
    dash.main()
    client = dash.client

    if client:
        data = fetch_free_data(client).data
        st.data_editor(data)

        if "session" in st.session_state:
            session = st.session_state["session"]
            user_id = session.user.id
            insert_free_data(client, user_id=user_id)

            # Sauvegarder meta_token dans profiles si vient d'être obtenu
            if st.session_state.get("_save_meta_token"):
                client.table("profiles").update({"meta_token": st.session_state["meta_token"]}).eq("id", user_id).execute()
                del st.session_state["_save_meta_token"]

            # Charger meta_token depuis profiles si pas en session
            if "meta_token" not in st.session_state:
                profile = client.table("profiles").select("meta_token").eq("id", user_id).execute()
                if profile.data and profile.data[0].get("meta_token"):
                    st.session_state["meta_token"] = profile.data[0]["meta_token"]

            # Section Meta dans la sidebar
            with st.sidebar:
                st.divider()
                if "meta_token" in st.session_state:
                    st.success("Meta connecté")
                    if st.button("Déconnecter Meta"):
                        client.table("profiles").update({"meta_token": None}).eq("id", user_id).execute()
                        del st.session_state["meta_token"]
                        st.rerun()
                else:
                    st.link_button("Connecter Meta", get_oauth_url())