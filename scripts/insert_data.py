from supabase import Client


def insert_instagramm_org(supabase: Client, results):
    supabase.table("instagram_organic_posts").upsert(results, on_conflict="post_id").execute()
