import streamlit as st
import pandas as pd
import plotly.express as px

from scripts.fetch_data import fetch_post_metrics, fetch_daily_followers
from components.ai_reco import show_ai_reco
from components.labelling_module import Labelling


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

    df_plot = df_follows.sort_values("fetched_at").copy()
    df_plot["delta"] = df_plot["followers"].diff()
    df_plot["gain"] = df_plot["delta"].apply(lambda x: x if x > 0 else 0)
    df_plot["perte"] = df_plot["delta"].apply(lambda x: x if x < 0 else 0)

    from plotly.subplots import make_subplots
    import plotly.graph_objects as go

    fig = make_subplots(rows=2, cols=1, shared_xaxes=True, row_heights=[0.6, 0.4], vertical_spacing=0.05)

    fig.add_trace(go.Scatter(x=df_plot["fetched_at"], y=df_plot["followers"], name="Followers", line=dict(color="#0066ff", width=2)), row=1, col=1)
    fig.add_trace(go.Bar(x=df_plot["fetched_at"], y=df_plot["gain"], name="Gain", marker_color="#10b981", opacity=0.7), row=2, col=1)
    fig.add_trace(go.Bar(x=df_plot["fetched_at"], y=df_plot["perte"], name="Perte", marker_color="#ef4444", opacity=0.7), row=2, col=1)
    fig.update_layout(
        template="plotly_white",
        height=360, margin=dict(l=0, r=0, t=10, b=0),
        paper_bgcolor="#ffffff", plot_bgcolor="#ffffff",
        font=dict(color="#37352f", family="Inter, sans-serif"),
        barmode="relative",
        showlegend=True,
        xaxis2=dict(showgrid=False, color="#6b6b6b"),
        yaxis=dict(showgrid=True, gridcolor="#f0f0f0", color="#6b6b6b"),
        yaxis2=dict(showgrid=True, gridcolor="#f0f0f0", color="#6b6b6b"),
    )
    st.plotly_chart(fig, use_container_width=True)


@st.cache_data(ttl=300, show_spinner=False)
def _load_posts(_client):
    data = fetch_post_metrics(_client) or []
    return pd.DataFrame(data)


@st.fragment
def show_dashboard(client, user_id, is_paid=False):
    st.session_state["_posts_cache_clear"] = _load_posts.clear
    df = _load_posts(client)

    if df.empty:
        st.markdown("<div style='color:#6b6b6b;padding:20px 0'>Aucune donnée. Cliquez sur <b>Récupérer mes données Instagram</b> pour commencer.</div>", unsafe_allow_html=True)
        return

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

    # ── Tableau + Calendrier + Labels ─────────────────────────────────────
    st.markdown("<div class='section-title'>Tous les posts</div>", unsafe_allow_html=True)
    tab_table, tab_calendar, tab_labels = st.tabs(["Tableau", "Calendrier", "Labels"])

    with tab_table:
        labelling = Labelling(client=client, user_id=user_id, df=df)
        labels_options = [l for l in st.session_state.get("labels_list", []) if l]

        cols_order = ["caption", "type", "date", "follows", "likes", "comments", "saved", "views", "reach"]
        cols_available = [c for c in cols_order if c in df.columns]
        df_display = df[cols_available].copy()
        df_display.insert(0, "label", df["labels"].apply(lambda x: x[0] if x and len(x) > 0 else None) if "labels" in df.columns else None)

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

    with tab_labels:
        labelling_mgr = Labelling(client=client, user_id=user_id, df=df)
        labelling_mgr._manage_labels()
