"""Tab Google Ads — Performance / Coût / Labels (mirror Meta Ads).

Architecture identique :
- show_google_ads_tab(client, user_id, is_paid) : entry point, st.tabs(Performance/Coût/Labels)
- run_google_ads_fetch(...) : fetch sans UI (utilisable depuis auto-fetch OAuth)
- google_ads_source_fragment(...) : UI manuelle dans Paramètres
- _show_google_cout_tab, _show_google_labels_tab
"""

import time
from datetime import date, timedelta

import streamlit as st
import pandas as pd

from scripts.fetch_data import (
    fetch_google_ads,
    fetch_google_ads_latest_date,
    fetch_google_campaign_labels,
    fetch_google_budget_global,
    fetch_google_campaign_config,
)
from scripts.insert_data import (
    upsert_google_ads,
    update_google_campaign_labels,
    update_google_budget_global,
    upsert_google_campaign_config,
    upsert_google_campaign_statuses,
    rename_google_campaign_label,
    clear_google_campaign_label,
    update_google_refresh_token,
)
from components.meta_ads import render_period_selector, _NO_LABEL
from google_script.fetch_token import get_access_token_from_refresh
from google_script.fetch_google_ads import (
    list_accessible_customers,
    list_managed_accounts,
    fetch_campaign_insights,
    fetch_campaign_statuses,
)


def _micros_to_chf(v: int | float) -> float:
    return float(v or 0) / 1_000_000.0


def _init_google_state(client, user_id) -> None:
    """Charge labels + budget + config Google une fois par session."""
    if not (client and user_id):
        return
    if st.session_state.get("google_initialized"):
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
):
    """Fetch Google Ads insights pour un customer_id donné, sauvegarde Supabase.
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
    latest = fetch_google_ads_latest_date(supabase, user_id) if not force_full else None
    if latest:
        since = date.fromisoformat(latest) + timedelta(days=1)
    else:
        since = date(today.year, 1, 1)  # depuis 1er janvier année courante
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

    rows = []
    last_error = None
    for i, (c_since, c_until) in enumerate(chunks):
        _p(int(10 + (i / max(len(chunks), 1)) * 70),
           f"Chargement {c_since:%b %Y} → {c_until:%b %Y}… ({len(rows)} lignes)")
        chunk_rows, err = fetch_campaign_insights(
            access_token, customer_id, c_since, c_until,
        )
        if err:
            last_error = err
            continue
        rows += chunk_rows

    if not rows:
        msg = f"Aucune nouvelle donnée. {('Erreur: ' + last_error) if last_error else ''}".strip()
        return {"success": last_error is None, "rows": 0, "message": msg}

    # 4. Statuts campagnes
    _p(85, "Récupération des statuts…")
    status_map_raw, _ = fetch_campaign_statuses(access_token, customer_id)
    # status_map_raw : {campaign_id: (name, status)}

    # 5. Persist
    _p(92, "Sauvegarde Supabase…")
    try:
        upsert_google_ads(supabase, user_id, rows)
    except Exception as e:
        return {"success": False, "rows": 0, "message": f"Sauvegarde échouée: {e}"}
    try:
        upsert_google_campaign_statuses(supabase, user_id, status_map_raw)
        cfg = st.session_state.setdefault("google_campaign_config", {})
        for cid, (cname, cstatus) in status_map_raw.items():
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

    return {"success": True, "rows": len(rows), "message": f"{len(rows)} entrées chargées"}


# ── Entry point — show_google_ads_tab ────────────────────────────────────────

def show_google_ads_tab(is_paid: bool = False, client=None, user_id: str | None = None):
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

    tab_perf, tab_cout, tab_labels = st.tabs(["Performance", "Coût", "Labels"])
    with tab_perf:
        _show_google_perf_tab(df, client=client, user_id=user_id)
    with tab_cout:
        _show_google_cout_tab(df, client=client, user_id=user_id)
    with tab_labels:
        _show_google_labels_tab(client, user_id)


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

    # Tableau par campagne
    st.markdown(
        '<div class="section-head" style="margin-top:24px;">'
        '<div class="section-title">Campagnes</div></div>',
        unsafe_allow_html=True,
    )

    df_camp = (
        df_view.groupby(["campaign_id", "campaign_name"], as_index=False)
        .agg(
            spend=("spend", "sum"),
            impressions=("impressions", "sum"),
            clicks=("clicks", "sum"),
            conversions=("conversions", "sum"),
        )
        .sort_values("spend", ascending=False)
    )
    df_camp["CTR %"] = df_camp.apply(
        lambda r: (r["clicks"] / r["impressions"] * 100) if r["impressions"] > 0 else 0, axis=1)
    df_camp["CPC"] = df_camp.apply(
        lambda r: (r["spend"] / r["clicks"]) if r["clicks"] > 0 else 0, axis=1)

    df_show = df_camp.rename(columns={
        "campaign_name": "Campagne",
        "spend": "Dépensé",
        "impressions": "Impr.",
        "clicks": "Clics",
        "conversions": "Conv.",
    })[["Campagne", "Dépensé", "Impr.", "Clics", "CTR %", "CPC", "Conv."]]

    st.dataframe(
        df_show,
        use_container_width=True,
        hide_index=True,
        column_config={
            "Campagne":  st.column_config.TextColumn("Campagne", width="large"),
            "Dépensé":   st.column_config.NumberColumn("Dépensé", format="%.0f CHF"),
            "Impr.":     st.column_config.NumberColumn("Impr.", format="%d"),
            "Clics":     st.column_config.NumberColumn("Clics", format="%d"),
            "CTR %":     st.column_config.NumberColumn("CTR %", format="%.2f%%"),
            "CPC":       st.column_config.NumberColumn("CPC", format="%.2f CHF"),
            "Conv.":     st.column_config.NumberColumn("Conv.", format="%.0f"),
        },
    )


# ── Coût ──────────────────────────────────────────────────────────────────────

def _show_google_cout_tab(df, client, user_id):
    st.info("Tab Coût — à compléter selon les besoins (similaire à Meta Ads Coût).")
    # TODO : copier la logique de _show_cout_tab (budget global + détail campagne + pacing)


# ── Labels ────────────────────────────────────────────────────────────────────

def _show_google_labels_tab(client, user_id):
    if not (client and user_id):
        st.warning("Connecte ton compte pour gérer les labels.")
        return

    labels = st.session_state.get("google_campaign_labels", [])

    st.markdown(
        '<div class="page-h" style="padding:8px 0 16px;">'
        '<div class="h-eyebrow">Labels Google Ads</div>'
        '<h1>Tes étiquettes de campagne.</h1>'
        '<p class="h-sub">Crée des labels (ex. Search, Display, Brand…) pour grouper tes campagnes Google Ads.</p>'
        '</div>',
        unsafe_allow_html=True,
    )

    # Compteur
    campaign_config = st.session_state.get("google_campaign_config", {}) or {}
    df_g = st.session_state.get("google_ads_df")
    if df_g is not None and not df_g.empty and "campaign_id" in df_g.columns:
        all_cids = df_g["campaign_id"].astype(str).unique().tolist()
        nb = len(all_cids)
        nb_lbl = sum(1 for c in all_cids if (campaign_config.get(c) or {}).get("label"))
        if nb > 0:
            st.progress(nb_lbl / nb, text=f"**{nb_lbl} / {nb}** campagnes labelisées")
            st.markdown("<br>", unsafe_allow_html=True)

    # Ajouter
    with st.form("gad_lbl_add_form", clear_on_submit=True):
        col_in, col_btn = st.columns([4, 1])
        with col_in:
            new_lbl = st.text_input("Nouveau label", label_visibility="collapsed",
                                     placeholder="ex: Search, Brand, Display…")
        with col_btn:
            submitted = st.form_submit_button("Ajouter", type="primary", use_container_width=True)
    if submitted:
        cleaned = (new_lbl or "").strip()
        if cleaned and cleaned not in labels:
            try:
                update_google_campaign_labels(client, user_id, labels + [cleaned])
                st.session_state["google_campaign_labels"] = labels + [cleaned]
                st.rerun()
            except Exception as e:
                st.toast(f"Ajout échoué : {e}", icon="⚠️")
        elif cleaned in labels:
            st.toast(f"« {cleaned} » existe déjà", icon="ℹ️")

    # Liste
    if not labels:
        st.info("Aucun label. Ajoute-en un ci-dessus.")
        return

    for i, lbl in enumerate(labels):
        c_name, c_save, c_del = st.columns([5, 2, 2])
        edit_key = f"gad_lbl_edit_{i}"
        with c_name:
            st.text_input("Label", value=lbl, key=edit_key, label_visibility="collapsed")
        with c_save:
            if st.button("Enregistrer", key=f"gad_lbl_rn_{i}", use_container_width=True):
                new_name = (st.session_state.get(edit_key) or "").strip()
                if new_name and new_name != lbl and new_name not in labels:
                    try:
                        new_list = [new_name if x == lbl else x for x in labels]
                        update_google_campaign_labels(client, user_id, new_list)
                        rename_google_campaign_label(client, user_id, lbl, new_name)
                        st.session_state["google_campaign_labels"] = new_list
                        st.rerun()
                    except Exception as e:
                        st.toast(f"Renommage échoué : {e}", icon="⚠️")
        with c_del:
            if st.button("🗑 Supprimer", key=f"gad_lbl_del_{i}", use_container_width=True):
                try:
                    new_list = [x for x in labels if x != lbl]
                    update_google_campaign_labels(client, user_id, new_list)
                    clear_google_campaign_label(client, user_id, lbl)
                    st.session_state["google_campaign_labels"] = new_list
                    st.rerun()
                except Exception as e:
                    st.toast(f"Suppression échouée : {e}", icon="⚠️")
