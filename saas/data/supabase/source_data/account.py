"""Réglages et état primaire du compte stockés dans Supabase."""

from supabase import Client


def insert_schedule_data(supabase:Client, user_id, fetch_schedule):
    supabase.table("profiles").update({"fetch_schedule": fetch_schedule}).eq("id", user_id).execute()


# ── Tab Coût — budgets ─────────────────────────────────────────────────────────

def upsert_channel_budget(supabase: Client, user_id: str, channel: str, month_iso: str, amount: float) -> None:
    """Budget mensuel d'un canal (channel_budgets). month_iso = 'YYYY-MM-01'."""
    supabase.table("channel_budgets").upsert(
        {
            "user_id": user_id,
            "channel": channel,
            "month": month_iso,
            "amount": float(amount or 0),
        },
        on_conflict="user_id,channel,month",
    ).execute()


def update_meta_budget_global(supabase: Client, user_id: str, value: float) -> None:
    """Budget global → profiles.meta_budget_global."""
    supabase.table("profiles").update({"meta_budget_global": float(value or 0)}).eq("id", user_id).execute()


# ── Google Ads — helpers ──────────────────────────────────────────────────────

def update_google_budget_global(supabase: Client, user_id: str, value: float) -> None:
    supabase.table("profiles").update({"google_budget_global": float(value or 0)}).eq("id", user_id).execute()


def upsert_google_campaign_config(
    supabase: Client,
    user_id: str,
    campaign_id: str,
    *,
    campaign_name: str | None = None,
    budget_max: float | None = None,
    effective_status: str | None = None,
) -> None:
    payload: dict = {"user_id": user_id, "campaign_id": str(campaign_id)}
    if campaign_name is not None:
        payload["campaign_name"] = campaign_name
    if budget_max is not None:
        payload["budget_max"] = float(budget_max or 0)
    if effective_status is not None:
        payload["effective_status"] = effective_status or None
    supabase.table("google_campaign_config").upsert(
        payload, on_conflict="user_id,campaign_id"
    ).execute()


def _upsert_google_account(supabase: Client, user_id: str, payload: dict) -> None:
    """Crée ou met à jour la ligne connected_accounts provider='google' (1 par user).

    Tous les tokens Google (Ads + GA4) vivent ici, plus sur profiles.
    """
    existing = (
        supabase.table("connected_accounts")
        .select("id")
        .eq("user_id", user_id)
        .eq("provider", "google")
        .limit(1)
        .execute()
    )
    if existing.data:
        supabase.table("connected_accounts").update(payload).eq("id", existing.data[0]["id"]).execute()
    else:
        supabase.table("connected_accounts").insert(
            {"user_id": user_id, "provider": "google", "account_name": "Google", **payload}
        ).execute()


def update_google_refresh_token(supabase: Client, user_id: str, refresh_token: str, customer_id: str | None = None) -> None:
    """Stocke le refresh_token OAuth Google + le customer_id du compte sélectionné
    (connected_accounts, provider='google')."""
    payload = {"google_refresh_token": refresh_token}
    if customer_id:
        payload["google_customer_id"] = str(customer_id)
    _upsert_google_account(supabase, user_id, payload)


# ── Google Analytics 4 (GA4) — helpers ────────────────────────────────────────

def update_ga4_property_id(supabase: Client, user_id: str, property_id: str | None) -> None:
    """Stocke le GA4 Property ID sélectionné (ex. 'properties/123456789')
    sur la ligne connected_accounts provider='google'."""
    _upsert_google_account(
        supabase, user_id,
        {"ga4_property_id": str(property_id) if property_id else None},
    )


# ── Boucle de feedback (rapport hebdo) — helpers ──────────────────────────────

def update_objectif(supabase: Client, user_id: str, objectif: str | None) -> None:
    """Stocke l'objectif principal du compte ('ventes'|'notoriete'|'engagement'|None)."""
    supabase.table("profiles").update(
        {"objectif": objectif or None}
    ).eq("id", user_id).execute()


def save_user_profile(supabase: Client, user_id: str, profile_text: str | None) -> None:
    """Stocke le persona utilisateur dérivé par l'IA (profiles.user_profile)."""
    from datetime import datetime, timezone
    supabase.table("profiles").update(
        {
            "user_profile": (profile_text or "").strip() or None,
            "user_profile_updated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", user_id).execute()
