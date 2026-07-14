"""Page Labels — l'unique endroit pour créer / renommer / supprimer les labels.

Liste maîtresse partagée (profiles.labels) utilisée sur Meta, Google et Instagram.
Renommer/supprimer ici se propage à toutes les assignations (campagnes + posts).
"""

import streamlit as st

from scripts.fetch_data import fetch_labels
from scripts.labels import (
    add_label, rename_label_everywhere, delete_label_everywhere, label_usage_counts,
)

# Canaux affichés dans les compteurs d'usage
_CH = [("meta", "▣", "#1a56ff"), ("google", "◆", "#1a7a4a"), ("instagram", "◎", "#7b4fff")]


def _clear_caches():
    """Force les autres pages à relire la liste partagée.

    ⚠ Les flags *_initialized doivent sauter aussi : sans ça, _init_cout_state /
    _init_google_state voient leur flag encore vrai et ne rechargent JAMAIS la
    liste → labels invisibles dans les tabs Meta/Google jusqu'au re-login.
    """
    for k in ("insta_labels", "campaign_labels", "google_campaign_labels",
              "_insta_labels_init", "cout_initialized", "google_initialized"):
        st.session_state.pop(k, None)


def _usage_chips(usage: dict) -> str:
    parts = []
    for ch, icon, color in _CH:
        n = (usage or {}).get(ch, 0)
        if n:
            parts.append(f'<span style="color:{color};font-weight:600;">{icon} {n}</span>')
    if not parts:
        return '<span style="color:#8b8e98;">non utilisé</span>'
    return '<span style="font-size:12.5px;display:inline-flex;gap:12px;">' + "".join(parts) + "</span>"


def show_labels_page(client, user_id) -> None:
    # ── Hero ─────────────────────────────────────────────────────────────────
    st.markdown(
        '<div style="padding:28px 0 16px;">'
        '<div style="font-size:11px;font-weight:600;text-transform:uppercase;'
        'letter-spacing:1px;color:#8b8e98;margin-bottom:6px;">Configuration</div>'
        '<h1 style="font-family:\'Instrument Serif\',Georgia,serif;font-size:2rem;'
        'font-weight:400;color:#0e0f12;margin:0;line-height:1.2;">Labels</h1>'
        '<p style="font-size:14px;color:#5a5d66;margin:6px 0 0;">'
        "Une seule liste, utilisée sur Meta Ads, Google Ads et Instagram. "
        "Renommer ou supprimer ici met à jour partout.</p>"
        "</div>",
        unsafe_allow_html=True,
    )

    # ── Créer ────────────────────────────────────────────────────────────────
    with st.form("add_label_form", clear_on_submit=True):
        c1, c2 = st.columns([4, 1])
        with c1:
            new_name = st.text_input("Nouveau label", placeholder="ex. Promo été",
                                     label_visibility="collapsed")
        with c2:
            submitted = st.form_submit_button("Créer", use_container_width=True, type="primary")
        if submitted:
            ok, msg = add_label(client, user_id, new_name)
            if ok:
                _clear_caches()
                st.success(msg)
                st.rerun()
            else:
                st.warning(msg)

    labels = sorted(fetch_labels(client, user_id))
    counts = label_usage_counts(client, user_id)

    if not labels:
        st.info("Aucun label pour l'instant. Crée ton premier ci-dessus (ex. « Promo », « Branding »).")
        return

    st.markdown(
        f'<div style="font-size:10px;font-weight:600;text-transform:uppercase;'
        f'letter-spacing:0.06em;color:#8b8e98;margin:18px 0 8px;">'
        f'{len(labels)} label{"s" if len(labels) > 1 else ""}</div>',
        unsafe_allow_html=True,
    )

    # ── Liste ────────────────────────────────────────────────────────────────
    for lbl in labels:
        usage = counts.get(lbl, {})
        total = sum(usage.values()) if usage else 0
        with st.container(border=True):
            c_name, c_use, c_ren, c_del = st.columns([2.6, 2, 1.1, 1.1])
            with c_name:
                st.markdown(
                    f'<div style="font-size:14px;font-weight:600;color:#0e0f12;padding-top:6px;">{lbl}</div>',
                    unsafe_allow_html=True,
                )
            with c_use:
                st.markdown(f'<div style="padding-top:7px;">{_usage_chips(usage)}</div>',
                            unsafe_allow_html=True)
            with c_ren:
                with st.popover("Renommer", use_container_width=True):
                    nn = st.text_input("Nouveau nom", value=lbl, key=f"ren_{lbl}")
                    if st.button("Enregistrer", key=f"renbtn_{lbl}", type="primary", use_container_width=True):
                        ok, msg = rename_label_everywhere(client, user_id, lbl, nn)
                        if ok:
                            _clear_caches()
                            st.rerun()
                        else:
                            st.warning(msg)
            with c_del:
                with st.popover("Supprimer", use_container_width=True):
                    st.markdown(
                        f"Supprimer **« {lbl} »** ?"
                        + (f"<br><span style='font-size:12px;color:#b86b00;'>Utilisé sur {total} élément(s) — "
                           "le label sera retiré partout.</span>" if total else ""),
                        unsafe_allow_html=True,
                    )
                    if st.button("Confirmer la suppression", key=f"delbtn_{lbl}",
                                 type="primary", use_container_width=True):
                        delete_label_everywhere(client, user_id, lbl)
                        _clear_caches()
                        st.rerun()
