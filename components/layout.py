"""Hierarchy layout helpers (Stripe/Linear-style) — additif, ne touche à rien d'existant.

Toutes les classes CSS sont préfixées `.h-` pour éviter toute collision avec les
classes existantes (`.kpi-grid`, `.kpi-p`, `.delta`, etc.).

Pattern visuel cible (1 section) :
    META ADS · PERFORMANCE                                  ← .h-eyebrow
    30 derniers jours · 12 campagnes en cours               ← .h-context

        348 274        impressions                          ← .h-hero-num + .h-hero-label
        ▲ +18% vs 30j précédents                            ← .h-delta-pos

        ────────────────────────                            ← .h-divider

        REACH       CLICS       CTR MOYEN                   ← .h-kpi-small (3 par ligne)
        142 K       8 432       2.42%
        ▲ +12%      ▲ +5%       ▼ -0.3pt
"""
from __future__ import annotations

import pandas as pd
import streamlit as st


# ── CSS injection ───────────────────────────────────────────────────────────

_HIERARCHY_CSS = """
<style>
/* ─── Hierarchy layer (préfixes .h-*) ───────────────────────────────── */

/* Eyebrow — petit label uppercase au-dessus d'une section */
.h-eyebrow-v4 {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 10.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #8b8e98;
    margin-bottom: 6px;
}

/* Context — sous-titre fin sous l'eyebrow */
.h-context {
    font-size: 13px;
    font-weight: 400;
    color: #5a5d66;
    margin-bottom: 18px;
}

/* Hero metric block (le gros chiffre + son label) */
.h-hero-block {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 8px;
    flex-wrap: wrap;
}
.h-hero-num {
    font-family: 'DM Mono', 'JetBrains Mono', ui-monospace, monospace;
    font-size: 2.2rem;
    font-weight: 600;
    color: #0e0f12;
    line-height: 1;
    letter-spacing: -0.02em;
}
.h-hero-unit {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 1.1rem;
    font-weight: 500;
    color: #8b8e98;
    line-height: 1;
}
.h-hero-label {
    font-size: 14px;
    font-weight: 400;
    color: #5a5d66;
    letter-spacing: 0.01em;
}

/* Delta badge — ▲/▼ + % + baseline */
.h-delta {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    border-radius: 99px;
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.01em;
    margin-top: 4px;
}
.h-delta-pos { background: #e7f3ec; color: #1a7a4a; }
.h-delta-neg { background: #fbe9e6; color: #c0392b; }
.h-delta-neu { background: rgba(14,15,18,0.05); color: #5a5d66; }
.h-delta .h-delta-base {
    font-weight: 400;
    opacity: 0.78;
    font-size: 11px;
    margin-left: 4px;
}

/* Divider subtil entre hero et supporting */
.h-divider {
    border-top: 1px solid rgba(14,15,18,0.06);
    margin: 20px 0 16px;
}

/* Grille de supporting metrics */
.h-kpi-grid-2 {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    margin-bottom: 10px;
}
.h-kpi-grid-3 {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 10px;
}
.h-kpi-grid-4 {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-bottom: 10px;
}

/* Carte supporting — plus discrète que .kpi (existant) */
.h-kpi-small {
    background: #fff;
    border: 1px solid rgba(14,15,18,0.06);
    border-radius: 10px;
    padding: 12px 14px;
}
.h-kpi-small-label {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #8b8e98;
    margin-bottom: 6px;
}
.h-kpi-small-value {
    font-family: 'DM Mono', 'JetBrains Mono', ui-monospace, monospace;
    font-size: 17px;
    font-weight: 500;
    color: #0e0f12;
    line-height: 1.1;
    letter-spacing: -0.01em;
}
.h-kpi-small-unit {
    font-size: 11px;
    color: #8b8e98;
    margin-left: 3px;
    font-weight: 400;
}
.h-kpi-small .h-delta {
    margin-top: 8px;
    padding: 2px 8px;
    font-size: 10.5px;
}
/* ⓘ popovers d'info — toujours alignés tout à droite de leur colonne */
[data-testid="stPopover"] {
    display: flex;
    justify-content: flex-end;
}
[data-testid="stPopover"] > div { width: auto; }
</style>
"""


def inject_hierarchy_css() -> None:
    """Injecte le CSS pour les classes .h-*.
    À appeler 1 fois par page (idempotent — Streamlit dédoublonne via key).
    """
    st.markdown(_HIERARCHY_CSS, unsafe_allow_html=True)


# ── Delta badge ─────────────────────────────────────────────────────────────

def delta_html(
    delta_pct: float | None,
    baseline_label: str = "vs période précédente",
    *,
    invert: bool = False,
    unit: str = "%",
    threshold: float = 0.5,
) -> str:
    """Génère le badge inline ▲/▼ +X% vs Y.

    Args:
        delta_pct: pourcentage (ex: 18.2 pour +18.2%). Si None → returns "".
        baseline_label: texte qui suit (ex: "vs 30j précédents")
        invert: True si "baisse = bonne" (CPC, CPM, CPV). Inverse le color encoding.
        unit: "%" (défaut), "pt" pour CTR, etc.
        threshold: en valeur absolue, en dessous de quoi on affiche neutre

    Returns:
        Span HTML inline. "" si delta None.
    """
    if delta_pct is None:
        return ""

    abs_d = abs(delta_pct)
    if abs_d < threshold:
        cls = "h-delta-neu"
        icon = "—"
    else:
        is_positive_direction = delta_pct > 0
        # Si invert : baisse = bon → vert
        if invert:
            is_good = not is_positive_direction
        else:
            is_good = is_positive_direction
        cls = "h-delta-pos" if is_good else "h-delta-neg"
        icon = "▲" if delta_pct > 0 else "▼"

    sign = "+" if delta_pct > 0 else ""
    return (
        f'<span class="h-delta {cls}">'
        f'{icon} {sign}{delta_pct:.1f}{unit}'
        f'<span class="h-delta-base">{baseline_label}</span>'
        f'</span>'
    )


# ── Hero section block ──────────────────────────────────────────────────────

def section_hero(
    eyebrow: str,
    context: str | None,
    hero_label: str,
    hero_value: str,
    hero_unit: str = "",
    delta_pct: float | None = None,
    baseline_label: str = "vs période précédente",
    *,
    invert: bool = False,
    delta_unit: str = "%",
) -> None:
    """Rend le bloc hero (eyebrow + context + big number + delta).

    Args:
        eyebrow: "META ADS · PERFORMANCE"
        context: "30 derniers jours · 12 campagnes en cours" (peut être None)
        hero_label: "impressions" (le mot à droite du chiffre)
        hero_value: "348 274" (déjà formaté)
        hero_unit: "" ou "%" ou "CHF" (petit, à droite du chiffre)
        delta_pct: 18.2 (déjà calculé en %, signe inclus). None pour cacher.
        baseline_label: "vs 30j précédents"
        invert: True pour CPC/CPM/CPV (baisse = bon)
        delta_unit: "%" ou "pt" selon métrique
    """
    parts = []
    parts.append(f'<div class="h-eyebrow-v4">{eyebrow}</div>')
    if context:
        parts.append(f'<div class="h-context">{context}</div>')

    unit_html = f'<span class="h-hero-unit">{hero_unit}</span>' if hero_unit else ""
    parts.append(
        f'<div class="h-hero-block">'
        f'<span class="h-hero-num">{hero_value}</span>{unit_html}'
        f'<span class="h-hero-label">{hero_label}</span>'
        f'</div>'
    )

    delta = delta_html(
        delta_pct, baseline_label, invert=invert, unit=delta_unit
    )
    if delta:
        parts.append(f'<div style="margin-bottom:4px;">{delta}</div>')

    st.markdown("".join(parts), unsafe_allow_html=True)


# ── Supporting KPI card ─────────────────────────────────────────────────────

def kpi_small(
    label: str,
    value: str,
    unit: str = "",
    delta_pct: float | None = None,
    baseline_label: str = "",
    *,
    invert: bool = False,
    delta_unit: str = "%",
) -> str:
    """HTML d'une carte supporting (plus discrète que .kpi grande).

    Returns string HTML — à concaténer dans une grille `.h-kpi-grid-3` ou `-4`.
    """
    unit_html = f'<span class="h-kpi-small-unit">{unit}</span>' if unit else ""
    delta = delta_html(
        delta_pct, baseline_label, invert=invert, unit=delta_unit
    )
    delta_part = delta if delta else ""
    return (
        f'<div class="h-kpi-small">'
        f'<div class="h-kpi-small-label">{label}</div>'
        f'<div class="h-kpi-small-value">{value}{unit_html}</div>'
        f'{delta_part}'
        f'</div>'
    )


def kpi_grid(cards_html: list[str], cols: int = 4) -> str:
    """Wrappe une liste de cartes dans une grille .h-kpi-grid-N.

    Args:
        cards_html: liste de HTML strings (de `kpi_small()`).
        cols: 3 ou 4.
    """
    grid_class = f"h-kpi-grid-{cols}"
    return f'<div class="{grid_class}">{"".join(cards_html)}</div>'


def divider() -> str:
    """HTML du divider subtil entre hero et supporting."""
    return '<div class="h-divider"></div>'


# ── Period delta calculator ─────────────────────────────────────────────────

def compute_period_delta(
    df: pd.DataFrame,
    metric_col: str,
    date_col: str,
    since: pd.Timestamp,
    until: pd.Timestamp,
    agg: str = "sum",
) -> float | None:
    """Calcule le delta % entre la période courante et la précédente de même durée.

    Args:
        df: DataFrame contenant les data brutes (non-filtrées).
        metric_col: nom de la colonne métrique (ex: "impressions", "spend").
        date_col: nom de la colonne date (ex: "date_start").
        since, until: bornes de la période courante.
        agg: "sum" ou "mean".

    Returns:
        Delta en % (ex: +18.2 ou -3.4). None si la période précédente est vide
        ou si la métrique courante est 0.
    """
    if df is None or df.empty or metric_col not in df.columns:
        return None

    # Durée de la période courante en jours
    period_days = (until - since).days + 1
    if period_days <= 0:
        return None

    prev_since = since - pd.Timedelta(days=period_days)
    prev_until = since - pd.Timedelta(days=1)

    # Coerce dates pour éviter les erreurs de comparaison
    _dates = pd.to_datetime(df[date_col], errors="coerce")
    current_mask = (_dates >= since) & (_dates <= until)
    previous_mask = (_dates >= prev_since) & (_dates <= prev_until)

    current_data = df.loc[current_mask, metric_col]
    previous_data = df.loc[previous_mask, metric_col]

    if previous_data.empty or current_data.empty:
        return None

    if agg == "sum":
        cur_val = float(current_data.sum())
        prev_val = float(previous_data.sum())
    elif agg == "mean":
        cur_val = float(current_data.mean())
        prev_val = float(previous_data.mean())
    else:
        return None

    if prev_val == 0:
        return None  # pas de baseline → pas de delta possible

    return (cur_val - prev_val) / prev_val * 100


def compute_ratio_delta(
    df: pd.DataFrame,
    numerator_col: str,
    denominator_col: str,
    date_col: str,
    since: pd.Timestamp,
    until: pd.Timestamp,
    multiplier: float = 1.0,
) -> float | None:
    """Calcule le delta % d'un ratio (CTR = clicks/impressions, CPC = spend/clicks, …).

    Returns:
        Delta en % (en points relatifs, pas en pp). None si baseline vide.
    """
    if df is None or df.empty:
        return None
    for c in (numerator_col, denominator_col):
        if c not in df.columns:
            return None

    period_days = (until - since).days + 1
    if period_days <= 0:
        return None
    prev_since = since - pd.Timedelta(days=period_days)
    prev_until = since - pd.Timedelta(days=1)

    _dates = pd.to_datetime(df[date_col], errors="coerce")
    cur = df.loc[(_dates >= since) & (_dates <= until)]
    prev = df.loc[(_dates >= prev_since) & (_dates <= prev_until)]
    if cur.empty or prev.empty:
        return None

    cur_num = float(cur[numerator_col].sum())
    cur_den = float(cur[denominator_col].sum())
    prev_num = float(prev[numerator_col].sum())
    prev_den = float(prev[denominator_col].sum())

    if cur_den == 0 or prev_den == 0:
        return None

    cur_ratio = (cur_num / cur_den) * multiplier
    prev_ratio = (prev_num / prev_den) * multiplier
    if prev_ratio == 0:
        return None

    return (cur_ratio - prev_ratio) / prev_ratio * 100
