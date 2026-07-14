import streamlit as st
import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots

from components.dashboard import show_dashboard
from components.meta_ads import render_period_selector
from components.graph_style import apply_pulse_style, PULSE, delta_color
from components.layout import inject_hierarchy_css
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
    inject_hierarchy_css()  # classes .h-* + alignement à droite des popovers ⓘ

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

    # Plus d'onglet Labels ici : la gestion des labels a sa page globale dédiée
    # (components/labels_page.py). Ce canal = Performance seule.
    tab_perf = st.container()

    with tab_perf:
        # Agrégats sur tout l'historique (df complet, jamais filtré)
        nb_posts_total = len(df)
        reach_total_all = int(df["reach"].sum()) if "reach" in df.columns else 0
        likes_total_all = int(df["likes"].sum()) if "likes" in df.columns else 0
        saves_total_all = int(df["saved"].sum()) if "saved" in df.columns else 0
        engagement_pct_all = ((likes_total_all + saves_total_all) / reach_total_all * 100) if reach_total_all > 0 else 0.0

        # ═════════════════════════════════════════════════════════════════════
        # ── Hero (statique) ─────────────────────────────────────────────────
        # ═════════════════════════════════════════════════════════════════════
        st.markdown(
            '<div class="page-h">'
            '<h1>Instagram organique</h1>'
            '</div>',
            unsafe_allow_html=True,
        )

        # ═════════════════════════════════════════════════════════════════════
        # ─── SECTION 1 : PAGE INSTAGRAM (aucun filtre — vue totale) ─────────
        # ═════════════════════════════════════════════════════════════════════
        _pg_title, _pg_info = st.columns([6, 1])
        with _pg_title:
            st.markdown(
                '<div class="section-head" style="margin:8px 0 12px;">'
                '<div class="h-eyebrow">Page Instagram</div>'
                '<div style="font-size:13px;font-weight:500;color:#5a5d66;margin-top:4px;">'
                "Aperçu de ton compte — indépendant des filtres</div>"
                '</div>',
                unsafe_allow_html=True,
            )
        with _pg_info:
            with st.popover("ⓘ", help="Comment lire ces indicateurs"):
                st.markdown(
                    "**Abonnés** — total actuel + gain/perte des 7 derniers jours.  \n\n"
                    "**Croissance 30j** — abonnés gagnés ou perdus sur 30 jours.  \n\n"
                    "**Cadence** — posts publiés par mois, en moyenne sur ton historique.  \n\n"
                    "**Portée / abonné** — % de ton audience touchée par un post typique "
                    "(portée moyenne ÷ abonnés). C'est le signal de santé de ta page :  \n"
                    "• **> 30 %** — l'algo te pousse, très bon  \n"
                    "• **10 – 30 %** — zone normale d'un petit compte  \n"
                    "• **< 10 %** — ta page s'endort : relance la cadence ou varie les formats"
                )

        # KPI grid Page — exclusivement métriques page-level (pas de doublon avec Posts)
        # Calculs page-level :
        # - Croissance 30j : delta abonnés sur 30 derniers jours
        # - Cadence : posts par mois sur l'historique
        # - Format dominant : format le plus utilisé (par count)
        growth_30d = 0
        growth_pct = 0.0
        if not df_follows.empty and "followers" in df_follows.columns and len(df_follows) >= 2:
            _df_g = df_follows.copy().sort_values("fetched_at", ascending=False)
            _df_g["fetched_at"] = pd.to_datetime(_df_g["fetched_at"], errors="coerce")
            try:
                _now = _df_g.iloc[0]["fetched_at"]
                _ref = _df_g[_df_g["fetched_at"] <= _now - pd.Timedelta(days=30)]
                if not _ref.empty:
                    ref_val = int(_ref.iloc[0]["followers"])
                    growth_30d = followers_current - ref_val
                    growth_pct = (growth_30d / ref_val * 100) if ref_val > 0 else 0.0
            except Exception:
                pass

        # Cadence posts / mois
        cadence_per_month = 0.0
        if "_date_dt" in df.columns and df["_date_dt"].notna().any():
            _span_days = (df["_date_dt"].max() - df["_date_dt"].min()).days or 1
            cadence_per_month = nb_posts_total / max(1, _span_days / 30)

        # Portée / abonné — % de l'audience touchée par un post moyen (santé de la page)
        reach_rate = 0.0
        if followers_current > 0 and "reach" in df.columns and not df.empty:
            reach_rate = df["reach"].mean() / followers_current * 100

        st.markdown(f"""
        <div class='kpi-grid'>
            <div class='kpi'>
                <div class='k-label'>Abonnés</div>
                <div class='k-value'>{followers_current:,}</div>
                <div class='k-foot'>{_delta_html(followers_delta, " ces 7j")} &nbsp;</div>
            </div>
            <div class='kpi'>
                <div class='k-label'>Croissance 30j</div>
                <div class='k-value'>{growth_30d:+,}</div>
                <div class='k-foot'>{growth_pct:+.1f} % sur 30 jours</div>
            </div>
            <div class='kpi'>
                <div class='k-label'>Cadence</div>
                <div class='k-value'>{cadence_per_month:.1f}</div>
                <div class='k-foot'>posts / mois en moyenne</div>
            </div>
            <div class='kpi'>
                <div class='k-label'>Portée / abonné</div>
                <div class='k-value'>{reach_rate:.0f}%</div>
                <div class='k-foot'>de ton audience touchée par post</div>
            </div>
        </div>
        """, unsafe_allow_html=True)

        # ── Croissance abonnés ────────────────────────────────────────────
        if not df_follows.empty and "followers" in df_follows.columns and len(df_follows) >= 2:
            _fg_title, _fg_info = st.columns([6, 1])
            with _fg_title:
                st.markdown(
                    "<div class='section'><div class='section-head'>"
                    "<span class='section-title'>Croissance des abonnés</span>"
                    "</div></div>",
                    unsafe_allow_html=True,
                )
            with _fg_info:
                with st.popover("ⓘ", help="Comment lire le graphique"):
                    st.markdown(
                        "**Barres** = variation quotidienne (vert = gain, rouge = perte)  \n"
                        "**Ligne bleue** = total cumulé d'abonnés"
                    )

            df_grow = df_follows.copy().sort_values("fetched_at", ascending=True)
            df_grow["fetched_at"] = pd.to_datetime(df_grow["fetched_at"], errors="coerce")
            df_grow["followers"] = pd.to_numeric(df_grow["followers"], errors="coerce")
            df_grow = df_grow.dropna(subset=["fetched_at", "followers"])

            # Calcul des gains/pertes quotidiens
            df_diff = df_grow.copy()
            df_diff["delta"] = df_diff["followers"].diff().fillna(0).astype(int)
            df_diff = df_diff.iloc[1:]  # retire le 1er point (delta = 0)

            bar_colors = [delta_color(d) for d in df_diff["delta"]]
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
                    textfont=dict(size=9, color=PULSE["ink"], family=PULSE["font_mono"]),
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
                    line=dict(color=PULSE["accent"], width=2.5),
                    marker=dict(size=4, color=PULSE["white"],
                                line=dict(color=PULSE["accent"], width=2)),
                    hovertemplate="%{x|%d %b %Y}<br><b>%{y:,} abonnés au total</b><extra></extra>",
                ),
                secondary_y=True,
            )

            # Ligne 0 sur l'axe de gauche
            fig_follow.add_hline(
                y=0, line_color=PULSE["line"], line_width=1,
                secondary_y=False,
            )

            # ── Style Pulse (1 ligne pour tout le layout) ──
            apply_pulse_style(fig_follow, height=320, in_card=True)
            fig_follow.update_layout(bargap=0.4, margin=dict(l=8, r=8, t=12, b=40))
            # Axe X : titre explicite
            fig_follow.update_xaxes(title_text="Date")
            # Axe Y gauche (variation /jour)
            fig_follow.update_yaxes(
                title_text="Variation quotidienne (abonnés)",
                secondary_y=False,
            )
            # Axe Y droit (total cumulé, accent bleu)
            fig_follow.update_yaxes(
                title_text="Total abonnés (cumulé)",
                showgrid=False,
                tickfont=dict(family=PULSE["font_mono"], size=10, color=PULSE["accent"]),
                title_font=dict(family=PULSE["font_body"], size=11, color=PULSE["accent"]),
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

        # ═════════════════════════════════════════════════════════════════════
        # ─── SECTION 2 : POSTS (filtres période + format + label appliqués) ─
        # ═════════════════════════════════════════════════════════════════════
        st.markdown(
            '<div class="section-head" style="margin:32px 0 12px;padding-top:20px;'
            'border-top:1px solid rgba(14,15,18,0.08);">'
            '<div class="h-eyebrow">Posts · Performance</div>'
            '<div style="font-size:13px;font-weight:500;color:#5a5d66;margin-top:4px;">'
            'Suit la période, le format et le label sélectionnés</div>'
            '</div>',
            unsafe_allow_html=True,
        )

        # df_all = historique complet (jamais filtré) — sert à la View globale en bas
        df_all = df.copy()

        # ── Filtres regroupés (Période + Format + Label) ────────────────────
        # Période = ligne complète (pills Pulse)
        if "_date_dt" in df.columns and df["_date_dt"].notna().any():
            since_ts, until_ts = render_period_selector(key="insta", df_dates=df["_date_dt"])
            mask = (df["_date_dt"] >= since_ts) & (df["_date_dt"] <= until_ts)
            df = df[mask].copy()

        if df.empty:
            st.info("Aucun post sur cette période. Élargis la sélection ou choisis 'Tout'.")
            _render_posts_global(client, user_id, df_all)
            return

        # Filtres secondaires (2 cols : Format + Label)
        # ⚠ Le sélecteur Métrique a déménagé : il est désormais DANS la section
        # "Ce qui marche pour toi" (et pilote aussi heatmap + top 3) — voir plus bas.
        metric_options = {
            "Portée":         ("reach",    "",  "{:,.0f}"),
            "Likes":          ("likes",    "",  "{:,.0f}"),
            "Saves":          ("saved",    "",  "{:,.0f}"),
            "Commentaires":   ("comments", "",  "{:,.0f}"),
            "Engagement %":   ("_eng_pct", "%", "{:.1f}"),
        }
        fmt_options = ["Tous"]
        if "type" in df.columns:
            for _fmt in df["type"].dropna().unique():
                _l = FORMAT_LABELS.get(str(_fmt).upper(), str(_fmt))
                if _l not in fmt_options:
                    fmt_options.append(_l)
        lbl_options = ["Tous"]
        for _l in (st.session_state.get("insta_labels") or []):
            lbl_options.append(_l)
        lbl_options.append("(sans label)")

        col_f, col_l = st.columns(2)
        with col_f:
            sel_fmt = st.selectbox(
                "Format", options=fmt_options, key="insta_filter_fmt",
            )
        with col_l:
            sel_lbl = st.selectbox(
                "Label", options=lbl_options, key="insta_filter_lbl",
            )

        # Colonne dérivée Engagement % (toujours calculée pour pouvoir trier dessus plus tard)
        if not df.empty:
            df = df.copy()
            df["_eng_pct"] = df.apply(
                lambda r: ((r.get("likes", 0) + r.get("saved", 0)) / r["reach"] * 100)
                if r.get("reach", 0) > 0 else 0.0,
                axis=1,
            )

        # ── Deux dataframes filtrés selon l'usage analytique : ──
        #  df_compare = période + label (PAS de Format) → pour les comparaisons de formats
        #               (Ce qui marche pour toi). Sinon filtrer Format casse la comparaison.
        #  df_f       = période + label + Format → toutes les autres sections.
        df_compare = df.copy()
        if sel_lbl != "Tous" and "labels" in df_compare.columns:
            if sel_lbl == "(sans label)":
                df_compare = df_compare[df_compare["labels"].apply(
                    lambda x: not (isinstance(x, list) and len(x) > 0 and x[0])
                )]
            else:
                df_compare = df_compare[df_compare["labels"].apply(
                    lambda x: isinstance(x, list) and sel_lbl in x
                )]

        df_f = df_compare.copy()
        if sel_fmt != "Tous" and "type" in df_f.columns:
            target_fmts = [k for k, v in FORMAT_LABELS.items() if v == sel_fmt]
            if not target_fmts:
                target_fmts = [sel_fmt.upper()]
            df_f = df_f[df_f["type"].astype(str).str.upper().isin(target_fmts)]

        if df_f.empty:
            st.info("Aucun post avec ces filtres. Élargis Format ou Label.")
            _render_posts_global(client, user_id, df_all)
            return

        # ── Agrégats sur df_f (tous les filtres appliqués) ─────────────────
        nb_posts = len(df_f)
        reach_mean = df_f["reach"].mean() if "reach" in df_f.columns else 0
        nb_flew = int((df_f["reach"] > reach_mean).sum()) if "reach" in df_f.columns else 0
        reach_total = int(df_f["reach"].sum()) if "reach" in df_f.columns else 0
        likes_total = int(df_f["likes"].sum()) if "likes" in df_f.columns else 0
        saves_total = int(df_f["saved"].sum()) if "saved" in df_f.columns else 0
        engagement_pct = ((likes_total + saves_total) / reach_total * 100) if reach_total > 0 else 0.0
        saves_per_post = saves_total / nb_posts if nb_posts > 0 else 0.0

        # KPI grid Posts — totaux purs (les moyennes sont dans "Tes moyennes par post" ci-dessous)
        comm_total = int(df_f["comments"].sum()) if "comments" in df_f.columns else 0
        st.markdown(f"""
        <div class='kpi-grid'>
            <div class='kpi'>
                <div class='k-label'>Posts</div>
                <div class='k-value'>{nb_posts:,}</div>
                <div class='k-foot'>publiés sur la sélection</div>
            </div>
            <div class='kpi'>
                <div class='k-label'>Portée totale</div>
                <div class='k-value'>{reach_total:,}</div>
                <div class='k-foot'>sur {nb_posts} posts</div>
            </div>
            <div class='kpi'>
                <div class='k-label'>Likes totaux</div>
                <div class='k-value'>{likes_total:,}</div>
                <div class='k-foot'>cumul tous posts</div>
            </div>
            <div class='kpi'>
                <div class='k-label'>Commentaires totaux</div>
                <div class='k-value'>{comm_total:,}</div>
                <div class='k-foot'>cumul tous posts</div>
            </div>
        </div>
        """, unsafe_allow_html=True)

        # ── Section "Tes moyennes par post" (référence pour 'a décollé') ───
        likes_mean = float(df_f["likes"].mean()) if "likes" in df_f.columns else 0.0
        saves_mean = float(df_f["saved"].mean()) if "saved" in df_f.columns else 0.0
        comm_mean  = float(df_f["comments"].mean()) if "comments" in df_f.columns else 0.0
        _df_eng_avg = df_f[df_f.get("reach", 0) > 0] if "reach" in df_f.columns else df_f.head(0)
        eng_mean   = float(((_df_eng_avg["likes"] + _df_eng_avg["saved"]) / _df_eng_avg["reach"] * 100).mean()) \
            if not _df_eng_avg.empty else 0.0

        _avg_title, _avg_info = st.columns([6, 1])
        with _avg_title:
            st.markdown(
                "<div class='section-head' style='padding-top:8px;'>"
                "<span class='section-title'>Tes moyennes par post</span>"
                "</div>",
                unsafe_allow_html=True,
            )
        with _avg_info:
            with st.popover("ⓘ", help="À quoi servent ces moyennes"):
                st.markdown(
                    "Le profil de ton **post typique** sur la sélection — "
                    "c'est la référence des comparaisons.  \n\n"
                    f"Un post **« décolle »** quand sa portée dépasse la moyenne "
                    f"({reach_mean:,.0f}). Tu as **{nb_flew} post{'s' if nb_flew > 1 else ''}** au-dessus."
                )

        st.markdown(
            f"<div class='card' style='margin-bottom:18px;padding:14px 20px;'>"
            f"<div style='display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;'>"
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
            f"</div>",
            unsafe_allow_html=True,
        )

        # ─────────────────────────────────────────────────────────────────
        # ── Ce qui marche pour toi (sélecteur Métrique à gauche) ─────────
        # Ce sélecteur pilote aussi 'Quand publier ?' et 'Top 3 posts'
        # ─────────────────────────────────────────────────────────────────
        _metric_col, _title_col, _info_col = st.columns([2, 4, 1])
        with _metric_col:
            sel_metric = st.selectbox(
                "Métrique", options=list(metric_options.keys()),
                key="insta_format_metric",
                label_visibility="collapsed",
            )
        with _title_col:
            st.markdown(
                "<div class='section-head' style='padding-top:8px;'>"
                "<span class='section-title'>Ce qui marche pour toi</span>"
                "</div>",
                unsafe_allow_html=True,
            )
        with _info_col:
            with st.popover("ⓘ", help="Comment lire la section"):
                st.markdown(
                    f"**Métrique active** : `{sel_metric.lower()}`  \n\n"
                    "Ce sélecteur pilote **3 sections** :  \n"
                    "• Ce qui marche pour toi (comparatif formats)  \n"
                    "• Quand publier ? (heatmap)  \n"
                    "• Top 3 posts  \n\n"
                    "Le format avec la **plus haute moyenne** sur la métrique sélectionnée est marqué `Top format`.  \n\n"
                    "⚠ Cette section **ignore le filtre Format** — sinon il n'y aurait rien à comparer."
                )

        metric_col, metric_suffix, metric_fmt = metric_options[sel_metric]

        # ⚠ On utilise df_compare (sans filtre Format) — sinon comparer 1 format à lui-même
        format_groups = {}
        if "type" in df_compare.columns and metric_col in df_compare.columns:
            for fmt, grp in df_compare.groupby("type"):
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
    
        # ─────────────────────────────────────────────────────────────────
        # ── Quand publier ? heatmap (suit le filtre Format global) ───────
        # ─────────────────────────────────────────────────────────────────
        _hp_title, _hp_info = st.columns([6, 1])
        with _hp_title:
            st.markdown(
                "<div class='section-head' style='padding-top:8px;'>"
                "<span class='section-title'>Quand publier ?</span>"
                "</div>",
                unsafe_allow_html=True,
            )
        with _hp_info:
            with st.popover("ⓘ", help="Comment lire la heatmap"):
                st.markdown(
                    f"**Métrique** : `{sel_metric.lower()}`  \n"
                    f"**Filtre actif** : Format = `{sel_fmt}` · Label = `{sel_lbl}`  \n"
                    f"**Fuseau horaire** : Europe/Zurich  \n\n"
                    f"Chaque case = (jour, créneau).  \n"
                    f"• **Xp** = nombre de posts publiés sur ce créneau  \n"
                    f"• **Valeur** = {sel_metric.lower()} moyenne par post  \n"
                    f"• **Intensité** = plus c'est foncé, mieux ça performe  \n"
                    f"• **★ TOP** = créneau qui maximise la métrique (≥3 posts dans la case + ≥20 posts total)"
                )

        # Calcul : pour chaque (jour, créneau) → {count, total, avg} sur df_f
        heat_data = {}
        has_real_hours = False
        df_heat = df_f.copy()
        if "date" in df_heat.columns and not df_heat.empty:
            df_heat["_dt"] = pd.to_datetime(df_heat["date"], errors="coerce", utc=True)
            try:
                df_heat["_dt"] = df_heat["_dt"].dt.tz_convert("Europe/Zurich")
            except Exception:
                pass
            df_heat["_dow"] = df_heat["_dt"].dt.dayofweek
            df_heat["_hour"] = df_heat["_dt"].dt.hour
            unique_hours = df_heat["_hour"].dropna().unique()
            # Vraies heures = au moins un post publié hors créneau 0h (sinon = backfill sans heures)
            has_real_hours = any(int(h) > 0 for h in unique_hours)
            hour_bins = [0, 7, 10, 13, 16, 19, 24]
            hour_labels = [0, 1, 2, 3, 4, 5]
            df_heat["_slot"] = pd.cut(df_heat["_hour"], bins=hour_bins, labels=hour_labels, right=False)
            for _, r in df_heat.iterrows():
                if pd.notna(r.get("_dow")) and pd.notna(r.get("_slot")):
                    key = (int(r["_dow"]), int(r["_slot"]))
                    cur = heat_data.setdefault(key, {"count": 0, "total": 0.0})
                    cur["count"] += 1
                    cur["total"] += float(r.get(metric_col, 0) or 0)

        # avg par cellule (métrique sélectionnée)
        for k, v in heat_data.items():
            v["avg"] = v["total"] / v["count"] if v["count"] > 0 else 0

        max_avg = max((v["avg"] for v in heat_data.values()), default=1) or 1
        # ─── Seuil de signal ────────────────────────────────────────────
        # On n'élit un "best" QUE si l'échantillon est suffisant :
        # - >=3 posts dans la case gagnante (sinon c'est du bruit pur)
        # - >=20 posts au total (sinon la heatmap entière est anecdotique)
        _total_heat_posts = sum(v["count"] for v in heat_data.values())
        _candidates = {k: v for k, v in heat_data.items() if v["count"] >= 3}
        if _candidates and _total_heat_posts >= 20:
            best_slot = max(_candidates, key=lambda k: _candidates[k]["avg"])
        else:
            best_slot = None

        if df_heat.empty:
            st.info("Aucun post sur la sélection — élargis les filtres.")
        elif not has_real_hours and heat_data:
            # Heures manquantes → on n'affiche QUE le warning (la heatmap serait biaisée)
            _fmt_hint = f" pour les posts {sel_fmt}" if sel_fmt != "Tous" else ""
            st.warning(
                f"⚠ Les heures de publication ne sont pas stockées{_fmt_hint} — "
                "tous les posts apparaissent au créneau 0-7h. "
                "Rafraîchis tes données Instagram (Paramètres → Meta) pour récupérer les heures réelles."
            )
        else:
            # ── Heatmap améliorée : palette + tooltip + totaux jour/créneau ──
            def _fmt_cell_val(v: float) -> str:
                return metric_fmt.format(v) + metric_suffix

            # Totaux par jour (column sum) et par créneau (row sum)
            day_totals = {d: 0.0 for d in range(7)}
            slot_totals = {s: 0.0 for s in range(6)}
            day_counts = {d: 0 for d in range(7)}
            for (d_idx, s_idx), cell in heat_data.items():
                day_totals[d_idx] += cell["avg"]
                slot_totals[s_idx] += cell["avg"]
                day_counts[d_idx] += cell["count"]

            best_day_idx = max(day_totals, key=lambda k: day_totals[k]) if any(day_totals.values()) else None
            best_slot_idx_overall = max(slot_totals, key=lambda k: slot_totals[k]) if any(slot_totals.values()) else None

            # Header — jours de la semaine + colonne vide à gauche
            header_row = "<div style='display:grid;grid-template-columns:56px repeat(7,1fr);gap:5px;margin-bottom:6px;'>"
            header_row += "<div></div>"
            for d_i, d in enumerate(DAYS):
                is_best_day = (d_i == best_day_idx)
                is_weekend = d_i >= 5
                color = "#1a56ff" if is_best_day else ("#b86b00" if is_weekend else "#8b8e98")
                weight = "700" if is_best_day else "600"
                header_row += (
                    f"<div style='text-align:center;font-size:11px;font-weight:{weight};"
                    f"color:{color};letter-spacing:0.04em;'>{d}</div>"
                )
            header_row += "</div>"

            grid_html = header_row
            for s_idx, slot_label in enumerate(HOURS):
                is_best_slot_row = (s_idx == best_slot_idx_overall)
                slot_color = "#1a56ff" if is_best_slot_row else "#8b8e98"
                slot_weight = "700" if is_best_slot_row else "500"
                grid_html += "<div style='display:grid;grid-template-columns:56px repeat(7,1fr);gap:5px;margin-bottom:5px;'>"
                grid_html += (
                    f"<div style='font-size:10px;color:{slot_color};font-weight:{slot_weight};"
                    f"display:flex;align-items:center;justify-content:flex-end;padding-right:6px;'>{slot_label}</div>"
                )
                for d_idx in range(7):
                    key = (d_idx, s_idx)
                    cell = heat_data.get(key)
                    if cell:
                        ratio = cell["avg"] / max_avg if max_avg > 0 else 0
                        # Gradient : low = vert pâle, mid = bleu, high = violet profond
                        if ratio >= 0.66:
                            bg = f"rgba(91,52,180,{0.30 + ratio * 0.55})"  # violet
                            txt_color = "#fff"
                            num_color = "#fff"
                            sub_color = "rgba(255,255,255,0.85)"
                        elif ratio >= 0.33:
                            bg = f"rgba(59,91,255,{0.20 + ratio * 0.55})"  # bleu
                            txt_color = "#0e0f12" if ratio < 0.5 else "#fff"
                            num_color = txt_color
                            sub_color = "rgba(255,255,255,0.85)" if ratio >= 0.5 else "#5a5d66"
                        else:
                            bg = f"rgba(26,122,74,{0.12 + ratio * 0.45})"  # vert pâle
                            txt_color = "#0e0f12"
                            num_color = "#0e0f12"
                            sub_color = "#5a5d66"

                        is_best_cell = key == best_slot
                        val_str = _fmt_cell_val(cell["avg"])
                        tooltip = (
                            f"{DAYS[d_idx]} · {HOURS[s_idx]} | "
                            f"{cell['count']} post(s) | {sel_metric.lower()} moy : {val_str}"
                        )
                        border = "2px solid #1a2c8f" if is_best_cell else "1px solid rgba(255,255,255,0.05)"
                        if is_best_cell:
                            inner = (
                                f"<div style='font-size:9px;font-weight:800;line-height:1;letter-spacing:0.06em;color:{num_color};'>★ TOP</div>"
                                f"<div style='font-size:10px;font-weight:700;line-height:1;color:{num_color};margin-top:2px;'>{val_str}</div>"
                                f"<div style='font-size:8px;line-height:1;color:{sub_color};margin-top:1px;'>{cell['count']}p</div>"
                            )
                        else:
                            inner = (
                                f"<div style='font-size:11px;font-weight:600;line-height:1;color:{num_color};'>{val_str}</div>"
                                f"<div style='font-size:9px;line-height:1;color:{sub_color};margin-top:2px;'>{cell['count']}p</div>"
                            )
                        cell_html = (
                            f"<div title='{tooltip}' style='background:{bg};border:{border};"
                            f"border-radius:6px;height:44px;display:flex;flex-direction:column;"
                            f"align-items:center;justify-content:center;gap:0;transition:transform 0.1s;'>{inner}</div>"
                        )
                    else:
                        cell_html = (
                            "<div style='background:rgba(14,15,18,0.03);border:1px solid rgba(14,15,18,0.05);"
                            "border-radius:6px;height:44px;'></div>"
                        )
                    grid_html += cell_html
                grid_html += "</div>"

            # Légende de couleur (gradient bar)
            legend = (
                "<div style='display:flex;align-items:center;gap:8px;margin-top:14px;font-size:10.5px;color:#8b8e98;'>"
                "<span>moins performant</span>"
                "<span style='flex:1;height:6px;border-radius:3px;background:linear-gradient("
                "to right,rgba(26,122,74,0.25),rgba(59,91,255,0.55),rgba(91,52,180,0.85));'></span>"
                "<span>plus performant</span>"
                "</div>"
            )

            st.markdown(
                f"<div style='background:#fff;border:1px solid rgba(14,15,18,0.08);"
                f"border-radius:14px;padding:22px 24px;box-shadow:0 1px 3px rgba(14,15,18,0.03);'>"
                f"{grid_html}{legend}"
                f"</div>",
                unsafe_allow_html=True,
            )

            if best_slot:
                best_day = DAYS[best_slot[0]]
                best_hour = HOURS[best_slot[1]]
                best = heat_data[best_slot]
                best_avg_str = _fmt_cell_val(best["avg"])
                st.markdown(f"""
                <div class='hint' style='margin-top:10px;'>
                    <span class='hint-ico'>💡</span>
                    <p>
                        <strong>{best_day}</strong> vers <strong>{best_hour}</strong> →
                        <strong>{best['count']}</strong> posts à <strong>{best_avg_str}/post</strong>.
                        Planifie tes posts importants sur ce créneau.
                    </p>
                </div>
                """, unsafe_allow_html=True)
            elif _total_heat_posts > 0:
                # Pas de "best" identifiable — explique pourquoi
                st.markdown(
                    f"<div style='margin-top:10px;font-size:12px;color:#8b8e98;"
                    f"padding:10px 14px;background:rgba(14,15,18,0.03);border-radius:8px;'>"
                    f"<b>Pas assez de signal</b> pour pointer un créneau gagnant "
                    f"({_total_heat_posts} posts répartis sur 42 cases). "
                    f"Reviens quand tu en auras 20+ pour une lecture fiable, "
                    f"ou élargis la période (Tout)."
                    f"</div>",
                    unsafe_allow_html=True,
                )

    
        # ── En-tête Top 3 (utilise df_f filtré globalement) ─────────────────
        st.markdown(
            "<div class='section'><div class='section-head'>"
            f"<span class='section-title'>Top 3 posts "
            f"<span class='st-count'>par {sel_metric.lower()}</span></span></div></div>",
            unsafe_allow_html=True,
        )

        # Tri par la métrique globale sélectionnée
        sort_col = metric_col if metric_col in df_f.columns else "reach"
        top3 = df_f.nlargest(3, sort_col) if sort_col in df_f.columns else df_f.head(3)
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
    
        # ═══ SECTION 3 : VIEW GLOBALE — indépendante des filtres ═══════════
        _render_posts_global(client, user_id, df_all)


def _render_posts_global(client, user_id, df_g) -> None:
    """SECTION 3 : View globale — Performance par label + Tous les posts.

    Opère sur l'historique complet (df_g), indépendant des filtres de la
    section Performance — même structure que la View globale de Meta Ads.
    """
    st.markdown(
        '<div class="section-head" style="margin:32px 0 12px;padding-top:20px;'
        'border-top:1px solid rgba(14,15,18,0.08);">'
        '<div class="h-eyebrow">View globale</div>'
        '<div style="font-size:13px;font-weight:500;color:#5a5d66;margin-top:4px;">'
        'Tous tes posts — indépendant des filtres ci-dessus</div>'
        '</div>',
        unsafe_allow_html=True,
    )
    if df_g is None or df_g.empty:
        return

    df_f = df_g  # alias — le bloc ci-dessous conserve son indentation d'origine
    if True:
        # ── Performance par label (historique complet) ─────────────────────
        if "labels" in df_f.columns and not df_f.empty:
            df_l = df_f.copy()
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

        total_posts = len(df_f)

        st.markdown(
            "<div class='section'><div class='section-head'>"
            "<span class='section-title'>Tous les posts "
            f"<span class='st-count'>{total_posts} posts · scroll pour explorer</span></span></div></div>",
            unsafe_allow_html=True,
        )

        # Préparation des données par post (utilise df_f filtré)
        df_posts = df_f.copy()
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

        # Labels disponibles (liste unifiée profiles.labels)
        avail_labels = st.session_state.get("insta_labels")
        if avail_labels is None:
            try:
                _r = client.table("profiles").select("labels").eq("id", user_id).execute()
                avail_labels = [l for l in (_r.data[0].get("labels") if _r.data else []) or [] if l]
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

# Labels Instagram : gérés désormais depuis la page globale dédiée
# (components/labels_page.py). L'assignation par post reste dans Performance.
