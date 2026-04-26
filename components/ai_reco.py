import re
import streamlit as st
from supabase import Client
from datetime import datetime, timezone

from scripts.ai_reco import get_or_generate_reco, submit_feedback


def _age_str(iso: str) -> str:
    try:
        dt = datetime.fromisoformat(iso).replace(tzinfo=timezone.utc)
        delta = datetime.now(timezone.utc) - dt
        minutes = int(delta.total_seconds() // 60)
        if minutes < 60:
            return f"il y a {minutes} min"
        hours = minutes // 60
        if hours < 24:
            return f"il y a {hours}h"
        return f"il y a {hours // 24}j"
    except Exception:
        return ""


@st.fragment
def show_ai_reco(supabase: Client, user_id: str, is_paid: bool, df=None, followers_delta: int = 0):
    if not is_paid:
        st.markdown("""
        <div style='position:relative;margin-bottom:16px;'>
            <div style='filter:blur(5px);pointer-events:none;background:#f8faff;border-left:3px solid #0066ff;border-radius:8px;padding:16px 20px;'>
                <p>• Publie 2 Reels cette semaine, ils génèrent 3x plus de reach que tes images</p>
                <p>• Tes posts du jeudi performent 40% mieux — teste ce créneau</p>
                <p>• Ajoute un CTA "Sauvegarde pour plus tard" pour booster tes saves</p>
            </div>
            <div style='position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;white-space:nowrap;'>
                <div style='background:white;border-radius:8px;padding:10px 18px;border:1px solid #eaeaea;box-shadow:0 2px 8px rgba(0,0,0,0.08);'>
                    🔒 <b>Recommandations IA — Plan Pro</b>
                </div>
            </div>
        </div>
        """, unsafe_allow_html=True)
        return

    # Bouton régénérer discret (tertiary = lien texte)
    col_ts, col_btn = st.columns([5, 1])
    force = False
    with col_btn:
        force = st.button("↺ Régénérer", key="regen_reco", type="tertiary", use_container_width=True)

    with st.spinner(""):
        reco = get_or_generate_reco(supabase, user_id, df, followers_delta, force=force)

    # Timestamp
    if reco and reco.get("generated_at"):
        with col_ts:
            st.caption(f"Mis à jour {_age_str(reco['generated_at'])}")

    if not reco:
        st.caption("Pas encore assez de données pour générer des recommandations.")
        return

    content_html = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', reco["content"])
    content_html = content_html.replace("\n", "<br>")
    st.markdown(f"""
    <div style='background:#f8faff;border-left:3px solid #0066ff;border-radius:8px;padding:16px 20px;margin-bottom:8px;'>
        {content_html}
    </div>
    """, unsafe_allow_html=True)

    # Feedback inline
    reco_id = reco.get("id")
    if not reco_id:
        return

    if st.session_state.get(f"rated_{reco_id}"):
        st.caption("✓ Merci pour votre retour")
        return

    col_q, col_up, col_down, _ = st.columns([3, 1, 1, 6])
    with col_q:
        st.caption("Utile ?")
    with col_up:
        if st.button("👍", key=f"up_{reco_id}"):
            submit_feedback(supabase, reco_id, user_id, "positive")
            st.session_state[f"rated_{reco_id}"] = True
            st.rerun()
    with col_down:
        if st.button("👎", key=f"down_{reco_id}"):
            st.session_state[f"feedback_open_{reco_id}"] = True

    if st.session_state.get(f"feedback_open_{reco_id}"):
        comment = st.text_input("Qu'est-ce qui ne va pas ?", key=f"comment_{reco_id}")
        if st.button("Envoyer", key=f"send_{reco_id}"):
            submit_feedback(supabase, reco_id, user_id, "negative", comment)
            st.session_state[f"rated_{reco_id}"] = True
            st.session_state[f"feedback_open_{reco_id}"] = False
            st.rerun()
