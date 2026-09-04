"""Matrice full-history + constats de la vision globale — déterministe, zéro IA.

La matrice croise TOUT l'historique disponible (Ads depuis le 1er janvier,
posts Instagram stockés) par thème / format / campagne / créneau, avec le
revenu GA4 quand il existe. Les constats (« Ce qui fonctionne pour toi »)
en tirent 3-5 phrases chiffrées à clés STABLES : un constat rejeté par le
client (insight_feedback) reste écarté quand il se régénère à l'identique.

L'IA ne formule PAS les constats — pas d'hallucination sur des chiffres que
le client va valider. Elle les reçoit ensuite comme contexte (brief + reco IA).
"""

from __future__ import annotations
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import pandas as pd  # noqa: E402

from saas.recos_ia.reco_engine import DAYS, HOURS, FORMAT_LABELS, SEUILS  # noqa: E402

# Seuils anti-bruit des constats (cohérents avec SEUILS du moteur)
C_SEUILS = {
    "theme_spend_min": 100.0,   # un thème jugé sur ≥ 100 CHF dépensés
    "theme_posts_min": 5,       # ...ou ≥ 5 posts (thème organique)
    "format_posts_min": 5,      # format jugé sur ≥ 5 posts
    "format_reach_boost": 1.2,  # ≥ +20 % vs la portée moyenne du compte
    "camp_spend_min": 50.0,     # locomotive : ≥ 50 CHF dépensés
    "camp_roas_min": 1.5,       # ...et ROAS ≥ 1.5 (avec GA4)
    "camp_ctr_boost": 1.5,      # ...ou CTR ≥ 1.5× la moyenne pub (sans GA4)
    "theme_best_roas_min": 0.5, # un « moteur » exige un ROAS qui veut dire quelque chose
}


def _norm(s) -> str:
    return str(s or "").strip().lower()


def _slug(s) -> str:
    return _norm(s).replace(" ", "-")


# ── Matrice ──────────────────────────────────────────────────────────────────

def build_matrix(df_meta_raw, df_google, df_insta, meta_cfg, goog_cfg,
                 ga4_full, last_full_day, theme_events=None) -> dict | None:
    """Vue agrégée de tout l'historique. None si aucune donnée exploitable.

    df_meta_raw   : meta_ads_insights complet (date_start, campaign_name, spend, …)
    df_google     : google_ads_insights complet (date_start, campaign_id, cost_micros, …)
    df_insta      : instagram_organic_posts complet (date, type, reach, eng, labels, …)
    meta_cfg      : {campaign_name: {label, …}} · goog_cfg : {campaign_id: {campaign_name, label, …}}
    ga4_full      : build_ga4_context sur TOUT l'historique (ou None)
    theme_events  : {label: [{event_name, rang}]} — la conversion que le client a
                    désignée par thème (page Thèmes). Quand un thème a un événement
                    « principal » MESURÉ ET DOTÉ D'UNE VALEUR MONÉTAIRE, cette valeur
                    (`events_by_campaign`) remplace le revenu GA4 générique du compte
                    pour ce thème — sinon la même campagne « achat » gonflait le ROAS
                    d'un thème « newsletter » qui n'a jamais vendu.
                    UN PRINCIPAL MESURÉ MAIS SANS VALEUR (generate_lead, sign_up,
                    contact…) NE REMPLACE RIEN : il n'a pas de CHF à donner, et
                    écrire 0 CHF affirmerait un revenu nul alors que GA4 attribue
                    peut-être un vrai revenu à ces mêmes campagnes (bug constaté :
                    « ROAS 0.0 » publié pour un thème dont les 40 leads mesurés
                    prouvent au contraire que la conversion fonctionne). Sans thème
                    choisi, ou principal jamais mesuré, ou mesuré sans valeur, le
                    comportement d'avant reste identique (revenu GA4 générique).
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

    # Événements GA4 par campagne (même pont, même normalisation) — sert plus
    # bas à remplacer le revenu générique d'un thème par SA conversion choisie.
    events_by_name = {}
    if has_ga4:
        events_by_name = {_norm(k): (v or {})
                          for k, v in (ga4_full.get("events_by_campaign") or {}).items()}
    # L'événement principal par thème (page Thèmes). Un thème sans principal
    # choisi n'entre pas dans ce dict et garde le revenu générique ci-dessous.
    princ_by_label: dict[str, set] = {}
    for lbl, evs in (theme_events or {}).items():
        noms = {e["event_name"] for e in (evs or []) if e.get("rang") == "principal"}
        if noms:
            princ_by_label[lbl] = noms

    for c in campaigns:
        c["ctr"] = c["clicks"] / c["impressions"] * 100 if c["impressions"] > 0 else 0.0
        c["cpc"] = c["spend"] / c["clicks"] if c["clicks"] > 0 else 0.0
        c["revenue"] = rev_by_name.get(_norm(c["name"])) if has_ga4 else None
    campaigns.sort(key=lambda c: -c["spend"])

    # Instagram : formats, créneaux, posts par thème
    formats: list[dict] = []
    slots: list[dict] = []
    posts_by_label: dict[str, dict] = {}
    posts_total = 0
    posts_labeled = 0
    account_reach_avg = 0.0
    if df_insta is not None and not df_insta.empty and "date" in df_insta.columns:
        p = df_insta.copy()
        for col in ("reach", "eng"):
            if col in p.columns:
                p[col] = pd.to_numeric(p[col], errors="coerce").fillna(0)
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
        # Créneaux (même logique que la heatmap / _rule_creneau)
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
        # Posts par thème
        if "labels" in p.columns:
            for _, r in p.iterrows():
                lbls = r.get("labels") or []
                if len(lbls) > 0:
                    posts_labeled += 1
                for lbl in lbls:
                    a = posts_by_label.setdefault(lbl, {"posts": 0, "reach": 0.0, "eng": 0.0})
                    a["posts"] += 1
                    a["reach"] += float(r.get("reach") or 0)
                    a["eng"] += float(r.get("eng") or 0)

    if not campaigns and posts_total == 0:
        return None

    # Thèmes : dépense/clics/revenu (campagnes) + posts/portée/engagement (Instagram)
    themes_map: dict[str, dict] = {}
    # Revenu de LA conversion choisie, cumulé campagne par campagne — seulement
    # pour les thèmes qui ont un événement principal (voir princ_by_label).
    theme_event_acc: dict[str, dict] = {}
    for c in campaigns:
        if not c["label"]:
            continue
        t = themes_map.setdefault(c["label"], {
            "label": c["label"], "spend": 0.0, "clicks": 0, "revenue": 0.0 if has_ga4 else None,
            "posts": 0, "reach_avg": None, "eng_avg": None, "_impr": 0})
        t["spend"] += c["spend"]
        t["clicks"] += c["clicks"]
        t["_impr"] += c["impressions"]
        if has_ga4 and c["revenue"] is not None:
            t["revenue"] = (t["revenue"] or 0.0) + c["revenue"]
        if has_ga4 and c["label"] in princ_by_label:
            cev = events_by_name.get(_norm(c["name"])) or {}
            acc = theme_event_acc.setdefault(c["label"], {"count": 0, "value": 0.0})
            for nom in princ_by_label[c["label"]]:
                d = cev.get(nom)
                if d:
                    acc["count"] += int(d.get("count") or 0)
                    acc["value"] += float(d.get("value") or 0)
    for lbl, a in posts_by_label.items():
        t = themes_map.setdefault(lbl, {
            "label": lbl, "spend": 0.0, "clicks": 0, "revenue": 0.0 if has_ga4 else None,
            "posts": 0, "reach_avg": None, "eng_avg": None, "_impr": 0})
        t["posts"] = a["posts"]
        t["reach_avg"] = round(a["reach"] / a["posts"], 1) if a["posts"] else None
        t["eng_avg"] = round(a["eng"] / a["posts"], 2) if a["posts"] else None
    themes = []
    for t in themes_map.values():
        impr = t.pop("_impr")
        t["ctr"] = round(t["clicks"] / impr * 100, 2) if impr > 0 else None
        t["spend"] = round(t["spend"], 2)
        # Le thème a un événement principal mesuré ET DOTÉ D'UNE VALEUR (> 0) :
        # sa conversion choisie remplace le revenu générique du compte — c'est
        # elle, et pas le fourre-tout GA4, que le client a désigné pour juger
        # ce thème.
        #
        # LA CONDITION PORTE SUR LA VALEUR, PAS SUR LE COMPTE. Un principal
        # mesuré mais sans valeur (generate_lead, sign_up, contact…) — le cas
        # majoritaire hors e-commerce — ne remplace RIEN : il n'a aucun CHF à
        # donner, et écrire 0 CHF affirmerait un revenu nul alors que GA4 peut
        # très bien attribuer un vrai revenu à ces mêmes campagnes. `acc["count"]
        # > 0` seul avait ce bug : il gardait la condition sur le nombre de
        # conversions mais écrivait `acc["value"]`, donc 0 CHF, pour tout
        # événement non monétaire mesuré — un thème qui convertit bien se
        # voyait alors étiqueté « dépense sans vente attribuée ».
        #
        # Sans principal choisi, choisi mais jamais mesuré, ou mesuré sans
        # valeur, on garde le revenu générique déjà calculé ci-dessus
        # (comportement inchangé, cf. angle mort « thème sans conversion
        # choisie »). Le NOMBRE de conversions mesurées (ex. « 40 leads »)
        # reste disponible ailleurs, au niveau hebdomadaire par thème
        # (`_theme_ga4` → `_reco_evenements` et `_theme_ai_recos` dans
        # build_report.py) : ce n'est pas ce chiffre de revenu qui doit le
        # porter.
        acc = theme_event_acc.get(t["label"])
        if acc and acc["value"] > 0:
            t["revenue"] = acc["value"]
        t["roas"] = (round(t["revenue"] / t["spend"], 2)
                     if has_ga4 and t["revenue"] is not None and t["spend"] >= C_SEUILS["theme_spend_min"]
                     else None)
        if t["revenue"] is not None:
            t["revenue"] = round(t["revenue"], 2)
        themes.append(t)
    themes.sort(key=lambda t: -(t["spend"] or 0))

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

def _constat(key, kind, title, detail, feedback) -> dict:
    return {"key": key, "kind": kind, "title": title, "detail": detail,
            "status": feedback.get(key, "new")}


def build_constats(matrix: dict | None, insight_feedback: dict[str, str] | None,
                   priority_labels: list[str] | None = None) -> list[dict]:
    """3-5 constats déterministes tirés de la matrice, clés stables normalisées.
    Le verdict du client (agree/reject) est réappliqué à chaque régénération.
    priority_labels : les ≤ 3 thèmes choisis par le client — quand ils existent,
    les constats thèmes/campagnes se concentrent dessus (on ne travaille pas tout)."""
    if not matrix:
        return []
    fb = insight_feedback or {}
    out: list[dict] = []
    period_days = matrix["period"]["days"]
    period_txt = f"sur {period_days} jours d'historique"
    has_ga4 = matrix["coverage"]["ga4"]

    # Focus priorités : si le client a choisi ses thèmes, on juge CEUX-LÀ
    # (repli sur tout si aucun thème prioritaire n'a de données).
    prios = {_norm(p) for p in (priority_labels or [])}

    def _focus(items, label_of):
        if not prios:
            return items
        hit = [x for x in items if _norm(label_of(x)) in prios]
        return hit or items

    # 1) Meilleur thème — ROAS (GA4) sinon CTR (pub) sinon engagement (organique)
    themes = _focus(matrix["themes"], lambda t: t["label"])
    # Un thème dont on SAIT qu'il ne rapporte rien ne peut pas être « ton moteur »
    # (sinon theme_best et theme_worst couronnent le même thème).
    def _proven_zero(t):
        return has_ga4 and t["spend"] >= C_SEUILS["theme_spend_min"] and (t.get("revenue") or 0) == 0
    best_t = None
    if has_ga4:
        cands = [t for t in themes
                 if t.get("roas") is not None and (t.get("revenue") or 0) > 0
                 and t["roas"] >= C_SEUILS["theme_best_roas_min"]]
        if cands:
            best_t = max(cands, key=lambda t: t["roas"])
            out.append(_constat(
                f"theme_best:{_slug(best_t['label'])}", "theme_best",
                f"Le thème « {best_t['label']} » est ton moteur",
                f"{best_t['spend']:.0f} CHF investis → {best_t['revenue']:.0f} CHF attribués "
                f"(ROAS {best_t['roas']:.1f}) {period_txt}.", fb))
    if best_t is None:
        cands = [t for t in themes
                 if t["spend"] >= C_SEUILS["theme_spend_min"] and t.get("ctr")
                 and not _proven_zero(t)]
        if cands:
            best_t = max(cands, key=lambda t: t["ctr"])
            _why = ("(pas assez de revenu attribué pour juger au ROAS)" if has_ga4
                    else "(revenu inconnu tant que Google Analytics est muet)")
            out.append(_constat(
                f"theme_best:{_slug(best_t['label'])}", "theme_best",
                f"Le thème « {best_t['label']} » attire le plus de clics",
                f"CTR {best_t['ctr']:.1f} % pour {best_t['spend']:.0f} CHF investis {period_txt} "
                f"{_why}.", fb))
    if best_t is None:
        cands = [t for t in themes
                 if t["posts"] >= C_SEUILS["theme_posts_min"] and t.get("eng_avg")
                 and not _proven_zero(t)]
        if cands:
            best_t = max(cands, key=lambda t: t["eng_avg"])
            out.append(_constat(
                f"theme_best:{_slug(best_t['label'])}", "theme_best",
                f"Le thème « {best_t['label']} » fait le plus réagir",
                f"{best_t['eng_avg']:.1f} % d'engagement moyen sur {best_t['posts']} posts {period_txt}.",
                fb))

    # 2) Thème qui dépense sans rien rapporter (GA4 seulement — sinon on ne sait pas)
    if has_ga4:
        worst = [t for t in themes
                 if t["spend"] >= C_SEUILS["theme_spend_min"] and (t.get("revenue") or 0) == 0]
        if worst:
            w = max(worst, key=lambda t: t["spend"])
            out.append(_constat(
                f"theme_worst:{_slug(w['label'])}", "theme_worst",
                f"Le thème « {w['label']} » dépense sans vente attribuée",
                f"{w['spend']:.0f} CHF investis {period_txt}, 0 CHF de revenu attribué — "
                "à challenger en priorité.", fb))

    # 3) Format gagnant (≥ 5 posts, ≥ +20 % vs la portée moyenne du compte)
    avg_reach = matrix.get("account_reach_avg") or 0
    if avg_reach > 0:
        cands = [f for f in matrix["formats"]
                 if f["posts"] >= C_SEUILS["format_posts_min"]
                 and f["reach_avg"] >= avg_reach * C_SEUILS["format_reach_boost"]]
        if cands:
            f = max(cands, key=lambda f: f["reach_avg"])
            out.append(_constat(
                f"format_best:{_slug(f['format'])}", "format_best",
                f"Le format {f['format']} porte plus loin",
                f"{f['reach_avg']:,.0f} de portée moyenne sur {f['posts']} posts, contre "
                f"{avg_reach:,.0f} pour ton post moyen ({(f['reach_avg'] / avg_reach - 1) * 100:+.0f} %).",
                fb))

    # 4) Créneau en or (la meilleure case fiable de la heatmap)
    if matrix["slots"]:
        s = matrix["slots"][0]
        out.append(_constat(
            f"slot_best:{s['dow']}_{s['slot']}", "slot_best",
            f"Ton créneau en or : {DAYS[s['dow']]} {HOURS[s['slot']]}",
            f"{s['reach_avg']:,.0f} de portée moyenne sur {s['posts']} posts publiés à ce "
            "moment — ton créneau le plus régulier.", fb))

    # 5) Campagne locomotive (revenu max avec GA4, sinon CTR nettement au-dessus)
    # — dans les thèmes prioritaires si le client en a choisi
    camps = _focus(matrix["campaigns"], lambda c: c.get("label"))
    loco = None
    if has_ga4:
        cands = [c for c in camps
                 if c["spend"] >= C_SEUILS["camp_spend_min"] and (c.get("revenue") or 0) > 0
                 and c["revenue"] / c["spend"] >= C_SEUILS["camp_roas_min"]]
        if cands:
            loco = max(cands, key=lambda c: c["revenue"])
            det = (f"{loco['revenue']:.0f} CHF attribués pour {loco['spend']:.0f} CHF investis "
                   f"(ROAS {loco['revenue'] / loco['spend']:.1f}) {period_txt}.")
    if loco is None:
        # moyenne pub calculée sur TOUTES les campagnes (pas le sous-ensemble focus)
        tot_clicks = sum(c["clicks"] for c in matrix["campaigns"])
        tot_impr = sum(c["impressions"] for c in matrix["campaigns"])
        pub_ctr = tot_clicks / tot_impr * 100 if tot_impr > 0 else 0
        cands = [c for c in camps
                 if c["spend"] >= C_SEUILS["camp_spend_min"] and pub_ctr > 0
                 and c["ctr"] >= pub_ctr * C_SEUILS["camp_ctr_boost"]]
        if cands:
            loco = max(cands, key=lambda c: c["ctr"])
            det = (f"CTR {loco['ctr']:.1f} % contre {pub_ctr:.1f} % en moyenne sur ta pub, "
                   f"pour {loco['spend']:.0f} CHF investis {period_txt}.")
    if loco is not None:
        out.append(_constat(
            f"campagne_locomotive:{_slug(loco['name'])}", "campagne_locomotive",
            f"« {loco['name']} » est ta campagne locomotive", det, fb))

    out = out[:5]

    # Toujours en dernier : l'angle mort de couverture (items sans thème)
    cov = matrix["coverage"]
    miss_posts = cov["posts_total"] - cov["posts_labeled"]
    miss_camps = cov["campaigns_total"] - cov["campaigns_labeled"]
    if miss_posts > 0 or miss_camps > 0:
        parts = []
        if miss_posts > 0:
            parts.append(f"{miss_posts} post{'s' if miss_posts > 1 else ''}")
        if miss_camps > 0:
            parts.append(f"{miss_camps} campagne{'s' if miss_camps > 1 else ''}")
        out.append(_constat(
            "angle_mort:couverture", "angle_mort",
            "Une partie de tes contenus n'est pas encore classée",
            f"{' et '.join(parts)} sans thème — cette analyse ne les voit pas encore. "
            "Clique « ✨ Classer mes contenus » sur la page Thèmes.", fb))

    return out
