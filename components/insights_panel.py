import streamlit as st
import requests
import json
import pandas as pd
from datetime import datetime, timedelta


# ── Résumé des données ───────────────────────────────────────────────────────

def _summarize_instagram(df: pd.DataFrame) -> dict | None:
    """Agrège les données Instagram en un résumé compact pour le prompt."""
    if df is None or df.empty:
        return None

    df = df.copy()
    df["date"] = pd.to_datetime(df.get("date", pd.Series(dtype="str")), errors="coerce")

    # Filtrer 30 derniers jours
    cutoff = pd.Timestamp.now() - pd.Timedelta(days=30)
    df30 = df[df["date"] >= cutoff].copy() if "date" in df.columns else df.copy()
    if df30.empty:
        df30 = df.copy()

    for col in ["likes", "reach", "saved", "comments", "views"]:
        if col in df30.columns:
            df30[col] = pd.to_numeric(df30[col], errors="coerce").fillna(0)

    avg_likes = round(df30["likes"].mean(), 1) if "likes" in df30.columns else 0
    avg_reach = round(df30["reach"].mean(), 1) if "reach" in df30.columns else 0
    avg_saves = round(df30["saved"].mean(), 1) if "saved" in df30.columns else 0

    # Top 3 posts par likes
    top3 = []
    if "likes" in df30.columns:
        top_rows = df30.nlargest(3, "likes")
        for _, row in top_rows.iterrows():
            top3.append({
                "caption": str(row.get("caption", ""))[:60],
                "type": str(row.get("type", "")),
                "likes": int(row.get("likes", 0)),
            })

    # Meilleur jour de la semaine
    best_day = "—"
    if "date" in df30.columns and "likes" in df30.columns and not df30.empty:
        df30["day"] = df30["date"].dt.day_name()
        day_avg = df30.groupby("day")["likes"].mean()
        if not day_avg.empty:
            best_day = day_avg.idxmax()

    # Meilleur type de post
    best_type = "—"
    if "type" in df30.columns and "likes" in df30.columns and not df30.empty:
        type_avg = df30.groupby("type")["likes"].mean()
        if not type_avg.empty:
            best_type = type_avg.idxmax()

    return {
        "posts_30j": len(df30),
        "avg_likes": avg_likes,
        "avg_reach": avg_reach,
        "avg_saves": avg_saves,
        "best_day": best_day,
        "best_type": best_type,
        "top3": top3,
    }


def _summarize_meta(df: pd.DataFrame) -> dict | None:
    """Agrège les données Meta Ads en un résumé compact pour le prompt."""
    if df is None or df.empty:
        return None

    df = df.copy()
    for col in ["impressions", "clicks", "spend", "reach", "link_clicks"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    if "date_start" in df.columns:
        df["date_start"] = pd.to_datetime(df["date_start"], errors="coerce")
        cutoff = pd.Timestamp.now() - pd.Timedelta(days=30)
        df30 = df[df["date_start"] >= cutoff].copy()
    else:
        df30 = df.copy()

    if df30.empty:
        df30 = df.copy()

    total_spend = round(df30["spend"].sum(), 2) if "spend" in df30.columns else 0
    total_impressions = df30["impressions"].sum() if "impressions" in df30.columns else 0
    total_clicks = df30["clicks"].sum() if "clicks" in df30.columns else 0

    ctr = round(total_clicks / total_impressions * 100, 2) if total_impressions > 0 else 0
    cpc = round(total_spend / total_clicks, 2) if total_clicks > 0 else 0
    cpm = round(total_spend / total_impressions * 1000, 2) if total_impressions > 0 else 0

    # Meilleure campagne par CTR
    best_campaign = "—"
    if "campaign_name" in df30.columns and not df30.empty:
        camp = df30.groupby("campaign_name").agg(
            impressions=("impressions", "sum"),
            clicks=("clicks", "sum"),
        ).reset_index()
        camp["ctr"] = camp.apply(
            lambda r: r["clicks"] / r["impressions"] * 100 if r["impressions"] > 0 else 0, axis=1
        )
        if not camp.empty:
            best_campaign = camp.loc[camp["ctr"].idxmax(), "campaign_name"]

    return {
        "depenses_30j": total_spend,
        "ctr_moyen_pct": ctr,
        "cpc_moyen": cpc,
        "cpm_moyen": cpm,
        "meilleure_campagne_ctr": best_campaign,
    }


# ── Prompt ───────────────────────────────────────────────────────────────────

def _build_prompt(insta_summary: dict | None, meta_summary: dict | None) -> str | None:
    sections = []

    if insta_summary:
        sections.append(
            "Instagram Organic (30 derniers jours) :\n"
            + json.dumps(insta_summary, ensure_ascii=False, indent=2)
        )

    if meta_summary:
        sections.append(
            "Meta Ads (30 derniers jours) :\n"
            + json.dumps(meta_summary, ensure_ascii=False, indent=2)
        )

    if not sections:
        return None

    data_block = "\n\n".join(sections)

    return (
        "Tu es un consultant social media expert. Voici les statistiques d'un client cette semaine.\n\n"
        f"{data_block}\n\n"
        "Génère 3 à 5 insights actionnables basés uniquement sur ces données.\n"
        "Format : bullet points courts (max 2 lignes chacun), chaque insight commence "
        "par un emoji pertinent puis un verbe d'action.\n"
        "Langue : français. Pas d'introduction ni de conclusion."
    )


# ── Appel Gemini (même pattern que ai_reco.py) ───────────────────────────────

def _call_gemini(prompt: str) -> str | None:
    try:
        api_key = st.secrets["gemini"]["api_key"]
        response = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
            json={"contents": [{"parts": [{"text": prompt}]}]},
            timeout=20,
        )
        data = response.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception:
        return None


# ── Composant principal ───────────────────────────────────────────────────────

def show_insights_panel(df_instagram=None, df_meta=None, is_paid=False):
    """Panneau 'Insights de la semaine' dans la sidebar.
    Visible uniquement pour les utilisateurs Pro (is_paid=True).
    Cache 1h dans st.session_state['insights_cache'].
    """
    if not is_paid:
        return

    st.sidebar.divider()
    st.sidebar.markdown("**💡 Insights de la semaine**")

    # Normaliser les inputs en DataFrame
    if isinstance(df_instagram, list):
        df_instagram = pd.DataFrame(df_instagram) if df_instagram else pd.DataFrame()
    if not isinstance(df_instagram, pd.DataFrame):
        df_instagram = pd.DataFrame()
    if not isinstance(df_meta, pd.DataFrame):
        df_meta = pd.DataFrame()

    has_data = not df_instagram.empty or not df_meta.empty
    if not has_data:
        st.sidebar.caption("Connectez vos données pour voir vos insights.")
        return

    # Bouton Actualiser
    force_refresh = st.sidebar.button(
        "🔄 Actualiser", key="btn_refresh_insights", use_container_width=True
    )

    # Vérifier le cache (1h)
    cache = st.session_state.get("insights_cache", {})
    cached_content = cache.get("content")
    cached_at_str = cache.get("generated_at")
    one_hour_ago = datetime.utcnow() - timedelta(hours=1)

    is_fresh = False
    if cached_content and cached_at_str:
        try:
            is_fresh = datetime.fromisoformat(cached_at_str) > one_hour_ago
        except ValueError:
            is_fresh = False

    if is_fresh and not force_refresh:
        st.sidebar.markdown(cached_content)
        try:
            ts = datetime.fromisoformat(cached_at_str).strftime("%H:%M")
            st.sidebar.caption(f"Généré à {ts}")
        except ValueError:
            pass
        return

    # Générer les insights
    with st.sidebar:
        with st.spinner("Génération des insights..."):
            insta_summary = _summarize_instagram(df_instagram) if not df_instagram.empty else None
            meta_summary = _summarize_meta(df_meta) if not df_meta.empty else None
            prompt = _build_prompt(insta_summary, meta_summary)

            if not prompt:
                st.sidebar.caption("Données insuffisantes pour générer des insights.")
                return

            content = _call_gemini(prompt)

            if content:
                st.session_state["insights_cache"] = {
                    "content": content,
                    "generated_at": datetime.utcnow().isoformat(),
                }
                st.sidebar.markdown(content)
                ts = datetime.utcnow().strftime("%H:%M")
                st.sidebar.caption(f"Généré à {ts}")
            else:
                st.sidebar.caption("Impossible de générer les insights pour le moment.")
