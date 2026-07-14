"""Pop-up « Mes données » — LE point unique de récupération, tous canaux.

Décision UX (David) : Paramètres ne sert qu'à CONNECTER les comptes ;
la récupération des données passe par ce dialog unique, ouvert depuis le
bouton ↻ de la barre latérale (et après une connexion OAuth).

- Choix de la période (dernière donnée / année courante / 2 ans)
- Statut PAR canal (✓/⚠ ligne par ligne — on voit lequel échoue)
- Instagram : l'API fonctionne par posts, pas par dates → période non applicable
- ⚠ Streamlit : si l'utilisateur ferme la page, le fetch s'arrête → on lui dit
  de rester. Le worker hebdo reste le filet de sécurité automatique.
"""

from datetime import date

import streamlit as st

from components.meta_ads import run_meta_ads_fetch
from components.instagram_tab import run_instagram_fetch
from components.google_ads import run_google_ads_fetch



def _period_choices():
    y = date.today().year
    return {
        "Depuis ma dernière donnée (rapide)": None,
        f"Année {y} complète": date(y, 1, 1),
        f"Tout — {y - 1} et {y}": date(y - 1, 1, 1),
    }


@st.dialog("Mes données", width="large")
def data_hub_dialog(client, user_id, dash, insta_accounts, has_meta_ads,
                    gad_refresh, gad_customer, is_paid=False):
    """Récupère tout ce qui est connecté, avec statut par canal."""
    from scripts.fetch_data import fetch_ga4_property_id
    ga4_prop = fetch_ga4_property_id(client, user_id) if (client and user_id) else None

    channels = [
        ("▣ Meta Ads",   bool(has_meta_ads)),
        ("◎ Instagram",  bool(insta_accounts)),
        ("◆ Google Ads", bool(gad_refresh and gad_customer)),
        ("◈ Analytics (GA4)", bool(gad_refresh and ga4_prop)),
    ]
    connected = [name for name, ok in channels if ok]

    # ── Canaux ────────────────────────────────────────────────────────────────
    st.markdown(
        "".join(
            f'<div style="display:flex;align-items:center;gap:8px;font-size:13.5px;'
            f'padding:3px 0;color:{"#0e0f12" if ok else "#b0b3bc"};">'
            f'<span style="color:{"#1a7a4a" if ok else "#b0b3bc"};font-weight:700;">'
            f'{"✓" if ok else "–"}</span>{name}'
            f'{"" if ok else " <span style=\'font-size:11.5px;\'>· à connecter dans Paramètres</span>"}'
            f"</div>"
            for name, ok in channels
        ),
        unsafe_allow_html=True,
    )

    if not connected:
        st.info("Aucun canal connecté. Va dans **Paramètres** pour brancher Meta, Instagram ou Google.")
        return

    st.markdown("<div style='height:8px;'></div>", unsafe_allow_html=True)

    # ── Période ───────────────────────────────────────────────────────────────
    # Selectbox (pas st.radio : le CSS global le transforme en segmented buttons
    # illisibles dans un dialog — sélection blanc sur blanc).
    choices = _period_choices()
    # Purge une valeur de session obsolète (anciens libellés) → sinon crash selectbox
    if st.session_state.get("dh_period") not in choices:
        st.session_state.pop("dh_period", None)
    sel = st.selectbox(
        "Période à récupérer",
        options=list(choices.keys()),
        key="dh_period",
        help="S'applique à Meta Ads, Google Ads et Analytics. Instagram est récupéré "
             "par posts (les 10 ou 50 derniers selon ton plan), pas par dates.",
    )
    since_date = choices[sel]

    st.caption("⚠ Reste sur cette page pendant la récupération — si tu la fermes, elle s'arrête. "
               "La mise à jour automatique hebdomadaire continue de tourner quoi qu'il arrive.")

    # ── Go ────────────────────────────────────────────────────────────────────
    if st.button("Tout récupérer", type="primary", use_container_width=True, key="dh_go"):
        force = since_date is not None
        with st.status("Récupération en cours…", expanded=True) as status:
            # Meta Ads
            if has_meta_ads:
                st.write("▣ Meta Ads…")
                try:
                    r = run_meta_ads_fetch(
                        token=st.session_state["meta_long_token"],
                        supabase=client, user_id=user_id,
                        force_full=force, since_date=since_date,
                    )
                    st.write(("✓ Meta Ads : " if r.get("success") else "⚠ Meta Ads : ")
                             + str(r.get("message", "")))
                except Exception as e:
                    st.write(f"⚠ Meta Ads : {e}")
            # Instagram
            if insta_accounts:
                st.write("◎ Instagram…")
                try:
                    biz_id = insta_accounts[0].get("instagram_business_id")
                    run_instagram_fetch(client, user_id, dash,
                                        instagram_business_id=biz_id, is_paid=is_paid)
                    st.write("✓ Instagram : posts à jour")
                except Exception as e:
                    st.write(f"⚠ Instagram : {e}")
            # Google Ads
            if gad_refresh and gad_customer:
                st.write("◆ Google Ads…")
                try:
                    r = run_google_ads_fetch(
                        client, user_id, refresh_token=gad_refresh,
                        customer_id=gad_customer,
                        force_full=force, since_date=since_date,
                    )
                    st.write(("✓ Google Ads : " if r.get("success") else "⚠ Google Ads : ")
                             + str(r.get("message", "")))
                except Exception as e:
                    st.write(f"⚠ Google Ads : {e}")
            # GA4
            if gad_refresh and ga4_prop:
                st.write("◈ Analytics…")
                try:
                    from components.ga4 import run_ga4_fetch
                    r = run_ga4_fetch(client, user_id, refresh_token=gad_refresh,
                                      property_id=ga4_prop,
                                      force_full=force, since_date=since_date)
                    st.write(("✓ Analytics : " if r.get("success") else "⚠ Analytics : ")
                             + str(r.get("message", "")))
                except Exception as e:
                    st.write(f"⚠ Analytics : {e}")
            status.update(label="✓ Récupération terminée", state="complete", expanded=True)

        st.session_state["has_fetched"] = True
        st.success("Terminé — ferme cette fenêtre (✕) pour voir tes données à jour.")
