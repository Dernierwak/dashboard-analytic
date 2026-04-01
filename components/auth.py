from supabase import Client, ClientOptions
import streamlit as st


class Dashboard():

    def __init__(self):
        self.url = st.secrets.supabase.url
        self.token = st.secrets.supabase.key
        self.supabase = Client(self.url, self.token)
        self.client = None

    def _create_account(self, email, password):
        try:
            user = self.supabase.auth.sign_up({"email": email, "password": password})
            if user.session:
                st.session_state["session"] = user.session
                st.query_params["refresh_token"] = user.session.refresh_token
                st.rerun()
            elif user.user and user.user.identities is not None and len(user.user.identities) == 0:
                st.error("Un compte existe déjà avec cet email. Connectez-vous.")
            else:
                st.session_state["email_confirmation_pending"] = email
        except Exception as e:
            st.error(f"Erreur lors de la création du compte : {e}")

    def _login(self, email, password):
        try:
            user = self.supabase.auth.sign_in_with_password({"email": email, "password": password})
            if user.session:
                st.session_state["session"] = user.session
                st.query_params["refresh_token"] = user.session.refresh_token
                st.rerun()
        except Exception as e:
            if "email not confirmed" in str(e).lower():
                st.session_state["email_confirmation_pending"] = email
            else:
                st.error("Identifiants incorrects.")

    def _auth_page(self):
        _, col, _ = st.columns([1, 2, 1])
        with col:
            if "email_confirmation_pending" in st.session_state:
                email = st.session_state["email_confirmation_pending"]
                st.info(f"Un email de confirmation a été envoyé à **{email}**. Cliquez sur le lien dans votre boîte mail, puis revenez vous connecter.")
                if st.button("J'ai confirmé mon email", width="stretch"):
                    del st.session_state["email_confirmation_pending"]
                    st.rerun()
                return

            email = st.text_input("Email")
            password = st.text_input("Mot de passe", type="password")
            col_a, col_b = st.columns(2)
            with col_a:
                if st.button("Créer un compte", width="stretch"):
                    self._create_account(email, password)
            with col_b:
                if st.button("Se connecter", width="stretch", type="primary"):
                    self._login(email, password)

    def main(self):
        if "session" not in st.session_state and "refresh_token" in st.query_params:
            try:
                user = self.supabase.auth.refresh_session(refresh_token=st.query_params["refresh_token"])
                st.session_state["session"] = user.session
            except Exception:
                del st.query_params["refresh_token"]

        if "session" in st.session_state:
            session = st.session_state["session"]
            self.client = Client(
                self.url, self.token,
                options=ClientOptions(headers={"Authorization": f"Bearer {session.access_token}"})
            )
        else:
            self._auth_page()
