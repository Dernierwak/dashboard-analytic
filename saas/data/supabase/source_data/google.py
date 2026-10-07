"""Les données sources Google : Google Ads et GA4.

Les fichiers d'API Google (`fetch_data/sources/google/`) LISENT et ne touchent jamais
Supabase ; tout ce qui écrit vit ici.
"""
from __future__ import annotations

from supabase import Client


# ── Google Ads ────────────────────────────────────────────────────────────────

def upsert_google_ads(supabase: Client, user_id: str, rows: list[dict]) -> None:
    """Upsert google_ads_insights.
    Chaque row attend : campaign_id, campaign_name, date_start (YYYY-MM-DD),
    impressions, clicks, cost_micros, conversions, ctr, avg_cpc_micros.
    Conflict sur (user_id, date_start, campaign_id) : 1 ligne par campagne × jour.
    """
    if not rows:
        return
    seen = set()
    records = []
    for r in rows:
        key = (r.get("date_start"), str(r.get("campaign_id", "")))
        if key in seen:
            continue
        seen.add(key)
        records.append({
            "user_id":        user_id,
            "date_start":     r.get("date_start"),
            "campaign_id":    str(r.get("campaign_id", "")),
            "campaign_name":  r.get("campaign_name", ""),
            "impressions":    int(r.get("impressions") or 0),
            "clicks":         int(r.get("clicks") or 0),
            "conversions":    float(r.get("conversions") or 0),
            "cost_micros":    int(r.get("cost_micros") or 0),
            "ctr":            float(r.get("ctr") or 0),
            "avg_cpc_micros": int(r.get("avg_cpc_micros") or 0),
        })
    supabase.table("google_ads_insights").upsert(
        records, on_conflict="user_id,date_start,campaign_id"
    ).execute()


def upsert_google_ads_ad_insights(supabase: Client, user_id: str, rows: list[dict]) -> None:
    """Upsert google_ads_ad_insights (détail annonce × jour, pour le drill-down).
    Conflict sur (user_id, date_start, ad_id) : 1 ligne par annonce × jour.
    """
    if not rows:
        return
    seen = set()
    records = []
    for r in rows:
        key = (r.get("date_start"), str(r.get("ad_id", "")))
        if key in seen:
            continue
        seen.add(key)
        records.append({
            "user_id":       user_id,
            "date_start":    r.get("date_start"),
            "campaign_id":   str(r.get("campaign_id", "")),
            "campaign_name": r.get("campaign_name", ""),
            "ad_group_id":   str(r.get("ad_group_id", "")),
            "ad_group_name": r.get("ad_group_name", ""),
            "ad_id":         str(r.get("ad_id", "")),
            "ad_name":       r.get("ad_name", ""),
            "impressions":   int(r.get("impressions") or 0),
            "clicks":        int(r.get("clicks") or 0),
            "cost_micros":   int(r.get("cost_micros") or 0),
            "conversions":   float(r.get("conversions") or 0),
        })
    supabase.table("google_ads_ad_insights").upsert(
        records, on_conflict="user_id,date_start,ad_id"
    ).execute()


def upsert_google_campaign_statuses(supabase: Client, user_id: str, status_map: dict) -> None:
    """status_map : {campaign_id: (campaign_name, effective_status, start, end)}

    `end` à None veut dire « déclarée sans date de fin » : la sentinelle 2037
    de Google est déjà normalisée à la récolte.
    """
    if not status_map:
        return
    records = []
    for cid, v in status_map.items():
        cname, status = v[0], v[1]
        debut = v[2] if len(v) > 2 else None
        fin = v[3] if len(v) > 3 else None
        records.append({
            "user_id": user_id,
            "campaign_id": str(cid),
            "campaign_name": cname,
            "effective_status": status or None,
            "start_date": debut,
            "end_date": fin,
        })
    if records:
        supabase.table("google_campaign_config").upsert(
            records, on_conflict="user_id,campaign_id"
        ).execute()



# ── Google Analytics 4 ────────────────────────────────────────────────────────

def upsert_ga4_insights(supabase: Client, user_id: str, rows: list[dict]) -> None:
    """Upsert ga4_insights.
    Chaque row : date (YYYY-MM-DD), source, medium, campaign (utm), sessions,
    conversions, revenue. Conflict (user_id, date, source, medium, campaign).
    Fallback ancien schéma (sans campaign) si la migration ga4_events.sql
    n'est pas encore passée.
    """
    if not rows:
        return
    seen = set()
    records = []
    for r in rows:
        key = (r.get("date"), r.get("source", ""), r.get("medium", ""), r.get("campaign", ""))
        if key in seen:
            continue
        seen.add(key)
        records.append({
            "user_id":     user_id,
            "date":        r.get("date"),
            "source":      r.get("source", "") or "",
            "medium":      r.get("medium", "") or "",
            "campaign":    r.get("campaign", "") or "",
            "sessions":    int(r.get("sessions") or 0),
            "conversions": float(r.get("conversions") or 0),
            "revenue":     float(r.get("revenue") or 0),
        })
    try:
        supabase.table("ga4_insights").upsert(
            records, on_conflict="user_id,date,source,medium,campaign"
        ).execute()
    except Exception:
        # Ancien schéma : pas de colonne campaign → on agrège par (source, medium)
        legacy: dict = {}
        for rec in records:
            k = (rec["date"], rec["source"], rec["medium"])
            cur = legacy.setdefault(k, {**rec})
            if cur is not rec:
                cur["sessions"] += rec["sessions"]
                cur["conversions"] += rec["conversions"]
                cur["revenue"] += rec["revenue"]
        for rec in legacy.values():
            rec.pop("campaign", None)
        supabase.table("ga4_insights").upsert(
            list(legacy.values()), on_conflict="user_id,date,source,medium"
        ).execute()


def upsert_ga4_events(supabase: Client, user_id: str, rows: list[dict]) -> None:
    """Upsert ga4_events (funnel par événement × jour × source/medium/campagne).
    Conflict (user_id, date, source, medium, campaign, event_name).
    Silencieux si la table n'existe pas encore (migration non passée).
    """
    if not rows:
        return
    seen = set()
    records = []
    for r in rows:
        key = (r.get("date"), r.get("source", ""), r.get("medium", ""),
               r.get("campaign", ""), r.get("event_name", ""))
        if key in seen:
            continue
        seen.add(key)
        records.append({
            "user_id":     user_id,
            "date":        r.get("date"),
            "source":      r.get("source", "") or "",
            "medium":      r.get("medium", "") or "",
            "campaign":    r.get("campaign", "") or "",
            "event_name":  r.get("event_name", "") or "",
            "event_count": int(r.get("event_count") or 0),
            "event_value": float(r.get("event_value") or 0),
        })
    supabase.table("ga4_events").upsert(
        records, on_conflict="user_id,date,source,medium,campaign,event_name"
    ).execute()


# Ce que PostgREST répond quand la colonne visée n'existe pas. Deux codes, et
# ils ne veulent pas dire la même chose :
#  · PGRST204 — « Could not find the '<col>' column of '<table>' in the schema
#    cache ». C'est PostgREST qui refuse AVANT d'envoyer quoi que ce soit à
#    Postgres, sur la foi de son cache de schéma. C'est le code qu'on voit quand
#    la migration n'a jamais été jouée.
#  · 42703 — `undefined_column`, le code SQLSTATE de Postgres lui-même
#    (postgresql.org/docs/current/errcodes-appendix.html). C'est celui qui sort
#    quand le cache de PostgREST est en avance sur la base réelle.
# Les deux se traduisent par la même phrase pour David : la migration n'est pas
# passée. Mais il faut les distinguer de TOUT LE RESTE — un réseau coupé, une
# clé expirée, un jsonb trop gros — qui n'a rien à voir et qui se réparait
# jusqu'ici en silence, c'est-à-dire jamais.
_COLONNE_ABSENTE = ("PGRST204", "42703")


def upsert_ga4_event_catalog(supabase: Client, user_id: str, evenements: list[dict],
                             maj: str) -> str | None:
    """Remplace le catalogue des événements GA4 de la propriété.

    ON REMPLACE, ON NE FUSIONNE PAS : le catalogue dit ce que la propriété émet
    AUJOURD'HUI. Fusionner ferait survivre à l'écran un événement retiré du site
    il y a six mois, que le client pourrait encore cocher — et qui ne
    remonterait jamais aucune ligne.

    NE LÈVE JAMAIS, MAIS NE SE TAIT PLUS. La récolte ne doit pas échouer pour un
    cache — c'était déjà la règle, et elle ne change pas. Ce qui change, c'est
    qu'un `except: pass` rendait l'échec INVISIBLE : une colonne absente, et la
    récolte annonçait « terminé » sans avoir rien écrit. Le retour porte
    désormais la raison, en clair, pour que l'appelant la journalise.

    Returns: None si le catalogue a bien été écrit, sinon la phrase à afficher.
    """
    try:
        res = (
            supabase.table("profiles")
            .update({"ga4_event_catalog": {"maj": maj, "evenements": evenements or []}})
            .eq("id", user_id)
            .execute()
        )
    except Exception as e:
        code = str(getattr(e, "code", "") or "")
        # supabase-py n'expose pas `code` sur toutes les versions : le message
        # porte alors le code en clair. On regarde les deux plutôt que de faire
        # confiance à l'attribut.
        texte = str(e)
        if code in _COLONNE_ABSENTE or any(c in texte for c in _COLONNE_ABSENTE):
            return ("catalogue NON écrit : la colonne profiles.ga4_event_catalog "
                    "n'existe pas — la migration saas/data/supabase/migrations/"
                    "000_run_me_all.sql n'a pas été jouée sur cette base")
        return f"catalogue NON écrit : {texte}"

    # UN UPDATE QUI NE TOUCHE AUCUNE LIGNE NE LÈVE PAS. C'est le piège RLS
    # documenté dans CLAUDE.md : une politique qui refuse l'écriture ne renvoie
    # pas d'erreur, elle renvoie zéro ligne. Le worker passe par la clé service
    # et ne devrait jamais tomber ici ; l'ancien chemin Streamlit, lui, écrivait
    # sous la session de l'utilisateur — et un refus y était parfaitement muet.
    if not (getattr(res, "data", None) or []):
        return ("catalogue NON écrit : aucune ligne profiles touchée pour cet "
                "utilisateur (ligne absente, ou écriture refusée par RLS)")
    return None
