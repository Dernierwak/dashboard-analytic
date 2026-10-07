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


def upsert_weekly_report(supabase: Client, user_id: str, week_start_iso: str, payload: dict) -> None:
    """Publie le rapport hebdo précalculé (payload JSON) — lu par Pulse + l'email hebdo."""
    from datetime import datetime, timezone
    supabase.table("weekly_reports").upsert(
        {
            "user_id": user_id,
            "week_start": week_start_iso,
            "payload": payload,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        on_conflict="user_id,week_start",
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


# CE QU'EST DEVENU L'EMAIL HEBDO (ticket 50). Deux écritures, à une semaine
# d'écart : l'envoi au moment où il part, l'événement au passage suivant du
# worker. Elles restent séparées parce que la seconde ne doit jamais pouvoir
# réécrire la première — `maj_evenement_email` fait un `update`, pas un upsert,
# donc un relevé arrivé sur une ligne disparue ne ressuscite pas un envoi.
def upsert_envoi_email(supabase: Client, user_id: str, week_start_iso: str,
                       envoi: dict) -> None:
    """Range l'envoi hebdo — `envoi` est le dict rendu par `send_email`.

    UNE LIGNE EST ÉCRITE MÊME EN DRY-RUN ET MÊME EN ÉCHEC, et c'est le point.
    Sans elle, une semaine où rien n'est parti serait indiscernable d'une
    semaine où le client n'a pas ouvert — on conclurait « il ignore ses emails »
    sur un email qui n'a jamais quitté la machine (`CLAUDE.md` §7).

    Ne lève jamais : l'email est parti, c'est le fait qui compte pour le
    client. Perdre sa trace ne doit pas faire échouer la publication du
    rapport qui vient de réussir.
    """
    from datetime import datetime, timezone
    try:
        supabase.table("email_envois").upsert(
            {
                "user_id": user_id,
                "week_start": week_start_iso,
                "fournisseur": envoi.get("provider") or "?",
                "message_id": envoi.get("id") or None,
                # UN DRY-RUN N'EST PAS UN ENVOI RÉUSSI. `send_email` rend
                # `ok: True` en mode `dry` — il veut dire « la fonction a fait
                # ce qu'on lui demandait », pas « l'email est parti ». Le
                # recopier tel quel ferait compter, dans un futur « quelles
                # semaines l'email est-il parti ? », une semaine où rien n'a
                # quitté la machine (`CLAUDE.md` §7).
                "envoi_ok": bool(envoi.get("ok")) and envoi.get("provider") != "dry",
                "envoye_a": datetime.now(timezone.utc).isoformat(),
                # Un nouvel envoi remplace la ligne de la semaine : le relevé de
                # l'envoi précédent ne vaut plus pour celui-ci.
                "dernier_evenement": None,
                "releve_a": None,
            },
            on_conflict="user_id,week_start",
        ).execute()
    except Exception as e:
        print(f"   (envoi email non rangé : {e})")


def maj_evenement_email(supabase: Client, user_id: str, week_start_iso: str,
                        evenement: str | None) -> None:
    """Range ce que le fournisseur a remonté sur cet envoi, tel quel.

    `releve_a` est posé MÊME QUAND `evenement` est None : « on a demandé et
    rien n'est venu » et « on n'a pas encore demandé » sont deux états
    différents, et les confondre ferait redemander chaque semaine un fait que
    le fournisseur ne rendra jamais.
    """
    from datetime import datetime, timezone
    try:
        res = (supabase.table("email_envois").update({
            "dernier_evenement": evenement or None,
            "releve_a": datetime.now(timezone.utc).isoformat(),
        }).eq("user_id", user_id).eq("week_start", week_start_iso).execute())
        # UN `update` QUI NE TOUCHE AUCUNE LIGNE NE LÈVE RIEN (`CLAUDE.md` §8).
        # Ici ce n'est pas un refus RLS — le worker écrit en service_role — mais
        # une ligne disparue entre l'envoi et le relevé. On le dit plutôt que de
        # laisser croire que le fait est rangé.
        if not res.data:
            print(f"   (relevé d'ouverture : aucune ligne {week_start_iso} à mettre "
                  f"à jour — l'envoi n'a jamais été rangé)")
    except Exception as e:
        print(f"   (relevé d'ouverture non rangé : {e})")
