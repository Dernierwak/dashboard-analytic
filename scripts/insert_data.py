from supabase import Client
from datetime import date, timedelta


def insert_instagram_org(supabase: Client, results):
    supabase.table("instagram_organic_posts").upsert(results, on_conflict="post_id").execute()


def insert_instagram_total_posts_id(supabase: Client, user_id, total_posts_id):
    supabase.table("connected_accounts").update({"total_posts_id_instagram": total_posts_id}).eq("user_id", user_id).execute()
    
    
def insert_schedule_data(supabase:Client, user_id, fetch_schedule):
    supabase.table("profiles").update({"fetch_schedule": fetch_schedule}).eq("id", user_id).execute()


def upsert_meta_ads(supabase: Client, user_id: str, rows: list[dict]):
    """Upsert des données Meta Ads dans meta_ads_insights.
    Conflict sur (user_id, date_start, ad_name) — une ligne par pub par jour.
    """
    if not rows:
        return

    seen = set()
    records = []
    for row in rows:
        key = (row.get("date_start"), row.get("ad_name", ""))
        if key in seen:
            continue
        seen.add(key)
        records.append({
            "user_id": user_id,
            "date_start": row.get("date_start"),
            "campaign_name": row.get("campaign_name", ""),
            "adset_name": row.get("adset_name", ""),
            "ad_name": row.get("ad_name", ""),
            "impressions": int(row.get("impressions") or 0),
            "clicks": int(row.get("clicks") or 0),
            "reach": int(row.get("reach") or 0) if row.get("reach") is not None else None,
            "link_clicks": int(row.get("link_clicks") or 0) if row.get("link_clicks") is not None else None,
            "spend": float(row.get("spend") or 0),
        })

    supabase.table("meta_ads_insights").upsert(
        records,
        on_conflict="user_id,date_start,ad_name"
    ).execute()
