import streamlit as st
from supabase import Client

from scripts.insert_data import insert_schedule_data

def schedule(supabase:Client, user_id):
     with st.sidebar:
            fetch_schedule = st.selectbox("Jours de mise à jour (à 07:00 UTC)", options=["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"])
            if st.button("save"):
                insert_schedule_data(supabase=supabase, user_id=user_id, fetch_schedule=fetch_schedule)