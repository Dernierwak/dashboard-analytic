"""Composants UI unifies.

Ce module centralise tous les composants UI reutilisables
pour eviter la duplication de code HTML/CSS.

Usage:
    from components.ui import ui

    ui.section_header("Titre")
    ui.metric_card("Label", value)
    ui.score_card(85, delta=5)
"""

import streamlit as st
from typing import Optional, List, Any


class UIComponents:
    """Composants UI centralises."""

    # =========================================
    # Headers & Text
    # =========================================
    def section_header(self, title: str):
        """Affiche un header de section."""
        st.markdown(f'<p class="section-header">{title}</p>', unsafe_allow_html=True)

    def page_title(self, title: str, subtitle: str = ""):
        """Affiche le titre de page."""
        st.markdown(f"## {title}")
        if subtitle:
            st.caption(subtitle)

    # =========================================
    # Cards
    # =========================================
    def metric_card(self, label: str, value: Any, prefix: str = "", suffix: str = ""):
        """Affiche une carte de metrique.

        Args:
            label: Label de la metrique
            value: Valeur (nombre ou string)
            prefix: Prefixe (ex: "CHF ")
            suffix: Suffixe (ex: "%")
        """
        if isinstance(value, (int, float)):
            formatted = f"{value:,.0f}".replace(",", "'")
        else:
            formatted = str(value)

        st.markdown(f"""
        <div class="metric-card">
            <div class="metric-label">{label}</div>
            <div class="metric-value">{prefix}{formatted}{suffix}</div>
        </div>
        """, unsafe_allow_html=True)

    def score_card(self, score: int, delta: int = 0, label: str = "Score sur 100",
                   size: str = "large"):
        """Affiche une carte de score.

        Args:
            score: Score (0-100)
            delta: Variation vs periode precedente
            label: Label sous le score
            size: "large" ou "small"
        """
        delta_display = ""
        if delta > 0:
            delta_display = f"+{delta}"
        elif delta < 0:
            delta_display = str(delta)

        font_size = "5rem" if size == "large" else "3rem"
        padding = "2.5rem" if size == "large" else "1.5rem"

        st.markdown(f"""
        <div style="
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            border-radius: 16px;
            padding: {padding};
            color: white;
            text-align: center;
        ">
            <div style="font-size: {font_size}; font-weight: 700; line-height: 1;">{score}</div>
            <div style="font-size: 1rem; opacity: 0.9; margin-top: 0.5rem;">{label}</div>
            {"<div style='font-size: 1.25rem; margin-top: 0.5rem; opacity: 0.9;'>" + delta_display + "</div>" if delta_display else ""}
        </div>
        """, unsafe_allow_html=True)

    def connection_card(self, name: str, connected: bool, score: int = 0,
                        username: str = ""):
        """Affiche une carte de connexion.

        Args:
            name: Nom du service (Meta Ads, Instagram)
            connected: Si connecte
            score: Score si connecte
            username: Username si applicable
        """
        dot_class = "dot-connected" if connected else "dot-disconnected"
        dot_color = "#22c55e" if connected else "#ef4444"
        display_name = f"{name} @{username}" if username else name
        status_text = f"Score: {score}/100" if connected else "Non connecte"

        st.markdown(f"""
        <div style="
            background: #f8fafc;
            border-radius: 12px;
            padding: 1.25rem;
            display: flex;
            align-items: center;
            gap: 1rem;
            margin-bottom: 0.75rem;
        ">
            <div style="
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: {dot_color};
            "></div>
            <div style="flex: 1;">
                <div style="font-weight: 600; font-size: 0.95rem; color: #1f2937;">{display_name}</div>
                <div style="font-size: 0.75rem; color: #6b7280;">{status_text}</div>
            </div>
            {"<div style='font-size: 1.25rem; font-weight: 700; color: #6366f1;'>" + str(score) + "</div>" if connected else ""}
        </div>
        """, unsafe_allow_html=True)

    def action_card(self, text: str, label: str = "Recommandation"):
        """Affiche une carte d'action/recommandation."""
        st.markdown(f"""
        <div style="
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            border-radius: 12px;
            padding: 1.5rem;
            border-left: 4px solid #f59e0b;
        ">
            <div style="
                font-size: 0.75rem;
                color: #92400e;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 0.5rem;
            ">{label}</div>
            <div style="font-size: 1rem; color: #78350f; line-height: 1.5;">{text}</div>
        </div>
        """, unsafe_allow_html=True)

    def nav_card(self, icon: str, title: str, desc: str, is_premium: bool = False):
        """Affiche une carte de navigation.

        Args:
            icon: Emoji
            title: Titre
            desc: Description
            is_premium: Afficher badge PRO
        """
        pro_badge = " [PRO]" if is_premium else ""
        st.markdown(f"""
        <div style="
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 1.5rem;
            text-align: center;
            transition: all 0.2s;
        ">
            <div style="font-size: 2rem; margin-bottom: 0.75rem;">{icon}</div>
            <div style="font-weight: 600; font-size: 1rem; color: #1f2937; margin-bottom: 0.25rem;">
                {title}{pro_badge}
            </div>
            <div style="font-size: 0.75rem; color: #6b7280;">{desc}</div>
        </div>
        """, unsafe_allow_html=True)

    # =========================================
    # Data Display
    # =========================================
    def kpi_row(self, kpis: List[tuple]):
        """Affiche une ligne de KPIs.

        Args:
            kpis: Liste de (label, value, prefix, suffix)
        """
        cols = st.columns(len(kpis))
        for col, kpi in zip(cols, kpis):
            with col:
                label = kpi[0]
                value = kpi[1]
                prefix = kpi[2] if len(kpi) > 2 else ""
                suffix = kpi[3] if len(kpi) > 3 else ""
                self.metric_card(label, value, prefix, suffix)

    def top_content_list(self, items: List[dict], limit: int = 3,
                         show_lock: bool = False, total_count: int = 0):
        """Affiche une liste de top contenus.

        Args:
            items: Liste de contenus
            limit: Nombre max a afficher
            show_lock: Afficher icone cadenas
            total_count: Nombre total pour message "+X autres"
        """
        for idx, item in enumerate(items[:limit], 1):
            title = item.get("title", item.get("name", f"#{idx}"))
            metric = item.get("metric", item.get("engagement", ""))
            st.markdown(f"""
            <div style="
                display: flex;
                align-items: center;
                padding: 0.75rem;
                background: #f8fafc;
                border-radius: 8px;
                margin-bottom: 0.5rem;
            ">
                <div style="
                    width: 24px;
                    height: 24px;
                    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
                    color: white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.75rem;
                    font-weight: 600;
                    margin-right: 0.75rem;
                ">{idx}</div>
                <div style="flex: 1; font-size: 0.9rem; color: #1f2937;">{title}</div>
                <div style="font-size: 0.85rem; color: #6366f1; font-weight: 600;">{metric}</div>
            </div>
            """, unsafe_allow_html=True)

        remaining = total_count - limit if total_count else len(items) - limit
        if remaining > 0 and show_lock:
            st.markdown(f"""
            <div style="
                display: flex;
                align-items: center;
                gap: 0.5rem;
                color: #9ca3af;
                font-size: 0.875rem;
                margin-top: 0.5rem;
            ">
                <span>&#128274;</span>
                <span>+{remaining} autres</span>
            </div>
            """, unsafe_allow_html=True)

    # =========================================
    # Status & Feedback
    # =========================================
    def score_status(self, score: int):
        """Affiche un message de statut base sur le score."""
        if score >= 70:
            st.success("Excellente semaine")
        elif score >= 40:
            st.info("Bonne progression")
        elif score > 0:
            st.warning("Axes d'amelioration identifies")
        else:
            st.caption("Connecte une source pour commencer")

    def empty_state(self, message: str, icon: str = "📭"):
        """Affiche un etat vide."""
        st.markdown(f"""
        <div style="
            text-align: center;
            padding: 3rem;
            color: #6b7280;
        ">
            <div style="font-size: 3rem; margin-bottom: 1rem;">{icon}</div>
            <div style="font-size: 1rem;">{message}</div>
        </div>
        """, unsafe_allow_html=True)

    # =========================================
    # Layout Helpers
    # =========================================
    def spacer(self, size: str = "md"):
        """Ajoute un espace vertical."""
        heights = {"sm": "0.5rem", "md": "1rem", "lg": "2rem"}
        st.markdown(f"<div style='height: {heights.get(size, '1rem')}'></div>",
                    unsafe_allow_html=True)

    def divider_with_label(self, label: str):
        """Affiche un divider avec label."""
        st.markdown(f"""
        <div style="
            display: flex;
            align-items: center;
            margin: 1.5rem 0;
        ">
            <div style="flex: 1; height: 1px; background: #e5e7eb;"></div>
            <div style="
                padding: 0 1rem;
                font-size: 0.75rem;
                color: #9ca3af;
                text-transform: uppercase;
            ">{label}</div>
            <div style="flex: 1; height: 1px; background: #e5e7eb;"></div>
        </div>
        """, unsafe_allow_html=True)


# Instance globale
ui = UIComponents()
