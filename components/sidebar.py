import streamlit as st
import pandas as pd

from scripts.stripe import create_checkout_session, cancel_subscription
from components.insights_panel import show_insights_panel


def show_sidebar(client, session, is_paid):
    with st.sidebar:
        st.markdown(f"**{session.user.email}**")
        st.caption(f"Plan : {'Pro' if is_paid else 'Gratuit — 10 posts max'}")

        if is_paid:
            if st.button("Annuler l'abonnement", type="tertiary", key="btn_cancel_sub"):
                if cancel_subscription(session.user.email):
                    client.table("profiles").update({"is_paid": False}).eq("id", session.user.id).execute()
                    st.success("Abonnement annulé.")
                    st.rerun()
                else:
                    st.error("Aucun abonnement actif trouvé.")

        if not is_paid:
            st.divider()
            st.markdown("**Passez au Pro**")
            st.caption("Tous vos posts, historique illimité.")

            if "checkout_url" not in st.session_state:
                if st.button("Souscrire — 35 CHF/mois", type="primary", width="stretch"):
                    try:
                        ctx = st.context.headers
                        host = ctx.get("host", "localhost:8502")
                        proto = "https" if "streamlit.app" in host else "https"
                        base_url = f"{proto}://{host}"
                        url = create_checkout_session(
                            user_id=session.user.id,
                            email=session.user.email,
                            plan="pro",
                            refresh_token=session.refresh_token,
                            base_url=base_url,
                        )
                        st.session_state["checkout_url"] = url
                        st.rerun()
                    except Exception as e:
                        st.error(f"Erreur Stripe : {e}")
            else:
                st.link_button("Procéder au paiement", url=st.session_state["checkout_url"],
                               width="stretch", type="primary")
                if st.button("Annuler", width="stretch"):
                    del st.session_state["checkout_url"]
                    st.rerun()

        st.markdown("""
        <style>
        [data-testid="stSidebar"] [data-testid="stBaseButton-btn_logout"],
        [data-testid="stSidebar"] [data-testid="stBaseButton-btn_logout"] p,
        [data-testid="stSidebar"] [data-testid="stBaseButton-btn_logout"] span {
            background: #dc2626 !important;
            color: #ffffff !important;
            border: none !important;
        }
        [data-testid="stSidebar"] button[kind="tertiary"],
        [data-testid="stSidebar"] button[kind="tertiary"] p {
            background: transparent !important;
            color: #9ca3af !important;
            border: none !important;
            font-size: 0.8rem !important;
            padding: 4px 0 !important;
            box-shadow: none !important;
        }
        </style>
        """, unsafe_allow_html=True)
        st.divider()
        if st.button("Se déconnecter", key="btn_logout"):
            del st.session_state["session"]
            if "refresh_token" in st.query_params:
                del st.query_params["refresh_token"]
            st.rerun()

    # ── Insights IA (hors du with st.sidebar pour éviter le double contexte) ──
    raw_results = st.session_state.get("results", [])
    df_instagram = pd.DataFrame(raw_results) if raw_results else pd.DataFrame()
    df_meta = st.session_state.get("meta_ads_df", pd.DataFrame())
    if not isinstance(df_meta, pd.DataFrame):
        df_meta = pd.DataFrame()

    section = st.session_state.get("active_section")
    if section != "meta_ads":
        show_insights_panel(df_instagram=df_instagram, df_meta=df_meta, is_paid=is_paid, section=section, use_sidebar=True)
