"""Instagram — dashboard analytics (Variation A · Clarity)."""
import streamlit as st
import plotly.graph_objects as go
from components.session import init_cookies, init_session_state
from components.api_client import api_call
from components.theme import (
    inject_global_theme, topbar_html, kpi_cell,
    sparkline_svg, trend_values, fmt_number, plotly_layout,
)

st.set_page_config(page_title="Instagram", page_icon="📸", layout="wide")

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
    if st.button("Meta Ads", use_container_width=True):
        st.switch_page("pages/1_Meta.py")
    st.button("Instagram", use_container_width=True, type="primary", disabled=True)
    if st.button("Settings", use_container_width=True):
        st.switch_page("pages/3_Settings.py")
    st.markdown("<hr>", unsafe_allow_html=True)
    if st.button("Déconnexion", use_container_width=True):
        from components.session import create_token_manager
        _, clear_tokens = create_token_manager(cookies)
        clear_tokens()
        st.rerun()

# ── Connexion check ────────────────────────────────────────────────────────
ig_status = api_call("GET", f"/instagram/status?account_id={account_id}")
ig_data = ig_status.get("data") or {}
ig_connected = ig_data.get("connected", False)
ig_username = ig_data.get("username", "")
ig_followers = ig_data.get("followers_count", 0) or 0

if not ig_connected:
    st.markdown(topbar_html("Instagram", tabs=["Aperçu", "Posts"]), unsafe_allow_html=True)
    st.markdown("<br>", unsafe_allow_html=True)
    st.warning("Instagram n'est pas connecté")
    oauth_result = api_call("GET", f"/instagram/oauth-url?account_id={account_id}")
    url = (oauth_result.get("data") or {}).get("url", "")
    if url:
        st.link_button("Connecter Instagram", url, type="primary")
    else:
        st.info("Configure d'abord ton App Meta dans Settings")
        if st.button("Aller aux Settings"):
            st.switch_page("pages/3_Settings.py")
    st.stop()

# ── Topbar ─────────────────────────────────────────────────────────────────
st.markdown(
    topbar_html(f"@{ig_username}", tabs=["Aperçu", "Posts"], active_tab="Aperçu"),
    unsafe_allow_html=True,
)

# ── Données API ────────────────────────────────────────────────────────────
score_result = api_call("GET", f"/instagram/score?account_id={account_id}")
score_data = score_result.get("data") or {}

insights_result = api_call("GET", f"/instagram/insights?account_id={account_id}")
insights = insights_result.get("data") or {}

posts_data = insights.get("posts", []) or insights.get("media", []) or []

reach = insights.get("total_reach", 0) or 0
engagement = insights.get("total_engagement", 0) or 0
eng_rate = insights.get("engagement_rate", 0) or 0
saves = insights.get("total_saves", 0) or 0

top_content = score_data.get("top_content", []) or []

# ── Bouton rafraîchir ──────────────────────────────────────────────────────
c_space, c_btn = st.columns([8, 1])
with c_btn:
    if st.button("↻ Sync", type="primary"):
        with st.spinner("Import en cours..."):
            result = api_call("POST", f"/instagram/import?account_id={account_id}")
        if result.get("error"):
            st.error(result["error"]["message"])
        else:
            st.success("Données mises à jour !")
            st.rerun()

# ── Tabs ───────────────────────────────────────────────────────────────────
tab_apercu, tab_posts = st.tabs(["Aperçu", "Posts (7j)"])

# ══════════════════════════════════════════════════════════════════════════
# TAB APERÇU
# ══════════════════════════════════════════════════════════════════════════
with tab_apercu:

    # ── Coach IA ───────────────────────────────────────────────────────────
    if eng_rate > 5:
        ia_text = (
            f"Ton taux d'engagement est <strong>excellent à {eng_rate:.1f}%</strong> — "
            "bien au-dessus de la moyenne Instagram (1–3%). "
            f"Avec <strong>{fmt_number(ig_followers)} abonnés</strong>, ton contenu résonne fort. "
            "Continue ce rythme et teste les <strong>Reels courts</strong> pour amplifier la portée."
        )
    elif eng_rate > 3:
        ia_text = (
            f"Bon engagement à <strong>{eng_rate:.1f}%</strong>. "
            f"Ta portée est de <strong>{fmt_number(reach)}</strong> sur la période. "
            "Pour progresser, publie plus de <strong>Reels</strong> — ils génèrent en moyenne "
            "2× plus de portée que les images."
        )
    elif eng_rate > 0:
        ia_text = (
            f"Engagement à <strong>{eng_rate:.1f}%</strong> — il y a de la marge. "
            f"Tes <strong>{fmt_number(saves)} sauvegardes</strong> indiquent que le contenu intéresse, "
            "mais que la conversion en likes reste faible. "
            "Teste des <strong>carrousels éducatifs</strong> et des appels à l'action explicites."
        )
    else:
        ia_text = (
            "Importe tes données pour recevoir une analyse personnalisée. "
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
    sp_followers = sparkline_svg(trend_values(ig_followers, 3.2), "#1a56ff")
    sp_reach     = sparkline_svg(trend_values(reach, 5.1),       "#7c5fe6")
    sp_eng       = sparkline_svg(trend_values(engagement, 2.4),  "#14b87a")
    sp_saves     = sparkline_svg(trend_values(saves, 1.8),        "#e07b1a")

    st.markdown(f"""
    <div class="kpi-strip">
        {kpi_cell("Abonnés",    fmt_number(ig_followers), 3.2,  sp_followers)}
        {kpi_cell("Portée",     fmt_number(reach),        5.1,  sp_reach)}
        {kpi_cell("Engagement", fmt_number(engagement),   2.4,  sp_eng)}
        {kpi_cell("Sauvegardes",fmt_number(saves),        1.8,  sp_saves)}
    </div>
    """, unsafe_allow_html=True)

    # ── Graphique + Top 3 ──────────────────────────────────────────────────
    col_chart, col_top = st.columns([3, 2], gap="large")

    with col_chart:
        st.markdown('<div class="section-card">', unsafe_allow_html=True)
        st.markdown(
            '<div class="section-title">Performance par format</div>'
            '<div class="pills">'
            '<span class="pill-active">Likes</span>'
            '<span class="pill-inactive">Portée</span>'
            '<span class="pill-inactive">Saves</span>'
            "</div>",
            unsafe_allow_html=True,
        )

        # Agréger par type de post
        type_data: dict = {"Image": 0, "Reel": 0, "Carrousel": 0}
        for p in posts_data:
            mt = p.get("media_type", "IMAGE")
            likes = p.get("like_count", 0) or p.get("likes", 0) or 0
            if mt == "REELS":
                type_data["Reel"] += likes
            elif mt == "CAROUSEL_ALBUM":
                type_data["Carrousel"] += likes
            else:
                type_data["Image"] += likes

        labels = list(type_data.keys())
        values = list(type_data.values())
        colors = ["#0a0a0a", "#1a56ff", "#6b7dd6"]

        fig = go.Figure()
        for i, (lbl, val) in enumerate(zip(labels, values)):
            fig.add_trace(go.Bar(
                name=lbl,
                x=[lbl],
                y=[val],
                marker_color=colors[i],
                marker_opacity=0.7,
                marker_line_width=0,
            ))

        layout = plotly_layout()
        layout.update(
            height=200,
            bargap=0.35,
            showlegend=False,
        )
        fig.update_layout(**layout)
        st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
        st.markdown("</div>", unsafe_allow_html=True)

    with col_top:
        st.markdown('<div class="section-card">', unsafe_allow_html=True)
        st.markdown('<div class="section-title">Top 3 Posts</div>', unsafe_allow_html=True)

        display_posts = top_content[:3] if top_content else posts_data[:3]

        if display_posts:
            rows = ""
            for idx, item in enumerate(display_posts, 1):
                mt = item.get("media_type", "IMAGE")
                icon = "🎬" if mt == "REELS" else "🖼️" if mt == "IMAGE" else "📸"
                type_label = "Reel" if mt == "REELS" else "Image" if mt == "IMAGE" else "Carousel"
                likes = item.get("like_count", 0) or item.get("likes", 0) or 0
                comments = item.get("comments_count", 0) or item.get("comments", 0) or 0
                rows += f"""
                <div class="top-post-row">
                    <span class="post-rank">0{idx}</span>
                    <div class="post-thumb">{icon}</div>
                    <div class="post-info">
                        <div class="post-value">{fmt_number(likes)} likes</div>
                        <div class="post-meta">{fmt_number(comments)} commentaires</div>
                    </div>
                    <span class="post-chip">{type_label}</span>
                </div>
                """
            st.markdown(rows, unsafe_allow_html=True)
        else:
            st.markdown(
                '<p style="font-size:12px;color:var(--ink-4);">Importe tes données pour voir le top.</p>',
                unsafe_allow_html=True,
            )

        st.markdown("</div>", unsafe_allow_html=True)

    # ── Tableau posts ──────────────────────────────────────────────────────
    if posts_data:
        st.markdown('<div class="section-card">', unsafe_allow_html=True)
        st.markdown('<div class="section-title">Tous les posts (7 jours)</div>', unsafe_allow_html=True)

        rows = ""
        for post in posts_data[:10]:
            mt = post.get("media_type", "IMAGE")
            type_label = "Reel" if mt == "REELS" else "Image" if mt == "IMAGE" else "Carousel"
            likes = post.get("like_count", 0) or post.get("likes", 0) or 0
            comments = post.get("comments_count", 0) or post.get("comments", 0) or 0
            post_saves = post.get("saves", 0) or 0
            total = likes + comments + post_saves
            rate = f"{total / ig_followers * 100:.2f}%" if ig_followers else "—"
            caption = (post.get("caption", "") or "")[:55]
            caption_html = (
                f'<div style="height:6px;background:var(--bg-3);border-radius:3px;width:65%;"></div>'
                if not caption else
                f'<span class="sans" style="font-family:DM Sans,sans-serif;font-size:11px;color:var(--ink-3);">{caption}</span>'
            )

            rows += f"""
            <tr>
                <td class="sans">{caption_html}</td>
                <td><span class="tbl-chip">{type_label}</span></td>
                <td>{fmt_number(likes)}</td>
                <td>{fmt_number(comments)}</td>
                <td>{fmt_number(post_saves)}</td>
                <td>{rate}</td>
            </tr>
            """

        st.markdown(f"""
        <table class="posts-tbl">
            <thead>
                <tr>
                    <th>Post</th>
                    <th>Type</th>
                    <th>Likes</th>
                    <th>Comments</th>
                    <th>Saves</th>
                    <th>Eng. Rate</th>
                </tr>
            </thead>
            <tbody>{rows}</tbody>
        </table>
        """, unsafe_allow_html=True)

        st.markdown("</div>", unsafe_allow_html=True)

# ══════════════════════════════════════════════════════════════════════════
# TAB POSTS
# ══════════════════════════════════════════════════════════════════════════
with tab_posts:
    if not posts_data:
        st.info("Clique sur ↻ Sync pour importer tes posts.")
    else:
        st.markdown('<div class="section-card">', unsafe_allow_html=True)
        st.markdown('<div class="section-title">Tous les posts importés</div>', unsafe_allow_html=True)

        rows = ""
        for post in posts_data:
            mt = post.get("media_type", "IMAGE")
            type_label = "Reel" if mt == "REELS" else "Image" if mt == "IMAGE" else "Carousel"
            icon = "🎬" if mt == "REELS" else "🖼️" if mt == "IMAGE" else "📸"
            likes = post.get("like_count", 0) or post.get("likes", 0) or 0
            comments = post.get("comments_count", 0) or post.get("comments", 0) or 0
            post_saves = post.get("saves", 0) or 0
            total = likes + comments + post_saves
            rate = f"{total / ig_followers * 100:.2f}%" if ig_followers else "—"
            caption = (post.get("caption", "") or "")[:70]
            caption_display = caption + "…" if len(caption) == 70 else caption

            rows += f"""
            <tr>
                <td class="sans" style="font-family:DM Sans,sans-serif;">
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span style="font-size:16px;">{icon}</span>
                        <span style="font-size:11px;color:var(--ink-3);max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{caption_display or "—"}</span>
                    </div>
                </td>
                <td><span class="tbl-chip">{type_label}</span></td>
                <td>{fmt_number(likes)}</td>
                <td>{fmt_number(comments)}</td>
                <td>{fmt_number(post_saves)}</td>
                <td>{rate}</td>
            </tr>
            """

        st.markdown(f"""
        <table class="posts-tbl">
            <thead>
                <tr>
                    <th style="width:2fr;">Post</th>
                    <th style="width:80px;">Type</th>
                    <th style="width:72px;">Likes</th>
                    <th style="width:80px;">Comments</th>
                    <th style="width:72px;">Saves</th>
                    <th style="width:90px;">Eng. Rate</th>
                </tr>
            </thead>
            <tbody>{rows}</tbody>
        </table>
        """, unsafe_allow_html=True)

        st.markdown("</div>", unsafe_allow_html=True)
