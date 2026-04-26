"""Controleur de page centralise - Boucle de controle unique.

Ce module elimine toute la duplication dans les pages en fournissant:
- Initialisation unique (cookies, session, auth)
- Verification d'authentification
- Cache des donnees utilisateur (account_id, subscription, tier)
- Sidebar unifiee
- Gestion d'erreurs centralisee

Usage:
    from components.page_controller import PageController

    # Dans chaque page:
    ctrl = PageController("Performance")
    if not ctrl.is_authenticated():
        ctrl.show_login_required()
        st.stop()

    # Acces aux donnees cachees
    account_id = ctrl.account_id
    tier = ctrl.tier
    user_email = ctrl.user_email

    # Sidebar automatique
    ctrl.render_sidebar()
"""

import streamlit as st
from dataclasses import dataclass
from typing import Optional, Callable, Any
from streamlit_cookies_manager import EncryptedCookieManager

from config.settings import COOKIE_PASSWORD, API_BASE_URL
from services.feature_flags import get_tier_from_subscription, is_premium_tier, has_feature, get_limit
from components.premium_lock import show_tier_badge, show_premium_lock, inject_premium_css
from components.theme import inject_global_theme


@dataclass
class UserContext:
    """Contexte utilisateur cache."""
    account_id: str
    email: str
    tier: str
    subscription_status: Optional[str]
    days_left: Optional[int]
    meta_connected: bool = False
    ig_connected: bool = False


class PageController:
    """Controleur centralise pour toutes les pages."""

    _instance: Optional["PageController"] = None
    _initialized: bool = False

    def __new__(cls, page_name: str = "Dashboard"):
        """Singleton pattern pour eviter re-initialisation."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, page_name: str = "Dashboard"):
        """Initialise le controleur.

        Args:
            page_name: Nom de la page actuelle
        """
        self.page_name = page_name
        self._user: Optional[UserContext] = None
        self._cookies: Optional[EncryptedCookieManager] = None
        self._api_error: Optional[str] = None

        if not PageController._initialized:
            self._init_session()
            PageController._initialized = True

    def _init_session(self):
        """Initialise cookies et session state une seule fois."""
        self._cookies = EncryptedCookieManager(
            prefix="agence_dashboard",
            password=COOKIE_PASSWORD or "default_cookie_password_32ch",
        )

        if not self._cookies.ready():
            st.stop()

        # Charger tokens depuis cookies
        if "access_token" not in st.session_state:
            st.session_state["access_token"] = self._cookies.get("access_token", "")
        if "refresh_token" not in st.session_state:
            st.session_state["refresh_token"] = self._cookies.get("refresh_token", "")
        if "account_id" not in st.session_state:
            st.session_state["account_id"] = ""

        # Cache utilisateur
        if "user_context" not in st.session_state:
            st.session_state["user_context"] = None

    # =========================================
    # API Client
    # =========================================
    def api_call(self, method: str, endpoint: str, **kwargs) -> dict:
        """Appel API centralise avec gestion d'erreurs.

        Args:
            method: GET, POST, etc.
            endpoint: /auth/me, /scores, etc.
            **kwargs: Arguments pour requests

        Returns:
            Dict avec 'data' ou 'error'
        """
        import requests

        headers = kwargs.pop("headers", {})
        if st.session_state.get("access_token"):
            headers["Authorization"] = f"Bearer {st.session_state['access_token']}"

        try:
            resp = requests.request(
                method,
                f"{API_BASE_URL}{endpoint}",
                headers=headers,
                timeout=30,
                **kwargs
            )
            if resp.headers.get("content-type", "").startswith("application/json"):
                return resp.json()
            return {"data": None, "error": {"message": f"Non-JSON: {resp.text[:100]}"}}
        except requests.exceptions.RequestException as exc:
            self._api_error = str(exc)
            return {"data": None, "error": {"message": f"Network error: {exc}"}}

    def get_data(self, result: dict, default: Any = None) -> Any:
        """Extrait data d'un resultat API de facon securisee.

        Args:
            result: Resultat de api_call()
            default: Valeur par defaut si pas de data

        Returns:
            data ou default
        """
        if result is None:
            return default
        return result.get("data", default)

    def get_error(self, result: dict) -> Optional[str]:
        """Extrait message d'erreur d'un resultat API.

        Args:
            result: Resultat de api_call()

        Returns:
            Message d'erreur ou None
        """
        if result is None:
            return "No response"
        error = result.get("error")
        if error:
            return error.get("message", "Unknown error")
        return None

    # =========================================
    # Authentication
    # =========================================
    def is_authenticated(self) -> bool:
        """Verifie si l'utilisateur est authentifie.

        Returns:
            True si authentifie et session valide
        """
        if not st.session_state.get("access_token"):
            return False

        # Utiliser cache si disponible
        if st.session_state.get("user_context"):
            self._user = st.session_state["user_context"]
            return True

        # Verifier avec API
        result = self.api_call("GET", "/auth/me")
        error = self.get_error(result)

        if error:
            if error in ("invalid_token", "missing_auth", "token_expired"):
                self.clear_tokens()
            return False

        data = self.get_data(result, {})
        account_id = data.get("account_id", "")

        if not account_id:
            return False

        # Charger subscription
        sub_result = self.api_call("GET", f"/subscriptions/status?account_id={account_id}")
        sub_data = self.get_data(sub_result, {})

        # Creer contexte utilisateur
        self._user = UserContext(
            account_id=account_id,
            email=data.get("email", ""),
            subscription_status=sub_data.get("status"),
            days_left=sub_data.get("days_left"),
            tier=get_tier_from_subscription(sub_data.get("status")),
        )

        # Charger statuts connexions
        meta_status = self.api_call("GET", f"/meta/status?account_id={account_id}")
        self._user.meta_connected = self.get_data(meta_status, {}).get("connected", False)

        ig_status = self.api_call("GET", f"/instagram/status?account_id={account_id}")
        self._user.ig_connected = self.get_data(ig_status, {}).get("connected", False)

        # Cacher
        st.session_state["user_context"] = self._user
        st.session_state["account_id"] = account_id

        return True

    def show_login_required(self):
        """Affiche message de connexion requise."""
        st.warning("Connexion requise.")
        if st.button("Retour a l'accueil", type="primary"):
            st.switch_page("app.py")

    def set_tokens(self, access_token: str, refresh_token: str = ""):
        """Stocke les tokens apres login."""
        st.session_state["access_token"] = access_token or ""
        st.session_state["refresh_token"] = refresh_token or ""
        if self._cookies:
            self._cookies["access_token"] = st.session_state["access_token"]
            self._cookies["refresh_token"] = st.session_state["refresh_token"]
            self._cookies.save()
        # Invalider cache
        st.session_state["user_context"] = None

    def clear_tokens(self):
        """Efface les tokens (logout)."""
        self.set_tokens("", "")
        st.session_state["account_id"] = ""
        st.session_state["user_context"] = None

    def logout(self):
        """Deconnexion complete."""
        self.clear_tokens()
        st.rerun()

    # =========================================
    # User Context Properties
    # =========================================
    @property
    def account_id(self) -> str:
        """Retourne l'account_id de l'utilisateur."""
        if self._user:
            return self._user.account_id
        return st.session_state.get("account_id", "")

    @property
    def user_email(self) -> str:
        """Retourne l'email de l'utilisateur."""
        return self._user.email if self._user else ""

    @property
    def tier(self) -> str:
        """Retourne le tier de l'utilisateur."""
        return self._user.tier if self._user else "free"

    @property
    def subscription_status(self) -> Optional[str]:
        """Retourne le statut d'abonnement."""
        return self._user.subscription_status if self._user else None

    @property
    def days_left(self) -> Optional[int]:
        """Retourne les jours restants (trial)."""
        return self._user.days_left if self._user else None

    @property
    def meta_connected(self) -> bool:
        """Retourne si Meta est connecte."""
        return self._user.meta_connected if self._user else False

    @property
    def ig_connected(self) -> bool:
        """Retourne si Instagram est connecte."""
        return self._user.ig_connected if self._user else False

    # =========================================
    # Feature Access
    # =========================================
    def has_feature(self, feature: str) -> bool:
        """Verifie si l'utilisateur a acces a une feature."""
        return has_feature(self.tier, feature)

    def is_premium(self) -> bool:
        """Verifie si l'utilisateur est premium."""
        return is_premium_tier(self.tier)

    def get_limit(self, feature: str) -> int:
        """Retourne la limite pour une feature."""
        return get_limit(self.tier, feature)

    def require_feature(self, feature: str) -> bool:
        """Verifie acces et affiche lock si necessaire.

        Args:
            feature: Nom de la feature

        Returns:
            True si acces, False si bloque
        """
        if self.has_feature(feature):
            return True
        show_premium_lock(feature)
        return False

    # =========================================
    # UI Components
    # =========================================
    def inject_styles(self):
        """Injecte tous les styles CSS."""
        inject_premium_css()
        inject_global_theme()

    def render_sidebar(self, current_page: Optional[str] = None):
        """Affiche la sidebar avec navigation.

        Args:
            current_page: Page actuelle (pour highlight)
        """
        current = current_page or self.page_name

        with st.sidebar:
            st.markdown(f"### {current}")
            st.caption(self.user_email)
            show_tier_badge(self.tier, self.days_left)

            st.divider()

            # Navigation
            pages = [
                ("Dashboard", "app.py", "Dashboard"),
                ("Performance", "pages/1_Performance.py", "Performance"),
                ("Insights", "pages/2_Insights.py", "Insights"),
                ("Plan", "pages/3_Plan.py", "Plan"),
                ("Reports", "pages/4_Reports.py", "Reports"),
            ]

            for label, path, name in pages:
                btn_type = "primary" if name == current else "secondary"
                if name == "Insights" and not self.is_premium():
                    col1, col2 = st.columns([4, 1])
                    with col1:
                        if st.button(label, use_container_width=True, type=btn_type):
                            st.switch_page(path)
                    with col2:
                        st.markdown('<span style="font-size:0.7rem;color:#6366f1;">PRO</span>',
                                    unsafe_allow_html=True)
                else:
                    if st.button(label, use_container_width=True, type=btn_type):
                        if path != "app.py" or current != "Dashboard":
                            st.switch_page(path)

            st.divider()

            if st.button("Settings", use_container_width=True):
                st.switch_page("pages/5_Settings.py")

            st.divider()

            if st.button("Deconnexion", use_container_width=True):
                self.logout()

    def render_subscription_banner(self):
        """Affiche banniere d'abonnement si necessaire."""
        if self.subscription_status == "trial" and self.days_left and self.days_left <= 7:
            st.markdown(f"""
            <div style="
                background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
                border-radius: 12px;
                padding: 1rem 1.5rem;
                color: white;
                margin-bottom: 1.5rem;
            ">
                Ton essai gratuit expire dans {self.days_left} jour(s)
            </div>
            """, unsafe_allow_html=True)
            col1, col2, col3 = st.columns([2, 1, 2])
            with col2:
                if st.button("Passer a Pro", type="primary", use_container_width=True):
                    st.switch_page("pages/5_Settings.py")

        elif self.subscription_status == "expired":
            st.warning("Ton abonnement a expire. Passe a Pro pour continuer.")
            if st.button("Renouveler", type="primary"):
                st.switch_page("pages/5_Settings.py")

    # =========================================
    # Data Fetching Helpers
    # =========================================
    def fetch_scores(self) -> dict:
        """Recupere les scores."""
        result = self.api_call("GET", f"/scores?account_id={self.account_id}")
        return self.get_data(result, {})

    def fetch_reports(self) -> dict:
        """Recupere les rapports."""
        result = self.api_call("GET", f"/reports?account_id={self.account_id}")
        return self.get_data(result, {})

    def fetch_instagram_score(self) -> dict:
        """Recupere le score Instagram."""
        result = self.api_call("GET", f"/instagram/score?account_id={self.account_id}")
        return self.get_data(result, {})

    def refresh_meta(self) -> tuple[bool, str]:
        """Rafraichit les donnees Meta.

        Returns:
            (success, message)
        """
        result = self.api_call("POST", f"/meta/import?account_id={self.account_id}")
        error = self.get_error(result)
        if error:
            return False, error
        return True, "Donnees Meta mises a jour"

    def refresh_instagram(self) -> tuple[bool, str]:
        """Rafraichit les donnees Instagram.

        Returns:
            (success, message)
        """
        result = self.api_call("POST", f"/instagram/import?account_id={self.account_id}")
        error = self.get_error(result)
        if error:
            return False, error
        return True, "Donnees Instagram mises a jour"

    def invalidate_cache(self):
        """Invalide le cache utilisateur (apres changement)."""
        st.session_state["user_context"] = None
        PageController._initialized = False


# =========================================
# Helper pour initialisation rapide
# =========================================
def init_page(page_name: str, require_auth: bool = True) -> PageController:
    """Initialise une page avec le controleur.

    Args:
        page_name: Nom de la page
        require_auth: Si True, verifie l'authentification

    Returns:
        Instance du PageController

    Usage:
        ctrl = init_page("Performance")
        # ctrl.account_id, ctrl.tier, etc. sont disponibles
    """
    ctrl = PageController(page_name)

    if require_auth:
        if not ctrl.is_authenticated():
            ctrl.show_login_required()
            st.stop()

    ctrl.inject_styles()
    return ctrl
