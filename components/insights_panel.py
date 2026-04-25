import re
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

    top3 = []
    if "likes" in df30.columns:
        for _, row in df30.nlargest(3, "likes").iterrows():
            top3.append({
                "caption": str(row.get("caption", ""))[:60],
                "type": str(row.get("type", "")),
                "likes": int(row.get("likes", 0)),
            })

    best_day = "—"
    if "date" in df30.columns and "likes" in df30.columns and not df30.empty:
        df30["day"] = df30["date"].dt.day_name()
        day_avg = df30.groupby("day")["likes"].mean()
        if not day_avg.empty:
            best_day = day_avg.idxmax()

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


def _summarize_meta(df: pd.DataFrame, df_filtered: pd.DataFrame | None = None) -> dict | None:
    """Agrège les données Meta Ads en un résumé compact pour le prompt.
    Si df_filtered est fourni (vue filtrée du dashboard), il est utilisé à la place de df.
    """
    source = df_filtered if (df_filtered is not None and not df_filtered.empty) else df
    if source is None or source.empty:
        return None

    df = source.copy()
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

def _build_prompt(
    insta_summary: dict | None,
    meta_summary: dict | None,
    section: str | None = None,
) -> str | None:
    parts = []

    if insta_summary:
        parts.append(
            "Instagram Organic (30 derniers jours) :\n"
            + json.dumps(insta_summary, ensure_ascii=False, indent=2)
        )
    if meta_summary:
        parts.append(
            "Meta Ads (30 derniers jours) :\n"
            + json.dumps(meta_summary, ensure_ascii=False, indent=2)
        )

    if not parts:
        return None

    data_block = "\n\n".join(parts)

    if section == "instagram":
        persona = "Tu es un coach Instagram expert."
    elif section == "meta_ads":
        persona = "Tu es un expert en publicité Meta Ads."
    else:
        persona = "Tu es un consultant social media expert."

    return (
        f"{persona} Voici les statistiques d'un client cette semaine.\n\n"
        f"{data_block}\n\n"
        "Génère exactement 3 à 4 insights actionnables basés uniquement sur ces données.\n"
        "Format strict : une ligne par insight. Commence chaque ligne par un emoji pertinent, "
        "puis une phrase courte en **gras** (5-8 mots) résumant l'action, "
        "suivie de deux points et d'une explication en 10 mots max.\n"
        "Exemple : 📅 **Publie le mercredi** : ton engagement est 40% plus élevé ce jour-là.\n"
        "Langue : français. Pas d'introduction, pas de conclusion, pas de tirets."
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


# ── Rendu HTML stylé ─────────────────────────────────────────────────────────

def _render_insights_html(content: str, ts: str) -> str:
    """Parse le texte Gemini et retourne un bloc HTML stylé."""
    lines = [l.strip() for l in content.split("\n") if l.strip()]

    insights = []
    for line in lines:
        # Supprimer les marqueurs de liste si présents
        for prefix in ("- ", "• ", "* ", "– ", "— "):
            if line.startswith(prefix):
                line = line[len(prefix):]
                break
        if line:
            insights.append(line)

    insights = insights[:4]

    cards = ""
    for insight in insights:
        # Convertir **gras** → <strong>
        insight_html = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", insight)
        cards += (
            '<div style="'
            "background:rgba(0,102,255,0.06);"
            "border-left:3px solid #0066ff;"
            "padding:8px 10px;"
            "border-radius:0 6px 6px 0;"
            "font-size:13px;"
            "margin-bottom:8px;"
            "line-height:1.5;"
            "color:#1a1a2e;"
            f'">{insight_html}</div>'
        )

    timestamp_html = (
        f'<div style="font-size:11px;color:#9ca3af;text-align:right;margin-top:4px">'
        f"Généré à {ts}</div>"
    )

    return f'<div style="margin-top:4px">{cards}{timestamp_html}</div>'


# ── Composant principal ───────────────────────────────────────────────────────

def show_insights_panel(
    df_instagram=None,
    df_meta=None,
    is_paid: bool = False,
    section: str | None = None,
    df_filtered=None,
    use_sidebar: bool = True,
):
    """Panneau Insights IA.
    use_sidebar=True  → rendu dans st.sidebar (Instagram tab)
    use_sidebar=False → rendu dans la page principale (Meta Ads tab)
    """
    if not is_paid:
        return

    ctx = st.sidebar if use_sidebar else st

    # ── Titre contextuel ────────────────────────────────────────────────────
    titles = {
        "instagram": "💡 Insights Instagram",
        "meta_ads": "💡 Insights Meta Ads",
    }
    title = titles.get(section, "💡 Insights de la semaine")

    ctx.divider()
    ctx.markdown(f"**{title}**")

    # ── Normaliser les inputs ───────────────────────────────────────────────
    if isinstance(df_instagram, list):
        df_instagram = pd.DataFrame(df_instagram) if df_instagram else pd.DataFrame()
    if not isinstance(df_instagram, pd.DataFrame):
        df_instagram = pd.DataFrame()
    if not isinstance(df_meta, pd.DataFrame):
        df_meta = pd.DataFrame()

    # Filtrer selon la section active
    use_insta = not df_instagram.empty and section != "meta_ads"
    use_meta = not df_meta.empty and section != "instagram"

    if not use_insta and not use_meta:
        ctx.caption("Connectez vos données pour voir vos insights.")
        return

    # ── Bouton Générer les insights ─────────────────────────────────────────
    generate = ctx.button(
        "✨ Générer les insights",
        key=f"btn_generate_insights_{section}",
        use_container_width=True,
    )

    # ── Cache 1h par section ────────────────────────────────────────────────
    cache_key = f"insights_cache_{section}" if section else "insights_cache"
    cache = st.session_state.get(cache_key, {})
    cached_content = cache.get("content")
    cached_at_str = cache.get("generated_at")
    one_hour_ago = datetime.utcnow() - timedelta(hours=1)

    is_fresh = False
    if cached_content and cached_at_str:
        try:
            is_fresh = datetime.fromisoformat(cached_at_str) > one_hour_ago
        except ValueError:
            is_fresh = False

    if is_fresh and not generate:
        try:
            ts = datetime.fromisoformat(cached_at_str).strftime("%H:%M")
        except ValueError:
            ts = "—"
        ctx.markdown(
            _render_insights_html(cached_content, ts),
            unsafe_allow_html=True,
        )
        return

    if not generate:
        ctx.caption("Cliquez sur 'Générer les insights' pour analyser vos données.")
        return

    # ── Générer (sur clic uniquement) ────────────────────────────────────────
    with st.spinner("Génération des insights..."):
        insta_summary = _summarize_instagram(df_instagram) if use_insta else None
        meta_summary = _summarize_meta(df_meta, df_filtered=df_filtered) if use_meta else None
        prompt = _build_prompt(insta_summary, meta_summary, section=section)

        if not prompt:
            ctx.caption("Données insuffisantes pour générer des insights.")
            return

        content = _call_gemini(prompt)

        if content:
            now_iso = datetime.utcnow().isoformat()
            st.session_state[cache_key] = {
                "content": content,
                "generated_at": now_iso,
            }
            ts = datetime.utcnow().strftime("%H:%M")
            ctx.markdown(
                _render_insights_html(content, ts),
                unsafe_allow_html=True,
            )


# ── Right panel (sidebar droite) ─────────────────────────────────────────────

def show_right_panel(df: pd.DataFrame, is_paid: bool = False, followers_delta: int = 0):
    """Mini-récap insights calculés localement — pas d'appel IA.
    S'affiche dans une colonne droite de show_dashboard().
    """
    summary = _summarize_instagram(df) if (df is not None and not df.empty) else None

    # ── Styles du panel ───────────────────────────────────────────────────────
    st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');
    .rp-header {
        font-size: 9px; font-weight: 600; color: #999;
        text-transform: uppercase; letter-spacing: 1.4px;
        margin-bottom: 14px;
    }
    .rp-card {
        padding: 10px 12px;
        border-bottom: 1px solid rgba(0,0,0,0.07);
        display: flex; flex-direction: column; gap: 2px;
    }
    .rp-card:last-child { border-bottom: none; }
    .rp-icon { font-size: 13px; }
    .rp-title {
        font-family: 'DM Sans', sans-serif;
        font-size: 11px; font-weight: 500; color: #0a0a0a;
        line-height: 1.4;
    }
    .rp-sub {
        font-family: 'DM Mono', monospace;
        font-size: 10px; color: #999;
    }
    .rp-pos { color: #1a7a4a; }
    .rp-neg { color: #c0392b; }
    .rp-wrap {
        border: 1px solid rgba(0,0,0,0.07);
        border-radius: 10px;
        overflow: hidden;
        background: #ffffff;
        margin-top: 4px;
    }
    .rp-blur-wrap { position: relative; }
    .rp-blur { filter: blur(4px); pointer-events: none; }
    .rp-lock {
        position: absolute; top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        background: white; border: 1px solid rgba(0,0,0,0.09);
        border-radius: 8px; padding: 8px 14px;
        font-size: 11px; font-weight: 500; color: #0a0a0a;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    </style>
    """, unsafe_allow_html=True)

    st.markdown('<div class="rp-header">Insights · Cette semaine</div>', unsafe_allow_html=True)

    if not summary:
        st.markdown(
            '<div class="rp-wrap"><div class="rp-card">'
            '<span class="rp-title" style="color:#999;">Importe tes données pour voir les insights.</span>'
            '</div></div>',
            unsafe_allow_html=True,
        )
        return

    # ── Construire les signals ────────────────────────────────────────────────
    signals = []

    # Meilleur jour
    if summary.get("best_day") and summary["best_day"] != "—":
        day_fr = {
            "Monday": "Lundi", "Tuesday": "Mardi", "Wednesday": "Mercredi",
            "Thursday": "Jeudi", "Friday": "Vendredi", "Saturday": "Samedi", "Sunday": "Dimanche",
        }.get(summary["best_day"], summary["best_day"])
        signals.append(("📅", f"{day_fr} = meilleur jour", "Publie ce jour pour max. d'engagement"))

    # Meilleur type
    if summary.get("best_type") and summary["best_type"] != "—":
        type_labels = {
            "VIDEO": "Reels", "IMAGE": "Images", "CAROUSEL_ALBUM": "Carrousels",
            "REELS": "Reels",
        }
        best = type_labels.get(summary["best_type"], summary["best_type"])
        signals.append(("🎬", f"{best} performent le mieux", "3× plus de portée en moyenne"))

    # Reach vs moyenne
    avg_reach = summary.get("avg_reach", 0)
    if avg_reach > 0:
        signals.append(("📈", f"{int(avg_reach):,} reach / post", "Moyenne sur 30 jours"))

    # Saves
    avg_saves = summary.get("avg_saves", 0)
    if avg_saves < 10 and summary.get("posts_30j", 0) > 3:
        signals.append(("💾", "CTA saves à tester", "Ajoute « Sauvegarde ce post »"))
    elif avg_saves > 0:
        signals.append(("💾", f"{int(avg_saves):,} saves / post", "Signal algo fort"))

    # Followers delta
    if followers_delta > 0:
        signals.append(("👥", f"+{followers_delta:,} followers", "Cette semaine"))
    elif followers_delta < 0:
        signals.append(("👥", f"{followers_delta:,} followers", "Cette semaine"))

    # Nombre de posts
    n_posts = summary.get("posts_30j", 0)
    if n_posts > 0:
        signals.append(("📝", f"{n_posts} posts publiés", "Ces 30 derniers jours"))

    if not signals:
        signals.append(("💡", "Continue à publier", "Plus de données = meilleurs insights"))

    # ── Rendu ─────────────────────────────────────────────────────────────────
    cards_html = "".join(
        f'<div class="rp-card">'
        f'<span class="rp-icon">{icon}</span>'
        f'<span class="rp-title">{title}</span>'
        f'<span class="rp-sub">{sub}</span>'
        f'</div>'
        for icon, title, sub in signals
    )

    if is_paid:
        st.markdown(f'<div class="rp-wrap">{cards_html}</div>', unsafe_allow_html=True)
    else:
        st.markdown(
            f'<div class="rp-blur-wrap">'
            f'<div class="rp-wrap rp-blur">{cards_html}</div>'
            f'<div class="rp-lock">🔒 Plan Pro</div>'
            f'</div>',
            unsafe_allow_html=True,
        )
