"""
APPLICATION STREAMLIT COMPLÈTE AVEC SUPABASE ET STRIPE
Permet aux utilisateurs de s'inscrire, payer et accéder au contenu premium
"""

import streamlit as st
from supabase import create_client, Client
import stripe
from datetime import datetime

# ============= CONFIGURATION =============
SUPABASE_URL = st.secrets["supabase"]["url"]
SUPABASE_KEY = st.secrets["supabase"]["key"]
stripe.api_key = st.secrets["stripe"]["api_key"]
STRIPE_PUBLISHABLE_KEY = st.secrets["stripe"]["publishable_key"]

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ============= INITIALISER SESSION STATE =============
if "session" not in st.session_state:
    st.session_state.session = None
if "user" not in st.session_state:
    st.session_state.user = None
if "payment_status" not in st.session_state:
    st.session_state.payment_status = None

# ============= FUNCTIONS PRINCIPALES =============

def activate_paid_status(user_id):
    """Marquer un utilisateur comme payé dans Supabase"""
    try:
        supabase.table("profiles").update({
            "is_paid": True,
            "paid_at": datetime.now().isoformat()
        }).eq("id", user_id).execute()
        return True
    except Exception as e:
        st.error(f"Erreur lors de la mise à jour: {str(e)}")
        return False

def check_payment_status(session_id):
    """Vérifier l'état d'un paiement Stripe"""
    try:
        session = stripe.checkout.Session.retrieve(session_id)
        return session.payment_status == "paid"
    except Exception as e:
        st.error(f"Erreur lors de la vérification: {str(e)}")
        return False

def create_checkout_session(user_id, user_email, plan_name, price_chf):
    """Créer une session de paiement Stripe avec Twint + Carte"""
    try:
        checkout_session = stripe.checkout.Session.create(
            # TWINT + Carte bancaire (Twint apparaît en priorité en Suisse)
            payment_method_types=["twint", "card"],
            line_items=[
                {
                    "price_data": {
                        # En Suisse = CHF (francs suisses)
                        "currency": "chf",
                        "product_data": {
                            "name": plan_name,
                        },
                        "unit_amount": price_chf,  # En centimes CHF
                    },
                    "quantity": 1,
                }
            ],
            customer_email=user_email,
            mode="payment",
            # IMPORTANT: Ajouter l'user_id en metadata pour identifier l'utilisateur
            metadata={
                "user_id": user_id,
                "plan": plan_name
            },
            # URLs après le paiement
            success_url="http://localhost:8501/?payment=success&session_id={CHECKOUT_SESSION_ID}",
            cancel_url="http://localhost:8501/?payment=cancel",
        )
        return checkout_session
    except Exception as e:
        st.error(f"Erreur lors de la création du paiement: {str(e)}")
        return None

def get_user_is_paid(user_id):
    """Récupérer le statut de paiement d'un utilisateur"""
    try:
        response = supabase.table("profiles").select("is_paid").eq("id", user_id).execute()
        if response.data:
            return response.data[0]["is_paid"]
        return False
    except Exception as e:
        st.error(f"Erreur: {str(e)}")
        return False

def get_paid_data(user_id):
    """Récupérer les données payantes pour un utilisateur"""
    try:
        response = supabase.table("paid_data").select("*").eq("user_id", user_id).execute()
        return response.data if response.data else []
    except Exception as e:
        st.error(f"Erreur: {str(e)}")
        return []

# ============= PAGE DE LOGIN/INSCRIPTION =============

def login_page():
    """Page pour se connecter ou s'inscrire"""
    st.set_page_config(page_title="Premium Data Access", layout="centered")
    st.title("🔐 Accès Premium")
    st.write("Inscrivez-vous ou connectez-vous pour accéder au contenu premium")
    
    col1, col2 = st.columns(2)
    
    # ===== INSCRIPTION =====
    with col1:
        st.subheader("📝 Nouvelle inscription")
        email_signup = st.text_input("Email", key="email_signup")
        password_signup = st.text_input("Mot de passe", type="password", key="pass_signup")
        
        if st.button("S'inscrire", key="btn_signup"):
            if not email_signup or not password_signup:
                st.error("❌ Email et mot de passe requis")
            else:
                try:
                    response = supabase.auth.sign_up({
                        "email": email_signup,
                        "password": password_signup
                    })
                    st.success("✅ Inscription réussie!")
                    st.info("📧 Veuillez vérifier votre email pour confirmer")
                except Exception as e:
                    st.error(f"❌ Erreur: {str(e)}")
    
    # ===== CONNEXION =====
    with col2:
        st.subheader("🔓 Connexion")
        email_login = st.text_input("Email", key="email_login")
        password_login = st.text_input("Mot de passe", type="password", key="pass_login")
        
        if st.button("Se connecter", key="btn_login"):
            if not email_login or not password_login:
                st.error("❌ Email et mot de passe requis")
            else:
                try:
                    response = supabase.auth.sign_in_with_password({
                        "email": email_login,
                        "password": password_login
                    })
                    st.session_state.session = response.session
                    st.session_state.user = response.user
                    st.rerun()
                except Exception as e:
                    st.error(f"❌ Erreur de connexion: {str(e)}")

# ============= PAGE PRINCIPALE =============

def main_page():
    """Page principale avec accès aux données payantes"""
    st.set_page_config(page_title="Dashboard Premium", layout="wide")
    
    # ===== HEADER =====
    col1, col2 = st.columns([4, 1])
    with col1:
        st.title("📊 Tableau de Bord Premium")
    with col2:
        if st.button("🚪 Déconnexion"):
            st.session_state.session = None
            st.session_state.user = None
            st.rerun()
    
    # ===== INFO UTILISATEUR =====
    st.markdown(st.session_state)
    user_email = st.session_state.user.email
    user_id = st.session_state.user.id
    
    st.write(f"👤 **Connecté:** {user_email}")
    st.divider()
    
    # ===== VÉRIFIER LE STATUT DE PAIEMENT =====
    is_paid = get_user_is_paid(user_id)
    
    # ===== GÉRER LES PARAMÈTRES URL (après un paiement) =====
    query_params = st.query_params
    if "payment" in query_params:
        if query_params["payment"] == "success":
            session_id = query_params.get("session_id")
            if session_id and check_payment_status(session_id):
                # Le paiement a réussi, marquer l'utilisateur comme payé
                if activate_paid_status(user_id):
                    st.success("✅ Paiement confirmé! Accès activé!")
                    st.rerun()
            st.info("ℹ️ Vérification du paiement...")
        elif query_params["payment"] == "cancel":
            st.warning("⚠️ Le paiement a été annulé")
    
    # ===== AFFICHER LE CONTENU =====
    if is_paid:
        st.success("✅ Vous avez accès au contenu PREMIUM!")
        
        # ===== AFFICHER LES DONNÉES PAYANTES =====
        st.subheader("📋 Vos Données Premium")
        
        paid_data = get_paid_data(user_id)
        
        if paid_data:
            # Afficher sous forme de tableau
            st.dataframe(
                paid_data,
                use_container_width=True,
                hide_index=True
            )
        else:
            st.info("Aucune donnée disponible pour le moment")
        
        # ===== OPTIONS SUPPLÉMENTAIRES =====
        st.divider()
        st.subheader("⚙️ Options Compte")
        
        if st.button("Réinitialiser l'accès premium (TEST)"):
            supabase.table("profiles").update({
                "is_paid": False
            }).eq("id", user_id).execute()
            st.info("Accès premium réinitialisé. Rafraîchissez la page.")
    
    else:
        # ===== PAGE DE PAIEMENT =====
        st.warning("⚠️ Accès Premium Requis")
        
        st.write("""
        Débloquez l'accès premium pour voir vos données exclusives!
        """)
        
        # ===== PLANS DISPONIBLES =====
        col1, col2, col3 = st.columns(3)
        
        plans = [
            {"name": "Plan Starter", "price": 15, "features": ["Accès basique", "10 données"]},
            {"name": "Plan Pro", "price": 35, "features": ["Accès complet", "Données illimitées", "Support prioritaire"]},
            {"name": "Plan Enterprise", "price": 150, "features": ["Accès VIP", "API Access", "Support 24/7"]},
        ]
        
        with col1:
            st.write("### 🚀 Plan Starter")
            st.write("**CHF 15.00**")
            for feature in plans[0]["features"]:
                st.write(f"✓ {feature}")
            if st.button("Choisir Starter", key="btn_starter"):
                session = create_checkout_session(
                    user_id=user_id,
                    user_email=user_email,
                    plan_name="Starter Plan",
                    price_chf=1500  # CHF 15.00 en centimes
                )
                if session:
                    st.info(f"Redirection vers le paiement...")
                    st.markdown(f"[Cliquez ici pour payer]({session.url})")
        
        with col2:
            st.write("### ⭐ Plan Pro")
            st.write("**CHF 35.00**")
            for feature in plans[1]["features"]:
                st.write(f"✓ {feature}")
            if st.button("Choisir Pro", key="btn_pro"):
                session = create_checkout_session(
                    user_id=user_id,
                    user_email=user_email,
                    plan_name="Pro Plan",
                    price_chf=3500  # CHF 35.00 en centimes
                )
                if session:
                    st.info(f"Redirection vers le paiement...")
                    st.markdown(f"[Cliquez ici pour payer]({session.url})")
        
        with col3:
            st.write("### 👑 Plan Enterprise")
            st.write("**CHF 150.00**")
            for feature in plans[2]["features"]:
                st.write(f"✓ {feature}")
            if st.button("Choisir Enterprise", key="btn_enterprise"):
                session = create_checkout_session(
                    user_id=user_id,
                    user_email=user_email,
                    plan_name="Enterprise Plan",
                    price_chf=15000  # CHF 150.00 en centimes
                )
                if session:
                    st.info(f"Redirection vers le paiement...")
                    st.markdown(f"[Cliquez ici pour payer]({session.url})")

# ============= LOGIQUE PRINCIPALE =============

def main():
    """Décider quelle page afficher"""
    if st.session_state.user is None:
        login_page()
    else:
        main_page()

if __name__ == "__main__":
    main()