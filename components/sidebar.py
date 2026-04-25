import streamlit as st


def show_sidebar():
    """Sidebar gauche — navigation uniquement."""
    with st.sidebar:
        st.markdown(
            '<div style="display:flex;align-items:center;gap:8px;padding:4px 2px 20px;">'
            '<div style="width:22px;height:22px;background:#0a0a0a;border-radius:5px;flex-shrink:0;"></div>'
            '<span style="font-size:13px;font-weight:600;color:#0a0a0a;letter-spacing:-0.3px;">Analytics</span>'
            "</div>",
            unsafe_allow_html=True,
        )
