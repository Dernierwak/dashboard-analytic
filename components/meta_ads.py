import time

import streamlit as st
import requests
import json
import pandas as pd
import plotly.graph_objects as go

from scripts.insert_data import (
    upsert_meta_ads,
    update_campaign_labels,
    update_meta_budget_global,
    upsert_campaign_config,
    upsert_campaign_statuses,
    rename_campaign_label,
    clear_campaign_label,
)
from scripts.fetch_data import (
    fetch_meta_ads,
    fetch_meta_ads_latest_date,
    fetch_campaign_labels,
    fetch_meta_budget_global,
    fetch_campaign_config,
)
from components.insights_panel import show_insights_panel


# ── Pulse CSS ──────────────────────────────────────────────────────────────────
PULSE_CSS = """<style>
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&family=Inter:wght@400;500;600&display=swap');
:root {
    --brand:#3b5bff;--good:#1a7a4a;--good-soft:#e7f3ec;
    --bad:#c0392b;--bad-soft:#fbe9e6;--warn:#b86b00;--warn-soft:#fbf1de;
    --ink:#0e0f12;--ink-3:#5a5d66;--ink-4:#8b8e98;
    --line:rgba(14,15,18,0.08);
    --font-mono:"JetBrains Mono",ui-monospace,monospace;
    --font-display:"Instrument Serif",Georgia,serif;
}
.page-h { padding:28px 0 24px; }
.h-eyebrow {
    font-size:11.5px;font-weight:600;text-transform:uppercase;
    letter-spacing:0.08em;color:#8b8e98;margin-bottom:10px;
    font-family:var(--font-mono);
}
.page-h h1 {
    font-family:var(--font-display) !important;
    font-size:2rem !important;font-weight:400 !important;
    color:#0e0f12 !important;line-height:1.2 !important;
    margin:0 0 10px !important;
}
.h-sub { font-size:13.5px;color:#5a5d66;line-height:1.6;margin:0;max-width:560px; }

/* ── Seg: st.radio horizontal → pill buttons ── */
div[data-testid="stRadio"] > label { display:none; }
div[data-testid="stRadio"] > div[role="radiogroup"] {
    background:rgba(14,15,18,0.06);border-radius:8px;
    padding:3px;gap:2px;display:inline-flex;flex-direction:row;
    flex-wrap:nowrap;
}
div[data-testid="stRadio"] [data-baseweb="radio"] {
    background:transparent;border-radius:6px;padding:5px 14px;
    margin:0;
}
div[data-testid="stRadio"] [data-baseweb="radio"] > div:first-child { display:none; }
div[data-testid="stRadio"] [data-baseweb="radio"] label {
    font-size:12.5px;font-weight:500;color:#5a5d66;
    cursor:pointer;padding:0;line-height:1;
}
div[data-testid="stRadio"] [aria-checked="true"][data-baseweb="radio"] {
    background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.1);
}
div[data-testid="stRadio"] [aria-checked="true"][data-baseweb="radio"] label {
    color:#0e0f12;font-weight:600;
}

/* ── KPI grid ── */
.kpi-grid {
    display:grid;grid-template-columns:repeat(4,1fr);
    gap:12px;margin-bottom:28px;
}
.kpi-p {
    background:#fff;border:1px solid rgba(14,15,18,0.08);
    border-radius:14px;padding:16px 20px;
}
.kpi-p .kp-lbl {
    font-size:11px;font-weight:600;text-transform:uppercase;
    letter-spacing:0.06em;color:#8b8e98;margin-bottom:8px;
}
.kpi-p .kp-val {
    font-family:var(--font-mono);font-size:1.7rem;
    font-weight:500;color:#0e0f12;line-height:1;letter-spacing:-0.02em;
}
.kpi-p .kp-unit { font-size:1rem;color:#8b8e98;margin-left:3px; }
.kpi-p .kp-delta { margin-top:8px;font-size:11.5px;font-weight:500; }
.kp-good { color:#1a7a4a; } .kp-bad { color:#c0392b; } .kp-neu { color:#8b8e98; }

/* ── Sections ── */
.section { margin-bottom:32px; }
.section-head {
    display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;
}
.section-title {
    font-size:14px;font-weight:600;color:#0e0f12;
    display:flex;align-items:center;gap:8px;
}
.st-count { font-size:11.5px;color:#8b8e98;font-weight:400; }

/* ── Card ── */
.card { background:#fff;border:1px solid rgba(14,15,18,0.08);border-radius:14px;padding:20px; }

/* ── Chips ── */
.chip {
    display:inline-flex;align-items:center;gap:4px;
    padding:3px 9px;border-radius:999px;
    font-size:11.5px;font-weight:500;
    background:rgba(14,15,18,0.06);color:#0e0f12;white-space:nowrap;
}
.chip.good { background:#e7f3ec;color:#1a7a4a; }
.chip.bad  { background:#fbe9e6;color:#c0392b; }
.chip.warn { background:#fbf1de;color:#b86b00; }
.chip.outline { background:transparent;border:1px solid rgba(14,15,18,0.12);color:#5a5d66; }
.chip.tiny { font-size:10px;padding:2px 7px; }

/* ── Health bar ── */
.bar { width:100%;height:3px;background:rgba(14,15,18,0.08);border-radius:99px;overflow:hidden; }
.bar span { display:block;height:100%;border-radius:99px; }

/* ── Campaign rows ── */
.camp-row {
    background:#fff;border:1px solid rgba(14,15,18,0.08);border-radius:14px;
    padding:14px 18px;margin-bottom:8px;
    display:grid;
    grid-template-columns:minmax(0,2fr) auto repeat(4,88px) 72px;
    gap:16px;align-items:center;
}
.camp-row.paused { opacity:0.62; }
.cell-lbl {
    font-size:10px;text-transform:uppercase;letter-spacing:0.06em;
    color:#8b8e98;font-weight:600;margin-bottom:4px;
}
.cell-val { font-family:var(--font-mono);font-size:13px;font-weight:500;color:#0e0f12; }
.cell-r { text-align:right; }

/* ── Coût tab ── */
.cout-section-title {
    font-size:13px;font-weight:600;color:#0e0f12;margin-bottom:12px;margin-top:24px;
}
.cout-bar-wrap {
    width:100%;height:6px;background:rgba(14,15,18,0.08);
    border-radius:99px;overflow:hidden;margin-top:6px;
}
.cout-bar-fill { display:block;height:100%;border-radius:99px;transition:width 0.3s; }
.cout-ok   { color:#1a7a4a;font-size:11.5px;font-weight:600; }
.cout-over { color:#c0392b;font-size:11.5px;font-weight:600; }
.cout-low  { color:#b86b00;font-size:11.5px;font-weight:600; }
</style>"""


# ── Constantes partagées ───────────────────────────────────────────────────────

_NO_LABEL = "(sans label)"


def _init_cout_state(client, user_id) -> None:
    """Charge labels + budget + config depuis Supabase une fois par session."""
    if not (client and user_id):
        return
    if st.session_state.get("cout_initialized"):
        return
    try:
        st.session_state["campaign_labels"] = fetch_campaign_labels(client, user_id)
    except Exception:
        st.session_state["campaign_labels"] = []
    try:
        st.session_state["budget_global"] = fetch_meta_budget_global(client, user_id)
    except Exception:
        st.session_state["budget_global"] = 0.0
    try:
        st.session_state["campaign_config"] = fetch_campaign_config(client, user_id)
    except Exception:
        st.session_state["campaign_config"] = {}
    st.session_state["cout_initialized"] = True


# ── Helpers ───────────────────────────────────────────────────────────────────

# Statuts Meta considérés comme une vraie alerte (rouge)
_ALERT_STATUSES = {
    "WITH_ISSUES", "DISAPPROVED", "PENDING_REVIEW", "IN_PROCESS",
    "CAMPAIGN_PAUSED", "ADSET_PAUSED", "PREAPPROVED",
}
# Statuts considérés comme indisponibles (on n'affiche rien)
_UNKNOWN_STATUSES = {"", "UNKNOWN", "NONE"}


def _status_chip(status: str) -> str:
    s = (status or "").upper()
    if s == "ACTIVE":
        return '<span class="chip good">● Active</span>'
    if "PAUSED" in s:
        return '<span class="chip outline">⏸ En pause</span>'
    if s in _ALERT_STATUSES:
        return '<span class="chip bad">▲ Alerte</span>'
    if s in _UNKNOWN_STATUSES:
        return ''  # statut indisponible → pas de chip
    # statut inconnu mais non vide (futurs codes Meta) → chip neutre
    return f'<span class="chip outline">{s.capitalize()}</span>'


def _camp_note(row, avg_ctr: float, avg_cpc: float) -> tuple[str, str]:
    cpc, ctr = row["cpc"], row["ctr"]
    if avg_cpc > 0 and cpc > avg_cpc * 3 and cpc > 5:
        return "À couper — CPC anormalement élevé", "#c0392b"
    if avg_ctr > 0 and ctr >= avg_ctr * 1.5:
        return "Augmente le budget — meilleure perf.", "#1a7a4a"
    if avg_ctr > 0 and ctr < avg_ctr * 0.5 and ctr > 0:
        return "Revoir le ciblage ou la créa", "#b86b00"
    if cpc == 0 and ctr == 0:
        return "En pause — aucune donnée sur la période", "#8b8e98"
    return "Performances correctes", "#8b8e98"


def _sparkline_svg(data: list[float], color: str = "#3b5bff", w: int = 56, h: int = 22) -> str:
    """Tiny SVG sparkline (path + fill) matching the Pulse KPI design."""
    if not data or len(data) < 2:
        return ""
    mn, mx = min(data), max(data)
    rng = mx - mn or 1
    pts = [(i / (len(data) - 1)) * w for i in range(len(data))]
    ypts = [h - ((v - mn) / rng) * (h - 2) - 1 for v in data]
    coords = " ".join(f"{x:.1f},{y:.1f}" for x, y in zip(pts, ypts))
    path = "M " + " L ".join(f"{x:.1f},{y:.1f}" for x, y in zip(pts, ypts))
    fill = path + f" L{w},{h} L0,{h} Z"
    return (
        f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" style="display:block">'
        f'<path d="{fill}" fill="{color}" opacity="0.15"/>'
        f'<path d="{path}" fill="none" stroke="{color}" stroke-width="1.4" '
        f'stroke-linecap="round" stroke-linejoin="round"/>'
        f'</svg>'
    )


def _health(row, avg_ctr: float, avg_cpc: float) -> tuple[int | None, str]:
    scores = []
    if row["impressions"] > 0 and avg_ctr > 0:
        scores.append(min(100, row["ctr"] / avg_ctr * 60))
    if row["clicks"] > 0 and avg_cpc > 0:
        scores.append(max(0, 100 - (row["cpc"] / avg_cpc - 1) * 50))
    if not scores:
        return None, "#8b8e98"
    score = int(sum(scores) / len(scores))
    color = "#1a7a4a" if score >= 70 else "#b86b00" if score >= 40 else "#c0392b"
    return score, color


def _kpi(label: str, value: str, unit: str = "", delta: float | None = None,
         invert: bool = False, spark: list[float] | None = None,
         spark_color: str = "#3b5bff") -> str:
    delta_html = ""
    if delta is not None and delta != 0:
        good = (delta > 0) if not invert else (delta < 0)
        cls = "kp-good" if good else "kp-bad"
        sign = "+" if delta > 0 else ""
        delta_html = f'<div class="kp-delta {cls}">{sign}{delta:.1f}% vs période préc.</div>'
    spark_html = ""
    if spark:
        svg = _sparkline_svg(spark, color=spark_color)
        spark_html = f'<div class="kp-spark">{svg}</div>'
    return (
        f'<div class="kpi-p">'
        f'{spark_html}'
        f'<div class="kp-lbl">{label}</div>'
        f'<div class="kp-val">{value}<span class="kp-unit">{unit}</span></div>'
        f'{delta_html}'
        f'</div>'
    )


def _cell(label: str, value: str) -> str:
    return (
        f'<div class="cell-r">'
        f'<div class="cell-lbl">{label}</div>'
        f'<div class="cell-val">{value}</div>'
        f'</div>'
    )


# ── Data fetch fragment ────────────────────────────────────────────────────────

def _fetch_insights_chunk(token: str, ad_account_id: str, since_iso: str, until_iso: str) -> tuple[list, str | None]:
    """Fetch un chunk d'insights pour une période donnée (max 90 jours).
    Returns: (rows, error_message_or_None)
    """
    params = {
        "access_token": token,
        "level": "ad",
        "fields": "campaign_name,adset_name,ad_name,impressions,clicks,reach,spend,actions,date_start",
        "time_increment": 1,
        "time_range": json.dumps({"since": since_iso, "until": until_iso}),
        "limit": 500,
    }
    url = f"https://graph.facebook.com/v24.0/{ad_account_id}/insights"
    try:
        result = requests.get(url=url, params=params).json()
    except Exception as e:
        return [], f"Erreur API: {e}"
    if "error" in result:
        return [], result["error"].get("message", "inconnue")

    rows = result.get("data", [])
    next_url = result.get("paging", {}).get("next")
    while next_url:
        try:
            page = requests.get(next_url).json()
        except Exception:
            break
        rows += page.get("data", [])
        next_url = page.get("paging", {}).get("next")
    return rows, None


def run_meta_ads_fetch(token, supabase, user_id, ad_account_id=None, force_full=False, progress_cb=None):
    """Fetch Meta Ads avec chunking par fenêtres de 90 jours pour contourner les limites API.
    progress_cb: fonction(pct: int, text: str) optionnelle pour reporter la progression.
    Returns: dict avec keys 'success' (bool), 'rows' (int), 'message' (str).
    """
    from datetime import date, timedelta

    def _progress(p, t):
        if progress_cb:
            try:
                progress_cb(p, t)
            except Exception:
                pass

    if not ad_account_id:
        try:
            r = requests.get(
                "https://graph.facebook.com/v24.0/me/adaccounts",
                params={"fields": "id", "access_token": token},
            )
            accounts = r.json().get("data", [])
        except Exception as e:
            return {"success": False, "rows": 0, "message": f"Connexion impossible: {e}"}
        if not accounts:
            return {"success": False, "rows": 0, "message": "Aucun compte publicitaire trouvé"}
        ad_account_id = accounts[0]["id"]

    today = date.today()
    latest = fetch_meta_ads_latest_date(supabase, user_id) if (supabase and user_id and not force_full) else None
    # Fetch limité à l'année courante (depuis le 1er janvier)
    if latest:
        since = date.fromisoformat(latest) + timedelta(days=1)
    else:
        since = date(today.year, 1, 1)
    # En force_full, on reprend depuis le 1er janvier de l'année courante
    if force_full:
        since = date(today.year, 1, 1)
    if since > today:
        return {"success": True, "rows": 0, "message": "Données déjà à jour"}

    # ── Chunking par fenêtres de 90 jours (Meta limite Insights ad-level à ~90j/requête) ──
    CHUNK_DAYS = 90
    chunks = []
    cur = since
    while cur <= today:
        end = min(cur + timedelta(days=CHUNK_DAYS - 1), today)
        chunks.append((cur, end))
        cur = end + timedelta(days=1)

    rows = []
    nb_chunks = len(chunks)
    last_error = None
    for i, (c_since, c_until) in enumerate(chunks):
        _progress(
            int(10 + (i / max(nb_chunks, 1)) * 70),
            f"Chargement {c_since:%b %Y} → {c_until:%b %Y}… ({len(rows)} lignes)",
        )
        chunk_rows, err = _fetch_insights_chunk(token, ad_account_id, c_since.isoformat(), c_until.isoformat())
        if err:
            last_error = err
            # On continue les autres chunks même si un échoue
            continue
        rows += chunk_rows

    # Statuts depuis /campaigns
    camp_url = f"https://graph.facebook.com/v24.0/{ad_account_id}/campaigns"
    try:
        camp_resp = requests.get(camp_url, params={
            "access_token": token, "fields": "name,effective_status", "limit": 200,
        }).json()
        status_map = {c["name"]: c.get("effective_status", "UNKNOWN") for c in camp_resp.get("data", [])}
    except Exception:
        status_map = {}

    for row in rows:
        link_click = next((it for it in row.get("actions", []) if it.get("action_type") == "link_click"), None)
        row["link_clicks"] = int(link_click.get("value", 0)) if link_click else 0
        row["effective_status"] = status_map.get(row.get("campaign_name", ""), "UNKNOWN")

    if not rows:
        msg = f"Aucune nouvelle donnée. {('Erreur API: ' + last_error) if last_error else ''}".strip()
        return {"success": last_error is None, "rows": 0, "message": msg}

    # Persist
    try:
        upsert_meta_ads(supabase, user_id, rows)
    except Exception as e:
        return {"success": False, "rows": 0, "message": f"Sauvegarde Supabase échouée: {e}"}
    try:
        upsert_campaign_statuses(supabase, user_id, status_map)
        cfg = st.session_state.setdefault("campaign_config", {})
        for cname, cstatus in status_map.items():
            cfg.setdefault(cname, {})["effective_status"] = cstatus
    except Exception:
        pass

    # Recharger le df complet en session
    try:
        persisted = fetch_meta_ads(supabase, user_id)
        df_loaded = pd.DataFrame(persisted) if persisted else pd.DataFrame(rows)
    except Exception:
        df_loaded = pd.DataFrame(rows)
    if not df_loaded.empty and "campaign_name" in df_loaded.columns:
        df_loaded["effective_status"] = df_loaded["campaign_name"].map(
            lambda c: status_map.get(c, "UNKNOWN")
        )
    st.session_state["meta_ads_df"] = df_loaded
    return {"success": True, "rows": len(rows), "message": f"{len(rows)} entrées chargées"}


@st.fragment
def meta_ads_source_fragment(token, supabase=None, user_id=None):
    if supabase and user_id and "meta_ads_df" not in st.session_state:
        try:
            persisted = fetch_meta_ads(supabase, user_id)
            if persisted:
                st.session_state["meta_ads_df"] = pd.DataFrame(persisted)
        except Exception:
            pass

    r = requests.get(
        "https://graph.facebook.com/v24.0/me/adaccounts",
        params={"fields": "id,name", "access_token": token}
    )
    ad_accounts = r.json().get("data", [])

    if ad_accounts:
        for acc in ad_accounts:
            r2 = requests.get(
                f"https://graph.facebook.com/v24.0/{acc['id']}/campaigns",
                params={"fields": "id", "access_token": token, "limit": 1000}
            )
            nb_campaigns = len(r2.json().get("data", []))
            st.markdown(
                f"<div class='account-name'>{acc['name']}</div>"
                f"<div class='account-meta'>{nb_campaigns} campagne(s)</div>",
                unsafe_allow_html=True,
            )
    else:
        st.markdown(
            "<div style='color:#6b6b6b;padding:12px 0'>Aucun compte publicitaire trouvé.</div>",
            unsafe_allow_html=True,
        )

    st.markdown("<br>", unsafe_allow_html=True)

    has_data = st.session_state.get("meta_ads_df") is not None
    btn_label = "Rafraîchir les données Meta Ads" if has_data else "Récupérer les données Meta Ads"
    from datetime import date as _date
    force_full = st.checkbox(
        f"Récupérer toute l'année {_date.today().year}",
        key="chk_force_full",
        help=f"Refait un fetch complet depuis le 1er janvier {_date.today().year}.",
    )
    if st.button(btn_label, type="primary", key="btn_fetch_meta_ads"):
        if not ad_accounts:
            st.warning("Aucun compte publicitaire trouvé.")
            return
        progress_bar = st.progress(0, text="Connexion à Meta Ads...")
        ad_account_id = ad_accounts[0]["id"]

        def _cb(pct, txt):
            try:
                progress_bar.progress(min(100, max(0, pct)), text=txt)
            except Exception:
                pass

        result = run_meta_ads_fetch(
            token=token, supabase=supabase, user_id=user_id,
            ad_account_id=ad_account_id, force_full=force_full,
            progress_cb=_cb,
        )

        if result.get("success"):
            progress_bar.progress(100, text=f"✓ {result.get('message', '')}")
            time.sleep(0.5)
            progress_bar.empty()
            if result.get("rows", 0) > 0:
                st.rerun()
            else:
                st.info(result.get("message", "Aucune nouvelle donnée."))
        else:
            progress_bar.empty()
            st.error(f"❌ {result.get('message', 'Erreur inconnue')}")


# ── Dashboard ─────────────────────────────────────────────────────────────────

def show_meta_ads_dashboard(df: pd.DataFrame | None = None, client=None, user_id: str | None = None):
    # Si df vide/None mais user connecté, tenter de re-fetch depuis Supabase
    if (df is None or (isinstance(df, pd.DataFrame) and df.empty)) and client and user_id:
        try:
            ads_data = fetch_meta_ads(client, user_id)
            if ads_data:
                df = pd.DataFrame(ads_data)
                st.session_state["meta_ads_df"] = df
        except Exception:
            pass

    if df is None or (isinstance(df, pd.DataFrame) and df.empty):
        st.info(
            "Aucune donnée Meta Ads disponible. "
            "Va sur **Paramètres → Meta Ads** puis clique sur **'Récupérer les données Meta Ads'** "
            "pour synchroniser tes campagnes."
        )
        return

    # ── Typage ──────────────────────────────────────────────────────────────
    for col in ["impressions", "clicks", "spend", "reach", "link_clicks"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    df["date_start"] = pd.to_datetime(df["date_start"], errors="coerce")

    # ── Injecter effective_status depuis campaign_config (si absent du df) ──
    # Le df vient de Supabase (meta_ads_insights) qui ne stocke pas effective_status.
    # Le statut est stocké dans meta_campaign_config (chargé dans campaign_config).
    cfg_for_status = st.session_state.get("campaign_config", {}) or {}
    if "campaign_name" in df.columns:
        # Si la colonne effective_status manque OU est vide partout, on la (re)remplit
        needs_inject = ("effective_status" not in df.columns) or df["effective_status"].fillna("").eq("").all()
        if needs_inject:
            df["effective_status"] = df["campaign_name"].map(
                lambda c: (cfg_for_status.get(c) or {}).get("effective_status") or ""
            )

    # ── Période selector (.seg) ──────────────────────────────────────────────
    from datetime import date, timedelta
    period_opts = {"24h": 1, "7j": 7, "30j": 30, "90j": 90, "Tout": 36500}

    # Smart default : choisit la période la + courte qui contient des données
    # (évite "Aucune donnée pour ces filtres" sur la période par défaut)
    if "mad_period" not in st.session_state:
        latest_date_in_df = df["date_start"].max() if not df.empty else None
        if latest_date_in_df is not None and pd.notna(latest_date_in_df):
            days_since = (pd.Timestamp(date.today()) - latest_date_in_df).days
            if days_since <= 1:    default_period = "24h"
            elif days_since <= 7:  default_period = "7j"
            elif days_since <= 30: default_period = "30j"
            elif days_since <= 90: default_period = "90j"
            else:                  default_period = "Tout"
        else:
            default_period = "30j"
        st.session_state["mad_period"] = default_period

    col_period, col_status, col_camp = st.columns([2, 2, 3])
    with col_period:
        sel_period = st.radio(
            "Période", list(period_opts.keys()),
            horizontal=True, key="mad_period",
        )
    days = period_opts[sel_period]
    cutoff = pd.Timestamp(date.today() - timedelta(days=days))
    df_view = df[df["date_start"] >= cutoff].copy()

    with col_status:
        if "effective_status" in df.columns and df["effective_status"].notna().any():
            status_opts = sorted([s for s in df["effective_status"].dropna().unique() if s])
            sel_status = st.multiselect(
                "Statut", options=status_opts, key="mad_status",
                placeholder="Tous les statuts",
            )
            # Toggle rapide "Uniquement actives"
            only_active = st.checkbox(
                "Uniquement actives", value=False, key="mad_only_active",
                help="Filtre rapide pour ne voir que les campagnes ACTIVE",
            )
            if only_active:
                df_view = df_view[df_view["effective_status"].astype(str).str.upper() == "ACTIVE"]
            elif sel_status:
                df_view = df_view[df_view["effective_status"].isin(sel_status)]

    with col_camp:
        sel_campaigns = st.multiselect(
            "Campagne", options=sorted(df["campaign_name"].dropna().unique()),
            key="mad_campaigns", placeholder="Toutes les campagnes",
        )
        if sel_campaigns:
            df_view = df_view[df_view["campaign_name"].isin(sel_campaigns)]

    if df_view.empty:
        # Message plus utile : distinguer "filtres trop stricts" vs "pas de données du tout"
        latest_date_in_df = df["date_start"].max() if not df.empty else None
        if latest_date_in_df is not None and pd.notna(latest_date_in_df):
            latest_str = latest_date_in_df.strftime("%d %b %Y")
            st.info(
                f"Aucune donnée sur la période **{sel_period}**. "
                f"Ta dernière donnée disponible date du **{latest_str}** — "
                "essaie une période plus large (30j, 90j ou Tout) ou rafraîchis tes données depuis Paramètres."
            )
        else:
            st.info(
                "Aucune donnée Meta Ads disponible. Rafraîchis tes données "
                "depuis **Paramètres → Meta Ads**."
            )
        return

    # ── Agrégats globaux ─────────────────────────────────────────────────────
    total_spend       = df_view["spend"].sum()
    total_clicks      = int(df_view["clicks"].sum())
    total_impressions = int(df_view["impressions"].sum())
    avg_ctr  = (total_clicks / total_impressions * 100) if total_impressions > 0 else 0.0
    avg_cpc  = (total_spend / total_clicks) if total_clicks > 0 else 0.0

    if total_spend == 0:
        st.info("Aucune dépense sur cette période.")
        return

    nb_active = 0
    if "effective_status" in df_view.columns:
        nb_active = int(df_view[df_view["effective_status"] == "ACTIVE"]["campaign_name"].nunique())
    nb_paused = int(df_view["campaign_name"].nunique()) - nb_active

    # ── Agrégat quotidien (avant KPI grid pour sparklines) ───────────────────
    df_daily = (
        df_view.groupby("date_start", as_index=False)
        .agg(spend=("spend","sum"), clicks=("clicks","sum"), impressions=("impressions","sum"))
    ).sort_values("date_start")
    df_daily["ctr"] = df_daily.apply(
        lambda r: r["clicks"] / r["impressions"] * 100 if r["impressions"] > 0 else 0, axis=1)
    df_daily["cpc"] = df_daily.apply(
        lambda r: r["spend"] / r["clicks"] if r["clicks"] > 0 else 0, axis=1)

    spark_spend  = df_daily["spend"].tail(7).tolist()
    spark_clicks = df_daily["clicks"].tail(7).tolist()
    spark_ctr    = df_daily["ctr"].tail(7).tolist()
    spark_cpc    = df_daily["cpc"].tail(7).tolist()

    # ── Hero ────────────────────────────────────────────────────────────────
    st.markdown(
        f'<div class="page-h">'
        f'<div class="h-eyebrow">Meta Ads · {sel_period} derniers jours</div>'
        f'<h1>{nb_active} campagne{"s" if nb_active != 1 else ""} en cours, {total_spend:,.0f} CHF dépensés.</h1>'
        f'<p class="h-sub">'
        f'CTR moyen <b>{avg_ctr:.2f} %</b> · CPC moyen <b>{avg_cpc:.2f} CHF</b>. '
        f'{nb_paused} campagne{"s" if nb_paused != 1 else ""} en pause sur la période.'
        f'</p>'
        f'</div>',
        unsafe_allow_html=True,
    )

    # ── KPI grid ────────────────────────────────────────────────────────────
    st.markdown(
        f'<div class="kpi-grid">'
        f'{_kpi("Dépensé", f"{total_spend:,.0f}", "CHF", spark=spark_spend)}'
        f'{_kpi("Clics", f"{total_clicks:,}", spark=spark_clicks, spark_color="#0e0f12")}'
        f'{_kpi("CTR moyen", f"{avg_ctr:.2f}", "%", spark=spark_ctr, spark_color="#1a7a4a")}'
        f'{_kpi("CPC moyen", f"{avg_cpc:.2f}", "CHF", invert=True, spark=spark_cpc, spark_color="#c0392b")}'
        f'</div>',
        unsafe_allow_html=True,
    )

    # ── Chart section ────────────────────────────────────────────────────────
    metric_map = {
        "Dépenses (CHF)": ("spend", "CHF"),
        "Clics":          ("clicks", ""),
        "CTR (%)":        ("ctr", "%"),
        "CPC (CHF)":      ("cpc", "CHF"),
    }
    col_title, col_metric = st.columns([3, 2])
    with col_title:
        st.markdown('<div class="section-title">Évolution quotidienne</div>', unsafe_allow_html=True)
    with col_metric:
        sel_metric_label = st.radio(
            "Métrique", list(metric_map.keys()),
            horizontal=True, key="mad_metric",
        )

    metric_col, metric_unit = metric_map[sel_metric_label]
    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=df_daily["date_start"], y=df_daily[metric_col],
        mode="lines+markers",
        line=dict(color="#3b5bff", width=2),
        marker=dict(size=4, color="#fff", line=dict(color="#3b5bff", width=2)),
        fill="tozeroy",
        fillcolor="rgba(59,91,255,0.07)",
        hovertemplate=f"%{{x|%d %b}}<br>%{{y:.2f}} {metric_unit}<extra></extra>",
    ))
    fig.update_layout(
        template="plotly_white", height=240,
        margin=dict(l=0, r=0, t=10, b=0),
        paper_bgcolor="#ffffff", plot_bgcolor="#ffffff",
        font=dict(color="#666", family="Inter, sans-serif"),
        xaxis=dict(showgrid=False, color="#999", linecolor="rgba(0,0,0,0.07)"),
        yaxis=dict(showgrid=True, gridcolor="#f4f3f1", color="#999"),
        showlegend=False,
    )
    st.markdown('<div class="card" style="padding:16px 20px 8px;">', unsafe_allow_html=True)
    st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
    st.markdown('</div>', unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)

    # ── Agrégat par campagne ─────────────────────────────────────────────────
    df_camp = (
        df_view.groupby("campaign_name", as_index=False)
        .agg(spend=("spend","sum"), clicks=("clicks","sum"), impressions=("impressions","sum"))
    )
    df_camp["ctr"] = df_camp.apply(
        lambda r: r["clicks"] / r["impressions"] * 100 if r["impressions"] > 0 else 0, axis=1)
    df_camp["cpc"] = df_camp.apply(
        lambda r: r["spend"] / r["clicks"] if r["clicks"] > 0 else 0, axis=1)

    _cpc_pos = df_camp[df_camp["cpc"] > 0]["cpc"]
    avg_ctr_all = df_camp["ctr"].mean() if not df_camp.empty else 0.0
    avg_cpc_all = _cpc_pos.mean() if not _cpc_pos.empty else 0.0

    # Récupérer statut le plus fréquent par campagne
    camp_status = {}
    if "effective_status" in df_view.columns:
        for camp, grp in df_view.groupby("campaign_name"):
            # Filtrer NaN/None avant de prendre le mode
            valid = grp["effective_status"].dropna().astype(str).str.strip()
            valid = valid[valid != ""]
            mode = valid.mode() if not valid.empty else pd.Series(dtype=str)
            camp_status[camp] = mode.iloc[0] if not mode.empty else ""

    # Trier : actives d'abord, puis par dépenses décroissantes
    def _sort_key(r):
        status = camp_status.get(r["campaign_name"], "")
        return (0 if status == "ACTIVE" else 1, -r["spend"])
    df_camp_sorted = df_camp.copy()
    df_camp_sorted["_sort"] = df_camp_sorted.apply(_sort_key, axis=1)
    df_camp_sorted = df_camp_sorted.sort_values("_sort").drop(columns=["_sort"])

    nb_active_camp = sum(1 for c in df_camp_sorted["campaign_name"]
                        if camp_status.get(c, "").upper() == "ACTIVE")
    nb_paused_camp = sum(1 for c in df_camp_sorted["campaign_name"]
                         if "PAUSED" in camp_status.get(c, "").upper())
    nb_unknown_camp = sum(1 for c in df_camp_sorted["campaign_name"]
                          if camp_status.get(c, "").upper() in _UNKNOWN_STATUSES)
    total_camp = len(df_camp_sorted)

    # Warning si TOUS les statuts sont inconnus (donnée legacy / API pas refetch / colonne SQL manquante)
    if total_camp > 0 and nb_unknown_camp == total_camp:
        st.warning(
            "⚠ Statut des campagnes non récupéré. Si tu viens de rafraîchir et "
            "que tu vois toujours ce message : la colonne `effective_status` "
            "doit être ajoutée dans Supabase. Exécute le SQL "
            "`supabase/migrations/meta_campaign_status.sql` dans le SQL Editor, "
            "puis rafraîchis tes données Meta Ads."
        )

    # Compteur dans le titre
    if nb_unknown_camp > 0 and nb_unknown_camp < total_camp:
        count_txt = f"{nb_active_camp} actives · {nb_paused_camp} en pause · {nb_unknown_camp} statut inconnu"
    elif nb_unknown_camp == total_camp:
        count_txt = f"{total_camp} campagne{'s' if total_camp != 1 else ''} · statut inconnu"
    else:
        count_txt = f"{nb_active_camp} actives · {nb_paused_camp} en pause"

    campaign_labels: list[str] = st.session_state.get("campaign_labels", [])
    campaign_config: dict      = st.session_state.get("campaign_config", {})
    label_options = [_NO_LABEL] + sorted(campaign_labels)

    # ── Performance par label (au-dessus de la liste des campagnes) ─────────
    st.markdown(
        '<div class="section-head">'
        '<div class="section-title">Performance par label</div></div>',
        unsafe_allow_html=True,
    )
    _agg_perf = _build_agg_by_label(df_view, campaign_config)
    _render_perf_by_label(_agg_perf)
    st.markdown("<br>", unsafe_allow_html=True)

    # ── Section Campagnes ───────────────────────────────────────────────────
    st.markdown(
        f'<div class="section-head">'
        f'<div class="section-title">Campagnes '
        f'<span class="st-count">{count_txt}</span>'
        f'</div></div>',
        unsafe_allow_html=True,
    )

    # Une carte par campagne (st.container border + st.columns)
    for _, row in df_camp_sorted.iterrows():
        camp_name = row["campaign_name"]
        status = camp_status.get(camp_name, "")
        note_text, note_color = _camp_note(row, avg_ctr_all, avg_cpc_all)
        score, health_color = _health(row, avg_ctr_all, avg_cpc_all)
        is_paused = "PAUSED" in status.upper()
        op = "0.62" if is_paused else "1"

        current_label = (campaign_config.get(camp_name) or {}).get("label") or None

        health_html = (
            f'<div style="font-family:var(--font-mono);font-size:13px;font-weight:500;color:{health_color};text-align:right;">{score}/100</div>'
            f'<div class="bar" style="margin-top:3px;"><span style="width:{score}%;background:{health_color};"></span></div>'
            if score is not None else '<div style="font-size:11.5px;color:#8b8e98;text-align:right;">—</div>'
        )

        with st.container(border=True):
            c_lbl, c_name, c_status, c_spend, c_clicks, c_ctr, c_cpc, c_health = st.columns(
                [1.6, 2.6, 1, 1, 0.9, 0.9, 1, 1.1]
            )

            # ── Col 1 : Label (selectbox éditable à gauche) ──
            with c_lbl:
                if client and user_id:
                    safe_key = camp_name.replace(" ", "_").replace("/", "_")[:50]
                    existing = current_label or _NO_LABEL
                    opts = label_options.copy()
                    if existing not in opts:
                        opts.insert(1, existing)
                    lbl_key = f"perf_lbl_{safe_key}"
                    if lbl_key not in st.session_state:
                        st.session_state[lbl_key] = existing
                    st.selectbox(
                        "Label", options=opts, key=lbl_key,
                        label_visibility="collapsed",
                        on_change=_cb_save_camp_label, args=(client, user_id, camp_name, lbl_key),
                    )
                else:
                    chip = (
                        f'<span class="chip">{current_label}</span>'
                        if current_label else '<span class="chip outline">—</span>'
                    )
                    st.markdown(f'<div style="padding-top:6px;">{chip}</div>', unsafe_allow_html=True)

            # ── Col 2 : Nom + diagnostic ──
            with c_name:
                st.markdown(
                    f'<div style="opacity:{op};padding-top:4px;">'
                    f'<div style="font-size:13.5px;font-weight:600;margin-bottom:2px;line-height:1.2;color:#0e0f12;">{camp_name}</div>'
                    f'<div style="font-size:11px;color:{note_color};line-height:1.3;">{note_text}</div>'
                    f'</div>',
                    unsafe_allow_html=True,
                )

            # ── Col 3 : Status chip ──
            with c_status:
                st.markdown(
                    f'<div style="padding-top:8px;opacity:{op};">{_status_chip(status)}</div>',
                    unsafe_allow_html=True,
                )

            # ── Cols 4-7 : Dépensé / Clics / CTR / CPC (chacune avec eyebrow + valeur) ──
            cells = [
                (c_spend,  "DÉPENSÉ", f"{row['spend']:,.0f} CHF" if row['spend'] > 0 else "—"),
                (c_clicks, "CLICS",   f"{int(row['clicks']):,}" if row['clicks'] > 0 else "—"),
                (c_ctr,    "CTR",     f"{row['ctr']:.2f} %"      if row['ctr']    > 0 else "—"),
                (c_cpc,    "CPC",     f"{row['cpc']:.2f} CHF"    if row['cpc']    > 0 else "—"),
            ]
            for col, lbl, val in cells:
                with col:
                    st.markdown(
                        f'<div style="opacity:{op};text-align:right;">'
                        f'<div style="font-size:10px;font-weight:600;text-transform:uppercase;'
                        f'letter-spacing:0.06em;color:#8b8e98;margin-bottom:4px;">{lbl}</div>'
                        f'<div style="font-family:var(--font-mono);font-size:13px;'
                        f'font-weight:500;color:#0e0f12;">{val}</div>'
                        f'</div>',
                        unsafe_allow_html=True,
                    )

            # ── Col 8 : Santé (eyebrow + score + bar) ──
            with c_health:
                st.markdown(
                    f'<div style="opacity:{op};">'
                    f'<div style="font-size:10px;font-weight:600;text-transform:uppercase;'
                    f'letter-spacing:0.06em;color:#8b8e98;margin-bottom:4px;text-align:right;">SANTÉ</div>'
                    f'{health_html}'
                    f'</div>',
                    unsafe_allow_html=True,
                )


# ── Helper : agrégat par label (utilisé par Perf et Coût) ─────────────────────

def _build_agg_by_label(df_view: pd.DataFrame, campaign_config: dict) -> pd.DataFrame:
    """Construit l'aggregat par label depuis df_view (filtré période) + campaign_config."""
    df_c = (
        df_view.groupby("campaign_name", as_index=False)
        .agg(
            spend=("spend", "sum"),
            impressions=("impressions", "sum"),
            clicks=("clicks", "sum"),
        )
    )
    df_c["label"] = df_c["campaign_name"].map(
        lambda c: (campaign_config.get(c) or {}).get("label") or None
    )
    df_c["budget_max"] = df_c["campaign_name"].map(
        lambda c: float((campaign_config.get(c) or {}).get("budget_max") or 0)
    )
    df_c["label_display"] = df_c["label"].fillna(_NO_LABEL).replace("", _NO_LABEL)
    agg = (
        df_c.groupby("label_display", as_index=False)
        .agg(
            spend=("spend", "sum"),
            budget=("budget_max", "sum"),
            impressions=("impressions", "sum"),
            clicks=("clicks", "sum"),
            campaigns=("campaign_name", "nunique"),
        )
    )
    agg["ctr"]    = agg.apply(lambda r: (r["clicks"] / r["impressions"] * 100) if r["impressions"] > 0 else 0.0, axis=1)
    agg["cpc"]    = agg.apply(lambda r: (r["spend"] / r["clicks"]) if r["clicks"] > 0 else 0.0, axis=1)
    agg["cpm"]    = agg.apply(lambda r: (r["spend"] / r["impressions"] * 1000) if r["impressions"] > 0 else 0.0, axis=1)
    agg["pacing"] = agg.apply(lambda r: (r["spend"] / r["budget"] * 100) if r["budget"] > 0 else None, axis=1)
    return agg


def _render_perf_by_label(agg: pd.DataFrame) -> None:
    """Rendu 'Performance par label' pour la tab Performance (SANS Dépensé)."""
    if agg.empty:
        st.info("Aucune campagne.")
        return

    # Best = meilleur CTR parmi les vrais labels
    real_lbls = agg[agg["label_display"] != _NO_LABEL]
    best_lbl = real_lbls.iloc[real_lbls["ctr"].argmax()]["label_display"] if not real_lbls.empty else None

    # Tri : (sans label) à la fin, le reste par CTR desc
    agg = agg.copy()
    agg["_ord"] = agg["label_display"].apply(lambda x: 1 if x == _NO_LABEL else 0)
    agg = agg.sort_values(["_ord", "ctr"], ascending=[True, False]).drop(columns=["_ord"])
    max_ctr = agg["ctr"].max() or 1

    hcols = st.columns([3, 1.2, 1.6, 1.4, 1.4, 1.4])
    headers = ["Label", "Camp.", "Impr.", "CTR %", "CPC", "CPM"]
    for col_h, lbl in zip(hcols, headers):
        col_h.markdown(
            f'<div style="font-size:10px;font-weight:600;text-transform:uppercase;'
            f'letter-spacing:0.06em;color:#8b8e98;padding-bottom:6px;">{lbl}</div>',
            unsafe_allow_html=True,
        )

    for _, r in agg.iterrows():
        lbl_name = r["label_display"]
        is_best = (lbl_name == best_lbl) and lbl_name != _NO_LABEL
        is_no_label = lbl_name == _NO_LABEL
        bar_pct = (r["ctr"] / max_ctr * 100) if max_ctr > 0 else 0
        trophy = "🏆 " if is_best else ""
        name_color = "#8b8e98" if is_no_label else "#0e0f12"
        name_weight = "500" if is_no_label else "600"
        cpc_str = f"{r['cpc']:.2f} CHF" if r["cpc"] > 0 else "—"
        cpm_str = f"{r['cpm']:.2f} CHF" if r["cpm"] > 0 else "—"

        c_name, c_camps, c_impr, c_ctr, c_cpc, c_cpm = st.columns([3, 1.2, 1.6, 1.4, 1.4, 1.4])
        with c_name:
            st.markdown(
                f'<div style="font-size:13.5px;font-weight:{name_weight};color:{name_color};padding-top:4px;">'
                f'{trophy}{lbl_name}</div>'
                f'<div style="height:3px;background:rgba(14,15,18,0.06);border-radius:99px;margin-top:6px;overflow:hidden;">'
                f'<div style="height:100%;width:{bar_pct:.1f}%;background:#3b5bff;border-radius:99px;"></div>'
                f'</div>',
                unsafe_allow_html=True,
            )
        for col, val in [
            (c_camps, f"{int(r['campaigns'])}"),
            (c_impr,  f"{int(r['impressions']):,}"),
            (c_ctr,   f"{r['ctr']:.2f}%"),
            (c_cpc,   cpc_str),
            (c_cpm,   cpm_str),
        ]:
            with col:
                st.markdown(
                    f'<div style="font-family:var(--font-mono,ui-monospace,monospace);'
                    f'font-size:13px;font-weight:500;color:#0e0f12;padding-top:6px;">{val}</div>',
                    unsafe_allow_html=True,
                )


def _render_cout_by_label(agg: pd.DataFrame) -> None:
    """Rendu 'Performance par label' pour la tab Coût (UNIQUEMENT Dépensé + Budget planifié + Pacing)."""
    if agg.empty:
        st.info("Aucune dépense.")
        return

    # Best = plus grosse dépense (sauf sans label)
    real_lbls = agg[agg["label_display"] != _NO_LABEL]
    best_lbl = real_lbls.iloc[real_lbls["spend"].argmax()]["label_display"] if not real_lbls.empty else None

    # Tri : (sans label) à la fin, le reste par dépensé desc
    agg = agg.copy()
    agg["_ord"] = agg["label_display"].apply(lambda x: 1 if x == _NO_LABEL else 0)
    agg = agg.sort_values(["_ord", "spend"], ascending=[True, False]).drop(columns=["_ord"])
    max_spend = agg["spend"].max() or 1

    hcols = st.columns([3, 1.2, 1.8, 1.8, 2])
    headers = ["Label", "Camp.", "Dépensé", "Budget planifié", "Pacing"]
    for col_h, lbl in zip(hcols, headers):
        col_h.markdown(
            f'<div style="font-size:10px;font-weight:600;text-transform:uppercase;'
            f'letter-spacing:0.06em;color:#8b8e98;padding-bottom:6px;">{lbl}</div>',
            unsafe_allow_html=True,
        )

    for _, r in agg.iterrows():
        lbl_name = r["label_display"]
        is_best = (lbl_name == best_lbl) and lbl_name != _NO_LABEL
        is_no_label = lbl_name == _NO_LABEL
        bar_pct = (r["spend"] / max_spend * 100) if max_spend > 0 else 0
        trophy = "🏆 " if is_best else ""
        name_color = "#8b8e98" if is_no_label else "#0e0f12"
        name_weight = "500" if is_no_label else "600"
        bud_str = f"{r['budget']:,.0f} CHF" if r["budget"] > 0 else "—"

        c_name, c_camps, c_spend, c_bud, c_pacing = st.columns([3, 1.2, 1.8, 1.8, 2])
        with c_name:
            st.markdown(
                f'<div style="font-size:13.5px;font-weight:{name_weight};color:{name_color};padding-top:4px;">'
                f'{trophy}{lbl_name}</div>'
                f'<div style="height:3px;background:rgba(14,15,18,0.06);border-radius:99px;margin-top:6px;overflow:hidden;">'
                f'<div style="height:100%;width:{bar_pct:.1f}%;background:#3b5bff;border-radius:99px;"></div>'
                f'</div>',
                unsafe_allow_html=True,
            )
        for col, val in [
            (c_camps, f"{int(r['campaigns'])}"),
            (c_spend, f"{r['spend']:,.0f} CHF"),
            (c_bud,   bud_str),
        ]:
            with col:
                st.markdown(
                    f'<div style="font-family:var(--font-mono,ui-monospace,monospace);'
                    f'font-size:13px;font-weight:500;color:#0e0f12;padding-top:6px;">{val}</div>',
                    unsafe_allow_html=True,
                )
        with c_pacing:
            st.markdown(_pacing_row_html(r["spend"], r["budget"]), unsafe_allow_html=True)


# ── Coût tab ──────────────────────────────────────────────────────────────────

def _pacing_status(pct: float) -> tuple[str, str, str]:
    """Retourne (color, css_class, label) selon le ratio dépensé/budget."""
    if pct > 1.0:
        return "#c0392b", "cout-over", "⚠ Dépassé"
    if pct >= 0.7:
        return "#1a7a4a", "cout-ok", "✓ OK"
    return "#b86b00", "cout-low", "↓ Sous-dépense"


def _pacing_row_html(spend: float, budget: float) -> str:
    """Bloc HTML : statut + barre de pacing (pour le tableau par label / campagne)."""
    if budget <= 0:
        return (
            '<div style="font-size:11.5px;color:#8b8e98;padding-top:6px;">'
            '— pas de budget</div>'
        )
    pct = spend / budget
    color, cls, txt = _pacing_status(pct)
    return (
        f'<div style="font-size:12px;color:#5a5d66;margin-top:6px;">'
        f'<span class="{cls}">{txt}</span> — {pct*100:.0f}%</div>'
        f'<div class="cout-bar-wrap"><span class="cout-bar-fill" '
        f'style="width:{min(pct,1)*100:.1f}%;background:{color};"></span></div>'
    )


# ── Callbacks de sauvegarde (on_change) ───────────────────────────────────────

def _cb_save_budget_global(client, user_id):
    if not (client and user_id):
        return
    val = st.session_state.get("budget_global", 0)
    try:
        update_meta_budget_global(client, user_id, float(val or 0))
    except Exception as e:
        st.toast(f"Sauvegarde budget global échouée : {e}", icon="⚠️")


def _cb_save_camp_label(client, user_id, camp_name, key):
    if not (client and user_id):
        return
    val = st.session_state.get(key, _NO_LABEL)
    label = "" if val == _NO_LABEL else val
    # mettre à jour le cache local
    cfg = st.session_state.setdefault("campaign_config", {})
    cfg.setdefault(camp_name, {})["label"] = label or None
    try:
        upsert_campaign_config(client, user_id, camp_name, label=label)
    except Exception as e:
        st.toast(f"Sauvegarde label échouée : {e}", icon="⚠️")


def _cb_save_camp_budget(client, user_id, camp_name, key):
    if not (client and user_id):
        return
    val = st.session_state.get(key, 0)
    cfg = st.session_state.setdefault("campaign_config", {})
    cfg.setdefault(camp_name, {})["budget_max"] = float(val or 0)
    try:
        upsert_campaign_config(client, user_id, camp_name, budget_max=float(val or 0))
    except Exception as e:
        st.toast(f"Sauvegarde budget campagne échouée : {e}", icon="⚠️")


# ── Tab Labels (CRUD master list) ──────────────────────────────────────────────

def _show_labels_tab(client, user_id) -> None:
    if not (client and user_id):
        st.warning("Connecte ton compte pour gérer les labels.")
        return

    labels: list[str] = st.session_state.get("campaign_labels", [])

    st.markdown(
        '<div class="page-h" style="padding:8px 0 16px;">'
        '<div class="h-eyebrow">Labels</div>'
        '<h1>Tes étiquettes de campagne.</h1>'
        '<p class="h-sub">Crée des labels (ex. <i>Prospection</i>, <i>Retargeting</i>, <i>Black Friday</i>) '
        'puis assigne-les à tes campagnes dans l\'onglet <b>Performance</b>.</p>'
        '</div>',
        unsafe_allow_html=True,
    )

    # ── Compteur campagnes labelisées ──────────────────────────────────────
    campaign_config = st.session_state.get("campaign_config", {}) or {}
    df_meta = st.session_state.get("meta_ads_df")
    if df_meta is not None and not df_meta.empty and "campaign_name" in df_meta.columns:
        all_camps = df_meta["campaign_name"].dropna().unique().tolist()
        nb_camps = len(all_camps)
        nb_labeled = sum(
            1 for c in all_camps
            if (campaign_config.get(c) or {}).get("label")
        )
        if nb_camps > 0:
            pct = nb_labeled / nb_camps
            st.progress(
                pct,
                text=f"**{nb_labeled} / {nb_camps}** campagnes labelisées ({int(pct * 100)} %)",
            )
            st.markdown("<br>", unsafe_allow_html=True)

    # ── Ajouter (st.form gère le vidage automatique via clear_on_submit) ──────
    st.markdown('<div class="cout-section-title" style="margin-top:4px;">Ajouter un label</div>', unsafe_allow_html=True)
    with st.form("lbl_add_form", clear_on_submit=True):
        col_in, col_btn = st.columns([4, 1])
        with col_in:
            new_lbl = st.text_input(
                "Nouveau label",
                label_visibility="collapsed", placeholder="ex: Prospection Q2",
            )
        with col_btn:
            submitted = st.form_submit_button(
                "Ajouter", type="primary", use_container_width=True,
            )
    if submitted:
        cleaned = (new_lbl or "").strip()
        if not cleaned:
            st.toast("Saisis un nom de label.", icon="⚠️")
        elif cleaned in labels:
            st.toast(f"« {cleaned} » existe déjà.", icon="⚠️")
        else:
            new_list = labels + [cleaned]
            error = None
            try:
                update_campaign_labels(client, user_id, new_list)
            except Exception as e:
                error = e
            if error:
                st.toast(f"Ajout échoué : {error}", icon="⚠️")
            else:
                st.session_state["campaign_labels"] = new_list
                st.rerun()

    # ── Liste + renommer / supprimer ─────────────────────────────────────────
    st.markdown('<div class="cout-section-title">Tes labels</div>', unsafe_allow_html=True)

    if not labels:
        st.info("Aucun label pour l'instant. Crée-en un ci-dessus.")
        return

    hcols = st.columns([5, 2, 2])
    for col_h, lbl in zip(hcols, ["Nom", "Renommer", "Supprimer"]):
        col_h.markdown(
            f'<div style="font-size:10px;font-weight:600;text-transform:uppercase;'
            f'letter-spacing:0.06em;color:#8b8e98;padding-bottom:6px;">{lbl}</div>',
            unsafe_allow_html=True,
        )

    for i, lbl in enumerate(labels):
        c_name, c_save, c_del = st.columns([5, 2, 2])
        edit_key = f"lbl_tab_edit_{i}"
        with c_name:
            st.text_input(
                "Label", value=lbl, key=edit_key,
                label_visibility="collapsed",
            )
        with c_save:
            if st.button("Enregistrer", key=f"lbl_tab_rn_{i}",
                         use_container_width=True):
                # Validation au moment du click (pas avant)
                new_name = (st.session_state.get(edit_key) or "").strip()
                if new_name == lbl:
                    st.toast("Aucun changement.", icon="ℹ️")
                elif not new_name:
                    st.toast("Nom de label vide.", icon="⚠️")
                elif new_name in labels:
                    st.toast(f"« {new_name} » existe déjà.", icon="⚠️")
                else:
                    new_list = [new_name if x == lbl else x for x in labels]
                    error = None
                    try:
                        update_campaign_labels(client, user_id, new_list)
                        rename_campaign_label(client, user_id, lbl, new_name)
                    except Exception as e:
                        error = e
                    if error:
                        st.toast(f"Renommage échoué : {error}", icon="⚠️")
                    else:
                        st.session_state["campaign_labels"] = new_list
                        cfg = st.session_state.get("campaign_config", {})
                        for c in cfg.values():
                            if c.get("label") == lbl:
                                c["label"] = new_name
                        st.toast(f"Renommé en « {new_name} »", icon="✅")
                        st.rerun()
        with c_del:
            if st.button("🗑 Supprimer", key=f"lbl_tab_del_{i}", use_container_width=True):
                new_list = [x for x in labels if x != lbl]
                error = None
                try:
                    update_campaign_labels(client, user_id, new_list)
                    clear_campaign_label(client, user_id, lbl)
                except Exception as e:
                    error = e
                if error:
                    st.toast(f"Suppression échouée : {error}", icon="⚠️")
                else:
                    st.session_state["campaign_labels"] = new_list
                    cfg = st.session_state.get("campaign_config", {})
                    for c in cfg.values():
                        if c.get("label") == lbl:
                            c["label"] = None
                    st.rerun()


# ── Tab Coût (refonte) ─────────────────────────────────────────────────────────

def _show_cout_tab(df: pd.DataFrame | None, client=None, user_id: str | None = None) -> None:
    # Si df vide/None mais user connecté, tenter de re-fetch depuis Supabase
    if (df is None or (isinstance(df, pd.DataFrame) and df.empty)) and client and user_id:
        try:
            ads_data = fetch_meta_ads(client, user_id)
            if ads_data:
                df = pd.DataFrame(ads_data)
                st.session_state["meta_ads_df"] = df
        except Exception:
            pass

    if df is None or (isinstance(df, pd.DataFrame) and df.empty):
        st.info(
            "Aucune donnée Meta Ads. Va sur **Paramètres → Meta Ads** puis "
            "**'Récupérer les données Meta Ads'**."
        )
        return

    from datetime import date, timedelta

    df = df.copy()
    for col in ["impressions", "clicks", "spend", "reach", "link_clicks"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    df["date_start"] = pd.to_datetime(df["date_start"], errors="coerce")

    # ── Bloc 1 : Période + Budget global ─────────────────────────────────────
    period_opts = {"7j": 7, "30j": 30, "90j": 90, "Tout": 36500}

    # Smart default : choisit la période la + courte qui contient des données
    if "cout_period" not in st.session_state:
        latest_in_df = df["date_start"].max() if not df.empty else None
        if latest_in_df is not None and pd.notna(latest_in_df):
            days_since = (pd.Timestamp(date.today()) - latest_in_df).days
            if days_since <= 7:    default_p = "7j"
            elif days_since <= 30: default_p = "30j"
            elif days_since <= 90: default_p = "90j"
            else:                  default_p = "Tout"
        else:
            default_p = "30j"
        st.session_state["cout_period"] = default_p

    col_period, col_budget = st.columns([3, 2])
    with col_period:
        sel_period = st.radio(
            "Période", list(period_opts.keys()),
            horizontal=True, key="cout_period",
        )
    with col_budget:
        st.number_input(
            "Budget global (CHF)", min_value=0.0, step=100.0,
            key="budget_global", format="%.0f",
            help="Saisi une fois — sauvegardé automatiquement.",
            on_change=_cb_save_budget_global, args=(client, user_id),
        )

    days = period_opts[sel_period]
    cutoff = pd.Timestamp(date.today() - timedelta(days=days))
    df_v = df[df["date_start"] >= cutoff].copy()
    if df_v.empty:
        latest_in_df = df["date_start"].max() if not df.empty else None
        if latest_in_df is not None and pd.notna(latest_in_df):
            latest_str = latest_in_df.strftime("%d %b %Y")
            st.info(
                f"Aucune donnée sur la période **{sel_period}**. "
                f"Ta dernière donnée date du **{latest_str}** — "
                "essaie 'Tout' ou rafraîchis tes données."
            )
        else:
            st.info("Aucune donnée Meta Ads disponible.")
        return

    # ── Agrégats globaux ─────────────────────────────────────────────────────
    total_spend       = df_v["spend"].sum()
    total_impressions = int(df_v["impressions"].sum())
    total_clicks      = int(df_v["clicks"].sum())
    total_link_clicks = int(df_v["link_clicks"].sum()) if "link_clicks" in df_v.columns else 0

    avg_cpm = (total_spend / total_impressions * 1000) if total_impressions > 0 else 0.0
    avg_cpc = (total_spend / total_clicks) if total_clicks > 0 else 0.0
    cpv     = (total_spend / total_link_clicks) if total_link_clicks > 0 else None

    # ── Bloc 2 : KPI cards ────────────────────────────────────────────────────
    c1, c2, c3, c4 = st.columns(4)
    kpis = [
        (c1, "Total dépensé", f"{total_spend:,.0f}",        "CHF"),
        (c2, "CPM moyen",     f"{avg_cpm:.2f}",              "CHF"),
        (c3, "CPC moyen",     f"{avg_cpc:.2f}",              "CHF"),
        (c4, "CPV",           f"{cpv:.2f}" if cpv else "—",  "CHF" if cpv else ""),
    ]
    for col, lbl, val, unit in kpis:
        with col:
            st.markdown(
                f'<div class="kpi-p"><div class="kp-lbl">{lbl}</div>'
                f'<div class="kp-val">{val}<span class="kp-unit"> {unit}</span></div></div>',
                unsafe_allow_html=True,
            )

    # Barre de progression budget global
    budget_global = float(st.session_state.get("budget_global", 0) or 0)
    if budget_global > 0:
        pct = min(total_spend / budget_global, 1.0)
        bar_color = "#c0392b" if pct >= 1.0 else "#3b5bff"
        st.markdown(
            f'<div style="font-size:12px;color:#5a5d66;margin:14px 0 4px;">'
            f'{total_spend:,.0f} / {budget_global:,.0f} CHF — <b>{pct*100:.0f}%</b> du budget global</div>'
            f'<div class="cout-bar-wrap"><span class="cout-bar-fill" '
            f'style="width:{pct*100:.1f}%;background:{bar_color};"></span></div>',
            unsafe_allow_html=True,
        )

    # ── Bloc 3 : Performance par label (dépenses + budget planifié + pacing) ─
    campaign_labels: list[str] = st.session_state.get("campaign_labels", [])
    campaign_config: dict      = st.session_state.get("campaign_config", {})

    # df_camp reste utilisé plus bas par le détail campagne
    df_camp = (
        df_v.groupby("campaign_name", as_index=False)
        .agg(
            spend=("spend", "sum"),
            impressions=("impressions", "sum"),
            clicks=("clicks", "sum"),
        )
        .sort_values("spend", ascending=False)
    )
    df_camp["label"] = df_camp["campaign_name"].map(
        lambda c: (campaign_config.get(c) or {}).get("label") or None
    )
    df_camp["budget_max"] = df_camp["campaign_name"].map(
        lambda c: float((campaign_config.get(c) or {}).get("budget_max") or 0)
    )

    st.markdown('<div class="cout-section-title">Performance par label</div>', unsafe_allow_html=True)
    _agg_cout = _build_agg_by_label(df_v, campaign_config)
    _render_cout_by_label(_agg_cout)

    # ── Bloc 4 : Détail par campagne (budget max éditable, label lecture seule) ─
    st.markdown('<div class="cout-section-title">Détail par campagne</div>', unsafe_allow_html=True)
    st.markdown(
        '<div style="font-size:11.5px;color:#8b8e98;margin-bottom:10px;">'
        'Assigne les labels depuis l\'onglet <b>Performance</b>. '
        'Gère la liste des labels dans l\'onglet <b>Labels</b>.'
        '</div>',
        unsafe_allow_html=True,
    )

    # Une carte par campagne (st.container border + st.columns)
    for _, row in df_camp.iterrows():
        camp_name = row["campaign_name"]
        spend     = float(row["spend"])
        bud_existing = float(row["budget_max"] or 0)
        current_label = row["label"] or None
        safe_key = camp_name.replace(" ", "_").replace("/", "_")[:50]

        with st.container(border=True):
            c_name, c_lbl, c_spend, c_bud, c_pacing = st.columns(
                [2.6, 1.4, 1.4, 1.6, 2.4]
            )

            # ── Col 1 : Nom campagne ──
            with c_name:
                st.markdown(
                    f'<div style="padding-top:8px;">'
                    f'<div style="font-size:10px;font-weight:600;text-transform:uppercase;'
                    f'letter-spacing:0.06em;color:#8b8e98;margin-bottom:4px;">CAMPAGNE</div>'
                    f'<div style="font-size:13.5px;font-weight:600;color:#0e0f12;line-height:1.2;">{camp_name}</div>'
                    f'</div>',
                    unsafe_allow_html=True,
                )

            # ── Col 2 : Label (lecture seule, chip) ──
            with c_lbl:
                if current_label:
                    chip_html = f'<span class="chip">{current_label}</span>'
                else:
                    chip_html = '<span class="chip outline">sans label</span>'
                st.markdown(
                    f'<div style="padding-top:8px;text-align:right;">'
                    f'<div style="font-size:10px;font-weight:600;text-transform:uppercase;'
                    f'letter-spacing:0.06em;color:#8b8e98;margin-bottom:4px;">LABEL</div>'
                    f'<div>{chip_html}</div>'
                    f'</div>',
                    unsafe_allow_html=True,
                )

            # ── Col 3 : Dépensé ──
            with c_spend:
                st.markdown(
                    f'<div style="padding-top:8px;text-align:right;">'
                    f'<div style="font-size:10px;font-weight:600;text-transform:uppercase;'
                    f'letter-spacing:0.06em;color:#8b8e98;margin-bottom:4px;">DÉPENSÉ</div>'
                    f'<div style="font-family:var(--font-mono);font-size:13px;font-weight:500;color:#0e0f12;">{spend:,.0f} CHF</div>'
                    f'</div>',
                    unsafe_allow_html=True,
                )

            # ── Col 4 : Budget planifié (number_input éditable) ──
            with c_bud:
                st.markdown(
                    '<div style="font-size:10px;font-weight:600;text-transform:uppercase;'
                    'letter-spacing:0.06em;color:#8b8e98;margin-bottom:2px;padding-top:2px;">BUDGET PLANIFIÉ</div>',
                    unsafe_allow_html=True,
                )
                bud_key = f"cout_bud_{safe_key}"
                if bud_key not in st.session_state:
                    st.session_state[bud_key] = bud_existing
                st.number_input(
                    "Budget planifié", min_value=0.0, step=100.0, format="%.0f",
                    key=bud_key, label_visibility="collapsed",
                    on_change=_cb_save_camp_budget, args=(client, user_id, camp_name, bud_key),
                )

            # ── Col 5 : Pacing (status + barre colorée) ──
            with c_pacing:
                current_bud = float(st.session_state.get(bud_key, 0) or 0)
                if current_bud > 0:
                    pct = spend / current_bud
                    bar_color = "#c0392b" if pct > 1 else "#1a7a4a" if pct >= 0.7 else "#b86b00"
                    if pct > 1:
                        status_cls, status_txt = "cout-over", "⚠ Dépassé"
                    elif pct >= 0.7:
                        status_cls, status_txt = "cout-ok", "✓ OK"
                    else:
                        status_cls, status_txt = "cout-low", "↓ Sous-dépense"
                    st.markdown(
                        f'<div style="padding-top:8px;">'
                        f'<div style="font-size:10px;font-weight:600;text-transform:uppercase;'
                        f'letter-spacing:0.06em;color:#8b8e98;margin-bottom:4px;">PACING</div>'
                        f'<div style="font-size:12px;color:#5a5d66;">'
                        f'<span class="{status_cls}">{status_txt}</span> — {pct*100:.0f}%</div>'
                        f'<div class="cout-bar-wrap"><span class="cout-bar-fill" '
                        f'style="width:{min(pct,1)*100:.1f}%;background:{bar_color};"></span></div>'
                        f'</div>',
                        unsafe_allow_html=True,
                    )
                else:
                    st.markdown(
                        '<div style="padding-top:8px;">'
                        '<div style="font-size:10px;font-weight:600;text-transform:uppercase;'
                        'letter-spacing:0.06em;color:#8b8e98;margin-bottom:4px;">PACING</div>'
                        '<div style="font-size:11.5px;color:#8b8e98;">— pas de budget</div>'
                        '</div>',
                        unsafe_allow_html=True,
                    )


# ── Tab entry point ───────────────────────────────────────────────────────────

def show_meta_ads_tab(is_paid: bool = False, client=None, user_id: str | None = None):
    st.markdown(PULSE_CSS, unsafe_allow_html=True)
    df = st.session_state.get("meta_ads_df")

    # Chargement labels + budget + config — une fois par session, partagé entre tabs
    _init_cout_state(client, user_id)

    _, col_insights_btn = st.columns([5, 1])
    with col_insights_btn:
        with st.popover("💡 Insights", use_container_width=True):
            show_insights_panel(
                df_meta=df,
                is_paid=is_paid,
                section="meta_ads",
                use_sidebar=False,
            )

    tab_perf, tab_cout, tab_labels = st.tabs(["Performance", "Coût", "Labels"])
    with tab_perf:
        show_meta_ads_dashboard(df, client=client, user_id=user_id)
    with tab_cout:
        _show_cout_tab(df, client=client, user_id=user_id)
    with tab_labels:
        _show_labels_tab(client, user_id)
