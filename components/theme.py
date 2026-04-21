"""Design system — Variation A (Clarity) d'après le handoff."""
import streamlit as st


def sparkline_svg(values: list, color: str = "#1a56ff", width: int = 56, height: int = 28) -> str:
    if not values or len(values) < 2:
        return f'<svg width="{width}" height="{height}"></svg>'
    min_v = min(values)
    max_v = max(values)
    rng = max_v - min_v or 1
    pts = []
    for i, v in enumerate(values):
        x = i / (len(values) - 1) * width
        y = height - ((v - min_v) / rng * 0.8 + 0.1) * height
        pts.append(f"{x:.1f},{y:.1f}")
    path = " ".join(pts)
    # Gradient fill
    grad_id = f"g{abs(hash(color)) % 9999}"
    fill_pts = f"0,{height} " + path + f" {width},{height}"
    return (
        f'<svg width="{width}" height="{height}" viewBox="0 0 {width} {height}" '
        f'preserveAspectRatio="none" style="display:block;overflow:visible">'
        f'<defs><linearGradient id="{grad_id}" x1="0" y1="0" x2="0" y2="1">'
        f'<stop offset="0%" stop-color="{color}" stop-opacity="0.12"/>'
        f'<stop offset="100%" stop-color="{color}" stop-opacity="0"/>'
        f'</linearGradient></defs>'
        f'<polygon points="{fill_pts}" fill="url(#{grad_id})"/>'
        f'<polyline points="{path}" fill="none" stroke="{color}" '
        f'stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'
        f'</svg>'
    )


def trend_values(current: float, delta_pct: float = 0, n: int = 10) -> list:
    """Génère des valeurs de sparkline plausibles depuis la valeur courante et son delta."""
    import random
    seed = int(abs(current * 100)) % 99991
    random.seed(seed)
    base = current / (1 + delta_pct / 100) if delta_pct else current * 0.92
    vals = []
    for i in range(n):
        t = i / (n - 1)
        trend = base + (current - base) * t
        noise = random.uniform(-abs(current) * 0.025, abs(current) * 0.025)
        vals.append(max(0, trend + noise))
    vals[-1] = current
    return vals


def plotly_layout(title: str = "") -> dict:
    """Layout Plotly minimal aligné sur le design system."""
    return dict(
        title=dict(text=title, font=dict(family="DM Sans", size=12, color="#0a0a0a")) if title else None,
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        margin=dict(l=0, r=0, t=4, b=30),
        font=dict(family="DM Sans", size=10, color="#999999"),
        showlegend=True,
        legend=dict(
            orientation="h",
            yanchor="bottom", y=-0.4,
            xanchor="left", x=0,
            font=dict(family="DM Sans", size=10, color="#999999"),
            bgcolor="rgba(0,0,0,0)",
        ),
        xaxis=dict(
            showgrid=False,
            zeroline=False,
            tickfont=dict(family="DM Sans", size=10, color="#999999"),
            linecolor="rgba(0,0,0,0.07)",
        ),
        yaxis=dict(
            showgrid=True,
            gridcolor="rgba(0,0,0,0.05)",
            zeroline=False,
            tickfont=dict(family="DM Mono", size=10, color="#999999"),
        ),
    )


def inject_global_theme():
    """Injecte le design system Variation A (Clarity)."""
    st.markdown("""
    <style>
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');

        /* ─── Tokens ──────────────────────────────────────── */
        :root {
            --white:    #ffffff;
            --ink:      #0a0a0a;
            --ink-2:    #333333;
            --ink-3:    #666666;
            --ink-4:    #999999;
            --ink-5:    #c8c8c8;
            --bg:       #fafaf9;
            --bg-2:     #f4f3f1;
            --bg-3:     #eeede9;
            --line:     rgba(0,0,0,0.07);
            --line-str: rgba(0,0,0,0.12);
            --accent:   #1a56ff;
            --accent-l: #eef2ff;
            --pos:      #1a7a4a;
            --pos-l:    #e8f5ee;
            --neg:      #c0392b;
            --neg-l:    #fdecea;
        }

        /* ─── Base ────────────────────────────────────────── */
        html, body, .stApp {
            font-family: 'DM Sans', sans-serif !important;
            background: var(--bg) !important;
            color: var(--ink) !important;
        }

        /* ─── Masquer chrome Streamlit ────────────────────── */
        header[data-testid="stHeader"]   { display: none !important; }
        #MainMenu                        { display: none !important; }
        footer                           { display: none !important; }
        [data-testid="stToolbar"]        { display: none !important; }
        [data-testid="stDecoration"]     { display: none !important; }
        [data-testid="stStatusWidget"]   { display: none !important; }

        .main .block-container {
            padding-top: 0 !important;
            padding-bottom: 3rem !important;
            max-width: 100% !important;
        }

        /* ─── Sidebar ──────────────────────────────────────── */
        [data-testid="stSidebar"] {
            background: var(--white) !important;
            border-right: 1px solid var(--line) !important;
            min-width: 200px !important;
            max-width: 200px !important;
        }

        [data-testid="stSidebar"] > div:first-child {
            padding: 20px 14px 16px !important;
        }

        [data-testid="stSidebar"] .stButton > button {
            background: transparent !important;
            border: none !important;
            border-radius: 7px !important;
            color: var(--ink-4) !important;
            font-family: 'DM Sans', sans-serif !important;
            font-size: 13px !important;
            font-weight: 400 !important;
            text-align: left !important;
            padding: 8px 12px !important;
            margin-bottom: 2px !important;
            box-shadow: none !important;
            width: 100% !important;
            transition: all 0.15s ease !important;
        }

        [data-testid="stSidebar"] .stButton > button:hover {
            background: rgba(0,0,0,0.03) !important;
            color: var(--ink) !important;
        }

        [data-testid="stSidebar"] .stButton > button[kind="primary"],
        [data-testid="stSidebar"] .stButton > button:disabled {
            background: var(--white) !important;
            box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.06) !important;
            color: var(--ink) !important;
            font-weight: 600 !important;
            opacity: 1 !important;
            cursor: default !important;
        }

        [data-testid="stSidebar"] hr {
            border-color: var(--line) !important;
            margin: 8px 0 !important;
        }

        [data-testid="stSidebar"] p,
        [data-testid="stSidebar"] small,
        [data-testid="stSidebar"] .stMarkdown p {
            font-family: 'DM Sans', sans-serif !important;
            color: var(--ink-4) !important;
            font-size: 10px !important;
        }

        /* ─── Topbar ──────────────────────────────────────── */
        .dash-topbar {
            display: flex;
            align-items: center;
            height: 48px;
            border-bottom: 1px solid var(--line);
            padding: 0 28px 0 24px;
            gap: 14px;
            background: var(--white);
            margin-bottom: 0;
        }

        .dash-logo {
            width: 22px; height: 22px;
            background: var(--ink);
            border-radius: 5px;
            flex-shrink: 0;
        }

        .dash-title {
            font-size: 13px;
            font-weight: 600;
            color: var(--ink);
            letter-spacing: -0.3px;
            white-space: nowrap;
        }

        .dash-tab-bar {
            display: flex;
            align-items: stretch;
            height: 48px;
            margin-left: 8px;
        }

        .dash-tab {
            display: flex;
            align-items: center;
            height: 48px;
            padding: 0 16px;
            font-size: 13px;
            font-weight: 400;
            color: var(--ink-4);
            border-bottom: 1.5px solid transparent;
            transition: color 0.15s ease;
            white-space: nowrap;
        }

        .dash-tab.active {
            color: var(--ink);
            font-weight: 600;
            border-bottom-color: var(--ink);
        }

        .dash-spacer { flex: 1; }

        .dash-pro-chip {
            background: var(--pos-l);
            color: var(--pos);
            font-size: 10px;
            font-weight: 500;
            letter-spacing: 0.2px;
            padding: 3px 8px;
            border-radius: 99px;
        }

        .dash-avatar {
            width: 28px; height: 28px;
            background: var(--bg-3);
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: 600;
            color: var(--ink-3);
            flex-shrink: 0;
        }

        /* ─── Coach IA ─────────────────────────────────────── */
        .coach-ia {
            border-left: 2px solid var(--ink);
            padding: 16px 20px;
            margin: 24px 0 20px 0;
        }

        .coach-ia-label {
            font-size: 10px;
            font-weight: 500;
            color: var(--ink-4);
            letter-spacing: 1.4px;
            text-transform: uppercase;
            margin-bottom: 8px;
        }

        .coach-ia-text {
            font-size: 15px;
            font-weight: 400;
            color: var(--ink-2);
            line-height: 1.7;
            max-width: 560px;
            margin: 0;
        }

        .coach-ia-text strong {
            font-weight: 600;
            color: var(--ink);
        }

        .coach-ia-actions {
            display: flex;
            gap: 8px;
            margin-top: 14px;
            flex-wrap: wrap;
        }

        .coach-ia-btn {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 5px 12px;
            border: 1px solid var(--line);
            border-radius: 6px;
            background: var(--bg);
            color: var(--ink-3);
            font-family: 'DM Sans', sans-serif;
            font-size: 11px;
            cursor: pointer;
            transition: border-color 0.15s ease;
            text-decoration: none;
        }

        .coach-ia-btn:hover { border-color: var(--line-str); }

        /* ─── KPI Strip ────────────────────────────────────── */
        .kpi-strip {
            display: flex;
            border-top: 1px solid var(--line);
            border-bottom: 1px solid var(--line);
            margin: 0 0 24px 0;
            background: var(--white);
        }

        .kpi-cell {
            flex: 1;
            padding: 20px 24px;
            border-right: 1px solid var(--line);
        }

        .kpi-cell:last-child { border-right: none; }

        .kpi-label {
            font-size: 10px;
            font-weight: 500;
            color: var(--ink-4);
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 10px;
        }

        .kpi-value {
            font-family: 'DM Mono', monospace;
            font-size: 26px;
            font-weight: 400;
            color: var(--ink);
            letter-spacing: -1px;
            margin-bottom: 6px;
            line-height: 1.1;
        }

        .kpi-delta {
            display: inline-flex;
            align-items: center;
            gap: 3px;
            font-family: 'DM Mono', monospace;
            font-size: 11px;
        }

        .kpi-delta.pos { color: var(--pos); }
        .kpi-delta.neg { color: var(--neg); }
        .kpi-delta.neu { color: var(--ink-4); }

        .kpi-spark { margin-top: 10px; }

        /* ─── Cards ────────────────────────────────────────── */
        .section-card {
            background: var(--white);
            border: 1px solid var(--line);
            border-radius: 10px;
            padding: 20px 24px;
            margin-bottom: 16px;
        }

        .section-title {
            font-size: 12px;
            font-weight: 500;
            color: var(--ink);
            margin-bottom: 16px;
        }

        /* ─── Pills métriques ──────────────────────────────── */
        .pills {
            display: flex;
            gap: 6px;
            margin-bottom: 16px;
            flex-wrap: wrap;
        }

        .pill-active {
            padding: 3px 10px;
            border-radius: 5px;
            font-size: 11px;
            font-weight: 500;
            background: var(--ink);
            color: var(--white);
        }

        .pill-inactive {
            padding: 3px 10px;
            border-radius: 5px;
            font-size: 11px;
            font-weight: 500;
            border: 1px solid var(--line);
            color: var(--ink-4);
        }

        /* ─── Top posts ────────────────────────────────────── */
        .top-post-row {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 0;
            border-bottom: 1px solid var(--line);
        }

        .top-post-row:last-child { border-bottom: none; }

        .post-rank {
            font-size: 11px;
            font-weight: 400;
            color: var(--ink-5);
            width: 22px;
            flex-shrink: 0;
        }

        .post-thumb {
            width: 36px; height: 36px;
            background: var(--bg-3);
            border-radius: 5px;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
        }

        .post-info { flex: 1; min-width: 0; }

        .post-value {
            font-family: 'DM Mono', monospace;
            font-size: 14px;
            font-weight: 500;
            color: var(--ink);
            letter-spacing: -0.3px;
        }

        .post-meta {
            font-size: 10px;
            color: var(--ink-4);
            margin-top: 2px;
        }

        .post-chip {
            font-size: 10px;
            font-weight: 500;
            letter-spacing: 0.2px;
            padding: 2px 8px;
            border-radius: 99px;
            border: 1px solid var(--line);
            color: var(--ink-3);
            background: var(--bg);
            white-space: nowrap;
            flex-shrink: 0;
        }

        /* ─── Posts table ──────────────────────────────────── */
        .posts-tbl { width: 100%; border-collapse: collapse; }

        .posts-tbl th {
            font-size: 9px;
            font-weight: 600;
            color: var(--ink-4);
            text-transform: uppercase;
            letter-spacing: 1px;
            padding: 0 8px 10px 0;
            text-align: left;
            border-bottom: 1px solid var(--line);
        }

        .posts-tbl td {
            font-family: 'DM Mono', monospace;
            font-size: 11px;
            color: var(--ink);
            padding: 10px 8px 10px 0;
            border-bottom: 1px solid var(--line);
            vertical-align: middle;
        }

        .posts-tbl tr:last-child td { border-bottom: none; }
        .posts-tbl td.sans { font-family: 'DM Sans', sans-serif; font-size: 11px; }

        .tbl-chip {
            font-family: 'DM Sans', sans-serif;
            font-size: 10px;
            font-weight: 500;
            padding: 2px 8px;
            border-radius: 99px;
            border: 1px solid var(--line);
            color: var(--ink-3);
            white-space: nowrap;
        }

        /* ─── Streamlit tabs override ──────────────────────── */
        .stTabs [data-baseweb="tab-list"] {
            background: transparent !important;
            border-bottom: 1px solid var(--line) !important;
            gap: 0 !important;
            padding: 0 !important;
        }

        .stTabs [data-baseweb="tab"] {
            background: transparent !important;
            border: none !important;
            border-bottom: 1.5px solid transparent !important;
            border-radius: 0 !important;
            padding: 12px 16px !important;
            font-family: 'DM Sans', sans-serif !important;
            font-size: 13px !important;
            font-weight: 400 !important;
            color: var(--ink-4) !important;
            margin-bottom: -1px !important;
        }

        .stTabs [aria-selected="true"] {
            border-bottom-color: var(--ink) !important;
            color: var(--ink) !important;
            font-weight: 600 !important;
        }

        .stTabs [data-baseweb="tab-highlight"] { display: none !important; }
        .stTabs [data-baseweb="tab-border"]    { display: none !important; }

        .stTabs [data-testid="stTabsContent"] {
            padding-top: 20px !important;
        }

        /* ─── Streamlit overrides divers ───────────────────── */
        [data-testid="stMetricValue"] {
            font-family: 'DM Mono', monospace !important;
            font-weight: 400 !important;
            letter-spacing: -0.5px !important;
            color: var(--ink) !important;
        }

        [data-testid="stMetricLabel"] {
            font-size: 10px !important;
            font-weight: 500 !important;
            color: var(--ink-4) !important;
            text-transform: uppercase !important;
            letter-spacing: 1px !important;
        }

        .stMarkdown p { color: var(--ink-2) !important; }
        h1, h2, h3, h4 { color: var(--ink) !important; font-family: 'DM Sans', sans-serif !important; }

        .stButton > button {
            font-family: 'DM Sans', sans-serif !important;
            font-size: 12px !important;
            font-weight: 500 !important;
            border-radius: 6px !important;
            border: 1px solid var(--line-str) !important;
            background: var(--bg) !important;
            color: var(--ink-2) !important;
            transition: border-color 0.15s ease !important;
        }

        .stButton > button[kind="primary"] {
            background: var(--ink) !important;
            color: var(--white) !important;
            border-color: var(--ink) !important;
        }

        .stButton > button:hover { border-color: var(--ink-3) !important; }

        .stSelectbox > div > div {
            border-color: var(--line-str) !important;
            border-radius: 6px !important;
            font-family: 'DM Sans', sans-serif !important;
            font-size: 13px !important;
        }

        hr { border-color: var(--line) !important; }

        .stSpinner > div { border-top-color: var(--ink) !important; }

        .stAlert {
            border-radius: 8px !important;
            border: 1px solid var(--line) !important;
        }

        /* ─── Source cards (overview) ──────────────────────── */
        .source-card {
            background: var(--white);
            border: 1px solid var(--line);
            border-radius: 10px;
            padding: 28px 24px;
            text-align: center;
            transition: box-shadow 0.15s ease;
        }

        .source-card:hover {
            box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        }

        .source-card.connected { border-color: var(--pos); }
        .source-card.disconnected { border-color: var(--neg-l); }

        .source-icon { font-size: 2rem; margin-bottom: 12px; }

        .source-name {
            font-size: 15px;
            font-weight: 600;
            color: var(--ink);
            letter-spacing: -0.3px;
        }

        .source-status { font-size: 12px; margin-top: 6px; }
        .status-connected { color: var(--pos); }
        .status-disconnected { color: var(--ink-4); }

        /* Score global */
        .score-global {
            border: 1px solid var(--line);
            border-radius: 10px;
            padding: 40px 24px;
            text-align: center;
            background: var(--white);
        }

        .score-hero {
            font-family: 'DM Mono', monospace;
            font-size: 56px;
            font-weight: 300;
            color: var(--ink);
            letter-spacing: -3px;
            line-height: 1;
        }

        .score-label-big {
            font-size: 10px;
            font-weight: 500;
            color: var(--ink-4);
            text-transform: uppercase;
            letter-spacing: 1.2px;
            margin-top: 12px;
        }
    </style>
    """, unsafe_allow_html=True)


def topbar_html(title: str, active_tab: str = "", tabs: list = None, is_pro: bool = True) -> str:
    """Génère le HTML de la topbar Variation A."""
    tabs = tabs or []
    tabs_html = ""
    for t in tabs:
        cls = "dash-tab active" if t == active_tab else "dash-tab"
        tabs_html += f'<span class="{cls}">{t}</span>'

    pro = '<span class="dash-pro-chip">Pro</span>' if is_pro else ""
    return f"""
    <div class="dash-topbar">
        <div class="dash-logo"></div>
        <span class="dash-title">{title}</span>
        <div class="dash-tab-bar">{tabs_html}</div>
        <div class="dash-spacer"></div>
        {pro}
        <div class="dash-avatar">DG</div>
    </div>
    """


def kpi_cell(label: str, value: str, delta: float = 0, sparkline: str = "") -> str:
    """Génère le HTML d'une cellule KPI."""
    if delta > 0:
        delta_cls = "pos"
        arrow = "↑"
        delta_str = f"+{delta:.1f}%"
    elif delta < 0:
        delta_cls = "neg"
        arrow = "↓"
        delta_str = f"{delta:.1f}%"
    else:
        delta_cls = "neu"
        arrow = "—"
        delta_str = "—"

    spark_html = f'<div class="kpi-spark">{sparkline}</div>' if sparkline else ""

    return f"""
    <div class="kpi-cell">
        <div class="kpi-label">{label}</div>
        <div class="kpi-value">{value}</div>
        <div class="kpi-delta {delta_cls}">{arrow} {delta_str}</div>
        {spark_html}
    </div>
    """


def fmt_number(n: float) -> str:
    """Formate un nombre pour affichage KPI."""
    if n >= 1_000_000:
        return f"{n/1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n/1_000:.1f}k"
    return str(int(n))
