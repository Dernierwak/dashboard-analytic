DASHBOARD_CSS = """
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    /* ── Base ── */
    .stApp, .stApp > *, [data-testid="stAppViewContainer"] {
        background-color: #ffffff !important;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    [data-testid="stHeader"] { background: #ffffff !important; border-bottom: 1px solid #eaeaea; }
    [data-testid="stSidebar"] { background: #fafafa !important; border-right: 1px solid #eaeaea; }
    [data-testid="stSidebar"] * { color: #37352f !important; }

    /* ── Typography ── */
    h1, h2, h3, h4 { color: #191919 !important; font-weight: 600 !important; }
    p, span, div, label, li { color: #37352f; }

    /* ── Tabs ── */
    [data-testid="stTabs"] [data-baseweb="tab-list"] {
        background: #ffffff !important;
        border-bottom: 1px solid #eaeaea;
        gap: 4px;
    }
    [data-testid="stTabs"] [data-baseweb="tab"] {
        background: transparent !important;
        color: #6b6b6b !important;
        border-radius: 8px 8px 0 0;
        font-weight: 500;
        padding: 10px 20px;
    }
    [data-testid="stTabs"] [aria-selected="true"] {
        color: #191919 !important;
        border-bottom: 2px solid #191919 !important;
        background: transparent !important;
    }

    /* ── Buttons ── */
    [data-testid="stButton"] > button {
        background: #0066ff !important;
        color: #ffffff !important;
        border: none !important;
        border-radius: 8px !important;
        font-weight: 500 !important;
        padding: 8px 20px !important;
        font-family: 'Inter', sans-serif !important;
        transition: all 0.2s !important;
    }
    [data-testid="stButton"] > button p,
    [data-testid="stButton"] > button span {
        color: #ffffff !important;
    }
    [data-testid="stButton"] > button:hover {
        background: #0052cc !important;
        box-shadow: 0 2px 8px rgba(0,102,255,0.25) !important;
    }
    [data-testid="stButton"] > button[kind="secondary"] {
        background: #0066ff !important;
        color: #ffffff !important;
        border: none !important;
    }
    [data-testid="stButton"] > button[kind="secondary"] p,
    [data-testid="stButton"] > button[kind="secondary"] span {
        color: #ffffff !important;
    }
    [data-testid="stLinkButton"] > a {
        background: #ffffff !important;
        color: #191919 !important;
        border: 1px solid #eaeaea !important;
        border-radius: 8px !important;
        font-weight: 500 !important;
        text-decoration: none !important;
        transition: all 0.2s !important;
    }
    [data-testid="stLinkButton"] > a:hover { border-color: #191919 !important; }

    /* ── Selectbox ── */
    [data-testid="stSelectbox"] > div > div {
        background: #ffffff !important;
        border: 1px solid #eaeaea !important;
        border-radius: 8px !important;
        color: #191919 !important;
    }

    /* ── Slider ── */
    [data-testid="stSlider"] { background: transparent !important; }
    [data-testid="stSlider"] [data-baseweb="slider"] { background: transparent !important; }
    [data-testid="stSlider"] [data-testid="stTickBar"] { background: transparent !important; }
    [data-testid="stSlider"] div[data-baseweb="slider"] > div:first-child {
        background: #eaeaea !important;
    }
    [data-testid="stSlider"] div[role="slider"] {
        background: #191919 !important;
        border-color: #191919 !important;
    }
    [data-testid="stSlider"] label { color: #6b6b6b !important; font-size: 0.85rem !important; }
    [data-testid="stSlider"] [data-testid="stMarkdownContainer"] p { color: #191919 !important; font-size: 0.82rem !important; }

    /* ── Text inputs ── */
    [data-testid="stTextInput"] > div > div > input {
        background: #ffffff !important;
        border: 1px solid #eaeaea !important;
        border-radius: 8px !important;
        color: #191919 !important;
    }
    [data-testid="stTextInput"] > div > div > input:focus { border-color: #191919 !important; box-shadow: none !important; }

    /* ── Metrics ── */
    [data-testid="stMetric"] {
        background: #fafafa !important;
        border: 1px solid #eaeaea !important;
        border-radius: 12px !important;
        padding: 20px 24px !important;
    }
    [data-testid="stMetricLabel"] > div { font-size: 0.82rem !important; color: #6b6b6b !important; }
    [data-testid="stMetricValue"] { font-size: 1.6rem !important; font-weight: 700 !important; color: #191919 !important; }

    /* ── Plotly charts ── */
    [data-testid="stPlotlyChart"] { background: #ffffff !important; border-radius: 12px !important; }
    [data-testid="stPlotlyChart"] > div { background: #ffffff !important; }

    /* ── Dataframe ── */
    [data-testid="stDataFrame"] { border: 1px solid #eaeaea !important; border-radius: 12px !important; overflow: hidden; }
    [data-testid="stDataFrame"] th { color: #191919 !important; font-weight: 600 !important; }
    [data-testid="stDataFrame"] td { color: #37352f !important; }

    /* ── Info / success / warning ── */
    [data-testid="stAlert"] { border-radius: 10px !important; border: 1px solid #eaeaea !important; }

    /* ── Custom components ── */
    .kpi-card {
        background: #fafafa;
        border: 1px solid #eaeaea;
        border-radius: 12px;
        padding: 24px 28px;
        transition: border-color 0.2s, box-shadow 0.2s;
        height: 100%;
    }
    .kpi-card:hover { border-color: #191919; box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
    .kpi-label { font-size: 0.82rem; color: #6b6b6b !important; margin-bottom: 8px; font-weight: 500; }
    .kpi-value { font-size: 2rem; font-weight: 700; color: #191919 !important; line-height: 1.1; }
    .kpi-delta { font-size: 0.82rem; margin-top: 6px; font-weight: 500; }
    .kpi-delta.positive { color: #16a34a !important; }
    .kpi-delta.negative { color: #dc2626 !important; }

    .section-title { font-size: 1rem; font-weight: 600; color: #191919 !important; margin-bottom: 12px; margin-top: 4px; }

    .source-badge {
        background: #f0f4ff; color: #0066ff !important;
        border-radius: 20px; padding: 4px 14px;
        font-size: 0.78rem; font-weight: 600;
        display: inline-block;
    }
    .account-name { font-weight: 600; color: #191919 !important; font-size: 1rem; }
    .account-meta { font-size: 0.82rem; color: #6b6b6b !important; margin-top: 2px; }
    .post-metric { font-size: 1.5rem; font-weight: 700; color: #191919 !important; margin: 8px 0 4px; }
    .post-type { font-size: 0.78rem; color: #6b6b6b !important; }
</style>
"""
