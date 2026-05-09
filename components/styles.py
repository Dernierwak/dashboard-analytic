DASHBOARD_CSS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap');

/* ── Pulse design tokens ── */
:root {
    --ink: #0e0f12;
    --ink-2: #2a2c33;
    --ink-3: #5a5d66;
    --ink-4: #8b8e98;
    --ink-5: #b8bac2;
    --line: rgba(14,15,18,0.08);
    --line-strong: rgba(14,15,18,0.14);
    --bg: #ffffff;
    --bg-2: #faf9f6;
    --bg-3: #f3f2ed;
    --bg-tint: #f7f7f4;
    --brand: #3b5bff;
    --brand-soft: #ebeeff;
    --brand-ink: #1f37c4;
    --good: #1a7a4a;
    --good-soft: #e7f3ec;
    --warn: #b86b00;
    --warn-soft: #fbf1de;
    --bad: #c0392b;
    --bad-soft: #fbe9e6;
    --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
    --font-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;
    --font-display: "Instrument Serif", "Iowan Old Style", Georgia, serif;
    --r-sm: 6px;
    --r: 10px;
    --r-lg: 14px;
    --r-xl: 18px;
    --pad-card: 20px;
}

/* ── App background ── */
.stApp, .stApp > *, [data-testid="stAppViewContainer"] {
    background-color: #faf9f6 !important;
    font-family: var(--font-sans) !important;
    -webkit-font-smoothing: antialiased;
}
[data-testid="stHeader"] {
    background: rgba(250,249,246,0.9) !important;
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--line) !important;
}
[data-testid="stSidebar"] {
    background: #faf9f6 !important;
    border-right: 1px solid var(--line) !important;
}
[data-testid="stSidebar"] * { color: var(--ink-2) !important; }
[data-testid="stSidebarNav"] { display: none !important; }
[data-testid="stMainBlockContainer"] { background: transparent !important; }

/* ── Typography ── */
h1, h2, h3, h4 {
    color: var(--ink) !important;
    font-family: var(--font-sans) !important;
    font-weight: 600 !important;
}
p, span, div, label, li { color: var(--ink-2); }

/* ── Tabs ── */
[data-testid="stTabs"] [data-baseweb="tab-list"] {
    background: transparent !important;
    border-bottom: 1px solid var(--line);
    gap: 2px;
}
[data-testid="stTabs"] [data-baseweb="tab"] {
    background: transparent !important;
    color: var(--ink-4) !important;
    border-radius: 6px 6px 0 0;
    font-weight: 500;
    font-size: 13px;
    padding: 8px 16px;
    border-bottom: 2px solid transparent !important;
}
[data-testid="stTabs"] [data-baseweb="tab"]:hover {
    color: var(--ink-2) !important;
    background: var(--bg-3) !important;
}
[data-testid="stTabs"] [aria-selected="true"] {
    color: var(--ink) !important;
    border-bottom: 2px solid var(--ink) !important;
    background: transparent !important;
    font-weight: 600 !important;
}
/* Sub-tabs (account) — lighter style */
.stTabs .stTabs [data-baseweb="tab"] {
    background: transparent !important;
    font-weight: 400 !important;
    padding: 6px 12px !important;
    border: none !important;
    border-bottom: 2px solid transparent !important;
    color: var(--ink-3) !important;
    font-size: 13px !important;
}
.stTabs .stTabs [aria-selected="true"] {
    background: transparent !important;
    font-weight: 600 !important;
    color: var(--ink) !important;
    border-bottom: 2px solid var(--brand) !important;
}

/* ── Buttons ── */
[data-testid="stButton"] > button {
    background: var(--ink) !important;
    color: #fff !important;
    border: none !important;
    border-radius: var(--r-sm) !important;
    font-weight: 500 !important;
    font-size: 12.5px !important;
    padding: 7px 14px !important;
    font-family: var(--font-sans) !important;
    transition: background 0.15s !important;
}
[data-testid="stButton"] > button p,
[data-testid="stButton"] > button span { color: #fff !important; }
[data-testid="stButton"] > button:hover { background: #000 !important; }
[data-testid="stButton"] > button[kind="secondary"] {
    background: #fff !important;
    color: var(--ink-2) !important;
    border: 1px solid var(--line-strong) !important;
}
[data-testid="stButton"] > button[kind="secondary"] p,
[data-testid="stButton"] > button[kind="secondary"] span { color: var(--ink-2) !important; }
[data-testid="stLinkButton"] > a {
    background: #fff !important;
    color: var(--ink) !important;
    border: 1px solid var(--line) !important;
    border-radius: var(--r-sm) !important;
    font-weight: 500 !important;
    font-size: 12.5px !important;
    text-decoration: none !important;
}

/* ── Inputs ── */
[data-testid="stSelectbox"] > div > div,
[data-testid="stTextInput"] > div > div > input,
[data-testid="stTextArea"] > div > div > textarea {
    background: #fff !important;
    border: 1px solid var(--line-strong) !important;
    border-radius: var(--r-sm) !important;
    color: var(--ink) !important;
    font-size: 13px !important;
}
[data-testid="stMultiSelect"] > div { border-radius: var(--r-sm) !important; }

/* ── Popover / Expander ── */
[data-testid="stExpander"] {
    border: 1px solid var(--line) !important;
    border-radius: var(--r) !important;
    background: #fff !important;
}

/* ── Plotly ── */
[data-testid="stPlotlyChart"] { background: transparent !important; border-radius: var(--r-lg) !important; }

/* ── Dataframe ── */
[data-testid="stDataFrame"] { border: 1px solid var(--line) !important; border-radius: var(--r-lg) !important; overflow: hidden; }
[data-testid="stDataFrame"] th { color: var(--ink) !important; font-weight: 600 !important; background: var(--bg-tint) !important; }
[data-testid="stDataFrame"] td { color: var(--ink-2) !important; }

/* ── Alerts ── */
[data-testid="stAlert"] { border-radius: var(--r) !important; border: 1px solid var(--line) !important; }

/* ── Pulse component classes ── */

/* Section titles */
.section-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--ink);
    letter-spacing: -0.1px;
    margin-bottom: 12px;
    margin-top: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
}

/* KPI strip (Instagram dashboard) */
.kpi-strip-row { display:flex; gap:12px; margin-bottom:20px; }
.kpi-cell-strip {
    flex:1; background:#fff; border:1px solid var(--line);
    border-radius:var(--r-lg); padding:14px 16px; min-width:0;
    position:relative;
}
.kpi-label-strip {
    font-size:11px; font-weight:600; color:var(--ink-4);
    text-transform:uppercase; letter-spacing:0.06em; margin-bottom:6px;
}
.kpi-value-strip {
    font-size:1.5rem; font-weight:500; color:var(--ink); line-height:1.1;
    font-family:var(--font-mono); letter-spacing:-0.02em;
    font-feature-settings:"tnum";
}
.kpi-delta-strip { font-size:11px; font-weight:500; margin-top:4px; }
.kpi-delta-strip.rp-pos { color:var(--good); }
.kpi-delta-strip.rp-neg { color:var(--bad); }

/* KPI grid (Meta Ads) */
.kpi-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:28px; }
.kpi-p {
    background:#fff; border:1px solid var(--line);
    border-radius:var(--r-lg); padding:16px 20px;
    position:relative;
}
.kpi-p .kp-lbl {
    font-size:11px; font-weight:600; text-transform:uppercase;
    letter-spacing:0.06em; color:var(--ink-4); margin-bottom:8px;
}
.kpi-p .kp-val {
    font-family:var(--font-mono); font-size:1.7rem;
    font-weight:500; color:var(--ink); line-height:1;
    letter-spacing:-0.02em; font-feature-settings:"tnum";
}
.kpi-p .kp-unit { font-size:1rem; color:var(--ink-4); margin-left:3px; }
.kpi-p .kp-delta { margin-top:8px; font-size:11.5px; font-weight:500; }
.kpi-p .kp-spark { position:absolute; right:14px; top:14px; opacity:0.85; }
.kp-good { color:var(--good); } .kp-bad { color:var(--bad); } .kp-neu { color:var(--ink-4); }
/* delta badges */
.delta { display:inline-flex;align-items:center;gap:3px;font-family:var(--font-mono);font-size:11.5px;font-weight:500;padding:1px 5px;border-radius:4px;font-feature-settings:"tnum"; }
.delta.up { background:var(--good-soft);color:var(--good); }
.delta.down { background:var(--bad-soft);color:var(--bad); }
.delta.flat { background:var(--bg-3);color:var(--ink-3); }

/* Hero */
.page-h { padding:28px 0 20px; }
.h-eyebrow { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.1em; color:var(--ink-4); margin-bottom:8px; font-family:var(--font-mono); }
.page-h h1 { font-family:var(--font-display) !important; font-weight:400 !important; font-size:36px !important; letter-spacing:-0.02em !important; color:var(--ink) !important; line-height:1.1 !important; margin:0 0 8px !important; }
.h-sub { color:var(--ink-3); font-size:14px; max-width:60ch; }

/* Sections */
.section { margin-bottom:28px; }
.section-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; gap:16px; }
.st-count { color:var(--ink-4); font-family:var(--font-mono); font-weight:400; font-size:12px; }

/* Cards */
.card { background:#fff; border:1px solid var(--line); border-radius:var(--r-lg); padding:var(--pad-card); }
.card.flush { padding:0; }

/* Chips */
.chip { display:inline-flex;align-items:center;gap:5px;padding:3px 8px;font-size:11px;background:var(--bg-3);color:var(--ink-2);border-radius:999px;font-weight:500; }
.chip.good { background:var(--good-soft);color:var(--good); }
.chip.bad  { background:var(--bad-soft);color:var(--bad); }
.chip.warn { background:var(--warn-soft);color:var(--warn); }
.chip.outline { background:#fff;border:1px solid var(--line);color:var(--ink-2); }
.chip.tiny { font-size:10px;padding:2px 7px; }

/* Seg buttons (overrides st.radio) */
div[data-testid="stRadio"] > label { display:none !important; }
div[data-testid="stRadio"] > div[role="radiogroup"] {
    background:var(--bg-3);border-radius:8px;padding:2px;gap:2px;
    display:inline-flex;flex-direction:row;flex-wrap:nowrap;
}
div[data-testid="stRadio"] [data-baseweb="radio"] {
    background:transparent;border-radius:6px;padding:5px 12px;margin:0;
}
div[data-testid="stRadio"] [data-baseweb="radio"] > div:first-child { display:none; }
div[data-testid="stRadio"] [data-baseweb="radio"] label {
    font-size:12px;font-weight:500;color:var(--ink-3);cursor:pointer;padding:0;line-height:1;
}
div[data-testid="stRadio"] [aria-checked="true"][data-baseweb="radio"] {
    background:#fff;box-shadow:0 1px 2px rgba(0,0,0,0.06);
}
div[data-testid="stRadio"] [aria-checked="true"][data-baseweb="radio"] label {
    color:var(--ink);font-weight:600;
}

/* Health bar */
.bar { height:4px;background:var(--bg-3);border-radius:999px;overflow:hidden;width:100%; }
.bar > span { display:block;height:100%;border-radius:999px; }

/* Campaign rows (Meta Ads) */
.camp-row {
    background:#fff;border:1px solid var(--line);border-radius:var(--r-lg);
    padding:14px 18px;margin-bottom:8px;
    display:grid;grid-template-columns:minmax(0,2fr) auto repeat(4,88px) 72px;
    gap:16px;align-items:center;
}
.camp-row.paused { opacity:0.62; }
.cell-lbl { font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:var(--ink-4);font-weight:600;margin-bottom:4px; }
.cell-val { font-family:var(--font-mono);font-size:13px;font-weight:500;color:var(--ink);font-feature-settings:"tnum"; }
.cell-r { text-align:right; }

/* Format cards (Instagram) */
.fmt-card { background:#fff;border:1px solid var(--line);border-radius:var(--r-lg);padding:20px; }
.fmt-bars { display:flex;align-items:flex-end;gap:5px;height:60px;margin:12px 0; }
.fmt-bars span { flex:1;border-radius:3px 3px 0 0;opacity:0.85;min-height:4px; }

/* Post cards (Instagram top 3) */
.post-card { background:#fff;border:1px solid var(--line);border-radius:var(--r-lg);overflow:hidden; }
.post-cover { height:180px;position:relative; }
.post-body { padding:14px; }
.post-stats-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding-top:10px;border-top:1px solid var(--line);margin-top:10px; }
.stat-cell { text-align:center; }
.stat-val { font-family:var(--font-mono);font-size:13px;font-weight:500;color:var(--ink);font-feature-settings:"tnum"; }
.stat-lbl { font-size:9.5px;color:var(--ink-4);text-transform:uppercase;letter-spacing:0.05em;margin-top:2px; }

/* Heatmap */
.heatmap-grid { display:grid;gap:4px;font-size:11px;font-family:var(--font-sans); }
.heatmap-cell { height:36px;border-radius:4px;position:relative;transition:opacity 0.15s; }
.heatmap-cell.best { border:1.5px solid var(--brand); }
.heatmap-cell.best::after {
    content:"BEST";position:absolute;inset:0;display:grid;place-items:center;
    font-size:10px;font-weight:700;color:#fff;letter-spacing:0.04em;
}

/* Misc */
.divider { height:1px;background:var(--line);margin:24px 0; }
.mono { font-family:var(--font-mono);font-feature-settings:"tnum"; }
.muted { color:var(--ink-3); }
.tiny { font-size:11px; }
.hint {
    background:var(--bg-tint);border:1px solid var(--line);border-radius:var(--r);
    padding:12px 14px;display:flex;gap:10px;font-size:12.5px;color:var(--ink-2);line-height:1.5;
}

/* Legacy compat */
.account-name { font-weight:600;color:var(--ink) !important;font-size:1rem; }
.account-meta { font-size:0.82rem;color:var(--ink-4) !important;margin-top:2px; }
.post-metric { font-size:1.5rem;font-weight:700;color:var(--ink) !important;margin:8px 0 4px; }
.post-type { font-size:0.78rem;color:var(--ink-4) !important; }
</style>
"""
