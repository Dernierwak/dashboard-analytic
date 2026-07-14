import streamlit as st
from supabase import Client

from scripts.insert_data import insert_schedule_data
from scripts.fetch_data import fetch_last_data_date

_DAYS_FR = {
    "Monday": "lundi",
    "Tuesday": "mardi",
    "Wednesday": "mercredi",
    "Thursday": "jeudi",
    "Friday": "vendredi",
    "Saturday": "samedi",
    "Sunday": "dimanche",
}

_MONTHS_FR = {1: "jan", 2: "fév", 3: "mar", 4: "avr", 5: "mai", 6: "jun",
              7: "jul", 8: "aoû", 9: "sep", 10: "oct", 11: "nov", 12: "déc"}


def _fmt_data_date(iso: str | None) -> str:
    """'2026-06-13' → '13 jun'. Renvoie '—' si absent/illisible."""
    if not iso:
        return "—"
    try:
        y, m, d = iso[:10].split("-")
        return f"{int(d)} {_MONTHS_FR.get(int(m), m)}"
    except Exception:
        return iso[:10]


def schedule(supabase: Client, user_id, has_fetched: bool = False):
    """Sidebar — une seule mention de la mise à jour auto, mise en valeur.

    Card stylée avec le jour actuel + expander discret pour modifier.
    """
    with st.sidebar:
        options = list(_DAYS_FR.keys())
        current = st.session_state.get("fetch_schedule")
        index = options.index(current) if current in options else 0
        day_fr = _DAYS_FR.get(current or options[index], "lundi")

        # Dernière date de données — requêtée à chaque render (toujours fraîche)
        try:
            data_date_fr = _fmt_data_date(fetch_last_data_date(supabase, user_id))
        except Exception:
            data_date_fr = "—"

        # Mention unique, valorisée — jour de fetch + fraîcheur des données
        st.markdown(
            '<div style="margin-top:16px;padding:10px 12px;'
            "background:rgba(26,86,255,0.06);border:1px solid rgba(26,86,255,0.15);"
            'border-radius:10px;">'
            '<div style="font-size:9px;font-weight:600;text-transform:uppercase;'
            'letter-spacing:0.08em;color:#1a56ff;margin-bottom:2px;">Mise à jour auto</div>'
            f'<div style="font-size:13px;font-weight:600;color:#0e0f12;">'
            f"Chaque {day_fr} · 07:00 UTC</div>"
            '<div style="font-size:11px;color:#5a5d66;margin-top:5px;'
            'padding-top:5px;border-top:1px solid rgba(26,86,255,0.15);">'
            f"Données jusqu'au <b>{data_date_fr}</b></div>"
            "</div>",
            unsafe_allow_html=True,
        )

        with st.expander("Modifier le jour"):
            fetch_schedule = st.selectbox(
                "Jour", options=options, index=index,
                format_func=lambda d: _DAYS_FR[d].capitalize(),
                label_visibility="collapsed",
            )
            if st.button("Enregistrer", use_container_width=True):
                st.session_state["fetch_schedule"] = fetch_schedule
                insert_schedule_data(supabase=supabase, user_id=user_id, fetch_schedule=fetch_schedule)
                st.rerun()

        # Ouvre le pop-up « Mes données » (point unique de récupération, tous
        # canaux + choix de période). Le dialog est rendu par pages/main.py.
        if st.button("↻ Mes données", use_container_width=True, type="primary",
                     key="btn_manual_fetch",
                     help="Récupère tes données de tous les canaux, tout de suite — avec le choix de la période."):
            st.session_state["_manual_fetch_request"] = True
            st.rerun()
