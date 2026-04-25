import streamlit as st
import pandas as pd
import plotly.express as px

from scripts.fetch_data import fetch_post_metrics, fetch_daily_followers
from components.ai_reco import show_ai_reco
from components.labelling_module import Labelling
from components.insights_panel import show_right_panel


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


def _kpi_cell(label: str, value: str, delta: int | None = None) -> str:
    """Cellule KPI style handoff."""
    delta_html = ""
    if delta is not None:
        cls = "rp-pos" if delta >= 0 else "rp-neg"
        sign = "+" if delta >= 0 else ""
        delta_html = f'<div class="kpi-delta-strip {cls}">{sign}{delta:,}</div>'
    return (
        f'<div class="kpi-cell-strip">'
        f'<div class="kpi-label-strip">{label}</div>'
        f'<div class="kpi-value-strip">{value}</div>'
        f'{delta_html}'
        f'</div>'
    )


@st.cache_data(ttl=300, show_spinner=False)
def _load_posts(_client, user_id: str):
    data = fetch_post_metrics(_client, user_id)
    return pd.DataFrame(data or [])


@st.fragment
def show_dashboard(client, user_id, is_paid=False):
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

    # Récupérer les followers pour la KPI strip + right panel
    follows_raw = fetch_daily_followers(client, user_id)
    df_follows = pd.DataFrame(follows_raw) if follows_raw else pd.DataFrame()
    followers_current = 0
    followers_delta = 0
    if not df_follows.empty:
        df_follows = df_follows.sort_values("fetched_at", ascending=False)
        followers_current = int(df_follows.iloc[0]["followers"])
        if len(df_follows) >= 7:
            followers_delta = followers_current - int(df_follows.iloc[6]["followers"])

    # ── Layout principal ──────────────────────────────────────────────────────
    col_main, col_right = st.columns([3, 1], gap="large")

    with col_right:
        show_right_panel(df=df, is_paid=is_paid, followers_delta=followers_delta)

    with col_main:

        # ── A. Recommandation IA ──────────────────────────────────────────────
        st.markdown("<div class='section-title'>Recommandation IA</div>", unsafe_allow_html=True)
        show_ai_reco(supabase=client, user_id=user_id, is_paid=is_paid, df=df, followers_delta=followers_delta)

        st.markdown("<hr style='border:none;border-top:1px solid rgba(0,0,0,0.07);margin:24px 0'>", unsafe_allow_html=True)

        # ── B. Métriques ──────────────────────────────────────────────────────
        st.markdown("<div class='section-title'>Métriques</div>", unsafe_allow_html=True)

        reach_total = int(df["reach"].sum()) if "reach" in df.columns else 0
        likes_total = int(df["likes"].sum()) if "likes" in df.columns else 0
        saves_total = int(df["saved"].sum()) if "saved" in df.columns else 0

        st.markdown(f"""
        <div class="kpi-strip-row">
            {_kpi_cell("Followers", f"{followers_current:,}", followers_delta if followers_delta else None)}
            {_kpi_cell("Portée totale", f"{reach_total:,}")}
            {_kpi_cell("Likes", f"{likes_total:,}")}
            {_kpi_cell("Sauvegardes", f"{saves_total:,}")}
        </div>
        """, unsafe_allow_html=True)

        # Graphique followers si données dispo
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
                    font=dict(color="#666", family="DM Sans, sans-serif"),
                    barmode="relative", showlegend=False,
                    xaxis2=dict(showgrid=False), yaxis=dict(showgrid=True, gridcolor="#f4f3f1"),
                    yaxis2=dict(showgrid=True, gridcolor="#f4f3f1"),
                )
                st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})

        st.markdown("<hr style='border:none;border-top:1px solid rgba(0,0,0,0.07);margin:24px 0'>", unsafe_allow_html=True)

        # ── Filtre label ──────────────────────────────────────────────────────
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

        # ── C. Graphique ──────────────────────────────────────────────────────
        st.markdown("<div class='section-title'>Évolution par post</div>", unsafe_allow_html=True)

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
            font=dict(color="#666", family="DM Sans, sans-serif"),
            legend=dict(orientation="h", y=1.1, font=dict(color="#666")),
            xaxis=dict(showgrid=False, color="#999", linecolor="rgba(0,0,0,0.07)"),
            yaxis=dict(showgrid=True, gridcolor="#f4f3f1", color="#999"),
        )
        st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})

        # ── D. Top 3 ─────────────────────────────────────────────────────────
        st.markdown(f"<div class='section-title'>Top 3 — {selected_label}</div>", unsafe_allow_html=True)
        top3 = df_view.nlargest(3, selected_metric)
        cols_top = st.columns(3)
        for i, (_, row) in enumerate(top3.iterrows()):
            with cols_top[i]:
                if row.get("media_url"):
                    st.image(row["media_url"], use_container_width=True)
                st.markdown(f"<div class='post-metric'>{int(row[selected_metric]):,}</div>", unsafe_allow_html=True)
                st.markdown(f"<div class='post-type'>{row['type']} · {row['date']}</div>", unsafe_allow_html=True)
                if row.get("caption"):
                    st.caption(row["caption"][:80])

        st.markdown("<hr style='border:none;border-top:1px solid rgba(0,0,0,0.07);margin:24px 0'>", unsafe_allow_html=True)

        # ── E. Tous les posts ─────────────────────────────────────────────────
        st.markdown("<div class='section-title'>Tous les posts</div>", unsafe_allow_html=True)

        tab_table, tab_calendar = st.tabs(["Tableau", "Calendrier"])

        with tab_table:
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

        with tab_calendar:
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
                font=dict(color="#666", family="DM Sans, sans-serif"),
                yaxis=dict(
                    tickmode="array", tickvals=[0, 1, 2, 3, 4, 5, 6],
                    ticktext=["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"],
                    showgrid=True, gridcolor="#f4f3f1",
                ),
                xaxis=dict(showgrid=False, title="Semaine de l'année"),
            )
            st.plotly_chart(fig_cal, use_container_width=True, config={"displayModeBar": False})

        st.markdown("<hr style='border:none;border-top:1px solid rgba(0,0,0,0.07);margin:24px 0'>", unsafe_allow_html=True)

        # ── F. Labels ─────────────────────────────────────────────────────────
        st.markdown("<div class='section-title'>Labels</div>", unsafe_allow_html=True)

        labelling_mgr = Labelling(client=client, user_id=user_id, df=df)

        # Performance par label
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
                        font=dict(color="#666", family="DM Sans, sans-serif"),
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
                        font=dict(color="#666", family="DM Sans, sans-serif"),
                        legend=dict(orientation="h", y=-0.2),
                    )
                    fig_donut.update_traces(textposition="inside", textinfo="percent+label")
                    st.plotly_chart(fig_donut, use_container_width=True, config={"displayModeBar": False})

                # Top post par label
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

                st.markdown("<hr style='border:none;border-top:1px solid rgba(0,0,0,0.07);margin:20px 0'>", unsafe_allow_html=True)

        if not has_labels_data:
            st.markdown(
                '<div style="background:#fafaf9;border:1px solid rgba(0,0,0,0.07);border-radius:8px;padding:16px 20px;margin-bottom:16px;">'
                '<div style="font-size:13px;font-weight:500;color:#0a0a0a;margin-bottom:6px;">Aucun label assigné</div>'
                '<div style="font-size:12px;color:#666;line-height:1.6;">'
                'Les labels te permettent de mesurer tes types de contenu : '
                '<em>Reel viral</em>, <em>UGC</em>, <em>Campagne promo</em>… '
                'Crée un label ci-dessous et assigne-le à tes posts dans le tableau pour voir les performances.'
                '</div>'
                '</div>',
                unsafe_allow_html=True,
            )

        # Module gestion des labels (toujours visible)
        st.markdown(
            '<div style="font-size:11px;color:#999;margin-bottom:12px;">'
            'Les labels classifient tes posts pour analyser ce qui performe. '
            'Crée tes catégories ici, puis assigne-les dans le tableau ci-dessus.'
            '</div>',
            unsafe_allow_html=True,
        )
        labelling_mgr._manage_labels()
