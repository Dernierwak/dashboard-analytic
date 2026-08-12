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
            # Les cinq derniers champs portent le budget PLANIFIÉ et les dates
            # déclarées. Ils ne se déduisent d'aucun insight : une campagne à
            # 200 CHF/jour qui n'en consomme que 60 laisse exactement la même
            # trace qu'une campagne réglée à 60.
            "fields": "id,name,status,objective,daily_budget,lifetime_budget,"
                      "budget_remaining,start_time,stop_time",
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




# ── Récolte headless — appelée par le worker et par le chemin Streamlit ───────
# Rien de ce qui suit ne touche à `st` : ces fonctions tournent dans le cron,
# sans personne connecté.

_GRAPH = "https://graph.facebook.com/v24.0"


def _centimes(v) -> float | None:
    """Meta renvoie ses montants en CENTIMES, et sous forme de CHAÎNE.

    « 5000 » vaut 50,00 CHF. Sans cette division on affiche cent fois le budget
    réel — l'erreur est silencieuse et passe pour un compte très dépensier.
    On rend None quand le champ est absent : « pas de budget ici » et « budget
    à zéro » ne veulent pas dire la même chose (voir `_budget_des_adsets`).

    Hypothèse : la devise du compte a deux décimales. Les devises sans sous-unité
    (JPY, KRW) seraient divisées à tort — aucun compte Pulse n'en utilise
    aujourd'hui, et Meta n'expose pas le facteur dans cette réponse.
    """
    if v in (None, "", 0, "0"):
        return None
    try:
        return float(v) / 100.0
    except (TypeError, ValueError):
        return None


def _pages(url: str, params: dict, timeout: int = 30) -> list[dict]:
    """Suit `paging.next` jusqu'au bout. Un compte de 40 campagnes tient sur une
    page, un compte d'agence non — et la page manquante ne lève aucune erreur."""
    out: list[dict] = []
    try:
        data = requests.get(url, params=params, timeout=timeout).json()
    except Exception:
        return out
    out += data.get("data", []) or []
    nxt = (data.get("paging") or {}).get("next")
    while nxt:
        try:
            data = requests.get(nxt, timeout=timeout).json()
        except Exception:
            break
        out += data.get("data", []) or []
        nxt = (data.get("paging") or {}).get("next")
    return out


def _budget_des_adsets(token: str, campaign_id: str) -> tuple[float | None, float | None]:
    """Somme des budgets des ad sets d'une campagne.

    POURQUOI C'EST OBLIGATOIRE : quand le CBO (budget au niveau campagne) est
    désactivé — c'est le réglage par DÉFAUT sur beaucoup de comptes — la
    campagne ne porte aucun budget, il vit sur chaque ad set. Sans cette
    remontée, un compte entier affiche « 0 CHF planifié » alors qu'il dépense
    tous les jours, et la page Coûts conclut qu'il n'y a rien de prévu.

    Returns: (journalier, total) en CHF, None quand aucun ad set n'en porte.
    """
    rows = _pages(
        f"{_GRAPH}/{campaign_id}/adsets",
        {"access_token": token, "fields": "daily_budget,lifetime_budget", "limit": 200},
    )
    jour = 0.0
    total = 0.0
    for a in rows:
        jour += _centimes(a.get("daily_budget")) or 0.0
        total += _centimes(a.get("lifetime_budget")) or 0.0
    return (jour or None), (total or None)


def _jour(v) -> str | None:
    """`start_time` de Meta est un horodatage ISO avec fuseau ; on ne garde que
    le jour, seule granularité que la frise et le prorata savent lire."""
    return str(v)[:10] if v else None


def fetch_campaign_budgets(token: str, ad_account_id: str) -> tuple[list[dict], str | None]:
    """Le budget PLANIFIÉ de chaque campagne Meta, à l'instant du relevé.

    Returns: (rows, error|None) — chaque row : campaign_id, campaign_name,
    status, start_date, end_date, daily_budget, total_budget.
    `end_date` None = campagne déclarée sans fin (pas de `stop_time`).
    """
    if not (token and ad_account_id):
        return [], "token ou ad_account_id manquant"
    try:
        resp = requests.get(
            f"{_GRAPH}/{ad_account_id}/campaigns",
            params={
                "access_token": token,
                "fields": "id,name,status,objective,daily_budget,lifetime_budget,"
                          "budget_remaining,start_time,stop_time",
                "limit": 200,
            },
            timeout=30,
        ).json()
    except Exception as e:
        return [], f"Erreur API: {e}"
    if isinstance(resp, dict) and resp.get("error"):
        return [], resp["error"].get("message", str(resp["error"]))

    camps = resp.get("data", []) or []
    nxt = (resp.get("paging") or {}).get("next")
    while nxt:
        try:
            page = requests.get(nxt, timeout=30).json()
        except Exception:
            break
        camps += page.get("data", []) or []
        nxt = (page.get("paging") or {}).get("next")

    rows: list[dict] = []
    for c in camps:
        cid = str(c.get("id") or "")
        if not cid:
            continue
        jour = _centimes(c.get("daily_budget"))
        total = _centimes(c.get("lifetime_budget"))
        if jour is None and total is None:
            # Budget par ad set (CBO désactivé) — un appel de plus par campagne,
            # et c'est le seul moyen de connaître la promesse.
            jour, total = _budget_des_adsets(token, cid)
        rows.append({
            "campaign_id":   cid,
            "campaign_name": c.get("name", ""),
            "status":        c.get("status") or c.get("effective_status") or "",
            "start_date":    _jour(c.get("start_time")),
            # stop_time absent = campagne sans fin programmée, pas « fin inconnue ».
            "end_date":      _jour(c.get("stop_time")),
            # Exclusifs : un lifetime_budget prime, sinon le prorata compterait
            # la même promesse deux fois.
            "daily_budget":  None if total else jour,
            "total_budget":  total,
        })
    return rows, None


# ==== Debug — sous __main__ pour que le worker puisse importer ce module.
# Sans ce garde, `import meta_script.fetch_meta_ads` dessinait un champ de
# saisie Streamlit puis plantait sur PaidMeta(token) au moment de l'import.
if __name__ == "__main__":
    token = st.text_input("add Token")
    st.session_state["token"] = token
    paidmeta = PaidMeta(token, None, None)

    if st.session_state["token"]:
        paidmeta._get_ad_accounts()