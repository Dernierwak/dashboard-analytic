"""Page Coûts — vue unifiée de la dépense, tous canaux confondus.

Structure standard du projet :
  1. Hero statique « Coûts »
  2. Vue d'ensemble (suit la période) : total + split par canal + LE graph
     (unique) de dépense quotidienne empilée
  3. Budgets du mois (PILOTAGE — mois en cours, indépendant du filtre) :
     statut par canal avec repère « % du mois écoulé » (lecture seule) +
     table des budgets PAR MOIS — la surface d'édition, sauvegarde auto
  4. Par label (REGROUPEMENT CROSS-CANAL) : un label additionne Meta + Google + …
     — chip « période filtrée » explicite
  5. Par canal (détail campagne) : budget max + pacing sur la période filtrée

Le regroupement par label permet de raisonner par THÈME de campagne
(« combien me coûte ma Promo, tous canaux ? »), pas par plateforme.
"""

import streamlit as st
import pandas as pd

from components.layout import (
    inject_hierarchy_css, kpi_small, kpi_grid, compute_period_delta,
)
from components.meta_ads import render_period_selector
from scripts.fetch_data import (
    fetch_meta_ads, fetch_campaign_config,
    fetch_google_ads, fetch_google_campaign_config,
    fetch_meta_budget_global, fetch_google_budget_global,
    fetch_channel_budgets, budget_for_month,
)
from scripts.insert_data import (
    upsert_campaign_config, upsert_google_campaign_config,
    upsert_channel_budget,
)

_NO_LABEL = "(sans label)"

# Canaux connus — la liste grandit quand on en ajoute (TikTok, etc.)
CHANNELS = [
    ("meta", "▣", "Meta Ads", "#1a56ff"),
    ("google", "◆", "Google Ads", "#1a7a4a"),
]
_CH = {c[0]: {"icon": c[1], "name": c[2], "color": c[3]} for c in CHANNELS}


def _fmt(n: float) -> str:
    return f"{n:,.0f}".replace(",", " ")


# ── Budget max & pacing (restauré : ce qu'on avait dans l'onglet Coût Meta) ────

def _pacing(spend: float, budget: float):
    """(label, couleur, pct) selon dépensé/budget. budget<=0 → None (pas de budget)."""
    if budget <= 0:
        return None
    pct = spend / budget
    if pct > 1.0:
        return ("⚠ Dépassé", "#c0392b", pct)
    if pct >= 0.7:
        return ("✓ OK", "#1a7a4a", pct)
    return ("↓ Sous-dépense", "#b86b00", pct)


def _cb_save_cout_budget(client, user_id, channel, cid, key):
    """Sauvegarde auto du budget max d'une campagne (Meta → par nom, Google → par id)."""
    if not (client and user_id):
        return
    val = float(st.session_state.get(key, 0) or 0)
    try:
        if channel == "google":
            upsert_google_campaign_config(client, user_id, cid, budget_max=val)
        else:
            upsert_campaign_config(client, user_id, cid, budget_max=val)
    except Exception as e:
        st.toast(f"Sauvegarde budget échouée : {e}", icon="⚠️")


def _cb_save_budget_table(client, user_id, months):
    """Sauvegarde automatique des cellules éditées de la table des budgets —
    on travaille directement dedans, pas de bouton Enregistrer.
    Ne réécrit que les cellules modifiées (edited_rows du data_editor)."""
    if not (client and user_id):
        return
    state = st.session_state.get("budget_year_editor", {})
    name_to_ch = {v["name"]: k for k, v in _CH.items()}
    err = None
    for ridx, changes in (state.get("edited_rows") or {}).items():
        mdate = months[int(ridx)]
        for col, val in changes.items():
            ch = name_to_ch.get(col)
            if not ch:
                continue
            try:
                upsert_channel_budget(client, user_id, ch, mdate.isoformat(), float(val or 0))
            except Exception as e:
                err = e
    st.session_state.pop("_channel_budgets_cache", None)  # forcer relecture (report auto)
    if err:
        st.toast(
            f"Sauvegarde échouée : {err} — exécute la migration channel_budgets.sql",
            icon="⚠️",
        )
    else:
        st.toast("Budget enregistré ✓", icon="✅")


def _load_unified_costs(client, user_id) -> pd.DataFrame:
    """Une ligne par (canal × campagne × jour) avec spend en CHF + label."""
    rows = []

    # ── Meta : spend déjà en CHF, label via meta_campaign_config (clé = campaign_name)
    try:
        meta = fetch_meta_ads(client, user_id) or []
        meta_cfg = fetch_campaign_config(client, user_id) or {}
    except Exception:
        meta, meta_cfg = [], {}
    for r in meta:
        name = r.get("campaign_name", "") or ""
        cfg = meta_cfg.get(name, {}) or {}
        rows.append({
            "channel": "meta",
            "campaign": name,
            "cid": name,  # meta_campaign_config est clé par campaign_name
            "label": cfg.get("label") or _NO_LABEL,
            "budget_max": float(cfg.get("budget_max") or 0),
            "spend": float(r.get("spend") or 0),
            "date_start": r.get("date_start"),
        })

    # ── Google : cost_micros → CHF, label via google_campaign_config (clé = campaign_id)
    try:
        goog = fetch_google_ads(client, user_id) or []
        goog_cfg = fetch_google_campaign_config(client, user_id) or {}
    except Exception:
        goog, goog_cfg = [], {}
    for r in goog:
        cid = str(r.get("campaign_id", "") or "")
        cfg = goog_cfg.get(cid, {}) or {}
        rows.append({
            "channel": "google",
            "campaign": r.get("campaign_name", "") or "",
            "cid": cid,  # google_campaign_config est clé par campaign_id
            "label": cfg.get("label") or _NO_LABEL,
            "budget_max": float(cfg.get("budget_max") or 0),
            "spend": float(r.get("cost_micros") or 0) / 1_000_000,
            "date_start": r.get("date_start"),
        })

    df = pd.DataFrame(rows)
    if not df.empty:
        df["date_start"] = pd.to_datetime(df["date_start"], errors="coerce")
        df["label"] = df["label"].fillna(_NO_LABEL).replace("", _NO_LABEL)
    return df


def _neutral_delta(pct: float | None) -> str:
    """Delta gris (le coût n'est ni bon ni mauvais en soi — juste informatif)."""
    if pct is None:
        return ""
    _chip = ('<span style="display:inline-block;padding:3px 9px;border-radius:99px;'
             'background:rgba(14,15,18,0.05);color:#5a5d66;font-size:11px;font-weight:600;">'
             "{}</span>")
    if abs(pct) < 0.5:  # « ▼ -0% » est un non-sens visuel
        return _chip.format("≈ stable vs période préc.")
    arrow = "▲" if pct >= 0 else "▼"
    sign = "+" if pct >= 0 else ""
    return _chip.format(f"{arrow} {sign}{pct:.0f}% vs période préc.")


def _section_header(icon, name, color, suffix=""):
    st.markdown(
        f'<div style="display:flex;align-items:center;gap:9px;margin:24px 0 12px;">'
        f'<span style="font-size:17px;color:{color};">{icon}</span>'
        f'<span style="font-size:15px;font-weight:600;color:#0e0f12;">{name}</span>'
        f'{suffix}</div>',
        unsafe_allow_html=True,
    )


def show_couts_tab(client, user_id, has_meta_ads: bool = False, has_google_ads: bool = False) -> None:
    inject_hierarchy_css()

    # ── Hero statique ────────────────────────────────────────────────────────
    st.markdown(
        '<div style="padding:28px 0 16px;">'
        '<div style="font-size:11px;font-weight:600;text-transform:uppercase;'
        'letter-spacing:1px;color:#8b8e98;margin-bottom:6px;">Pilotage</div>'
        '<h1 style="font-family:\'Instrument Serif\',Georgia,serif;font-size:2rem;'
        'font-weight:400;color:#0e0f12;margin:0;line-height:1.2;">Coûts</h1>'
        '<p style="font-size:14px;color:#5a5d66;margin:6px 0 0;">'
        "Toute ta dépense publicitaire au même endroit — par canal et par thème.</p>"
        "</div>",
        unsafe_allow_html=True,
    )

    df = _load_unified_costs(client, user_id)
    connected = {"meta": has_meta_ads, "google": has_google_ads}
    if df.empty:
        st.info("Aucune dépense récupérée pour l'instant. Va dans **Paramètres** récupérer tes données Meta Ads / Google Ads.")
        return

    # On montre un canal s'il est CONNECTÉ (même sans dépense) ou s'il a des données.
    # → Google Ads ne disparaît plus en silence quand il n'a pas (encore) de coûts.
    present = set(df["channel"])
    channels_present = [c for c, *_ in CHANNELS if connected.get(c) or c in present]

    # ── Sélecteur de période (pilote toute la page) ─────────────────────────
    since, until = render_period_selector("cout", df["date_start"])
    dfp = df[(df["date_start"] >= since) & (df["date_start"] <= until)].copy()
    # Année TOUJOURS affichée — sans elle, "01.06 → 07.07" perd les gens
    context = f"{since:%d.%m.%Y} → {until:%d.%m.%Y}"

    # ═══ 1. VUE D'ENSEMBLE ══════════════════════════════════════════════════
    total = float(dfp["spend"].sum())
    d_total = compute_period_delta(df, "spend", "date_start", since, until, agg="sum")

    st.markdown(
        f'<div class="h-eyebrow-v4">COÛTS · VUE D\'ENSEMBLE</div>'
        f'<div class="h-context">{context}</div>'
        f'<div class="h-hero-block"><span class="h-hero-num">{_fmt(total)}</span>'
        f'<span class="h-hero-unit">CHF</span>'
        f'<span class="h-hero-label">dépensé, tous canaux</span></div>'
        f'<div style="margin-bottom:4px;">{_neutral_delta(d_total)}</div>',
        unsafe_allow_html=True,
    )
    st.markdown('<div class="h-divider"></div>', unsafe_allow_html=True)

    # Split par canal (cartes supporting — grandit avec les canaux)
    by_ch = dfp.groupby("channel")["spend"].sum()
    cards = []
    for ch in channels_present:
        val = float(by_ch.get(ch, 0.0))
        share = (val / total * 100) if total > 0 else 0
        cards.append(kpi_small(f"{_CH[ch]['name']} · {share:.0f}%", _fmt(val), unit="CHF"))
    if cards:
        cols = min(max(len(cards), 2), 4)  # grilles définies : 2, 3, 4
        st.markdown(kpi_grid(cards, cols=cols), unsafe_allow_html=True)

    # Le seul graph de la page : dépense quotidienne empilée par canal, sur la
    # période filtrée — on voit où part l'argent, jour par jour.
    daily = (dfp.groupby([dfp["date_start"].dt.date, "channel"])["spend"]
             .sum().reset_index(name="spend"))
    if not daily.empty and daily["date_start"].nunique() > 1:
        import plotly.graph_objects as go
        from components.graph_style import apply_pulse_style
        fig = go.Figure()
        for ch in channels_present:
            sub_d = daily[daily["channel"] == ch]
            if sub_d.empty:
                continue
            fig.add_trace(go.Bar(
                x=sub_d["date_start"], y=sub_d["spend"],
                name=_CH[ch]["name"], marker_color=_CH[ch]["color"], opacity=0.9,
            ))
        fig.update_layout(barmode="stack")
        apply_pulse_style(fig, height=240, in_card=False,
                          show_legend=(len(channels_present) > 1))
        fig.update_yaxes(ticksuffix=" CHF")
        fig.update_xaxes(tickformat="%d %b")  # « 06 Jul » — évite « Jul 62026 » collé
        st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})

    # ═══ 2. BUDGETS DU MOIS (pilotage — indépendant du filtre) ═══════════════
    # Le budget est un objet MENSUEL : on le pilote sur le mois en cours, pas sur
    # la période filtrée. Repère clé : % dépensé vs % du mois écoulé.
    from datetime import date as _date
    import calendar as _cal
    _today = _date.today()
    _month_start = pd.Timestamp(_today.replace(day=1))
    _days_in_month = _cal.monthrange(_today.year, _today.month)[1]
    _time_pct = _today.day / _days_in_month  # part du mois écoulée

    _MOIS_FR = {1: "janvier", 2: "février", 3: "mars", 4: "avril", 5: "mai", 6: "juin",
                7: "juillet", 8: "août", 9: "septembre", 10: "octobre", 11: "novembre", 12: "décembre"}
    st.markdown(
        f'<div style="display:flex;align-items:baseline;gap:10px;margin:28px 0 4px;">'
        f'<span style="font-size:15px;font-weight:600;color:#0e0f12;">Budgets du mois</span>'
        f'<span style="font-size:12px;color:#8b8e98;">{_MOIS_FR[_today.month]} {_today.year} · indépendant du filtre · '
        f'{_time_pct*100:.0f} % du mois écoulé</span></div>',
        unsafe_allow_html=True,
    )

    df_month = df[df["date_start"] >= _month_start]
    month_by_ch = df_month.groupby("channel")["spend"].sum()
    _cur_month_iso = _today.replace(day=1).isoformat()

    # Budgets mensuels (channel_budgets) — chargés une fois, invalidés à l'écriture.
    if "_channel_budgets_cache" not in st.session_state:
        st.session_state["_channel_budgets_cache"] = fetch_channel_budgets(client, user_id)
    _budgets = st.session_state["_channel_budgets_cache"]

    def _budget_of(ch, month_iso):
        """Budget effectif (report auto). Fallback ancien budget global si la
        table par mois est vide/absente (migration non passée)."""
        val = budget_for_month(_budgets, ch, month_iso)
        if val <= 0 and not _budgets:
            ck = f"_legacy_bg_{ch}"
            if ck not in st.session_state:
                _fg = fetch_google_budget_global if ch == "google" else fetch_meta_budget_global
                try:
                    st.session_state[ck] = float(_fg(client, user_id) or 0)
                except Exception:
                    st.session_state[ck] = 0.0
            val = st.session_state[ck]
        return val

    # Statut du mois par canal — LECTURE SEULE (le repère ▏reste la boussole) :
    # l'édition des montants se fait directement dans la table dessous.
    bud_cols = st.columns(max(len(channels_present), 1))
    for bcol, ch in zip(bud_cols, channels_present):
        meta_ch = _CH[ch]
        m_spend = float(month_by_ch.get(ch, 0.0))
        with bcol:
            st.markdown(
                f'<div style="font-size:12px;font-weight:600;color:{meta_ch["color"]};margin-bottom:6px;">'
                f'{meta_ch["icon"]} {meta_ch["name"]}</div>',
                unsafe_allow_html=True,
            )
            gb = _budget_of(ch, _cur_month_iso)
            if gb > 0:
                pct = m_spend / gb
                # Statut : comparer le rythme de dépense au rythme du calendrier
                if pct > 1.0:
                    color, txt = "#c0392b", "⚠ Dépassé"
                elif pct > _time_pct + 0.10:
                    color, txt = "#b86b00", "↑ En avance sur le mois"
                elif pct < _time_pct - 0.15:
                    color, txt = "#8b8e98", "↓ Sous-dépense"
                else:
                    color, txt = "#1a7a4a", "✓ En ligne"
                st.markdown(
                    f'<div style="font-size:12px;color:{color};font-weight:600;margin:6px 0 4px;">'
                    f'{txt} — {_fmt(m_spend)} / {_fmt(gb)} CHF ({pct*100:.0f} %)</div>'
                    # Barre + repère vertical = où on DEVRAIT en être aujourd'hui
                    f'<div style="position:relative;height:6px;background:rgba(14,15,18,0.06);'
                    f'border-radius:99px;overflow:visible;">'
                    f'<div style="height:100%;width:{min(pct,1)*100:.1f}%;background:{color};border-radius:99px;"></div>'
                    f'<div style="position:absolute;top:-3px;left:{_time_pct*100:.1f}%;width:2px;height:12px;'
                    f'background:#0e0f12;border-radius:1px;" title="Repère : % du mois écoulé"></div></div>'
                    f'<div style="font-size:10.5px;color:#8b8e98;margin-top:4px;">'
                    f'repère ▏= {_time_pct*100:.0f} % du mois écoulé</div>',
                    unsafe_allow_html=True,
                )
            else:
                st.markdown(
                    f'<div style="font-size:12px;color:#8b8e98;margin-top:6px;">'
                    f'{_fmt(m_spend)} CHF dépensés ce mois. Saisis ton budget dans la table ci-dessous.</div>',
                    unsafe_allow_html=True,
                )

    # ── Budgets par mois — LA surface d'édition (sauvegarde automatique) ────
    # Dépliable (prend de la place) : le statut ci-dessus suffit au quotidien.
    # On travaille directement dans la table : chaque cellule budget modifiée
    # est enregistrée aussitôt. Un mois sans saisie hérite du dernier budget
    # connu (report automatique). Les colonnes « dépensé » sont en lecture
    # seule — elles viennent des données récupérées.
    _months = [_date(_today.year, m, 1) for m in range(1, 13)]
    _month_labels = ["jan", "fév", "mar", "avr", "mai", "jun",
                     "jul", "aoû", "sep", "oct", "nov", "déc"]

    with st.expander(f"▦ Budgets par mois · {_today.year} — voir et modifier", expanded=False):
        st.caption(
            "Modifie les colonnes **budget** directement dans la table — sauvegarde "
            "automatique. Un mois vide hérite du budget précédent. "
            "Les colonnes *dépensé* sont calculées depuis tes données."
        )

        # Dépense réelle par (mois × canal) de l'année en cours
        _df_y = df[df["date_start"].dt.year == _today.year]
        _sp_m = _df_y.groupby([_df_y["date_start"].dt.month, "channel"])["spend"].sum()

        # Valeurs effectives (avec report) — budgets éditables + dépensé lecture seule
        _spend_cols = []
        _editor_rows = []
        for mdate, mlbl in zip(_months, _month_labels):
            _is_cur = (mdate.month == _today.month)
            row = {"Mois": f"{'● ' if _is_cur else ''}{mlbl} {_today.year}"}
            _tot_spent = 0.0
            for ch in channels_present:
                row[_CH[ch]["name"]] = budget_for_month(_budgets, ch, mdate.isoformat())
                _sc = f'{_CH[ch]["name"]} dépensé'
                if _sc not in _spend_cols:
                    _spend_cols.append(_sc)
                _v = float(_sp_m.get((mdate.month, ch), 0.0))
                # Colonnes dépensé en TEXTE formaté : contrôle total du rendu
                # (les NumberColumn affichent « None » sur les cellules vides).
                # Mois futurs → « — » (pas de dépense possible).
                row[_sc] = _fmt(_v) + " CHF" if mdate.month <= _today.month else "—"
                _tot_spent += _v
            row["Σ dépensé"] = (_fmt(_tot_spent) + " CHF"
                                if mdate.month <= _today.month else "—")
            _editor_rows.append(row)

        st.data_editor(
            pd.DataFrame(_editor_rows),
            hide_index=True,
            use_container_width=True,
            disabled=["Mois"] + _spend_cols + ["Σ dépensé"],
            column_config={
                "Mois": st.column_config.TextColumn("Mois", width="small",
                                                    help="● = mois en cours"),
                **{
                    _CH[ch]["name"]: st.column_config.NumberColumn(
                        f'{_CH[ch]["icon"]} {_CH[ch]["name"]} · budget',
                        min_value=0.0, step=100.0, format="%.0f CHF",
                    ) for ch in channels_present
                },
                **{
                    f'{_CH[ch]["name"]} dépensé': st.column_config.TextColumn(
                        f'{_CH[ch]["icon"]} dépensé',
                    ) for ch in channels_present
                },
                "Σ dépensé": st.column_config.TextColumn("Σ dépensé"),
            },
            key="budget_year_editor",
            on_change=_cb_save_budget_table,
            args=(client, user_id, _months),
        )

        # Totaux année : budget (somme des mois effectifs) vs dépensé
        year_by_ch = _df_y.groupby("channel")["spend"].sum()
        tot_cols = st.columns(max(len(channels_present), 1) + 1)
        _grand_budget = _grand_spend = 0.0
        for tcol, ch in zip(tot_cols, channels_present):
            y_budget = sum(budget_for_month(_budgets, ch, m.isoformat()) for m in _months)
            y_spend = float(year_by_ch.get(ch, 0.0))
            _grand_budget += y_budget
            _grand_spend += y_spend
            with tcol:
                st.markdown(
                    f'<div style="font-size:11px;font-weight:600;color:{_CH[ch]["color"]};">{_CH[ch]["icon"]} {_CH[ch]["name"]} · année</div>'
                    f'<div style="font-family:var(--font-mono,monospace);font-size:13px;color:#0e0f12;margin-top:3px;">'
                    f'{_fmt(y_spend)} / {_fmt(y_budget)} CHF</div>',
                    unsafe_allow_html=True,
                )
        with tot_cols[-1]:
            st.markdown(
                f'<div style="font-size:11px;font-weight:600;color:#0e0f12;">Σ Total année</div>'
                f'<div style="font-family:var(--font-mono,monospace);font-size:13px;font-weight:600;color:#0e0f12;margin-top:3px;">'
                f'{_fmt(_grand_spend)} / {_fmt(_grand_budget)} CHF</div>',
                unsafe_allow_html=True,
            )

    # ═══ 3. PAR LABEL (regroupement cross-canal) ════════════════════════════
    _section_header(
        "▦", "Par label", "#0e0f12",
        suffix=f'<span style="font-size:11px;color:#5a5d66;background:rgba(14,15,18,0.05);'
               f'border-radius:99px;padding:2px 9px;margin-left:2px;">'
               f'période filtrée · {context} · tous canaux</span>',
    )

    piv = dfp.pivot_table(index="label", columns="channel", values="spend",
                          aggfunc="sum", fill_value=0.0)
    piv["__total"] = piv[[c for c in channels_present if c in piv.columns]].sum(axis=1)
    # tri : (sans label) en dernier, le reste par total décroissant
    piv["__order"] = piv.index.map(lambda x: 1 if x == _NO_LABEL else 0)
    piv = piv.sort_values(["__order", "__total"], ascending=[True, False])
    max_total = float(piv["__total"].max()) or 1.0

    # En-têtes
    head_cols = st.columns([2.4, 1.3] + [1.1] * len(channels_present))
    head_cols[0].markdown('<div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#8b8e98;">Label</div>', unsafe_allow_html=True)
    head_cols[1].markdown('<div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#8b8e98;">Total</div>', unsafe_allow_html=True)
    for i, ch in enumerate(channels_present):
        head_cols[2 + i].markdown(f'<div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:{_CH[ch]["color"]};">{_CH[ch]["icon"]} {_CH[ch]["name"]}</div>', unsafe_allow_html=True)

    for lbl, row in piv.iterrows():
        is_none = (lbl == _NO_LABEL)
        tot = float(row["__total"])
        bar = (tot / max_total * 100) if max_total > 0 else 0
        name_color = "#8b8e98" if is_none else "#0e0f12"
        c = st.columns([2.4, 1.3] + [1.1] * len(channels_present))
        with c[0]:
            st.markdown(
                f'<div style="font-size:13.5px;font-weight:{"500" if is_none else "600"};color:{name_color};padding-top:4px;">{lbl}</div>'
                f'<div style="height:3px;background:rgba(14,15,18,0.06);border-radius:99px;margin-top:6px;overflow:hidden;">'
                f'<div style="height:100%;width:{bar:.1f}%;background:#1a56ff;border-radius:99px;"></div></div>',
                unsafe_allow_html=True,
            )
        c[1].markdown(f'<div style="font-family:var(--font-mono,monospace);font-size:13px;font-weight:600;color:#0e0f12;padding-top:6px;">{_fmt(tot)} CHF</div>', unsafe_allow_html=True)
        for i, ch in enumerate(channels_present):
            v = float(row[ch]) if ch in row else 0.0
            disp = f"{_fmt(v)}" if v > 0 else "—"
            c[2 + i].markdown(f'<div style="font-family:var(--font-mono,monospace);font-size:13px;color:#5a5d66;padding-top:6px;">{disp}</div>', unsafe_allow_html=True)

    # ═══ 4. PAR CANAL (détail campagne : budget max + pacing sur la période) ═
    for ch in channels_present:
        meta = _CH[ch]
        sub = (dfp[dfp["channel"] == ch]
               .groupby(["campaign", "cid"], as_index=False)
               .agg(spend=("spend", "sum"), budget_max=("budget_max", "max"))
               .sort_values("spend", ascending=False))
        ch_total = float(sub["spend"].sum())
        _section_header(
            meta["icon"], meta["name"], meta["color"],
            suffix=f'<span style="font-size:11px;color:#5a5d66;background:rgba(14,15,18,0.05);'
                   f'border-radius:99px;padding:2px 9px;">période filtrée · {context}</span>'
                   f'<span style="font-size:12px;color:#8b8e98;font-family:var(--font-mono,monospace);margin-left:auto;">{_fmt(ch_total)} CHF</span>',
        )
        if sub.empty:
            st.markdown(
                '<div style="font-size:13px;color:#8b8e98;padding:6px 0 4px;">'
                "Aucune dépense sur cette période. Récupère tes données dans "
                "<b>Paramètres</b>, ou élargis la période.</div>",
                unsafe_allow_html=True,
            )
            continue

        # ── En-têtes du détail par campagne ──────────────────────────────────
        hc = st.columns([2.8, 1.2, 0.8, 1.3, 1.9])
        for col_h, label in zip(
            hc, ["Campagne", "Dépensé", "Part", "Budget max", "Pacing"]
        ):
            col_h.markdown(
                f'<div style="font-size:10px;font-weight:600;text-transform:uppercase;'
                f'letter-spacing:0.06em;color:#8b8e98;padding-bottom:2px;">{label}</div>',
                unsafe_allow_html=True,
            )

        with st.container(height=min(440, 90 + 58 * len(sub)), border=False):
            for _, r in sub.iterrows():
                camp = r["campaign"] or "—"
                cid = r["cid"]
                spend = float(r["spend"])
                share = (spend / ch_total * 100) if ch_total > 0 else 0
                safe = "".join(c if c.isalnum() else "_" for c in str(cid))[:60]
                bkey = f"cout_bud_{ch}_{safe}"
                if bkey not in st.session_state:
                    st.session_state[bkey] = float(r["budget_max"] or 0)

                cc = st.columns([2.8, 1.2, 0.8, 1.3, 1.9])
                cc[0].markdown(f'<div style="font-size:13.5px;color:#0e0f12;padding-top:8px;">{camp}</div>', unsafe_allow_html=True)
                cc[1].markdown(f'<div style="font-family:var(--font-mono,monospace);font-size:13px;font-weight:600;color:#0e0f12;padding-top:8px;text-align:right;">{_fmt(spend)} CHF</div>', unsafe_allow_html=True)
                cc[2].markdown(f'<div style="font-size:12px;color:#8b8e98;padding-top:9px;text-align:right;">{share:.0f}%</div>', unsafe_allow_html=True)
                with cc[3]:
                    st.number_input(
                        "Budget max", min_value=0.0, step=100.0, format="%.0f",
                        key=bkey, label_visibility="collapsed",
                        on_change=_cb_save_cout_budget,
                        args=(client, user_id, ch, cid, bkey),
                    )
                with cc[4]:
                    pac = _pacing(spend, float(st.session_state.get(bkey, 0) or 0))
                    if pac:
                        txt, color, pct = pac
                        st.markdown(
                            f'<div style="font-size:12px;color:{color};font-weight:600;padding-top:8px;">'
                            f'{txt} · {pct * 100:.0f}%</div>'
                            f'<div style="height:5px;background:rgba(14,15,18,0.06);border-radius:99px;margin-top:4px;overflow:hidden;">'
                            f'<div style="height:100%;width:{min(pct, 1) * 100:.1f}%;background:{color};border-radius:99px;"></div></div>',
                            unsafe_allow_html=True,
                        )
                    else:
                        st.markdown('<div style="font-size:11.5px;color:#8b8e98;padding-top:9px;">— pas de budget</div>', unsafe_allow_html=True)
