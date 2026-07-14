"""Helper de style Plotly aligné sur le design system Variation A (Clarity).

Usage minimal :
    fig = make_subplots(specs=[[{"secondary_y": True}]])
    fig.add_trace(...)
    apply_pulse_style(fig, height=300)

Pour overrides locaux (titre d'axe, etc.), appeler `fig.update_yaxes(...)`
APRÈS `apply_pulse_style(fig)`.
"""

from __future__ import annotations

import plotly.graph_objects as go


# ── Tokens (sync avec theme.py / Variation A Clarity) ───────────────────────
PULSE = {
    # Texte
    "ink":        "#0a0a0a",   # texte principal
    "ink_2":      "#333333",
    "ink_3":      "#666666",   # labels secondaires
    "ink_4":      "#999999",   # ticks d'axe
    "ink_5":      "#c8c8c8",   # texte désactivé

    # Surfaces
    "white":      "#ffffff",
    "bg":         "#fafaf9",   # fond app
    "bg_2":       "#f4f3f1",
    "bg_3":       "#eeede9",

    # Lignes
    "line":       "rgba(0,0,0,0.07)",
    "line_str":   "rgba(0,0,0,0.12)",
    "grid":       "rgba(0,0,0,0.04)",  # gridlines ultra subtiles

    # Accents
    "accent":     "#1a56ff",   # brand
    "accent_l":   "#eef2ff",
    "pos":        "#1a7a4a",   # vert positif
    "pos_l":      "#e8f5ee",
    "neg":        "#c0392b",   # rouge négatif
    "neg_l":      "#fdecea",

    # Fonts
    "font_body":  "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    "font_mono":  "'DM Mono', ui-monospace, monospace",
}


# ── Palette catégorielle (pour traces multiples) ────────────────────────────
PULSE_PALETTE = [
    "#1a56ff",  # brand
    "#1a7a4a",  # vert
    "#b86b00",  # orange
    "#5b6ee1",  # bleu doux
    "#7a4ab8",  # violet
    "#c0392b",  # rouge
]


def apply_pulse_style(
    fig: go.Figure,
    *,
    height: int | None = None,
    in_card: bool = False,
    show_legend: bool = True,
    legend_position: str = "top-right",  # "top-right" | "bottom"
) -> go.Figure:
    """Applique le style Pulse à une figure Plotly.

    Args:
        fig: la figure Plotly
        height: hauteur en pixels (optionnel)
        in_card: True si le graph est dans une card blanche → bg blanc.
                 False = bg neutre app.
        show_legend: afficher la légende
        legend_position: "top-right" (default) ou "bottom"
    """
    bg = PULSE["white"] if in_card else PULSE["bg"]

    layout: dict = dict(
        paper_bgcolor=bg,
        plot_bgcolor=bg,
        font=dict(
            family=PULSE["font_body"],
            size=12,
            color=PULSE["ink_3"],
        ),
        margin=dict(l=8, r=8, t=24, b=8),
        showlegend=show_legend,
        hovermode="x unified",
        hoverlabel=dict(
            bgcolor=PULSE["white"],
            bordercolor=PULSE["line_str"],
            font=dict(
                family=PULSE["font_body"],
                size=12,
                color=PULSE["ink_2"],
            ),
        ),
    )

    if height is not None:
        layout["height"] = height

    # Légende
    if show_legend:
        if legend_position == "bottom":
            layout["legend"] = dict(
                orientation="h",
                yanchor="bottom", y=-0.25,
                xanchor="left", x=0,
                font=dict(size=11, color=PULSE["ink_4"], family=PULSE["font_body"]),
                bgcolor="rgba(0,0,0,0)",
            )
        else:  # top-right
            layout["legend"] = dict(
                orientation="h",
                yanchor="bottom", y=1.02,
                xanchor="right", x=1,
                font=dict(size=11, color=PULSE["ink_4"], family=PULSE["font_body"]),
                bgcolor="rgba(0,0,0,0)",
            )

    fig.update_layout(**layout)

    # ── Axes X ───────────────────────────────────────────────────────────
    fig.update_xaxes(
        showgrid=False,
        zeroline=False,
        linecolor=PULSE["line"],
        tickfont=dict(
            family=PULSE["font_mono"],
            size=10,
            color=PULSE["ink_4"],
        ),
        title_font=dict(
            family=PULSE["font_body"],
            size=11,
            color=PULSE["ink_3"],
        ),
        fixedrange=True,
    )

    # ── Axes Y ───────────────────────────────────────────────────────────
    fig.update_yaxes(
        showgrid=True,
        gridcolor=PULSE["grid"],
        zeroline=False,
        linecolor="rgba(0,0,0,0)",
        tickfont=dict(
            family=PULSE["font_mono"],
            size=10,
            color=PULSE["ink_4"],
        ),
        title_font=dict(
            family=PULSE["font_body"],
            size=11,
            color=PULSE["ink_3"],
        ),
        fixedrange=True,
    )

    return fig


# ── Couleurs utilitaires pour delta (gain/perte) ────────────────────────────
def delta_color(value: float, *, neutral: str | None = None) -> str:
    """Retourne la couleur Pulse selon le signe d'un delta."""
    if value > 0:
        return PULSE["pos"]
    if value < 0:
        return PULSE["neg"]
    return neutral or "rgba(14,15,18,0.15)"
