from supabase import Client
import streamlit as st


def insert_free_data(supabase: Client, user_id):
    insta_input = st.text_input("Add the nb likes from insta", key="insta_input")    
    add_data = st.button("add_data")
    if add_data and insta_input:
        supabase.table("free_data").insert({
            "insta_likes": insta_input,
            "user_id": user_id
        }).execute()
        del st.session_state["insta_input"]
        st.rerun()