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


# ── Connexion à reconnecter — écrit par la récolte quand un jeton est mort ────

def marquer_a_reconnecter(supabase: Client, user_id: str, connexion: dict, raison: str,
                          *, maintenant=None) -> bool:
    """Marque UNE ligne `connected_accounts` « à reconnecter » ; True si écrite.

    `a_reconnecter_depuis` est la date du PREMIER passage qui a trouvé le jeton
    mort : c'est elle qui mesure la panne (migration §4bis). PostgREST ne sait
    pas écrire `coalesce(a_reconnecter_depuis, now())` dans un update, donc on
    ne l'envoie que si la valeur lue au même passage était vide. La raison,
    elle, est toujours la dernière dite par la plateforme.

    Le compte de lignes touchées est vérifié : un update refusé ou mal filtré
    ne lève rien, il touche zéro ligne (CLAUDE.md §8).
    """
    from datetime import datetime, timezone
    champs: dict = {}
    if not connexion.get("a_reconnecter_depuis"):
        champs["a_reconnecter_depuis"] = (maintenant or datetime.now(timezone.utc)).isoformat()
    champs["a_reconnecter_raison"] = raison
    r = (supabase.table("connected_accounts").update(champs)
         .eq("id", connexion["id"]).eq("user_id", user_id).execute())
    return bool(r.data)


# ── Instagram — la date du dernier passage complet (trimestriel) ──────────────
#
# Spec § La récolte — Ce qui s'ajoute, « La relecture » : tous les 3 mois, tous
# les posts en base. Le cron la décide sur cette date MESURÉE — posée après un
# passage réussi, par connexion (`connected_accounts.relecture_instagram_le`,
# migration §23) — jamais devinée d'un calendrier.

class ColonneRelectureAbsente(Exception):
    """La section 23 de la migration n'est pas jouée : la date ne se lit ni ne s'écrit."""


def _colonne_relecture_absente(err: Exception) -> bool:
    """42703 au `select`, PGRST204 à l'`update` d'une colonne inconnue."""
    msg = str(err)
    return "relecture_instagram_le" in msg and any(
        code in msg for code in ("42703", "PGRST204", "does not exist", "Could not find"))


def dates_de_relecture_instagram(supabase: Client, user_id: str) -> dict:
    """`{id de connexion: relecture_instagram_le}` des connexions du compte.

    Lève `ColonneRelectureAbsente` si la colonne manque : une date illisible
    n'est pas une date nulle, et le cron ne doit pas relire tous les jours."""
    try:
        lignes = (supabase.table("connected_accounts").select("id, relecture_instagram_le")
                  .eq("user_id", user_id).execute().data) or []
    except Exception as e:
        if _colonne_relecture_absente(e):
            raise ColonneRelectureAbsente from e
        raise
    return {r["id"]: r.get("relecture_instagram_le") for r in lignes}


def noter_relecture_instagram(supabase: Client, user_id: str, connexion_id, quand) -> bool:
    """Pose la date du passage complet sur UNE connexion ; True si écrite.

    Zéro ligne touchée ne lève rien (`CLAUDE.md` §8) : le booléen le dit."""
    try:
        r = (supabase.table("connected_accounts")
             .update({"relecture_instagram_le": quand.isoformat()})
             .eq("id", connexion_id).eq("user_id", user_id).execute())
    except Exception as e:
        if _colonne_relecture_absente(e):
            raise ColonneRelectureAbsente from e
        raise
    return bool(r.data)


def dater_premiere_relecture_instagram(supabase: Client, user_id: str, connexion_id,
                                       quand) -> bool:
    """Pose la date du passage complet sur UNE connexion qui n'en a PAS ; True si écrite.

    Le filtre `IS NULL` est dans l'`update` lui-même : une date déjà posée (le
    trimestriel, la main) ne bouge pas, sans lecture préalable qui pourrait
    se périmer. False = déjà datée, ou zéro ligne touchée (`CLAUDE.md` §8)."""
    try:
        r = (supabase.table("connected_accounts")
             .update({"relecture_instagram_le": quand.isoformat()})
             .eq("id", connexion_id).eq("user_id", user_id)
             .is_("relecture_instagram_le", "null").execute())
    except Exception as e:
        if _colonne_relecture_absente(e):
            raise ColonneRelectureAbsente from e
        raise
    return bool(r.data)


# ── Instagram — le premier passage d'un compte est-il fait ? ──────────────────
#
# Spec § La récolte, « Au premier passage d'un compte » : 90 jours et la
# remontée des abonnés. Revue de code de instagram-construction : la détection
# « une ligne plus ancienne qu'avant-hier » donnait le premier passage pour
# fait sans dire qu'il avait réussi, et un passage entièrement en panne ne se
# reprenait jamais. Le marqueur (`premier_passage_instagram_le`, migration §23)
# n'est posé que si la remontée a écrit au moins un jour plus ancien
# qu'avant-hier ; tant qu'il est NULL, le premier passage est retenté chaque jour.

class ColonnePremierPassageAbsente(Exception):
    """La section 23 n'est pas jouée : le marqueur ne se lit ni ne s'écrit."""


def _colonne_premier_passage_absente(err: Exception) -> bool:
    msg = str(err)
    return "premier_passage_instagram_le" in msg and any(
        code in msg for code in ("42703", "PGRST204", "does not exist", "Could not find"))


def premier_passage_instagram_le(supabase: Client, user_id: str, connexion_id) -> str | None:
    """La date du premier passage réussi d'UNE connexion, ou None s'il reste à faire.

    Lève `ColonnePremierPassageAbsente` si la colonne manque : un marqueur
    illisible n'est pas un marqueur nul — le prendre pour tel relancerait les
    quelque 130 appels du premier passage chaque jour, sans jamais rien noter."""
    try:
        lignes = (supabase.table("connected_accounts")
                  .select("id, premier_passage_instagram_le")
                  .eq("id", connexion_id).eq("user_id", user_id).execute().data) or [{}]
    except Exception as e:
        if _colonne_premier_passage_absente(e):
            raise ColonnePremierPassageAbsente from e
        raise
    return lignes[0].get("premier_passage_instagram_le")


def noter_premier_passage_instagram(supabase: Client, user_id: str, connexion_id, quand) -> bool:
    """Pose le marqueur du premier passage sur UNE connexion ; True si écrit.

    Zéro ligne touchée ne lève rien (`CLAUDE.md` §8) : le booléen le dit."""
    try:
        r = (supabase.table("connected_accounts")
             .update({"premier_passage_instagram_le": quand.isoformat()})
             .eq("id", connexion_id).eq("user_id", user_id).execute())
    except Exception as e:
        if _colonne_premier_passage_absente(e):
            raise ColonnePremierPassageAbsente from e
        raise
    return bool(r.data)


# ── Instagram — où en est le Rattrapage, par connexion ────────────────────────
#
# Spec § La récolte — Ce qui s'ajoute, « Le Rattrapage » : un bloc par passage
# quotidien, du plus récent au plus ancien. Le curseur de pagination de
# l'inventaire se garde entre deux passages (`rattrapage_instagram_curseur`,
# NULL = reprendre au haut), et la fin se date (`rattrapage_instagram_fini_le`,
# posée quand Meta ne rend plus de page). Migration §23, ticket 08.

class ColonneRattrapageAbsente(Exception):
    """La section 23 n'est pas jouée : l'état du Rattrapage ne se lit ni ne s'écrit."""


def _colonne_rattrapage_absente(err: Exception) -> bool:
    msg = str(err)
    return "rattrapage_instagram_" in msg and any(
        code in msg for code in ("42703", "PGRST204", "does not exist", "Could not find"))


def etat_du_rattrapage(supabase: Client, user_id: str, connexion_id) -> dict:
    """`{rattrapage_instagram_curseur, rattrapage_instagram_fini_le}` d'UNE connexion.

    Lève `ColonneRattrapageAbsente` si les colonnes manquent : un curseur
    illisible n'est pas un curseur nul — le prendre pour tel relirait le haut
    de l'inventaire chaque jour sans jamais avancer."""
    try:
        lignes = (supabase.table("connected_accounts")
                  .select("id, rattrapage_instagram_curseur, rattrapage_instagram_fini_le")
                  .eq("id", connexion_id).eq("user_id", user_id).execute().data) or [{}]
    except Exception as e:
        if _colonne_rattrapage_absente(e):
            raise ColonneRattrapageAbsente from e
        raise
    return {"rattrapage_instagram_curseur": lignes[0].get("rattrapage_instagram_curseur"),
            "rattrapage_instagram_fini_le": lignes[0].get("rattrapage_instagram_fini_le")}


def noter_rattrapage(supabase: Client, user_id: str, connexion_id, curseur: str | None,
                     fini_le=None) -> bool:
    """Écrit où reprendre (et la fin, si elle est atteinte) ; True si écrit.

    Zéro ligne touchée ne lève rien (`CLAUDE.md` §8) : le booléen le dit."""
    champs = {"rattrapage_instagram_curseur": curseur,
              "rattrapage_instagram_fini_le": fini_le.isoformat() if fini_le else None}
    try:
        r = (supabase.table("connected_accounts").update(champs)
             .eq("id", connexion_id).eq("user_id", user_id).execute())
    except Exception as e:
        if _colonne_rattrapage_absente(e):
            raise ColonneRattrapageAbsente from e
        raise
    return bool(r.data)
