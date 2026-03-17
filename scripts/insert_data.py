from supabase import Client


def insert_instagram_org(supabase: Client, results):
    supabase.table("instagram_organic_posts").upsert(results, on_conflict="post_id").execute()


def insert_instagram_total_posts_id(supabase: Client, user_id, total_posts_id):
    supabase.table("connected_accounts").update({"total_posts_id_instagram": total_posts_id}).eq("user_id", user_id).execute()
    
    
def insert_schedule_data(supabase:Client, user_id, fetch_schedule):
    supabase.table("profiles").update({"fetch_timer_schedule": fetch_schedule}).eq("id", user_id).execute()
    