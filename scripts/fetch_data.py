from supabase import Client
import streamlit as st


def fetch_free_data(supabase: Client):
    return supabase.table("free_data").select("insta_likes").execute()


def fetch_post_metrics(supabase: Client, user_id: str):
    return supabase.table("post_metrics").select("*").eq("user_id", user_id).order("likes", desc=True).execute()
