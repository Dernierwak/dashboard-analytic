import streamlit as st
from supabase import Client

from scripts.insert_data import insert_schedule_data

def schedule(supabase: Client, user_id, has_fetched: bool = False):
    with st.sidebar:
        options = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        current = st.session_state.get("fetch_schedule")
        index = options.index(current) if current in options else 0
        fetch_schedule = st.selectbox("Jours de mise à jour (à 07:00 UTC)", options=options, index=index)
        if st.button("Save"):
            st.session_state["fetch_schedule"] = fetch_schedule
            insert_schedule_data(supabase=supabase, user_id=user_id, fetch_schedule=fetch_schedule)

        if st.button("Récupérer mes données", type="primary"):
            st.session_state["trigger_fetch"] = True
            st.rerun()
        if has_fetched:
            day = st.session_state.get("fetch_schedule", fetch_schedule)
            st.caption(f"Mise à jour automatique chaque {day} à 07:00 UTC")