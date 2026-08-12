"""Tab Google Ads — Performance seule (Coûts et Labels ont leur page globale).

- show_google_ads_tab(client, user_id, is_paid) : entry point (Performance)
- run_google_ads_fetch(...) : fetch sans UI (utilisable depuis auto-fetch OAuth)
- google_ads_source_fragment(...) : UI manuelle dans Paramètres
"""

import time
from datetime import date, timedelta

import streamlit as st
import pandas as pd

import plotly.graph_objects as go

from scripts.fetch_data import (
    fetch_google_ads,
    fetch_google_ads_latest_date,
    fetch_google_ads_ad_insights,
    fetch_google_campaign_labels,
    fetch_google_budget_global,
    fetch_google_campaign_config,
)
from scripts.insert_data import (
    upsert_google_ads,
    upsert_google_ads_ad_insights,
    update_google_campaign_labels,
    update_google_budget_global,
    upsert_google_campaign_config,
    upsert_google_campaign_statuses,
    upsert_platform_changes,
    rename_google_campaign_label,
    clear_google_campaign_label,
    update_google_refresh_token,
    upsert_platform_budgets,
)
from components.meta_ads import (
    render_period_selector, _NO_LABEL, PULSE_CSS,
    _status_chip, _render_metric_row,
    _build_agg_by_label, _render_perf_by_label,
    _render_new_label_popover,
)
from components.graph_style import PULSE, apply_pulse_style
from components.layout import inject_hierarchy_css
from scripts.app_secrets import secret
from google_script.fetch_token import get_access_token_from_refresh
from google_script.fetch_google_ads import (
    list_accessible_customers,
    list_managed_accounts,
    fetch_campaign_insights,
    fetch_ad_insights,
    fetch_campaign_statuses,
    fetch_campaign_budgets,
    fetch_campaign_changes,
)


def _micros_to_chf(v: int | float) -> float:
    return float(v or 0) / 1_000_000.0


def _init_google_state(client, user_id) -> None:
    """Charge labels + budget + config Google une fois par session."""
    if not (client and user_id):
        return
    # Recharge aussi si la liste a été invalidée (ex. label créé sur la page Labels)
    if st.session_state.get("google_initialized") and "google_campaign_labels" in st.session_state:
        return
    try:
        st.session_state["google_campaign_labels"] = fetch_google_campaign_labels(client, user_id)
    except Exception:
        st.session_state["google_campaign_labels"] = []
    try:
        st.session_state["google_budget_global"] = fetch_google_budget_global(client, user_id)
    except Exception:
        st.session_state["google_budget_global"] = 0.0
    try:
        st.session_state["google_campaign_config"] = fetch_google_campaign_config(client, user_id)
    except Exception:
        st.session_state["google_campaign_config"] = {}
    st.session_state["google_initialized"] = True


# ── Fetch principal (utilisable sans UI) ──────────────────────────────────────

def run_google_ads_fetch(
    supabase,
    user_id: str,
    refresh_token: str,
    customer_id: str,
    force_full: bool = False,
    progress_cb=None,
    since_date=None,
):
    """Fetch Google Ads insights pour un customer_id donné, sauvegarde Supabase.
    since_date : date de départ explicite (pop-up « Mes données ») — prime sur tout.
    Returns: dict {success, rows, message}
    """
    def _p(pct, txt):
        if progress_cb:
            try:
                progress_cb(pct, txt)
            except Exception:
                pass

    # 1. Access token court-terme
    _p(5, "Authentification Google…")
    access_token = get_access_token_from_refresh(refresh_token)
    if not access_token:
        return {"success": False, "rows": 0, "message": "Refresh token invalide. Reconnecte-toi à Google."}

    # 2. Date range
    today = date.today()

    # Photo du budget PLANIFIÉ — prise AVANT tout test de fraîcheur, sinon un
    # compte déjà à jour repartirait sans relevé. Best-effort : une erreur ici
    # ne doit jamais coûter les insights.
    try:
        _buds, _berr = fetch_campaign_budgets(access_token, customer_id)
        if _buds:
            upsert_platform_budgets(supabase, user_id, "google", _buds, today.isoformat())
    except Exception:
        pass

    # Journal des changements déclarés — fenêtre de 30 jours, c'est tout ce que
    # `change_event` conserve. Best-effort, comme le budget.
    try:
        _smap, _ = fetch_campaign_statuses(access_token, customer_id)
        _chg, _ = fetch_campaign_changes(
            access_token, customer_id, today - timedelta(days=30),
            noms_campagnes={cid: v[0] for cid, v in (_smap or {}).items()},
        )
        if _chg:
            upsert_platform_changes(supabase, user_id, "google", _chg)
    except Exception:
        pass

    latest = fetch_google_ads_latest_date(supabase, user_id) if not force_full else None
    if latest:
        since = date.fromisoformat(latest) + timedelta(days=1)
    else:
        since = date(today.year, 1, 1)  # depuis 1er janvier année courante
    if since_date:
        since = since_date  # choix explicite du pop-up « Mes données »
    if since > today:
        return {"success": True, "rows": 0, "message": "Données déjà à jour"}

    # 3. Chunking par 90 jours (cohérent avec Meta Ads)
    CHUNK = 90
    chunks = []
    cur = since
    while cur <= today:
        end = min(cur + timedelta(days=CHUNK - 1), today)
        chunks.append((cur, end))
        cur = end + timedelta(days=1)

    # Si le compte est sous un manager (MCC), l'API exige le login-customer-id.
    login_cid = secret("google_ads.login_customer_id")

    rows = []
    ad_rows = []
    last_error = None
    for i, (c_since, c_until) in enumerate(chunks):
        _p(int(10 + (i / max(len(chunks), 1)) * 70),
           f"Chargement {c_since:%b %Y} → {c_until:%b %Y}… ({len(rows)} lignes)")
        chunk_rows, err = fetch_campaign_insights(
            access_token, customer_id, c_since, c_until,
            login_customer_id=login_cid,
        )
        if err:
            last_error = err
            continue
        rows += chunk_rows
        # Détail annonce × jour (drill-down Campagne → Groupe → Annonce).
        # Best-effort : une erreur ici ne bloque pas le fetch campagne.
        chunk_ads, _ad_err = fetch_ad_insights(
            access_token, customer_id, c_since, c_until,
            login_customer_id=login_cid,
        )
        if not _ad_err:
            ad_rows += chunk_ads

    if not rows:
        # On distingue clairement une VRAIE erreur API d'un compte simplement sans
        # dépense sur la période — sinon « 0 données » laisse croire à un bug.
        if last_error:
            return {"success": False, "rows": 0, "message": f"Erreur Google Ads : {last_error}"}
        return {
            "success": True,
            "rows": 0,
            "message": "Compte Google Ads connecté, mais aucune dépense trouvée sur la période — rien à importer.",
        }

    # 4. Statuts campagnes
    _p(85, "Récupération des statuts…")
    status_map_raw, _ = fetch_campaign_statuses(access_token, customer_id)
    # status_map_raw : {campaign_id: (name, status, start_date, end_date)}

    # 5. Persist
    _p(92, "Sauvegarde Supabase…")
    try:
        upsert_google_ads(supabase, user_id, rows)
    except Exception as e:
        return {"success": False, "rows": 0, "message": f"Sauvegarde échouée: {e}"}
    # Détail annonce (best-effort : table absente si migration pas passée → on ignore)
    try:
        upsert_google_ads_ad_insights(supabase, user_id, ad_rows)
    except Exception:
        pass
    try:
        upsert_google_campaign_statuses(supabase, user_id, status_map_raw)
        cfg = st.session_state.setdefault("google_campaign_config", {})
        for cid, (cname, cstatus, _d1, _d2) in status_map_raw.items():
            cur = cfg.setdefault(cid, {})
            cur["campaign_name"] = cname
            cur["effective_status"] = cstatus
    except Exception:
        pass

    # 6. Recharger df en session
    try:
        persisted = fetch_google_ads(supabase, user_id)
        df_loaded = pd.DataFrame(persisted) if persisted else pd.DataFrame(rows)
        st.session_state["google_ads_df"] = df_loaded
    except Exception:
        st.session_state["google_ads_df"] = pd.DataFrame(rows)
    try:
        ad_persisted = fetch_google_ads_ad_insights(supabase, user_id)
        st.session_state["google_ads_ad_df"] = (
            pd.DataFrame(ad_persisted) if ad_persisted else pd.DataFrame(ad_rows)
        )
    except Exception:
        st.session_state["google_ads_ad_df"] = pd.DataFrame(ad_rows)

    return {"success": True, "rows": len(rows), "message": f"{len(rows)} entrées chargées"}


# ── Entry point — show_google_ads_tab ────────────────────────────────────────

def show_google_ads_tab(is_paid: bool = False, client=None, user_id: str | None = None):
    st.markdown(PULSE_CSS, unsafe_allow_html=True)
    inject_hierarchy_css()
    _init_google_state(client, user_id)
    df = st.session_state.get("google_ads_df")

    # Si pas de df mais user connecté → tenter fetch DB
    if (df is None or (isinstance(df, pd.DataFrame) and df.empty)) and client and user_id:
        try:
            ads_data = fetch_google_ads(client, user_id)
            if ads_data:
                df = pd.DataFrame(ads_data)
                st.session_state["google_ads_df"] = df
        except Exception:
            pass

    # Détail annonce (drill-down) — chargé une fois par session
    if "google_ads_ad_df" not in st.session_state and client and user_id:
        try:
            ad_data = fetch_google_ads_ad_insights(client, user_id)
            st.session_state["google_ads_ad_df"] = pd.DataFrame(ad_data) if ad_data else pd.DataFrame()
        except Exception:
            st.session_state["google_ads_ad_df"] = pd.DataFrame()

    # Plus d'onglets internes : les Coûts et les Labels ont leur page globale dédiée
    # (components/couts.py, components/labels_page.py). Ce canal = Performance seule.
    _show_google_perf_tab(df, client=client, user_id=user_id)


# ── Performance ────────────────────────────────────────────────────────────────

def _show_google_perf_tab(df, client, user_id):
    if df is None or (isinstance(df, pd.DataFrame) and df.empty):
        st.info(
            "Aucune donnée Google Ads. Va sur **Paramètres → Google Ads** "
            "puis clique sur **'Récupérer les données Google Ads'**."
        )
        return

    # Typage
    df = df.copy()
    for col in ["impressions", "clicks", "cost_micros", "avg_cpc_micros"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    df["date_start"] = pd.to_datetime(df["date_start"], errors="coerce")
    df["spend"] = df["cost_micros"] / 1_000_000.0
    df["cpc"] = df["avg_cpc_micros"] / 1_000_000.0
    df["ctr_pct"] = df["ctr"] * 100 if "ctr" in df.columns else 0

    # Période
    since_ts, until_ts = render_period_selector(key="gad", df_dates=df["date_start"])
    df_view = df[(df["date_start"] >= since_ts) & (df["date_start"] <= until_ts)].copy()

    if df_view.empty:
        latest = df["date_start"].max() if not df.empty else None
        period_label = st.session_state.get("gad_period", "30j")
        if latest is not None and pd.notna(latest):
            st.info(
                f"Aucune donnée sur la période **{period_label}**. "
                f"Dernière donnée disponible : **{latest.strftime('%d %b %Y')}**. "
                "Essaie 'Tout' ou rafraîchis depuis Paramètres."
            )
        else:
            st.info("Aucune donnée Google Ads.")
        return

    # Agrégats
    total_spend = df_view["spend"].sum()
    total_clicks = int(df_view["clicks"].sum())
    total_impr = int(df_view["impressions"].sum())
    total_conv = float(df_view["conversions"].sum()) if "conversions" in df_view.columns else 0.0
    avg_ctr = (total_clicks / total_impr * 100) if total_impr > 0 else 0.0
    avg_cpc = (total_spend / total_clicks) if total_clicks > 0 else 0.0

    nb_camp = int(df_view["campaign_id"].nunique())

    # Hero
    period_label = st.session_state.get("gad_period", "")
    if period_label == "Custom":
        _hp = f"du {since_ts.strftime('%d %b')} au {until_ts.strftime('%d %b %Y')}"
    elif period_label == "Tout":
        _hp = "tout l'historique"
    else:
        _hp = f"{period_label} derniers jours"

    st.markdown(
        f'<div class="page-h">'
        f'<div class="h-eyebrow">Google Ads · {_hp}</div>'
        f'<h1>{nb_camp} campagne{"s" if nb_camp != 1 else ""}, {total_spend:,.0f} CHF dépensés.</h1>'
        f'<p class="h-sub">CTR <b>{avg_ctr:.2f}%</b> · CPC <b>{avg_cpc:.2f} CHF</b> · '
        f'{int(total_conv):,} conversions.</p></div>',
        unsafe_allow_html=True,
    )

    # KPI grid
    c1, c2, c3, c4 = st.columns(4)
    for col, lbl, val in [
        (c1, "Dépensé",     f"{total_spend:,.0f} CHF"),
        (c2, "Impressions", f"{total_impr:,}"),
        (c3, "Clics",       f"{total_clicks:,}"),
        (c4, "Conversions", f"{int(total_conv):,}"),
    ]:
        with col:
            st.markdown(
                f'<div class="kpi-p"><div class="kp-lbl">{lbl}</div>'
                f'<div class="kp-val">{val}</div></div>',
                unsafe_allow_html=True,
            )

    # ── Évolution quotidienne (suit le filtre) — mirror Meta Ads ────────────
    df_daily = (
        df_view.groupby("date_start", as_index=False)
        .agg(
            impressions=("impressions", "sum"),
            clicks=("clicks", "sum"),
            spend=("spend", "sum"),
            conversions=("conversions", "sum"),
        )
        .sort_values("date_start")
    )
    df_daily["ctr"] = df_daily.apply(
        lambda r: r["clicks"] / r["impressions"] * 100 if r["impressions"] > 0 else 0, axis=1)
    df_daily["cpc"] = df_daily.apply(
        lambda r: r["spend"] / r["clicks"] if r["clicks"] > 0 else 0, axis=1)

    metric_map = {
        "Impressions": ("impressions", ""),
        "Clics":       ("clicks", ""),
        "CTR (%)":     ("ctr", "%"),
        "Dépenses":    ("spend", "CHF"),
        "CPC":         ("cpc", "CHF"),
        "Conversions": ("conversions", ""),
    }
    st.markdown('<div class="section-title">Évolution quotidienne</div>', unsafe_allow_html=True)
    sel_metric_label = st.selectbox(
        "Métrique", list(metric_map.keys()),
        key="gad_metric", label_visibility="collapsed",
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

    # ═══════════════════════════════════════════════════════════════════════
    # ─── VIEW GLOBALE (tout l'historique — indépendant du filtre) ──────────
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

    # Config Google (clé = campaign_id, contient campaign_name + label + budget_max).
    # Les helpers label de Meta sont clé par NOM → on re-mappe id → nom.
    g_config: dict = st.session_state.get("google_campaign_config", {}) or {}
    config_by_name = {
        (cfg or {}).get("campaign_name") or cid: (cfg or {})
        for cid, cfg in g_config.items()
    }

    # ── Performance par label (tout l'historique) — helpers partagés Meta ───
    st.markdown(
        '<div class="section-head">'
        '<div class="section-title">Performance par label</div></div>',
        unsafe_allow_html=True,
    )
    _render_perf_by_label(_build_agg_by_label(df, config_by_name))
    st.markdown("<br>", unsafe_allow_html=True)

    # ── Campagnes (cards + label + statut + drill-down) ─────────────────────
    df_camp = (
        df.groupby(["campaign_id", "campaign_name"], as_index=False)
        .agg(
            spend=("spend", "sum"),
            impressions=("impressions", "sum"),
            clicks=("clicks", "sum"),
            conversions=("conversions", "sum"),
        )
    )
    df_camp["ctr"] = df_camp.apply(
        lambda r: r["clicks"] / r["impressions"] * 100 if r["impressions"] > 0 else 0, axis=1)
    df_camp["cpc"] = df_camp.apply(
        lambda r: r["spend"] / r["clicks"] if r["clicks"] > 0 else 0, axis=1)

    # Statut courant (google_campaign_config, rempli au fetch) : ENABLED/PAUSED/REMOVED
    def _g_status(cid):
        s = (g_config.get(str(cid)) or {}).get("effective_status") or ""
        return "ACTIVE" if s.upper() == "ENABLED" else s

    df_camp["_status"] = df_camp["campaign_id"].map(_g_status)
    df_camp["_sort"] = df_camp.apply(
        lambda r: (0 if r["_status"] == "ACTIVE" else 1, -r["impressions"]), axis=1)
    df_camp = df_camp.sort_values("_sort").drop(columns=["_sort"])

    _ctr_pos = df_camp[df_camp["impressions"] > 0]
    best_ctr_camp = _ctr_pos.iloc[_ctr_pos["ctr"].argmax()]["campaign_name"] if not _ctr_pos.empty else None

    nb_active = int((df_camp["_status"] == "ACTIVE").sum())
    nb_paused = int(df_camp["_status"].str.upper().str.contains("PAUSED").sum())
    total_camp = len(df_camp)
    count_txt = f"{nb_active} actives · {nb_paused} en pause"

    labels: list[str] = st.session_state.get("google_campaign_labels", [])
    label_options = [_NO_LABEL] + sorted(labels)

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
        _render_new_label_popover(client, user_id, key="gad")

    df_ads = st.session_state.get("google_ads_ad_df")
    has_ad_detail = isinstance(df_ads, pd.DataFrame) and not df_ads.empty

    with st.container(height=720, border=False):
     for _, row in df_camp.iterrows():
        camp_name = row["campaign_name"]
        camp_id = str(row["campaign_id"])
        status = row["_status"]
        is_paused = "PAUSED" in str(status).upper()
        op = "0.62" if is_paused else "1"
        is_best = (camp_name == best_ctr_camp) and not is_paused
        trophy = "🏆 " if is_best else ""

        current_label = (g_config.get(camp_id) or {}).get("label") or None
        safe_key = camp_id[:50]
        camp_exp_key = f"gcamp_exp_{safe_key}"
        camp_expanded = st.session_state.get(camp_exp_key, False)

        _spend = float(row["spend"] or 0)
        _cpc = float(row["cpc"] or 0)
        _conv = float(row["conversions"] or 0)

        with st.container(border=True):
            (c_exp, c_lbl, c_name, c_status,
             c_impr, c_clicks, c_ctr,
             c_spend, c_cpc, c_conv) = st.columns(
                [0.4, 1.6, 2.6, 1, 1.1, 0.9, 1, 1.1, 1, 1]
            )

            with c_exp:
                chev = "▾" if camp_expanded else "▸"
                if st.button(chev, key=f"btn_{camp_exp_key}", help="Voir les groupes d'annonces"):
                    st.session_state[camp_exp_key] = not camp_expanded
                    st.rerun()

            with c_lbl:
                if client and user_id:
                    existing = current_label or _NO_LABEL
                    opts = label_options.copy()
                    if existing not in opts:
                        opts.insert(1, existing)
                    lbl_key = f"gperf_lbl_{safe_key}"
                    if lbl_key not in st.session_state:
                        st.session_state[lbl_key] = existing
                    st.selectbox(
                        "Label", options=opts, key=lbl_key,
                        label_visibility="collapsed",
                        on_change=_cb_save_google_camp_label,
                        args=(client, user_id, camp_id, camp_name, lbl_key),
                    )
                else:
                    chip = (f'<span class="chip">{current_label}</span>'
                            if current_label else '<span class="chip outline">—</span>')
                    st.markdown(f'<div style="padding-top:6px;">{chip}</div>', unsafe_allow_html=True)

            with c_name:
                st.markdown(
                    f'<div style="opacity:{op};padding-top:8px;">'
                    f'<div style="font-size:13.5px;font-weight:600;line-height:1.2;color:#0e0f12;">{trophy}{camp_name}</div>'
                    f'</div>',
                    unsafe_allow_html=True,
                )

            with c_status:
                st.markdown(
                    f'<div style="padding-top:8px;opacity:{op};">{_status_chip(status)}</div>',
                    unsafe_allow_html=True,
                )

            cells = [
                (c_impr,   "IMPRESSIONS", f"{int(row['impressions']):,}" if row['impressions'] > 0 else "—"),
                (c_clicks, "CLICS",       f"{int(row['clicks']):,}"      if row['clicks']      > 0 else "—"),
                (c_ctr,    "CTR",         f"{row['ctr']:.2f} %"          if row['ctr']         > 0 else "—"),
                (c_spend,  "DÉPENSÉ",     f"{_spend:,.0f} CHF"           if _spend > 0         else "—"),
                (c_cpc,    "CPC",         f"{_cpc:.2f} CHF"              if _cpc > 0           else "—"),
                (c_conv,   "CONV.",       f"{_conv:,.0f}"                if _conv > 0          else "—"),
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

        # ── Drill-down : Groupes d'annonces → Annonces ──────────────────────
        if camp_expanded:
            if has_ad_detail:
                _render_google_adgroups_drilldown(df_ads, camp_id, safe_key)
            else:
                st.markdown(
                    '<div style="font-size:11.5px;color:#8b8e98;padding:8px 0 8px 56px;">'
                    "Pas de détail par groupe d'annonces — rafraîchis les données Google Ads "
                    "(Paramètres) après avoir passé la migration <code>google_ads_ad_insights.sql</code>."
                    "</div>",
                    unsafe_allow_html=True,
                )


# ── Drill-down Google : Campagne → Groupes d'annonces → Annonces ──────────────

def _prep_ad_df(df_ads: pd.DataFrame) -> pd.DataFrame:
    df_ads = df_ads.copy()
    for col in ["impressions", "clicks", "cost_micros"]:
        if col in df_ads.columns:
            df_ads[col] = pd.to_numeric(df_ads[col], errors="coerce").fillna(0)
    df_ads["spend"] = df_ads["cost_micros"] / 1_000_000.0
    return df_ads


def _agg_metric_rows(grp: pd.DataFrame, by: str) -> pd.DataFrame:
    out = grp.groupby(by, as_index=False).agg(
        impressions=("impressions", "sum"),
        clicks=("clicks", "sum"),
        spend=("spend", "sum"),
    )
    out["ctr"] = out.apply(lambda r: r["clicks"] / r["impressions"] * 100 if r["impressions"] > 0 else 0, axis=1)
    out["cpm"] = out.apply(lambda r: r["spend"] / r["impressions"] * 1000 if r["impressions"] > 0 else 0, axis=1)
    out["cpc"] = out.apply(lambda r: r["spend"] / r["clicks"] if r["clicks"] > 0 else 0, axis=1)
    return out.sort_values("impressions", ascending=False)


def _render_google_adgroups_drilldown(df_ads: pd.DataFrame, camp_id: str, safe_key: str) -> None:
    """Groupes d'annonces d'une campagne (équivalent adsets Meta)."""
    df_ads = _prep_ad_df(df_ads)
    df_c = df_ads[df_ads["campaign_id"].astype(str) == str(camp_id)]
    if df_c.empty:
        st.markdown(
            '<div style="font-size:11.5px;color:#8b8e98;padding:8px 0 8px 56px;">'
            "Pas de détail annonce pour cette campagne (certains types — Performance Max "
            "notamment — n'exposent pas leurs métriques au niveau annonce)."
            "</div>",
            unsafe_allow_html=True,
        )
        return

    for _, ar in _agg_metric_rows(df_c, "ad_group_name").iterrows():
        ag_name = str(ar["ad_group_name"]) or "(sans nom)"
        ag_safe = ag_name.replace(" ", "_").replace("/", "_")[:40]
        ag_exp_key = f"gag_exp_{safe_key}_{ag_safe}"
        ag_expanded = st.session_state.get(ag_exp_key, False)

        def _toggle(k=ag_exp_key):
            st.session_state[k] = not st.session_state.get(k, False)

        _render_metric_row(
            name=ag_name,
            impressions=int(ar["impressions"]), reach=0,
            clicks=int(ar["clicks"]), ctr=float(ar["ctr"]),
            spend=float(ar["spend"]), cpm=float(ar["cpm"]), cpc=float(ar["cpc"]),
            level=1,
            chevron="▾" if ag_expanded else "▸",
            on_chevron_click=_toggle,
            chevron_key=f"btn_{ag_exp_key}",
        )
        if ag_expanded:
            df_g = df_c[df_c["ad_group_name"] == ar["ad_group_name"]]
            for _, adr in _agg_metric_rows(df_g, "ad_name").iterrows():
                _render_metric_row(
                    name=str(adr["ad_name"]) or "(sans nom)",
                    impressions=int(adr["impressions"]), reach=0,
                    clicks=int(adr["clicks"]), ctr=float(adr["ctr"]),
                    spend=float(adr["spend"]), cpm=float(adr["cpm"]), cpc=float(adr["cpc"]),
                    level=2, chevron=None,
                )


# ── Callback label campagne Google (on_change) ────────────────────────────────

def _cb_save_google_camp_label(client, user_id, camp_id, camp_name, key):
    if not (client and user_id):
        return
    val = st.session_state.get(key, _NO_LABEL)
    label = "" if val == _NO_LABEL else val
    cfg = st.session_state.setdefault("google_campaign_config", {})
    entry = cfg.setdefault(str(camp_id), {})
    entry["label"] = label or None
    entry.setdefault("campaign_name", camp_name)
    try:
        upsert_google_campaign_config(client, user_id, str(camp_id),
                                      campaign_name=camp_name, label=label)
    except Exception as e:
        st.toast(f"Sauvegarde label échouée : {e}", icon="⚠️")


# Coût et Labels Google Ads : déplacés vers les pages globales dédiées
# (components/couts.py et components/labels_page.py).
