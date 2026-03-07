import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
import pandas as pd
from datetime import datetime, timedelta
import random

st.set_page_config(
    page_title="Dashboard Analytics",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# CSS style Notion (noir/blanc + accent)
st.markdown("""
<style>
    /* Reset et base */
    .stApp {
        background-color: #ffffff;
    }

    /* Cacher sidebar par défaut */
    [data-testid="stSidebar"] {
        display: none;
    }

    /* Typographie Notion-like */
    h1, h2, h3 {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        color: #191919;
        font-weight: 600;
    }

    p, span, div {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        color: #37352f;
    }

    /* Hero section */
    .hero {
        text-align: center;
        padding: 80px 20px;
        max-width: 800px;
        margin: 0 auto;
    }

    .hero h1 {
        font-size: 3.5rem;
        font-weight: 700;
        margin-bottom: 24px;
        line-height: 1.1;
        color: #191919;
    }

    .hero p {
        font-size: 1.25rem;
        color: #6b6b6b;
        margin-bottom: 32px;
        line-height: 1.6;
    }

    /* Bouton accent */
    .btn-primary {
        background-color: #191919;
        color: white !important;
        padding: 14px 32px;
        border-radius: 8px;
        text-decoration: none;
        font-weight: 500;
        font-size: 1rem;
        display: inline-block;
        transition: all 0.2s;
        border: none;
    }

    .btn-primary:hover {
        background-color: #333;
        transform: translateY(-1px);
    }

    .btn-secondary {
        background-color: transparent;
        color: #191919 !important;
        padding: 14px 32px;
        border-radius: 8px;
        text-decoration: none;
        font-weight: 500;
        font-size: 1rem;
        display: inline-block;
        border: 1px solid #e0e0e0;
        margin-left: 12px;
        transition: all 0.2s;
    }

    .btn-secondary:hover {
        border-color: #191919;
    }

    /* Section titre */
    .section-title {
        text-align: center;
        margin-bottom: 48px;
    }

    .section-title h2 {
        font-size: 2rem;
        margin-bottom: 12px;
    }

    .section-title p {
        color: #6b6b6b;
        font-size: 1.1rem;
    }

    /* Feature cards */
    .feature-card {
        background: #fafafa;
        border: 1px solid #eaeaea;
        border-radius: 12px;
        padding: 32px;
        height: 100%;
        transition: all 0.2s;
    }

    .feature-card:hover {
        border-color: #191919;
        box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }

    .feature-icon {
        font-size: 2rem;
        margin-bottom: 16px;
    }

    .feature-card h3 {
        font-size: 1.25rem;
        margin-bottom: 12px;
        color: #191919;
    }

    .feature-card p {
        color: #6b6b6b;
        font-size: 0.95rem;
        line-height: 1.6;
    }

    /* Pricing cards */
    .pricing-card {
        background: #ffffff;
        border: 1px solid #eaeaea;
        border-radius: 12px;
        padding: 40px 32px;
        text-align: center;
        height: 100%;
        transition: all 0.2s;
    }

    .pricing-card:hover {
        border-color: #191919;
    }

    .pricing-card.featured {
        border: 2px solid #191919;
        position: relative;
    }

    .pricing-badge {
        background: #191919;
        color: white;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 500;
        position: absolute;
        top: -12px;
        left: 50%;
        transform: translateX(-50%);
    }

    .pricing-card h3 {
        font-size: 1.5rem;
        margin-bottom: 8px;
    }

    .pricing-price {
        font-size: 3rem;
        font-weight: 700;
        color: #191919;
        margin: 20px 0;
    }

    .pricing-price span {
        font-size: 1rem;
        font-weight: 400;
        color: #6b6b6b;
    }

    .pricing-features {
        text-align: left;
        margin: 24px 0;
    }

    .pricing-features li {
        padding: 8px 0;
        color: #37352f;
        list-style: none;
        font-size: 0.95rem;
    }

    .pricing-features li::before {
        content: "✓";
        margin-right: 12px;
        color: #191919;
        font-weight: 600;
    }

    /* Divider */
    .divider {
        height: 1px;
        background: #eaeaea;
        margin: 80px 0;
    }

    /* Footer */
    .footer {
        text-align: center;
        padding: 40px 20px;
        color: #6b6b6b;
        font-size: 0.9rem;
    }

    /* Accent color (touche de couleur subtile) */
    .accent {
        color: #0066ff;
    }

    .accent-bg {
        background: linear-gradient(135deg, #0066ff 0%, #5c9cff 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }

    /* Dashboard Preview */
    .dashboard-preview {
        background: #fafafa;
        border: 1px solid #eaeaea;
        border-radius: 16px;
        padding: 32px;
        margin: 0 auto;
        max-width: 1200px;
    }

    .dashboard-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 24px;
        padding-bottom: 16px;
        border-bottom: 1px solid #eaeaea;
    }

    .dashboard-header h3 {
        margin: 0;
        font-size: 1.25rem;
    }

    .dashboard-tabs {
        display: flex;
        gap: 8px;
    }

    .dashboard-tab {
        padding: 6px 16px;
        border-radius: 6px;
        font-size: 0.85rem;
        cursor: pointer;
        border: 1px solid #eaeaea;
        background: white;
        color: #6b6b6b;
    }

    .dashboard-tab.active {
        background: #191919;
        color: white;
        border-color: #191919;
    }

    /* KPI Cards */
    .kpi-card {
        background: white;
        border: 1px solid #eaeaea;
        border-radius: 12px;
        padding: 24px;
        transition: all 0.2s;
    }

    .kpi-card:hover {
        border-color: #191919;
        box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }

    .kpi-label {
        font-size: 0.85rem;
        color: #6b6b6b;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .kpi-value {
        font-size: 2rem;
        font-weight: 700;
        color: #191919;
        margin-bottom: 4px;
    }

    .kpi-change {
        font-size: 0.85rem;
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .kpi-change.positive {
        color: #10b981;
    }

    .kpi-change.negative {
        color: #ef4444;
    }

    /* Chart container */
    .chart-container {
        background: white;
        border: 1px solid #eaeaea;
        border-radius: 12px;
        padding: 24px;
        margin-top: 24px;
    }

    .chart-title {
        font-size: 1rem;
        font-weight: 600;
        color: #191919;
        margin-bottom: 16px;
    }

    /* Live indicator */
    .live-dot {
        width: 8px;
        height: 8px;
        background: #10b981;
        border-radius: 50%;
        display: inline-block;
        margin-right: 6px;
        animation: pulse 2s infinite;
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }

    /* Pain points section */
    .pain-point {
        display: flex;
        align-items: flex-start;
        gap: 16px;
        padding: 20px;
        background: #fafafa;
        border-radius: 12px;
        margin-bottom: 16px;
    }

    .pain-icon {
        font-size: 1.5rem;
        flex-shrink: 0;
    }

    .pain-text h4 {
        font-size: 1rem;
        margin: 0 0 4px 0;
        color: #191919;
    }

    .pain-text p {
        font-size: 0.9rem;
        color: #6b6b6b;
        margin: 0;
    }

    /* Testimonial */
    .testimonial {
        background: #fafafa;
        border: 1px solid #eaeaea;
        border-radius: 12px;
        padding: 32px;
        text-align: center;
    }

    .testimonial-quote {
        font-size: 1.1rem;
        font-style: italic;
        color: #37352f;
        margin-bottom: 20px;
        line-height: 1.6;
    }

    .testimonial-author {
        font-weight: 600;
        color: #191919;
    }

    .testimonial-role {
        font-size: 0.85rem;
        color: #6b6b6b;
    }

    /* Contact form */
    .contact-form {
        background: #fafafa;
        border: 1px solid #eaeaea;
        border-radius: 16px;
        padding: 40px;
        max-width: 600px;
        margin: 0 auto;
    }

    /* Stats banner */
    .stats-banner {
        display: flex;
        justify-content: center;
        gap: 60px;
        padding: 40px 20px;
        background: #191919;
        border-radius: 12px;
        margin: 40px 0;
    }

    .stat-item {
        text-align: center;
    }

    .stat-value {
        font-size: 2.5rem;
        font-weight: 700;
        color: white;
    }

    .stat-label {
        font-size: 0.9rem;
        color: #9ca3af;
    }
</style>
""", unsafe_allow_html=True)

# ============= HERO SECTION =============
st.markdown("""
<div class="hero">
    <h1>Arrêtez de deviner.<br><span class="accent-bg">Mesurez votre croissance.</span></h1>
    <p>
        Le dashboard que les créateurs attendaient. Visualisez vos stats Instagram,
        optimisez vos pubs Meta, et concentrez-vous sur ce qui compte : créer du contenu.
    </p>
</div>
""", unsafe_allow_html=True)

hero_c1, hero_c2, hero_c3 = st.columns([2, 1, 2])
with hero_c2:
    if st.button("Créer mon compte", type="primary", use_container_width=True):
        st.switch_page("main.py")

# Stats banner
st.markdown("""
<div class="stats-banner">
    <div class="stat-item">
        <div class="stat-value">2h</div>
        <div class="stat-label">gagnées par semaine</div>
    </div>
    <div class="stat-item">
        <div class="stat-value">+23%</div>
        <div class="stat-label">d'engagement moyen</div>
    </div>
    <div class="stat-item">
        <div class="stat-value">1 vue</div>
        <div class="stat-label">toutes vos données</div>
    </div>
</div>
""", unsafe_allow_html=True)

st.markdown('<div class="divider"></div>', unsafe_allow_html=True)

# ============= PAIN POINTS SECTION =============
st.markdown("""
<div class="section-title">
    <h2>Vous en avez marre de...</h2>
    <p>Les problèmes que chaque créateur connaît</p>
</div>
""", unsafe_allow_html=True)

pain1, pain2 = st.columns(2, gap="large")

with pain1:
    st.markdown("""
    <div class="pain-point">
        <span class="pain-icon">📱</span>
        <div class="pain-text">
            <h4>Jongler entre 10 apps différentes</h4>
            <p>Instagram Insights ici, Meta Business là, un Excel pour les collabs... Tout est dispersé.</p>
        </div>
    </div>
    <div class="pain-point">
        <span class="pain-icon">📊</span>
        <div class="pain-text">
            <h4>Ne pas savoir ce qui marche vraiment</h4>
            <p>Quel type de contenu performe ? À quelle heure poster ? Impossible à voir clairement.</p>
        </div>
    </div>
    """, unsafe_allow_html=True)

with pain2:
    st.markdown("""
    <div class="pain-point">
        <span class="pain-icon">⏰</span>
        <div class="pain-text">
            <h4>Perdre du temps sur les tableaux Excel</h4>
            <p>Copier-coller les stats chaque semaine pour "tracker" votre croissance. Épuisant.</p>
        </div>
    </div>
    <div class="pain-point">
        <span class="pain-icon">💸</span>
        <div class="pain-text">
            <h4>Payer pour des pubs sans savoir si ça marche</h4>
            <p>Vous boostez des posts sans comprendre le ROI réel de vos dépenses pub.</p>
        </div>
    </div>
    """, unsafe_allow_html=True)

st.markdown('<div class="divider"></div>', unsafe_allow_html=True)

# ============= DASHBOARD PREVIEW SECTION =============
st.markdown("""
<div class="section-title" id="demo">
    <h2>Aperçu en temps réel</h2>
    <p><span class="live-dot"></span>Dashboard interactif avec vos données</p>
</div>
""", unsafe_allow_html=True)

# Generate sample data
@st.cache_data
def generate_sample_data():
    dates = pd.date_range(end=datetime.now(), periods=30, freq='D')
    return pd.DataFrame({
        'date': dates,
        'followers': [12000 + i * 45 + random.randint(-50, 100) for i in range(30)],
        'likes': [random.randint(800, 1500) for _ in range(30)],
        'impressions': [random.randint(15000, 35000) for _ in range(30)],
        'clicks': [random.randint(200, 600) for _ in range(30)],
        'spend': [random.randint(20, 80) for _ in range(30)],
    })

data = generate_sample_data()

# Dashboard container
st.markdown('<div class="dashboard-preview">', unsafe_allow_html=True)

# Dashboard header with tabs
st.markdown("""
<div class="dashboard-header">
    <h3>📊 Vue d'ensemble</h3>
    <div class="dashboard-tabs">
        <span class="dashboard-tab active">7 jours</span>
        <span class="dashboard-tab">30 jours</span>
        <span class="dashboard-tab">90 jours</span>
    </div>
</div>
""", unsafe_allow_html=True)

# KPI Cards Row 1 - Social Media
st.markdown("**Instagram**", unsafe_allow_html=True)
kpi1, kpi2, kpi3, kpi4 = st.columns(4)

with kpi1:
    st.markdown("""
    <div class="kpi-card">
        <div class="kpi-label">👥 Followers</div>
        <div class="kpi-value">13,245</div>
        <div class="kpi-change positive">↑ 4.2% vs semaine dernière</div>
    </div>
    """, unsafe_allow_html=True)

with kpi2:
    st.markdown("""
    <div class="kpi-card">
        <div class="kpi-label">❤️ Likes (7j)</div>
        <div class="kpi-value">8,432</div>
        <div class="kpi-change positive">↑ 12.5%</div>
    </div>
    """, unsafe_allow_html=True)

with kpi3:
    st.markdown("""
    <div class="kpi-card">
        <div class="kpi-label">💬 Commentaires</div>
        <div class="kpi-value">342</div>
        <div class="kpi-change negative">↓ 2.1%</div>
    </div>
    """, unsafe_allow_html=True)

with kpi4:
    st.markdown("""
    <div class="kpi-card">
        <div class="kpi-label">📈 Engagement</div>
        <div class="kpi-value">6.8%</div>
        <div class="kpi-change positive">↑ 0.3pts</div>
    </div>
    """, unsafe_allow_html=True)

st.markdown("<br>", unsafe_allow_html=True)

# KPI Cards Row 2 - Meta Ads
st.markdown("**Meta Ads**", unsafe_allow_html=True)
kpi5, kpi6, kpi7, kpi8 = st.columns(4)

with kpi5:
    st.markdown("""
    <div class="kpi-card">
        <div class="kpi-label">👁️ Impressions</div>
        <div class="kpi-value">185K</div>
        <div class="kpi-change positive">↑ 23.1%</div>
    </div>
    """, unsafe_allow_html=True)

with kpi6:
    st.markdown("""
    <div class="kpi-card">
        <div class="kpi-label">🖱️ Clics</div>
        <div class="kpi-value">3,821</div>
        <div class="kpi-change positive">↑ 8.7%</div>
    </div>
    """, unsafe_allow_html=True)

with kpi7:
    st.markdown("""
    <div class="kpi-card">
        <div class="kpi-label">💰 CPC moyen</div>
        <div class="kpi-value">0.42 CHF</div>
        <div class="kpi-change positive">↓ 15.2%</div>
    </div>
    """, unsafe_allow_html=True)

with kpi8:
    st.markdown("""
    <div class="kpi-card">
        <div class="kpi-label">🎯 ROAS</div>
        <div class="kpi-value">3.2x</div>
        <div class="kpi-change positive">↑ 0.4x</div>
    </div>
    """, unsafe_allow_html=True)

st.markdown("<br>", unsafe_allow_html=True)

# Charts
chart1, chart2 = st.columns(2)

with chart1:
    st.markdown('<div class="chart-title">📈 Évolution des followers</div>', unsafe_allow_html=True)
    fig1 = go.Figure()
    fig1.add_trace(go.Scatter(
        x=data['date'],
        y=data['followers'],
        mode='lines',
        fill='tozeroy',
        line=dict(color='#191919', width=2),
        fillcolor='rgba(25, 25, 25, 0.1)'
    ))
    fig1.update_layout(
        margin=dict(l=0, r=0, t=10, b=0),
        height=250,
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        xaxis=dict(showgrid=False, showline=False),
        yaxis=dict(showgrid=True, gridcolor='#eaeaea', showline=False),
        font=dict(family="Inter, sans-serif", color="#6b6b6b")
    )
    st.plotly_chart(fig1, use_container_width=True, config={'displayModeBar': False})

with chart2:
    st.markdown('<div class="chart-title">💰 Dépenses publicitaires vs Clics</div>', unsafe_allow_html=True)
    fig2 = go.Figure()
    fig2.add_trace(go.Bar(
        x=data['date'][-14:],
        y=data['spend'][-14:],
        name='Dépenses (CHF)',
        marker_color='#191919'
    ))
    fig2.add_trace(go.Scatter(
        x=data['date'][-14:],
        y=data['clicks'][-14:],
        name='Clics',
        mode='lines+markers',
        line=dict(color='#0066ff', width=2),
        yaxis='y2'
    ))
    fig2.update_layout(
        margin=dict(l=0, r=0, t=10, b=0),
        height=250,
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        xaxis=dict(showgrid=False, showline=False),
        yaxis=dict(showgrid=True, gridcolor='#eaeaea', showline=False, title=''),
        yaxis2=dict(showgrid=False, showline=False, overlaying='y', side='right', title=''),
        font=dict(family="Inter, sans-serif", color="#6b6b6b"),
        legend=dict(orientation='h', yanchor='bottom', y=1.02, xanchor='right', x=1),
        barmode='group'
    )
    st.plotly_chart(fig2, use_container_width=True, config={'displayModeBar': False})

st.markdown("<br>", unsafe_allow_html=True)

# Top Posts Section
st.markdown('<div class="chart-title">🏆 Vos Top Posts du mois</div>', unsafe_allow_html=True)

top_posts_data = pd.DataFrame({
    'Rang': ['🥇', '🥈', '🥉', '4', '5'],
    'Contenu': [
        '"Mon setup créateur 2025..."',
        '"3 erreurs qui tuent ton engagement"',
        '"Behind the scenes de ma dernière collab"',
        '"Pourquoi j\'ai quitté mon job"',
        '"Tutorial Reels en 60 secondes"'
    ],
    'Type': ['Reel', 'Carrousel', 'Reel', 'Reel', 'Carrousel'],
    'Likes': ['1,245', '987', '854', '723', '698'],
    'Commentaires': ['89', '124', '45', '67', '52'],
    'Engagement': ['8.2%', '7.1%', '6.8%', '5.9%', '5.7%'],
    'Heure': ['19h', '12h', '20h', '18h', '12h']
})

st.dataframe(
    top_posts_data,
    use_container_width=True,
    hide_index=True,
    column_config={
        "Rang": st.column_config.TextColumn("", width="small"),
        "Contenu": st.column_config.TextColumn("Contenu", width="large"),
        "Type": st.column_config.TextColumn("Type", width="small"),
        "Likes": st.column_config.TextColumn("❤️", width="small"),
        "Commentaires": st.column_config.TextColumn("💬", width="small"),
        "Engagement": st.column_config.TextColumn("📈", width="small"),
        "Heure": st.column_config.TextColumn("🕐", width="small"),
    }
)

st.markdown("""
<p style="text-align: center; color: #6b6b6b; font-size: 0.9rem; margin-top: 16px;">
    💡 <strong>Insight :</strong> Vos Reels postés entre 18h-20h génèrent 40% plus d'engagement
</p>
""", unsafe_allow_html=True)

st.markdown('</div>', unsafe_allow_html=True)

st.markdown('<div class="divider"></div>', unsafe_allow_html=True)

# ============= METHODOLOGY SECTION =============
st.markdown("""
<div class="section-title">
    <h2>Comment améliorer votre contenu</h2>
    <p>Une méthode simple en 4 étapes basée sur vos données</p>
</div>
""", unsafe_allow_html=True)

# Steps
step1, step2, step3, step4 = st.columns(4, gap="medium")

with step1:
    st.markdown("""
    <div class="feature-card" style="text-align: center;">
        <div style="font-size: 2.5rem; margin-bottom: 12px;">1</div>
        <h3>Analyser</h3>
        <p>Identifiez vos 10 meilleurs posts du mois. Lesquels ont le plus d'engagement ?</p>
    </div>
    """, unsafe_allow_html=True)

with step2:
    st.markdown("""
    <div class="feature-card" style="text-align: center;">
        <div style="font-size: 2.5rem; margin-bottom: 12px;">2</div>
        <h3>Comprendre</h3>
        <p>Qu'ont-ils en commun ? Format, heure de publication, sujet, style de légende ?</p>
    </div>
    """, unsafe_allow_html=True)

with step3:
    st.markdown("""
    <div class="feature-card" style="text-align: center;">
        <div style="font-size: 2.5rem; margin-bottom: 12px;">3</div>
        <h3>Répliquer</h3>
        <p>Créez plus de ce qui fonctionne. Arrêtez ce qui ne génère pas d'engagement.</p>
    </div>
    """, unsafe_allow_html=True)

with step4:
    st.markdown("""
    <div class="feature-card" style="text-align: center;">
        <div style="font-size: 2.5rem; margin-bottom: 12px;">4</div>
        <h3>Mesurer</h3>
        <p>Suivez l'évolution semaine après semaine. Ajustez votre stratégie.</p>
    </div>
    """, unsafe_allow_html=True)

st.markdown('<div class="divider"></div>', unsafe_allow_html=True)

# ============= PRICING SECTION =============
st.markdown("""
<div class="section-title" id="pricing">
    <h2>Investissez dans votre croissance</h2>
    <p>Moins cher qu'un café par jour pour des heures gagnées</p>
</div>
""", unsafe_allow_html=True)

col1, col2, col3 = st.columns(3, gap="large")

with col1:
    st.markdown("""
    <div class="pricing-card">
        <h3>Starter</h3>
        <p style="color: #6b6b6b;">Pour tester</p>
        <div class="pricing-price">15<span> CHF/mois</span></div>
        <ul class="pricing-features">
            <li>1 compte Instagram</li>
            <li>Stats des 30 derniers jours</li>
            <li>Graphiques de base</li>
            <li>Support email</li>
        </ul>
    </div>
    """, unsafe_allow_html=True)
    if st.button("Choisir Starter", key="starter", use_container_width=True):
        st.switch_page("main.py") if hasattr(st, 'switch_page') else st.info("Redirection vers l'app...")

with col2:
    st.markdown("""
    <div class="pricing-card featured">
        <div class="pricing-badge">POUR CRÉATEURS</div>
        <h3>Pro</h3>
        <p style="color: #6b6b6b;">Le plus populaire</p>
        <div class="pricing-price">35<span> CHF/mois</span></div>
        <ul class="pricing-features">
            <li>1 compte Instagram</li>
            <li>Historique illimité</li>
            <li>Connexion Meta Ads</li>
            <li>Analyse par post</li>
            <li>Export PDF</li>
        </ul>
    </div>
    """, unsafe_allow_html=True)
    if st.button("Choisir Pro", key="pro", use_container_width=True, type="primary"):
        st.switch_page("main.py") if hasattr(st, 'switch_page') else st.info("Redirection vers l'app...")

with col3:
    st.markdown("""
    <div class="pricing-card">
        <h3>Agency</h3>
        <p style="color: #6b6b6b;">Multi-comptes</p>
        <div class="pricing-price">150<span> CHF/mois</span></div>
        <ul class="pricing-features">
            <li>Jusqu'à 10 comptes</li>
            <li>Tout le plan Pro</li>
            <li>Rapports clients</li>
            <li>API Access</li>
            <li>Support prioritaire</li>
        </ul>
    </div>
    """, unsafe_allow_html=True)
    if st.button("Choisir Agency", key="agency", use_container_width=True):
        st.switch_page("main.py") if hasattr(st, 'switch_page') else st.info("Redirection vers l'app...")

st.markdown('<div class="divider"></div>', unsafe_allow_html=True)

# ============= CTA SECTION =============
st.markdown("""
<div class="section-title">
    <h2>Prêt à voir vos vraies stats ?</h2>
    <p>Créez votre compte gratuitement et connectez Instagram en 2 minutes.</p>
</div>
""", unsafe_allow_html=True)

cta_c1, cta_c2, cta_c3, cta_c4, cta_c5 = st.columns([2, 1, 0.2, 1, 2])
with cta_c2:
    if st.button("Créer mon compte", type="primary", use_container_width=True, key="cta_signup"):
        st.switch_page("main.py")
with cta_c4:
    if st.button("Se connecter", use_container_width=True, key="cta_login"):
        st.switch_page("main.py")

st.markdown('<div class="divider"></div>', unsafe_allow_html=True)

# ============= FOOTER =============
st.markdown("""
<div class="footer">
    <p>© 2025 Dashboard Analytics • Fait avec ❤️ en Suisse</p>
</div>
""", unsafe_allow_html=True)
