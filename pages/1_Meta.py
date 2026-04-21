"""Meta Ads — dashboard analytics (Variation A · Clarity)."""
import streamlit as st
import plotly.graph_objects as go
from components.session import init_cookies, init_session_state
from components.api_client import api_call
from components.theme import (
    inject_global_theme, topbar_html, kpi_cell,
    sparkline_svg, trend_values, fmt_number, plotly_layout,
)

st.set_page_config(page_title="Meta Ads", page_icon="📘", layout="wide")

# ── Session ────────────────────────────────────────────────────────────────
cookies = init_cookies()
init_session_state(cookies)

if not st.session_state.get("access_token"):
    st.warning("Connexion requise")
    if st.button("Retour"):
        st.switch_page("app.py")
    st.stop()

me_result = api_call("GET", "/auth/me")
if me_result.get("error"):
    st.error("Session expirée")
    st.switch_page("app.py")
    st.stop()

account_id = me_result.get("data", {}).get("account_id", "")

# ── Design system ──────────────────────────────────────────────────────────
inject_global_theme()

# ── Sidebar ────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown(
        '<div style="display:flex;align-items:center;gap:8px;padding:0 2px 16px;">'
        '<div style="width:22px;height:22px;background:#0a0a0a;border-radius:5px;flex-shrink:0;"></div>'
        '<span style="font-size:13px;font-weight:600;color:#0a0a0a;letter-spacing:-0.3px;">Dashboard</span>'
        "</div>",
        unsafe_allow_html=True,
    )
    if st.button("Overview", use_container_width=True):
        st.switch_page("app.py")
    st.button("Meta Ads", use_container_width=True, type="primary", disabled=True)
    if st.button("Instagram", use_container_width=True):
        st.switch_page("pages/2_Instagram.py")
    if st.button("Settings", use_container_width=True):
        st.switch_page("pages/3_Settings.py")
    st.markdown("<hr>", unsafe_allow_html=True)
    if st.button("Déconnexion", use_container_width=True):
        from components.session import create_token_manager
        _, clear_tokens = create_token_manager(cookies)
        clear_tokens()
        st.rerun()

# ── Connexion check ────────────────────────────────────────────────────────
meta_status = api_call("GET", f"/meta/status?account_id={account_id}")
meta_connected = (meta_status.get("data") or {}).get("connected", False)

if not meta_connected:
    st.markdown(topbar_html("Meta Ads", tabs=["Aperçu", "Campagnes"]), unsafe_allow_html=True)
    st.markdown("<br>", unsafe_allow_html=True)
    st.warning("Meta Ads n'est pas connecté")
    oauth_result = api_call("GET", f"/meta/oauth-url?account_id={account_id}")
    url = (oauth_result.get("data") or {}).get("url", "")
    if url:
        st.link_button("Connecter Meta Ads", url, type="primary")
    else:
        st.info("Configure d'abord ton App Meta dans Settings")
        if st.button("Aller aux Settings"):
            st.switch_page("pages/3_Settings.py")
    st.stop()

# ── Topbar ─────────────────────────────────────────────────────────────────
st.markdown(
    topbar_html("Meta Ads", tabs=["Aperçu", "Campagnes"], active_tab="Aperçu"),
    unsafe_allow_html=True,
)

# ── Données API ────────────────────────────────────────────────────────────
score_result = api_call("GET", f"/scores?account_id={account_id}")
score_data = score_result.get("data") or {}

insights_result = api_call("GET", f"/meta/insights?account_id={account_id}")
insights = insights_result.get("data") or {}

spend   = insights.get("spend", 0) or 0
reach   = insights.get("reach", 0) or 0
clicks  = insights.get("clicks", 0) or 0
ctr     = insights.get("ctr", 0) or 0
cpc     = insights.get("cpc", 0) or 0
impressions = insights.get("impressions", 0) or 0

top_content = score_data.get("top_content", []) or []

# ── Bouton rafraîchir ──────────────────────────────────────────────────────
c_space, c_btn = st.columns([8, 1])
with c_btn:
    if st.button("↻ Sync", type="primary"):
        with st.spinner("Import en cours..."):
            result = api_call("POST", f"/meta/import?account_id={account_id}")
        if result.get("error"):
            st.error(result["error"]["message"])
        else:
            st.success("Données mises à jour !")
            st.rerun()

# ── Tabs ───────────────────────────────────────────────────────────────────
tab_apercu, tab_camps = st.tabs(["Aperçu", "Campagnes"])

# ══════════════════════════════════════════════════════════════════════════
# TAB APERÇU
# ══════════════════════════════════════════════════════════════════════════
with tab_apercu:

    # ── Coach IA ───────────────────────────────────────────────────────────
    if ctr > 2:
        ia_text = (
            f"Excellent CTR à <strong>{ctr:.2f}%</strong> — tu es au-dessus de la moyenne Meta (0.9%). "
            f"Budget dépensé : <strong>{spend:.2f} CHF</strong> pour <strong>{fmt_number(reach)}</strong> personnes atteintes. "
            "Continue cette stratégie et augmente progressivement le budget sur les <strong>adsets gagnants</strong>."
        )
    elif ctr > 1:
        ia_text = (
            f"CTR à <strong>{ctr:.2f}%</strong> — dans la bonne fourchette. "
            f"Ton CPC est de <strong>{cpc:.2f} CHF</strong>. "
            "Pour l'améliorer, teste de nouveaux visuels et reformule ton <strong>call-to-action</strong> principal."
        )
    elif spend > 0:
        ia_text = (
            f"CTR faible à <strong>{ctr:.2f}%</strong> pour <strong>{spend:.2f} CHF</strong> dépensés. "
            "Revois ton ciblage d'audience et tes creatives. "
            "Un <strong>test A/B</strong> sur les visuels peut doubler le CTR en une semaine."
        )
    else:
        ia_text = (
            "Importe tes données Meta Ads pour recevoir une analyse personnalisée. "
            "Clique sur <strong>↻ Sync</strong> pour commencer."
        )

    st.markdown(f"""
    <div class="coach-ia">
        <div class="coach-ia-label">Coach IA · Aujourd'hui</div>
        <p class="coach-ia-text">{ia_text}</p>
        <div class="coach-ia-actions">
            <span class="coach-ia-btn">👍 Utile</span>
            <span class="coach-ia-btn">👎 Pas pertinent</span>
            <span class="coach-ia-btn">↻ Actualiser</span>
        </div>
    </div>
    """, unsafe_allow_html=True)

    # ── KPI Strip ──────────────────────────────────────────────────────────
    sp_spend  = sparkline_svg(trend_values(spend, -2.1),  "#0a0a0a")
    sp_reach  = sparkline_svg(trend_values(reach, 4.3),   "#1a56ff")
    sp_clicks = sparkline_svg(trend_values(clicks, 6.8),  "#7c5fe6")
    sp_ctr    = sparkline_svg(trend_values(ctr * 100, 1.2), "#14b87a")

    st.markdown(f"""
    <div class="kpi-strip">
        {kpi_cell("Budget dépensé", f"{spend:.2f} CHF", -2.1, sp_spend)}
        {kpi_cell("Portée",         fmt_number(reach),  4.3,  sp_reach)}
        {kpi_cell("Clics",          fmt_number(clicks), 6.8,  sp_clicks)}
        {kpi_cell("CTR",            f"{ctr:.2f}%",      1.2,  sp_ctr)}
    </div>
    """, unsafe_allow_html=True)

    # ── Graphique CPC + Top campagnes ──────────────────────────────────────
    col_chart, col_top = st.columns([3, 2], gap="large")

    with col_chart:
        st.markdown('<div class="section-card">', unsafe_allow_html=True)
        st.markdown(
            '<div class="section-title">Performance campagnes</div>'
            '<div class="pills">'
            '<span class="pill-active">CTR</span>'
            '<span class="pill-inactive">Clics</span>'
            '<span class="pill-inactive">Budget</span>'
            "</div>",
            unsafe_allow_html=True,
        )

        if top_content:
            names = [c.get("name", "Campagne")[:20] for c in top_content[:6]]
            ctrs  = [c.get("ctr", 0) for c in top_content[:6]]
        else:
            names = ["—"]
            ctrs  = [0]

        fig = go.Figure(go.Bar(
            x=names,
            y=ctrs,
            marker_color="#1a56ff",
            marker_opacity=0.7,
            marker_line_width=0,
        ))

        layout = plotly_layout()
        layout.update(height=200, bargap=0.35, showlegend=False)
        fig.update_layout(**layout)
        fig.update_xaxes(tickfont=dict(size=9))
        st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
        st.markdown("</div>", unsafe_allow_html=True)

    with col_top:
        st.markdown('<div class="section-card">', unsafe_allow_html=True)
        st.markdown('<div class="section-title">Top 3 Campagnes</div>', unsafe_allow_html=True)

        if top_content:
            rows = ""
            for idx, item in enumerate(top_content[:3], 1):
                name = (item.get("name", "Sans nom") or "Sans nom")[:30]
                ctr_val = item.get("ctr", 0) or 0
                spend_val = item.get("spend", 0) or 0
                rows += f"""
                <div class="top-post-row">
                    <span class="post-rank">0{idx}</span>
                    <div class="post-thumb">📢</div>
                    <div class="post-info">
                        <div class="post-value">{ctr_val:.2f}% CTR</div>
                        <div class="post-meta">{name}</div>
                    </div>
                    <span class="post-chip">{spend_val:.2f} CHF</span>
                </div>
                """
            st.markdown(rows, unsafe_allow_html=True)
        else:
            st.markdown(
                '<p style="font-size:12px;color:var(--ink-4);">Importe tes données pour voir le top.</p>',
                unsafe_allow_html=True,
            )

        st.markdown("</div>", unsafe_allow_html=True)

    # ── Tableau publicités ─────────────────────────────────────────────────
    if top_content:
        st.markdown('<div class="section-card">', unsafe_allow_html=True)
        st.markdown('<div class="section-title">Meilleures publicités (7 jours)</div>', unsafe_allow_html=True)

        rows = ""
        for item in top_content[:8]:
            name = (item.get("name", "—") or "—")[:55]
            ctr_val   = item.get("ctr", 0) or 0
            impr      = item.get("impressions", 0) or 0
            spend_val = item.get("spend", 0) or 0
            cpc_val   = item.get("cpc", 0) or 0

            rows += f"""
            <tr>
                <td class="sans" style="font-family:DM Sans,sans-serif;font-size:11px;color:var(--ink-3);">{name}</td>
                <td>{ctr_val:.2f}%</td>
                <td>{fmt_number(impr)}</td>
                <td>{spend_val:.2f}</td>
                <td>{cpc_val:.2f}</td>
            </tr>
            """

        st.markdown(f"""
        <table class="posts-tbl">
            <thead>
                <tr>
                    <th>Publicité</th>
                    <th>CTR</th>
                    <th>Impressions</th>
                    <th>Budget (CHF)</th>
                    <th>CPC (CHF)</th>
                </tr>
            </thead>
            <tbody>{rows}</tbody>
        </table>
        """, unsafe_allow_html=True)

        st.markdown("</div>", unsafe_allow_html=True)

# ══════════════════════════════════════════════════════════════════════════
# TAB CAMPAGNES
# ══════════════════════════════════════════════════════════════════════════
with tab_camps:
    if not top_content:
        st.info("Clique sur ↻ Sync pour importer tes campagnes.")
    else:
        st.markdown('<div class="section-card">', unsafe_allow_html=True)
        st.markdown('<div class="section-title">Toutes les campagnes</div>', unsafe_allow_html=True)

        rows = ""
        for item in top_content:
            name      = (item.get("name", "—") or "—")[:60]
            ctr_val   = item.get("ctr", 0) or 0
            impr      = item.get("impressions", 0) or 0
            spend_val = item.get("spend", 0) or 0
            cpc_val   = item.get("cpc", 0) or 0
            reach_val = item.get("reach", 0) or 0

            delta_cls = "pos" if ctr_val > 1 else "neg" if ctr_val < 0.5 else "neu"
            rows += f"""
            <tr>
                <td class="sans" style="font-family:DM Sans,sans-serif;font-size:11px;color:var(--ink-3);">{name}</td>
                <td><span class="kpi-delta {delta_cls}">{ctr_val:.2f}%</span></td>
                <td>{fmt_number(impr)}</td>
                <td>{fmt_number(reach_val)}</td>
                <td>{spend_val:.2f}</td>
                <td>{cpc_val:.2f}</td>
            </tr>
            """

        st.markdown(f"""
        <table class="posts-tbl">
            <thead>
                <tr>
                    <th>Campagne</th>
                    <th>CTR</th>
                    <th>Impressions</th>
                    <th>Portée</th>
                    <th>Budget (CHF)</th>
                    <th>CPC (CHF)</th>
                </tr>
            </thead>
            <tbody>{rows}</tbody>
        </table>
        """, unsafe_allow_html=True)

        st.markdown("</div>", unsafe_allow_html=True)
