import streamlit as st
import requests
import stripe

from meta_script.fetch_token import exchange_code_for_token, get_long_lives_token
from meta_script.fetch_instagram import OrganicInstagramm
from scripts.posthog_client import posthog_client


def _is_google_callback() -> bool:
    """Détecte un callback Google via les params qu'IL renvoie.
    Google inclut toujours 'scope' avec 'googleapis.com' et peut inclure 'authuser'.
    Plus robuste qu'un flag session_state qui se perd quand le WebSocket se ferme.
    """
    if "code" not in st.query_params:
        return False
    scope = str(st.query_params.get("scope", ""))
    if "googleapis.com" in scope or "adwords" in scope.lower():
        return True
    # authuser est un paramètre spécifique à Google OAuth
    if "authuser" in st.query_params:
        return True
    if st.session_state.get("_pending_google_oauth"):
        return True
    return False


def _save_google_token(client, user_id, refresh_token, customer_id=None) -> bool:
    """Sauvegarde le token Google SANS jamais le perdre en cas d'échec.

    Le code OAuth est à usage unique : si l'écriture Supabase échoue (ex. la
    migration connected_accounts n'est pas passée), on garde le refresh_token
    en session pour retenter, et on affiche la cause — sinon l'utilisateur
    devrait re-consentir sur Google sans comprendre pourquoi.
    """
    from scripts.insert_data import update_google_refresh_token
    try:
        update_google_refresh_token(client, user_id, refresh_token, customer_id=customer_id)
        st.session_state.pop("_google_unsaved_refresh_token", None)
        return True
    except Exception as e:
        st.session_state["_google_unsaved_refresh_token"] = refresh_token
        st.error(
            f"Connexion Google réussie, mais la sauvegarde a échoué : {e}\n\n"
            "Cause la plus probable : la migration `supabase/migrations/000_run_me_all.sql` "
            "n'a pas été exécutée (colonnes Google manquantes dans `connected_accounts`). "
            "Exécute-la puis reviens sur Paramètres — ta connexion sera retentée sans re-consentir."
        )
        return False


def handle_google_oauth_callback(client, user_id):
    """Récupère le code OAuth Google, échange contre refresh_token, sauvegarde."""
    # Retente une sauvegarde échouée (token gardé en session — pas de re-consent)
    if "_google_unsaved_refresh_token" in st.session_state and client and user_id:
        _save_google_token(client, user_id, st.session_state["_google_unsaved_refresh_token"])

    if not _is_google_callback():
        return

    code = st.query_params["code"]
    from google_script.fetch_token import exchange_code as gad_exchange
    from google_script.fetch_token import get_access_token_from_refresh
    from google_script.fetch_google_ads import list_accessible_customers

    with st.spinner("Connexion Google Ads…"):
        data = gad_exchange(code)
    if "refresh_token" not in data:
        st.error(f"Erreur Google : {data.get('error_description') or data}")
        st.session_state.pop("_pending_google_oauth", None)
        # Nettoie l'URL des params Google
        st.query_params.clear()
        if "session" in st.session_state:
            st.query_params["refresh_token"] = st.session_state["session"].refresh_token
        return

    refresh_token = data["refresh_token"]

    # Liste les customer_ids accessibles
    access = get_access_token_from_refresh(refresh_token)
    if not access:
        st.error("Impossible d'obtenir un access_token depuis le refresh_token.")
        _save_google_token(client, user_id, refresh_token, customer_id=None)
        st.session_state.pop("_pending_google_oauth", None)
        st.query_params.clear()
        if "session" in st.session_state:
            st.query_params["refresh_token"] = st.session_state["session"].refresh_token
        return

    customer_ids, list_err = list_accessible_customers(access)

    if list_err:
        st.error(f"Google Ads API : {list_err}")
        st.info(
            "Causes fréquentes :\n"
            "- Developer Token absent ou invalide (vérifie `[google_ads].developer_token` dans secrets.toml)\n"
            "- Developer Token en **Basic Access** (test) → ne peut accéder qu'aux test accounts\n"
            "- Le compte Google utilisé pour l'OAuth n'a aucun Google Ads associé"
        )
        _save_google_token(client, user_id, refresh_token, customer_id=None)
        st.session_state.pop("_pending_google_oauth", None)
        # On nettoie l'URL mais SANS rerun (pour que l'erreur reste visible)
        st.query_params.clear()
        if "session" in st.session_state:
            st.query_params["refresh_token"] = st.session_state["session"].refresh_token
        return

    if not customer_ids:
        st.warning(
            "Aucun compte Google Ads accessible avec ce login. "
            "Vérifie que le compte Google que tu utilises a bien accès à un compte Google Ads."
        )
        _save_google_token(client, user_id, refresh_token, customer_id=None)
        st.session_state.pop("_pending_google_oauth", None)
        st.query_params.clear()
        if "session" in st.session_state:
            st.query_params["refresh_token"] = st.session_state["session"].refresh_token
        st.rerun()
        return

    # Si un seul compte accessible → sélection automatique, pas de selectbox
    if len(customer_ids) == 1:
        _save_google_token(client, user_id, refresh_token, customer_id=customer_ids[0])
        posthog_client.capture(
            distinct_id=user_id,
            event="google_ads_connected",
            properties={"customer_count": 1, "selection_method": "auto"},
        )
        st.session_state["_auto_fetch_google_after_oauth"] = True
        st.session_state.pop("_pending_google_oauth", None)
        st.query_params.clear()
        if "session" in st.session_state:
            st.query_params["refresh_token"] = st.session_state["session"].refresh_token
        st.rerun()
        return

    # Plusieurs comptes → laisser l'utilisateur choisir
    st.session_state["_google_pending_refresh_token"] = refresh_token
    st.session_state["_google_customer_options"] = customer_ids
    st.session_state.pop("_pending_google_oauth", None)
    st.query_params.clear()
    if "session" in st.session_state:
        st.query_params["refresh_token"] = st.session_state["session"].refresh_token
    st.rerun()


def handle_google_customer_selection(client, user_id):
    """Affiche un selectbox pour choisir le customer_id Google Ads + sauvegarde."""
    if "_google_pending_refresh_token" not in st.session_state:
        return False
    if "_google_customer_options" not in st.session_state:
        return False

    refresh_token = st.session_state["_google_pending_refresh_token"]
    options = st.session_state["_google_customer_options"]

    st.info("Choisis le compte Google Ads à connecter au dashboard.")
    selected = st.selectbox("Compte Google Ads", options=options, key="gad_select_customer")
    if st.button("Confirmer la connexion", type="primary", key="btn_gad_confirm"):
        if _save_google_token(client, user_id, refresh_token, customer_id=selected):
            posthog_client.capture(
                distinct_id=user_id,
                event="google_ads_connected",
                properties={
                    "customer_count": len(options),
                    "selection_method": "manual",
                },
            )
            del st.session_state["_google_pending_refresh_token"]
            del st.session_state["_google_customer_options"]
            st.session_state["_auto_fetch_google_after_oauth"] = True
            st.success(f"Compte Google Ads {selected} connecté ✓")
            st.rerun()
        # échec : _save_google_token a déjà affiché la cause et gardé le token
    st.stop()
    return True


def handle_meta_oauth_callback():
    """Échange le code OAuth Meta contre un long-lived token."""
    # ⚠ Skip si c'est un callback Google (détecté via scope=adwords ou iss=accounts.google.com)
    if _is_google_callback():
        return
    # Skip aussi si une sélection customer Google est en attente
    if "_google_pending_refresh_token" in st.session_state:
        return
    if "code" in st.query_params and "session" in st.session_state:
        code = st.query_params["code"]
        with st.spinner("Connexion Meta..."):
            data = exchange_code_for_token(code)
        if "access_token" in data:
            try:
                long_token = get_long_lives_token(data["access_token"])
            except Exception as e:
                st.error(
                    f"Connexion Meta OK, mais l'échange long-lived token a échoué : {e}\n\n"
                    "Si tu fais tester par quelqu'un : vérifie qu'il est déclaré comme "
                    "**testeur** de l'app Meta (App Dashboard → Rôles) tant qu'elle est en mode développement."
                )
                del st.query_params["code"]
                return
            st.session_state["meta_long_token"] = long_token
            st.session_state["_save_meta_token"] = True
            session = st.session_state["session"]
            posthog_client.capture(
                distinct_id=session.user.id,
                event="meta_connected",
                properties={"token_type": "long_lived"},
            )
            st.query_params.clear()
            st.query_params["refresh_token"] = session.refresh_token
            st.rerun()
        else:
            st.error(f"Erreur Meta : {data}")
            del st.query_params["code"]


def handle_meta_page_selection(client, user_id):
    """Affiche la sélection de page Facebook et connecte le compte Instagram."""
    if not st.session_state.get("_save_meta_token"):
        return False

    token = st.session_state["meta_long_token"]

    if "fb_pages_list" not in st.session_state:
        try:
            r = requests.get(
                "https://graph.facebook.com/v24.0/me/accounts",
                params={"fields": "id,name", "access_token": token}
            )
            pages_found = r.json().get("data", [])

            # Fallback Business Manager si me/accounts retourne vide
            if not pages_found:
                biz_r = requests.get(
                    "https://graph.facebook.com/v24.0/me/businesses",
                    params={"fields": "id,name", "access_token": token}
                )
                businesses = biz_r.json().get("data", [])
                for biz in businesses:
                    for endpoint in ["owned_pages", "client_pages"]:
                        p_r = requests.get(
                            f"https://graph.facebook.com/v24.0/{biz['id']}/{endpoint}",
                            params={"fields": "id,name", "access_token": token}
                        )
                        pages_found.extend(p_r.json().get("data", []))

            seen = set()
            unique_pages = []
            for p in pages_found:
                if p["id"] not in seen:
                    seen.add(p["id"])
                    unique_pages.append(p)

            st.session_state["fb_pages_list"] = unique_pages
        except Exception:
            st.session_state["fb_pages_list"] = []

    pages = st.session_state.get("fb_pages_list", [])

    if not pages:
        st.error(
            "Aucune Page Facebook trouvée. Vérifie que : "
            "(1) ton compte Instagram Business est bien lié à une Page Facebook, "
            "(2) tu es admin direct de cette Page (pas seulement via Business Manager)."
        )
        del st.session_state["_save_meta_token"]
        return False

    st.info("Choisis la Page Facebook liée à ton compte Instagram Business.")
    page_names = {p["name"]: p["id"] for p in pages}
    selected_name = st.selectbox("Page Facebook", options=list(page_names.keys()), key="connect_fb_page")
    if st.button("Confirmer la connexion", type="primary", key="btn_confirm_page"):
        st.session_state["selected_fb_page_id"] = page_names[selected_name]
        try:
            org = OrganicInstagramm(
                meta_long_token=token,
                supabase_client=client,
                supabase_user_id=user_id,
            )
            org._fetch_id_instagram()
            org._fetch_id_business()
            existing = client.table("connected_accounts").select("id").eq("user_id", user_id).eq("instagram_business_id", org.meta_id_business).execute()
            if existing.data:
                new_account_id = existing.data[0]["id"]
                client.table("connected_accounts").update({
                    "meta_token": token,
                    "account_name": org.meta_account_name,
                }).eq("id", new_account_id).execute()
            else:
                acc = client.table("connected_accounts").insert({
                    "user_id": user_id,
                    "meta_token": token,
                    "account_name": org.meta_account_name,
                    "instagram_business_id": org.meta_id_business,
                }).execute()
                new_account_id = acc.data[0]["id"]
            client.table("profiles").update({"active_account_id": new_account_id}).eq("id", user_id).execute()
            del st.session_state["_save_meta_token"]
            st.session_state.pop("fb_pages_list", None)
            posthog_client.capture(
                distinct_id=user_id,
                event="instagram_account_connected",
                properties={"account_name": org.meta_account_name},
            )
            # Déclenche l'auto-fetch Meta Ads + Instagram au prochain run (géré dans pages/main.py)
            st.session_state["_auto_fetch_after_oauth"] = True
            st.success(f"Compte '{org.meta_account_name}' connecté !")
            st.rerun()
        except Exception as e:
            st.error(f"Erreur connexion Meta : {e}")
    st.stop()
    return True


def handle_stripe_payment(client, user_id, session):
    """Vérifie le retour Stripe et met à jour is_paid."""
    if st.query_params.get("payment") == "success" and "session_id" in st.query_params:
        session_id = st.query_params["session_id"]
        stripe.api_key = st.secrets.stripe.api_key
        is_paid = False
        try:
            s = stripe.checkout.Session.retrieve(session_id)
            if s.payment_status == "paid":
                client.table("profiles").update({"is_paid": True}).eq("id", user_id).execute()
                is_paid = True
                posthog_client.capture(
                    distinct_id=user_id,
                    event="payment_confirmed",
                    properties={"plan": "pro", "currency": "chf"},
                )
                if "checkout_url" in st.session_state:
                    del st.session_state["checkout_url"]
                st.success("Paiement confirmé ! Bienvenue dans le plan Pro.")
            else:
                st.warning(f"Statut paiement : {s.payment_status}. Contactez le support.")
        except Exception as e:
            st.error(f"Erreur vérification Stripe : {type(e).__name__}: {e}")
        st.query_params.clear()
        st.query_params["refresh_token"] = session.refresh_token
        return is_paid
    elif st.query_params.get("payment") == "cancelled":
        st.info("Paiement annulé.")
        st.query_params.clear()
        st.query_params["refresh_token"] = session.refresh_token
    return None
