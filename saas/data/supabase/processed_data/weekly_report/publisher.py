"""Publication du rapport hebdomadaire construit depuis les données sources."""

from __future__ import annotations

from datetime import date, timedelta

from saas.data.supabase.processed_data.weekly_report.builder import build_payload
from saas.data.supabase.processed_data.weekly_report.reader import LecteurSupabase


def _upsert_weekly_report(sb, user_id: str, week_start: str, payload: dict) -> None:
    """Enregistre uniquement le résultat traité dans ``weekly_reports``."""
    from datetime import datetime, timezone

    sb.table("weekly_reports").upsert(
        {
            "user_id": user_id,
            "week_start": week_start,
            "payload": payload,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        on_conflict="user_id,week_start",
    ).execute()


def publish_weekly_report(sb, user_id: str) -> tuple[str, list[dict]]:
    """Construit et publie le rapport d'un utilisateur."""
    payload = build_payload(LecteurSupabase(sb, user_id))
    if payload is None:
        return "rapport: pas de données", []

    week_start = (payload.get("week_start")
                  or (date.today() - timedelta(days=date.today().weekday())).isoformat())
    _upsert_weekly_report(sb, user_id, week_start, payload)
    return "rapport publié", list(payload.get("canaux_muets") or [])


__all__ = ["publish_weekly_report"]
