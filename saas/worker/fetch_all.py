"""Worker de fetch automatique — récolte les données SANS personne connecté.

Branché sur un cron (GitHub Actions), tourne chaque jour : pour chaque utilisateur
dont c'est le jour de mise à jour, récupère Meta Ads + Google Ads + GA4 + Instagram
et écrit dans le même Supabase que l'app. C'est le « ça marche sans moi ».

Réutilise la logique de fetch existante (rendue headless) :
  - Meta Ads / Instagram : token utilisateur (connected_accounts.meta_token)
  - Google Ads / GA4      : refresh_token Google + secrets app (via scripts.app_secrets)

Variables d'env requises :
  SUPABASE_URL            (sinon lu dans secrets.toml [supabase].url)
  SUPABASE_SERVICE_KEY    (clé service_role — bypass RLS pour lire tous les users)
  GOOGLE_ADS_*            (client_id, client_secret, developer_token) pour Google
"""

from __future__ import annotations
import os
import sys
import json
import traceback
from datetime import date, datetime, timedelta
from pathlib import Path

import requests

# Racine du projet sur le path (pour importer scripts/, google_script/, meta_script/, components/)
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from supabase import create_client                                        # noqa: E402
from scripts.app_secrets import secret                                    # noqa: E402
from scripts.fetch_data import fetch_meta_ads_latest_date, fetch_google_ads_latest_date  # noqa: E402
from scripts.insert_data import (                                         # noqa: E402
    upsert_meta_ads, upsert_campaign_statuses,
    upsert_google_ads, upsert_google_campaign_statuses,
    insert_instagram_org,
)
from google_script.fetch_token import get_access_token_from_refresh        # noqa: E402
from google_script.fetch_google_ads import fetch_campaign_insights, fetch_campaign_statuses  # noqa: E402
from components.ga4 import run_ga4_fetch                                   # noqa: E402
from meta_script.fetch_instagram import OrganicInstagramm                  # noqa: E402

_GRAPH = "https://graph.facebook.com/v24.0"
_CHUNK = 90


def _service_client():
    url = os.getenv("SUPABASE_URL") or secret("supabase.url")
    key = os.getenv("SUPABASE_SERVICE_KEY") or secret("supabase.service_role")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL / SUPABASE_SERVICE_KEY manquants (env ou secrets.toml).")
    return create_client(url, key)


def _due_today(fetch_schedule: str | None) -> bool:
    """True si c'est le jour de mise à jour de l'utilisateur.
    Pas de jour défini → on prend lundi par défaut (évite de fetch tous les jours)."""
    today = datetime.utcnow().strftime("%A")  # 'Monday', ...
    return (fetch_schedule or "Monday") == today


# ── Meta Ads (token utilisateur) ──────────────────────────────────────────────

def _meta_chunk(token, ad_account_id, since_iso, until_iso) -> list:
    params = {
        "access_token": token, "level": "ad",
        "fields": "campaign_name,adset_name,ad_name,impressions,clicks,reach,spend,actions,date_start",
        "time_increment": 1,
        "time_range": json.dumps({"since": since_iso, "until": until_iso}),
        "limit": 500,
    }
    try:
        data = requests.get(f"{_GRAPH}/{ad_account_id}/insights", params=params, timeout=60).json()
    except Exception:
        return []
    rows = data.get("data", [])
    nxt = data.get("paging", {}).get("next")
    while nxt:
        try:
            resp = requests.get(nxt, timeout=60).json()
        except Exception:
            break
        rows += resp.get("data", [])
        nxt = resp.get("paging", {}).get("next")
    return rows


def _fetch_meta(sb, uid, token) -> str:
    r = requests.get(f"{_GRAPH}/me/adaccounts", params={"fields": "id", "access_token": token}, timeout=30)
    accts = r.json().get("data", [])
    if not accts:
        return "meta: aucun compte pub"
    ad_account_id = accts[0]["id"]
    today = date.today()
    latest = fetch_meta_ads_latest_date(sb, uid)
    since = date.fromisoformat(latest) + timedelta(days=1) if latest else date(today.year, 1, 1)
    if since > today:
        return "meta: à jour"
    rows, cur = [], since
    while cur <= today:
        end = min(cur + timedelta(days=_CHUNK - 1), today)
        rows += _meta_chunk(token, ad_account_id, cur.isoformat(), end.isoformat())
        cur = end + timedelta(days=1)
    camp = requests.get(f"{_GRAPH}/{ad_account_id}/campaigns",
                        params={"access_token": token, "fields": "name,effective_status", "limit": 200},
                        timeout=30).json()
    status_map = {c["name"]: c.get("effective_status", "UNKNOWN") for c in camp.get("data", [])}
    for row in rows:
        lc = next((it for it in row.get("actions", []) if it.get("action_type") == "link_click"), None)
        row["link_clicks"] = int(lc.get("value", 0)) if lc else 0
        row["effective_status"] = status_map.get(row.get("campaign_name", ""), "UNKNOWN")
    if rows:
        upsert_meta_ads(sb, uid, rows)
        upsert_campaign_statuses(sb, uid, status_map)
    return f"meta: {len(rows)} lignes"


# ── Google Ads (refresh_token + secrets app) ──────────────────────────────────

def _fetch_google(sb, uid, refresh, customer_id) -> str:
    access = get_access_token_from_refresh(refresh)
    if not access:
        return "google: token invalide"
    today = date.today()
    latest = fetch_google_ads_latest_date(sb, uid)
    since = date.fromisoformat(latest) + timedelta(days=1) if latest else date(today.year, 1, 1)
    if since > today:
        return "google: à jour"
    rows, cur = [], since
    while cur <= today:
        end = min(cur + timedelta(days=_CHUNK - 1), today)
        chunk, err = fetch_campaign_insights(access, customer_id, cur, end)
        if not err:
            rows += chunk
        cur = end + timedelta(days=1)
    if rows:
        upsert_google_ads(sb, uid, rows)
    smap, _ = fetch_campaign_statuses(access, customer_id)
    if smap:
        upsert_google_campaign_statuses(sb, uid, smap)
    return f"google: {len(rows)} lignes"


# ── Instagram organique (token utilisateur) ───────────────────────────────────

def _fetch_instagram(sb, uid, token, biz_id) -> str:
    org = OrganicInstagramm(meta_long_token=token, supabase_client=sb,
                            supabase_user_id=uid, instagram_business_id=biz_id)
    org.fetch_headless()
    if org.new_results:
        insert_instagram_org(supabase=sb, results=org.new_results)
    return f"insta: {len(org.new_results)} nouveaux posts"


# ── Orchestration ─────────────────────────────────────────────────────────────

def run(force: bool = False, only_user: str | None = None,
        label_only: bool = False, report_only: bool = False) -> None:
    sb = _service_client()
    profiles = (sb.table("profiles")
                .select("id, fetch_schedule")
                .execute().data) or []
    if only_user:
        # Bouton « Mes données » de Pulse : un seul user, sans attendre son jour
        profiles = [p for p in profiles if p["id"] == only_user]
        force = True
    _mode = " · labels seulement" if label_only else (" · rapport seulement" if report_only else "")
    print(f"[{datetime.utcnow():%Y-%m-%d %H:%M} UTC] {len(profiles)} profils{_mode}")

    # Sans ces secrets, le refresh du token Google echoue et TOUT Google Ads +
    # GA4 est saute en silence. On le dit fort une fois, en tete de run.
    if not (label_only or report_only):
        _needed = {
            "GOOGLE_ADS_CLIENT_ID": "google_ads.client_id",
            "GOOGLE_ADS_CLIENT_SECRET": "google_ads.client_secret",
            "GOOGLE_ADS_DEVELOPER_TOKEN": "google_ads.developer_token",
        }
        _missing = []
        for _env, _path in _needed.items():
            try:
                _val = os.getenv(_env) or secret(_path)
            except Exception:
                _val = None
            if not _val:
                _missing.append(_env)
        if _missing:
            print("!! ATTENTION - secrets Google absents : " + ", ".join(_missing)
                  + " -> Google Ads et GA4 ne seront PAS mis a jour "
                    "(a ajouter dans les secrets GitHub du repo).")

    for p in profiles:
        uid = p["id"]
        if not force and not _due_today(p.get("fetch_schedule")):
            continue
        logs = []

        # Bouton « ↻ Recharger mes conseils » : republie juste le rapport à partir
        # des données déjà en base (ni fetch réseau, ni relabel) — ~30 s.
        if report_only:
            try:
                from saas.worker.build_report import publish_weekly_report
                logs.append(publish_weekly_report(sb, uid))
            except Exception as e:
                logs.append(f"rapport KO: {e}")
            print(f"  {uid} → " + " | ".join(logs))
            continue

        # Bouton « ✨ Classer mes contenus » : labellisation IA + republication du
        # rapport, sans re-fetch réseau (~1 min au lieu de 2-3).
        if label_only:
            try:
                from saas.worker.labeling import auto_label
                logs.append(auto_label(sb, uid))
            except Exception as e:
                logs.append(f"labels KO: {e}")
            try:
                from saas.worker.build_report import publish_weekly_report
                logs.append(publish_weekly_report(sb, uid))
            except Exception as e:
                logs.append(f"rapport KO: {e}")
            print(f"  {uid} → " + " | ".join(logs))
            continue

        # Toutes les connexions de l'utilisateur (Meta + Google) vivent dans
        # connected_accounts. provider='google' porte les tokens Google (Ads + GA4).
        try:
            accts = sb.table("connected_accounts").select(
                "provider, meta_token, instagram_business_id, "
                "google_refresh_token, google_customer_id, ga4_property_id"
            ).eq("user_id", uid).execute().data or []
        except Exception:
            accts = []

        # Meta Ads + Instagram (token utilisateur) — la ligne google n'a pas de meta_token.
        for a in accts:
            token = a.get("meta_token")
            if not token:
                continue
            for fn, args in ((_fetch_meta, (sb, uid, token)),
                             (_fetch_instagram, (sb, uid, token, a.get("instagram_business_id")))):
                if fn is _fetch_instagram and not a.get("instagram_business_id"):
                    continue
                try:
                    logs.append(fn(*args))
                except Exception as e:
                    logs.append(f"{fn.__name__} KO: {e}")

        # Connexion Google (provider='google') → Ads + GA4 partagent le token.
        g = next((a for a in accts if a.get("provider") == "google"), {})

        # Google Ads
        if g.get("google_refresh_token") and g.get("google_customer_id"):
            try:
                logs.append(_fetch_google(sb, uid, g["google_refresh_token"], g["google_customer_id"]))
            except Exception as e:
                logs.append(f"google KO: {e}")

        # GA4 (run_ga4_fetch est déjà headless)
        if g.get("ga4_property_id") and g.get("google_refresh_token"):
            try:
                res = run_ga4_fetch(sb, uid, refresh_token=g["google_refresh_token"],
                                    property_id=g["ga4_property_id"])
                logs.append(f"ga4: {res.get('message', '')}")
            except Exception as e:
                logs.append(f"ga4 KO: {e}")

        # Labellisation IA des nouveaux contenus (posts + campagnes sans thème).
        # Best-effort : jamais bloquant, ne touche jamais un label posé à la main.
        if logs:
            try:
                from saas.worker.labeling import auto_label
                logs.append(auto_label(sb, uid))
            except Exception as e:
                logs.append(f"labels KO: {e}")

        # Rapport hebdo précalculé → weekly_reports (lu par Pulse) + email hebdo.
        # Données fraîches du jour → le rapport publié est à jour lui aussi.
        # L'email part le jour de fetch de l'utilisateur (défaut lundi) ; sans
        # RESEND_API_KEY, send_email passe en dry-run (aucun envoi).
        if logs:
            try:
                from saas.worker.build_report import publish_weekly_report
                email_to = None
                try:
                    email_to = sb.auth.admin.get_user_by_id(uid).user.email
                except Exception:
                    pass
                logs.append(publish_weekly_report(sb, uid, email_to=email_to))
            except Exception as e:
                logs.append(f"rapport KO: {e}")

        if logs:
            print(f"  {uid} → " + " | ".join(logs))

    print("Terminé.")


if __name__ == "__main__":
    force = "--force" in sys.argv  # ignore le jour planifié (utile pour tester)
    only_user = None
    if "--user" in sys.argv:       # un seul utilisateur (bouton Pulse), force implicite
        only_user = sys.argv[sys.argv.index("--user") + 1]
    label_only = False
    if "--label-only" in sys.argv:  # labellisation IA + republication, sans fetch
        only_user = sys.argv[sys.argv.index("--label-only") + 1]
        label_only = True
    report_only = False
    if "--report-only" in sys.argv:  # republie juste le rapport (conseils), ~30 s
        only_user = sys.argv[sys.argv.index("--report-only") + 1]
        report_only = True
    try:
        run(force=force, only_user=only_user, label_only=label_only, report_only=report_only)
    except Exception:
        traceback.print_exc()
        sys.exit(1)
