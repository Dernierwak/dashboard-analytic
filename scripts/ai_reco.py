import requests
import streamlit as st
from supabase import Client
from datetime import datetime, timedelta
import json
import pandas as pd


def _compress_data(df, followers_delta: int) -> dict:
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df["day"] = df["date"].dt.day_name()
    df["engagement"] = df.get("likes", 0) + df.get("comments", 0) + df.get("saved", 0)

    avg_by_type = {}
    for t, group in df.groupby("type"):
        avg_by_type[t] = {
            "avg_reach": int(group["reach"].mean()) if "reach" in group else 0,
            "avg_engagement": int(group["engagement"].mean()),
            "count": len(group),
        }

    best_day = df.groupby("day")["reach"].mean().idxmax() if "reach" in df.columns and not df.empty else "—"

    top3 = df.nlargest(3, "engagement")
    top_captions = [str(row.get("caption", ""))[:60] for _, row in top3.iterrows()]

    df_sorted = df.sort_values("date")
    mid = len(df_sorted) // 2
    if mid > 0:
        old_avg = df_sorted.iloc[:mid]["engagement"].mean()
        new_avg = df_sorted.iloc[mid:]["engagement"].mean()
        trend = round(((new_avg - old_avg) / old_avg) * 100) if old_avg > 0 else 0
    else:
        trend = 0

    return {
        "followers_delta": followers_delta,
        "total_posts": len(df),
        "engagement_trend_pct": trend,
        "best_day": best_day,
        "avg_by_type": avg_by_type,
        "top3_captions": top_captions,
    }


def _build_prompt(df, followers_delta: int) -> str:
    data = _compress_data(df, followers_delta)
    return (
        "Tu es un coach Instagram expert. Analyse ces statistiques et donne 3 recommandations concrètes et actionnables pour la semaine prochaine.\n\n"
        f"Stats :\n{json.dumps(data, ensure_ascii=False)}\n\n"
        "Règles :\n- 3 bullet points maximum\n- Chaque reco commence par un verbe d'action\n- Basé uniquement sur les données\n- Réponds en français"
    )


def get_or_generate_reco(supabase: Client, user_id: str, df, followers_delta: int = 0, force: bool = False) -> dict | None:
    week_ago = (datetime.utcnow() - timedelta(days=7)).isoformat()
    existing = (
        supabase.table("ai_recommendations")
        .select("*")
        .eq("user_id", user_id)
        .gte("generated_at", week_ago)
        .order("generated_at", desc=True)
        .limit(1)
        .execute()
    )
    if existing.data and not force:
        return existing.data[0]

    if df is None or len(df) == 0:
        return None

    try:
        prompt = _build_prompt(df, followers_delta)

        # Google Gemini (gratuit — 1500 req/jour)
        api_key = st.secrets["gemini"]["api_key"]
        response = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
            json={"contents": [{"parts": [{"text": prompt}]}]},
        )
        data = response.json()
        #st.write(data)  # debug temporaire
        content = data["candidates"][0]["content"]["parts"][0]["text"]

        # Groq (gratuit — hotmail bloqué à l'inscription)
        # response = requests.post(
        #     "https://api.groq.com/openai/v1/chat/completions",
        #     headers={"Authorization": f"Bearer {st.secrets['groq']['api_key']}"},
        #     json={"model": "llama-3.1-8b-instant", "max_tokens": 400,
        #           "messages": [{"role": "user", "content": prompt}]},
        # )
        # content = response.json()["choices"][0]["message"]["content"]

        # HuggingFace (Apertus) — crédits épuisés
        # response = requests.post(
        #     "https://router.huggingface.co/v1/chat/completions",
        #     headers={"Authorization": f"Bearer {st.secrets['huggingface']['api_key']}"},
        #     json={
        #         "model": "swiss-ai/Apertus-8B-Instruct-2509:publicai",
        #         "max_tokens": 300,
        #         "messages": [{"role": "user", "content": prompt}],
        #     },
        # )
        # content = response.json()["choices"][0]["message"]["content"]

        # Claude Haiku (Anthropic) — nécessite crédits
        # import anthropic
        # client = anthropic.Anthropic(api_key=st.secrets["anthropic"]["api_key"])
        # response = client.messages.create(model="claude-haiku-4-5", max_tokens=400,
        #     messages=[{"role": "user", "content": prompt}])
        # content = response.content[0].text
        result = supabase.table("ai_recommendations").insert({
            "user_id": user_id,
            "content": content,
            "generated_at": datetime.utcnow().isoformat(),
        }).execute()
        return result.data[0] if result.data else {"content": content, "id": None}
    except Exception as e:
        st.error(f"Erreur génération reco : {e}")
        return None


def submit_feedback(supabase: Client, recommendation_id: str, user_id: str, rating: str, comment: str = ""):
    supabase.table("ai_feedback").insert({
        "recommendation_id": recommendation_id,
        "user_id": user_id,
        "rating": rating,
        "comment": comment,
    }).execute()
