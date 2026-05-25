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


# ── Card OAuth réutilisable (Pulse design, même style que Google Ads) ─────────
_META_CONNECT_CSS = """<style>
.meta-connect-card {
    background: #fff; border: 1px solid rgba(14,15,18,0.08);
    border-radius: 14px; padding: 28px; margin-bottom: 12px;
}
.meta-logo { width: 48px; height: 48px; border-radius: 12px;
    background: linear-gradient(135deg,#0052d4,#7b4fff,#ff6b35);
    display: inline-block; margin-bottom: 16px; }
.perm-list { list-style: none; padding: 0; margin: 16px 0 0; }
.perm-list li { font-size: 13px; color: #5a5d66; padding: 4px 0;
    display: flex; align-items: center; gap: 8px; }
.perm-ok { color: #1a7a4a; font-weight: 700; font-size: 16px; }
.perm-no { color: #c0392b; font-weight: 700; font-size: 16px; }
</style>"""


_META_CARDS_BY_CONTEXT = {
    "instagram": {
        "title":    "Meta Business — Instagram",
        "subtitle": "Connecte ton compte Instagram Business pour suivre tes posts organiques et leurs performances.",
        "perms": [
            ("ok", "Lire tes posts organiques (caption, format, date)"),
            ("ok", "Lire les métriques (portée, likes, saves, commentaires)"),
            ("ok", "Lire ton nombre d'abonnés"),
            ("no", "Stories — arrive bientôt"),
            ("no", "Posts collab — non accessibles via l'API Meta"),
            ("no", "Publier ou modifier tes posts"),
            ("no", "Lire tes messages privés"),
        ],
    },
    "ads": {
        "title":    "Meta Business — Facebook / Instagram Ads",
        "subtitle": "Connecte tes campagnes Meta Ads pour analyser dépenses, performances et ROI.",
        "perms": [
            ("ok", "Lire tes campagnes (statut, dépenses, budget)"),
            ("ok", "Lire les insights (impressions, clics, CTR, CPC)"),
            ("ok", "Lire les statuts de validation des annonces"),
            ("no", "Créer ou modifier des campagnes"),
            ("no", "Publier des annonces"),
            ("no", "Lire les messages privés"),
        ],
    },
}


def _render_meta_connect_card(session, context: str = "ads") -> None:
    """Card Meta Business + bouton OAuth — design unifié (même que Google Ads)."""
    st.markdown(_META_CONNECT_CSS, unsafe_allow_html=True)
    cfg = _META_CARDS_BY_CONTEXT.get(context, _META_CARDS_BY_CONTEXT["ads"])
    perms_html = "".join(
        f'<li><span class="perm-{t}">{("✓" if t=="ok" else "✗")}</span> {txt}</li>'
        for t, txt in cfg["perms"]
    )
    st.markdown(
        f"""
        <div class='meta-connect-card'>
            <div class='meta-logo'></div>
            <div style='font-size:16px;font-weight:600;color:#0e0f12;margin-bottom:6px;'>{cfg["title"]}</div>
            <div style='font-size:13px;color:#5a5d66;margin-bottom:4px;'>{cfg["subtitle"]}</div>
            <ul class='perm-list'>
                {perms_html}
            </ul>
        </div>
        """,
        unsafe_allow_html=True,
    )
    st.markdown("<br>", unsafe_allow_html=True)
    st.link_button(
        "🔗 Connecter avec Meta",
        get_oauth_url(state=session.refresh_token),
        type="primary",
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

        is_meta_connected = "meta_long_token" in st.session_state

        if not is_meta_connected:
            # Pas encore connecté → affiche la card Meta Business
            _render_meta_connect_card(session, context="instagram")
        else:
            # Connecté → liste les comptes + actions
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
                    '<div class="acc-card"><div class="acc-card-meta">Aucun compte Instagram connecté à ton Meta Business.</div></div>',
                    unsafe_allow_html=True,
                )

            st.markdown('<div class="acc-section-title">Actions</div>', unsafe_allow_html=True)
            col_a, col_b = st.columns(2)
            with col_a:
                st.link_button(
                    "+ Connecter un autre compte",
                    get_oauth_url(state=st.session_state["session"].refresh_token),
                    use_container_width=True,
                )
            with col_b:
                if insta_accounts and dash is not None:
                    if st.button("↻ Récupérer mes données", type="primary",
                                 key="btn_fetch_insta_source", use_container_width=True):
                        st.session_state["_fetch_insta_inline"] = True
                        st.rerun()

            # ── Sources de données ──────────────────────────────────────────
            st.markdown('<div class="acc-section-title">Sources de données</div>', unsafe_allow_html=True)
            st.markdown(
                """
                <div class='acc-card' style='display:block;padding:14px 18px;'>
                    <ul style='margin:0;padding:0;list-style:none;font-size:13px;color:#5a5d66;'>
                        <li style='padding:4px 0;display:flex;align-items:center;gap:10px;'>
                            <span style='color:#1a7a4a;font-weight:700;font-size:14px;'>✓</span>
                            <span><b style='color:#0e0f12;'>Posts organiques</b> — portée, likes, saves, commentaires, format, date</span>
                        </li>
                        <li style='padding:4px 0;display:flex;align-items:center;gap:10px;'>
                            <span style='color:#b86b00;font-weight:700;font-size:14px;'>⏳</span>
                            <span><b style='color:#0e0f12;'>Stories</b> — bientôt disponible</span>
                        </li>
                        <li style='padding:4px 0;display:flex;align-items:center;gap:10px;'>
                            <span style='color:#c0392b;font-weight:700;font-size:14px;'>✗</span>
                            <span><b style='color:#0e0f12;'>Posts collab</b> — non disponible (limitation de l'API Meta)</span>
                        </li>
                    </ul>
                </div>
                """,
                unsafe_allow_html=True,
            )

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
            # Pas connecté → affiche la card Meta Business
            _render_meta_connect_card(session, context="ads")

    # ── Connecter Google Ads ───────────────────────────────────────────────────
    with sub_google:
        st.markdown(
            '<div class="acc-hero">'
            '<div class="acc-eyebrow">Google Ads</div>'
            '<h1 class="acc-h1">Tes campagnes Google Ads.</h1>'
            '<p class="acc-sub">Connecte ton compte Google Ads pour suivre tes campagnes Search, Display et Performance Max.</p>'
            '</div>',
            unsafe_allow_html=True,
        )

        # Check si les credentials Google sont configurés
        gads_configured = False
        try:
            _ = st.secrets.google_ads.developer_token
            _ = st.secrets.google_ads.client_id
            gads_configured = True
        except Exception:
            pass

        if not gads_configured:
            st.warning(
                "⚠ Les credentials Google Ads ne sont pas encore configurés dans Streamlit. "
                "Voir le fichier `GOOGLE_ADS_SETUP.md` à la racine du projet pour les étapes "
                "d'obtention du developer token et du client OAuth."
            )
            return

        # Check si déjà connecté
        from scripts.fetch_data import fetch_google_refresh_token
        from google_script.fetch_token import get_oauth_url as gad_oauth_url, get_access_token_from_refresh
        from google_script.fetch_google_ads import list_accessible_customers
        from components.google_ads import run_google_ads_fetch

        refresh_tok, customer_id = (None, None)
        if client and user_id:
            refresh_tok, customer_id = fetch_google_refresh_token(client, user_id)

        if refresh_tok and customer_id:
            # Déjà connecté
            st.markdown('<div class="acc-section-title">Compte connecté</div>', unsafe_allow_html=True)
            st.markdown(
                f'<div class="acc-card"><div class="acc-card-left">'
                f'<div class="acc-card-name">Customer ID : {customer_id}</div>'
                f'<div class="acc-card-meta">Token OAuth Google enregistré ✓</div>'
                f'</div></div>',
                unsafe_allow_html=True,
            )

            st.markdown('<div class="acc-section-title">Synchronisation</div>', unsafe_allow_html=True)
            col_a, col_b = st.columns(2)
            with col_a:
                force = st.checkbox(
                    f"Récupérer toute l'année {__import__('datetime').date.today().year}",
                    key="chk_gad_force_full",
                )
            with col_b:
                if st.button("↻ Récupérer les données Google Ads", type="primary",
                             use_container_width=True, key="btn_fetch_gad"):
                    progress_bar = st.progress(0, text="Connexion à Google Ads…")
                    def _cb(p, t):
                        try:
                            progress_bar.progress(min(100, max(0, p)), text=t)
                        except Exception:
                            pass
                    result = run_google_ads_fetch(
                        client, user_id,
                        refresh_token=refresh_tok,
                        customer_id=customer_id,
                        force_full=force,
                        progress_cb=_cb,
                    )
                    progress_bar.empty()
                    if result.get("success"):
                        st.success(f"✓ {result.get('message', '')}")
                        st.rerun()
                    else:
                        st.error(f"❌ {result.get('message', 'Erreur inconnue')}")

            if st.button("Déconnecter Google Ads", key="btn_disc_gad", type="secondary"):
                client.table("profiles").update({
                    "google_refresh_token": None,
                    "google_customer_id": None,
                }).eq("id", user_id).execute()
                st.rerun()

        else:
            # Pas connecté → card OAuth (mirror Meta)
            _render_google_connect_card(session)


def _render_google_connect_card(session) -> None:
    """Card OAuth Google Ads."""
    from google_script.fetch_token import get_oauth_url as gad_oauth_url
    st.markdown(_META_CONNECT_CSS, unsafe_allow_html=True)
    st.markdown(
        """
        <div class='meta-connect-card'>
            <div class='meta-logo' style='background:linear-gradient(135deg,#4285F4,#34A853,#FBBC04,#EA4335);'></div>
            <div style='font-size:16px;font-weight:600;color:#0e0f12;margin-bottom:6px;'>Google Ads</div>
            <div style='font-size:13px;color:#5a5d66;margin-bottom:4px;'>Connecte ton compte Google Ads pour analyser tes campagnes Search, Display, Performance Max.</div>
            <ul class='perm-list'>
                <li><span class='perm-ok'>✓</span> Lire tes campagnes (statut, dépenses)</li>
                <li><span class='perm-ok'>✓</span> Lire les insights (impressions, clics, conversions)</li>
                <li><span class='perm-ok'>✓</span> Lire les statuts de validation</li>
                <li><span class='perm-no'>✗</span> Modifier tes campagnes</li>
                <li><span class='perm-no'>✗</span> Créer/supprimer des annonces</li>
            </ul>
        </div>
        """,
        unsafe_allow_html=True,
    )
    st.markdown("<br>", unsafe_allow_html=True)
    # Set flag avant redirect → callback Google saura traiter le ?code
    st.session_state["_pending_google_oauth"] = True
    st.link_button(
        "🔗 Connecter avec Google",
        gad_oauth_url(state=session.refresh_token),
        type="primary",
    )
