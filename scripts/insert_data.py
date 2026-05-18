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


# ── Tab Coût — labels & budgets ────────────────────────────────────────────────

def update_campaign_labels(supabase: Client, user_id: str, labels: list[str]) -> None:
    """Master list des labels de campagne → profiles.campaign_labels."""
    clean = [str(l).strip() for l in labels if str(l).strip()]
    supabase.table("profiles").update({"campaign_labels": clean}).eq("id", user_id).execute()


def update_meta_budget_global(supabase: Client, user_id: str, value: float) -> None:
    """Budget global → profiles.meta_budget_global."""
    supabase.table("profiles").update({"meta_budget_global": float(value or 0)}).eq("id", user_id).execute()


def upsert_campaign_config(
    supabase: Client,
    user_id: str,
    campaign_name: str,
    *,
    label: str | None = None,
    budget_max: float | None = None,
    effective_status: str | None = None,
) -> None:
    """Upsert ligne meta_campaign_config. Met à jour seulement les champs fournis."""
    payload: dict = {"user_id": user_id, "campaign_name": campaign_name}
    if label is not None:
        payload["label"] = label if label else None
    if budget_max is not None:
        payload["budget_max"] = float(budget_max or 0)
    if effective_status is not None:
        payload["effective_status"] = effective_status or None
    supabase.table("meta_campaign_config").upsert(
        payload, on_conflict="user_id,campaign_name"
    ).execute()


def upsert_campaign_statuses(
    supabase: Client,
    user_id: str,
    status_map: dict[str, str],
) -> None:
    """Met à jour effective_status pour toutes les campagnes d'un coup.
    status_map : {campaign_name: effective_status}
    """
    if not status_map:
        return
    records = [
        {"user_id": user_id, "campaign_name": name, "effective_status": status or None}
        for name, status in status_map.items() if name
    ]
    if records:
        supabase.table("meta_campaign_config").upsert(
            records, on_conflict="user_id,campaign_name"
        ).execute()


def rename_campaign_label(supabase: Client, user_id: str, old_label: str, new_label: str) -> None:
    """Renomme un label dans toutes les lignes meta_campaign_config de l'utilisateur."""
    supabase.table("meta_campaign_config").update({"label": new_label}).eq("user_id", user_id).eq("label", old_label).execute()


def clear_campaign_label(supabase: Client, user_id: str, label: str) -> None:
    """Met à NULL le label dans meta_campaign_config (utilisé quand on supprime un label)."""
    supabase.table("meta_campaign_config").update({"label": None}).eq("user_id", user_id).eq("label", label).execute()
