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
</style>
""", unsafe_allow_html=True)

_, col, _ = st.columns([1, 3, 1])
with col:
    st.markdown("# Politique de confidentialité")
    st.caption("Dernière mise à jour : avril 2026")

    st.markdown("## 1. Qui sommes-nous ?")
    st.markdown("Dashboard Analytics est une application web permettant aux créateurs de contenu de visualiser et analyser leurs performances Instagram. L'application est hébergée en Europe.")

    st.markdown("## 2. Données collectées")
    st.markdown("""
Nous collectons uniquement les données nécessaires au fonctionnement du service :

- **Adresse email** — pour la création de compte et l'authentification
- **Token d'accès Meta** — pour récupérer vos données Instagram via l'API officielle Meta Graph API
- **Métriques Instagram** — likes, commentaires, reach, saves, followers, données de posts
- **Données publicitaires Meta Ads** — campagnes, dépenses, impressions (si vous connectez un compte Ads)
""")

    st.markdown("## 3. Comment nous utilisons vos données")
    st.markdown("""
- Affichage de votre dashboard personnel
- Génération de recommandations IA hebdomadaires (plan Pro)
- Analyse agrégée et anonymisée pour produire des tendances et bonnes pratiques générales — **aucune donnée individuelle n'est jamais exposée** ; seuls des pourcentages et indicateurs agrégés sont utilisés
- Identification des pratiques qui ont le plus amélioré les performances (ex : « les comptes ayant suivi la recommandation de poster le jeudi ont vu +38% d'engagement en moyenne ») — toujours sous forme anonymisée
""")

    st.markdown("## 4. Stockage et sécurité")
    st.markdown("Vos données sont stockées dans Supabase, hébergé en Europe (Frankfurt). L'accès est protégé par authentification et des politiques de sécurité au niveau des lignes (Row Level Security). Seules vos propres données vous sont accessibles.")

    st.markdown("## 5. Partage des données")
    st.markdown("Nous ne vendons, ne louons et ne partageons pas vos données personnelles avec des tiers. Les données Meta sont accessibles uniquement via l'API officielle Meta et conformément aux conditions d'utilisation de Meta Platforms.")

    st.markdown("## 6. API Meta — permissions utilisées")
    st.markdown("""
- `instagram_basic` — accès aux informations de base du compte Instagram
- `instagram_manage_insights` — accès aux métriques de performance des posts
- `pages_show_list` — liste des Pages Facebook liées
- `ads_read` — lecture des données publicitaires (si applicable)
""")

    st.markdown("## 7. Conservation des données")
    st.markdown("Vos données sont conservées tant que votre compte est actif. Vous pouvez demander la suppression de vos données à tout moment en nous contactant.")

    st.markdown("## 8. Vos droits (RGPD)")
    st.markdown("""
- Accès à vos données personnelles
- Rectification de données inexactes
- Suppression de vos données
- Portabilité de vos données
""")

    st.markdown("## 9. Contact")
    st.markdown("Pour toute question : **contact@dashboard-analytics.ch**")

    st.markdown("---")
    if st.button("← Retour à l'accueil", use_container_width=True):
        st.switch_page("landing.py")
