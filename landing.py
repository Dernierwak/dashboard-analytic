import streamlit as st
import plotly.express as px
import pandas as pd

st.set_page_config(
    page_title="Dashboard Analytics Instagram",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="collapsed"
)

st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    .stApp { background-color: #ffffff; }

    [data-testid="stSidebar"] { display: none; }

    * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }

    /* ── KPI Cards (identiques au dashboard) ── */
    .kpi-card {
        background: #ffffff;
        border: 1px solid #eaeaea;
        border-radius: 12px;
        padding: 20px 24px;
    }
    .kpi-label {
        font-size: 0.8rem;
        color: #6b6b6b;
        margin-bottom: 6px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }
    .kpi-value {
        font-size: 1.8rem;
        font-weight: 700;
        color: #191919;
        line-height: 1.1;
    }
    .kpi-delta {
        font-size: 0.8rem;
        margin-top: 4px;
        font-weight: 500;
    }
    .kpi-delta.positive { color: #10b981; }
    .kpi-delta.negative { color: #ef4444; }

    /* ── Section title ── */
    .section-title {
        font-size: 1rem;
        font-weight: 600;
        color: #191919;
        margin-bottom: 16px;
        padding-bottom: 8px;
        border-bottom: 1px solid #eaeaea;
    }

    /* ── Hero ── */
    .hero {
        text-align: center;
        padding: 72px 20px 48px;
        max-width: 760px;
        margin: 0 auto;
    }
    .hero h1 {
        font-size: 3rem;
        font-weight: 700;
        color: #191919;
        line-height: 1.15;
        margin-bottom: 20px;
    }
    .hero p {
        font-size: 1.15rem;
        color: #6b6b6b;
        line-height: 1.65;
        margin-bottom: 32px;
    }
    .hero-badge {
        display: inline-block;
        background: #f0f6ff;
        color: #0066ff;
        border: 1px solid #cce0ff;
        border-radius: 20px;
        padding: 5px 14px;
        font-size: 0.85rem;
        font-weight: 500;
        margin-bottom: 28px;
    }
    .accent { color: #0066ff; }

    /* ── Dashboard preview container ── */
    .preview-wrap {
        background: #fafafa;
        border: 1px solid #eaeaea;
        border-radius: 16px;
        padding: 28px 28px 20px;
    }
    .preview-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
    }
    .preview-title {
        font-size: 1rem;
        font-weight: 600;
        color: #191919;
    }
    .preview-badge {
        background: #e8f4fd;
        color: #0066ff;
        border-radius: 6px;
        padding: 3px 10px;
        font-size: 0.75rem;
        font-weight: 500;
    }

    /* ── USP cards ── */
    .usp-card {
        background: #fafafa;
        border: 1px solid #eaeaea;
        border-radius: 12px;
        padding: 28px 24px;
        height: 100%;
    }
    .usp-icon { font-size: 1.8rem; margin-bottom: 14px; }
    .usp-card h3 {
        font-size: 1rem;
        font-weight: 600;
        color: #191919;
        margin-bottom: 8px;
    }
    .usp-card p {
        font-size: 0.9rem;
        color: #6b6b6b;
        line-height: 1.55;
        margin: 0;
    }

    /* ── Steps ── */
    .step-card {
        text-align: center;
        padding: 24px 20px;
    }
    .step-num {
        width: 40px;
        height: 40px;
        background: #191919;
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 1rem;
        margin: 0 auto 16px;
    }
    .step-card h3 {
        font-size: 1rem;
        font-weight: 600;
        color: #191919;
        margin-bottom: 8px;
    }
    .step-card p {
        font-size: 0.88rem;
        color: #6b6b6b;
        line-height: 1.55;
        margin: 0;
    }

    /* ── Pricing ── */
    .pricing-card {
        background: #ffffff;
        border: 1px solid #eaeaea;
        border-radius: 16px;
        padding: 36px 28px;
        text-align: center;
        position: relative;
    }
    .pricing-card.featured {
        border: 2px solid #191919;
    }
    .pricing-badge-top {
        background: #191919;
        color: white;
        padding: 4px 14px;
        border-radius: 20px;
        font-size: 0.72rem;
        font-weight: 600;
        position: absolute;
        top: -13px;
        left: 50%;
        transform: translateX(-50%);
        white-space: nowrap;
        letter-spacing: 0.06em;
    }
    .pricing-plan { font-size: 1.25rem; font-weight: 600; color: #191919; }
    .pricing-desc { font-size: 0.85rem; color: #6b6b6b; margin: 4px 0 20px; }
    .pricing-price {
        font-size: 2.8rem;
        font-weight: 700;
        color: #191919;
        margin-bottom: 4px;
    }
    .pricing-price span { font-size: 1rem; font-weight: 400; color: #6b6b6b; }
    .pricing-features {
        text-align: left;
        list-style: none;
        padding: 0;
        margin: 24px 0 28px;
    }
    .pricing-features li {
        padding: 7px 0;
        font-size: 0.9rem;
        color: #37352f;
        border-bottom: 1px solid #f3f3f3;
    }
    .pricing-features li::before { content: "✓ "; color: #191919; font-weight: 600; }
    .pricing-features li.locked { color: #b0b0b0; }
    .pricing-features li.locked::before { content: "— "; color: #d0d0d0; }

    /* ── Divider ── */
    .divider { height: 1px; background: #eaeaea; margin: 64px 0; }

    /* ── CTA final ── */
    .cta-wrap {
        text-align: center;
        padding: 48px 20px;
        background: #191919;
        border-radius: 16px;
        margin: 0 auto;
    }
    .cta-wrap h2 { font-size: 1.8rem; font-weight: 700; color: #ffffff; margin-bottom: 12px; }
    .cta-wrap p { font-size: 1rem; color: #9ca3af; margin-bottom: 28px; }

    /* ── Footer ── */
    .footer { text-align: center; padding: 36px 20px; color: #9ca3af; font-size: 0.85rem; }

    /* ── Streamlit buttons ── */
    [data-testid="stButton"] > button {
        background: #0066ff !important;
        color: #ffffff !important;
        border: none !important;
        border-radius: 8px !important;
        font-weight: 500 !important;
        padding: 10px 24px !important;
        font-family: 'Inter', sans-serif !important;
        font-size: 0.95rem !important;
    }
    [data-testid="stButton"] > button:hover {
        background: #0052cc !important;
    }

    /* ── AI reco blurred ── */
    .ai-blur-wrap { position: relative; margin-top: 16px; }
    .ai-content-blur {
        filter: blur(4px);
        pointer-events: none;
        background: #f8faff;
        border-left: 3px solid #0066ff;
        border-radius: 8px;
        padding: 16px 20px;
        font-size: 0.9rem;
        color: #37352f;
        line-height: 1.7;
    }
    .ai-lock-badge {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border: 1px solid #eaeaea;
        border-radius: 8px;
        padding: 8px 18px;
        font-size: 0.85rem;
        font-weight: 500;
        white-space: nowrap;
        box-shadow: 0 2px 12px rgba(0,0,0,0.08);
        color: #191919;
    }

    /* ── Top post card mock ── */
    .post-card-mock {
        border: 1px solid #eaeaea;
        border-radius: 10px;
        overflow: hidden;
        background: white;
    }
    .post-thumb {
        height: 120px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2rem;
        background: #f0f4ff;
    }
    .post-meta {
        padding: 10px 12px;
    }
    .post-metric {
        font-size: 1.2rem;
        font-weight: 700;
        color: #191919;
    }
    .post-type-tag {
        font-size: 0.75rem;
        color: #6b6b6b;
        margin-top: 2px;
    }
</style>
""", unsafe_allow_html=True)


# ═══════════════════════════════════════════
# HERO
# ═══════════════════════════════════════════
st.markdown("""
<div class="hero">
    <div class="hero-badge">🇨🇭 IA suisse — Données hébergées en Europe</div>
    <h1>Comprends ce qui marche<br><span class="accent">vraiment</span> sur ton Instagram</h1>
    <p>Dashboard analytics automatique + recommandations IA hebdomadaires.<br>Connecte ton compte une fois. On s'occupe du reste.</p>
</div>
""", unsafe_allow_html=True)

_, hero_col, _ = st.columns([3, 2, 3])
with hero_col:
    if st.button("Essayer gratuitement →", key="hero_cta", use_container_width=True):
        st.switch_page("pages/main.py")

st.markdown("<br>", unsafe_allow_html=True)
st.markdown('<div class="divider"></div>', unsafe_allow_html=True)


# ═══════════════════════════════════════════
# MOCK DASHBOARD PREVIEW
# ═══════════════════════════════════════════
st.markdown("""
<div style="text-align:center; margin-bottom:32px;">
    <div style="font-size:1.75rem; font-weight:700; color:#191919; margin-bottom:10px;">Ton dashboard, en un coup d'œil</div>
    <div style="color:#6b6b6b; font-size:1rem;">Toutes tes métriques Instagram au même endroit, automatiquement mises à jour</div>
</div>
""", unsafe_allow_html=True)

st.markdown('<div class="preview-wrap">', unsafe_allow_html=True)
st.markdown("""
<div class="preview-header">
    <div class="preview-title">📊 Vue d'ensemble — Instagram</div>
    <div class="preview-badge">Données de démo</div>
</div>
""", unsafe_allow_html=True)

# KPI row
k1, k2, k3, k4 = st.columns(4)
with k1:
    st.markdown("""<div class="kpi-card">
        <div class="kpi-label">Followers</div>
        <div class="kpi-value">12,430</div>
        <div class="kpi-delta positive">+245 ce mois</div>
    </div>""", unsafe_allow_html=True)
with k2:
    st.markdown("""<div class="kpi-card">
        <div class="kpi-label">Reach total</div>
        <div class="kpi-value">48,200</div>
        <div class="kpi-delta positive">+18% vs mois dernier</div>
    </div>""", unsafe_allow_html=True)
with k3:
    st.markdown("""<div class="kpi-card">
        <div class="kpi-label">Likes</div>
        <div class="kpi-value">3,841</div>
        <div class="kpi-delta positive">+9%</div>
    </div>""", unsafe_allow_html=True)
with k4:
    st.markdown("""<div class="kpi-card">
        <div class="kpi-label">Sauvegardés</div>
        <div class="kpi-value">612</div>
        <div class="kpi-delta positive">+31%</div>
    </div>""", unsafe_allow_html=True)

st.markdown("<br>", unsafe_allow_html=True)

# Bar chart mock
st.markdown('<div class="section-title">Évolution par post</div>', unsafe_allow_html=True)

mock_posts = pd.DataFrame({
    "date": ["Jan 5", "Jan 9", "Jan 12", "Jan 16", "Jan 19", "Jan 23", "Jan 27", "Jan 30"],
    "reach": [3200, 5800, 2900, 7400, 4100, 9200, 3600, 6800],
    "type": ["IMAGE", "VIDEO", "CAROUSEL_ALBUM", "VIDEO", "IMAGE", "VIDEO", "CAROUSEL_ALBUM", "VIDEO"],
})

COLOR_MAP = {"IMAGE": "#191919", "VIDEO": "#0066ff", "CAROUSEL_ALBUM": "#173f91"}

fig = px.bar(
    mock_posts,
    x="date", y="reach", color="type",
    color_discrete_map=COLOR_MAP,
    labels={"date": "Date", "reach": "Reach", "type": "Type"},
)
fig.update_layout(
    template="plotly_white",
    height=260, margin=dict(l=0, r=0, t=10, b=0),
    paper_bgcolor="#ffffff", plot_bgcolor="#ffffff",
    font=dict(color="#37352f", family="Inter, sans-serif"),
    legend=dict(orientation="h", y=1.1, font=dict(color="#37352f")),
    xaxis=dict(showgrid=False, color="#6b6b6b", linecolor="#eaeaea"),
    yaxis=dict(showgrid=True, gridcolor="#f0f0f0", color="#6b6b6b"),
)
st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})

# AI reco blurred
st.markdown('<div class="section-title">Recommandations IA</div>', unsafe_allow_html=True)
st.markdown("""
<div class="ai-blur-wrap">
    <div class="ai-content-blur">
        • Publie 2 Reels cette semaine — ils génèrent 3x plus de reach que tes images<br>
        • Tes posts du jeudi performent 40% mieux — teste ce créneau<br>
        • Ajoute un CTA "Sauvegarde pour plus tard" pour booster tes saves
    </div>
    <div class="ai-lock-badge">🔒 Recommandations IA — Plan Pro</div>
</div>
""", unsafe_allow_html=True)

st.markdown("<br>", unsafe_allow_html=True)

# Top 3 posts mock
st.markdown('<div class="section-title">Top 3 — Reach</div>', unsafe_allow_html=True)
p1, p2, p3 = st.columns(3)
top_posts = [
    ("🎬", "9,200", "VIDEO · Jan 23", "\"Mon setup créateur 2025...\""),
    ("📸", "7,400", "VIDEO · Jan 16", "\"3 erreurs qui tuent ton reach\""),
    ("🖼️", "6,800", "VIDEO · Jan 30", "\"Behind the scenes collab\""),
]
for col, (icon, metric, tag, caption) in zip([p1, p2, p3], top_posts):
    with col:
        st.markdown(f"""
        <div class="post-card-mock">
            <div class="post-thumb">{icon}</div>
            <div class="post-meta">
                <div class="post-metric">{metric}</div>
                <div class="post-type-tag">{tag}</div>
                <div style="font-size:0.78rem;color:#9ca3af;margin-top:4px">{caption}</div>
            </div>
        </div>
        """, unsafe_allow_html=True)

st.markdown('</div>', unsafe_allow_html=True)  # close preview-wrap

st.markdown('<div class="divider"></div>', unsafe_allow_html=True)


# ═══════════════════════════════════════════
# USP CARDS
# ═══════════════════════════════════════════
st.markdown("""
<div style="text-align:center; margin-bottom:36px;">
    <div style="font-size:1.75rem; font-weight:700; color:#191919; margin-bottom:10px;">Pourquoi choisir ce dashboard ?</div>
</div>
""", unsafe_allow_html=True)

u1, u2, u3, u4 = st.columns(4)
usps = [
    ("📊", "Métriques claires", "Likes, reach, saves, followers — tout au même endroit. Plus besoin de chercher dans Instagram Insights."),
    ("🇨🇭", "IA suisse — Apertus", "Recommandations générées par Apertus, le modèle suisse. Tes données restent en Europe, jamais partagées."),
    ("🔄", "100% automatique", "Choisit ton jour de récupération. Les données arrivent sans rien faire de plus."),
    ("📅", "Historique complet", "On stocke tes métriques depuis le 1er jour. Même en gratuit. Accès immédiat à l'upgrade."),
]
for col, (icon, title, desc) in zip([u1, u2, u3, u4], usps):
    with col:
        st.markdown(f"""
        <div class="usp-card">
            <div class="usp-icon">{icon}</div>
            <h3>{title}</h3>
            <p>{desc}</p>
        </div>
        """, unsafe_allow_html=True)

st.markdown('<div class="divider"></div>', unsafe_allow_html=True)


# ═══════════════════════════════════════════
# HOW IT WORKS
# ═══════════════════════════════════════════
st.markdown("""
<div style="text-align:center; margin-bottom:36px;">
    <div style="font-size:1.75rem; font-weight:700; color:#191919; margin-bottom:10px;">Comment ça marche ?</div>
    <div style="color:#6b6b6b; font-size:1rem;">3 étapes, une seule fois</div>
</div>
""", unsafe_allow_html=True)

s1, s2, s3 = st.columns(3)
steps = [
    ("1", "Crée ton compte", "Inscription gratuite en 30 secondes. Pas de carte bancaire requise."),
    ("2", "Connecte Instagram", "Autorise l'accès via Meta en quelques clics. Tes données arrivent automatiquement."),
    ("3", "Reçois tes insights", "Dashboard mis à jour chaque semaine. Recommandations IA le jour que tu choisis."),
]
for col, (num, title, desc) in zip([s1, s2, s3], steps):
    with col:
        st.markdown(f"""
        <div class="step-card">
            <div class="step-num">{num}</div>
            <h3>{title}</h3>
            <p>{desc}</p>
        </div>
        """, unsafe_allow_html=True)

st.markdown('<div class="divider"></div>', unsafe_allow_html=True)


# ═══════════════════════════════════════════
# PRICING
# ═══════════════════════════════════════════
st.markdown("""
<div style="text-align:center; margin-bottom:36px;">
    <div style="font-size:1.75rem; font-weight:700; color:#191919; margin-bottom:10px;">Tarifs simples</div>
    <div style="color:#6b6b6b; font-size:1rem;">Commence gratuitement. Upgrade quand tu veux.</div>
</div>
""", unsafe_allow_html=True)

_, pr1, gap, pr2, _ = st.columns([1, 3, 0.5, 3, 1])

with pr1:
    st.markdown("""
    <div class="pricing-card">
        <div class="pricing-plan">Gratuit</div>
        <div class="pricing-desc">Pour commencer</div>
        <div class="pricing-price">0<span> CHF</span></div>
        <ul class="pricing-features">
            <li>10 derniers posts Instagram</li>
            <li>Dashboard métriques de base</li>
            <li>Historique stocké dès le 1er jour</li>
            <li class="locked">Recommandations IA hebdo</li>
            <li class="locked">Rapport automatique</li>
            <li class="locked">Posts illimités</li>
        </ul>
    </div>
    """, unsafe_allow_html=True)
    if st.button("Créer mon compte gratuit", key="free_cta", use_container_width=True):
        st.switch_page("pages/main.py")

with pr2:
    st.markdown("""
    <div class="pricing-card featured">
        <div class="pricing-badge-top">RECOMMANDÉ</div>
        <div class="pricing-plan">Pro</div>
        <div class="pricing-desc">Pour les créateurs sérieux</div>
        <div class="pricing-price">35<span> CHF/mois</span></div>
        <ul class="pricing-features">
            <li>Posts illimités</li>
            <li>Dashboard complet</li>
            <li>Historique depuis le 1er jour</li>
            <li>Recommandations IA hebdomadaires</li>
            <li>Rapport automatique — jour au choix</li>
            <li>IA suisse Apertus 🇨🇭</li>
        </ul>
    </div>
    """, unsafe_allow_html=True)
    if st.button("Commencer avec Pro", key="pro_cta", use_container_width=True):
        st.switch_page("pages/main.py")

st.markdown('<div class="divider"></div>', unsafe_allow_html=True)


# ═══════════════════════════════════════════
# CTA FINAL
# ═══════════════════════════════════════════
st.markdown("""
<div class="cta-wrap">
    <h2>Prêt à voir ce qui marche vraiment ?</h2>
    <p>Gratuit. Pas de carte bancaire. Connecté en 2 minutes.</p>
</div>
""", unsafe_allow_html=True)

st.markdown("<br>", unsafe_allow_html=True)
_, cta_col, _ = st.columns([3, 2, 3])
with cta_col:
    if st.button("Connecter mon Instagram →", key="final_cta", use_container_width=True):
        st.switch_page("pages/main.py")

st.markdown('<div class="divider"></div>', unsafe_allow_html=True)


# ═══════════════════════════════════════════
# FOOTER
# ═══════════════════════════════════════════
st.markdown("""
<div class="footer">
    <p>© 2026 Dashboard Analytics · Fait avec ❤️ en Suisse · <a href="/privacy" style="color:#9ca3af">Confidentialité</a></p>
</div>
""", unsafe_allow_html=True)
