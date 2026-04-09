import streamlit as st

st.set_page_config(
    page_title="Politique de confidentialité — Dashboard Analytics",
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
    .content { max-width: 720px; margin: 0 auto; padding: 60px 20px; }
    h1 { font-size: 2rem; font-weight: 700; color: #191919; margin-bottom: 8px; }
    h2 { font-size: 1.1rem; font-weight: 600; color: #191919; margin-top: 36px; margin-bottom: 10px; }
    p, li { font-size: 0.95rem; color: #37352f; line-height: 1.7; }
    .subtitle { color: #6b6b6b; font-size: 0.9rem; margin-bottom: 40px; }
    a { color: #0066ff; }
</style>
""", unsafe_allow_html=True)

st.markdown("""
<div class="content">
    <h1>Politique de confidentialité</h1>
    <div class="subtitle">Dernière mise à jour : avril 2026</div>

    <h2>1. Qui sommes-nous ?</h2>
    <p>Dashboard Analytics est une application web permettant aux créateurs de contenu de visualiser et analyser leurs performances Instagram. L'application est hébergée en Europe.</p>

    <h2>2. Données collectées</h2>
    <p>Nous collectons uniquement les données nécessaires au fonctionnement du service :</p>
    <ul>
        <li><strong>Adresse email</strong> — pour la création de compte et l'authentification</li>
        <li><strong>Token d'accès Meta</strong> — pour récupérer vos données Instagram via l'API officielle Meta Graph API</li>
        <li><strong>Métriques Instagram</strong> — likes, commentaires, reach, saves, followers, données de posts (via API Meta)</li>
        <li><strong>Données publicitaires Meta Ads</strong> — campagnes, dépenses, impressions (si vous connectez un compte Ads)</li>
    </ul>

    <h2>3. Comment nous utilisons vos données</h2>
    <ul>
        <li>Affichage de votre dashboard personnel</li>
        <li>Génération de recommandations IA hebdomadaires (plan Pro)</li>
        <li>Analyse agrégée et anonymisée pour produire des insights généraux (jamais partagées individuellement)</li>
    </ul>

    <h2>4. Stockage et sécurité</h2>
    <p>Vos données sont stockées dans Supabase, hébergé en Europe (Frankfurt). L'accès est protégé par authentification et des politiques de sécurité au niveau des lignes (Row Level Security). Seules vos propres données vous sont accessibles.</p>

    <h2>5. Partage des données</h2>
    <p>Nous ne vendons, ne louons et ne partageons pas vos données personnelles avec des tiers. Les données Meta sont accessibles uniquement via l'API officielle Meta et conformément aux conditions d'utilisation de Meta Platforms.</p>

    <h2>6. API Meta — permissions utilisées</h2>
    <p>Notre application demande les permissions Meta suivantes :</p>
    <ul>
        <li><code>instagram_basic</code> — accès aux informations de base du compte Instagram</li>
        <li><code>instagram_manage_insights</code> — accès aux métriques de performance des posts</li>
        <li><code>pages_show_list</code> — liste des Pages Facebook liées</li>
        <li><code>ads_read</code> — lecture des données publicitaires (si applicable)</li>
    </ul>

    <h2>7. Conservation des données</h2>
    <p>Vos données sont conservées tant que votre compte est actif. Vous pouvez demander la suppression de vos données à tout moment en nous contactant.</p>

    <h2>8. Vos droits</h2>
    <p>Conformément au RGPD, vous disposez des droits suivants :</p>
    <ul>
        <li>Accès à vos données personnelles</li>
        <li>Rectification de données inexactes</li>
        <li>Suppression de vos données</li>
        <li>Portabilité de vos données</li>
    </ul>

    <h2>9. Contact</h2>
    <p>Pour toute question relative à la confidentialité de vos données, contactez-nous à : <a href="mailto:contact@dashboard-analytics.ch">contact@dashboard-analytics.ch</a></p>
</div>
""", unsafe_allow_html=True)

_, back_col, _ = st.columns([3, 2, 3])
with back_col:
    if st.button("← Retour à l'accueil", use_container_width=True):
        st.switch_page("landing.py")
