import streamlit as st
import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots

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
# Créneaux : bins [0,7), [7,10), [10,13), [13,16), [16,19), [19,24)
HOURS = ["0-7h", "7-10h", "10-13h", "13-16h", "16-19h", "19-24h"]


def run_instagram_fetch(client, user_id, dash, instagram_business_id=None, is_paid=False):
    """Lance le fetch Instagram. Affichage de statut géré par OrganicInstagramm.fetch_insta_post_insight()."""
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
        st.caption(
            f"{org.limit} posts affichés sur {org.total_posts} au total · "
            f"Plan {'Pro' if is_paid else 'Gratuit — max 10 posts'}"
        )
        return True
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
        return False


@st.fragment
def fetch_instagram_fragment(client, user_id, is_paid, dash, instagram_business_id=None):
    if st.session_state.pop("trigger_fetch", False):
        run_instagram_fetch(client, user_id, dash, instagram_business_id, is_paid)


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

    with st.spinner("Chargement des posts Instagram…"):
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

    tab_perf, tab_labels = st.tabs(["Performance", "Labels"])

    with tab_labels:
        _show_instagram_labels_tab(client, user_id, df)

    with tab_perf:
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

        # ── Croissance abonnés ────────────────────────────────────────────
        if not df_follows.empty and "followers" in df_follows.columns and len(df_follows) >= 2:
            st.markdown(
                "<div class='section'><div class='section-head'>"
                "<span class='section-title'>Croissance abonnés</span></div></div>",
                unsafe_allow_html=True,
            )

            df_grow = df_follows.copy().sort_values("fetched_at", ascending=True)
            df_grow["fetched_at"] = pd.to_datetime(df_grow["fetched_at"], errors="coerce")
            df_grow["followers"] = pd.to_numeric(df_grow["followers"], errors="coerce")
            df_grow = df_grow.dropna(subset=["fetched_at", "followers"])

            now = df_grow["fetched_at"].max()
            first = df_grow["fetched_at"].min()
            days_tracked = max(1, (now - first).days)
            current = int(df_grow.iloc[-1]["followers"])

            # gain sur 7 jours
            df_7d = df_grow[df_grow["fetched_at"] >= (now - pd.Timedelta(days=7))]
            gain_7d = int(df_7d.iloc[-1]["followers"] - df_7d.iloc[0]["followers"]) if len(df_7d) >= 2 else 0

            # gain sur 30 jours
            df_30d = df_grow[df_grow["fetched_at"] >= (now - pd.Timedelta(days=30))]
            gain_30d = int(df_30d.iloc[-1]["followers"] - df_30d.iloc[0]["followers"]) if len(df_30d) >= 2 else 0

            # gain depuis le début du tracking
            gain_total = int(current - df_grow.iloc[0]["followers"])
            avg_per_day = gain_total / days_tracked if days_tracked > 0 else 0

            # taux de croissance mensuel
            base_30d = int(df_30d.iloc[0]["followers"]) if len(df_30d) >= 2 else current
            growth_rate = (gain_30d / base_30d * 100) if base_30d > 0 else 0.0

            # 4 cartes KPI
            st.markdown(f"""
            <div class='kpi-grid'>
                <div class='kpi'>
                    <div class='k-label'>Gain 7 jours</div>
                    <div class='k-value'>{gain_7d:+,}</div>
                    <div class='k-foot'>cette semaine</div>
                </div>
                <div class='kpi'>
                    <div class='k-label'>Gain 30 jours</div>
                    <div class='k-value'>{gain_30d:+,}</div>
                    <div class='k-foot'>ce mois-ci</div>
                </div>
                <div class='kpi'>
                    <div class='k-label'>Moyenne / jour</div>
                    <div class='k-value'>{avg_per_day:+.1f}</div>
                    <div class='k-foot'>sur {days_tracked} jours</div>
                </div>
                <div class='kpi'>
                    <div class='k-label'>Croissance 30j</div>
                    <div class='k-value'>{growth_rate:+.2f}</div>
                    <div class='k-foot'>%</div>
                </div>
            </div>
            """, unsafe_allow_html=True)

            # Calcul des gains/pertes quotidiens
            df_diff = df_grow.copy()
            df_diff["delta"] = df_diff["followers"].diff().fillna(0).astype(int)
            df_diff = df_diff.iloc[1:]  # retire le 1er point (delta = 0)

            bar_colors = [
                "#1a7a4a" if d > 0 else "#c0392b" if d < 0 else "rgba(14,15,18,0.15)"
                for d in df_diff["delta"]
            ]
            text_labels = [
                (f"+{d}" if d > 0 else (f"{d}" if d < 0 else ""))
                for d in df_diff["delta"]
            ]

            # 2 subplots stackés : line plot cumulé en haut + bar plot delta en bas
            fig_follow = make_subplots(
                rows=2, cols=1, shared_xaxes=True,
                row_heights=[0.6, 0.4],
                vertical_spacing=0.08,
                subplot_titles=("Total abonnés", "Variation quotidienne"),
            )

            # ── Row 1 : Line plot ──
            fig_follow.add_trace(
                go.Scatter(
                    x=df_grow["fetched_at"], y=df_grow["followers"],
                    mode="lines+markers",
                    line=dict(color="#3b5bff", width=2.5),
                    marker=dict(size=4, color="#fff", line=dict(color="#3b5bff", width=2)),
                    fill="tozeroy",
                    fillcolor="rgba(59,91,255,0.07)",
                    hovertemplate="%{x|%d %b %Y}<br><b>%{y:,} abonnés</b><extra></extra>",
                ),
                row=1, col=1,
            )

            # ── Row 2 : Bar plot ──
            fig_follow.add_trace(
                go.Bar(
                    x=df_diff["fetched_at"], y=df_diff["delta"],
                    marker_color=bar_colors,
                    text=text_labels,
                    textposition="outside",
                    textfont=dict(size=10, color="#0e0f12"),
                    hovertemplate="%{x|%d %b %Y}<br><b>%{y:+,} abonnés</b><extra></extra>",
                ),
                row=2, col=1,
            )
            fig_follow.add_hline(
                y=0, line_color="rgba(14,15,18,0.2)", line_width=1,
                row=2, col=1,
            )

            # Style des subplot_titles (police Pulse, plus discret)
            for ann in fig_follow.layout.annotations:
                ann.font = dict(size=11, color="#8b8e98", family="Inter, sans-serif")
                ann.xanchor = "left"
                ann.x = 0

            fig_follow.update_layout(
                template="plotly_white", height=380,
                margin=dict(l=0, r=0, t=30, b=0),
                paper_bgcolor="#fff", plot_bgcolor="#fff",
                font=dict(color="#666", family="Inter, sans-serif"),
                showlegend=False,
                bargap=0.4,
            )
            # Axes : zoom désactivé partout
            fig_follow.update_xaxes(
                showgrid=False, color="#999",
                linecolor="rgba(0,0,0,0.07)",
                fixedrange=True,
            )
            fig_follow.update_yaxes(
                showgrid=True, gridcolor="#f4f3f1", color="#999",
                fixedrange=True, zeroline=False,
            )

            st.markdown('<div class="card" style="padding:16px 20px 8px;">', unsafe_allow_html=True)
            st.plotly_chart(
                fig_follow,
                use_container_width=True,
                config={
                    "displayModeBar": False,
                    "scrollZoom": False,
                    "doubleClick": False,
                    "showAxisDragHandles": False,
                },
            )
            st.markdown('</div>', unsafe_allow_html=True)

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
            fmt_cols = st.columns(max(len(show_fmts), 1))
            for col_i, fmt in enumerate(show_fmts):
                info = format_groups[fmt]
                is_best = fmt == best_fmt
                chip = _format_chip(fmt, is_best)
                bar_pct = int(info["avg_reach"] / max_reach * 100)
                note = "Top format" if is_best else f"Portée moy. {info['avg_reach']:,.0f}"
                with fmt_cols[col_i]:
                    st.markdown(
                        f"<div class='card'>"
                        f"<div style='margin-bottom:10px;'>{chip}</div>"
                        f"<div style='font-size:24px;font-family:var(--font-mono,\"JetBrains Mono\",monospace);"
                        f"font-weight:600;color:var(--ink,#0e0f12);'>{info['avg_reach']:,.0f}</div>"
                        f"<div style='font-size:11px;color:var(--ink-4,#8b8e98);margin:2px 0 10px;'>"
                        f"portée moyenne · {info['nb']} posts</div>"
                        f"<div style='background:rgba(14,15,18,0.06);border-radius:4px;height:5px;overflow:hidden;'>"
                        f"<span style='display:block;height:100%;width:{bar_pct}%;background:#3b5bff;border-radius:4px;'></span>"
                        f"</div>"
                        f"<div style='font-size:11px;color:var(--ink-4,#8b8e98);margin-top:6px;'>{note}</div>"
                        f"</div>",
                        unsafe_allow_html=True,
                    )
    
        st.markdown("<div class='section'><div class='section-head'><span class='section-title'>Quand publier ?</span></div></div>", unsafe_allow_html=True)

        # Calcul : pour chaque (jour, créneau) → {count, total_reach, avg_reach}
        heat_data = {}
        has_real_hours = False
        if "date" in df.columns:
            # Instagram renvoie le timestamp en UTC → on convertit en heure suisse
            df["_dt"] = pd.to_datetime(df["date"], errors="coerce", utc=True)
            try:
                df["_dt"] = df["_dt"].dt.tz_convert("Europe/Zurich")
            except Exception:
                pass
            df["_dow"] = df["_dt"].dt.dayofweek
            df["_hour"] = df["_dt"].dt.hour
            # Si toutes les heures sont 0 (ou 1/2 après conversion tz),
            # ça signifie que seule la date a été stockée → données legacy
            unique_hours = df["_hour"].dropna().unique()
            has_real_hours = len(unique_hours) > 2  # tolérance pour winter/summer time
            hour_bins = [0, 7, 10, 13, 16, 19, 24]
            hour_labels = [0, 1, 2, 3, 4, 5]
            df["_slot"] = pd.cut(df["_hour"], bins=hour_bins, labels=hour_labels, right=False)
            for _, r in df.iterrows():
                if pd.notna(r.get("_dow")) and pd.notna(r.get("_slot")):
                    key = (int(r["_dow"]), int(r["_slot"]))
                    cur = heat_data.setdefault(key, {"count": 0, "reach": 0.0})
                    cur["count"] += 1
                    cur["reach"] += float(r.get("reach", 0) or 0)

        # avg reach par cellule
        for k, v in heat_data.items():
            v["avg"] = v["reach"] / v["count"] if v["count"] > 0 else 0

        max_avg = max((v["avg"] for v in heat_data.values()), default=1) or 1
        # "best" = meilleur avg parmi les cellules avec au moins 1 post
        best_slot = max(heat_data, key=lambda k: heat_data[k]["avg"]) if heat_data else None

        if not has_real_hours and heat_data:
            st.warning(
                "⚠ Les heures de publication n'ont pas été stockées pour tes posts existants — "
                "tous apparaissent dans le créneau 0-7h. Rafraîchis tes données Instagram "
                "(depuis 'Connecter Meta') pour récupérer les vraies heures."
            )

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
                cell = heat_data.get(key)
                if cell:
                    opacity = cell["avg"] / max_avg if max_avg > 0 else 0
                    bg = f"rgba(59,91,255,{max(0.10, opacity)})"
                    is_best_cell = key == best_slot
                    if is_best_cell:
                        inner = f"<div style='font-size:9px;font-weight:700;line-height:1;color:#1a2c8f;'>BEST</div><div style='font-size:8px;color:#5a5d66;line-height:1;'>{cell['count']}p · {int(cell['avg']):,}</div>"
                    else:
                        inner = f"<div style='font-size:9px;font-weight:600;line-height:1;color:#0e0f12;'>{cell['count']}p</div><div style='font-size:8px;color:#5a5d66;line-height:1;'>{int(cell['avg']):,}</div>"
                else:
                    bg = "rgba(14,15,18,0.04)"
                    inner = ""
                grid_html += f"<div style='background:{bg};border-radius:4px;height:36px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;'>{inner}</div>"
            grid_html += "</div>"

        st.markdown(f"""
        <div style='background:#fff;border:1px solid rgba(14,15,18,0.08);border-radius:14px;padding:20px;'>
            {grid_html}
            <div style='display:flex;gap:14px;margin-top:10px;font-size:10px;color:#8b8e98;'>
                <span><b>Xp</b> = nombre de posts</span>
                <span>·</span>
                <span><b>chiffre du bas</b> = portée moyenne par post</span>
                <span>·</span>
                <span><b>intensité</b> = portée moyenne (plus c'est foncé, mieux ça performe)</span>
            </div>
        </div>
        """, unsafe_allow_html=True)

        if best_slot:
            best_day = DAYS[best_slot[0]]
            best_hour = HOURS[best_slot[1]]
            best = heat_data[best_slot]
            best_total = int(best["reach"])
            best_avg = int(best["avg"])
            st.markdown(f"""
            <div class='hint' style='margin-top:10px;'>
                <span class='hint-ico'>💡</span>
                <p>
                    Tes meilleurs résultats sont le <strong>{best_day}</strong> vers <strong>{best_hour}</strong> :
                    <strong>{best['count']}</strong> post(s), portée totale <strong>{best_total:,}</strong>,
                    moyenne <strong>{best_avg:,}/post</strong>.
                    {"⚠ Échantillon faible — base-toi sur plusieurs posts avant de conclure." if best['count'] < 3 else "Planifie tes posts importants sur ce créneau."}
                </p>
            </div>
            """, unsafe_allow_html=True)

    
        # ── En-tête Top 3 + filtres ──────────────────────────────────────
        col_title, col_fmt, col_lbl = st.columns([2, 1.5, 1.5])
        with col_title:
            st.markdown(
                "<div class='section'><div class='section-head'>"
                "<span class='section-title'>Top 3 posts</span></div></div>",
                unsafe_allow_html=True,
            )

        # Options format dispo dans les posts
        fmt_options = ["Tous"]
        if "type" in df.columns:
            for fmt in df["type"].dropna().unique():
                lbl = FORMAT_LABELS.get(str(fmt).upper(), str(fmt))
                fmt_options.append(lbl)

        # Options label dispo (master list)
        lbl_options = ["Tous"]
        master_labels = st.session_state.get("insta_labels") or []
        for l in master_labels:
            lbl_options.append(l)
        lbl_options.append("(sans label)")

        with col_fmt:
            sel_fmt = st.selectbox(
                "Format", options=fmt_options, key="top3_fmt_filter",
                label_visibility="collapsed",
            )
        with col_lbl:
            sel_lbl = st.selectbox(
                "Label", options=lbl_options, key="top3_lbl_filter",
                label_visibility="collapsed",
            )

        df_filtered = df.copy()
        if sel_fmt != "Tous" and "type" in df_filtered.columns:
            # Retrouver le code original (REEL/IMAGE/etc.) à partir du label affiché
            target_fmts = [k for k, v in FORMAT_LABELS.items() if v == sel_fmt]
            if not target_fmts:
                target_fmts = [sel_fmt.upper()]
            df_filtered = df_filtered[df_filtered["type"].astype(str).str.upper().isin(target_fmts)]
        if sel_lbl != "Tous" and "labels" in df_filtered.columns:
            if sel_lbl == "(sans label)":
                df_filtered = df_filtered[df_filtered["labels"].apply(
                    lambda x: not (isinstance(x, list) and len(x) > 0 and x[0])
                )]
            else:
                df_filtered = df_filtered[df_filtered["labels"].apply(
                    lambda x: isinstance(x, list) and sel_lbl in x
                )]

        if df_filtered.empty:
            st.info("Aucun post avec ces filtres.")
            top3 = df_filtered
        else:
            top3 = df_filtered.nlargest(3, "reach") if "reach" in df_filtered.columns else df_filtered.head(3)
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
            media_url = str(row.get("media_url", "")).strip()
    
            with top_cols[i]:
                # Image réelle si disponible, sinon gradient
                if media_url and media_url.startswith("http"):
                    st.markdown(
                        f"<div style='border-radius:12px;overflow:hidden;margin-bottom:8px;height:180px;"
                        f"position:relative;background:{gradient};'>"
                        f"<img src='{media_url}' style='width:100%;height:100%;object-fit:cover;display:block;' "
                        f"onerror=\"this.style.display='none'\">"
                        f"<div style='position:absolute;bottom:0;left:0;right:0;padding:10px 12px;"
                        f"background:linear-gradient(transparent,rgba(0,0,0,0.7));'>"
                        f"<div style='font-size:10px;font-weight:600;color:rgba(255,255,255,0.8);"
                        f"text-transform:uppercase;letter-spacing:0.8px;'>{FORMAT_LABELS.get(fmt,fmt)} · {date_str}</div>"
                        f"</div></div>",
                        unsafe_allow_html=True,
                    )
                else:
                    st.markdown(
                        f"<div class='top-post-card' style='background:{gradient};margin-bottom:8px;height:180px;"
                        f"display:flex;flex-direction:column;justify-content:flex-end;'>"
                        f"<div style='font-size:10px;font-weight:600;opacity:0.7;text-transform:uppercase;"
                        f"letter-spacing:0.8px;'>{FORMAT_LABELS.get(fmt,fmt)} · {date_str}</div>"
                        f"</div>",
                        unsafe_allow_html=True,
                    )
                st.markdown(
                    f"<div style='font-size:12px;color:#5a5d66;line-height:1.4;margin-bottom:8px;"
                    f"display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;'>"
                    f"{caption}</div>"
                    f"<div style='display:flex;gap:12px;font-size:12px;color:#8b8e98;flex-wrap:wrap;'>"
                    f"<span>👁 {reach:,}</span>"
                    f"<span>❤️ {likes:,}</span>"
                    f"<span>🔖 {saves:,}</span>"
                    f"<span>💬 {comments:,}</span>"
                    f"</div>",
                    unsafe_allow_html=True,
                )
    
        # ── Performance par label ─────────────────────────────────────────
        if "labels" in df.columns and not df.empty:
            df_l = df.copy()
            df_l["_lbl"] = df_l["labels"].apply(
                lambda x: x[0] if isinstance(x, list) and len(x) > 0 and x[0] else "(sans label)"
            )
            agg_lbl = df_l.groupby("_lbl").agg(
                posts=("_lbl", "count"),
                reach_tot=("reach", "sum"),
                reach_avg=("reach", "mean"),
                likes_avg=("likes", "mean"),
                saves_avg=("saved", "mean"),
                comm_avg=("comments", "mean"),
            ).reset_index()
            agg_lbl["eng_pct"] = agg_lbl.apply(
                lambda r: ((r["likes_avg"] + r["saves_avg"]) / r["reach_avg"] * 100) if r["reach_avg"] > 0 else 0.0,
                axis=1,
            )
            # tri : sans label en dernier, le reste par portée moyenne
            agg_lbl["_order"] = agg_lbl["_lbl"].apply(lambda x: (1 if x == "(sans label)" else 0, 0))
            agg_lbl = agg_lbl.sort_values(["_order", "reach_avg"], ascending=[True, False]).drop(columns=["_order"])

            # Afficher uniquement si au moins un vrai label utilisé
            real_labels = agg_lbl[agg_lbl["_lbl"] != "(sans label)"]
            if not real_labels.empty:
                st.markdown(
                    "<div class='section'><div class='section-head'>"
                    "<span class='section-title'>Performance par label</span></div></div>",
                    unsafe_allow_html=True,
                )

                # CSS Pulse pour les cartes label
                st.markdown("""
                <style>
                .lbl-card {
                    background: #fff;
                    border: 1px solid rgba(14,15,18,0.08);
                    border-radius: 14px;
                    padding: 18px 20px;
                    margin-bottom: 12px;
                    transition: transform 0.15s, box-shadow 0.15s;
                }
                .lbl-card:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 6px 20px rgba(14,15,18,0.06);
                }
                .lbl-card.best {
                    border: 1px solid #3b5bff;
                    background: linear-gradient(135deg, #fff 0%, #f5f7ff 100%);
                }
                .lbl-card-head {
                    display: flex; align-items: center; justify-content: space-between;
                    margin-bottom: 14px;
                }
                .lbl-card-name {
                    font-size: 16px; font-weight: 600; color: #0e0f12;
                    display: flex; align-items: center; gap: 8px;
                }
                .lbl-card-trophy { font-size: 14px; color: #b8860b; }
                .lbl-card-posts {
                    font-size: 11px; color: #8b8e98;
                    background: rgba(14,15,18,0.05);
                    padding: 3px 10px; border-radius: 999px;
                    font-weight: 500;
                }
                .lbl-card-metrics {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 16px;
                }
                .lbl-metric { text-align: left; }
                .lbl-metric-lbl {
                    font-size: 10px; font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    color: #8b8e98;
                    margin-bottom: 4px;
                }
                .lbl-metric-val {
                    font-family: "JetBrains Mono", ui-monospace, monospace;
                    font-size: 1.05rem; font-weight: 500;
                    color: #0e0f12; line-height: 1.1;
                }
                .lbl-metric-unit {
                    font-size: 0.75rem; color: #8b8e98; margin-left: 2px;
                }
                .lbl-bar-wrap {
                    height: 4px; background: rgba(14,15,18,0.06);
                    border-radius: 99px; overflow: hidden;
                    margin-top: 10px;
                }
                .lbl-bar-fill {
                    height: 100%; background: #3b5bff;
                    border-radius: 99px; transition: width 0.3s;
                }
                </style>
                """, unsafe_allow_html=True)

                # Best = meilleure portée moyenne parmi les vrais labels
                best_lbl = real_labels.iloc[real_labels["reach_avg"].argmax()]["_lbl"] \
                    if not real_labels.empty else None
                max_reach_avg = agg_lbl["reach_avg"].max() or 1

                # Affichage en grille 2 colonnes
                rows_list = list(agg_lbl.iterrows())
                for i in range(0, len(rows_list), 2):
                    cols = st.columns(2)
                    for col_idx, j in enumerate([i, i + 1]):
                        if j >= len(rows_list):
                            continue
                        _, r = rows_list[j]
                        is_best = (r["_lbl"] == best_lbl) and r["_lbl"] != "(sans label)"
                        is_no_label = r["_lbl"] == "(sans label)"
                        bar_pct = (r["reach_avg"] / max_reach_avg * 100) if max_reach_avg > 0 else 0

                        trophy = "<span class='lbl-card-trophy'>🏆</span>" if is_best else ""
                        card_cls = "lbl-card best" if is_best else "lbl-card"
                        label_color_style = "color:#8b8e98;" if is_no_label else ""

                        with cols[col_idx]:
                            st.markdown(f"""
                            <div class="{card_cls}">
                                <div class="lbl-card-head">
                                    <div class="lbl-card-name" style="{label_color_style}">
                                        {trophy} {r['_lbl']}
                                    </div>
                                    <div class="lbl-card-posts">{int(r['posts'])} post{'s' if r['posts'] > 1 else ''}</div>
                                </div>
                                <div class="lbl-card-metrics">
                                    <div class="lbl-metric">
                                        <div class="lbl-metric-lbl">Portée moy.</div>
                                        <div class="lbl-metric-val">{int(r['reach_avg']):,}</div>
                                    </div>
                                    <div class="lbl-metric">
                                        <div class="lbl-metric-lbl">Engagement</div>
                                        <div class="lbl-metric-val">{r['eng_pct']:.1f}<span class="lbl-metric-unit">%</span></div>
                                    </div>
                                    <div class="lbl-metric">
                                        <div class="lbl-metric-lbl">Likes moy.</div>
                                        <div class="lbl-metric-val">{int(r['likes_avg']):,}</div>
                                    </div>
                                    <div class="lbl-metric">
                                        <div class="lbl-metric-lbl">Saves moy.</div>
                                        <div class="lbl-metric-val">{int(r['saves_avg']):,}</div>
                                    </div>
                                </div>
                                <div class="lbl-bar-wrap"><div class="lbl-bar-fill" style="width:{bar_pct:.1f}%;"></div></div>
                            </div>
                            """, unsafe_allow_html=True)

        st.markdown("<div class='section'><div class='section-head'><span class='section-title'>Tous les posts</span></div></div>", unsafe_allow_html=True)

        cols_show = [c for c in ["id", "caption", "type", "date", "reach", "likes", "saved", "comments", "labels"] if c in df.columns]
        df_tbl = df[cols_show].copy()

        if "reach" in df_tbl.columns and "likes" in df_tbl.columns:
            df_tbl["Engagement"] = df_tbl.apply(
                lambda r: round((r["likes"] + r.get("saved", 0)) / r["reach"] * 100, 1) if r.get("reach", 0) > 0 else 0.0,
                axis=1,
            )

        if "type" in df_tbl.columns:
            df_tbl["type"] = df_tbl["type"].apply(lambda t: FORMAT_LABELS.get(str(t).upper(), t))

        # Colonne Label (1er label si plusieurs, vide sinon)
        if "labels" in df_tbl.columns:
            df_tbl["Label"] = df_tbl["labels"].apply(
                lambda x: x[0] if isinstance(x, list) and len(x) > 0 and x[0] else None
            )
            df_tbl = df_tbl.drop(columns=["labels"])
        else:
            df_tbl["Label"] = None

        df_tbl = df_tbl.rename(columns={
            "caption": "Post", "type": "Format", "date": "Date",
            "reach": "Portée", "likes": "Likes", "saved": "Saves", "comments": "Comm.",
        })

        if "Date" in df_tbl.columns:
            # UTC → Europe/Zurich + formatage date + heure (15 mai 2026 · 14:30)
            _dt = pd.to_datetime(df_tbl["Date"], errors="coerce", utc=True)
            try:
                _dt = _dt.dt.tz_convert("Europe/Zurich")
            except Exception:
                pass
            df_tbl["Date"] = _dt.dt.strftime("%d %b %Y · %H:%M")

        # Réordonner : Label en premier (à gauche)
        ordered = [c for c in ["id", "Label", "Post", "Format", "Date", "Portée", "Likes", "Saves", "Comm.", "Engagement"] if c in df_tbl.columns]
        df_tbl = df_tbl[ordered]

        df_tbl = df_tbl.sort_values("Portée", ascending=False) if "Portée" in df_tbl.columns else df_tbl

        # Labels disponibles (master list)
        avail_labels = st.session_state.get("insta_labels")
        if avail_labels is None:
            try:
                _r = client.table("profiles").select("labelling").eq("id", user_id).execute()
                avail_labels = [l for l in (_r.data[0].get("labelling") if _r.data else []) or [] if l]
            except Exception:
                avail_labels = []

        # Signature des labels → bump le key du data_editor quand la liste change
        # (sinon Streamlit garde l'ancien column_config en cache)
        labels_signature = "_".join(sorted(avail_labels))[:80] or "empty"
        editor_key = f"insta_posts_editor_{labels_signature}"

        edited = st.data_editor(
            df_tbl,
            use_container_width=True,
            hide_index=True,
            key=editor_key,
            column_config={
                "id": None,  # caché mais conservé pour l'index
                "Label": st.column_config.SelectboxColumn(
                    "Label",
                    options=avail_labels if avail_labels else [],
                    required=False,
                    width="small",
                ),
                "Post": st.column_config.TextColumn("Post", width="large", disabled=True),
                "Format": st.column_config.TextColumn("Format", disabled=True),
                "Date": st.column_config.TextColumn("Date · Heure", disabled=True, width="medium"),
                "Portée": st.column_config.NumberColumn("Portée", format="%d", disabled=True),
                "Likes": st.column_config.NumberColumn("Likes", format="%d", disabled=True),
                "Saves": st.column_config.NumberColumn("Saves", format="%d", disabled=True),
                "Comm.": st.column_config.NumberColumn("Comm.", format="%d", disabled=True),
                "Engagement": st.column_config.NumberColumn("Eng. %", format="%.1f%%", disabled=True),
            },
        )

        # Sauvegarde des modifications de label (lecture via la clé dynamique)
        editor_state = st.session_state.get(editor_key, {})
        edited_rows = editor_state.get("edited_rows", {})
        if edited_rows:
            saved_count = 0
            for idx_str, changes in edited_rows.items():
                if "Label" not in changes:
                    continue
                try:
                    post_id = str(df_tbl.iloc[int(idx_str)]["id"])
                except Exception:
                    continue
                new_label = changes["Label"]
                new_labels = [new_label] if new_label else []
                try:
                    client.table("instagram_organic_posts").update(
                        {"labels": new_labels}
                    ).eq("user_id", user_id).eq("id", post_id).execute()
                    saved_count += 1
                except Exception as e:
                    st.toast(f"Sauvegarde échouée pour un post : {e}", icon="⚠️")
            if saved_count:
                st.toast(f"{saved_count} label(s) sauvegardé(s).", icon="✅")
                st.session_state[editor_key]["edited_rows"] = {}


# ── Tab Labels Instagram (même design que Meta Ads) ────────────────────────────

def _fetch_instagram_labels(client, user_id: str) -> list[str]:
    try:
        res = client.table("profiles").select("labelling").eq("id", user_id).execute()
        if res.data:
            return [l for l in (res.data[0].get("labelling") or []) if l]
    except Exception:
        pass
    return []


def _save_instagram_labels(client, user_id: str, labels: list[str]) -> None:
    client.table("profiles").update({"labelling": labels}).eq("id", user_id).execute()


def _rename_label_in_posts(client, user_id: str, old: str, new: str) -> None:
    """Remplace old → new dans le tableau labels de chaque post."""
    posts = (
        client.table("instagram_organic_posts")
        .select("id,labels").eq("user_id", user_id)
        .contains("labels", [old]).execute().data
    )
    for post in posts or []:
        updated = [new if l == old else l for l in (post.get("labels") or [])]
        client.table("instagram_organic_posts").update({"labels": updated}).eq("id", post["id"]).execute()


def _delete_label_in_posts(client, user_id: str, label: str) -> None:
    """Retire label des tableaux labels des posts qui le contiennent."""
    posts = (
        client.table("instagram_organic_posts")
        .select("id,labels").eq("user_id", user_id)
        .contains("labels", [label]).execute().data
    )
    for post in posts or []:
        updated = [l for l in (post.get("labels") or []) if l != label]
        client.table("instagram_organic_posts").update({"labels": updated}).eq("id", post["id"]).execute()


def _show_instagram_labels_tab(client, user_id, df) -> None:
    if not (client and user_id):
        st.warning("Connecte ton compte pour gérer les labels.")
        return

    # Cache session
    if "_insta_labels_init" not in st.session_state:
        st.session_state["insta_labels"] = _fetch_instagram_labels(client, user_id)
        st.session_state["_insta_labels_init"] = True
    labels: list[str] = st.session_state.get("insta_labels", [])

    # Compteur posts labelisés
    nb_total = len(df) if df is not None else 0
    nb_labeled = 0
    if df is not None and "labels" in df.columns and not df.empty:
        nb_labeled = int(df["labels"].apply(
            lambda x: bool(x and len(x) > 0 and x[0])
        ).sum())

    st.markdown(
        '<div class="page-h" style="padding:8px 0 16px;">'
        '<div class="h-eyebrow">Labels</div>'
        '<h1>Tes étiquettes de posts.</h1>'
        '<p class="h-sub">Crée des labels (ex. <i>UGC</i>, <i>Promo</i>, <i>Viral</i>) '
        'puis assigne-les à tes posts depuis l\'onglet <b>Performance</b>.</p>'
        '</div>',
        unsafe_allow_html=True,
    )

    if nb_total > 0:
        pct = nb_labeled / nb_total
        st.progress(pct, text=f"**{nb_labeled} / {nb_total}** posts labelisés ({int(pct * 100)} %)")
        st.markdown("<br>", unsafe_allow_html=True)

    # ── Ajouter (st.form gère le vidage automatique) ─────────────────────────
    st.markdown(
        '<div style="font-size:13px;font-weight:600;color:#0e0f12;margin:4px 0 12px;">'
        'Ajouter un label</div>',
        unsafe_allow_html=True,
    )
    with st.form("insta_lbl_add_form", clear_on_submit=True):
        col_in, col_btn = st.columns([4, 1])
        with col_in:
            new_lbl = st.text_input(
                "Nouveau label",
                label_visibility="collapsed", placeholder="ex: UGC, Viral, Promo...",
            )
        with col_btn:
            submitted = st.form_submit_button(
                "Ajouter", type="primary", use_container_width=True,
            )
    if submitted:
        cleaned = (new_lbl or "").strip()
        if not cleaned:
            st.toast("Saisis un nom de label.", icon="⚠️")
        elif cleaned in labels:
            st.toast(f"« {cleaned} » existe déjà.", icon="⚠️")
        else:
            new_list = labels + [cleaned]
            error = None
            try:
                _save_instagram_labels(client, user_id, new_list)
            except Exception as e:
                error = e
            if error:
                st.toast(f"Ajout échoué : {error}", icon="⚠️")
            else:
                st.session_state["insta_labels"] = new_list
                st.rerun()

    # ── Liste + renommer / supprimer ─────────────────────────────────────────
    st.markdown(
        '<div style="font-size:13px;font-weight:600;color:#0e0f12;margin:24px 0 12px;">'
        'Tes labels</div>',
        unsafe_allow_html=True,
    )

    if not labels:
        st.info("Aucun label pour l'instant. Crée-en un ci-dessus.")
        return

    hcols = st.columns([5, 2, 2])
    for col_h, lbl in zip(hcols, ["Nom", "Renommer", "Supprimer"]):
        col_h.markdown(
            f'<div style="font-size:10px;font-weight:600;text-transform:uppercase;'
            f'letter-spacing:0.06em;color:#8b8e98;padding-bottom:6px;">{lbl}</div>',
            unsafe_allow_html=True,
        )

    for i, lbl in enumerate(labels):
        c_name, c_save, c_del = st.columns([5, 2, 2])
        edit_key = f"insta_lbl_edit_{i}"
        with c_name:
            st.text_input(
                "Label", value=lbl, key=edit_key,
                label_visibility="collapsed",
            )
        with c_save:
            new_name = (st.session_state.get(edit_key) or "").strip()
            disabled = (new_name == lbl) or (not new_name) or (new_name in labels and new_name != lbl)
            if st.button("Enregistrer", key=f"insta_lbl_rn_{i}",
                         use_container_width=True, disabled=disabled):
                new_list = [new_name if x == lbl else x for x in labels]
                error = None
                try:
                    _save_instagram_labels(client, user_id, new_list)
                    _rename_label_in_posts(client, user_id, lbl, new_name)
                except Exception as e:
                    error = e
                if error:
                    st.toast(f"Renommage échoué : {error}", icon="⚠️")
                else:
                    st.session_state["insta_labels"] = new_list
                    st.rerun()
        with c_del:
            if st.button("🗑 Supprimer", key=f"insta_lbl_del_{i}", use_container_width=True):
                new_list = [x for x in labels if x != lbl]
                error = None
                try:
                    _save_instagram_labels(client, user_id, new_list)
                    _delete_label_in_posts(client, user_id, lbl)
                except Exception as e:
                    error = e
                if error:
                    st.toast(f"Suppression échouée : {error}", icon="⚠️")
                else:
                    st.session_state["insta_labels"] = new_list
                    st.rerun()
