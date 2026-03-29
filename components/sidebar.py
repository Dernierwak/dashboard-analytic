import streamlit as st

from scripts.stripe import create_checkout_session, cancel_subscription


def show_sidebar(client, session, is_paid):
    with st.sidebar:
        st.markdown(f"**{session.user.email}**")
        st.caption(f"Plan : {'Pro' if is_paid else 'Gratuit — 10 posts max'}")

        if not is_paid:
            st.divider()
            st.markdown("**Passez au Pro**")
            st.caption("Tous vos posts, historique illimité.")

            if "checkout_url" not in st.session_state:
                if st.button("Souscrire — 35 CHF/mois", type="primary", width="stretch"):
                    try:
                        url = create_checkout_session(
                            user_id=session.user.id,
                            email=session.user.email,
                            plan="pro",
                            refresh_token=session.refresh_token,
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

        if is_paid:
            st.divider()
            if st.button("Se désabonner", type="tertiary"):
                if cancel_subscription(session.user.email):
                    client.table("profiles").update({"is_paid": False}).eq("id", session.user.id).execute()
                    st.success("Abonnement annulé.")
                    st.rerun()
                else:
                    st.error("Aucun abonnement actif trouvé.")

        st.divider()
        if st.button("Se déconnecter"):
            del st.session_state["session"]
            if "refresh_token" in st.query_params:
                del st.query_params["refresh_token"]
            st.rerun()
