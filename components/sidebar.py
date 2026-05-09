import streamlit as st


def show_sidebar():
    """Sidebar gauche — navigation uniquement."""
    with st.sidebar:
        st.markdown(
            '<div style="display:flex;align-items:center;gap:8px;padding:4px 2px 24px;">'
            '<div style="width:22px;height:22px;background:#0a0a0a;border-radius:5px;flex-shrink:0;"></div>'
            '<span style="font-size:13px;font-weight:600;color:#0a0a0a;letter-spacing:-0.3px;">Analytics</span>'
            "</div>",
            unsafe_allow_html=True,
        )

        st.markdown("""
<nav style="display:flex;flex-direction:column;gap:4px;">
  <a href="/" target="_self" style="font-size:13px;color:#37352f;text-decoration:none;padding:6px 8px;border-radius:6px;display:block;" onmouseover="this.style.background='#f0f0ef'" onmouseout="this.style.background='transparent'">Accueil</a>
  <a href="/main" target="_self" style="font-size:13px;color:#37352f;text-decoration:none;padding:6px 8px;border-radius:6px;display:block;" onmouseover="this.style.background='#f0f0ef'" onmouseout="this.style.background='transparent'">Dashboard</a>
  <a href="/privacy" target="_self" style="font-size:13px;color:#37352f;text-decoration:none;padding:6px 8px;border-radius:6px;display:block;" onmouseover="this.style.background='#f0f0ef'" onmouseout="this.style.background='transparent'">Confidentialité</a>
</nav>
""", unsafe_allow_html=True)
