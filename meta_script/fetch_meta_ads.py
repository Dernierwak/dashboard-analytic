import streamlit as st
import pandas as pd
from supabase import Client
import requests
from datetime import datetime
import json

selected_account = None
class PaidMeta():
    def __init__(self, token, supabase_client, supabase_user_id) -> None:
        self.token = token
        self.ad_account_id = None
        self.meta_version = "v24.0"
        self.supabase_client: Client = supabase_client
        self.supabase_user_id = supabase_user_id
        self.paid = None
        
    def _fetch_profile(self):
        self.paid = self.supabase_client.table("profiles").select("is_paid").eq("id", self.supabase_user_id).execute().data[0].get("id_paid", False)
        ## avoir jours du fetch
    def _get_ad_accounts(self):
        if self.token:
            url = f"https://graph.facebook.com/{self.meta_version}/me/adaccounts"
            parmams = {
                "fields": "id,name,status,objective",
                "access_token": self.token
                }
            
            response = requests.get(url=url, params=parmams)
            if response:
                data = response.json()

                list_compte = []
                for account in data.get("data"):
                    list_compte.append(account)
                
                selected_account = st.selectbox("Choose Business compte", options=[compte.get("name") for compte in list_compte], index=None)
                if selected_account:
                    selected_id_account = [compte.get("id") for compte in list_compte if compte.get("name") == selected_account]
                    selected_id_account = selected_id_account[0]
                    self.ad_account_id = selected_id_account
                    self.get_campaigns()
                    self.get_ads_insights()
                
                else:
                    st.info("Choose the accout name")

    def get_campaigns(self):
        url = f"https://graph.facebook.com/v24.0/{self.ad_account_id}/campaigns"
        params = {
            "fields": "id,name,status,objective",
            "access_token": self.token
        }
        response = requests.get(url=url, params=params)
        data = response.json()

        df = data.get("data")
        next = data.get("paging", {}).get("next")
        with st.spinner("loading all campaings"):
            while next:
                response = requests.get(next)
                data = response.json()
                df = df + data.get("data", [])
                next = data.get("paging", {}).get("next")

        df = pd.DataFrame(df)
        st.data_editor(df)
        list_ad_id = df["id"].tolist()
        return list_ad_id

    @st.fragment
    def get_ads_insights(self):
        url = f"https://graph.facebook.com/v24.0/{self.ad_account_id}/insights"
        col1, col2 = st.columns(2)
        ## utiliser jours du fetch moins 30 jour pour les free et paid on peut 3 mois ou plus
        with col1:
            since_raw = st.date_input("Start date", value=None, key="ads_since")
        with col2:
            end_raw = st.date_input("End date", value=None, key="ads_end")
        
        if since_raw and end_raw:
            end = end_raw.strftime("%Y-%m-%d")
            since = since_raw.strftime("%Y-%m-%d")
            params = {
                "access_token": self.token,
                "level": "ad",
                "fields": "campaign_name,adset_name,ad_id,ad_name,campaign_id,adset_id,asset_id,impressions",
                "time_range": json.dumps({"since": f"{since}", "until": f"{end}"}),
                "time_increment": 1
            }
            response = requests.get(url=url, params=params)
            result = response.json()

            df = result.get("data")
            next = result.get("paging", {}).get("next")
            with st.spinner("loading insights"):
                while next:
                    response = requests.get(next).json()
                    data = response.get("data")
                    next = response.get("paging", {}).get("next")
                    df = data + df
            
            #df = sorted(df, key=lambda x: x["date_start"])
            st.data_editor(df)



        
## ==== Debug    
token = st.text_input("add Token")
st.session_state["token"] = token
paidmeta = PaidMeta(token)

if st.session_state["token"]:
    paidmeta._get_ad_accounts()