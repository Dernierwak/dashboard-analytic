import streamlit as st
import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots

from components.dashboard import show_dashboard
from components.meta_ads import render_period_selector
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

    # Convertir 'date' en datetime tz-naive (Europe/Zurich) — utile pour le filtre période
    if "date" in df.columns:
        _dt = pd.to_datetime(df["date"], errors="coerce", utc=True)
        try:
            _dt = _dt.dt.tz_convert("Europe/Zurich").dt.tz_localize(None)
        except Exception:
            try:
                _dt = _dt.dt.tz_localize(None)
            except Exception:
                pass
        df["_date_dt"] = _dt

    tab_perf, tab_labels = st.tabs(["Performance", "Labels"])

    with tab_labels:
        _show_instagram_labels_tab(client, user_id, df)

    with tab_perf:
        # ── Sélecteur de période global Instagram ───────────────────────────
        if "_date_dt" in df.columns and df["_date_dt"].notna().any():
            since_ts, until_ts = render_period_selector(key="insta", df_dates=df["_date_dt"])
            mask = (df["_date_dt"] >= since_ts) & (df["_date_dt"] <= until_ts)
            df = df[mask].copy()

        if df.empty:
            st.info(
                "Aucun post sur cette période. Élargis la sélection ou choisis 'Tout'."
            )
            return

        # ── Recalcul des agrégats sur le df filtré ──────────────────────────
        nb_posts = len(df)
        reach_mean = df["reach"].mean() if "reach" in df.columns else 0
        nb_flew = int((df["reach"] > reach_mean).sum()) if "reach" in df.columns else 0
        reach_total = int(df["reach"].sum()) if "reach" in df.columns else 0
        likes_total = int(df["likes"].sum()) if "likes" in df.columns else 0
        saves_total = int(df["saved"].sum()) if "saved" in df.columns else 0
        engagement_pct = ((likes_total + saves_total) / reach_total * 100) if reach_total > 0 else 0.0
        saves_per_post = saves_total / nb_posts if nb_posts > 0 else 0.0

        # Hero : label dynamique selon la sélection
        _period_label = st.session_state.get("insta_period", "")
        if _period_label == "Custom":
            _hero_period = f"du {since_ts.strftime('%d %b')} au {until_ts.strftime('%d %b %Y')}"
        elif _period_label == "Tout":
            _hero_period = "tout l'historique"
        else:
            _hero_period = f"{_period_label} derniers jours"

        st.markdown(f"""
        <div class='page-h'>
            <div class='h-eyebrow'>Instagram organique · {_hero_period} · {account_name}</div>
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

            # Un seul graph combiné : bars (delta, axe gauche) + line (total, axe droit)
            fig_follow = make_subplots(specs=[[{"secondary_y": True}]])

            # ── Bars (delta) sur l'axe Y de gauche ──
            fig_follow.add_trace(
                go.Bar(
                    x=df_diff["fetched_at"], y=df_diff["delta"],
                    name="Variation",
                    marker_color=bar_colors,
                    text=text_labels,
                    textposition="outside",
                    textfont=dict(size=9, color="#0e0f12"),
                    hovertemplate="%{x|%d %b %Y}<br><b>%{y:+,} abonnés</b><extra></extra>",
                ),
                secondary_y=False,
            )

            # ── Line (total cumulé) sur l'axe Y de droite ──
            fig_follow.add_trace(
                go.Scatter(
                    x=df_grow["fetched_at"], y=df_grow["followers"],
                    name="Total",
                    mode="lines+markers",
                    line=dict(color="#3b5bff", width=2.5),
                    marker=dict(size=4, color="#fff", line=dict(color="#3b5bff", width=2)),
                    hovertemplate="%{x|%d %b %Y}<br><b>%{y:,} abonnés au total</b><extra></extra>",
                ),
                secondary_y=True,
            )

            # Ligne 0 sur l'axe de gauche
            fig_follow.add_hline(
                y=0, line_color="rgba(14,15,18,0.2)", line_width=1,
                secondary_y=False,
            )

            fig_follow.update_layout(
                template="plotly_white", height=300,
                margin=dict(l=0, r=0, t=10, b=0),
                paper_bgcolor="#fff", plot_bgcolor="#fff",
                font=dict(color="#666", family="Inter, sans-serif"),
                bargap=0.4,
                legend=dict(
                    orientation="h", yanchor="bottom", y=1.02,
                    xanchor="right", x=1,
                    font=dict(size=11, color="#5a5d66"),
                ),
                hovermode="x unified",
            )
            # Axe X
            fig_follow.update_xaxes(
                showgrid=False, color="#999",
                linecolor="rgba(0,0,0,0.07)",
                fixedrange=True,
            )
            # Axe Y gauche (delta — barres)
            fig_follow.update_yaxes(
                title_text="Variation /jour", title_font=dict(size=10, color="#8b8e98"),
                showgrid=True, gridcolor="#f4f3f1", color="#999",
                fixedrange=True, zeroline=False,
                secondary_y=False,
            )
            # Axe Y droit (total — ligne)
            fig_follow.update_yaxes(
                title_text="Total abonnés", title_font=dict(size=10, color="#3b5bff"),
                showgrid=False, color="#3b5bff",
                fixedrange=True, zeroline=False,
                secondary_y=True,
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

        # ── Section "Tes moyennes par post" (référence pour comprendre 'a décollé') ──
        likes_mean = float(df["likes"].mean()) if "likes" in df.columns else 0.0
        saves_mean = float(df["saved"].mean()) if "saved" in df.columns else 0.0
        comm_mean  = float(df["comments"].mean()) if "comments" in df.columns else 0.0
        _df_eng_avg = df[df.get("reach", 0) > 0] if "reach" in df.columns else df.head(0)
        eng_mean   = float(((_df_eng_avg["likes"] + _df_eng_avg["saved"]) / _df_eng_avg["reach"] * 100).mean()) \
            if not _df_eng_avg.empty else 0.0

        st.markdown(
            f"<div class='card' style='margin-bottom:18px;padding:14px 20px;'>"
            f"<div style='display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;'>"
            f"<div style='font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#8b8e98;'>Tes moyennes par post</div>"
            f"<div style='display:flex;gap:24px;flex-wrap:wrap;'>"
            f"<div><span style='font-size:10px;color:#8b8e98;display:block;margin-bottom:2px;'>PORTÉE</span>"
            f"<span style='font-family:var(--font-mono,monospace);font-size:14px;font-weight:600;color:#0e0f12;'>{reach_mean:,.0f}</span></div>"
            f"<div><span style='font-size:10px;color:#8b8e98;display:block;margin-bottom:2px;'>LIKES</span>"
            f"<span style='font-family:var(--font-mono,monospace);font-size:14px;font-weight:600;color:#0e0f12;'>{likes_mean:,.0f}</span></div>"
            f"<div><span style='font-size:10px;color:#8b8e98;display:block;margin-bottom:2px;'>SAVES</span>"
            f"<span style='font-family:var(--font-mono,monospace);font-size:14px;font-weight:600;color:#0e0f12;'>{saves_mean:,.0f}</span></div>"
            f"<div><span style='font-size:10px;color:#8b8e98;display:block;margin-bottom:2px;'>COMM.</span>"
            f"<span style='font-family:var(--font-mono,monospace);font-size:14px;font-weight:600;color:#0e0f12;'>{comm_mean:,.0f}</span></div>"
            f"<div><span style='font-size:10px;color:#8b8e98;display:block;margin-bottom:2px;'>ENG. %</span>"
            f"<span style='font-family:var(--font-mono,monospace);font-size:14px;font-weight:600;color:#0e0f12;'>{eng_mean:.1f}%</span></div>"
            f"</div></div>"
            f"<div style='font-size:11px;color:#8b8e98;margin-top:10px;'>"
            f"Un post 'décolle' quand sa portée dépasse la moyenne ({reach_mean:,.0f}). "
            f"Tu as <b>{nb_flew} posts</b> au-dessus.</div>"
            f"</div>",
            unsafe_allow_html=True,
        )

        # ── Ce qui marche pour toi (filtre métrique) ──────────────────────
        col_title, col_metric = st.columns([3, 2])
        with col_title:
            st.markdown(
                "<div class='section'><div class='section-head'>"
                "<span class='section-title'>Ce qui marche pour toi</span></div></div>",
                unsafe_allow_html=True,
            )
        with col_metric:
            metric_options = {
                "Portée":         ("reach",    "", "{:,.0f}"),
                "Likes":          ("likes",    "", "{:,.0f}"),
                "Saves":          ("saved",    "", "{:,.0f}"),
                "Commentaires":   ("comments", "", "{:,.0f}"),
                "Engagement %":   ("_eng_pct", "%", "{:.1f}"),
            }
            sel_metric = st.selectbox(
                "Métrique", options=list(metric_options.keys()),
                index=0, key="insta_format_metric", label_visibility="collapsed",
            )

        metric_col, metric_suffix, metric_fmt = metric_options[sel_metric]

        # Préparer la colonne dérivée engagement % si nécessaire
        df_metric = df.copy()
        if metric_col == "_eng_pct":
            df_metric["_eng_pct"] = df_metric.apply(
                lambda r: ((r.get("likes", 0) + r.get("saved", 0)) / r["reach"] * 100)
                if r.get("reach", 0) > 0 else 0.0,
                axis=1,
            )

        format_groups = {}
        if "type" in df_metric.columns and metric_col in df_metric.columns:
            for fmt, grp in df_metric.groupby("type"):
                key = fmt.upper()
                avg_val = grp[metric_col].mean()
                format_groups[key] = {"nb": len(grp), "avg": avg_val, "grp": grp}

        best_fmt = max(format_groups, key=lambda k: format_groups[k]["avg"]) if format_groups else None
        show_fmts = [k for k in ["VIDEO", "REEL", "CAROUSEL_ALBUM", "IMAGE"] if k in format_groups]
        if not show_fmts:
            show_fmts = list(format_groups.keys())[:3]

        if show_fmts:
            max_val = max(format_groups[k]["avg"] for k in show_fmts) or 1
            fmt_cols = st.columns(max(len(show_fmts), 1))
            for col_i, fmt in enumerate(show_fmts):
                info = format_groups[fmt]
                is_best = fmt == best_fmt
                chip = _format_chip(fmt, is_best)
                bar_pct = int(info["avg"] / max_val * 100)
                value_display = metric_fmt.format(info["avg"]) + metric_suffix
                note_metric_lbl = f"{sel_metric} moy."
                note = "Top format" if is_best else f"{note_metric_lbl} {value_display}"
                with fmt_cols[col_i]:
                    st.markdown(
                        f"<div class='card'>"
                        f"<div style='margin-bottom:10px;'>{chip}</div>"
                        f"<div style='font-size:24px;font-family:var(--font-mono,\"JetBrains Mono\",monospace);"
                        f"font-weight:600;color:var(--ink,#0e0f12);'>{value_display}</div>"
                        f"<div style='font-size:11px;color:var(--ink-4,#8b8e98);margin:2px 0 10px;'>"
                        f"{sel_metric.lower()} moyen · {info['nb']} posts</div>"
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

                # Best = meilleure portée moyenne parmi les vrais labels
                best_lbl = real_labels.iloc[real_labels["reach_avg"].argmax()]["_lbl"] \
                    if not real_labels.empty else None
                max_reach_avg = agg_lbl["reach_avg"].max() or 1

                # Header style "eyebrow" (comme le tab Labels)
                hcols = st.columns([3, 1.2, 1.6, 1.4, 1.4, 1.4, 1.4])
                headers = ["Label", "Posts", "Portée moy.", "Eng. %", "Likes moy.", "Saves moy.", "Comm. moy."]
                for col_h, lbl in zip(hcols, headers):
                    col_h.markdown(
                        f'<div style="font-size:10px;font-weight:600;text-transform:uppercase;'
                        f'letter-spacing:0.06em;color:#8b8e98;padding-bottom:6px;">{lbl}</div>',
                        unsafe_allow_html=True,
                    )

                # Une ligne par label (st.columns, style Labels tab)
                for _, r in agg_lbl.iterrows():
                    is_best = (r["_lbl"] == best_lbl) and r["_lbl"] != "(sans label)"
                    is_no_label = r["_lbl"] == "(sans label)"
                    bar_pct = (r["reach_avg"] / max_reach_avg * 100) if max_reach_avg > 0 else 0
                    trophy = "🏆 " if is_best else ""
                    name_color = "#8b8e98" if is_no_label else "#0e0f12"
                    name_weight = "500" if is_no_label else "600"

                    c_name, c_posts, c_reach, c_eng, c_likes, c_saves, c_comm = st.columns(
                        [3, 1.2, 1.6, 1.4, 1.4, 1.4, 1.4]
                    )
                    with c_name:
                        st.markdown(
                            f'<div style="font-size:13.5px;font-weight:{name_weight};color:{name_color};padding-top:4px;">'
                            f'{trophy}{r["_lbl"]}</div>'
                            f'<div style="height:3px;background:rgba(14,15,18,0.06);border-radius:99px;margin-top:6px;overflow:hidden;">'
                            f'<div style="height:100%;width:{bar_pct:.1f}%;background:#3b5bff;border-radius:99px;"></div>'
                            f'</div>',
                            unsafe_allow_html=True,
                        )
                    for col, val in [
                        (c_posts, f"{int(r['posts'])}"),
                        (c_reach, f"{int(r['reach_avg']):,}"),
                        (c_eng,   f"{r['eng_pct']:.1f}%"),
                        (c_likes, f"{int(r['likes_avg']):,}"),
                        (c_saves, f"{int(r['saves_avg']):,}"),
                        (c_comm,  f"{int(r['comm_avg']):,}"),
                    ]:
                        with col:
                            st.markdown(
                                f'<div style="font-family:var(--font-mono,ui-monospace,monospace);'
                                f'font-size:13px;font-weight:500;color:#0e0f12;padding-top:6px;">{val}</div>',
                                unsafe_allow_html=True,
                            )

        total_posts = len(df)

        st.markdown(
            "<div class='section'><div class='section-head'>"
            "<span class='section-title'>Tous les posts "
            f"<span class='st-count'>{total_posts} posts · scroll pour explorer</span></span></div></div>",
            unsafe_allow_html=True,
        )

        # Préparation des données par post
        df_posts = df.copy()
        # Engagement %
        df_posts["_eng"] = df_posts.apply(
            lambda r: round((r.get("likes", 0) + r.get("saved", 0)) / r["reach"] * 100, 1)
            if r.get("reach", 0) > 0 else 0.0,
            axis=1,
        )
        # Date formatée
        _dt = pd.to_datetime(df_posts["date"], errors="coerce", utc=True)
        try:
            _dt = _dt.dt.tz_convert("Europe/Zurich")
        except Exception:
            pass
        df_posts["_date_str"] = _dt.dt.strftime("%d %b %Y · %H:%M")
        # Tri par portée
        df_posts = df_posts.sort_values("reach", ascending=False)
        max_eng = df_posts["_eng"].max() or 1

        # Labels disponibles
        avail_labels = st.session_state.get("insta_labels")
        if avail_labels is None:
            try:
                _r = client.table("profiles").select("labelling").eq("id", user_id).execute()
                avail_labels = [l for l in (_r.data[0].get("labelling") if _r.data else []) or [] if l]
            except Exception:
                avail_labels = []
        label_opts = ["—"] + sorted(avail_labels)

        # Callback de sauvegarde
        def _save_post_label(post_id, key):
            val = st.session_state.get(key, "—")
            new_labels = [] if val == "—" else [val]
            try:
                client.table("instagram_organic_posts").update(
                    {"labels": new_labels}
                ).eq("user_id", user_id).eq("id", post_id).execute()
                st.toast("Label sauvegardé", icon="✅")
            except Exception as e:
                st.toast(f"Sauvegarde échouée : {e}", icon="⚠️")

        # Container scrollable (~35% de la hauteur viewport)
        with st.container(height=420, border=False):
         for _, row in df_posts.iterrows():
            post_id = str(row.get("id", ""))
            caption_full = str(row.get("caption", ""))
            caption_short = (caption_full[:70] + "…") if len(caption_full) > 70 else (caption_full or "—")
            fmt_code = str(row.get("type", "IMAGE")).upper()
            fmt_label = FORMAT_LABELS.get(fmt_code, fmt_code)
            date_str = row.get("_date_str", "—")
            reach = int(row.get("reach", 0))
            likes = int(row.get("likes", 0))
            saves = int(row.get("saved", 0))
            comms = int(row.get("comments", 0))
            eng = float(row.get("_eng", 0))

            # Label actuel
            current_label = None
            labels_list = row.get("labels")
            if isinstance(labels_list, list) and len(labels_list) > 0 and labels_list[0]:
                current_label = labels_list[0]

            # Couleur de l'engagement
            eng_color = "#1a7a4a" if eng >= max_eng * 0.66 else "#b86b00" if eng >= max_eng * 0.33 else "#c0392b"
            eng_pct = min(100, (eng / max_eng * 100)) if max_eng > 0 else 0

            with st.container(border=True):
                c_lbl, c_caption, c_fmt, c_reach, c_likes, c_saves, c_comm, c_eng = st.columns(
                    [1.6, 2.6, 1, 1, 0.9, 0.9, 0.9, 1.1]
                )

                # ── Col 1 : Label selectbox ──
                with c_lbl:
                    safe_key = f"post_lbl_{post_id[:40]}"
                    existing = current_label if (current_label in label_opts) else "—"
                    opts = label_opts.copy()
                    if current_label and current_label not in opts:
                        opts.insert(1, current_label)
                        existing = current_label
                    if safe_key not in st.session_state:
                        st.session_state[safe_key] = existing
                    st.selectbox(
                        "Label", options=opts, key=safe_key,
                        label_visibility="collapsed",
                        on_change=_save_post_label, args=(post_id, safe_key),
                    )

                # ── Col 2 : Caption + date ──
                with c_caption:
                    st.markdown(
                        f'<div style="padding-top:4px;">'
                        f'<div style="font-size:13.5px;font-weight:600;color:#0e0f12;line-height:1.2;margin-bottom:2px;">{caption_short}</div>'
                        f'<div style="font-size:11px;color:#8b8e98;">{date_str}</div>'
                        f'</div>',
                        unsafe_allow_html=True,
                    )

                # ── Col 3 : Format chip ──
                with c_fmt:
                    st.markdown(
                        f'<div style="padding-top:8px;"><span class="chip outline">{fmt_label}</span></div>',
                        unsafe_allow_html=True,
                    )

                # ── Cols 4-7 : Portée / Likes / Saves / Comm ──
                cells = [
                    (c_reach, "PORTÉE", f"{reach:,}"),
                    (c_likes, "LIKES",  f"{likes:,}"),
                    (c_saves, "SAVES",  f"{saves:,}"),
                    (c_comm,  "COMM.",  f"{comms:,}"),
                ]
                for col, lbl, val in cells:
                    with col:
                        st.markdown(
                            f'<div style="text-align:right;">'
                            f'<div style="font-size:10px;font-weight:600;text-transform:uppercase;'
                            f'letter-spacing:0.06em;color:#8b8e98;margin-bottom:4px;">{lbl}</div>'
                            f'<div style="font-family:var(--font-mono);font-size:13px;'
                            f'font-weight:500;color:#0e0f12;">{val}</div>'
                            f'</div>',
                            unsafe_allow_html=True,
                        )

                # ── Col 8 : Engagement % + barre ──
                with c_eng:
                    st.markdown(
                        f'<div style="text-align:right;">'
                        f'<div style="font-size:10px;font-weight:600;text-transform:uppercase;'
                        f'letter-spacing:0.06em;color:#8b8e98;margin-bottom:4px;">ENG. %</div>'
                        f'<div style="font-family:var(--font-mono);font-size:13px;font-weight:500;color:{eng_color};">{eng:.1f}%</div>'
                        f'<div class="bar" style="margin-top:3px;"><span style="width:{eng_pct}%;background:{eng_color};"></span></div>'
                        f'</div>',
                        unsafe_allow_html=True,
                    )


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
            if st.button("Enregistrer", key=f"insta_lbl_rn_{i}",
                         use_container_width=True):
                # Validation au moment du click (pas avant)
                new_name = (st.session_state.get(edit_key) or "").strip()
                if new_name == lbl:
                    st.toast("Aucun changement.", icon="ℹ️")
                elif not new_name:
                    st.toast("Nom de label vide.", icon="⚠️")
                elif new_name in labels:
                    st.toast(f"« {new_name} » existe déjà.", icon="⚠️")
                else:
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
                        st.toast(f"Renommé en « {new_name} »", icon="✅")
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
