import streamlit as st

from meta_script.fetch_token import get_oauth_url
from components.meta_ads import meta_ads_source_fragment
from scripts.stripe import create_checkout_session, cancel_subscription


def show_account_tab(session, client, user_id, is_paid, insta_accounts, accounts_data):

    sub_infos, sub_insta, sub_meta, sub_google = st.tabs([
        "Infos du compte",
        "📸 Connecter Instagram",
        "📘 Connecter Meta Ads",
        "🔍 Connecter Google Ads",
    ])

    # ── Infos du compte ────────────────────────────────────────────────────────
    with sub_infos:
        st.markdown("<div class='section-title'>Mon compte</div>", unsafe_allow_html=True)

        c1, c2, c3 = st.columns(3)
        c1.metric("Email", session.user.email)
        c2.metric("Plan", "Pro" if is_paid else "Gratuit")
        c3.metric("Posts max", "Illimité" if is_paid else "10")

        st.markdown("<br>", unsafe_allow_html=True)

        # ── Abonnement ─────────────────────────────────────────────────────────
        if is_paid:
            st.markdown("**Abonnement Pro actif**")
            if st.button("Annuler l'abonnement", type="tertiary", key="btn_cancel_sub_account"):
                if cancel_subscription(session.user.email):
                    client.table("profiles").update({"is_paid": False}).eq("id", user_id).execute()
                    st.success("Abonnement annulé.")
                    st.rerun()
                else:
                    st.error("Aucun abonnement actif trouvé.")
        else:
            st.markdown("**Passer au Pro**")
            st.caption("Tous vos posts, historique illimité, insights IA.")
            if "checkout_url" not in st.session_state:
                if st.button("Souscrire — 35 CHF/mois", type="primary", key="btn_subscribe_account"):
                    try:
                        ctx = st.context.headers
                        host = ctx.get("host", "localhost:8502")
                        proto = "https"
                        base_url = f"{proto}://{host}"
                        url = create_checkout_session(
                            user_id=user_id,
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
                st.link_button("Procéder au paiement", url=st.session_state["checkout_url"], type="primary")
                if st.button("Annuler", key="btn_cancel_checkout"):
                    del st.session_state["checkout_url"]
                    st.rerun()

        st.markdown("<br>", unsafe_allow_html=True)
        st.divider()

        # ── Déconnexion ────────────────────────────────────────────────────────
        st.markdown("**Session**")
        st.caption(f"Connecté en tant que **{session.user.email}**")
        if st.button("Se déconnecter", key="btn_logout_account"):
            del st.session_state["session"]
            if "refresh_token" in st.query_params:
                del st.query_params["refresh_token"]
            st.rerun()

    # ── Connecter Instagram ────────────────────────────────────────────────────
    with sub_insta:
        if insta_accounts:
            for acc in insta_accounts:
                name = acc.get("account_name") or "Compte Instagram"
                date = acc.get("created_at", "")[:10]
                total_posts = acc.get("total_posts_id_instagram", 0)
                col_info, col_btn = st.columns([5, 1])
                with col_info:
                    st.markdown(
                        f"<div class='account-name'>{name}</div>"
                        f"<div class='account-meta'>Connecté le {date} · {total_posts} posts</div>",
                        unsafe_allow_html=True,
                    )
                with col_btn:
                    if st.button("Retirer", key=f"disc_{acc['id']}"):
                        client.table("profiles").update({"active_account_id": None}).eq("id", user_id).execute()
                        client.table("connected_accounts").delete().eq("id", acc["id"]).execute()
                        if st.session_state.get("meta_long_token"):
                            del st.session_state["meta_long_token"]
                        st.rerun()
        else:
            st.markdown(
                "<div style='color:#6b6b6b;padding:12px 0'>Aucun compte Instagram connecté.</div>",
                unsafe_allow_html=True,
            )

        st.markdown("<br>", unsafe_allow_html=True)
        st.link_button(
            "+ Connecter un compte Instagram",
            get_oauth_url(state=st.session_state["session"].refresh_token),
        )
        if insta_accounts and st.button("Récupérer mes données Instagram", type="primary", key="btn_fetch_insta_source"):
            st.session_state["trigger_fetch"] = True
            st.rerun()

    # ── Connecter Meta Ads ─────────────────────────────────────────────────────
    with sub_meta:
        if "meta_long_token" in st.session_state:
            meta_ads_source_fragment(
                token=st.session_state["meta_long_token"],
                supabase=client,
                user_id=user_id,
            )
        else:
            st.markdown(
                "<div style='color:#6b6b6b;padding:12px 0'>Aucun compte Meta Ads connecté.</div>",
                unsafe_allow_html=True,
            )
            st.markdown("<br>", unsafe_allow_html=True)
            st.link_button(
                "+ Connecter Meta Ads",
                get_oauth_url(state=st.session_state["session"].refresh_token),
            )

    # ── Connecter Google Ads ───────────────────────────────────────────────────
    with sub_google:
        st.info("Bientôt disponible")
