import time

import streamlit as st
import requests
import json
import pandas as pd
import plotly.graph_objects as go

from components.graph_style import apply_pulse_style, PULSE
from components.layout import (
    inject_hierarchy_css,
    section_hero,
    kpi_small,
    kpi_grid,
    divider as h_divider,
    compute_period_delta,
    compute_ratio_delta,
)

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
/* ── Active state — via :has() (Streamlit récent) ── */
div[data-testid="stRadio"] label[data-baseweb="radio"]:has(input:checked) {
    background:#3b5bff !important;
    box-shadow:0 2px 6px rgba(59,91,255,0.35);
}
div[data-testid="stRadio"] label[data-baseweb="radio"]:has(input:checked) *,
div[data-testid="stRadio"] label[data-baseweb="radio"]:has(input:checked) p,
div[data-testid="stRadio"] label[data-baseweb="radio"]:has(input:checked) > div:last-child {
    color:#ffffff !important;font-weight:600;
}
/* ── Fallback (ancienne structure aria-checked) ── */
div[data-testid="stRadio"] [aria-checked="true"][data-baseweb="radio"] {
    background:#3b5bff !important;
    box-shadow:0 2px 6px rgba(59,91,255,0.35);
}
div[data-testid="stRadio"] [aria-checked="true"][data-baseweb="radio"] *,
div[data-testid="stRadio"] [aria-checked="true"][data-baseweb="radio"] label {
    color:#ffffff !important;font-weight:600;
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
    # Recharge aussi si la liste a été invalidée (ex. label créé sur la page Labels)
    if st.session_state.get("cout_initialized") and "campaign_labels" in st.session_state:
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


# ── Sélecteur de période universel (presets + custom) ─────────────────────────

def render_period_selector(
    key: str,
    df_dates: "pd.Series | None" = None,
) -> "tuple[pd.Timestamp, pd.Timestamp]":
    """Rend un sélecteur de période avec presets + Custom date range.
    Returns: (since: Timestamp tz-naive, until: Timestamp tz-naive)
    - key : préfixe unique pour les widgets (ex. 'mad', 'cout', 'insta')
    - df_dates : Série de dates pour smart default + bornes du date_input
    """
    from datetime import date as _date, timedelta as _td

    # CSS du radio actif (robuste — utilise :has() pour matcher la pill cochée)
    st.markdown("""
        <style>
        /* Cache le label du widget */
        div[data-testid="stRadio"] > label { display:none; }
        /* Container pill-bar */
        div[data-testid="stRadio"] > div[role="radiogroup"] {
            background:rgba(14,15,18,0.06);
            border-radius:8px;
            padding:3px;
            gap:2px;
            display:inline-flex;
            flex-direction:row;
            flex-wrap:nowrap;
        }
        /* Chaque pill (label HTML qui wrap le radio) */
        div[data-testid="stRadio"] label[data-baseweb="radio"] {
            background:transparent;
            border-radius:6px;
            padding:5px 14px;
            margin:0;
            cursor:pointer;
            transition: background 0.15s, box-shadow 0.15s;
        }
        /* Cache le cercle du radio */
        div[data-testid="stRadio"] label[data-baseweb="radio"] > div:first-child { display:none; }
        /* Texte par défaut */
        div[data-testid="stRadio"] label[data-baseweb="radio"] p,
        div[data-testid="stRadio"] label[data-baseweb="radio"] > div:last-child {
            font-size:12.5px;
            font-weight:500;
            color:#5a5d66;
            line-height:1;
        }
        /* ── État actif (input checked) — version :has() ── */
        div[data-testid="stRadio"] label[data-baseweb="radio"]:has(input:checked) {
            background:#3b5bff !important;
            box-shadow:0 2px 6px rgba(59,91,255,0.35);
        }
        div[data-testid="stRadio"] label[data-baseweb="radio"]:has(input:checked) p,
        div[data-testid="stRadio"] label[data-baseweb="radio"]:has(input:checked) > div:last-child,
        div[data-testid="stRadio"] label[data-baseweb="radio"]:has(input:checked) * {
            color:#ffffff !important;
            font-weight:600;
        }
        /* ── Fallback ancienne structure (aria-checked sur label/span) ── */
        div[data-testid="stRadio"] label[aria-checked="true"],
        div[data-testid="stRadio"] [aria-checked="true"][data-baseweb="radio"] {
            background:#3b5bff !important;
            box-shadow:0 2px 6px rgba(59,91,255,0.35);
        }
        div[data-testid="stRadio"] label[aria-checked="true"] *,
        div[data-testid="stRadio"] [aria-checked="true"][data-baseweb="radio"] * {
            color:#ffffff !important;
            font-weight:600;
        }
        </style>
    """, unsafe_allow_html=True)

    # ⚠ 24h supprimé : la BD ne stocke que des data journalières, donc 24h = 1 point inutile.
    period_opts = {"7j": 7, "30j": 30, "90j": 90, "Tout": 36500, "Custom": None}
    period_key = f"{key}_period"
    today = _date.today()

    # Smart default au 1er affichage
    if period_key not in st.session_state:
        if df_dates is not None and not df_dates.empty:
            try:
                latest = pd.to_datetime(df_dates).max()
                if pd.notna(latest):
                    days_since = (pd.Timestamp(today) - pd.Timestamp(latest).tz_localize(None) if latest.tz else pd.Timestamp(today) - latest).days
                    if days_since <= 7:    default_p = "7j"
                    elif days_since <= 30: default_p = "30j"
                    elif days_since <= 90: default_p = "90j"
                    else:                  default_p = "Tout"
                else:
                    default_p = "30j"
            except Exception:
                default_p = "30j"
        else:
            default_p = "30j"
        st.session_state[period_key] = default_p

    sel_period = st.radio(
        "Période", list(period_opts.keys()),
        horizontal=True, key=period_key,
    )

    if sel_period == "Custom":
        # 2 date inputs côte à côte (déclenchés uniquement quand Custom)
        # Bornes : du min(df_dates) à today
        min_date = today - _td(days=365 * 3)
        if df_dates is not None and not df_dates.empty:
            try:
                _mn = pd.to_datetime(df_dates).min()
                if pd.notna(_mn):
                    min_date = (_mn.tz_localize(None) if getattr(_mn, "tz", None) else _mn).date()
            except Exception:
                pass

        col_s, col_e = st.columns(2)
        with col_s:
            d_start = st.date_input(
                "Du", value=max(today - _td(days=30), min_date),
                min_value=min_date, max_value=today,
                key=f"{key}_custom_start",
            )
        with col_e:
            d_end = st.date_input(
                "Au", value=today,
                min_value=min_date, max_value=today,
                key=f"{key}_custom_end",
            )

        # Validation
        if d_start > d_end:
            st.warning("⚠ La date de début est postérieure à la date de fin. Inversion automatique.")
            d_start, d_end = d_end, d_start

        return pd.Timestamp(d_start), pd.Timestamp(d_end)

    # Preset classique — ancré sur la DERNIÈRE date de données, pas sur aujourd'hui.
    # Sinon « 7j » peut couvrir 5 jours sans données + 2 jours réels → le delta
    # « vs période précédente » devient un faux signal (ex. -82 %). Règle projet :
    # les comparaisons excluent les jours incomplets/absents.
    anchor = today
    if df_dates is not None and not df_dates.empty:
        try:
            _mx = pd.to_datetime(df_dates).max()
            if pd.notna(_mx):
                _mx = _mx.tz_localize(None) if getattr(_mx, "tz", None) else _mx
                anchor = min(today, _mx.date())
        except Exception:
            pass
    days = period_opts[sel_period]
    since = pd.Timestamp(anchor - _td(days=days))
    until = pd.Timestamp(anchor)
    return since, until


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


def run_meta_ads_fetch(token, supabase, user_id, ad_account_id=None, force_full=False, progress_cb=None,
                       since_date=None):
    """Fetch Meta Ads avec chunking par fenêtres de 90 jours pour contourner les limites API.
    progress_cb: fonction(pct: int, text: str) optionnelle pour reporter la progression.
    since_date: date de départ explicite (ex. 1er jan de l'année passée) — prime sur tout.
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
    # Date de départ explicite (choisie dans le pop-up « Mes données ») — prime sur tout
    if since_date:
        since = since_date
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


# ── Drill-down helpers (Campagne → Adset → Ad) ────────────────────────────────

def _render_metric_row(
    name: str,
    impressions: int,
    reach: int,
    clicks: int,
    ctr: float,
    *,
    spend: float = 0.0,
    cpm: float = 0.0,
    cpc: float = 0.0,
    level: int = 1,          # 1 = adset, 2 = ad
    indent_px: int = 32,
    chevron: str | None = None,  # None = pas de chevron (feuille)
    on_chevron_click=None,        # callback si chevron cliqué
    chevron_key: str | None = None,
) -> None:
    """Rend une ligne agrégée par adset ou ad, avec indentation visuelle.
    Utilisé par le drill-down dans la table Campagnes.
    """
    indent = indent_px * level
    # Couleur plus douce pour les enfants
    name_color = "#5a5d66" if level == 1 else "#8b8e98"
    name_weight = 600 if level == 1 else 500
    icon = "📦" if level == 1 else "🎨"

    # Container avec padding gauche pour indentation
    container = st.container()
    with container:
        cols = st.columns([level * 0.5, 0.4, 3.0, 0.9, 0.9, 0.8, 0.9, 1.0, 0.9, 0.9])
        (c_pad, c_chev, c_name,
         c_impr, c_reach, c_clicks, c_ctr,
         c_spend, c_cpm, c_cpc) = cols

        with c_chev:
            if chevron and on_chevron_click and chevron_key:
                if st.button(chevron, key=chevron_key, help="Voir les ads"):
                    on_chevron_click()
                    st.rerun()
            else:
                st.markdown("&nbsp;", unsafe_allow_html=True)

        with c_name:
            st.markdown(
                f'<div style="padding-top:6px;">'
                f'<span style="font-size:12.5px;font-weight:{name_weight};color:{name_color};">'
                f'{icon} {name}</span></div>',
                unsafe_allow_html=True,
            )

        for col, lbl, val in [
            (c_impr,   "IMPR",     f"{int(impressions):,}" if impressions > 0 else "—"),
            (c_reach,  "REACH",    f"{int(reach):,}"       if reach       > 0 else "—"),
            (c_clicks, "CLICS",    f"{int(clicks):,}"      if clicks      > 0 else "—"),
            (c_ctr,    "CTR",      f"{ctr:.2f}%"           if ctr         > 0 else "—"),
            (c_spend,  "DÉPENSÉ",  f"{spend:,.0f} CHF"     if spend       > 0 else "—"),
            (c_cpm,    "CPM",      f"{cpm:.2f} CHF"        if cpm         > 0 else "—"),
            (c_cpc,    "CPC",      f"{cpc:.2f} CHF"        if cpc         > 0 else "—"),
        ]:
            with col:
                st.markdown(
                    f'<div style="text-align:right;padding-top:4px;">'
                    f'<div style="font-size:9px;font-weight:600;text-transform:uppercase;'
                    f'letter-spacing:0.06em;color:#8b8e98;margin-bottom:2px;">{lbl}</div>'
                    f'<div style="font-family:var(--font-mono);font-size:12px;'
                    f'font-weight:500;color:#0e0f12;">{val}</div>'
                    f'</div>',
                    unsafe_allow_html=True,
                )


def _render_adsets_drilldown(df: pd.DataFrame, camp_name: str, safe_key: str) -> None:
    """Liste les adsets d'une campagne (drill-down niveau 1)."""
    if "adset_name" not in df.columns:
        st.markdown(
            '<div style="font-size:11.5px;color:#8b8e98;padding:8px 0 8px 56px;">'
            "Pas d'info adset disponible — rafraîchis les données Meta Ads."
            "</div>",
            unsafe_allow_html=True,
        )
        return

    df_camp = df[df["campaign_name"] == camp_name]
    _adset_agg = {
        "impressions": ("impressions", "sum"),
        "clicks": ("clicks", "sum"),
        "spend": ("spend", "sum"),
    }
    if "reach" in df_camp.columns:
        _adset_agg["reach"] = ("reach", "sum")
    adsets = df_camp.groupby("adset_name", as_index=False).agg(**_adset_agg)
    if "reach" not in adsets.columns:
        adsets["reach"] = 0
    adsets["ctr"] = adsets.apply(
        lambda r: r["clicks"] / r["impressions"] * 100 if r["impressions"] > 0 else 0, axis=1
    )
    adsets["cpm"] = adsets.apply(
        lambda r: r["spend"] / r["impressions"] * 1000 if r["impressions"] > 0 else 0, axis=1
    )
    adsets["cpc"] = adsets.apply(
        lambda r: r["spend"] / r["clicks"] if r["clicks"] > 0 else 0, axis=1
    )
    adsets = adsets.sort_values("impressions", ascending=False)

    if adsets.empty:
        st.markdown(
            '<div style="font-size:11.5px;color:#8b8e98;padding:8px 0 8px 56px;">'
            "Aucun adset dans cette campagne."
            "</div>",
            unsafe_allow_html=True,
        )
        return

    for _, ar in adsets.iterrows():
        adset_name = str(ar["adset_name"]) or "(sans nom)"
        adset_safe = adset_name.replace(" ", "_").replace("/", "_")[:40]
        adset_exp_key = f"adset_exp_{safe_key}_{adset_safe}"
        adset_expanded = st.session_state.get(adset_exp_key, False)

        def _toggle_adset(k=adset_exp_key):
            st.session_state[k] = not st.session_state.get(k, False)

        _render_metric_row(
            name=adset_name,
            impressions=int(ar["impressions"]),
            reach=int(ar.get("reach", 0)),
            clicks=int(ar["clicks"]),
            ctr=float(ar["ctr"]),
            spend=float(ar.get("spend", 0)),
            cpm=float(ar.get("cpm", 0)),
            cpc=float(ar.get("cpc", 0)),
            level=1,
            chevron="▾" if adset_expanded else "▸",
            on_chevron_click=_toggle_adset,
            chevron_key=f"btn_{adset_exp_key}",
        )

        if adset_expanded:
            _render_ads_drilldown(df, camp_name, adset_name)


def _render_ads_drilldown(df: pd.DataFrame, camp_name: str, adset_name: str) -> None:
    """Liste les ads d'un adset (drill-down niveau 2 — feuilles)."""
    if "ad_name" not in df.columns:
        return
    df_a = df[(df["campaign_name"] == camp_name) & (df["adset_name"] == adset_name)]
    _ad_agg = {
        "impressions": ("impressions", "sum"),
        "clicks": ("clicks", "sum"),
        "spend": ("spend", "sum"),
    }
    if "reach" in df_a.columns:
        _ad_agg["reach"] = ("reach", "sum")
    ads = df_a.groupby("ad_name", as_index=False).agg(**_ad_agg)
    if "reach" not in ads.columns:
        ads["reach"] = 0
    ads["ctr"] = ads.apply(
        lambda r: r["clicks"] / r["impressions"] * 100 if r["impressions"] > 0 else 0, axis=1
    )
    ads["cpm"] = ads.apply(
        lambda r: r["spend"] / r["impressions"] * 1000 if r["impressions"] > 0 else 0, axis=1
    )
    ads["cpc"] = ads.apply(
        lambda r: r["spend"] / r["clicks"] if r["clicks"] > 0 else 0, axis=1
    )
    ads = ads.sort_values("impressions", ascending=False)

    for _, adr in ads.iterrows():
        _render_metric_row(
            name=str(adr["ad_name"]) or "(sans nom)",
            impressions=int(adr["impressions"]),
            reach=int(adr.get("reach", 0)),
            clicks=int(adr["clicks"]),
            ctr=float(adr["ctr"]),
            spend=float(adr.get("spend", 0)),
            cpm=float(adr.get("cpm", 0)),
            cpc=float(adr.get("cpc", 0)),
            level=2,
            chevron=None,  # feuille, pas de chevron
        )


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

    # ═══════════════════════════════════════════════════════════════════════
    # ── Hero (statique) ─────────────────────────────────────────────────────
    # ═══════════════════════════════════════════════════════════════════════
    st.markdown(
        '<div class="page-h">'
        '<h1>Performance</h1>'
        '</div>',
        unsafe_allow_html=True,
    )

    # ═══════════════════════════════════════════════════════════════════════
    # ─── SECTION 1 : VIEW FILTRÉE (suit la période + statut + campagne) ────
    # ═══════════════════════════════════════════════════════════════════════
    st.markdown(
        '<div class="section-head" style="margin:8px 0 12px;">'
        '<div class="h-eyebrow">View filtrée</div>'
        '<div style="font-size:13px;font-weight:500;color:#5a5d66;margin-top:4px;">'
        'Suit la période sélectionnée</div>'
        '</div>',
        unsafe_allow_html=True,
    )

    # ── Période selector (presets + Custom) ─────────────────────────────────
    since_ts, until_ts = render_period_selector(key="mad", df_dates=df["date_start"])

    # df_scope = df filtré par statut/campagne/label mais PAS par période.
    # Sert aux deltas vs période précédente (même périmètre, autre fenêtre temporelle).
    df_scope = df.copy()

    col_status, col_camp, col_label = st.columns([2, 3, 2])

    with col_status:
        if "effective_status" in df.columns and df["effective_status"].notna().any():
            status_opts = sorted([s for s in df["effective_status"].dropna().unique() if s])
            sel_status = st.multiselect(
                "Statut", options=status_opts, key="mad_status",
                placeholder="Tous les statuts",
            )
            if sel_status:
                df_scope = df_scope[df_scope["effective_status"].isin(sel_status)]

    with col_camp:
        sel_campaigns = st.multiselect(
            "Campagne", options=sorted(df["campaign_name"].dropna().unique()),
            key="mad_campaigns", placeholder="Toutes les campagnes",
        )
        if sel_campaigns:
            df_scope = df_scope[df_scope["campaign_name"].isin(sel_campaigns)]

    with col_label:
        # Labels assignés aux campagnes (depuis campaign_config en session)
        _cfg_for_lbl: dict = st.session_state.get("campaign_config", {}) or {}
        _label_opts = sorted({
            (c or {}).get("label") for c in _cfg_for_lbl.values() if (c or {}).get("label")
        })
        if _label_opts:
            sel_labels = st.multiselect(
                "Label", options=_label_opts, key="mad_labels",
                placeholder="Tous les labels",
            )
            if sel_labels:
                _camps_with_lbl = {
                    name for name, c in _cfg_for_lbl.items()
                    if (c or {}).get("label") in sel_labels
                }
                df_scope = df_scope[df_scope["campaign_name"].isin(_camps_with_lbl)]

    df_view = df_scope[(df_scope["date_start"] >= since_ts) & (df_scope["date_start"] <= until_ts)].copy()

    if df_view.empty:
        latest_date_in_df = df["date_start"].max() if not df.empty else None
        period_label = st.session_state.get("mad_period", "30j")
        if latest_date_in_df is not None and pd.notna(latest_date_in_df):
            latest_str = latest_date_in_df.strftime("%d %b %Y")
            st.info(
                f"Aucune donnée sur la période **{period_label}**. "
                f"Ta dernière donnée disponible date du **{latest_str}** — "
                "essaie une période plus large (30j, 90j ou Tout) ou rafraîchis tes données depuis Paramètres."
            )
        else:
            st.info(
                "Aucune donnée Meta Ads disponible. Rafraîchis tes données "
                "depuis **Paramètres → Meta Ads**."
            )
        return

    # ── Agrégats du module métriques (suit le filtre période) ───────────────
    total_clicks      = int(df_view["clicks"].sum())
    total_impressions = int(df_view["impressions"].sum())
    total_reach       = int(df_view["reach"].sum()) if "reach" in df_view.columns else 0
    total_spend       = float(df_view["spend"].sum()) if "spend" in df_view.columns else 0.0
    total_link_clicks = int(df_view["link_clicks"].sum()) if "link_clicks" in df_view.columns else 0
    avg_ctr  = (total_clicks / total_impressions * 100) if total_impressions > 0 else 0.0
    avg_cpm  = (total_spend / total_impressions * 1000) if total_impressions > 0 else 0.0
    avg_cpc  = (total_spend / total_clicks) if total_clicks > 0 else 0.0
    cpv      = (total_spend / total_link_clicks) if total_link_clicks > 0 else None

    # ── Agrégat quotidien (pour sparklines + graph) ─────────────────────────
    _agg_dict = {"spend": ("spend","sum"), "clicks": ("clicks","sum"), "impressions": ("impressions","sum")}
    if "reach" in df_view.columns:
        _agg_dict["reach"] = ("reach", "sum")
    if "link_clicks" in df_view.columns:
        _agg_dict["link_clicks"] = ("link_clicks", "sum")
    df_daily = (
        df_view.groupby("date_start", as_index=False).agg(**_agg_dict)
    ).sort_values("date_start")
    df_daily["ctr"] = df_daily.apply(
        lambda r: r["clicks"] / r["impressions"] * 100 if r["impressions"] > 0 else 0, axis=1)
    if "reach" not in df_daily.columns:
        df_daily["reach"] = 0
    if "link_clicks" not in df_daily.columns:
        df_daily["link_clicks"] = 0
    df_daily["cpv"] = df_daily.apply(
        lambda r: r["spend"] / r["link_clicks"] if r["link_clicks"] > 0 else 0, axis=1)

    spark_impressions = df_daily["impressions"].tail(7).tolist()
    spark_reach       = df_daily["reach"].tail(7).tolist()
    spark_clicks      = df_daily["clicks"].tail(7).tolist()
    spark_ctr         = df_daily["ctr"].tail(7).tolist()
    spark_spend       = df_daily["spend"].tail(7).tolist()
    df_daily["cpm"]   = df_daily.apply(lambda r: r["spend"] / r["impressions"] * 1000 if r["impressions"] > 0 else 0, axis=1)
    df_daily["cpc"]   = df_daily.apply(lambda r: r["spend"] / r["clicks"] if r["clicks"] > 0 else 0, axis=1)
    spark_cpm         = df_daily["cpm"].tail(7).tolist()
    spark_cpc         = df_daily["cpc"].tail(7).tolist()

    # ╔═══════════════════════════════════════════════════════════════════╗
    # ║ KPI HIERARCHY v4 — section_hero + supporting (Stripe/Linear school)║
    # ╚═══════════════════════════════════════════════════════════════════╝
    # Pour rollback rapide : commenter ce bloc et décommenter les 2 grids OLD
    # ci-dessous (gardés en commentaire).

    # ── Période précédente : baseline label dynamique ────────────────────
    _mad_period = st.session_state.get("mad_period", "30j")
    if _mad_period == "Tout":
        # Pas de baseline pertinente sur "Tout" → on cache les deltas
        _baseline = ""
        _show_deltas = False
    elif _mad_period == "Custom":
        _baseline = f"vs {(until_ts - since_ts).days + 1}j précédents"
        _show_deltas = True
    else:
        _baseline = f"vs {_mad_period} précédents"
        _show_deltas = True

    # ── Calcul des deltas vs période précédente ──────────────────────────
    # ⚠ Exclut AUJOURD'HUI : journée incomplète → comparer avec elle fait
    #   artificiellement "perdre" à chaque fois. La fenêtre delta s'arrête hier.
    # ⚠ Utilise df_scope (même périmètre statut/campagne/label que les KPIs,
    #   mais sans la borne période — nécessaire pour voir la fenêtre précédente).
    _yesterday = pd.Timestamp.today().normalize() - pd.Timedelta(days=1)
    _delta_until = min(until_ts, _yesterday)
    if _show_deltas and _delta_until >= since_ts:
        d_impressions = compute_period_delta(df_scope, "impressions", "date_start", since_ts, _delta_until, agg="sum")
        d_reach       = compute_period_delta(df_scope, "reach",       "date_start", since_ts, _delta_until, agg="sum") if "reach" in df_scope.columns else None
        d_clicks      = compute_period_delta(df_scope, "clicks",      "date_start", since_ts, _delta_until, agg="sum")
        d_spend       = compute_period_delta(df_scope, "spend",       "date_start", since_ts, _delta_until, agg="sum")
        d_ctr  = compute_ratio_delta(df_scope, "clicks", "impressions", "date_start", since_ts, _delta_until, multiplier=100)
        d_cpc  = compute_ratio_delta(df_scope, "spend",  "clicks",      "date_start", since_ts, _delta_until)
        d_cpm  = compute_ratio_delta(df_scope, "spend",  "impressions", "date_start", since_ts, _delta_until, multiplier=1000)
        d_cpv  = compute_ratio_delta(df_scope, "spend",  "link_clicks", "date_start", since_ts, _delta_until) if "link_clicks" in df_scope.columns else None
        _baseline += " (hors auj.)"
    else:
        d_impressions = d_reach = d_clicks = d_spend = None
        d_ctr = d_cpc = d_cpm = d_cpv = None

    # ── Hero metric : impressions (la plus parlante pour Perf) ───────────
    nb_active_camp_hero = int(df_view["campaign_name"].nunique()) if "campaign_name" in df_view.columns else 0
    _hero_context = (
        f"{_mad_period} derniers jours · {nb_active_camp_hero} campagnes actives"
        if _mad_period not in ("Tout", "Custom") else
        ("Tout l'historique" if _mad_period == "Tout" else f"Période custom · {nb_active_camp_hero} campagnes actives")
    )
    section_hero(
        eyebrow="Meta Ads · Performance",
        context=_hero_context,
        hero_label="impressions",
        hero_value=f"{total_impressions:,}".replace(",", " "),
        delta_pct=d_impressions,
        baseline_label=_baseline,
    )

    # ── Supporting metrics : 3 perf + 4 coût ─────────────────────────────
    # Ligne 1 (perf) : Reach · Clics · CTR
    cards_perf = [
        kpi_small("Reach",     f"{total_reach:,}".replace(",", " "), delta_pct=d_reach,  baseline_label=_baseline),
        kpi_small("Clics",     f"{total_clicks:,}".replace(",", " "), delta_pct=d_clicks, baseline_label=_baseline),
        kpi_small("CTR moyen", f"{avg_ctr:.2f}", unit="%", delta_pct=d_ctr, baseline_label=_baseline),
    ]
    # Ligne 2 (coût) : Dépensé · CPM · CPC · CPV — invert sur les coûts (baisse = bon)
    _cpv_val_str = f"{cpv:.2f}" if cpv is not None else "—"
    cards_cost = [
        kpi_small("Dépensé",   f"{total_spend:,.0f}".replace(",", " "), unit="CHF", delta_pct=d_spend, baseline_label=_baseline),
        kpi_small("CPM moyen", f"{avg_cpm:.2f}", unit="CHF", delta_pct=d_cpm, baseline_label=_baseline, invert=True),
        kpi_small("CPC moyen", f"{avg_cpc:.2f}", unit="CHF", delta_pct=d_cpc, baseline_label=_baseline, invert=True),
        kpi_small("CPV",       _cpv_val_str,     unit="CHF" if cpv is not None else "", delta_pct=d_cpv, baseline_label=_baseline, invert=True),
    ]

    st.markdown(h_divider(), unsafe_allow_html=True)
    st.markdown(kpi_grid(cards_perf, cols=3), unsafe_allow_html=True)
    st.markdown(kpi_grid(cards_cost, cols=4), unsafe_allow_html=True)

    # ── OLD KPI grids (rollback si besoin — décommenter pour revenir au v3) ──
    # st.markdown(
    #     f'<div class="kpi-grid">'
    #     f'{_kpi("Impressions", f"{total_impressions:,}", spark=spark_impressions)}'
    #     f'{_kpi("Reach", f"{total_reach:,}", spark=spark_reach, spark_color="#1a56ff")}'
    #     f'{_kpi("Clics", f"{total_clicks:,}", spark=spark_clicks, spark_color="#0e0f12")}'
    #     f'{_kpi("CTR moyen", f"{avg_ctr:.2f}", "%", spark=spark_ctr, spark_color="#1a7a4a")}'
    #     f'</div>',
    #     unsafe_allow_html=True,
    # )
    # _cpv_val = f"{cpv:.2f}" if cpv is not None else "—"
    # st.markdown(
    #     f'<div class="kpi-grid" style="margin-top:8px;">'
    #     f'{_kpi("Dépensé", f"{total_spend:,.0f}", "CHF", spark=spark_spend, spark_color="#b86b00")}'
    #     f'{_kpi("CPM moyen", f"{avg_cpm:.2f}", "CHF", invert=True, spark=spark_cpm, spark_color="#c0392b")}'
    #     f'{_kpi("CPC moyen", f"{avg_cpc:.2f}", "CHF", invert=True, spark=spark_cpc, spark_color="#c0392b")}'
    #     f'{_kpi("CPV", _cpv_val, "CHF" if cpv is not None else "", invert=True)}'
    #     f'</div>',
    #     unsafe_allow_html=True,
    # )

    # ── Chart section — toutes les métriques des KPI (perf + coût) ──────────
    metric_map = {
        "Impressions": ("impressions", ""),
        "Reach":       ("reach", ""),
        "Clics":       ("clicks", ""),
        "CTR (%)":     ("ctr", "%"),
        "Dépenses":    ("spend", "CHF"),
        "CPM":         ("cpm", "CHF"),
        "CPC":         ("cpc", "CHF"),
        "CPV":         ("cpv", "CHF"),
    }
    st.markdown('<div class="section-title">Évolution quotidienne</div>', unsafe_allow_html=True)
    # selectbox (8 options = trop pour un radio horizontal)
    sel_metric_label = st.selectbox(
        "Métrique", list(metric_map.keys()),
        key="mad_metric", label_visibility="collapsed",
    )

    metric_col, metric_unit = metric_map[sel_metric_label]
    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=df_daily["date_start"], y=df_daily[metric_col],
        mode="lines+markers",
        line=dict(color=PULSE["accent"], width=2),
        marker=dict(size=4, color=PULSE["white"],
                    line=dict(color=PULSE["accent"], width=2)),
        fill="tozeroy",
        fillcolor="rgba(26,86,255,0.07)",
        hovertemplate=f"%{{x|%d %b}}<br>%{{y:.2f}} {metric_unit}<extra></extra>",
    ))
    apply_pulse_style(fig, height=240, in_card=False, show_legend=False)
    st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})

    st.markdown("<br>", unsafe_allow_html=True)

    # ── Agrégat par campagne (TOUTES PÉRIODES — découplé du filtre) ─────────
    _camp_agg_dict = {
        "spend": ("spend","sum"),
        "clicks": ("clicks","sum"),
        "impressions": ("impressions","sum"),
    }
    if "reach" in df.columns:
        _camp_agg_dict["reach"] = ("reach", "sum")
    df_camp = df.groupby("campaign_name", as_index=False).agg(**_camp_agg_dict)
    if "reach" not in df_camp.columns:
        df_camp["reach"] = 0
    df_camp["ctr"] = df_camp.apply(
        lambda r: r["clicks"] / r["impressions"] * 100 if r["impressions"] > 0 else 0, axis=1)
    df_camp["cpc"] = df_camp.apply(
        lambda r: r["spend"] / r["clicks"] if r["clicks"] > 0 else 0, axis=1)

    # Statut courant par campagne (utilise df complet)
    camp_status = {}
    if "effective_status" in df.columns:
        for camp, grp in df.groupby("campaign_name"):
            valid = grp["effective_status"].dropna().astype(str).str.strip()
            valid = valid[valid != ""]
            mode = valid.mode() if not valid.empty else pd.Series(dtype=str)
            camp_status[camp] = mode.iloc[0] if not mode.empty else ""

    # Trier : actives d'abord, puis par impressions décroissantes (vs spend)
    def _sort_key(r):
        status = camp_status.get(r["campaign_name"], "")
        return (0 if status == "ACTIVE" else 1, -r["impressions"])
    df_camp_sorted = df_camp.copy()
    df_camp_sorted["_sort"] = df_camp_sorted.apply(_sort_key, axis=1)
    df_camp_sorted = df_camp_sorted.sort_values("_sort").drop(columns=["_sort"])

    # Meilleur CTR (pour le badge 🏆) — exclut les campagnes à 0 impression
    _ctr_pos = df_camp_sorted[df_camp_sorted["impressions"] > 0]
    best_ctr_camp = _ctr_pos.iloc[_ctr_pos["ctr"].argmax()]["campaign_name"] if not _ctr_pos.empty else None

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

    # ═══════════════════════════════════════════════════════════════════════
    # ─── SECTION 2 : VIEW GLOBALE (tout l'historique — indépendant filtre) ─
    # ═══════════════════════════════════════════════════════════════════════
    st.markdown(
        '<div class="section-head" style="margin:32px 0 12px;padding-top:20px;'
        'border-top:1px solid rgba(14,15,18,0.08);">'
        '<div class="h-eyebrow">View globale</div>'
        '<div style="font-size:13px;font-weight:500;color:#5a5d66;margin-top:4px;">'
        "Tout l'historique — indépendant du filtre</div>"
        '</div>',
        unsafe_allow_html=True,
    )

    # ── Performance par label (TOTAL HISTORIQUE) ──────────────────────────
    st.markdown(
        '<div class="section-head">'
        '<div class="section-title">Performance par label</div></div>',
        unsafe_allow_html=True,
    )
    _agg_perf = _build_agg_by_label(df, campaign_config)
    _render_perf_by_label(_agg_perf)
    st.markdown("<br>", unsafe_allow_html=True)

    # ── Section Campagnes (TOTAL HISTORIQUE — découplé du filtre) ──────────
    c_title, c_newlbl = st.columns([4.5, 1])
    with c_title:
        st.markdown(
            f'<div class="section-head">'
            f'<div class="section-title">Campagnes '
            f'<span class="st-count">{count_txt} · {total_camp} au total · scroll pour explorer</span>'
            f'</div></div>',
            unsafe_allow_html=True,
        )
    with c_newlbl:
        _render_new_label_popover(client, user_id, key="mad")

    # Container scrollable (~50% viewport) — toutes les campagnes accessibles via scroll
    with st.container(height=720, border=False):
     for _, row in df_camp_sorted.iterrows():
        camp_name = row["campaign_name"]
        status = camp_status.get(camp_name, "")
        is_paused = "PAUSED" in status.upper()
        op = "0.62" if is_paused else "1"
        is_best = (camp_name == best_ctr_camp) and not is_paused
        trophy = "🏆 " if is_best else ""

        current_label = (campaign_config.get(camp_name) or {}).get("label") or None
        safe_key = camp_name.replace(" ", "_").replace("/", "_")[:50]
        camp_exp_key = f"camp_exp_{safe_key}"
        camp_expanded = st.session_state.get(camp_exp_key, False)

        # Compute coût metrics for this campaign
        _camp_spend = float(row.get('spend', 0) or 0)
        _camp_cpm = (_camp_spend / row['impressions'] * 1000) if row['impressions'] > 0 else 0
        _camp_cpc = (_camp_spend / row['clicks']) if row['clicks'] > 0 else 0

        with st.container(border=True):
            (c_exp, c_lbl, c_name, c_status,
             c_impr, c_reach, c_clicks, c_ctr,
             c_spend, c_cpm, c_cpc) = st.columns(
                [0.4, 1.6, 2.6, 1,
                 1, 1, 0.9, 1,
                 1.1, 1, 1]
            )

            # ── Col 0 : Chevron drill-down (campagne → adsets) ──
            with c_exp:
                chev = "▾" if camp_expanded else "▸"
                if st.button(chev, key=f"btn_{camp_exp_key}", help="Voir les adsets"):
                    st.session_state[camp_exp_key] = not camp_expanded
                    st.rerun()

            # ── Col 1 : Label (selectbox éditable à gauche) ──
            with c_lbl:
                if client and user_id:
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

            # ── Col 2 : Nom (avec 🏆 sur le top CTR) ──
            with c_name:
                st.markdown(
                    f'<div style="opacity:{op};padding-top:8px;">'
                    f'<div style="font-size:13.5px;font-weight:600;line-height:1.2;color:#0e0f12;">{trophy}{camp_name}</div>'
                    f'</div>',
                    unsafe_allow_html=True,
                )

            # ── Col 3 : Status chip ──
            with c_status:
                st.markdown(
                    f'<div style="padding-top:8px;opacity:{op};">{_status_chip(status)}</div>',
                    unsafe_allow_html=True,
                )

            # ── Cols 4-10 : Perf (Impr/Reach/Clics/CTR) puis Coût (Spend/CPM/CPC) ──
            cells = [
                (c_impr,   "IMPRESSIONS", f"{int(row['impressions']):,}" if row['impressions'] > 0 else "—"),
                (c_reach,  "REACH",       f"{int(row['reach']):,}"       if row['reach']       > 0 else "—"),
                (c_clicks, "CLICS",       f"{int(row['clicks']):,}"      if row['clicks']      > 0 else "—"),
                (c_ctr,    "CTR",         f"{row['ctr']:.2f} %"          if row['ctr']         > 0 else "—"),
                (c_spend,  "DÉPENSÉ",     f"{_camp_spend:,.0f} CHF"      if _camp_spend > 0    else "—"),
                (c_cpm,    "CPM",         f"{_camp_cpm:.2f} CHF"         if _camp_cpm > 0      else "—"),
                (c_cpc,    "CPC",         f"{_camp_cpc:.2f} CHF"         if _camp_cpc > 0      else "—"),
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

        # ── Drill-down niveau 1 : Adsets de cette campagne ──────────────────
        if camp_expanded:
            _render_adsets_drilldown(df, camp_name, safe_key)


# ── Helper : agrégat par label (utilisé par Perf et Coût) ─────────────────────

def _build_agg_by_label(df_view: pd.DataFrame, campaign_config: dict) -> pd.DataFrame:
    """Construit l'aggregat par label depuis df_view + campaign_config.
    df_view peut être filtré (tab Coût) ou complet (tab Performance) selon l'appelant.
    """
    _camp_agg = {
        "spend": ("spend", "sum"),
        "impressions": ("impressions", "sum"),
        "clicks": ("clicks", "sum"),
    }
    if "reach" in df_view.columns:
        _camp_agg["reach"] = ("reach", "sum")
    df_c = df_view.groupby("campaign_name", as_index=False).agg(**_camp_agg)
    if "reach" not in df_c.columns:
        df_c["reach"] = 0
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
            reach=("reach", "sum"),
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
    """Rendu 'Performance par label' pour la tab Performance — métriques perf only."""
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

    hcols = st.columns([3, 1.2, 1.6, 1.6, 1.4, 1.4])
    headers = ["Label", "Camp.", "Impressions", "Reach", "Clics", "CTR %"]
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

        c_name, c_camps, c_impr, c_reach, c_clicks, c_ctr = st.columns([3, 1.2, 1.6, 1.6, 1.4, 1.4])
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
            (c_camps,  f"{int(r['campaigns'])}"),
            (c_impr,   f"{int(r['impressions']):,}"),
            (c_reach,  f"{int(r.get('reach', 0)):,}"),
            (c_clicks, f"{int(r['clicks']):,}"),
            (c_ctr,    f"{r['ctr']:.2f}%"),
        ]:
            with col:
                st.markdown(
                    f'<div style="font-family:var(--font-mono,ui-monospace,monospace);'
                    f'font-size:13px;font-weight:500;color:#0e0f12;padding-top:6px;">{val}</div>',
                    unsafe_allow_html=True,
                )


# Coût et Labels Meta Ads : déplacés vers les pages globales dédiées
# (components/couts.py, components/labels_page.py). L'assignation d'un label à
# une campagne reste inline dans Performance (callback ci-dessous).


# ── Création rapide de label (partagé Meta/Google — liste unifiée) ────────────

def _render_new_label_popover(client, user_id, key: str) -> None:
    """Créer un label sans quitter le tab. Écrit dans la liste unifiée
    profiles.labels puis invalide les caches session → visible partout."""
    if not (client and user_id):
        return
    with st.popover("➕ Label", use_container_width=True):
        name = st.text_input("Nouveau label", key=f"newlbl_{key}",
                             placeholder="ex. Promo été", label_visibility="collapsed")
        if st.button("Créer", key=f"newlbl_btn_{key}", type="primary", use_container_width=True):
            from scripts.labels import add_label
            ok, msg = add_label(client, user_id, name)
            if ok:
                for k in ("campaign_labels", "google_campaign_labels", "insta_labels",
                          "cout_initialized", "google_initialized", "_insta_labels_init"):
                    st.session_state.pop(k, None)
                st.rerun()
            else:
                st.warning(msg)
        st.caption("Gestion complète (renommer, supprimer) : page ◫ Labels.")


# ── Callback de sauvegarde label campagne (on_change) ─────────────────────────

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


# ── Tab entry point ───────────────────────────────────────────────────────────

def show_meta_ads_tab(is_paid: bool = False, client=None, user_id: str | None = None):
    st.markdown(PULSE_CSS, unsafe_allow_html=True)
    inject_hierarchy_css()  # Active les classes .h-* (additif, ne touche pas aux existantes)
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

    # Plus d'onglets internes : les Coûts et les Labels ont leur page globale dédiée
    # (components/couts.py, components/labels_page.py). Ce canal = Performance seule.
    show_meta_ads_dashboard(df, client=client, user_id=user_id)
