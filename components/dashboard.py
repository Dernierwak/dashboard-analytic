import streamlit as st
import pandas as pd
import plotly.express as px

from scripts.fetch_data import fetch_post_metrics, fetch_daily_followers
from components.ai_reco import show_ai_reco


COLOR_MAP = {
    "IMAGE": "#191919",
    "VIDEO": "#0066ff",
    "CAROUSEL_ALBUM": "#173f91",
}

METRIC_OPTIONS = {
    "Likes": "likes",
    "Reach": "reach",
    "Views": "views",
    "Commentaires": "comments",
    "Sauvegardés": "saved",
    "Follows": "follows",
}


def _kpi_card(label, value, delta=None, delta_label=None):
    delta_html = ""
    if delta is not None:
        cls = "positive" if delta >= 0 else "negative"
        sign = "+" if delta >= 0 else ""
        text = delta_label or f"{sign}{delta:,}"
        delta_html = f"<div class='kpi-delta {cls}'>{text}</div>"
    st.markdown(f"""
    <div class='kpi-card'>
        <div class='kpi-label'>{label}</div>
        <div class='kpi-value'>{value}</div>
        {delta_html}
    </div>
    """, unsafe_allow_html=True)


@st.fragment
def follower_module(client, user_id):
    follows = fetch_daily_followers(client, user_id)
    df_follows = pd.DataFrame(follows)

    if df_follows.empty:
        st.markdown("<div style='color:#6b6b6b;padding:12px 0'>Aucune donnée de followers disponible.</div>", unsafe_allow_html=True)
        return

    df_follows = df_follows.sort_values("fetched_at", ascending=False)
    max_follows = df_follows.shape[0]

    st.markdown("<div class='section-title'>Followers</div>", unsafe_allow_html=True)

    col_kpi, col_slider = st.columns([1, 2])
    with col_slider:
        time_range = st.select_slider("Comparer sur (jours)", options=range(0, 30), value=0)

    current = int(df_follows.iloc[0]["followers"])
    
    with col_kpi:
        if time_range == 0 or time_range >= max_follows:
            _kpi_card("Followers actuels", f"{current:,}")
        else:
            past = int(df_follows.iloc[time_range]["followers"])
            delta = current - past
            _kpi_card("Followers actuels", f"{current:,}", delta=delta)

    if time_range >= max_follows and time_range > 0:
        st.caption(f"Seulement {max_follows} jour(s) de données disponibles.")

    fig = px.line(
        df_follows.sort_values("fetched_at"),
        x="fetched_at", y="followers",
        labels={"fetched_at": "Date", "followers": "Followers"},
    )
    fig.update_traces(line_color="#0066ff", line_width=2)
    fig.update_layout(
        template="plotly_white",
        height=220, margin=dict(l=0, r=0, t=10, b=0),
        paper_bgcolor="#ffffff", plot_bgcolor="#ffffff",
        font=dict(color="#37352f", family="Inter, sans-serif"),
        xaxis=dict(showgrid=False, color="#6b6b6b", linecolor="#eaeaea"),
        yaxis=dict(showgrid=True, gridcolor="#f0f0f0", color="#6b6b6b"),
    )
    st.plotly_chart(fig, use_container_width=True)


def show_dashboard(client, user_id, is_paid=False):
    data = fetch_post_metrics(client) or []

    if not data:
        st.markdown("<div style='color:#6b6b6b;padding:20px 0'>Aucune donnée. Cliquez sur <b>Récupérer mes données Instagram</b> pour commencer.</div>", unsafe_allow_html=True)
        return

    df = pd.DataFrame(data)

    # ── Recommandations IA ────────────────────────────────────────────────
    show_ai_reco(supabase=client, user_id=user_id, is_paid=is_paid, df=df)

    st.markdown("<hr style='border:none;border-top:1px solid #eaeaea;margin:24px 0'>", unsafe_allow_html=True)

    # ── Zone KPI ──────────────────────────────────────────────────────────
    st.markdown("<div class='section-title'>Performance globale</div>", unsafe_allow_html=True)
    c1, c2, c3, c4 = st.columns(4)
    with c1:
        _kpi_card("Likes", f"{int(df['likes'].sum()):,}")
    with c2:
        _kpi_card("Reach", f"{int(df['reach'].sum()):,}" if "reach" in df.columns else "—")
    with c3:
        _kpi_card("Commentaires", f"{int(df['comments'].sum()):,}")
    with c4:
        _kpi_card("Sauvegardés", f"{int(df['saved'].sum()):,}")

    st.markdown("<br>", unsafe_allow_html=True)

    # ── Zone graphique ────────────────────────────────────────────────────
    st.markdown("<div class='section-title'>Évolution par post</div>", unsafe_allow_html=True)
    selected_label = st.selectbox("Métrique", list(METRIC_OPTIONS.keys()), label_visibility="collapsed")
    selected_metric = METRIC_OPTIONS[selected_label]

    fig = px.bar(
        df.sort_values("date"),
        x="date", y=selected_metric, color="type",
        color_discrete_map=COLOR_MAP,
        labels={"date": "Date", selected_metric: selected_label, "type": "Type"},
    )
    fig.update_layout(
        template="plotly_white",
        height=320, margin=dict(l=0, r=0, t=10, b=0),
        paper_bgcolor="#ffffff", plot_bgcolor="#ffffff",
        font=dict(color="#37352f", family="Inter, sans-serif"),
        legend=dict(orientation="h", y=1.1, font=dict(color="#37352f")),
        xaxis=dict(showgrid=False, color="#6b6b6b", linecolor="#eaeaea"),
        yaxis=dict(showgrid=True, gridcolor="#f0f0f0", color="#6b6b6b"),
    )
    st.plotly_chart(fig, use_container_width=True)

    # ── Top 3 posts ───────────────────────────────────────────────────────
    st.markdown(f"<div class='section-title'>Top 3 — {selected_label}</div>", unsafe_allow_html=True)
    top3 = df.nlargest(3, selected_metric)
    cols = st.columns(3)
    for i, (_, row) in enumerate(top3.iterrows()):
        with cols[i]:
            with st.container():
                if row.get("media_url"):
                    st.image(row["media_url"], use_container_width=True)
                st.markdown(f"<div class='post-metric'>{int(row[selected_metric]):,}</div>", unsafe_allow_html=True)
                st.markdown(f"<div class='post-type'>{row['type']} · {row['date']}</div>", unsafe_allow_html=True)
                if row.get("caption"):
                    st.caption(row["caption"][:80])

    st.markdown("<br>", unsafe_allow_html=True)

    # ── Tableau + Calendrier ──────────────────────────────────────────────
    st.markdown("<div class='section-title'>Tous les posts</div>", unsafe_allow_html=True)
    tab_table, tab_calendar = st.tabs(["Tableau", "Calendrier"])

    with tab_table:
        cols_order = ["caption", "type", "date", "follows", "likes", "comments", "saved", "views", "reach"]
        cols_available = [c for c in cols_order if c in df.columns]
        df_display = df[cols_available].copy()
        col_labels = {"caption": "Caption", "type": "Type", "date": "Date", "follows": "Follows", "likes": "Likes", "comments": "Commentaires", "saved": "Sauvegardés", "views": "Views", "reach": "Reach"}
        df_display.columns = [col_labels[c] for c in cols_available]
        st.dataframe(df_display, use_container_width=True, hide_index=True)

    with tab_calendar:
        df_cal = df.copy()
        df_cal["date"] = pd.to_datetime(df_cal["date"], errors="coerce")
        df_cal = df_cal.dropna(subset=["date"])
        df_cal["week"] = df_cal["date"].dt.isocalendar().week.astype(int)
        df_cal["day_of_week"] = df_cal["date"].dt.dayofweek
        df_cal["day_name"] = df_cal["date"].dt.day_name()
        df_cal["date_str"] = df_cal["date"].dt.strftime("%d %b %Y")

        fig_cal = px.scatter(
            df_cal,
            x="week",
            y="day_of_week",
            color="type",
            color_discrete_map=COLOR_MAP,
            hover_data={"date_str": True, "caption": True, "reach": True, "likes": True, "week": False, "day_of_week": False},
            labels={"week": "Semaine", "day_of_week": "Jour"},
            size_max=14,
        )
        fig_cal.update_traces(marker=dict(size=14, symbol="square"))
        fig_cal.update_layout(
            template="plotly_white",
            height=300,
            margin=dict(l=0, r=0, t=10, b=0),
            paper_bgcolor="#ffffff",
            plot_bgcolor="#ffffff",
            font=dict(color="#37352f", family="Inter, sans-serif"),
            yaxis=dict(
                tickmode="array",
                tickvals=[0, 1, 2, 3, 4, 5, 6],
                ticktext=["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"],
                showgrid=True, gridcolor="#f0f0f0",
            ),
            xaxis=dict(showgrid=False, title="Semaine de l'année"),
        )
        st.plotly_chart(fig_cal, use_container_width=True)
