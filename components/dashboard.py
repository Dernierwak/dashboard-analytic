import streamlit as st
import pandas as pd
import plotly.express as px

from scripts.fetch_data import fetch_post_metrics, fetch_daily_followers
from components.ai_reco import show_ai_reco
from components.labelling_module import Labelling
from components.insights_panel import show_right_panel
from components.export import show_export_button


COLOR_MAP = {
    "IMAGE": "#0a0a0a",
    "VIDEO": "#1a56ff",
    "CAROUSEL_ALBUM": "#6b7dd6",
}

METRIC_OPTIONS = {
    "Likes": "likes",
    "Reach": "reach",
    "Views": "views",
    "Commentaires": "comments",
    "Sauvegardés": "saved",
    "Follows": "follows",
}

# Gradients per post type
_GRADIENTS = {
    "IMAGE":         ("linear-gradient(135deg,#e9e3d6,#c8b58a)", "#b86b00"),
    "VIDEO":         ("linear-gradient(135deg,#d6e0ff,#3b5bff88)", "#3b5bff"),
    "CAROUSEL_ALBUM":("linear-gradient(135deg,#fde2c8,#f0bf8a)", "#c0392b"),
}

# Pulse CSS injected once at dashboard level
_INSTA_CSS = """<style>
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&family=Inter:wght@400;500;600&display=swap');
:root {
    --brand:#3b5bff;--good:#1a7a4a;--bad:#c0392b;--warn:#b86b00;
    --ink:#0e0f12;--ink-3:#5a5d66;--ink-4:#8b8e98;
    --line:rgba(14,15,18,0.08);
    --font-mono:"JetBrains Mono",ui-monospace,monospace;
    --font-display:"Instrument Serif",Georgia,serif;
}
/* Hero */
.page-h { padding:28px 0 20px; }
.h-eyebrow {
    font-size:11.5px;font-weight:600;text-transform:uppercase;
    letter-spacing:0.08em;color:#8b8e98;margin-bottom:10px;
    font-family:var(--font-mono);
}
.page-h h1 {
    font-family:var(--font-display) !important;
    font-size:2rem !important;font-weight:400 !important;
    color:#0e0f12 !important;line-height:1.2 !important;margin:0 0 8px !important;
}
.h-sub { font-size:13.5px;color:#5a5d66;line-height:1.6;margin:0;max-width:560px; }
/* Sections */
.section { margin-bottom:32px; }
.section-head { display:flex;justify-content:space-between;align-items:center;margin-bottom:12px; }
.section-title { font-size:14px;font-weight:600;color:#0e0f12;display:flex;align-items:center;gap:8px; }
.st-count { font-size:11.5px;color:#8b8e98;font-weight:400; }
/* Cards */
.card { background:#fff;border:1px solid rgba(14,15,18,0.08);border-radius:14px;padding:20px; }
.card.flush { padding:0;overflow:hidden; }
/* Chips */
.chip {
    display:inline-flex;align-items:center;gap:4px;padding:3px 9px;
    border-radius:999px;font-size:11.5px;font-weight:500;
    background:rgba(14,15,18,0.06);color:#0e0f12;white-space:nowrap;
}
.chip.outline { background:transparent;border:1px solid rgba(14,15,18,0.12);color:#5a5d66; }
.chip.tiny { font-size:10px;padding:2px 7px; }
/* KPI strip */
.kpi-strip-row { display:flex;gap:12px;margin-bottom:24px; }
.kpi-cell-strip {
    flex:1;background:#fff;border:1px solid rgba(14,15,18,0.08);
    border-radius:12px;padding:14px 16px;min-width:0;
}
.kpi-label-strip {
    font-size:11px;font-weight:600;color:#8b8e98;text-transform:uppercase;
    letter-spacing:0.06em;margin-bottom:6px;
}
.kpi-value-strip {
    font-size:1.5rem;font-weight:700;color:#0e0f12;line-height:1.1;
    font-family:var(--font-mono);
}
.kpi-delta-strip { font-size:11px;font-weight:500;margin-top:4px; }
.kpi-delta-strip.rp-pos { color:#1a7a4a; }
.kpi-delta-strip.rp-neg { color:#c0392b; }
/* Format cards */
.fmt-card { background:#fff;border:1px solid rgba(14,15,18,0.08);border-radius:14px;padding:20px; }
.fmt-bars { display:flex;align-items:flex-end;gap:5px;height:60px;margin:12px 0; }
.fmt-bars span { flex:1;border-radius:3px 3px 0 0;opacity:0.85;min-height:4px; }
/* Post cards */
.post-card { background:#fff;border:1px solid rgba(14,15,18,0.08);border-radius:14px;overflow:hidden; }
.post-cover { height:180px;position:relative; }
.post-body { padding:14px; }
.post-stats-grid {
    display:grid;grid-template-columns:repeat(4,1fr);gap:6px;
    padding-top:10px;border-top:1px solid rgba(14,15,18,0.08);
    margin-top:10px;
}
.stat-cell { text-align:center; }
.stat-val { font-family:var(--font-mono);font-size:13px;font-weight:500;color:#0e0f12; }
.stat-lbl { font-size:9.5px;color:#8b8e98;text-transform:uppercase;letter-spacing:0.05em;margin-top:2px; }
</style>"""


def _kpi_cell(label: str, value: str, delta: int | None = None) -> str:
    delta_html = ""
    if delta is not None:
        cls = "rp-pos" if delta >= 0 else "rp-neg"
        sign = "+" if delta >= 0 else ""
        delta_html = f'<div class="kpi-delta-strip {cls}">{sign}{delta:,} abonnés cette semaine</div>'
    return (
        f'<div class="kpi-cell-strip">'
        f'<div class="kpi-label-strip">{label}</div>'
        f'<div class="kpi-value-strip">{value}</div>'
        f'{delta_html}'
        f'</div>'
    )


def _format_card(label: str, count: int, avg_reach: float, bars: list[float],
                 color: str, badge: str, note: str) -> str:
    max_b = max(bars) if bars else 1
    bars_html = "".join(
        f'<span style="height:{max(4, int(b/max_b*100))}%;background:{color};"></span>'
        for b in bars
    )
    badge_html = f'<span class="chip tiny" style="background:{color}1a;color:{color};">{badge}</span>' if badge else ""
    reach_str = f"{avg_reach/1000:.1f}k" if avg_reach >= 1000 else f"{int(avg_reach):,}"
    return f"""
    <div class="fmt-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="font-size:14px;font-weight:600;">{label}</div>
          <div style="font-size:11.5px;color:#8b8e98;margin-top:2px;">{count} publiés</div>
        </div>
        {badge_html}
      </div>
      <div class="fmt-bars">{bars_html}</div>
      <div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#8b8e98;margin-bottom:2px;">Portée moy.</div>
        <div style="font-family:var(--font-mono);font-size:20px;font-weight:500;letter-spacing:-0.02em;">{reach_str}</div>
      </div>
      <div style="margin-top:10px;padding-top:10px;border-top:1px dashed rgba(14,15,18,0.08);font-size:11.5px;color:#5a5d66;">{note}</div>
    </div>"""


def _post_card(row: pd.Series, rank: int, metric_label: str) -> str:
    post_type = str(row.get("type", "IMAGE")).upper()
    gradient, accent = _GRADIENTS.get(post_type, _GRADIENTS["IMAGE"])
    type_label = {"IMAGE": "IMAGE", "VIDEO": "REEL", "CAROUSEL_ALBUM": "CAROUSEL"}.get(post_type, post_type)
    date_str = str(row.get("date", ""))
    caption = str(row.get("caption", ""))[:80]
    reach = int(row.get("reach", 0))
    likes = int(row.get("likes", 0))
    saves = int(row.get("saved", 0))
    comments = int(row.get("comments", 0))
    reach_str = f"{reach/1000:.1f}k" if reach >= 1000 else f"{reach:,}"
    highlight = "Meilleur post" if rank == 0 else ""

    highlight_badge = (
        f'<span class="chip" style="position:absolute;top:10px;right:10px;'
        f'background:#fff;color:#0e0f12;font-size:10px;font-weight:600;">{highlight}</span>'
        if highlight else ""
    )
    return f"""
    <div class="post-card">
      <div class="post-cover" style="background:{gradient};">
        <span class="chip" style="position:absolute;top:10px;left:10px;
              background:rgba(0,0,0,0.65);color:#fff;font-size:10px;">{type_label}</span>
        {highlight_badge}
      </div>
      <div class="post-body">
        <div style="font-size:11px;color:#8b8e98;margin-bottom:6px;">{date_str}</div>
        <div style="font-size:12.5px;line-height:1.5;min-height:36px;">{caption}</div>
        <div class="post-stats-grid">
          <div class="stat-cell"><div class="stat-val">{reach_str}</div><div class="stat-lbl">Portée</div></div>
          <div class="stat-cell"><div class="stat-val">{likes:,}</div><div class="stat-lbl">Likes</div></div>
          <div class="stat-cell"><div class="stat-val">{saves:,}</div><div class="stat-lbl">Saves</div></div>
          <div class="stat-cell"><div class="stat-val">{comments:,}</div><div class="stat-lbl">Comm.</div></div>
        </div>
      </div>
    </div>"""


@st.cache_data(ttl=300, show_spinner=False)
def _load_posts(_client, user_id: str):
    data = fetch_post_metrics(_client, user_id)
    return pd.DataFrame(data or [])


@st.fragment
def show_dashboard(client, user_id, is_paid=False, account_name: str = "Instagram"):
    st.markdown(_INSTA_CSS, unsafe_allow_html=True)
    st.session_state["_posts_cache_clear"] = _load_posts.clear
    try:
        df = _load_posts(client, user_id)
    except Exception as e:
        st.error(f"Erreur de connexion Supabase : {e}")
        return

    if df.empty:
        st.markdown(
            "<div style='color:#6b6b6b;padding:20px 0'>Aucune donnée. "
            "Cliquez sur <b>Récupérer mes données Instagram</b> dans Mon compte.</div>",
            unsafe_allow_html=True,
        )
        return

    # ── Followers ────────────────────────────────────────────────────────────
    follows_raw = fetch_daily_followers(client, user_id)
    df_follows = pd.DataFrame(follows_raw) if follows_raw else pd.DataFrame()
    followers_current = 0
    followers_delta = 0
    if not df_follows.empty:
        df_follows = df_follows.sort_values("fetched_at", ascending=False)
        followers_current = int(df_follows.iloc[0]["followers"])
        if len(df_follows) >= 7:
            followers_delta = followers_current - int(df_follows.iloc[6]["followers"])

    nb_posts = len(df)
    top_reach = int(df["reach"].max()) if "reach" in df.columns and not df.empty else 0
    top_reach_str = f"{top_reach/1000:.1f}k" if top_reach >= 1000 else f"{top_reach:,}"

    # ── Hero ────────────────────────────────────────────────────────────────
    st.markdown(
        f'<div class="page-h">'
        f'<div class="h-eyebrow">Instagram organique · {account_name}</div>'
        f'<h1>{nb_posts} posts publiés, portée max {top_reach_str}.</h1>'
        f'<p class="h-sub">'
        f'Followers : <b>{followers_current:,}</b>'
        f'{f" (+{followers_delta:,} cette semaine)" if followers_delta > 0 else ""}. '
        f'Analyse tes formats et tes meilleurs créneaux ci-dessous.'
        f'</p>'
        f'</div>',
        unsafe_allow_html=True,
    )

    # ── KPI strip ────────────────────────────────────────────────────────────
    reach_total = int(df["reach"].sum()) if "reach" in df.columns else 0
    likes_total = int(df["likes"].sum()) if "likes" in df.columns else 0
    saves_total = int(df["saved"].sum()) if "saved" in df.columns else 0

    st.markdown(
        f'<div class="kpi-strip-row">'
        f'{_kpi_cell("Followers", f"{followers_current:,}", followers_delta if followers_delta else None)}'
        f'{_kpi_cell("Portée totale", f"{reach_total:,}")}'
        f'{_kpi_cell("Likes", f"{likes_total:,}")}'
        f'{_kpi_cell("Sauvegardes", f"{saves_total:,}")}'
        f'</div>',
        unsafe_allow_html=True,
    )

    # ── Recommandation IA + Insights / Export ────────────────────────────────
    col_title, col_insights_btn, col_export_btn = st.columns([4, 1, 1])
    with col_title:
        st.markdown("<div class='section-title'>Recommandation IA</div>", unsafe_allow_html=True)
    with col_insights_btn:
        with st.popover("💡 Insights", use_container_width=True):
            show_right_panel(df=df, is_paid=is_paid, followers_delta=followers_delta)
    with col_export_btn:
        show_export_button(
            df=df,
            account_name=account_name,
            followers_current=followers_current,
            followers_delta=followers_delta,
            supabase=client,
            user_id=user_id,
        )

    show_ai_reco(supabase=client, user_id=user_id, is_paid=is_paid, df=df, followers_delta=followers_delta)

    st.markdown("<hr style='border:none;border-top:1px solid rgba(0,0,0,0.07);margin:24px 0'>", unsafe_allow_html=True)

    # ── Ce qui marche — FormatCards ──────────────────────────────────────────
    if "type" in df.columns and "reach" in df.columns:
        st.markdown('<div class="section-head"><div class="section-title">Ce qui marche pour toi</div></div>', unsafe_allow_html=True)

        type_labels = {
            "VIDEO":          ("Reels",      "#3b5bff"),
            "CAROUSEL_ALBUM": ("Carrousels", "#6b7dd6"),
            "IMAGE":          ("Images",     "#0e0f12"),
        }
        cards_html = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:28px;">'
        formats_present = [t for t in ["VIDEO", "CAROUSEL_ALBUM", "IMAGE"] if t in df["type"].values]

        avg_reach_by_type = {
            t: df[df["type"] == t]["reach"].mean() for t in formats_present
        }
        best_type = max(avg_reach_by_type, key=avg_reach_by_type.get) if avg_reach_by_type else None

        for fmt_type in formats_present:
            grp = df[df["type"] == fmt_type].sort_values("date") if "date" in df.columns else df[df["type"] == fmt_type]
            bars = grp["reach"].tail(5).tolist()
            avg_r = grp["reach"].mean()
            count = len(grp)
            label, color = type_labels.get(fmt_type, (fmt_type, "#8b8e98"))
            badge = "🏆 Meilleur" if fmt_type == best_type else ""
            if fmt_type == best_type and len(formats_present) > 1:
                other_avg = sum(avg_reach_by_type[t] for t in formats_present if t != fmt_type) / max(1, len(formats_present) - 1)
                ratio = avg_r / max(other_avg, 1)
                note = f"{ratio:.1f}× la portée moyenne des autres formats"
            elif count == 0:
                note = "Aucun post sur cette période"
            else:
                note = "Format régulier — bonne cohérence de feed"
            cards_html += _format_card(label, count, avg_r, bars, color, badge, note)

        cards_html += "</div>"
        st.markdown(cards_html, unsafe_allow_html=True)

    if not df_follows.empty and len(df_follows) > 1:
        with st.expander("Évolution des followers", expanded=False):
            import plotly.graph_objects as go
            from plotly.subplots import make_subplots
            df_plot = df_follows.sort_values("fetched_at").copy()
            df_plot["delta"] = df_plot["followers"].diff()
            df_plot["gain"] = df_plot["delta"].apply(lambda x: x if x and x > 0 else 0)
            df_plot["perte"] = df_plot["delta"].apply(lambda x: x if x and x < 0 else 0)
            fig = make_subplots(rows=2, cols=1, shared_xaxes=True, row_heights=[0.6, 0.4], vertical_spacing=0.05)
            fig.add_trace(go.Scatter(x=df_plot["fetched_at"], y=df_plot["followers"], name="Followers", line=dict(color="#1a56ff", width=2)), row=1, col=1)
            fig.add_trace(go.Bar(x=df_plot["fetched_at"], y=df_plot["gain"], name="Gain", marker_color="#1a7a4a", opacity=0.7), row=2, col=1)
            fig.add_trace(go.Bar(x=df_plot["fetched_at"], y=df_plot["perte"], name="Perte", marker_color="#c0392b", opacity=0.7), row=2, col=1)
            fig.update_layout(
                template="plotly_white", height=300,
                margin=dict(l=0, r=0, t=10, b=0),
                paper_bgcolor="#ffffff", plot_bgcolor="#ffffff",
                font=dict(color="#666", family="Inter, sans-serif"),
                barmode="relative", showlegend=False,
                xaxis2=dict(showgrid=False), yaxis=dict(showgrid=True, gridcolor="#f4f3f1"),
                yaxis2=dict(showgrid=True, gridcolor="#f4f3f1"),
            )
            st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})

    st.markdown("<hr style='border:none;border-top:1px solid rgba(0,0,0,0.07);margin:24px 0'>", unsafe_allow_html=True)

    # ── Filtre label ──────────────────────────────────────────────────────────
    _labels_in_df = []
    if "labels" in df.columns:
        _labels_in_df = sorted(set(
            x[0] for x in df["labels"] if x and len(x) > 0 and x[0]
        ))
    label_filter = []
    if _labels_in_df:
        label_filter = st.multiselect(
            "Filtrer par label",
            options=_labels_in_df,
            key="main_label_filter",
            label_visibility="collapsed",
            placeholder="Tous les posts — filtrer par label",
        )
    df_view = (
        df[df["labels"].apply(lambda x: bool(x and len(x) > 0 and x[0] in label_filter))].copy()
        if label_filter and "labels" in df.columns else df
    )

    # ── Graphique ────────────────────────────────────────────────────────────
    st.markdown('<div class="section-head"><div class="section-title">Évolution par post</div></div>', unsafe_allow_html=True)

    col_metric, _ = st.columns([2, 3])
    with col_metric:
        selected_label = st.selectbox("Métrique", list(METRIC_OPTIONS.keys()), label_visibility="collapsed")
    selected_metric = METRIC_OPTIONS[selected_label]

    fig = px.bar(
        df_view.sort_values("date"),
        x="date", y=selected_metric, color="type",
        color_discrete_map=COLOR_MAP,
        labels={"date": "Date", selected_metric: selected_label, "type": "Type"},
    )
    fig.update_layout(
        template="plotly_white",
        height=300, margin=dict(l=0, r=0, t=10, b=0),
        paper_bgcolor="#ffffff", plot_bgcolor="#ffffff",
        font=dict(color="#666", family="Inter, sans-serif"),
        legend=dict(orientation="h", y=1.1, font=dict(color="#666")),
        xaxis=dict(showgrid=False, color="#999", linecolor="rgba(0,0,0,0.07)"),
        yaxis=dict(showgrid=True, gridcolor="#f4f3f1", color="#999"),
    )
    st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})

    # ── Top 3 PostCards ──────────────────────────────────────────────────────
    st.markdown(
        f'<div class="section-head">'
        f'<div class="section-title">Top 3 <span class="st-count">par {selected_label.lower()}</span></div>'
        f'</div>',
        unsafe_allow_html=True,
    )
    top3 = df_view.nlargest(3, selected_metric)
    if not top3.empty:
        cards_cols = top3.apply(lambda r: _post_card(r, i, selected_label) for i, (_, r) in enumerate(top3.iterrows()))
        cards_html = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">'
        for i, (_, row) in enumerate(top3.iterrows()):
            cards_html += _post_card(row, i, selected_label)
        cards_html += "</div>"
        st.markdown(cards_html, unsafe_allow_html=True)

    st.markdown("<hr style='border:none;border-top:1px solid rgba(0,0,0,0.07);margin:24px 0'>", unsafe_allow_html=True)

    # ── Tous les posts ────────────────────────────────────────────────────────
    st.markdown('<div class="section-head"><div class="section-title">Tous les posts</div></div>', unsafe_allow_html=True)

    labelling = Labelling(client=client, user_id=user_id, df=df)
    labels_options = [l for l in st.session_state.get("labels_list", []) if l]

    cols_order = ["caption", "type", "date", "follows", "likes", "comments", "saved", "views", "reach"]
    cols_available = [c for c in cols_order if c in df.columns]
    df_display = df[cols_available].copy()
    df_display.insert(
        0, "label",
        df["labels"].apply(lambda x: x[0] if x and len(x) > 0 else None)
        if "labels" in df.columns else None,
    )

    col_config = {
        "label": st.column_config.SelectboxColumn("Label", options=labels_options, required=False),
        "caption": st.column_config.TextColumn("Caption", disabled=True),
        "type": st.column_config.TextColumn("Type", disabled=True),
        "date": st.column_config.TextColumn("Date", disabled=True),
        "follows": st.column_config.NumberColumn("Follows", disabled=True),
        "likes": st.column_config.NumberColumn("Likes", disabled=True),
        "comments": st.column_config.NumberColumn("Commentaires", disabled=True),
        "saved": st.column_config.NumberColumn("Sauvegardés", disabled=True),
        "views": st.column_config.NumberColumn("Views", disabled=True),
        "reach": st.column_config.NumberColumn("Reach", disabled=True),
    }
    edited = st.data_editor(
        df_display,
        column_config=col_config,
        hide_index=True,
        use_container_width=True,
        key="editor_tableau_labels",
    )
    if st.button("Sauvegarder les labels", key="btn_save_tableau"):
        with st.spinner("Mise à jour..."):
            for i, row in edited.iterrows():
                post_id = str(df["id"].iloc[i])
                label = row["label"]
                label = None if (label is None or (isinstance(label, float) and pd.isna(label))) else str(label)
                new_labels = [label] if label else []
                labelling.supabase.table("instagram_organic_posts").update({
                    "labels": new_labels
                }).eq("user_id", user_id).eq("id", post_id).execute()
        _load_posts.clear()
        st.success("Sauvegardé.")

    if labels_options:
        labelling._batch_assign()

    with st.expander("🗓️ Vue calendrier", expanded=False):
        cal_color_by = st.radio(
            "Colorier par", ["Type de post", "Label"],
            horizontal=True, key="cal_color_mode",
        )
        df_cal = df.copy()
        df_cal["date"] = pd.to_datetime(df_cal["date"], errors="coerce")
        df_cal = df_cal.dropna(subset=["date"])
        df_cal["week"] = df_cal["date"].dt.isocalendar().week.astype(int)
        df_cal["day_of_week"] = df_cal["date"].dt.dayofweek

        if cal_color_by == "Label" and "labels" in df_cal.columns:
            df_cal["_cal_label"] = df_cal["labels"].apply(
                lambda x: x[0] if x and len(x) > 0 else "Sans label"
            )
            fig_cal = px.scatter(
                df_cal, x="week", y="day_of_week", color="_cal_label",
                color_discrete_sequence=px.colors.qualitative.Set2,
                hover_data={"date": True, "caption": True, "reach": True, "likes": True, "week": False, "day_of_week": False, "_cal_label": False},
                labels={"week": "Semaine", "day_of_week": "Jour", "_cal_label": "Label"},
            )
        else:
            fig_cal = px.scatter(
                df_cal, x="week", y="day_of_week", color="type",
                color_discrete_map=COLOR_MAP,
                hover_data={"date": True, "caption": True, "reach": True, "likes": True, "week": False, "day_of_week": False},
                labels={"week": "Semaine", "day_of_week": "Jour"},
            )
        fig_cal.update_traces(marker=dict(size=14, symbol="square"))
        fig_cal.update_layout(
            template="plotly_white", height=280,
            margin=dict(l=0, r=0, t=10, b=0),
            paper_bgcolor="#ffffff", plot_bgcolor="#ffffff",
            font=dict(color="#666", family="Inter, sans-serif"),
            yaxis=dict(
                tickmode="array", tickvals=[0, 1, 2, 3, 4, 5, 6],
                ticktext=["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"],
                showgrid=True, gridcolor="#f4f3f1",
            ),
            xaxis=dict(showgrid=False, title="Semaine de l'année"),
        )
        st.plotly_chart(fig_cal, use_container_width=True, config={"displayModeBar": False})

    st.markdown("<hr style='border:none;border-top:1px solid rgba(0,0,0,0.07);margin:24px 0'>", unsafe_allow_html=True)

    # ── Labels ────────────────────────────────────────────────────────────────
    st.markdown("<div class='section-title'>Labels</div>", unsafe_allow_html=True)

    labelling_mgr = Labelling(client=client, user_id=user_id, df=df)

    has_labels_data = False
    if "labels" in df.columns:
        df_lab = df[df["labels"].apply(lambda x: bool(x and len(x) > 0 and x[0]))].copy()
        if not df_lab.empty:
            has_labels_data = True
            df_lab["label"] = df_lab["labels"].apply(lambda x: x[0])

            lab_metric_name = st.selectbox(
                "Métrique labels", list(METRIC_OPTIONS.keys()),
                key="lab_metric_sel", label_visibility="collapsed",
            )
            lab_metric_col = METRIC_OPTIONS[lab_metric_name]

            col_bar_l, col_donut_l = st.columns([3, 2])
            with col_bar_l:
                avg_df = df_lab.groupby("label")[lab_metric_col].mean().reset_index()
                avg_df.columns = ["label", "moyenne"]
                avg_df = avg_df.sort_values("moyenne")
                fig_bar_lab = px.bar(
                    avg_df, x="moyenne", y="label", orientation="h",
                    labels={"moyenne": f"Moy. {lab_metric_name}", "label": ""},
                    color="label",
                    color_discrete_sequence=px.colors.qualitative.Set2,
                )
                fig_bar_lab.update_layout(
                    template="plotly_white",
                    height=max(180, len(avg_df) * 50),
                    margin=dict(l=0, r=0, t=10, b=0),
                    paper_bgcolor="#ffffff", plot_bgcolor="#ffffff",
                    font=dict(color="#666", family="Inter, sans-serif"),
                    showlegend=False,
                )
                st.plotly_chart(fig_bar_lab, use_container_width=True, config={"displayModeBar": False})

            with col_donut_l:
                cnt_df = df_lab.groupby("label").size().reset_index(name="posts")
                fig_donut = px.pie(
                    cnt_df, values="posts", names="label", hole=0.55,
                    color_discrete_sequence=px.colors.qualitative.Set2,
                )
                fig_donut.update_layout(
                    template="plotly_white", height=220,
                    margin=dict(l=0, r=0, t=10, b=20),
                    paper_bgcolor="#ffffff",
                    font=dict(color="#666", family="Inter, sans-serif"),
                    legend=dict(orientation="h", y=-0.2),
                )
                fig_donut.update_traces(textposition="inside", textinfo="percent+label")
                st.plotly_chart(fig_donut, use_container_width=True, config={"displayModeBar": False})

            st.markdown("<div class='section-title' style='margin-top:8px;'>Top post par label</div>", unsafe_allow_html=True)
            _all_labels = sorted(df_lab["label"].unique().tolist())
            for _i in range(0, len(_all_labels), 3):
                _chunk = _all_labels[_i:_i + 3]
                _top_cols = st.columns(len(_chunk))
                for _j, _lbl in enumerate(_chunk):
                    _df_lbl = df_lab[df_lab["label"] == _lbl]
                    if _df_lbl.empty:
                        continue
                    _best = _df_lbl.sort_values("likes", ascending=False, na_position="last").iloc[0]
                    with _top_cols[_j]:
                        st.markdown(f"**{_lbl}**")
                        _likes = int(_best["likes"]) if pd.notna(_best.get("likes")) else 0
                        _reach = int(_best["reach"]) if pd.notna(_best.get("reach")) else 0
                        _saved = int(_best["saved"]) if pd.notna(_best.get("saved")) else 0
                        st.markdown(
                            f"👍 **{_likes:,}** &nbsp;·&nbsp; "
                            f"👁 **{_reach:,}** &nbsp;·&nbsp; "
                            f"🔖 **{_saved:,}**",
                            unsafe_allow_html=True,
                        )
                        st.caption(f"{_best.get('date', '')} · {_best.get('type', '')}")

    if not has_labels_data:
        st.markdown(
            '<div style="background:#fafaf9;border:1px solid rgba(0,0,0,0.07);border-radius:8px;padding:16px 20px;">'
            '<div style="font-size:13px;font-weight:500;color:#0a0a0a;margin-bottom:6px;">Aucun label assigné</div>'
            '<div style="font-size:12px;color:#666;line-height:1.6;">'
            'Les labels te permettent de mesurer tes types de contenu : '
            '<em>Reel viral</em>, <em>UGC</em>, <em>Campagne promo</em>… '
            'Crée tes labels ci-dessous et assigne-les à tes posts dans le tableau ci-dessus.'
            '</div>'
            '</div>',
            unsafe_allow_html=True,
        )

    with st.expander("🏷️ Gérer les labels", expanded=not has_labels_data):
        labelling_mgr._manage_labels()
