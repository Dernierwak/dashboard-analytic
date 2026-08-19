import streamlit as st
import requests
from supabase import Client
import pandas as pd

from scripts.fetch_data import fetch_post_metrics
from scripts.insert_data import insert_instagram_total_posts_id

# ── QUELS POSTS ON RELIT — une DURÉE, plus un compte ─────────────────────────
#
# La règle était « les 20 derniers posts », et un compte ne se mesure pas en
# posts, il se mesure en jours. Qui publie cinq fois par jour ne faisait relire
# que quatre jours ; qui publie une fois par mois en faisait relire vingt mois,
# pour rien. Or ce qui bouge, c'est le TEMPS : un post continue d'accumuler
# vues, portée et enregistrements pendant des semaines après sa publication.
#
# 30 jours, et il faut être honnête sur ce chiffre : contrairement aux fenêtres
# d'attribution de Meta Ads et Google Ads, AUCUNE doc ne dit au bout de combien
# de temps les métriques d'un post organique se stabilisent — elles sont
# cumulées à vie et ne se stabilisent jamais tout à fait. Ce n'est donc pas un
# nombre lu quelque part, c'est un arbitrage de coût assumé : 30 jours couvrent
# la période où un post bouge assez pour changer une conclusion, et le plafond
# ci-dessous empêche un compte très actif de faire exploser la récolte.
_JOURS_RAFRAICHIS = 30
# Plafond dur sur les posts DÉJÀ en base qu'on relit. Cinq publications par
# jour × 30 jours = 150 posts, soit 450 appels Graph : non. À 40, le pire cas
# est borné et connu.
_POSTS_RAFRAICHIS_MAX = 40
# Plancher, pour le compte qui publie une fois par mois : sans lui, la fenêtre
# de 30 jours ne rendrait qu'un seul post et le reste du mur ne bougerait plus.
_POSTS_RAFRAICHIS_MIN = 6

# Plafond de pages sur l'inventaire des médias. À 100 par page (voir
# `_fetch_insta_post_id`), 60 pages = 6 000 posts : au-delà, ce n'est plus un
# compte de marque, et une boucle sans fin coûterait le passage de TOUS les
# autres utilisateurs. Le chiffre borne aussi le pire cas en temps — 60 requêtes
# à 30 s de délai d'attente, pas l'infini.
_MEDIA_PAGES_MAX = 60

# CE QUE ÇA COÛTE — simulé sur les quatre rythmes de publication, en posts
# relus par passage (un post relu = 3 appels Graph : info, insights, follows) :
#     1 post/jour     20 → 30      1 post/semaine  20 → 6
#     5 posts/jour    20 → 40      1 post/mois     20 → 6
# Deux comptes sur quatre coûtent MOINS cher qu'avant, et le pire cas est
# plafonné. Surtout, l'image ne repart plus dans les deux sens à chaque
# passage (voir `_image_du_post`) : on économise 20 à 40 téléchargements + 20 à
# 40 envois de fichier, qui étaient de très loin la partie la plus lente. La
# fenêtre s'élargit et la récolte accélère.
# Le quota n'entre pas en jeu : Meta autorise « 4800 * Number of Impressions »
# appels par 24 h sur la plateforme Instagram — quelques centaines d'affichages
# suffisent à couvrir mille fois ce qu'on demande.
# https://developers.facebook.com/docs/graph-api/overview/rate-limiting/


def _dans_le_stockage(url: str | None) -> bool:
    """L'image est-elle déjà chez nous ?

    Une URL de CDN Instagram expire au bout de quelques jours — c'est la raison
    d'être de `_upload_image_to_storage`. Une URL de stockage Supabase, elle,
    est définitive. La distinction sert à ne pas refaire le trajet
    téléchargement + envoi pour un fichier qu'on possède déjà, ce qui est de
    loin le poste le plus cher de la récolte Instagram.
    """
    return bool(url) and "/storage/v1/object/public/post-images/" in url


class OrganicInstagramm():

    def __init__(self, meta_long_token, supabase_client, supabase_user_id, instagram_business_id=None) -> None:
        self.meta_long_token = meta_long_token
        self.meta_account_id = None
        self.api_version = "v24.0"
        self.meta_id_business = instagram_business_id
        self.supabase_client: Client = supabase_client
        self.supabase_user_id = supabase_user_id
        self.new_post_ids: list = []
        self.new_results: list = []
        # {post_id: media_url déjà en base} — rempli par `_fetch_insta_post_id`,
        # lu par `_image_du_post` pour ne pas ré-envoyer une image qu'on a déjà.
        self._media_connu: dict = {}
        self.total_posts: int = 0
        self.followers: int = 0

    def _fetch_id_instagram(self):
        target_url = f"https://graph.facebook.com/{self.api_version}/me/accounts"
        params = {"access_token": self.meta_long_token}
        r = requests.get(url=target_url, params=params)
        data = r.json()
        pages = data.get("data", [])
        if not pages:
            raise ValueError("Aucune Page Facebook trouvée. Tu dois avoir une Page Facebook liée à ton compte.")
        selected_id = st.session_state.get("selected_fb_page_id")
        page = next((p for p in pages if p.get("id") == selected_id), pages[0])
        self.meta_account_name = page.get("name")
        self.meta_account_id = page.get("id")

    def _fetch_id_business(self):
        target_url = f"https://graph.facebook.com/{self.api_version}/{self.meta_account_id}"
        params = {
            "fields": "instagram_business_account",
            "access_token": self.meta_long_token
        }
        r = requests.get(url=target_url, params=params)
        data = r.json()
        insta = data.get("instagram_business_account")
        if not insta:
            raise ValueError(f"La Page Facebook '{self.meta_account_name}' n'a pas de compte Instagram Business lié.")
        self.meta_id_business = insta.get("id")

    def _fetch_insta_post_id(self):
        target_url = f"https://graph.facebook.com/{self.api_version}/{self.meta_id_business}/media"
        params = {
            "fields": "id,timestamp",
            "access_token": self.meta_long_token,
            # LE POSTE LE PLUS BAVARD DE LA RÉCOLTE, POUR RIEN.
            # Cette boucle parcourt TOUT l'historique média du compte — il le
            # faut, `total_posts` est un décompte complet — mais elle le faisait
            # SANS `limit`, donc par pages de 25, qui est le défaut du Graph API.
            # Un compte à 500 posts payait 20 allers-retours, un compte à 1 000
            # en payait 40, uniquement pour compter.
            #
            # 100 plutôt que 25 : la taille maximale de page n'est PAS fermement
            # documentée pour cette edge (la référence de la pagination par
            # curseur décrit `limit` comme « the maximum number of objects that
            # may be returned » et prévient explicitement de ne pas déduire la
            # fin d'une page plus courte que demandé). On ne peut donc pas
            # l'essayer sans jeton, et on ne le suppose pas.
            # Ce qui rend le choix SANS RISQUE, c'est la condition d'arrêt : la
            # boucle s'arrête sur l'ABSENCE de `next`, jamais sur un compte de
            # lignes. Si Meta plafonne la page plus bas que 100, on refait
            # simplement plus de pages — exactement le comportement d'avant,
            # aux mêmes données. Le pire cas est « aucun gain », pas « données
            # tronquées ».
            "limit": 100,
        }

        r = requests.get(url=target_url, params=params, timeout=30)
        list_id = []
        data = r.json()
        # UNE ERREUR NE DOIT PLUS PASSER POUR UN COMPTE VIDE. Sans ce contrôle,
        # un jeton expiré rendait `{"error": {...}}` : `data.get("data", [])`
        # valait `[]`, aucun `next`, et la suite plantait sur un `KeyError:
        # 'timestamp'` en construisant le DataFrame — un message qui ne dit rien
        # de la vraie cause. Pire, `total_posts` aurait pu être écrit à 0.
        if isinstance(data, dict) and data.get("error"):
            raise ValueError("Instagram — l'API a refusé la liste des médias : "
                             + str(data["error"].get("message", data["error"])))

        list_id.extend(data.get("data", []))
        next_url = data.get("paging", {}).get("next")
        # Le garde-fou déjà posé sur les activités Meta (voir
        # `_ACTIVITES_PAGES_MAX` dans fetch_meta_ads.py) manquait ici : le Graph
        # API sait rendre un curseur `next` sur une page VIDE, et rien
        # n'empêchait alors la boucle de tourner sans fin sur un seul compte, en
        # mangeant le passage de tous les autres.
        pages = 1
        while next_url and pages < _MEDIA_PAGES_MAX:
            r = requests.get(url=next_url, timeout=30)
            paging_data = r.json()
            lot = paging_data.get("data", []) or []
            if not lot:
                break          # curseur épuisé qui tourne à vide
            list_id.extend(lot)
            pages += 1
            next_url = paging_data.get("paging", {}).get("next")
        if next_url and pages >= _MEDIA_PAGES_MAX:
            # Pas une erreur : ce qui a été lu est bon. Mais ça se dit, sinon
            # `total_posts` est faux sans que rien ne le signale.
            print(f"    médias Instagram : arrêt à {_MEDIA_PAGES_MAX} pages "
                  f"({len(list_id)} posts lus), le total sera sous-estimé.")

        df = pd.DataFrame(list_id).sort_values(by="timestamp", ascending=False)
        self.total_posts = len(df)
        insert_instagram_total_posts_id(supabase=self.supabase_client, user_id=self.supabase_user_id, total_posts_id=self.total_posts)

        is_paid = self.supabase_client.table("profiles").select("is_paid").eq("id", self.supabase_user_id).execute().data[0].get("is_paid", False)
        # 200 en payant : la matrice « tout l'historique » et la labellisation IA
        # ont besoin de profondeur (le backfill se fait en plusieurs fetchs).
        self.limit = 200 if is_paid else 10
        all_post_ids = df["id"][:self.limit].tolist()

        existing_rows = (self.supabase_client.table("instagram_organic_posts")
                         .select("post_id, media_url")
                         .eq("user_id", self.supabase_user_id).execute().data) or []
        existing_ids = {row["post_id"] for row in existing_rows}
        self._media_connu = {r["post_id"]: r.get("media_url") for r in existing_rows}

        # La fenêtre de rafraîchissement, en jours (voir _JOURS_RAFRAICHIS).
        # `errors="coerce"` : un timestamp illisible devient NaT, donc hors
        # fenêtre — il sera quand même repris s'il tombe dans le plancher.
        publie_le = pd.to_datetime(df["timestamp"], utc=True, errors="coerce")
        borne = pd.Timestamp.now(tz="UTC") - pd.Timedelta(days=_JOURS_RAFRAICHIS)
        recents = set(df.loc[publie_le >= borne, "id"])

        # Trois raisons de relire un post DÉJÀ en base, toutes plafonnées
        # ensemble à _POSTS_RAFRAICHIS_MAX : il est récent, il fait partie du
        # plancher, ou son image n'a jamais atteint notre stockage (le lien de
        # CDN qu'on avait gardé va expirer, donc on refait le trajet).
        # Un post ABSENT de la base n'est jamais plafonné : il faut bien aller
        # le chercher une première fois.
        a_reprendre, repris = [], 0
        for rang, pid in enumerate(all_post_ids):
            if pid not in existing_ids:
                a_reprendre.append(pid)
                continue
            if repris >= _POSTS_RAFRAICHIS_MAX:
                continue
            if (pid in recents
                    or rang < _POSTS_RAFRAICHIS_MIN
                    or not _dans_le_stockage(self._media_connu.get(pid))):
                a_reprendre.append(pid)
                repris += 1
        self.new_post_ids = a_reprendre

    def _upload_image_to_storage(self, post_id: str, image_url: str) -> str:
        try:
            r = requests.get(image_url, timeout=10)
            if r.status_code != 200:
                return image_url
            file_path = f"{self.supabase_user_id}/{post_id}.jpg"
            self.supabase_client.storage.from_("post-images").upload(
                path=file_path,
                file=r.content,
                file_options={"content-type": "image/jpeg", "upsert": "true"}
            )
            return self.supabase_client.storage.from_("post-images").get_public_url(file_path)
        except Exception:
            return image_url

    def _image_du_post(self, post_id: str, info: dict) -> str:
        """L'URL d'image à écrire pour ce post — sans refaire le trajet pour rien.

        C'est ce qui rend la fenêtre de 30 jours moins chère que les 20 posts
        d'avant, pas plus chère. Relire un post coûtait jusqu'ici trois appels
        Graph PLUS un téléchargement d'image chez Meta PLUS un envoi de fichier
        chez Supabase, pour réécrire un fichier identique. On ne refait le
        trajet que si l'URL connue n'est pas une URL de stockage — c'est-à-dire
        si l'envoi avait échoué et qu'on a gardé un lien de CDN périssable.
        """
        connue = self._media_connu.get(post_id)
        if _dans_le_stockage(connue):
            return connue
        return self._upload_image_to_storage(
            post_id, info.get("thumbnail_url") or info.get("media_url", ""))

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
        with st.status("Récupération des données Instagram", expanded=True) as status:
            st.write("Connexion à Meta…")
            if not self.meta_id_business:
                self._fetch_id_instagram()
                self._fetch_id_business()

            st.write("Identification des posts…")
            self._fetch_insta_post_id()

            st.write("Lecture du nombre d'abonnés…")
            self.followers = self._fetch_account_followers()

            total = len(self.new_post_ids)
            if total > 0:
                results = []
                progress = st.progress(0, text=f"0 / {total} nouveaux posts")
                for i, post_id in enumerate(self.new_post_ids):
                    info = self._fetch_post_info(post_id)
                    media_type = info.get("media_type", "IMAGE")
                    metrics = self._fetch_post_metrics(post_id, media_type)
                    results.append({
                        "post_id": post_id,
                        "type": info.get("media_type"),
                        "caption": info.get("caption", "")[:500],  # assez pour labelliser par thème
                        "date": info.get("timestamp", ""),  # ISO complet (date + heure + tz)
                        "media_url": self._image_du_post(post_id, info),
                        "follows": metrics.get("follows", 0),
                        "likes": metrics.get("likes", 0),
                        "comments": metrics.get("comments", 0),
                        "saved": metrics.get("saved", 0),
                        "views": metrics.get("views", 0),
                        "reach": metrics.get("reach", 0),
                        "user_id": self.supabase_user_id
                    })
                    progress.progress((i + 1) / total, text=f"{i + 1} / {total} nouveaux posts")
                self.new_results = results
            else:
                st.write("Aucun nouveau post à charger.")

            status.update(
                label=f"Terminé — {self.total_posts} posts au total",
                state="complete",
                expanded=False,
            )

    def fetch_headless(self, note=None) -> list:
        """Version SANS Streamlit pour le worker cron. instagram_business_id requis
        (fourni depuis connected_accounts) → on saute la sélection de Page.
        Remplit self.new_results / self.followers / self.total_posts et les retourne.

        `note(etape)` — facultatif — reçoit l'étape en cours pour que l'écran
        puisse l'afficher. C'est ICI que le chiffre est honnête : `total` est
        connu AVANT d'entrer dans la boucle, donc « posts 12/37 » est un compte
        réel. Ailleurs dans la récolte, le nombre d'appels d'une étape n'est pas
        connu d'avance et rien n'est chiffré.
        """
        if not self.meta_id_business:
            raise ValueError("instagram_business_id requis en mode headless")
        dire = note or (lambda _e: None)
        dire("inventaire")
        self._fetch_insta_post_id()              # plus de st.spinner → safe headless
        dire("abonnés")
        self.followers = self._fetch_account_followers()
        results = []
        total = len(self.new_post_ids)
        for rang, post_id in enumerate(self.new_post_ids, start=1):
            dire(f"posts {rang}/{total}")
            info = self._fetch_post_info(post_id)
            media_type = info.get("media_type", "IMAGE")
            metrics = self._fetch_post_metrics(post_id, media_type)
            results.append({
                "post_id": post_id,
                "type": info.get("media_type"),
                "caption": info.get("caption", "")[:500],  # assez pour labelliser par thème
                "date": info.get("timestamp", ""),
                "media_url": self._image_du_post(post_id, info),
                "follows": metrics.get("follows", 0),
                "likes": metrics.get("likes", 0),
                "comments": metrics.get("comments", 0),
                "saved": metrics.get("saved", 0),
                "views": metrics.get("views", 0),
                "reach": metrics.get("reach", 0),
                "user_id": self.supabase_user_id,
            })
        self.new_results = results
        return results

    def show_insta_data(self):
        self.fetch_insta_post_insight()

        old_results = fetch_post_metrics(self.supabase_client, self.supabase_user_id)
        df_old = pd.DataFrame(old_results) if old_results else pd.DataFrame()
        df_new = pd.DataFrame(self.new_results) if self.new_results else pd.DataFrame()

        df = pd.concat([df_new, df_old], ignore_index=True).drop_duplicates(subset="post_id")

        st.metric("Followers", self.followers)
        plan_label = "Pro" if self.limit == 50 else "Gratuit — max 10 posts"
        st.caption(f"{self.limit} posts affichés sur {self.total_posts} au total · Plan {plan_label}")
        st.session_state["results"] = df.to_dict("records")
        st.dataframe(df)


if __name__ == "__main__":
    pass
