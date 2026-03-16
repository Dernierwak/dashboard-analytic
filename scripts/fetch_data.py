from supabase import Client


def fetch_post_metrics(supabase: Client):
    return supabase.rpc("get_my_posts").execute().data


def fetch_daily_followers(supabase: Client, user_id: str):
    return supabase.table("followers_history").select("*").eq("user_id", user_id).order("fetched_at").execute().data
