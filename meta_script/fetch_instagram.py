import streamlit as st
import requests
from supabase import Client
import pandas as pd

from scripts.fetch_data import fetch_post_metrics

class OrganicInstagramm():

    def __init__(self, meta_long_token, supabase_client, supabase_user_id) -> None:
        self.meta_long_token = meta_long_token
        self.meta_account_id = None
        self.api_version = "v24.0"
        self.meta_id_business = None
        self.supabase_client: Client = supabase_client
        self.supabase_user_id = supabase_user_id
        self.new_post_ids: list = []
        self.new_results: list = []
        self.total_posts: int = 0
        self.followers: int = 0

    def _fetch_id_instagram(self):
        target_url = f"https://graph.facebook.com/{self.api_version}/me/accounts"
        params = {
            "access_token": self.meta_long_token
        }
        r = requests.get(url=target_url, params=params)
        data = r.json()
        self.meta_account_name = data.get("data")[0].get("name")
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
        target_url = f"https://graph.facebook.com/{self.api_version}/{self.meta_id_business}/media"
        params = {
            "fields": "id,timestamp",
            "access_token": self.meta_long_token
        }

        r = requests.get(url=target_url, params=params)
        list_id = []
        data = r.json()

        list_id.extend(data.get("data", []))
        next_url = data.get("paging", {}).get("next")
        with st.spinner("Chargement des posts..."):
            while next_url:
                r = requests.get(url=next_url)
                paging_data = r.json()
                list_id.extend(paging_data.get("data", []))
                next_url = paging_data.get("paging", {}).get("next")

        df = pd.DataFrame(list_id).sort_values(by="timestamp", ascending=False)
        self.total_posts = len(df)
        all_post_ids = df["id"][:50].tolist()

        existing_rows = self.supabase_client.table("instagram_organic_posts").select("post_id").eq("user_id", self.supabase_user_id).execute().data
        existing_ids = {row["post_id"] for row in existing_rows}
        # Toujours re-fetch les 5 derniers posts (métriques qui évoluent)
        always_refresh = set(all_post_ids[:5])
        self.new_post_ids = [pid for pid in all_post_ids if pid not in existing_ids or pid in always_refresh]

    def _fetch_post_info(self, post_id: str) -> dict:
        target_url = f"https://graph.facebook.com/{self.api_version}/{post_id}"
        params = {
            "fields": "caption,media_type,media_url,thumbnail_url,timestamp",
            "access_token": self.meta_long_token
        }
        r = requests.get(url=target_url, params=params)
        return r.json()

    def _fetch_post_metrics(self, post_id: str, media_type: str) -> dict:
        target_url = f"https://graph.facebook.com/{self.api_version}/{post_id}/insights"

        if media_type in ("VIDEO", "REEL"):
            metric_list = "reach,saved,comments,views"
        else:
            metric_list = "likes,comments,saved,reach,views"

        params = {
            "metric": metric_list,
            "access_token": self.meta_long_token
        }
        r = requests.get(url=target_url, params=params)
        data = r.json().get("data", [])
        metrics = {}
        for item in data:
            val = item.get("value")
            if val is None:
                val = item.get("values", [{}])[0].get("value", 0)
            metrics[item["name"]] = val or 0

        try:
            r2 = requests.get(url=target_url, params={**params, "metric": "follows"})
            follows_data = r2.json().get("data", [])
            if follows_data:
                fd = follows_data[0]
                metrics["follows"] = fd.get("value") or fd.get("values", [{}])[0].get("value", 0)
            else:
                metrics["follows"] = 0
        except Exception:
            metrics["follows"] = 0

        return metrics

    def _fetch_account_followers(self) -> int:
        target_url = f"https://graph.facebook.com/{self.api_version}/{self.meta_id_business}"
        params = {
            "fields": "followers_count",
            "access_token": self.meta_long_token
        }
        r = requests.get(url=target_url, params=params)
        return r.json().get("followers_count", 0)

    def fetch_insta_post_insight(self):
        with st.status("Récupération des données Instagram...", expanded=True) as status:
            st.write("Connexion au compte Facebook...")
            self._fetch_id_instagram()
            self._fetch_id_business()

            st.write("Récupération des posts...")
            self._fetch_insta_post_id()

            st.write("Récupération des followers...")
            self.followers = self._fetch_account_followers()

            total = len(self.new_post_ids)
            if total > 0:
                results = []
                progress = st.progress(0, text=f"0 / {total} nouveaux posts chargés")
                for i, post_id in enumerate(self.new_post_ids):
                    info = self._fetch_post_info(post_id)
                    media_type = info.get("media_type", "IMAGE")
                    metrics = self._fetch_post_metrics(post_id, media_type)
                    results.append({
                        "post_id": post_id,
                        "type": info.get("media_type"),
                        "caption": info.get("caption", "")[:80],
                        "date": info.get("timestamp", "")[:10],
                        "media_url": info.get("thumbnail_url") or info.get("media_url"),
                        "follows": metrics.get("follows", 0),
                        "likes": metrics.get("likes", 0),
                        "comments": metrics.get("comments", 0),
                        "saved": metrics.get("saved", 0),
                        "views": metrics.get("views", 0),
                        "reach": metrics.get("reach", 0),
                        "user_id": self.supabase_user_id
                    })
                    progress.progress((i + 1) / total, text=f"{i + 1} / {total} nouveaux posts chargés")
                self.new_results = results
            else:
                st.write("Aucun nouveau post à charger.")

            status.update(label=f"✅ Terminé — {self.total_posts} posts au total", state="complete", expanded=False)

    def show_insta_data(self):
        self.fetch_insta_post_insight()

        old_results = fetch_post_metrics(self.supabase_client)
        df_old = pd.DataFrame(old_results) if old_results else pd.DataFrame()
        df_new = pd.DataFrame(self.new_results) if self.new_results else pd.DataFrame()

        df = pd.concat([df_new, df_old], ignore_index=True).drop_duplicates(subset="post_id")

        st.metric("Followers", self.followers)
        st.caption(f"50 posts affichés sur {self.total_posts} au total")
        st.session_state["results"] = df.to_dict("records")
        st.dataframe(df)


if __name__ == "__main__":
    pass
