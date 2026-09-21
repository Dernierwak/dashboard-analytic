"""La matrice full-history : tout l'historique croisé par format, campagne et
créneau, avec le revenu GA4 quand il existe — déterministe, zéro IA.

LE CROISEMENT PAR THÈME NE SE CALCULE PAS ICI, IL SE LIT : la vue
`theme_regroupement` est la seule implémentation du regroupement, lue aussi bien
par ce module que par Pulse (`supabase/migrations/theme_regroupement.sql`).

Ce module vivait dans `saas/recos_ia/insights.py` aux côtés des constats
(« Ce qui fonctionne pour toi »). Les constats sont partis avec les
recommandations ; la matrice, elle, n'a jamais rien conseillé — elle CHIFFRE
les cartes de thème du rapport. Elle suit donc son seul appelant restant,
`build_report.py`.

Les deux seuils et la table de formats qu'elle lisait dans `reco_engine.py`
sont recopiés ci-dessous : ils ne servaient plus qu'ici.
"""

from __future__ import annotations

import pandas as pd

# Les noms de format tels qu'un tableau les affiche.
FORMAT_LABELS = {"VIDEO": "Reel", "REEL": "Reel",
                 "CAROUSEL_ALBUM": "Carrousel", "IMAGE": "Image"}

# Planchers de la heatmap des créneaux : en dessous, la case gagnante n'est que
# du bruit d'échantillon.
SEUILS = {
    "slot_cell_min": 3,    # ≥ 3 posts dans la case gagnante
    "slot_total_min": 20,  # ≥ 20 posts au total
}


def _norm(s) -> str:
    return str(s or "").strip().lower()


def build_matrix(df_meta_raw, df_google, df_insta, meta_cfg, goog_cfg,
                 ga4_full, last_full_day, themes) -> dict | None:
    """Vue agrégée de tout l'historique. None si aucune donnée exploitable.

    df_meta_raw   : meta_ads_insights complet (date_start, campaign_name, spend, …)
    df_google     : google_ads_insights complet (date_start, campaign_id, cost_micros, …)
    df_insta      : instagram_organic_posts complet (date, type, reach, likes,
                    comments, saved, labels, …) — PAS de colonne `eng` : c'est un
                    taux, il se recalcule ici (`CONTEXT.md`, « Engagement »).
    meta_cfg      : {campaign_name: {label, …}} · goog_cfg : {campaign_id: {campaign_name, label, …}}
    ga4_full      : build_ga4_context sur TOUT l'historique (ou None)
    themes        : les lignes de la vue `theme_regroupement`, déjà lues et déjà
                    filtrées sur ce compte (`fetch_theme_regroupement`).

    LE TOTAL PAR THÈME NE SE CALCULE PLUS ICI, ET C'EST LE CŒUR DU TICKET 04.
    Un Thème ne produit aucune donnée : il change par quoi des chiffres déjà en
    base sont additionnés, donc son total se recalcule À LA LECTURE, tout de
    suite, sur tout l'historique — y compris les semaines passées (CONTEXT.md,
    « Regroupement »). Pulse doit savoir le faire aussi, et l'écrire une seconde
    fois en TypeScript aurait donné deux jeux de seuils qui dérivent. Une seule
    implémentation existe désormais, en SQL, et les deux langages la lisent :
    `supabase/migrations/theme_regroupement.sql`.

    Ce qui reste ici — campagnes, formats, créneaux, couverture — n'alimente que
    des constats RÉDIGÉS, qui attendent le Jour de travail de toute façon : les
    descendre en SQL serait un gros refactor pour zéro fraîcheur gagnée.
    """
    campaigns: list[dict] = []
    dates: list = []

    # Meta : agrégat par campagne sur tout l'historique
    if df_meta_raw is not None and not df_meta_raw.empty and "campaign_name" in df_meta_raw.columns:
        m = df_meta_raw.copy()
        for col in ("spend", "clicks", "impressions"):
            if col in m.columns:
                m[col] = pd.to_numeric(m[col], errors="coerce").fillna(0)
        m["date_start"] = pd.to_datetime(m["date_start"], errors="coerce")
        dates += [d.date() for d in (m["date_start"].min(), m["date_start"].max()) if pd.notna(d)]
        agg = m.groupby("campaign_name", as_index=False).agg(
            spend=("spend", "sum"), clicks=("clicks", "sum"), impressions=("impressions", "sum"))
        for _, r in agg.iterrows():
            cfg = meta_cfg.get(r["campaign_name"], {}) or {}
            campaigns.append({
                # key = clé d'édition du thème (campaign_name pour Meta) → rend la
                # campagne réassignable depuis le rapport (CampaignLabelSelect)
                "name": str(r["campaign_name"]), "channel": "meta",
                "key": str(r["campaign_name"]),
                "spend": float(r["spend"]), "clicks": int(r["clicks"]),
                "impressions": int(r["impressions"]),
                "label": cfg.get("label"), "label_source": cfg.get("label_source"),
            })

    # Google : agrégat par campagne sur tout l'historique
    if df_google is not None and not df_google.empty and "campaign_id" in df_google.columns:
        g = df_google.copy()
        for col in ("cost_micros", "clicks", "impressions"):
            if col in g.columns:
                g[col] = pd.to_numeric(g[col], errors="coerce").fillna(0)
        g["date_start"] = pd.to_datetime(g["date_start"], errors="coerce")
        dates += [d.date() for d in (g["date_start"].min(), g["date_start"].max()) if pd.notna(d)]
        g["_cid"] = g["campaign_id"].astype(str)
        agg = g.groupby("_cid", as_index=False).agg(
            spend=("cost_micros", "sum"), clicks=("clicks", "sum"), impressions=("impressions", "sum"))
        for _, r in agg.iterrows():
            cfg = goog_cfg.get(r["_cid"], {}) or {}
            campaigns.append({
                # key = campaign_id pour Google (clé d'édition du thème)
                "name": cfg.get("campaign_name") or f"Campagne {r['_cid']}", "channel": "google",
                "key": str(r["_cid"]),
                "spend": float(r["spend"]) / 1_000_000.0, "clicks": int(r["clicks"]),
                "impressions": int(r["impressions"]),
                "label": cfg.get("label"), "label_source": cfg.get("label_source"),
            })

    # Revenu GA4 par campagne (matching nom normalisé, comme le bloc thèmes 7 j)
    has_ga4 = bool(ga4_full and ga4_full.get("by_campaign"))
    rev_by_name = {}
    if has_ga4:
        rev_by_name = {_norm(k): float((v or {}).get("revenue") or 0)
                       for k, v in ga4_full["by_campaign"].items()}

    for c in campaigns:
        c["ctr"] = c["clicks"] / c["impressions"] * 100 if c["impressions"] > 0 else 0.0
        c["cpc"] = c["spend"] / c["clicks"] if c["clicks"] > 0 else 0.0
        c["revenue"] = rev_by_name.get(_norm(c["name"])) if has_ga4 else None
    campaigns.sort(key=lambda c: -c["spend"])

    # Instagram : formats, créneaux, couverture
    formats: list[dict] = []
    slots: list[dict] = []
    posts_total = 0
    posts_labeled = 0
    account_reach_avg = 0.0
    if df_insta is not None and not df_insta.empty and "date" in df_insta.columns:
        p = df_insta.copy()
        for col in ("reach", "likes", "comments", "saved"):
            if col in p.columns:
                p[col] = pd.to_numeric(p[col], errors="coerce").fillna(0)
        # L'ENGAGEMENT EST UN TAUX, PAS UNE COLONNE (`CONTEXT.md`).
        # `instagram_organic_posts.eng` n'a jamais existé : `r.get("eng") or 0`
        # repliait donc CHAQUE post sur 0, et `eng_avg` de chaque format sortait
        # à `None` — une colonne vide publiée depuis l'origine (ticket 44). La
        # formule est celle de la vue `theme_regroupement` et de
        # `lib/channels.ts` l. 1001 : les trois bougent ensemble ou pas du tout.
        if {"reach", "likes", "comments", "saved"} <= set(p.columns):
            p["eng"] = ((p["likes"] + p["comments"] + p["saved"])
                        / p["reach"].where(p["reach"] > 0) * 100).fillna(0.0)
        p["_dt"] = pd.to_datetime(p["date"], errors="coerce", utc=True)
        dates += [d.date() for d in (p["_dt"].min(), p["_dt"].max()) if pd.notna(d)]
        posts_total = len(p)
        if "reach" in p.columns:
            account_reach_avg = float(p["reach"].mean())
        if "type" in p.columns and "reach" in p.columns:
            # VIDEO et REEL se regroupent sous « Reel » AVANT l'agrégat
            p["_fmt"] = p["type"].map(lambda t: FORMAT_LABELS.get(str(t), str(t)))
            fa = p.groupby("_fmt").agg(posts=("reach", "count"), reach_avg=("reach", "mean"),
                                       eng_avg=("eng", "mean") if "eng" in p.columns else ("reach", "mean"))
            for fmt, r in fa.iterrows():
                formats.append({
                    "format": str(fmt),
                    "posts": int(r["posts"]), "reach_avg": round(float(r["reach_avg"]), 1),
                    "eng_avg": round(float(r["eng_avg"]), 2) if "eng" in p.columns else None,
                })
            formats.sort(key=lambda f: -f["posts"])
        # Créneaux — la SEULE implémentation depuis que `_rule_creneau` est
        # morte (ticket 09) : mêmes seuils que la heatmap de `/instagram`,
        # qui ne les recalcule plus mais lit le constat qui en sort.
        try:
            d = p.dropna(subset=["_dt"]).copy()
            d["_dt"] = d["_dt"].dt.tz_convert("Europe/Zurich")
            if len(d) >= SEUILS["slot_total_min"] and any(int(h) > 0 for h in d["_dt"].dt.hour.unique()):
                d["_dow"] = d["_dt"].dt.dayofweek
                d["_slot"] = pd.cut(d["_dt"].dt.hour, bins=[0, 7, 10, 13, 16, 19, 24],
                                    labels=range(6), right=False)
                gsl = d.groupby(["_dow", "_slot"], observed=True)["reach"].agg(["count", "mean"])
                gsl = gsl[gsl["count"] >= SEUILS["slot_cell_min"]]
                for (dow, slot), r in gsl.sort_values("mean", ascending=False).head(5).iterrows():
                    slots.append({"dow": int(dow), "slot": int(slot),
                                  "posts": int(r["count"]), "reach_avg": round(float(r["mean"]), 1)})
        except Exception:
            pass
        # Combien de publications portent au moins un thème — la couverture,
        # pas leur bilan : celui-là vient de la vue.
        if "labels" in p.columns:
            posts_labeled = int(sum(1 for _, r in p.iterrows() if len(r.get("labels") or []) > 0))

    if not campaigns and posts_total == 0:
        return None

    # LES THÈMES VIENNENT DE LA VUE, pas d'ici (voir le docstring). L'ordre
    # reste le contrat de cette fonction : `build_report` s'appuie sur
    # « trié par dépense décroissante ».
    #
    # `user_id` REPART : la matrice est déjà l'objet d'UN compte, et ses six
    # premiers thèmes finissent tels quels dans le payload publié, donc dans
    # l'écran et dans l'email. Un identifiant qui n'y sert à rien n'a rien à
    # faire dans ce qu'on expédie.
    themes = sorted(({k: v for k, v in (t or {}).items() if k != "user_id"}
                     for t in (themes or [])),
                    key=lambda t: -(t.get("spend") or 0))

    for c in campaigns:
        c["spend"] = round(c["spend"], 2)
        c["ctr"] = round(c["ctr"], 2)
        c["cpc"] = round(c["cpc"], 2)
        if c.get("revenue") is not None:
            c["revenue"] = round(c["revenue"], 2)

    since = min(dates) if dates else last_full_day
    return {
        "period": {
            "since": since.isoformat(),
            "until": last_full_day.isoformat(),
            "days": max(1, (last_full_day - since).days + 1),
        },
        "themes": themes,
        "formats": formats,
        "campaigns": campaigns,
        "slots": slots,
        "coverage": {
            "posts_labeled": posts_labeled,
            "posts_total": posts_total,
            "campaigns_labeled": sum(1 for c in campaigns if c["label"]),
            "campaigns_total": len(campaigns),
            "ga4": has_ga4,
        },
        "account_reach_avg": round(account_reach_avg, 1),
    }


# ── Constats (« Ce qui fonctionne pour toi ») ────────────────────────────────
