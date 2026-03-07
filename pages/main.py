from supabase import Client, ClientOptions
import streamlit as st
import pandas as pd
import plotly.express as px

from scripts.fetch_data import fetch_post_metrics
from scripts.insert_data import insert_instagramm_org
from scripts.stripe import create_checkout_session, verify_and_get_metadata

from meta_script.fetch_token import get_oauth_url, exchange_code_for_token, get_long_lives_token
from meta_script.fetch_instagram import OrganicInstagramm


##############################
# Classe principale : auth Supabase
##############################
class Dashboard():

    def __init__(self):
        self.url = st.secrets.supabase.url
        self.token = st.secrets.supabase.key
        self.supabase = Client(self.url, self.token)
        self.client = None

    def _create_account(self, email, password):
        try:
            user = self.supabase.auth.sign_up({"email": email, "password": password})
            if user.session:
                st.session_state["session"] = user.session
                st.query_params["refresh_token"] = user.session.refresh_token
                st.rerun()
            else:
                st.session_state["email_confirmation_pending"] = email
        except Exception as e:
            st.error(f"Erreur lors de la création du compte : {e}")

    def _login(self, email, password):
        try:
            user = self.supabase.auth.sign_in_with_password({"email": email, "password": password})
            if user.session:
                st.session_state["session"] = user.session
                st.query_params["refresh_token"] = user.session.refresh_token
                st.rerun()
        except Exception as e:
            if "email not confirmed" in str(e).lower():
                st.session_state["email_confirmation_pending"] = email
            else:
                st.error("Identifiants incorrects.")

    def _auth_page(self):
        _, col, _ = st.columns([1, 2, 1])
        with col:
            if "email_confirmation_pending" in st.session_state:
                email = st.session_state["email_confirmation_pending"]
                st.info(f"Un email de confirmation a été envoyé à **{email}**. Cliquez sur le lien dans votre boîte mail, puis revenez vous connecter.")
                if st.button("J'ai confirmé mon email", use_container_width=True):
                    del st.session_state["email_confirmation_pending"]
                    st.rerun()
                return

            email = st.text_input("Email")
            password = st.text_input("Mot de passe", type="password")
            col_a, col_b = st.columns(2)
            with col_a:
                if st.button("Créer un compte", use_container_width=True):
                    self._create_account(email, password)
            with col_b:
                if st.button("Se connecter", use_container_width=True, type="primary"):
                    self._login(email, password)

    def main(self):
        # Restaurer la session depuis le refresh_token dans l'URL
        if "session" not in st.session_state and "refresh_token" in st.query_params:
            try:
                user = self.supabase.auth.refresh_session(refresh_token=st.query_params["refresh_token"])
                st.session_state["session"] = user.session
            except Exception:
                del st.query_params["refresh_token"]

        if "session" in st.session_state:
            session = st.session_state["session"]
            self.client = Client(
                self.url, self.token,
                options=ClientOptions(headers={"Authorization": f"Bearer {session.access_token}"})
            )
        else:
            self._auth_page()


##############################
# Sidebar
##############################
def show_sidebar(client, session, is_paid):
    with st.sidebar:
        st.markdown(f"**{session.user.email}**")
        st.caption(f"Plan : {'Pro' if is_paid else 'Gratuit — 10 posts max'}")

        if not is_paid:
            st.divider()
            st.markdown("**Passez au Pro**")
            st.caption("Tous vos posts, historique illimité.")

            if "checkout_url" not in st.session_state:
                if st.button("Souscrire — 35 CHF/mois", type="primary", use_container_width=True):
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
                               use_container_width=True, type="primary")
                if st.button("Annuler", use_container_width=True):
                    del st.session_state["checkout_url"]
                    st.rerun()

        st.divider()
        if "meta_long_token" in st.session_state:
            st.success("Meta connecté")
            if st.button("Déconnecter Meta"):
                client.table("profiles").update({"meta_token": None}).eq("id", session.user.id).execute()
                del st.session_state["meta_long_token"]
                st.rerun()
        else:
            st.info("Meta non connecté")
            st.link_button("Connecter Meta", get_oauth_url())

        st.divider()
        if st.button("Se déconnecter"):
            del st.session_state["session"]
            if "refresh_token" in st.query_params:
                del st.query_params["refresh_token"]
            st.rerun()


##############################
# Dashboard : graphiques depuis post_metrics
##############################
def show_dashboard(client, user_id):
    response = fetch_post_metrics(client, user_id)
    data = response.data if response else []

    if not data:
        st.info("Aucune donnée. Cliquez sur **Récupérer mes données Instagram** pour commencer.")
        return

    df = pd.DataFrame(data)

    # ---- KPI cards ----
    total_likes = int(df["likes"].sum())
    total_reach = int(df["reach"].sum())
    total_comments = int(df["comments"].sum())
    engagement = (
        round((total_likes + total_comments) / total_reach * 100, 2)
        if total_reach > 0 else 0
    )

    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Total Likes", f"{total_likes:,}")
    col2.metric("Total Reach", f"{total_reach:,}")
    col3.metric("Taux d'engagement", f"{engagement}%")
    col4.metric("Posts analysés", len(df))

    st.divider()

    # ---- Graphiques ----
    COLOR_MAP = {
        "IMAGE": "#191919",
        "VIDEO": "#0066ff",
        "CAROUSEL_ALBUM": "#6b7280",
    }

    col_c1, col_c2 = st.columns(2)

    with col_c1:
        st.markdown("**Likes par post**")
        fig_likes = px.bar(
            df.sort_values("likes", ascending=False),
            x="date", y="likes", color="type",
            color_discrete_map=COLOR_MAP,
            labels={"date": "Date", "likes": "Likes", "type": "Type"},
        )
        fig_likes.update_layout(
            height=300, margin=dict(l=0, r=0, t=10, b=0),
            paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
            legend=dict(orientation="h", y=1.1),
        )
        st.plotly_chart(fig_likes, use_container_width=True)

    with col_c2:
        st.markdown("**Reach par post**")
        fig_reach = px.bar(
            df.sort_values("reach", ascending=False),
            x="date", y="reach", color="type",
            color_discrete_map=COLOR_MAP,
            labels={"date": "Date", "reach": "Reach", "type": "Type"},
        )
        fig_reach.update_layout(
            height=300, margin=dict(l=0, r=0, t=10, b=0),
            paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
            legend=dict(orientation="h", y=1.1),
        )
        st.plotly_chart(fig_reach, use_container_width=True)

    # ---- Tableau top posts ----
    st.markdown("**Détail des posts**")
    df_display = df[["caption", "type", "date", "likes", "comments", "saved", "reach"]].copy()
    df_display.columns = ["Caption", "Type", "Date", "Likes", "Commentaires", "Sauvegardés", "Reach"]
    st.dataframe(df_display, use_container_width=True, hide_index=True)


##############################
# Point d'entrée
##############################
if __name__ == "__main__":

    st.set_page_config(page_title="Dashboard Analytics", page_icon="📊", layout="wide")

    # ── Étape 1 : Callback OAuth Meta ──────────────────────────────────────
    if "code" in st.query_params and "session" in st.session_state:
        code = st.query_params["code"]
        with st.spinner("Connexion Meta..."):
            data = exchange_code_for_token(code)
        if "access_token" in data:
            long_token = get_long_lives_token(data["access_token"])
            st.session_state["meta_long_token"] = long_token
            st.session_state["_save_meta_token"] = True
            session = st.session_state["session"]
            st.query_params.clear()
            st.query_params["refresh_token"] = session.refresh_token
            st.rerun()
        else:
            st.error(f"Erreur Meta : {data}")
            del st.query_params["code"]

    # ── Étape 2 : Auth + client Supabase ───────────────────────────────────
    dash = Dashboard()
    dash.main()
    client = dash.client  # None si non connecté

    # ── Étape 3 : Contenu authentifié ──────────────────────────────────────
    if client:
        session = st.session_state["session"]
        user_id = session.user.id

        # Upsert profil
        client.table("profiles").upsert({"id": user_id, "email": session.user.email}).execute()

        # Charger le profil (meta_token + is_paid)
        profile_resp = client.table("profiles").select("meta_token, is_paid").eq("id", user_id).execute()
        profile = profile_resp.data[0] if profile_resp.data else {}
        is_paid = profile.get("is_paid", False)

        # Restaurer le token Meta en session si pas déjà présent
        if profile.get("meta_token") and "meta_long_token" not in st.session_state:
            st.session_state["meta_long_token"] = profile["meta_token"]

        # Sauvegarder le long-lived token Meta juste après connexion Meta
        if st.session_state.get("_save_meta_token"):
            client.table("profiles").update({"meta_token": st.session_state["meta_long_token"]}).eq("id", user_id).execute()
            del st.session_state["_save_meta_token"]

        # ── Vérifier un paiement Stripe de retour ──────────────────────────
        if st.query_params.get("payment") == "success" and "session_id" in st.query_params:
            meta = verify_and_get_metadata(st.query_params["session_id"])
            if meta:
                client.table("profiles").update({"is_paid": True}).eq("id", user_id).execute()
                is_paid = True
                if "checkout_url" in st.session_state:
                    del st.session_state["checkout_url"]
                st.success("Paiement confirmé ! Bienvenue dans le plan Pro.")
            else:
                st.warning("Paiement non vérifié. Contactez le support si vous avez payé.")
            st.query_params.clear()
            st.query_params["refresh_token"] = session.refresh_token

        elif st.query_params.get("payment") == "cancelled":
            st.info("Paiement annulé.")
            st.query_params.clear()
            st.query_params["refresh_token"] = session.refresh_token

        # ── Sidebar ────────────────────────────────────────────────────────
        show_sidebar(client, session, is_paid)

        # ── Contenu principal ──────────────────────────────────────────────
        st.title("Dashboard Analytics")

        if "meta_long_token" in st.session_state:
            if st.button("Récupérer mes données Instagram", type="primary"):
                org = OrganicInstagramm(
                    meta_long_token=st.session_state["meta_long_token"],
                    supabase_client=client,
                    supabase_user_id=user_id,
                )
                org.fetch_insta_post_insight()
                if "results" in st.session_state:
                    insert_instagramm_org(supabase=client, results=st.session_state["results"])
                st.rerun()

            show_dashboard(client, user_id)
        else:
            st.info("Connectez votre compte Meta dans la barre latérale pour commencer.")
