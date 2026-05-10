import streamlit as st


_NAV_CSS = """<style>
/* Sidebar nav — Pulse style */
[data-testid="stSidebar"] { background: #faf9f6 !important; }
[data-testid="stSidebar"] [data-testid="stMarkdownContainer"] p { color: #37352f !important; }

.nav-section {
    font-size: 10px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.08em; color: #8b8e98; padding: 16px 8px 6px;
}
/* Override Streamlit sidebar buttons to look like nav links */
[data-testid="stSidebar"] [data-testid="stButton"] > button {
    background: transparent !important;
    border: none !important;
    border-radius: 8px !important;
    color: #37352f !important;
    font-size: 13px !important;
    font-weight: 500 !important;
    padding: 7px 10px !important;
    text-align: left !important;
    width: 100% !important;
    box-shadow: none !important;
    transition: background 0.15s !important;
}
[data-testid="stSidebar"] [data-testid="stButton"] > button:hover {
    background: rgba(14,15,18,0.06) !important;
}
[data-testid="stSidebar"] [data-testid="stButton"] > button p,
[data-testid="stSidebar"] [data-testid="stButton"] > button span {
    color: #37352f !important;
}
/* Active nav button */
[data-testid="stSidebar"] [data-testid="stButton"] > button[kind="primary"] {
    background: rgba(14,15,18,0.09) !important;
    color: #0e0f12 !important;
    font-weight: 600 !important;
}
[data-testid="stSidebar"] [data-testid="stButton"] > button[kind="primary"] p,
[data-testid="stSidebar"] [data-testid="stButton"] > button[kind="primary"] span {
    color: #0e0f12 !important;
}
</style>"""


def _nav_btn(label: str, page_key: str, icon: str = "") -> None:
    """Sidebar navigation button — highlights when active."""
    active = st.session_state.get("page") == page_key
    text = f"{icon}  {label}" if icon else label
    btn_type = "primary" if active else "secondary"
    if st.sidebar.button(text, key=f"nav_{page_key}", use_container_width=True, type=btn_type):
        st.session_state["page"] = page_key
        st.rerun()


def show_sidebar() -> None:
    """Sidebar — brand logo + static links (Accueil, Dashboard, Confidentialité)."""
    with st.sidebar:
        st.markdown(_NAV_CSS, unsafe_allow_html=True)
        st.markdown(
            '<div style="display:flex;align-items:center;gap:8px;padding:4px 2px 20px;">'
            '<div style="width:22px;height:22px;background:#0a0a0a;border-radius:5px;flex-shrink:0;"></div>'
            '<span style="font-size:13px;font-weight:600;color:#0a0a0a;letter-spacing:-0.3px;">Pulse</span>'
            "</div>",
            unsafe_allow_html=True,
        )


def show_main_nav(insta_accounts: list, has_meta_ads: bool) -> None:
    """Sidebar navigation for the main dashboard sections."""
    with st.sidebar:
        st.markdown('<div class="nav-section">Cette semaine</div>', unsafe_allow_html=True)
        _nav_btn("Rapport hebdo", "rapport", icon="≡")
        if insta_accounts:
            _nav_btn("Instagram", "instagram", icon="◎")
        if has_meta_ads:
            _nav_btn("Meta Ads", "meta_ads", icon="▣")

        st.markdown('<div class="nav-section">Configuration</div>', unsafe_allow_html=True)
        _nav_btn("Connecter Meta", "connect", icon="⏻")
        _nav_btn("Paramètres", "settings", icon="⚙")
