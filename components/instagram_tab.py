import streamlit as st
import pandas as pd

from components.dashboard import show_dashboard
from scripts.insert_data import insert_instagram_org
from scripts.fetch_data import fetch_post_metrics, fetch_daily_followers
from meta_script.fetch_instagram import OrganicInstagramm

PULSE_CSS = """
<style>
.page-h { padding: 28px 0 24px; }
.h-eyebrow { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: var(--ink-4, #8b8e98); margin-bottom: 6px; }
.page-h h1 { font-family: var(--font-display, "Instrument Serif", Georgia, serif); font-size: 2rem; font-weight: 400; color: var(--ink, #0e0f12); margin: 0 0 6px; line-height: 1.2; }
.h-sub { font-size: 14px; color: var(--ink-3, #5a5d66); margin: 0; }
.kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin: 20px 0; }
.kpi { background: #fff; border: 1px solid var(--line, rgba(14,15,18,0.08)); border-radius: var(--r-lg, 14px); padding: 18px 20px; }
.k-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.7px; color: var(--ink-4, #8b8e98); margin-bottom: 8px; }
.k-value { font-family: var(--font-mono, "JetBrains Mono", monospace); font-size: 1.75rem; font-weight: 600; color: var(--ink, #0e0f12); line-height: 1.1; margin-bottom: 6px; }
.k-foot { font-size: 12px; color: var(--ink-4, #8b8e98); }
.delta { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; }
.delta.up { background: #e7f3ec; color: #1a7a4a; }
.delta.down { background: #fbe9e6; color: #c0392b; }
.card { background: #fff; border: 1px solid var(--line, rgba(14,15,18,0.08)); border-radius: var(--r-lg, 14px); padding: 20px; }
.cards-row { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin-bottom: 24px; }
.section { margin: 28px 0 16px; }
.section-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 14px; }
.section-title { font-size: 15px; font-weight: 600; color: var(--ink, #0e0f12); }
.st-count { font-size: 12px; color: var(--ink-4, #8b8e98); background: rgba(14,15,18,0.06); border-radius: 20px; padding: 2px 8px; }
.chip { display: inline-block; padding: 2px 9px; border-radius: 20px; font-size: 11px; font-weight: 600; }
.chip.good { background: #e7f3ec; color: #1a7a4a; }
.chip.outline { background: transparent; color: var(--ink-3, #5a5d66); border: 1px solid rgba(14,15,18,0.12); }
.chip.best { background: #fef3cd; color: #92600a; }
.tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.tbl th { text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; color: var(--ink-4, #8b8e98); padding: 8px 12px; border-bottom: 1px solid rgba(14,15,18,0.08); }
.tbl td { padding: 10px 12px; border-bottom: 1px solid rgba(14,15,18,0.05); color: var(--ink, #0e0f12); }
.tbl tr:last-child td { border-bottom: none; }
.tbl .mono { font-family: var(--font-mono, "JetBrains Mono", monospace); font-size: 12px; }
.hint { background: #f0f4ff; border-radius: 10px; padding: 12px 16px; display: flex; gap: 10px; align-items: flex-start; margin: 12px 0; }
.hint-ico { font-size: 16px; flex-shrink: 0; }
.hint p { font-size: 13px; color: #2c3e8c; margin: 0; }
.heatmap-grid { display: grid; gap: 4px; }
.heatmap-cell { border-radius: 4px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.9); }
.top-post-card { border-radius: var(--r-lg, 14px); padding: 20px; color: #fff; }
.top-post-caption { font-size: 13px; opacity: 0.9; margin: 8px 0 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.top-post-stats { display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; opacity: 0.85; }
.top-post-stat span { font-family: var(--font-mono, "JetBrains Mono", monospace); font-weight: 600; }
</style>
"""

FORMAT_GRADIENTS = {
    "VIDEO": "linear-gradient(135deg,#3b5bff,#7b4fff)",
    "REEL": "linear-gradient(135deg,#3b5bff,#7b4fff)",
    "CAROUSEL_ALBUM": "linear-gradient(135deg,#f77f00,#d62828)",
    "IMAGE": "linear-gradient(135deg,#2d6a4f,#52b788)",
}

FORMAT_LABELS = {
    "VIDEO": "Reel",
    "REEL": "Reel",
    "CAROUSEL_ALBUM": "Carrousel",
    "IMAGE": "Image",
}

DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
HOURS = ["6h", "9h", "12h", "15h", "18h", "21h"]


@st.fragment
def fetch_instagram_fragment(client, user_id, is_paid, dash, instagram_business_id=None):
    if st.session_state.pop("trigger_fetch", False):
        try:
            org = OrganicInstagramm(
                meta_long_token=st.session_state["meta_long_token"],
                supabase_client=client,
                supabase_user_id=user_id,
                instagram_business_id=instagram_business_id,
            )
            org.fetch_insta_post_insight()
            if org.new_results:
                insert_instagram_org(supabase=client, results=org.new_results)
            st.session_state["has_fetched"] = True
            st.caption(f"{org.limit} posts affichés sur {org.total_posts} au total · Plan {'Pro' if is_paid else 'Gratuit — max 10 posts'}")

        except Exception as e:
            if "JWT expired" in str(e):
                user = dash.supabase.auth.refresh_session(
                    refresh_token=st.session_state["session"].refresh_token
                )
                st.session_state["session"] = user.session
                st.query_params["refresh_token"] = user.session.refresh_token
                st.rerun()
            else:
                st.error(f"Erreur : {e}")


def _delta_html(val: int, suffix: str = "") -> str:
    if val == 0:
        return ""
    cls = "up" if val > 0 else "down"
    sign = "+" if val > 0 else ""
    return f"<span class='delta {cls}'>{sign}{val:,}{suffix}</span>"


def _format_chip(fmt: str, best: bool = False) -> str:
    label = FORMAT_LABELS.get(fmt.upper(), fmt)
    if best:
        return f"<span class='chip best'>🏆 {label}</span>"
    return f"<span class='chip outline'>{label}</span>"


def show_instagram_tab(client, user_id, is_paid, dash, instagram_business_id=None, account_name: str = "Instagram"):
    st.markdown(PULSE_CSS, unsafe_allow_html=True)

    fetch_instagram_fragment(client=client, user_id=user_id, is_paid=is_paid, dash=dash, instagram_business_id=instagram_business_id)

    data = fetch_post_metrics(client, user_id)
    df = pd.DataFrame(data or [])

    follows_raw = fetch_daily_followers(client, user_id)
    df_follows = pd.DataFrame(follows_raw) if follows_raw else pd.DataFrame()

    followers_current = 0
    followers_delta = 0
    if not df_follows.empty and "followers" in df_follows.columns:
        df_follows = df_follows.sort_values("fetched_at", ascending=False)
        followers_current = int(df_follows.iloc[0]["followers"])
        if len(df_follows) >= 7:
            followers_delta = followers_current - int(df_follows.iloc[6]["followers"])

    if df.empty:
        st.markdown(f"""
        <div class='page-h'>
            <div class='h-eyebrow'>Instagram organique · 30 derniers jours</div>
            <h1>Aucune donnée pour {account_name}.</h1>
            <p class='h-sub'>Récupère tes données depuis l'onglet Connecter Meta.</p>
        </div>
        """, unsafe_allow_html=True)
        show_dashboard(client, user_id, is_paid=is_paid, account_name=account_name)
        return

    for col in ["reach", "likes", "saved", "comments", "views", "follows"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    nb_posts = len(df)
    reach_mean = df["reach"].mean() if "reach" in df.columns else 0
    nb_flew = int((df["reach"] > reach_mean).sum()) if "reach" in df.columns else 0
    reach_total = int(df["reach"].sum()) if "reach" in df.columns else 0
    likes_total = int(df["likes"].sum()) if "likes" in df.columns else 0
    saves_total = int(df["saved"].sum()) if "saved" in df.columns else 0
    engagement_pct = ((likes_total + saves_total) / reach_total * 100) if reach_total > 0 else 0.0
    saves_per_post = saves_total / nb_posts if nb_posts > 0 else 0.0

    st.markdown(f"""
    <div class='page-h'>
        <div class='h-eyebrow'>Instagram organique · 30 derniers jours · {account_name}</div>
        <h1>{nb_posts} posts publiés, {nb_flew} ont décollé.</h1>
        <p class='h-sub'>Portée totale {reach_total:,} · Engagement {engagement_pct:.1f}% · {followers_current:,} abonnés {_delta_html(followers_delta)}</p>
    </div>
    """, unsafe_allow_html=True)

    st.markdown(f"""
    <div class='kpi-grid'>
        <div class='kpi'>
            <div class='k-label'>Abonnés</div>
            <div class='k-value'>{followers_current:,}</div>
            <div class='k-foot'>{_delta_html(followers_delta, " ce mois")} &nbsp;</div>
        </div>
        <div class='kpi'>
            <div class='k-label'>Portée totale</div>
            <div class='k-value'>{reach_total:,}</div>
            <div class='k-foot'>sur {nb_posts} posts</div>
        </div>
        <div class='kpi'>
            <div class='k-label'>Engagement moyen</div>
            <div class='k-value'>{engagement_pct:.1f}</div>
            <div class='k-foot'>%</div>
        </div>
        <div class='kpi'>
            <div class='k-label'>Saves / post</div>
            <div class='k-value'>{saves_per_post:.1f}</div>
            <div class='k-foot'>sauvegardes par post</div>
        </div>
    </div>
    """, unsafe_allow_html=True)

    st.markdown("<div class='section'><div class='section-head'><span class='section-title'>Ce qui marche pour toi</span></div></div>", unsafe_allow_html=True)

    format_groups = {}
    if "type" in df.columns:
        for fmt, grp in df.groupby("type"):
            key = fmt.upper()
            avg_reach = grp["reach"].mean() if "reach" in grp.columns else 0
            format_groups[key] = {
                "nb": len(grp),
                "avg_reach": avg_reach,
                "grp": grp,
            }

    best_fmt = max(format_groups, key=lambda k: format_groups[k]["avg_reach"]) if format_groups else None
    show_fmts = [k for k in ["VIDEO", "REEL", "CAROUSEL_ALBUM", "IMAGE"] if k in format_groups]
    if not show_fmts:
        show_fmts = list(format_groups.keys())[:3]

    if show_fmts:
        max_reach = max(format_groups[k]["avg_reach"] for k in show_fmts) or 1
        cards_html = ""
        for fmt in show_fmts:
            info = format_groups[fmt]
            is_best = fmt == best_fmt
            chip = _format_chip(fmt, is_best)
            bar_pct = int(info["avg_reach"] / max_reach * 100)
            note = "Top format" if is_best else f"Portée moy. {info['avg_reach']:,.0f}"
            cards_html += f"""
            <div class='card'>
                <div style='margin-bottom:10px;'>{chip}</div>
                <div style='font-size:24px;font-family:var(--font-mono,"JetBrains Mono",monospace);font-weight:600;color:var(--ink,#0e0f12);'>{info['avg_reach']:,.0f}</div>
                <div style='font-size:11px;color:var(--ink-4,#8b8e98);margin:2px 0 10px;'>portée moyenne · {info['nb']} posts</div>
                <div style='background:rgba(14,15,18,0.06);border-radius:4px;height:5px;overflow:hidden;'>
                    <span style='display:block;height:100%;width:{bar_pct}%;background:#3b5bff;border-radius:4px;'></span>
                </div>
                <div style='font-size:11px;color:var(--ink-4,#8b8e98);margin-top:6px;'>{note}</div>
            </div>
            """
        st.markdown(f"<div class='cards-row'>{cards_html}</div>", unsafe_allow_html=True)

    st.markdown("<div class='section'><div class='section-head'><span class='section-title'>Quand publier ?</span></div></div>", unsafe_allow_html=True)

    heat_data = {}
    if "date" in df.columns:
        df["_dt"] = pd.to_datetime(df["date"], errors="coerce")
        df["_dow"] = df["_dt"].dt.dayofweek
        df["_hour"] = df["_dt"].dt.hour
        hour_bins = [0, 7, 10, 13, 16, 19, 24]
        hour_labels = [0, 1, 2, 3, 4, 5]
        df["_slot"] = pd.cut(df["_hour"], bins=hour_bins, labels=hour_labels, right=False)
        for _, row in df.iterrows():
            if pd.notna(row.get("_dow")) and pd.notna(row.get("_slot")):
                key = (int(row["_dow"]), int(row["_slot"]))
                heat_data[key] = heat_data.get(key, 0) + float(row.get("reach", 1))

    max_heat = max(heat_data.values()) if heat_data else 1
    best_slot = max(heat_data, key=heat_data.get) if heat_data else None

    header_row = "<div style='display:grid;grid-template-columns:40px repeat(7,1fr);gap:4px;margin-bottom:4px;'>"
    header_row += "<div></div>"
    for d in DAYS:
        header_row += f"<div style='text-align:center;font-size:10px;font-weight:600;color:#8b8e98;'>{d}</div>"
    header_row += "</div>"

    grid_html = header_row
    for s_idx, slot_label in enumerate(HOURS):
        grid_html += f"<div style='display:grid;grid-template-columns:40px repeat(7,1fr);gap:4px;margin-bottom:4px;'>"
        grid_html += f"<div style='font-size:10px;color:#8b8e98;display:flex;align-items:center;'>{slot_label}</div>"
        for d_idx in range(7):
            key = (d_idx, s_idx)
            val = heat_data.get(key, 0)
            opacity = val / max_heat if max_heat > 0 else 0
            is_best_cell = key == best_slot
            bg = f"rgba(59,91,255,{max(0.06, opacity)})"
            label = "BEST" if is_best_cell else ""
            grid_html += f"<div style='background:{bg};border-radius:4px;height:28px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:rgba(59,91,255,0.8);'>{label}</div>"
        grid_html += "</div>"

    st.markdown(f"""
    <div style='background:#fff;border:1px solid rgba(14,15,18,0.08);border-radius:14px;padding:20px;'>
        {grid_html}
    </div>
    """, unsafe_allow_html=True)

    if best_slot:
        best_day = DAYS[best_slot[0]]
        best_hour = HOURS[best_slot[1]]
        st.markdown(f"""
        <div class='hint' style='margin-top:10px;'>
            <span class='hint-ico'>💡</span>
            <p>Tes meilleurs résultats sont le <strong>{best_day}</strong> vers <strong>{best_hour}</strong>. Planifie tes posts importants sur ce créneau.</p>
        </div>
        """, unsafe_allow_html=True)

    st.markdown("<div class='section'><div class='section-head'><span class='section-title'>Top 3 posts</span></div></div>", unsafe_allow_html=True)

    top3 = df.nlargest(3, "reach") if "reach" in df.columns else df.head(3)
    top_cols = st.columns(3)
    for i, (_, row) in enumerate(top3.iterrows()):
        fmt = str(row.get("type", "IMAGE")).upper()
        gradient = FORMAT_GRADIENTS.get(fmt, "linear-gradient(135deg,#667eea,#764ba2)")
        caption = str(row.get("caption", ""))[:120] or "—"
        reach = int(row.get("reach", 0))
        likes = int(row.get("likes", 0))
        saves = int(row.get("saved", 0))
        comments = int(row.get("comments", 0))
        date_str = str(row.get("date", ""))[:10]

        with top_cols[i]:
            st.markdown(f"""
            <div class='top-post-card' style='background:{gradient};margin-bottom:8px;'>
                <div style='font-size:11px;font-weight:600;opacity:0.7;text-transform:uppercase;letter-spacing:0.8px;'>{FORMAT_LABELS.get(fmt,fmt)} · {date_str}</div>
                <div class='top-post-caption'>{caption}</div>
                <div class='top-post-stats'>
                    <div>👁 <span>{reach:,}</span></div>
                    <div>❤️ <span>{likes:,}</span></div>
                    <div>🔖 <span>{saves:,}</span></div>
                    <div>💬 <span>{comments:,}</span></div>
                </div>
            </div>
            """, unsafe_allow_html=True)

    st.markdown("<div class='section'><div class='section-head'><span class='section-title'>Tous les posts</span></div></div>", unsafe_allow_html=True)

    cols_show = [c for c in ["caption", "type", "date", "reach", "likes", "saved", "comments"] if c in df.columns]
    df_tbl = df[cols_show].copy()

    engagement_col = "Engagement"
    if "reach" in df_tbl.columns and "likes" in df_tbl.columns:
        df_tbl[engagement_col] = df_tbl.apply(
            lambda r: f"{(r['likes'] + r.get('saved', 0)) / r['reach'] * 100:.1f}%" if r.get("reach", 0) > 0 else "—",
            axis=1,
        )

    rename_map = {
        "caption": "Post", "type": "Format", "date": "Date",
        "reach": "Portée", "likes": "Likes", "saved": "Saves", "comments": "Comm."
    }
    df_tbl = df_tbl.rename(columns=rename_map)

    rows_html = ""
    for _, row in df_tbl.iterrows():
        caption_cell = str(row.get("Post", ""))[:60]
        fmt_raw = str(row.get("Format", "")).upper()
        fmt_label = FORMAT_LABELS.get(fmt_raw, fmt_raw)
        date_cell = str(row.get("Date", ""))[:10]
        reach_cell = f"{int(row['Portée']):,}" if "Portée" in row and pd.notna(row["Portée"]) else "—"
        likes_cell = f"{int(row['Likes']):,}" if "Likes" in row and pd.notna(row["Likes"]) else "—"
        saves_cell = f"{int(row['Saves']):,}" if "Saves" in row and pd.notna(row["Saves"]) else "—"
        eng_cell = row.get(engagement_col, "—")
        rows_html += f"""
        <tr>
            <td>{caption_cell}</td>
            <td><span class='chip outline'>{fmt_label}</span></td>
            <td>{date_cell}</td>
            <td class='mono'>{reach_cell}</td>
            <td class='mono'>{likes_cell}</td>
            <td class='mono'>{saves_cell}</td>
            <td class='mono'>{eng_cell}</td>
        </tr>
        """

    st.markdown(f"""
    <div style='background:#fff;border:1px solid rgba(14,15,18,0.08);border-radius:14px;overflow:hidden;'>
        <table class='tbl'>
            <thead><tr>
                <th>Post</th><th>Format</th><th>Date</th>
                <th>Portée</th><th>Likes</th><th>Saves</th><th>Engagement</th>
            </tr></thead>
            <tbody>{rows_html}</tbody>
        </table>
    </div>
    """, unsafe_allow_html=True)
