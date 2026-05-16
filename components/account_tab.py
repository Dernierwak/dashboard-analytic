import streamlit as st

from meta_script.fetch_token import get_oauth_url
from components.meta_ads import meta_ads_source_fragment
from components.instagram_tab import run_instagram_fetch
from scripts.stripe import create_checkout_session, cancel_subscription


# ── CSS local pour cette page (réutilise les tokens Pulse) ─────────────────────
_ACCOUNT_CSS = """<style>
.acc-hero { padding: 8px 0 16px; }
.acc-eyebrow {
    font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.08em; color: #8b8e98; margin-bottom: 8px;
    font-family: "JetBrains Mono", ui-monospace, monospace;
}
.acc-h1 {
    font-family: "Instrument Serif", Georgia, serif !important;
    font-size: 1.6rem !important; font-weight: 400 !important;
    color: #0e0f12 !important; line-height: 1.2 !important;
    margin: 0 0 6px !important;
}
.acc-sub { font-size: 13px; color: #5a5d66; margin: 0; max-width: 560px; }

.acc-section-title {
    font-size: 13px; font-weight: 600; color: #0e0f12;
    margin: 24px 0 12px;
}

/* Carte simple (info / connexion) */
.acc-card {
    background: #fff; border: 1px solid rgba(14,15,18,0.08);
    border-radius: 14px; padding: 16px 20px; margin-bottom: 10px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px;
}
.acc-card-left { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.acc-card-name { font-size: 14px; font-weight: 600; color: #0e0f12; }
.acc-card-meta { font-size: 11.5px; color: #8b8e98; }

/* Mini-KPI (Email / Plan / Posts max) */
.acc-kpi-grid {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 12px; margin-bottom: 16px;
}
.acc-kpi {
    background: #fff; border: 1px solid rgba(14,15,18,0.08);
    border-radius: 14px; padding: 16px 20px;
}
.acc-kpi-lbl {
    font-size: 10.5px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.06em; color: #8b8e98; margin-bottom: 6px;
}
.acc-kpi-val {
    font-family: "JetBrains Mono", ui-monospace, monospace;
    font-size: 1.2rem; font-weight: 500; color: #0e0f12;
    word-break: break-all;
}
.acc-badge {
    display: inline-block; padding: 2px 9px; border-radius: 20px;
    font-size: 11px; font-weight: 600;
}
.acc-badge.good { background: #e7f3ec; color: #1a7a4a; }
.acc-badge.neu  { background: rgba(14,15,18,0.06); color: #5a5d66; }

/* Sub-tabs (st.tabs) */
[data-testid="stTabs"] [data-baseweb="tab-list"] { gap: 4px; }
[data-testid="stTabs"] [data-baseweb="tab"] {
    font-size: 13px; font-weight: 500;
}
</style>"""


def _acc_kpi(label: str, value: str) -> str:
    return (
        f'<div class="acc-kpi">'
        f'<div class="acc-kpi-lbl">{label}</div>'
        f'<div class="acc-kpi-val">{value}</div>'
        f'</div>'
    )


def show_account_tab(session, client, user_id, is_paid, insta_accounts, accounts_data, dash=None):
    st.markdown(_ACCOUNT_CSS, unsafe_allow_html=True)

    sub_infos, sub_insta, sub_meta, sub_google = st.tabs([
        "Compte",
        "Instagram",
        "Meta Ads",
        "Google Ads",
    ])

    # ── Infos du compte ────────────────────────────────────────────────────────
    with sub_infos:
        plan_badge = (
            '<span class="acc-badge good">Pro</span>'
            if is_paid else '<span class="acc-badge neu">Gratuit</span>'
        )
        st.markdown(
            f'<div class="acc-hero">'
            f'<div class="acc-eyebrow">Compte</div>'
            f'<h1 class="acc-h1">Ton profil et ton abonnement.</h1>'
            f'<p class="acc-sub">Gère ton plan, tes intégrations et la déconnexion.</p>'
            f'</div>',
            unsafe_allow_html=True,
        )

        # KPI rapides
        st.markdown(
            '<div class="acc-kpi-grid">'
            + _acc_kpi("Email", session.user.email)
            + _acc_kpi("Plan", "Pro" if is_paid else "Gratuit")
            + _acc_kpi("Posts max", "Illimité" if is_paid else "10")
            + '</div>',
            unsafe_allow_html=True,
        )

        # ── Abonnement ─────────────────────────────────────────────────────────
        st.markdown('<div class="acc-section-title">Abonnement</div>', unsafe_allow_html=True)
        if is_paid:
            st.markdown(
                f'<div class="acc-card">'
                f'<div class="acc-card-left">'
                f'<div class="acc-card-name">Pro {plan_badge}</div>'
                f'<div class="acc-card-meta">Tous les posts · historique illimité · insights IA</div>'
                f'</div></div>',
                unsafe_allow_html=True,
            )
            if st.button("Annuler l'abonnement", type="secondary", key="btn_cancel_sub_account"):
                with st.spinner("Annulation en cours…"):
                    cancelled = cancel_subscription(session.user.email)
                if cancelled:
                    client.table("profiles").update({"is_paid": False}).eq("id", user_id).execute()
                    st.success("Abonnement annulé.")
                    st.rerun()
                else:
                    st.error("Aucun abonnement actif trouvé.")
        else:
            st.markdown(
                '<div class="acc-card">'
                '<div class="acc-card-left">'
                '<div class="acc-card-name">Passer au Pro — 35 CHF/mois</div>'
                '<div class="acc-card-meta">Tous tes posts · historique illimité · insights IA</div>'
                '</div></div>',
                unsafe_allow_html=True,
            )
            if "checkout_url" not in st.session_state:
                if st.button("Souscrire", type="primary", key="btn_subscribe_account"):
                    with st.spinner("Préparation du paiement…"):
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

        # ── Session ────────────────────────────────────────────────────────────
        st.markdown('<div class="acc-section-title">Session</div>', unsafe_allow_html=True)
        st.markdown(
            f'<div class="acc-card">'
            f'<div class="acc-card-left">'
            f'<div class="acc-card-name">{session.user.email}</div>'
            f'<div class="acc-card-meta">Connecté</div>'
            f'</div></div>',
            unsafe_allow_html=True,
        )
        if st.button("Se déconnecter", key="btn_logout_account"):
            del st.session_state["session"]
            if "refresh_token" in st.query_params:
                del st.query_params["refresh_token"]
            st.rerun()

    # ── Connecter Instagram ────────────────────────────────────────────────────
    with sub_insta:
        st.markdown(
            '<div class="acc-hero">'
            '<div class="acc-eyebrow">Instagram</div>'
            '<h1 class="acc-h1">Tes comptes Instagram connectés.</h1>'
            '<p class="acc-sub">Accède à tes posts organiques et leurs métriques (portée, likes, saves…).</p>'
            '</div>',
            unsafe_allow_html=True,
        )

        st.markdown('<div class="acc-section-title">Comptes connectés</div>', unsafe_allow_html=True)
        if insta_accounts:
            for acc in insta_accounts:
                name = acc.get("account_name") or "Compte Instagram"
                date = acc.get("created_at", "")[:10]
                total_posts = acc.get("total_posts_id_instagram", 0)
                col_info, col_btn = st.columns([5, 1])
                with col_info:
                    st.markdown(
                        f'<div class="acc-card" style="margin-bottom:0;">'
                        f'<div class="acc-card-left">'
                        f'<div class="acc-card-name">{name}</div>'
                        f'<div class="acc-card-meta">Connecté le {date} · {total_posts} posts</div>'
                        f'</div></div>',
                        unsafe_allow_html=True,
                    )
                with col_btn:
                    if st.button("Retirer", key=f"disc_{acc['id']}", use_container_width=True):
                        client.table("profiles").update({"active_account_id": None}).eq("id", user_id).execute()
                        client.table("connected_accounts").delete().eq("id", acc["id"]).execute()
                        if st.session_state.get("meta_long_token"):
                            del st.session_state["meta_long_token"]
                        st.rerun()
        else:
            st.markdown(
                '<div class="acc-card"><div class="acc-card-meta">Aucun compte Instagram connecté.</div></div>',
                unsafe_allow_html=True,
            )

        st.markdown('<div class="acc-section-title">Actions</div>', unsafe_allow_html=True)
        col_a, col_b = st.columns(2)
        with col_a:
            st.link_button(
                "+ Connecter un compte",
                get_oauth_url(state=st.session_state["session"].refresh_token),
                use_container_width=True,
            )
        with col_b:
            if insta_accounts and dash is not None:
                if st.button("↻ Récupérer mes données", type="primary",
                             key="btn_fetch_insta_source", use_container_width=True):
                    st.session_state["_fetch_insta_inline"] = True
                    st.rerun()

        # Fetch inline (s'exécute après le rerun, reste sur Paramètres)
        if st.session_state.pop("_fetch_insta_inline", False) and insta_accounts and dash is not None:
            # ── 1. Verrouillage de la navigation pendant le fetch ────────────
            st.markdown(
                """
                <style id="fetch-lock">
                /* Désactive la sidebar (clicks + visuel atténué) */
                [data-testid="stSidebar"] {
                    pointer-events: none !important;
                    opacity: 0.4 !important;
                    filter: grayscale(0.3);
                }
                /* Désactive les onglets de Paramètres */
                .stTabs [data-baseweb="tab-list"] {
                    pointer-events: none !important;
                    opacity: 0.5 !important;
                }
                /* Empêche de fermer/refresh sans s'en rendre compte */
                [data-testid="stHeader"] { opacity: 0.5; }
                /* Banner de blocage */
                .fetch-locked-banner {
                    position: sticky; top: 0; z-index: 100;
                    background: linear-gradient(90deg,#3b5bff,#7b4fff);
                    color: #fff; padding: 10px 16px; border-radius: 10px;
                    font-size: 13px; font-weight: 500;
                    box-shadow: 0 4px 16px rgba(59,91,255,0.25);
                    display: flex; align-items: center; gap: 10px;
                    margin-bottom: 16px;
                    animation: pulse-glow 2s ease-in-out infinite;
                }
                @keyframes pulse-glow {
                    0%, 100% { box-shadow: 0 4px 16px rgba(59,91,255,0.25); }
                    50% { box-shadow: 0 4px 24px rgba(59,91,255,0.5); }
                }
                .fetch-spinner {
                    width: 14px; height: 14px; border-radius: 50%;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-top-color: #fff;
                    animation: spin 0.8s linear infinite;
                    flex-shrink: 0;
                }
                @keyframes spin { to { transform: rotate(360deg); } }
                </style>
                <div class="fetch-locked-banner">
                    <div class="fetch-spinner"></div>
                    <span>Récupération en cours — ne quitte pas cette page, la navigation est temporairement désactivée.</span>
                </div>
                """,
                unsafe_allow_html=True,
            )

            # ── 2. Lancement du fetch (avec st.status interne qui défile) ────
            insta_biz_id = insta_accounts[0].get("instagram_business_id")
            run_instagram_fetch(client, user_id, dash, instagram_business_id=insta_biz_id, is_paid=is_paid)

            # ── 3. À la fin du fetch, retire le verrouillage proprement ──────
            st.markdown(
                "<style>"
                "[data-testid='stSidebar'] { pointer-events: auto !important; opacity: 1 !important; filter: none !important; }"
                ".stTabs [data-baseweb='tab-list'] { pointer-events: auto !important; opacity: 1 !important; }"
                "[data-testid='stHeader'] { opacity: 1; }"
                ".fetch-locked-banner { display: none; }"
                "</style>",
                unsafe_allow_html=True,
            )
            st.success("Récupération terminée. Tu peux maintenant naviguer.")

    # ── Connecter Meta Ads ─────────────────────────────────────────────────────
    with sub_meta:
        st.markdown(
            '<div class="acc-hero">'
            '<div class="acc-eyebrow">Meta Ads</div>'
            '<h1 class="acc-h1">Tes campagnes publicitaires.</h1>'
            '<p class="acc-sub">Synchronise tes campagnes Facebook / Instagram Ads pour suivre dépenses et performances.</p>'
            '</div>',
            unsafe_allow_html=True,
        )

        if "meta_long_token" in st.session_state:
            st.markdown('<div class="acc-section-title">Synchronisation</div>', unsafe_allow_html=True)
            with st.spinner("Chargement des comptes Meta Ads…"):
                meta_ads_source_fragment(
                    token=st.session_state["meta_long_token"],
                    supabase=client,
                    user_id=user_id,
                )
        else:
            st.markdown(
                '<div class="acc-card"><div class="acc-card-meta">Aucun compte Meta Ads connecté.</div></div>',
                unsafe_allow_html=True,
            )
            st.markdown('<div class="acc-section-title">Actions</div>', unsafe_allow_html=True)
            st.link_button(
                "+ Connecter Meta Ads",
                get_oauth_url(state=st.session_state["session"].refresh_token),
                use_container_width=True,
            )

    # ── Connecter Google Ads ───────────────────────────────────────────────────
    with sub_google:
        st.markdown(
            '<div class="acc-hero">'
            '<div class="acc-eyebrow">Google Ads</div>'
            '<h1 class="acc-h1">Bientôt disponible.</h1>'
            '<p class="acc-sub">L\'intégration Google Ads arrive prochainement. Tu pourras analyser tes campagnes Search et Display directement ici.</p>'
            '</div>',
            unsafe_allow_html=True,
        )
        st.markdown(
            '<div class="acc-card"><div class="acc-card-left">'
            '<div class="acc-card-name">🚧 En développement</div>'
            '<div class="acc-card-meta">Reviens bientôt — on bosse dessus.</div>'
            '</div></div>',
            unsafe_allow_html=True,
        )
