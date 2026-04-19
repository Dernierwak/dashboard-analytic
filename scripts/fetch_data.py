from supabase import Client
from datetime import date, timedelta


def fetch_post_metrics(supabase: Client, user_id: str):
    return supabase.table("instagram_organic_posts").select("*").eq("user_id", user_id).execute().data


def fetch_daily_followers(supabase: Client, user_id: str):
    return supabase.table("followers_history").select("*").eq("user_id", user_id).order("fetched_at").execute().data


def fetch_meta_ads(supabase: Client, user_id: str, months: int = 6) -> list[dict]:
    """Récupère les données Meta Ads des X derniers mois pour un utilisateur."""
    since = (date.today() - timedelta(days=30 * months)).isoformat()
    return (
        supabase.table("meta_ads_insights")
        .select("*")
        .eq("user_id", user_id)
        .gte("date_start", since)
        .order("date_start", desc=True)
        .execute()
        .data
    )
