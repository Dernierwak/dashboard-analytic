from supabase import Client, ClientOptions
import streamlit as st


def _reset_password_email(supabase:Client):
    email = st.text_input("Your Email")
    
    if st.button("reset password"):
        supabase.auth.reset_password_email(email=email)
        st.session_state["reset_password"] = True
        st.rerun()
    


def _update_password_email(supabase:Client):
    if st.session_state.get("reset_password"):
        new_password = st.text_input("Ajouter le new password")
        if new_password:
            response = supabase.auth.update_user(
                {
                    "password":new_password
                }
            )