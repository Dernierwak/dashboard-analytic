from supabase import Client
from datetime import date, timedelta


def fetch_post_metrics(supabase: Client, user_id: str):
    return supabase.table("instagram_organic_posts").select("*").eq("user_id", user_id).execute().data


def fetch_daily_followers(supabase: Client, user_id: str):
    return supabase.table("followers_history").select("*").eq("user_id", user_id).order("fetched_at").execute().data


def fetch_meta_ads_latest_date(supabase: Client, user_id: str) -> str | None:
    """Retourne la date la plus récente dans meta_ads_insights pour cet user."""
    result = (
        supabase.table("meta_ads_insights")
        .select("date_start")
        .eq("user_id", user_id)
        .order("date_start", desc=True)
        .limit(1)
        .execute()
    )
    if result.data:
        return result.data[0]["date_start"]
    return None


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


# ── Tab Coût — labels & budgets ────────────────────────────────────────────────

def fetch_campaign_labels(supabase: Client, user_id: str) -> list[str]:
    """Master list des labels de campagne (stockée dans profiles.campaign_labels)."""
    try:
        res = supabase.table("profiles").select("campaign_labels").eq("id", user_id).execute()
        if res.data and res.data[0].get("campaign_labels"):
            return list(res.data[0]["campaign_labels"])
    except Exception:
        pass
    return []


def fetch_meta_budget_global(supabase: Client, user_id: str) -> float:
    """Budget global Meta Ads (stocké dans profiles.meta_budget_global)."""
    try:
        res = supabase.table("profiles").select("meta_budget_global").eq("id", user_id).execute()
        if res.data:
            return float(res.data[0].get("meta_budget_global") or 0)
    except Exception:
        pass
    return 0.0


def fetch_campaign_config(supabase: Client, user_id: str) -> dict[str, dict]:
    """Retourne {campaign_name: {"label": str|None, "budget_max": float, "effective_status": str|None}}."""
    try:
        res = (
            supabase.table("meta_campaign_config")
            .select("campaign_name, label, budget_max, effective_status")
            .eq("user_id", user_id)
            .execute()
        )
        return {
            row["campaign_name"]: {
                "label": row.get("label"),
                "budget_max": float(row.get("budget_max") or 0),
                "effective_status": row.get("effective_status"),
            }
            for row in (res.data or [])
        }
    except Exception:
        return {}
