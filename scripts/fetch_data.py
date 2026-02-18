from supabase import Client
import streamlit as st

def fetch_free_data(supabase:Client):
    return supabase.table("free_data").select("insta_likes").execute()
