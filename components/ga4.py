"""GA4 — orchestration du fetch + helper de contexte pour le moteur de recos.

Mirror de components/google_ads.py mais pour Google Analytics 4.
Réutilise le refresh_token Google déjà stocké (profiles.google_refresh_token).
"""

from datetime import date, timedelta

from google_script.fetch_token import get_access_token_from_refresh
from google_script.fetch_ga4 import fetch_ga4_insights, fetch_ga4_events, FUNNEL_EVENTS
from scripts.fetch_data import (
    fetch_ga4_latest_date,
    fetch_ga4_insights as db_fetch_ga4,
    fetch_ga4_events as db_fetch_ga4_events,
)
from scripts.insert_data import upsert_ga4_insights, upsert_ga4_events


def run_ga4_fetch(
    supabase,
    user_id: str,
    refresh_token: str,
    property_id: str,
    force_full: bool = False,
    progress_cb=None,
    since_date=None,
) -> dict:
    """Fetch GA4 (jour × source/medium) et sauvegarde Supabase.
    since_date : date de départ explicite (pop-up « Mes données ») — prime sur tout.
    Returns: {success, rows, message}
    """
    def _p(pct, txt):
        if progress_cb:
            try:
                progress_cb(pct, txt)
            except Exception:
                pass

    _p(5, "Authentification Google…")
    access_token = get_access_token_from_refresh(refresh_token)
    if not access_token:
        return {"success": False, "rows": 0, "message": "Refresh token invalide. Reconnecte-toi à Google."}

    today = date.today()
    latest = fetch_ga4_latest_date(supabase, user_id) if not force_full else None
    if latest:
        since = date.fromisoformat(latest) + timedelta(days=1)
    else:
        since = date(today.year, 1, 1)
    if since_date:
        since = since_date  # choix explicite du pop-up « Mes données »
    if since > today:
        return {"success": True, "rows": 0, "message": "Données GA4 déjà à jour"}

    # Chunking par 90 jours (cohérent Meta/Google Ads)
    CHUNK = 90
    chunks = []
    cur = since
    while cur <= today:
        end = min(cur + timedelta(days=CHUNK - 1), today)
        chunks.append((cur, end))
        cur = end + timedelta(days=1)

    rows = []
    event_rows = []
    last_error = None
    for i, (c_since, c_until) in enumerate(chunks):
        _p(int(10 + (i / max(len(chunks), 1)) * 75),
           f"Chargement {c_since:%b %Y} → {c_until:%b %Y}… ({len(rows)} lignes)")
        chunk_rows, err = fetch_ga4_insights(access_token, property_id, c_since, c_until)
        if err:
            last_error = err
            continue
        rows += chunk_rows
        # Funnel par événement (best-effort : ne bloque pas le fetch principal)
        chunk_events, _ev_err = fetch_ga4_events(access_token, property_id, c_since, c_until)
        if not _ev_err:
            event_rows += chunk_events

    if not rows:
        msg = f"Aucune nouvelle donnée GA4. {('Erreur: ' + last_error) if last_error else ''}".strip()
        return {"success": last_error is None, "rows": 0, "message": msg}

    _p(92, "Sauvegarde Supabase…")
    try:
        upsert_ga4_insights(supabase, user_id, rows)
    except Exception as e:
        return {"success": False, "rows": 0, "message": f"Sauvegarde échouée: {e}"}
    try:
        upsert_ga4_events(supabase, user_id, event_rows)
    except Exception:
        pass  # table absente (migration ga4_events.sql pas passée) → non bloquant

    return {"success": True, "rows": len(rows),
            "message": f"{len(rows)} lignes GA4 chargées (+ {len(event_rows)} événements funnel)"}


def build_ga4_context(
    supabase,
    user_id: str,
    since: "date",
    until: "date",
) -> dict | None:
    """Construit le dict ga4 pour build_recos() depuis les données stockées.

    Retourne None si GA4 n'est pas connecté (aucune donnée) → le moteur garde
    ses recos pub prudentes + affiche le nudge "Connecte Google Analytics".

    Sinon : {connected, paid_conversions, paid_revenue, paid_sessions,
             total_conversions, total_revenue,
             funnel: {view_item, add_to_cart, begin_checkout, purchase, ...},
             by_campaign: {campagne: {conversions, revenue, sessions}} (payant)}
    sur la fenêtre [since, until]. 'paid_*' = medium contenant cpc/ppc/paid.
    """
    rows = db_fetch_ga4(supabase, user_id)
    if not rows:
        return None

    since_s, until_s = since.isoformat(), until.isoformat()
    ctx = {
        "connected": True,
        "paid_conversions": 0.0, "paid_revenue": 0.0, "paid_sessions": 0,
        "total_conversions": 0.0, "total_revenue": 0.0, "total_sessions": 0,
        "funnel": {}, "by_campaign": {},
    }
    in_window = False
    for r in rows:
        d = str(r.get("date", ""))
        if not (since_s <= d <= until_s):
            continue
        in_window = True
        conv = float(r.get("conversions") or 0)
        rev = float(r.get("revenue") or 0)
        ctx["total_conversions"] += conv
        ctx["total_revenue"] += rev
        # Sessions tous canaux — c'est le « trafic » lu dans le rapport hebdo.
        ctx["total_sessions"] += int(r.get("sessions") or 0)
        if any(k in str(r.get("medium", "")).lower() for k in ("cpc", "ppc", "paid")):
            ctx["paid_conversions"] += conv
            ctx["paid_revenue"] += rev
            ctx["paid_sessions"] += int(r.get("sessions") or 0)
            # Attribution par campagne (utm_campaign) — le lien direct campagne → CA
            camp = (r.get("campaign") or "").strip()
            if camp:
                c = ctx["by_campaign"].setdefault(camp, {"conversions": 0.0, "revenue": 0.0, "sessions": 0})
                c["conversions"] += conv
                c["revenue"] += rev
                c["sessions"] += int(r.get("sessions") or 0)

    # Funnel par événement (tous canaux confondus, sur la fenêtre)
    for e in db_fetch_ga4_events(supabase, user_id):
        d = str(e.get("date", ""))
        if not (since_s <= d <= until_s):
            continue
        name = e.get("event_name", "")
        if name:
            ctx["funnel"][name] = ctx["funnel"].get(name, 0) + int(e.get("event_count") or 0)

    # Connecté mais aucune donnée sur la fenêtre → on reste prudent (pas de preuve)
    if not in_window:
        ctx["paid_conversions"] = None
        ctx["paid_revenue"] = None
        ctx["paid_sessions"] = None
        ctx["total_sessions"] = None
    return ctx
