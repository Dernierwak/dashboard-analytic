import streamlit as st

from meta_script.fetch_token import get_oauth_url
from scripts.stripe import create_checkout_session, cancel_subscription
from scripts.posthog_client import posthog_client


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

    sub_infos, sub_insta, sub_meta, sub_google, sub_ga4 = st.tabs([
        "Compte",
        "Instagram",
        "Meta Ads",
        "Google Ads",
        "Analytics",
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
                f'<div class="acc-card-name">Plan Pro</div>'
                f'<div class="acc-card-meta">Tous les posts · historique illimité · insights IA</div>'
                f'</div></div>',
                unsafe_allow_html=True,
            )
            if st.button("Annuler l'abonnement", type="secondary", key="btn_cancel_sub_account"):
                with st.spinner("Annulation en cours…"):
                    cancelled = cancel_subscription(session.user.email, user_id=user_id)
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
                    # "2026-04-17" → "17 avril 2026" (pas d'ISO dans l'UI)
                    _iso = acc.get("created_at", "")[:10]
                    try:
                        _y, _m, _d = _iso.split("-")
                        _mois_fr = ["", "janvier", "février", "mars", "avril", "mai", "juin", "juillet",
                                    "août", "septembre", "octobre", "novembre", "décembre"]
                        date = f"{int(_d)} {_mois_fr[int(_m)]} {_y}"
                    except Exception:
                        date = _iso
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
                    # Paramètres = connexions. La récupération passe par le pop-up
                    # unique « Mes données » (tous canaux + choix de période).
                    if st.button("↻ Récupérer mes données", type="primary",
                                 key="btn_fetch_insta_source", use_container_width=True):
                        posthog_client.capture(
                            distinct_id=user_id,
                            event="data_fetch_requested",
                            properties={"source": "instagram"},
                        )
                        st.session_state["_manual_fetch_request"] = True
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

        # (Le fetch inline a été remplacé par le pop-up unique « Mes données ».)

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
            st.markdown(
                '<div class="acc-card"><div class="acc-card-left">'
                '<div class="acc-card-name">Meta Ads connecté ✓</div>'
                '<div class="acc-card-meta">Les données se récupèrent depuis le pop-up « Mes données ».</div>'
                '</div></div>',
                unsafe_allow_html=True,
            )
            if st.button("↻ Récupérer mes données (tous canaux)", type="primary",
                         use_container_width=True, key="btn_fetch_meta_ads_hub"):
                posthog_client.capture(
                    distinct_id=user_id,
                    event="data_fetch_requested",
                    properties={"source": "meta_ads"},
                )
                st.session_state["_manual_fetch_request"] = True
                st.rerun()
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
            # Paramètres = connexions. La récupération (tous canaux + période) passe
            # par le pop-up unique « Mes données ».
            if st.button("↻ Récupérer mes données (tous canaux)", type="primary",
                         use_container_width=True, key="btn_fetch_gad"):
                posthog_client.capture(
                    distinct_id=user_id,
                    event="data_fetch_requested",
                    properties={"source": "google_ads"},
                )
                st.session_state["_manual_fetch_request"] = True
                st.rerun()

            # Déconnecte UNIQUEMENT le compte Ads (garde le token Google → GA4 survit)
            if st.button("Déconnecter ce compte Google Ads", key="btn_disc_gad", type="secondary"):
                client.table("connected_accounts").update({
                    "google_customer_id": None,
                }).eq("user_id", user_id).eq("provider", "google").execute()
                st.rerun()
            st.caption("Garde ta connexion Google Analytics intacte.")

        elif refresh_tok and not customer_id:
            # Token Google OK mais AUCUN compte Ads associé → on diagnostique en clair
            # (au lieu de réafficher la carte de connexion comme si rien ne s'était passé).
            st.markdown('<div class="acc-section-title">Connexion Google OK — compte Ads à finaliser</div>', unsafe_allow_html=True)
            st.info("Ton accès Google est bien enregistré, mais aucun compte Google Ads n'a encore été associé. Voici pourquoi :")

            from google_script.fetch_token import get_access_token_from_refresh
            from google_script.fetch_google_ads import list_accessible_customers
            from scripts.insert_data import update_google_refresh_token

            access = get_access_token_from_refresh(refresh_tok)
            if not access:
                st.error("Impossible d'obtenir un access_token depuis le refresh_token. Reconnecte Google ci-dessous.")
            else:
                ids, err = list_accessible_customers(access)
                if err:
                    st.error(f"Google Ads API : {err}")
                    st.markdown(
                        "**Cause la plus fréquente** : ton *developer token* Google Ads est en "
                        "accès **Test/Basic** → il ne peut pas lister tes vrais comptes. "
                        "Demande l'accès **Basic** dans Google Ads → outils → API Center. "
                        "En attendant, tu peux saisir ton Customer ID à la main ci-dessous."
                    )
                elif not ids:
                    st.warning(
                        "Aucun compte Google Ads accessible avec ce login Google. "
                        "Vérifie que ce compte Google a bien accès à un compte Google Ads."
                    )
                else:
                    chosen = st.selectbox("Choisis ton compte Google Ads", options=ids, key="gad_pick_customer")
                    if st.button("Connecter ce compte", type="primary", key="btn_gad_pick"):
                        update_google_refresh_token(client, user_id, refresh_tok, customer_id=chosen)
                        st.success(f"Compte {chosen} connecté ✓")
                        st.rerun()

            with st.expander("Saisir l'ID manuellement ou reconnecter Google"):
                manual = st.text_input("Customer ID (10 chiffres, sans tirets)", key="gad_manual_id")
                if st.button("Enregistrer cet ID", key="btn_gad_manual"):
                    cid = manual.replace("-", "").replace(" ", "").strip()
                    if cid:
                        update_google_refresh_token(client, user_id, refresh_tok, customer_id=cid)
                        st.rerun()
                    else:
                        st.warning("Saisis un Customer ID valide.")
                st.markdown("<br>", unsafe_allow_html=True)
                _render_google_connect_card(session)

        else:
            # Pas connecté du tout → card OAuth (mirror Meta)
            _render_google_connect_card(session)

    # ── Connecter Google Analytics (GA4) ────────────────────────────────────────
    with sub_ga4:
        _render_ga4_section(session, client, user_id)


def _render_ga4_section(session, client, user_id) -> None:
    """Connexion GA4 — réutilise le token Google, puis choix de la propriété.

    GA4 donne le RETOUR réel des pubs (conversions, revenus) → le rapport hebdo
    passe ses conseils pub de « À creuser » à « Solide ».
    """
    st.markdown(
        '<div class="acc-hero">'
        '<div class="acc-eyebrow">Google Analytics</div>'
        '<h1 class="acc-h1">Le vrai retour de tes pubs.</h1>'
        '<p class="acc-sub">Relie ta dépense publicitaire à tes ventes et contacts réels. '
        "Sans ça, le rapport ne voit que le coût, jamais le résultat.</p>"
        '</div>',
        unsafe_allow_html=True,
    )

    gads_configured = False
    try:
        _ = st.secrets.google_ads.client_id
        gads_configured = True
    except Exception:
        pass
    if not gads_configured:
        st.warning("⚠ Les credentials Google ne sont pas configurés (`[google_ads].client_id`).")
        return

    from scripts.fetch_data import fetch_google_refresh_token, fetch_ga4_property_id
    from scripts.insert_data import update_ga4_property_id
    from google_script.fetch_token import get_access_token_from_refresh
    from google_script.fetch_ga4 import list_ga4_properties

    refresh_tok, _customer = fetch_google_refresh_token(client, user_id) if (client and user_id) else (None, None)

    # Étape 1 : il faut d'abord le token Google (partagé avec Google Ads)
    if not refresh_tok:
        st.info(
            "Connecte d'abord ton compte Google (onglet **Google Ads**). "
            "La même autorisation couvre Google Analytics — pas besoin de se reconnecter deux fois."
        )
        _render_google_connect_card(session)
        return

    property_id = fetch_ga4_property_id(client, user_id)

    # Étape 2 : propriété déjà choisie → synchro
    if property_id:
        st.markdown('<div class="acc-section-title">Propriété connectée</div>', unsafe_allow_html=True)
        st.markdown(
            f'<div class="acc-card"><div class="acc-card-left">'
            f'<div class="acc-card-name">GA4 : {property_id}</div>'
            f'<div class="acc-card-meta">Token Google partagé ✓</div>'
            f'</div></div>',
            unsafe_allow_html=True,
        )
        # Paramètres = connexions. La récupération (tous canaux + période) passe
        # par le pop-up unique « Mes données ».
        if st.button("↻ Récupérer mes données (tous canaux)", type="primary",
                     use_container_width=True, key="btn_fetch_ga4"):
            posthog_client.capture(
                distinct_id=user_id,
                event="data_fetch_requested",
                properties={"source": "ga4"},
            )
            st.session_state["_manual_fetch_request"] = True
            st.rerun()

        # Déconnecte UNIQUEMENT Analytics (garde le token Google → Google Ads survit)
        if st.button("Déconnecter Analytics", key="btn_disc_ga4", type="secondary"):
            try:
                update_ga4_property_id(client, user_id, None)
                st.rerun()
            except Exception as e:
                st.error(f"Déconnexion échouée : {e}")
        st.caption("Garde ta connexion Google Ads intacte.")
        st.divider()
        _render_google_full_signout(client, user_id, key_suffix="ga4conn")
        return

    # Étape 3 : token OK mais pas de propriété → la lister et la choisir
    st.markdown('<div class="acc-section-title">Choisis ta propriété GA4</div>', unsafe_allow_html=True)
    access = get_access_token_from_refresh(refresh_tok)
    props, err = list_ga4_properties(access) if access else ([], "access_token indisponible")
    if err:
        is_scope_err = "scope" in err.lower() or "403" in err
        if is_scope_err:
            st.warning(
                "🔑 Ton autorisation Google actuelle ne couvre pas encore Analytics "
                "(elle a été créée pour Google Ads). **Reconnecte ton compte Google ci-dessous** "
                "pour ajouter l'accès Analytics."
            )
        else:
            st.error(f"Google Analytics : {err}")
        st.markdown(
            "<div style='font-size:12.5px;color:#5a5d66;line-height:1.6;margin:8px 0;'>"
            "Avant de reconnecter, vérifie côté <b>Google Cloud Console</b> :<br>"
            "• APIs &amp; Services → Library → active <b>Google Analytics Data API</b> + "
            "<b>Google Analytics Admin API</b><br>"
            "• OAuth consent screen → Scopes → ajoute <code>analytics.readonly</code><br>"
            "• si l'app est en mode « Testing » → ton email doit être dans les <b>Test users</b>"
            "</div>",
            unsafe_allow_html=True,
        )
        _render_ga4_reconnect_button(session)
        return
    if not props:
        st.warning("Aucune propriété GA4 accessible avec ce compte Google.")
        _render_ga4_reconnect_button(session)
        return

    labels = {f"{p['name']} — {p['account']} ({p['id'].split('/')[-1]})": p["id"] for p in props}
    chosen = st.selectbox("Propriété Google Analytics 4", options=list(labels.keys()), key="ga4_select_prop")
    if st.button("Connecter cette propriété", type="primary", key="btn_ga4_confirm"):
        try:
            update_ga4_property_id(client, user_id, labels[chosen])
            st.success("Propriété GA4 connectée ✓ — récupère tes données ci-dessus.")
            st.rerun()
        except Exception as e:
            st.error(
                f"Sauvegarde échouée : {e}\n\n"
                "Si l'erreur mentionne une colonne manquante, exécute la migration "
                "`supabase/migrations/000_run_me_all.sql` puis réessaie."
            )

    st.divider()
    _render_google_full_signout(client, user_id, key_suffix="ga4pick")


def _render_google_full_signout(client, user_id, key_suffix="") -> None:
    """Déconnexion Google globale (Ads + Analytics) — efface le token partagé.
    À distinguer des déconnexions par service (qui ne touchent que customer_id / property_id).
    """
    if st.button("Se déconnecter de Google (Ads + Analytics)", key=f"btn_g_signout_{key_suffix}", type="secondary"):
        # Supprime la ligne de connexion Google (token partagé Ads + Analytics).
        client.table("connected_accounts").delete().eq("user_id", user_id).eq("provider", "google").execute()
        st.rerun()
    st.caption("Supprime l'autorisation Google partagée. Tu devras la réautoriser pour Ads comme pour Analytics.")


def _render_ga4_reconnect_button(session) -> None:
    """Bouton pour relancer l'OAuth Google (inclut désormais le scope Analytics).
    Force re-consent → nouveau refresh_token avec analytics.readonly.
    """
    from google_script.fetch_token import get_oauth_url as g_oauth_url
    st.session_state["_pending_google_oauth"] = True
    st.link_button(
        "🔗 Reconnecter Google (autoriser Analytics)",
        g_oauth_url(state=session.refresh_token),
        type="primary",
    )
    st.caption(
        "Sur l'écran Google, coche bien l'accès **« Voir tes données Google Analytics »**. "
        "Si cette case n'apparaît pas, c'est que le scope n'est pas encore ajouté côté Google Cloud (voir ci-dessus)."
    )


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
