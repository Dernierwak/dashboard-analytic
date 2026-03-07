import streamlit as st
import requests
from supabase import Client
import pandas as pd


class OrganicInstagramm():
    
    def __init__(self, meta_long_token, supabase_client, supabase_user_id) -> None:
        self.meta_long_token = meta_long_token
        self.meta_account_id = None
        self.api_version = "v24.0"
        self.meta_id_business = None
        self.supabase_client:Client = supabase_client
        self.supabase_user_id = supabase_user_id
        self.posts_insta_id:list = []

    
    def _fetch_id_instagram(self):
        target_url = f"https://graph.facebook.com/{self.api_version}/me/accounts"
        parmas = {
            "access_token": self.meta_long_token
        }
        
        r = requests.get(url=target_url, params=parmas)
        data = r.json()
        #meta_acount_name = data.get("data")[0].get("name")
        self.meta_account_id = data.get("data")[0].get("id")
    
    def _fetch_id_business(self):
        target_url = f"https://graph.facebook.com/{self.api_version}/{self.meta_account_id}"
        params = {
            "fields": "instagram_business_account",
            "access_token": self.meta_long_token
        }
        r = requests.get(url=target_url, params=params)
        data = r.json()
        self.meta_id_business = data.get("instagram_business_account").get("id")
        
    
    def _fetch_insta_post_id(self):
        # Check si already id_post on supabase
        is_paid = self.supabase_client.table("profiles").select("is_paid").eq("id", self.supabase_user_id).execute().data[0].get("is_paid")                                                                                                                                            
        existing_posts = self.supabase_client.table("free_data").select("id_post_insta").eq("user_id", self.supabase_user_id).execute().data                                                                                                                                                    

        if is_paid == False and len(existing_posts) >= 10:
            st.subheader("Your are in free versions max 10 post")
            self.posts_insta_id = [id.get("id_post_insta") for id in existing_posts]
            return existing_posts
        else:
            # else take 10 id_post insta and add to supabase
            target_url = f"https://graph.facebook.com/{self.api_version}/{self.meta_id_business}/media"
            params = {
                "fields": "id,timestamp",
                "access_token": self.meta_long_token
            }
            
            r = requests.get(url=target_url, params=params)            
            list_id = []
            data = r.json()
            list_id.extend(data.get("data"))
            next_url = data.get("paging", {}).get("next", {})
            stop = 0
            with st.spinner("Chargement des posts..."):
                while next_url:
                    r = requests.get(url=next_url)
                    paging_data = r.json()
                    list_id.extend(paging_data.get("data"))
                    next_url = paging_data.get("paging", {}).get("next", {})
                    if stop >= 2:
                        break
                    stop += 1
        
            df = pd.DataFrame(list_id)
            max_post = 10 - len(existing_posts)
            df = df.sort_values(by="timestamp", ascending=False).iloc[0:max_post]
            news_posts_insta_id = df["id"]
            rows = [
                {
                    "id_post_insta": post,
                    "user_id":self.supabase_user_id

                } for post in news_posts_insta_id
            ]
            
            self.supabase_client.table("free_data").upsert(rows).execute()
            self.posts_insta_id = news_posts_insta_id.to_list()
            return news_posts_insta_id
    
    def _fetch_post_info(self, post_id: str) -> dict:
        # Appel API pour avoir les infos d'un post spécifique
        # "fields" indique quelles données on veut :
        #   - caption    : texte/description du post
        #   - media_type : IMAGE, VIDEO ou CAROUSEL_ALBUM
        #   - media_url  : lien direct vers l'image/vidéo
        #   - timestamp  : date de publication
        target_url = f"https://graph.facebook.com/{self.api_version}/{post_id}"
        params = {
            "fields": "caption,media_type,media_url,timestamp",
            "access_token": self.meta_long_token
        }
        r = requests.get(url=target_url, params=params)
        return r.json()

    def _fetch_post_metrics(self, post_id: str) -> dict:
        # Appel API /insights pour les métriques d'engagement d'un post
        # Retourne un dict {"likes": 10, "comments": 2, "saved": 5, "reach": 300}
        target_url = f"https://graph.facebook.com/{self.api_version}/{post_id}/insights"
        params = {
            "metric": "likes,comments,saved,reach",
            "access_token": self.meta_long_token
        }
        r = requests.get(url=target_url, params=params)
        data = r.json().get("data", [])
        # data est une liste : [{"name": "likes", "values": [{"value": 10}]}, ...]
        # On transforme en dict simple : {"likes": 10, ...}
        metrics = {}
        for item in data:
            metrics[item["name"]] = item.get("values", [{}])[0].get("value", 0)
        return metrics

    def _fetch_account_followers(self) -> int:
        # Appel API pour avoir le nombre de followers du compte Instagram Business
        target_url = f"https://graph.facebook.com/{self.api_version}/{self.meta_id_business}"
        params = {
            "fields": "followers_count",
            "access_token": self.meta_long_token
        }
        r = requests.get(url=target_url, params=params)
        return r.json().get("followers_count", 0)

    def fetch_insta_post_insight(self):
        # Étape 1 : récupérer les IDs nécessaires (page Facebook → compte Instagram Business)
        self._fetch_id_instagram()
        self._fetch_id_business()
        # Étape 2 : récupérer les IDs des posts (depuis Supabase ou API)
        self._fetch_insta_post_id()

        # Étape 3 : afficher le nombre de followers du compte
        followers = self._fetch_account_followers()
        st.metric("Followers", followers)

        # Étape 4 : pour chaque post, récupérer infos + métriques
        results = []
        with st.spinner("Chargement des métriques..."):
            for post_id in self.posts_insta_id:
                info = self._fetch_post_info(post_id)      # caption, type, image, date
                metrics = self._fetch_post_metrics(post_id) # likes, comments, saved, reach
                # On assemble tout dans un dict et on l'ajoute à la liste
                results.append({
                    "post_id": post_id,
                    "type": info.get("media_type"),
                    "caption": info.get("caption", "")[:80],  # tronqué à 80 chars
                    "date": info.get("timestamp", "")[:10],   # seulement YYYY-MM-DD
                    "media_url": info.get("media_url"),
                    "likes": metrics.get("likes", 0),
                    "comments": metrics.get("comments", 0),
                    "saved": metrics.get("saved", 0),
                    "reach": metrics.get("reach", 0),
                    "user_id": self.supabase_user_id
                })

        # Étape 5 : convertir en DataFrame et afficher
        df = pd.DataFrame(results)
        st.dataframe(df)
        st.session_state["results"] = results

if __name__ == "__main__":
    pass