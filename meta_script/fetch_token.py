import requests
import streamlit as st

app_id = st.secrets.meta.app_id
secret_key = st.secrets.meta.secret_key
redirect_uri = "https://dashboard-analytic-pbkubxa4pkfyh4reribugw.streamlit.app/"
api_version = "v24.0"
def get_oauth_url():
    """Construit l'URL OAuth Meta"""
    return (
        f"https://www.facebook.com/{api_version}/dialog/oauth"
        f"?client_id={app_id}"
        f"&redirect_uri={redirect_uri}"
        f"&scope=ads_management"
    )


def exchange_code_for_token(code):
    """Échange le code OAuth contre un access_token"""
    response = requests.get(f"https://graph.facebook.com/{api_version}/oauth/access_token", params={
        "client_id": app_id,
        "client_secret": secret_key,
        "redirect_uri": redirect_uri,
        "code": code
    })
    return response.json()


def get_long_lives_token(short_token):
    target_url = f"https://graph.facebook.com/{api_version}/oauth/access_token"
    params = {
        "grant_type": "fb_exchange_token",
        "client_id": app_id,
        "client_secret": secret_key,
        "fb_exchange_token": short_token
        
    }    
    r = requests.get(url=target_url, params=params)
    data = r.json()
    return data["access_token"]
   
 

if __name__ == "__main__":
    st.title("Meta OAuth")

    # Si on a déjà un token
    if "meta_token" in st.session_state:
        st.success(f"Connecté! Token: `{st.session_state['meta_token'][:30]}...`")
        get_long_lives_token(st.session_state["meta_token"])
        if st.button("Déconnecter Meta"):
            del st.session_state["meta_token"]
            st.rerun()
    else:
        # Vérifier si on revient de Meta avec un code
        if "code" in st.query_params:
            code = st.query_params["code"]
            with st.spinner("Échange du code..."):
                data = exchange_code_for_token(code)
            if "access_token" in data:
                st.session_state["meta_token"] = data["access_token"]
                del st.query_params["code"]
                st.success("Connecté!")
                st.rerun()
            else:
                st.error(f"Erreur: {data}")
                del st.query_params["code"]
        else:
            st.link_button("Connecter Meta", get_oauth_url())