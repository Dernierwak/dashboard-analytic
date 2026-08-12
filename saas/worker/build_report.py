"""Construit et publie le rapport hebdo précalculé (weekly_reports.payload) — headless.

Réplique de la préparation de pages/rapport.py : mêmes fenêtres (7 jours pleins
ancrés sur la dernière donnée, jamais aujourd'hui), même moteur de recos, même
structure de payload. Deux producteurs, un consommateur :
  • le Streamlit publie à l'ouverture du rapport (pont, avec persona IA) ;
  • ce worker publie après le fetch cron → Pulse est frais le lundi matin
    sans que personne n'ouvre quoi que ce soit.

Différence assumée : le brief IA du worker n'utilise pas le persona utilisateur
(il vit dans la session Streamlit) — fallback déterministe si Gemini échoue.

Usage :
  python saas/worker/build_report.py --user <uuid> [--print]
  python saas/worker/build_report.py --all
"""

from __future__ import annotations
import sys
import json
from datetime import date, timedelta
from pathlib import Path

# Permet d'importer scripts/ et components/ quel que soit le cwd
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

import pandas as pd  # noqa: E402
import requests  # noqa: E402

from scripts.app_secrets import secret  # noqa: E402
from scripts.fetch_data import (  # noqa: E402
    fetch_meta_ads, fetch_post_metrics, fetch_daily_followers,
    fetch_objectif, fetch_reco_feedback, fetch_google_ads,
    fetch_campaign_config, fetch_google_campaign_config, fetch_reco_decisions,
    fetch_insight_feedback,
)
from scripts.insert_data import upsert_weekly_report  # noqa: E402
from components.reco_engine import build_recos, KEY_LABELS, OBJECTIFS  # noqa: E402
from saas.worker.insights import build_matrix, build_constats  # noqa: E402

MONTHS_FR = {1: "jan", 2: "fév", 3: "mar", 4: "avr", 5: "mai", 6: "jun",
             7: "jul", 8: "aoû", 9: "sep", 10: "oct", 11: "nov", 12: "déc"}


def _call_gemini(prompt: str) -> str | None:
    api_key = secret("gemini.api_key")
    if not api_key:
        return None
    try:
        resp = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
            json={"contents": [{"parts": [{"text": prompt}]}]},
            timeout=20,
        )
        return resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
    except Exception:
        return None


# Champs d'une reco tels que stockés dans le payload (miroir du dict _reco()).
# metric/metric_label/direction/baseline : indicateur-cible + sa valeur du moment,
# pour le suivi « ▶ Je le teste » (photographie de la décision).
RECO_FIELDS = ("key", "platform", "title", "observation", "pourquoi", "verifier",
               "repere", "angle_mort", "confidence", "priority", "source",
               "metric", "metric_label", "direction", "baseline", "effort")

# Effort a prevoir pour appliquer un conseil-regle : c'est la moitie de la
# decision (l'autre moitie, c'est l'indicateur vise). Affiche en pastille.
EFFORTS = ("10 min", "30 min", "1 h", "2 h+")
EFFORT_BY_KEY = {
    "gaspillage": "10 min",
    "scaler": "10 min",
    "creneau": "10 min",
    "connecter_ga4": "10 min",
    "roas": "30 min",
    "funnel": "30 min",
    "ga4_muet": "30 min",
    "silence": "1 h",
    "format_gagnant": "1 h",
    "page_endormie": "1 h",
}


# Le LEVIER d'un conseil : sur quoi il demande d'agir.
#
# C'est ce qui manquait pour que « les 3 du moment » cessent de se ressembler.
# La selection triait par (priorite, confiance, facilite) puis prenait les trois
# premiers — sans regarder si les trois disaient la meme chose. Deux themes en
# gaspillage donnaient deux fois « ajuste un budget », et le lecteur en concluait
# que le produit n'a qu'une idee.
#
# Quatre leviers, parce qu'un conseil marketing agit sur l'un des quatre :
#   argent   — combien on met, et ou
#   contenu  — ce qu'on montre
#   tempo    — quand et a quelle frequence
#   audience — a qui on parle
# `socle` est a part : ce sont les prerequis (GA4, funnel), qui ne se
# concurrencent pas entre eux.
_LEVIER_REGLE = {
    "gaspillage": "argent",
    "scaler": "argent",
    "roas": "argent",
    "creneau": "tempo",
    "silence": "tempo",
    "format_gagnant": "contenu",
    "page_endormie": "contenu",
    "funnel": "socle",
    "connecter_ga4": "socle",
    "ga4_muet": "socle",
}
# Les conseils IA n'ont pas de cle stable (`ai_<theme>_<n>`) : leur levier se lit
# dans ce qu'ils demandent de faire. Ordre volontaire — « budget » l'emporte sur
# « visuel » quand les deux mots sont la, parce que c'est le geste qui coute.
_LEVIER_MOTS = (
    ("argent", ("budget", "depense", "dépense", "investi", "cpc", "cout", "coût",
                "enchere", "enchère", "reallou", "réallou", "financ")),
    ("audience", ("audience", "ciblage", "cibl", "lookalike", "similaire",
                  "interet", "intérêt", "mot-cle", "mot-clé", "requete", "requête",
                  "exclu", "geograph", "géograph")),
    ("tempo", ("publie", "publi", "frequence", "fréquence", "rythme", "horaire",
               "creneau", "créneau", "calendrier", "regularite", "régularité")),
    ("contenu", ("visuel", "crea", "créa", "accroche", "message", "format",
                 "carrousel", "reel", "réel", "video", "vidéo", "texte", "titre",
                 "legende", "légende", "photo", "landing", "page de")),
)


def _levier(reco: dict) -> str:
    cle = reco.get("key") or ""
    if cle in _LEVIER_REGLE:
        return _LEVIER_REGLE[cle]
    txt = f"{reco.get('title', '')} {reco.get('observation', '')}".lower()
    for nom, mots in _LEVIER_MOTS:
        if any(m in txt for m in mots):
            return nom
    return "autre"


def _diversifier(pool: list, n: int = 3) -> list:
    """Choisit `n` conseils aussi differents que possible, sans jamais en rendre
    moins que ce que le tri simple aurait rendu.

    Cinq passes de plus en plus permissives. La premiere exige trois cles, trois
    themes et trois leviers distincts ; la derniere n'exige rien. On ne descend
    d'un cran que si le cran du dessus n'a pas rempli les trois places.

    La derniere passe n'est pas un detail : deux themes qui gaspillent, ce SONT
    deux problemes, pas un doublon — les campagnes concernees ne sont pas les
    memes. Quand il n'y a rien d'autre a montrer, on remontre la meme regle
    plutot que de rendre deux conseils au lieu de trois. La variete passe avant
    la repetition, jamais avant l'information.
    """
    exigences = (("cle", "theme", "levier"), ("cle", "theme"),
                 ("cle", "levier"), ("cle",), ())
    choisis: list = []
    vus: set = set()
    for exig in exigences:
        for r in pool:
            if len(choisis) >= n:
                break
            if id(r) in vus:
                continue
            if "cle" in exig and any(c.get("key") == r.get("key") for c in choisis):
                continue
            if "theme" in exig and any(c.get("theme") == r.get("theme") for c in choisis):
                continue
            if "levier" in exig and any(_levier(c) == _levier(r) for c in choisis):
                continue
            choisis.append(r)
            vus.add(id(r))
        if len(choisis) >= n:
            break
    return choisis


def _strip_reco(r: dict) -> dict:
    return {k: r.get(k) for k in RECO_FIELDS}


def _compares_channels(reco: dict) -> bool:
    """True si le conseil OPPOSE Meta et Google (comparaison des deux régies) —
    à écarter. Permissif : cite les deux ET un mot de comparaison/opposition."""
    txt = f"{reco.get('title', '')} {reco.get('observation', '')} {reco.get('pourquoi', '')}".lower()
    if "meta" not in txt or "google" not in txt:
        return False
    cmp_words = ("plutôt que", "au lieu de", "mieux que", "moins que", "vs", "versus",
                 "comparé", "par rapport", "davantage que", "plus que google",
                 "plus que meta", "au détriment", "surperforme", "sous-performe",
                 "bat ", "dépasse google", "dépasse meta")
    return any(w in txt for w in cmp_words)


def _theme_ai_recos(theme: str, camps: list, tsummary: dict | None,
                    obj_txt: str, want: int = 3) -> list[dict]:
    """Jusqu'à `want` pistes IA DISTINCTES pour un thème, en UN seul appel Gemini
    (léger, thinking off). [] si Gemini échoue → jamais bloquant."""
    import json as _json
    if want <= 0:
        return []
    facts = "; ".join(
        f"{c['name']} [{c['channel']}] {c['spend']:.0f} CHF, CTR {c.get('ctr', 0):.1f} %"
        + (f", revenu {c['revenue']:.0f} CHF" if c.get("revenue") is not None else "")
        for c in camps[:12]) or "aucune campagne pub sur ce thème"
    s = tsummary or {}
    roas_txt = f", ROAS {s['roas']:.1f}" if s.get("roas") is not None else ""
    raw = _call_gemini(
        "Tu es un consultant marketing senior pour une PME suisse. "
        f"On travaille UNIQUEMENT sur le thème « {theme} » (objectif du compte : {obj_txt}). "
        f"Ce thème sur tout l'historique : {s.get('spend', 0):.0f} CHF dépensés"
        f"{roas_txt}, {s.get('posts', 0)} posts. "
        f"Ses campagnes : {facts}. "
        f"Propose {want} idées DISTINCTES et concrètes pour améliorer CE thème cette "
        "semaine (chacune sur un levier différent : cible, créa, budget, canal, format…). "
        "RÈGLE ABSOLUE : ne compare JAMAIS Meta et Google entre eux, ne dis jamais "
        "« Meta fait mieux que Google » ni l'inverse — chaque conseil porte sur UN levier, "
        "pas sur un arbitrage entre les deux régies. "
        "Réponds UNIQUEMENT avec un tableau JSON de "
        f"{want} objets, chacun avec ces clés : "
        '{"title","observation","pourquoi","verifier","angle_mort","effort"}. '
        '"effort" = le temps qu\'il faut pour le mettre en place, EXACTEMENT une '
        'de ces valeurs : "10 min", "30 min", "1 h", "2 h+". '
        "Titres courts. Français, ton direct, ne déforme aucun chiffre fourni."
    )
    if not raw:
        return []
    try:
        txt = raw.strip()
        if txt.startswith("```"):
            txt = txt.strip("`")
            txt = txt[4:] if txt.lower().startswith("json") else txt
        arr = _json.loads(txt.strip())
        if isinstance(arr, dict):  # tolérance : un seul objet renvoyé
            arr = [arr]
        out = []
        for i, d in enumerate(arr[:want]):
            if not isinstance(d, dict):
                continue
            if all(d.get(k) for k in ("title", "observation", "pourquoi", "verifier", "angle_mort")):
                out.append({
                    "key": f"ai_{theme}_{i + 1}", "platform": "ia",
                    "title": str(d["title"])[:90],
                    "observation": str(d["observation"]), "pourquoi": str(d["pourquoi"]),
                    "verifier": str(d["verifier"]), "repere": "",
                    "angle_mort": str(d["angle_mort"]),
                    "confidence": "piste", "priority": 9 + i, "source": "ai",
                    "effort": d.get("effort") if d.get("effort") in EFFORTS else "30 min",
                })
        return out
    except Exception:
        return []


def _themes_tips(labels: list, obj_txt: str, business: str = "",
                 bloques: list | None = None) -> list:
    """Savoir-faire de fond par thematique — PAS lie aux chiffres de la semaine.

    Les conseils hebdo repondent a « que faire maintenant » ; ceux-ci repondent a
    « comment on fait bien ce genre de contenu, en general ». Ils changent peu et
    se lisent quand on a cinq minutes. Un seul appel Gemini pour tous les themes.
    [] si Gemini echoue — jamais bloquant.
    """
    import json as _json
    if not labels:
        return []
    _bloc = ""
    if bloques:
        _bloc = (" Cette personne a marque les conseils suivants comme TROP "
                 "COMPLIQUES a mettre en place : "
                 + " ; ".join(f'"{b}"' for b in bloques[:6])
                 + ". Traite ces sujets EN PRIORITE, en expliquant le "
                   "savoir-faire qui manque, pas en repetant le conseil.")
    raw = _call_gemini(
        "Tu es un consultant marketing senior pour une PME suisse"
        + (f" ({business})" if business else "")
        + f". Objectif du compte : {obj_txt}.{_bloc} "
        f"Voici ses thematiques de communication : {', '.join(labels)}. "
        "Pour CHAQUE thematique, donne 2 conseils de FOND : des bonnes pratiques "
        "durables et concretes sur ce type de contenu ou de campagne (angle, "
        "format, structure d'accroche, saisonnalite, erreurs classiques). "
        "Ce ne sont PAS des conseils sur les chiffres de la semaine : ils doivent "
        "rester valables dans six mois. Pas de generalites creuses du type "
        "« publie regulierement » — du concret qu'on peut appliquer demain. "
        "Reponds UNIQUEMENT avec un tableau JSON : "
        '[{"theme":"...","tips":[{"titre":"...","texte":"..."}]}]. '
        "Titres courts (5 mots max), textes de 2 phrases. Francais, ton direct."
    )
    if not raw:
        return []
    try:
        txt = raw.strip()
        if txt.startswith("```"):
            txt = txt.strip("`")
            txt = txt[4:] if txt.lower().startswith("json") else txt
        arr = _json.loads(txt.strip())
        out = []
        for d in arr if isinstance(arr, list) else []:
            if not isinstance(d, dict):
                continue
            tips = [
                {"titre": str(t["titre"])[:70], "texte": str(t["texte"])}
                for t in (d.get("tips") or [])
                if isinstance(t, dict) and t.get("titre") and t.get("texte")
            ][:3]
            if d.get("theme") and tips:
                out.append({"theme": str(d["theme"]), "tips": tips})
        return out[:3]
    except Exception:
        return []


def build_payload(sb, user_id: str) -> dict | None:
    """Prépare le payload du rapport hebdo. None si pas assez de données."""
    today = date.today()

    # ── Chargement (mêmes fetchers que le rapport) ────────────────────────────
    df_meta_raw = None
    df_insta = pd.DataFrame()
    df_follows = pd.DataFrame()
    try:
        meta_data = fetch_meta_ads(sb, user_id)
        if meta_data:
            df_meta_raw = pd.DataFrame(meta_data)
    except Exception:
        pass
    try:
        df_insta = pd.DataFrame(fetch_post_metrics(sb, user_id) or [])
    except Exception:
        pass
    try:
        df_follows = pd.DataFrame(fetch_daily_followers(sb, user_id) or [])
    except Exception:
        pass
    df_google = pd.DataFrame()
    try:
        df_google = pd.DataFrame(fetch_google_ads(sb, user_id) or [])
    except Exception:
        pass

    # ── Fenêtre : 7 jours pleins ancrés sur la dernière donnée (jamais aujourd'hui)
    yesterday = today - timedelta(days=1)
    _data_dates = []
    if df_meta_raw is not None and "date_start" in df_meta_raw.columns:
        _d = pd.to_datetime(df_meta_raw["date_start"], errors="coerce").max()
        if pd.notna(_d):
            _data_dates.append(_d.date())
    if not df_insta.empty and "date" in df_insta.columns:
        _d = pd.to_datetime(df_insta["date"], errors="coerce", utc=True).max()
        if pd.notna(_d):
            _data_dates.append(_d.date())
    if not df_follows.empty and "fetched_at" in df_follows.columns:
        _d = pd.to_datetime(df_follows["fetched_at"], errors="coerce", utc=True).max()
        if pd.notna(_d):
            _data_dates.append(_d.date())
    last_data_date = max(_data_dates) if _data_dates else yesterday

    last_full_day = min(last_data_date, yesterday)
    cur_since = last_full_day - timedelta(days=6)
    prev_until = cur_since - timedelta(days=1)
    prev_since = prev_until - timedelta(days=6)

    # ── Meta Ads : agrégats + par campagne ────────────────────────────────────
    total_spend = 0.0
    total_clicks = 0
    total_impr = 0
    m_clicks_prev = 0
    m_impr_prev = 0
    avg_ctr = 0.0
    clicks_delta_pct = None
    df_camp = pd.DataFrame()
    if df_meta_raw is not None and not df_meta_raw.empty:
        for col in ["impressions", "clicks", "spend"]:
            if col in df_meta_raw.columns:
                df_meta_raw[col] = pd.to_numeric(df_meta_raw[col], errors="coerce").fillna(0)
        df_meta_raw["date_start"] = pd.to_datetime(df_meta_raw["date_start"], errors="coerce")
        df_meta = df_meta_raw[
            (df_meta_raw["date_start"] >= pd.Timestamp(cur_since))
            & (df_meta_raw["date_start"] <= pd.Timestamp(last_full_day))
        ]
        df_meta_prev = df_meta_raw[
            (df_meta_raw["date_start"] >= pd.Timestamp(prev_since))
            & (df_meta_raw["date_start"] <= pd.Timestamp(prev_until))
        ]
        if not df_meta.empty:
            total_spend = float(df_meta["spend"].sum())
            total_clicks = int(df_meta["clicks"].sum())
            total_impr = int(df_meta["impressions"].sum())
            avg_ctr = (total_clicks / total_impr * 100) if total_impr > 0 else 0.0
            if not df_meta_prev.empty:
                prev_clicks = int(df_meta_prev["clicks"].sum())
                m_clicks_prev = prev_clicks
                m_impr_prev = int(df_meta_prev["impressions"].sum())
                if prev_clicks > 0:
                    clicks_delta_pct = round((total_clicks - prev_clicks) / prev_clicks * 100)
            df_camp = df_meta.groupby("campaign_name", as_index=False).agg(
                spend=("spend", "sum"), clicks=("clicks", "sum"), impressions=("impressions", "sum")
            )
            df_camp["ctr"] = df_camp.apply(
                lambda r: r["clicks"] / r["impressions"] * 100 if r["impressions"] > 0 else 0, axis=1)
            df_camp["cpc"] = df_camp.apply(
                lambda r: r["spend"] / r["clicks"] if r["clicks"] > 0 else 0, axis=1)

    # ── Google Ads : mêmes fenêtres (KPIs email) + FUSION dans df_camp ────────
    # → le moteur voit toute la pub (ROAS = revenu payant / dépense Meta+Google).
    g_spend = 0.0
    g_clicks = 0
    g_impr = 0
    g_clicks_prev = 0
    g_impr_prev = 0
    if not df_google.empty and "date_start" in df_google.columns:
        df_google["date_start"] = pd.to_datetime(df_google["date_start"], errors="coerce")
        for col in ["cost_micros", "clicks", "impressions"]:
            if col in df_google.columns:
                df_google[col] = pd.to_numeric(df_google[col], errors="coerce").fillna(0)
        df_g = df_google[
            (df_google["date_start"] >= pd.Timestamp(cur_since))
            & (df_google["date_start"] <= pd.Timestamp(last_full_day))
        ].copy()
        # Fenetre precedente : sert uniquement aux reperes du bloc metriques.
        df_g_prev = df_google[
            (df_google["date_start"] >= pd.Timestamp(prev_since))
            & (df_google["date_start"] <= pd.Timestamp(prev_until))
        ]
        if not df_g_prev.empty:
            g_clicks_prev = int(df_g_prev["clicks"].sum())
            g_impr_prev = int(df_g_prev["impressions"].sum())
        if not df_g.empty:
            g_spend = float(df_g["cost_micros"].sum()) / 1_000_000.0
            g_clicks = int(df_g["clicks"].sum())
            g_impr = int(df_g["impressions"].sum())
            if "campaign_id" in df_g.columns:
                try:
                    gnames = {str(k): (v or {}).get("campaign_name") or f"Campagne {k}"
                              for k, v in (fetch_google_campaign_config(sb, user_id) or {}).items()}
                except Exception:
                    gnames = {}
                df_g["_cid"] = df_g["campaign_id"].astype(str)
                gagg = df_g.groupby("_cid", as_index=False).agg(
                    spend=("cost_micros", "sum"), clicks=("clicks", "sum"),
                    impressions=("impressions", "sum"))
                gagg["spend"] = gagg["spend"] / 1_000_000.0
                gagg["campaign_name"] = gagg["_cid"].map(lambda c: gnames.get(c, f"Campagne {c}"))
                gagg["ctr"] = gagg.apply(
                    lambda r: r["clicks"] / r["impressions"] * 100 if r["impressions"] > 0 else 0, axis=1)
                gagg["cpc"] = gagg.apply(
                    lambda r: r["spend"] / r["clicks"] if r["clicks"] > 0 else 0, axis=1)
                gcols = ["campaign_name", "spend", "clicks", "impressions", "ctr", "cpc"]
                df_camp = (pd.concat([df_camp, gagg[gcols]], ignore_index=True)
                           if not df_camp.empty else gagg[gcols])

    # ── Instagram ─────────────────────────────────────────────────────────────
    followers_current = 0
    followers_delta = 0
    avg_engagement = 0.0
    week_eng = None
    week_reach = None
    hist_reach = None
    df_week_posts = pd.DataFrame()
    df_prev_posts = pd.DataFrame()
    if not df_follows.empty and "followers" in df_follows.columns:
        df_follows = df_follows.sort_values("fetched_at", ascending=False)
        followers_current = int(df_follows.iloc[0]["followers"])
        if len(df_follows) >= 7:
            followers_delta = followers_current - int(df_follows.iloc[6]["followers"])
    if not df_insta.empty:
        for col in ["likes", "reach", "comments", "saved"]:
            if col in df_insta.columns:
                df_insta[col] = pd.to_numeric(df_insta[col], errors="coerce").fillna(0)
        if "reach" in df_insta.columns:
            df_insta["eng"] = df_insta.apply(
                lambda r: (r.get("likes", 0) + r.get("comments", 0) + r.get("saved", 0)) / r["reach"] * 100
                if r["reach"] > 0 else 0, axis=1)
            avg_engagement = float(df_insta["eng"].mean())
            hist_reach = float(df_insta["reach"].mean())
            if "date" in df_insta.columns:
                _dt = pd.to_datetime(df_insta["date"], errors="coerce")
                mask_week = (_dt.dt.date >= cur_since) & (_dt.dt.date <= last_full_day)
                mask_prev = (_dt.dt.date >= prev_since) & (_dt.dt.date <= prev_until)
                df_week_posts = df_insta[mask_week]
                df_prev_posts = df_insta[mask_prev]
                if len(df_week_posts) > 0:
                    week_eng = float(df_week_posts["eng"].mean())
                    week_reach = float(df_week_posts["reach"].mean())

    has_data = total_spend > 0 or g_spend > 0 or followers_current > 0
    if not has_data:
        return None

    week_num = today.isocalendar()[1]
    week_label = (
        f"Semaine {week_num} · {cur_since.day} → {last_full_day.day} "
        f"{MONTHS_FR[last_full_day.month]} · 7 jours pleins"
    )

    # ── Profil + GA4 + recos (même moteur que le rapport) ────────────────────
    objectif = None
    feedback: dict = {}
    try:
        objectif = fetch_objectif(sb, user_id)
        feedback = fetch_reco_feedback(sb, user_id)
    except Exception:
        pass
    try:
        from components.ga4 import build_ga4_context
        ga4_ctx = build_ga4_context(sb, user_id, cur_since, last_full_day)
    except Exception:
        ga4_ctx = None
    # Meme contexte sur la fenetre precedente — sert le repere du bloc metriques.
    try:
        from components.ga4 import build_ga4_context as _bgc_prev
        ga4_prev = _bgc_prev(sb, user_id, prev_since, prev_until)
    except Exception:
        ga4_prev = None

    # ── Configs campagnes (labels) — servent la matrice ET le bloc thèmes ─────
    try:
        meta_cfg = fetch_campaign_config(sb, user_id) or {}
        goog_cfg = {str(k): v for k, v in (fetch_google_campaign_config(sb, user_id) or {}).items()}
    except Exception:
        meta_cfg, goog_cfg = {}, {}

    # ── Vision globale : matrice full-history + constats validables ──────────
    # Toute la profondeur disponible (Ads depuis le 1er janvier, posts stockés),
    # pas la fenêtre 7 jours. Les verdicts du client (insight_feedback) sont
    # réappliqués à chaque régénération — un constat rejeté reste écarté.
    matrix = None
    constats: list = []
    priority_labels: list = []
    try:
        hist_since = date(today.year, 1, 1)
        try:
            from components.ga4 import build_ga4_context as _bgc_full
            ga4_full = _bgc_full(sb, user_id, hist_since, last_full_day)
        except Exception:
            ga4_full = None
        matrix = build_matrix(df_meta_raw, df_google,
                              df_insta if not df_insta.empty else None,
                              meta_cfg, goog_cfg, ga4_full, last_full_day)
        ins_fb = fetch_insight_feedback(sb, user_id)
        # Thèmes prioritaires (max 3, choisis page Thèmes) — stockés dans
        # insight_feedback sous la clé priority_label:<nom> : le client ne peut
        # pas tout travailler, l'analyse se concentre sur ses priorités.
        priority_labels = sorted({
            k.split(":", 1)[1] for k, v in ins_fb.items()
            if k.startswith("priority_label:") and v == "agree" and ":" in k
        })[:3]
        constats = build_constats(matrix, ins_fb, priority_labels)
    except Exception:
        matrix, constats = None, []

    rule_recos = build_recos(
        df_camp=df_camp if not df_camp.empty else None,
        avg_ctr=avg_ctr,
        df_insta=df_insta if not df_insta.empty else None,
        df_week_posts=df_week_posts,
        followers_current=followers_current,
        ga4=ga4_ctx,
        objectif=objectif,
        feedback=feedback,
        vision=constats,
    )

    # ── Recos PAR THÈME : le client travaille label par label, cross-canal ────
    # Chaque thème prioritaire (≤3 ; sinon les 3 plus gros) reçoit ses propres
    # conseils, calculés sur SES campagnes (Meta+Google) et SES posts seulement.
    # Les conseils « réglages » (GA4, funnel) sont sortis dans un bloc à part.
    SETUP_KEYS = {"ga4_muet", "connecter_ga4", "funnel"}
    _obj_txt0 = OBJECTIFS[objectif]["label"] if objectif in OBJECTIFS else "non défini"

    def _nrm(s):
        return str(s or "").strip().lower()

    name2label = {}
    for _n, _c in (meta_cfg or {}).items():
        if (_c or {}).get("label"):
            name2label[_nrm(_n)] = _c["label"]
    for _cid, _c in (goog_cfg or {}).items():
        if (_c or {}).get("label") and (_c or {}).get("campaign_name"):
            name2label[_nrm(_c["campaign_name"])] = _c["label"]

    theme_list = list(priority_labels)
    if not theme_list and matrix and matrix.get("themes"):
        theme_list = [t["label"] for t in matrix["themes"][:3] if (t.get("spend") or 0) > 0]

    matrix_campaigns = (matrix or {}).get("campaigns", [])
    matrix_themes_by = {_nrm(t["label"]): t for t in (matrix or {}).get("themes", [])}

    # ── Frise (Phase 2) : série hebdo de la métrique du thème + repères d'actions
    _markers = {}
    try:
        # Le repere se pose au jour ou l'action a ete FAITE (a defaut, decidee).
        # On garde son TITRE avec sa date : un pointille muet ne relie rien, et
        # l'index de semaine seul ne permet pas d'ecrire ce qu'on a fait.
        for _a in (sb.table("suivi_actions").select("*")
                   .eq("user_id", user_id).execute().data or []):
            _d = _a.get("done_at") or _a.get("decided_at")
            _markers.setdefault(_nrm(_a.get("theme")), []).append(
                {"date": str(_d)[:10], "titre": (_a.get("title") or "").strip()}
            )
    except Exception:
        _markers = {}

    def _reperes(dates):
        """Les reperes d'une serie, groupes par semaine et nommes.

        Deux actions la meme semaine ne peuvent pas porter deux etiquettes au
        meme endroit : la semaine en porte une seule, qui dit combien elles
        sont. `markers` (les index nus) reste emis a cote pour les rapports
        deja publies.
        """
        par_sem = {}
        for _m in dates or []:
            try:
                _wi = _wk_idx(date.fromisoformat(_m["date"]))
            except Exception:
                _wi = None
            if _wi is not None:
                par_sem.setdefault(_wi, []).append(_m)
        out = []
        for _wi in sorted(par_sem):
            _lot = sorted(par_sem[_wi], key=lambda m: m["date"])
            out.append({
                "i": _wi,
                "date": _lot[-1]["date"],
                "titre": _lot[-1]["titre"] if len(_lot) == 1 else "",
                "n": len(_lot),
            })
        return out
    _WK = 10
    _serie_start = last_full_day - timedelta(days=7 * _WK - 1)

    def _wk_idx(d):
        n = (d - _serie_start).days
        return n // 7 if 0 <= n < 7 * _WK else None

    def _theme_series(lbl, revenu=None):
        """La courbe d'un theme. `revenu` = ce que le bilan du theme a constate.

        Il n'est PAS decoratif : sans lui, la note « le ROAS de ce theme n'est
        pas mesurable » s'ecrivait sous un bilan qui affichait « 820 CHF de
        revenu · ROAS 0,2 ». Les deux ne peuvent pas etre vrais en meme temps.
        """
        nlbl = _nrm(lbl)
        spend_w = [0.0] * _WK
        reach_w = [[] for _ in range(_WK)]
        eng_w = [[] for _ in range(_WK)]
        has_spend = False
        if df_meta_raw is not None and not df_meta_raw.empty:
            mm = df_meta_raw[df_meta_raw["campaign_name"].map(lambda n: name2label.get(_nrm(n)) == lbl)]
            for _d, _sp in zip(mm["date_start"], mm["spend"]):
                _dd = _d.date() if hasattr(_d, "date") else _d
                _wi = _wk_idx(_dd) if _dd is not None else None
                if _wi is not None:
                    spend_w[_wi] += float(_sp or 0); has_spend = True
        if df_google is not None and not df_google.empty and "campaign_id" in df_google.columns:
            gg = df_google[df_google["campaign_id"].astype(str).map(
                lambda c: (goog_cfg.get(c, {}) or {}).get("label") == lbl)]
            for _d, _cm in zip(gg["date_start"], gg["cost_micros"]):
                _dd = _d.date() if hasattr(_d, "date") else _d
                _wi = _wk_idx(_dd) if _dd is not None else None
                if _wi is not None:
                    spend_w[_wi] += float(_cm or 0) / 1e6; has_spend = True
        if df_insta is not None and not df_insta.empty and "labels" in df_insta.columns:
            _dtp = pd.to_datetime(df_insta["date"], errors="coerce")
            for _i in range(len(df_insta)):
                _lb = df_insta.iloc[_i].get("labels")
                if not (isinstance(_lb, (list, tuple)) and lbl in _lb):
                    continue
                _d = _dtp.iloc[_i]
                if pd.isna(_d):
                    continue
                _wi = _wk_idx(_d.date())
                if _wi is not None:
                    reach_w[_wi].append(float(df_insta.iloc[_i].get("reach") or 0))
                    eng_w[_wi].append(float(df_insta.iloc[_i].get("eng") or 0))
        # L'indicateur suit l'objectif du compte. Quand celui qu'on VOULAIT
        # suivre n'est pas mesurable (le ROAS sans valeur de conversion GA4),
        # on se rabat sur le meilleur substitut ET on le dit — plutôt que
        # d'afficher un 0,0 qui ressemble a une catastrophe.
        note = None
        if objectif == "notoriete" and any(x for x in reach_w):
            pts = [round(sum(x) / len(x)) if x else 0 for x in reach_w]
            metric_label = "Portée moyenne"
        elif objectif == "engagement" and any(x for x in eng_w):
            pts = [round(sum(x) / len(x), 2) if x else 0 for x in eng_w]
            metric_label = "Engagement moyen (%)"
        elif has_spend:
            pts = [round(v, 2) for v in spend_w]
            metric_label = "Dépense (CHF)"
            # LA NOTE NE S'ECRIT QUE SI ELLE EST VRAIE. Un theme qui a du revenu
            # a un ROAS : dire « pas mesurable » au-dessus d'un « 0,2 ROAS »
            # affiche a l'ecran deux affirmations contradictoires, et c'est la
            # note qui a tort. Ce qui manque dans ce cas n'est pas la mesure,
            # c'est la VENTILATION PAR SEMAINE : `by_campaign` de GA4 donne un
            # revenu total par campagne, sans dates. La courbe reste donc sur la
            # depense — mais en silence, parce qu'il n'y a rien a corriger cote
            # GA4 et qu'envoyer l'utilisateur y regler ses evenements cles
            # serait l'envoyer chercher un probleme qu'il n'a pas.
            if objectif == "ventes" and not (revenu and float(revenu) > 0):
                note = ("Le ROAS de ce thème n'est pas mesurable : Google Analytics "
                        "remonte tes conversions sans leur valeur en CHF. On suit la "
                        "dépense en attendant — configure la valeur de tes événements "
                        "clés dans GA4 et cette courbe passera au ROAS.")
        else:
            pts = [round(sum(x) / len(x)) if x else 0 for x in reach_w]
            metric_label = "Portée moyenne"
        if sum(1 for v in pts if v > 0) < 3:
            return None  # trop clairsemé → pas de frise
        labels = [(lambda d: f"{d.day} {MONTHS_FR[d.month]}")(_serie_start + timedelta(days=7 * j))
                  for j in range(_WK)]
        _rep = _reperes(_markers.get(nlbl, []))
        return {
            "metric_label": metric_label,
            "note": note,
            "points": [{"label": labels[j], "value": pts[j]} for j in range(_WK)],
            "markers": [r["i"] for r in _rep],
            "marqueurs": _rep,
        }

    # Un theme ne doit voir QUE ses propres conversions GA4. Sans ce filtre, la
    # regle ROAS/CPA divise la depense DU THEME par les conversions DU COMPTE
    # ENTIER : chaque theme se voyait attribuer toutes les conversions, d'ou un
    # cout par conversion beaucoup trop flatteur et en contradiction avec le
    # resume de la semaine.
    def _theme_ga4(lbl):
        if not ga4_ctx:
            return None
        by = ga4_ctx.get("by_campaign") or {}
        conv = 0.0
        rev = 0.0
        sub = {}
        for _cname, _d in by.items():
            if name2label.get(_nrm(_cname)) != lbl:
                continue
            sub[_cname] = _d
            conv += float((_d or {}).get("conversions") or 0)
            rev += float((_d or {}).get("revenue") or 0)
        ctx = dict(ga4_ctx)
        ctx["by_campaign"] = sub
        if sub:
            ctx["paid_conversions"] = conv
            ctx["paid_revenue"] = rev
        else:
            # Rien de rattachable a ce theme (UTM absents ou differents des noms
            # de campagne) : on se tait plutot que d'afficher un chiffre faux.
            ctx["paid_conversions"] = None
            ctx["paid_revenue"] = None
        return ctx

    themes_focus = []
    for lbl in theme_list:
        nlbl = _nrm(lbl)
        t_camps = [c for c in matrix_campaigns if _nrm(c.get("label")) == nlbl]

        # Sous-ensembles de la semaine pour faire tourner les règles sur ce thème
        tc = None
        if df_camp is not None and not df_camp.empty:
            _mask = df_camp["campaign_name"].map(lambda n: name2label.get(_nrm(n)) == lbl)
            tc = df_camp[_mask]
            tc = tc if not tc.empty else None

        def _has(labels, _l=lbl):
            return isinstance(labels, (list, tuple)) and _l in labels
        ti = pd.DataFrame()
        tw = pd.DataFrame()
        if df_insta is not None and not df_insta.empty and "labels" in df_insta.columns:
            ti = df_insta[df_insta["labels"].map(_has)]
        if df_week_posts is not None and not df_week_posts.empty and "labels" in df_week_posts.columns:
            tw = df_week_posts[df_week_posts["labels"].map(_has)]

        t_recos = build_recos(
            df_camp=tc, avg_ctr=avg_ctr,
            df_insta=ti if not ti.empty else None,
            df_week_posts=tw, followers_current=followers_current,
            ga4=_theme_ga4(lbl), objectif=objectif, feedback=feedback, vision=constats,
        )
        t_recos = sorted((r for r in t_recos if r.get("key") not in SETUP_KEYS),
                         key=lambda r: r["priority"])
        # On vise 3 conseils par thème : les règles d'abord, puis on COMPLÈTE avec
        # autant de pistes IA distinctes que nécessaire (souvent 3, car les règles
        # se déclenchent rarement sur un seul thème).
        _need = max(0, 3 - len(t_recos))
        try:
            _ai = _theme_ai_recos(lbl, t_camps, matrix_themes_by.get(nlbl), _obj_txt0, want=_need)
            # Un hoquet Gemini ne doit pas laisser le theme avec un seul conseil :
            # on retente une fois avant d'abandonner.
            if _need and not _ai:
                _ai = _theme_ai_recos(lbl, t_camps, matrix_themes_by.get(nlbl), _obj_txt0, want=_need)
        except Exception:
            _ai = []
        # Filet de sécurité : on écarte tout conseil qui OPPOSE Meta et Google
        # (le client n'en veut pas — filtre à la génération, pas qu'à l'affichage).
        t_recos = [r for r in (t_recos + _ai) if not _compares_channels(r)][:3]

        tt = matrix_themes_by.get(nlbl, {})
        summary = {
            "spend": tt.get("spend"), "revenue": tt.get("revenue"), "roas": tt.get("roas"),
            "ctr": tt.get("ctr"), "posts": tt.get("posts"),
            "reach_avg": tt.get("reach_avg"), "eng_avg": tt.get("eng_avg"),
            "spend_week": round(float(tc["spend"].sum()), 2) if tc is not None else 0.0,
            "best_campaign": t_camps[0]["name"] if t_camps else None,
            "n_campaigns": len(t_camps),
        }
        try:
            _series = _theme_series(lbl, summary.get("revenue"))
        except Exception:
            _series = None
        themes_focus.append({
            "label": lbl,
            "is_priority": lbl in priority_labels,
            "summary": summary,
            "series": _series,
            "campaigns": [
                {k: c.get(k) for k in ("name", "channel", "key", "label",
                                       "label_source", "spend", "revenue", "ctr", "cpc")}
                for c in t_camps[:8]
            ],
            "recos": [_strip_reco(r) for r in t_recos],
        })

    # Réglages de base : les conseils « socle » (GA4 muet, connexion, funnel),
    # sortis du flux par thème — ce sont des prérequis, pas du pilotage hebdo.
    reglages = [_strip_reco(r) for r in sorted(rule_recos, key=lambda r: r["priority"])
                if r.get("key") in SETUP_KEYS][:3]

    # ── Verdict déterministe (même logique que le rapport) ───────────────────
    _signals = []
    if week_eng is not None and avg_engagement > 0:
        _signals.append(((week_eng - avg_engagement) / avg_engagement * 100,
                         "l'engagement Instagram"))
    if week_reach is not None and hist_reach:
        _signals.append(((week_reach - hist_reach) / hist_reach * 100,
                         "la portée de tes posts"))
    if clicks_delta_pct:
        _signals.append((clicks_delta_pct, "les clics publicitaires"))
    # Le verdict sort d'ici en DEUX formes. La phrase, pour la lire ; et ses
    # trois ingredients bruts, pour que le front puisse afficher l'ecart en
    # grand. Une phrase de 26 px ne peut pas etre le niveau 1 d'une page ou un
    # autre module affiche un chiffre de 46 px : c'est la typographie qui
    # decide de la hierarchie, pas l'intention.
    verdict_pct = None
    verdict_metric = None
    verdict_tone = "stable"
    if _signals:
        _val, _name = max(_signals, key=lambda s: abs(s[0]))
        verdict_pct = round(float(_val), 1)
        verdict_metric = _name
        verdict_tone = "pos" if _val >= 10 else ("neg" if _val <= -10 else "stable")
        if _val >= 10:
            verdict = f"Semaine en progression — portée par {_name} ({_val:+.0f} %)."
        elif _val <= -10:
            verdict = f"Semaine en retrait — {_name} ({_val:.0f} %), le reste tient."
        else:
            verdict = "Semaine stable — dans tes normes habituelles."
        if followers_delta and abs(followers_delta) >= 5:
            verdict += f" {'+' if followers_delta > 0 else ''}{followers_delta} abonnés."
    elif followers_delta:
        verdict = f"{'+' if followers_delta > 0 else ''}{followers_delta} abonnés cette semaine."
    else:
        verdict = "Première semaine de données — le rapport s'affinera avec l'historique."
    _alert = next((r for r in rule_recos
                   if r.get("confidence") == "solide"
                   and str(r.get("title", "")).startswith("Alerte")), None)
    if _alert:
        verdict += (" Un point rouge à traiter : "
                    f"{KEY_LABELS.get(_alert.get('key'), 'voir le brief ci-dessous')}.")

    # ── Sélection (2 insta + 3 pub, digest 3) — comme le rapport ─────────────
    by_section = {"instagram": [], "meta": []}
    for r in rule_recos:
        p = r.get("platform")
        if p == "instagram":
            by_section["instagram"].append(r)
        elif p in ("meta", "google", "pub"):
            by_section["meta"].append(r)
    insta_items = sorted(by_section["instagram"], key=lambda r: r["priority"])[:2]
    meta_items = sorted(by_section["meta"], key=lambda r: r["priority"])[:3]
    todos = sorted(insta_items + meta_items, key=lambda r: r["priority"])[:3]

    # ── Brief IA (sans persona en headless) + fallback déterministe ──────────
    _done = [KEY_LABELS.get(k, k) for k, v in feedback.items() if v == "done"]
    _skip = [KEY_LABELS.get(k, k) for k, v in feedback.items() if v == "not_for_me"]
    fb_txt = ""
    if _done:
        fb_txt += f" Déjà traité récemment : {', '.join(_done)}."
    if _skip:
        fb_txt += f" Jugé non pertinent (ne pas réinsister) : {', '.join(_skip)}."
    obj_txt = OBJECTIFS[objectif]["label"] if objectif in OBJECTIFS else "non défini"
    _top_todo = todos[0]["title"] if todos else None
    _prio_line = (
        f"La priorité n°1 de la semaine (déjà calculée, ne la change pas) : {_top_todo}. "
        if _top_todo else ""
    )
    # La vision globale cadre l'IA : elle s'appuie sur ce que le client a validé,
    # jamais sur ce qu'il a rejeté.
    _v_ok = [c for c in constats if c["status"] in ("agree", "new") and c["kind"] != "angle_mort"]
    _v_no = [c for c in constats if c["status"] == "reject"]
    vision_txt = ""
    if priority_labels:
        vision_txt += (" Thèmes PRIORITAIRES choisis par le client (concentre tes conseils "
                       f"dessus, ignore le reste sauf urgence) : {', '.join(priority_labels)}.")
    if _v_ok:
        vision_txt += (" Vision long terme du compte (validée, appuie-toi dessus) : "
                       + " | ".join(f"{c['title']} — {c['detail']}" for c in _v_ok) + ".")
    if _v_no:
        vision_txt += (" Constats REJETÉS par le client (ne t'appuie JAMAIS dessus) : "
                       + " | ".join(c["title"] for c in _v_no) + ".")
    # Digest de la semaine : TOUS les posts + TOUTES les campagnes (pas un extrait)
    _wk = []
    _npw = len(df_week_posts) if df_week_posts is not None else 0
    if _npw > 0:
        _wk.append(f"{_npw} post(s) publiés"
                   + (f", portée moyenne {week_reach:.0f}" if week_reach else "")
                   + (f", engagement {week_eng:.1f} %" if week_eng else ""))
    else:
        _wk.append("aucun post publié cette semaine")
    if not df_camp.empty:
        _ncmp = len(df_camp)
        _cw = df_camp.sort_values("spend", ascending=False)
        _cbits = "; ".join(
            f"{r['campaign_name']} ({r['spend']:.0f} CHF, CTR {r['ctr']:.1f} %)"
            for _, r in _cw.head(6).iterrows())
        _wk.append(f"{_ncmp} campagne(s) actives, {float(df_camp['spend'].sum()):.0f} CHF au total — {_cbits}")
    else:
        _wk.append("aucune campagne pub active")
    week_digest = " · ".join(_wk)

    brief = _call_gemini(
        "Tu es un consultant marketing pour une PME. Écris un VRAI résumé de la semaine "
        "en 4 à 6 phrases (français, ton concret et direct, pas de guillemets) qui couvre "
        "À LA FOIS tous les posts ET toutes les campagnes de la semaine : "
        "1) une phrase de synthèse (la tendance générale) ; "
        "2) ce qui s'est passé côté contenu (posts, portée, engagement) ; "
        "3) ce qui s'est passé côté pub (campagnes, dépense, ce qui ressort) ; "
        "4) termine par la priorité n°1, formulée simplement. "
        "Ne compare JAMAIS Meta et Google entre eux. "
        "Vocabulaire précis : un ROAS sous 1 se dit « inférieur à 1 », jamais « négatif » ; "
        "ne déforme aucun chiffre fourni. "
        f"Objectif principal du compte : {obj_txt}.{fb_txt}{vision_txt} "
        f"{_prio_line}"
        f"Semaine : {week_digest}. "
        f"Totaux : abonnés {followers_delta:+d}, engagement {avg_engagement:.1f} %, "
        f"CTR {avg_ctr:.2f} %, dépense {total_spend:.0f} CHF. "
        "Si rien n'a vraiment marché, dis-le simplement — pas de flatterie artificielle."
    )
    if not brief:
        bits = []
        if followers_delta > 0:
            bits.append(f"+{followers_delta} abonnés cette semaine")
        if avg_engagement >= 3:
            bits.append(f"engagement à {avg_engagement:.1f}%")
        if avg_ctr >= 2:
            bits.append(f"un CTR pub de {avg_ctr:.1f}%")
        brief = ("Bonne nouvelle : " + ", ".join(bits) + "." if bits
                 else "Semaine calme — rien de marquant, mais rien qui dérape non plus.")
        if _top_todo:
            brief += f" Priorité n°1 : {_top_todo}."

    # ── Reco IA : UNE suggestion générative en complément des règles ─────────
    # Badge IA + confiance « piste » (c'est une idée à tester, pas un fait).
    # Ne répète pas les conseils des règles ; JSON strict, sinon on s'en passe.
    ai_reco = None
    try:
        import json as _json
        # Digest COMPLET de la matrice full-history : l'IA voit la totalité des
        # campagnes et posts, pas un top 3 — sa suggestion peut porter sur
        # n'importe lequel (couverture demandée par le client).
        matrix_facts = ""
        if matrix:
            mcamps = matrix["campaigns"]
            lines = [
                f"{c['name']} [{c['channel']}] : {c['spend']:.0f} CHF, CPC {c['cpc']:.2f}, "
                f"CTR {c['ctr']:.1f} %"
                + (f", revenu {c['revenue']:.0f} CHF" if c.get("revenue") is not None else "")
                + (f", thème {c['label']}" if c.get("label") else "")
                for c in mcamps[:25]
            ]
            if len(mcamps) > 25:
                _rest = mcamps[25:]
                lines.append(f"+ {len(_rest)} autres campagnes ({sum(c['spend'] for c in _rest):.0f} CHF cumulés)")
            th = " ; ".join(
                f"{t['label']} ({t['spend']:.0f} CHF"
                + (f", ROAS {t['roas']:.1f}" if t.get("roas") is not None else "")
                + (f", {t['posts']} posts" if t.get("posts") else "") + ")"
                for t in matrix["themes"][:8])
            fm = " ; ".join(
                f"{f['format']} ({f['posts']} posts, portée moy {f['reach_avg']:.0f})"
                for f in matrix["formats"])
            cov = matrix["coverage"]
            matrix_facts = (
                f" Historique complet ({matrix['period']['days']} jours) — tu vois la TOTALITÉ : "
                f"{cov['campaigns_total']} campagnes et {cov['posts_total']} posts. "
                f"Campagnes : {' | '.join(lines) or 'aucune'}. "
                f"Thèmes : {th or 'aucun'}. Formats : {fm or 'aucun'}.")
        known = " ; ".join(r["title"] for r in rule_recos)
        ai_raw = _call_gemini(
            "Tu es un consultant marketing senior pour une PME suisse. "
            f"Faits de la semaine : dépense pub {float(df_camp['spend'].sum()) if not df_camp.empty else 0:.0f} CHF, "
            f"CTR {avg_ctr:.2f} %, abonnés Instagram {followers_delta:+d}, "
            f"engagement moyen {avg_engagement:.1f} %."
            f"{matrix_facts}{vision_txt} "
            f"Objectif du client : {obj_txt}. "
            f"Conseils DÉJÀ donnés cette semaine (n'en répète aucun) : {known or 'aucun'}. "
            "Propose UNE seule idée d'action originale, concrète et faisable cette semaine, "
            "cohérente avec la vision long terme validée. "
            "Réponds UNIQUEMENT avec un objet JSON (aucun texte autour) avec exactement ces clés : "
            '{"title": "titre court", '
            '"observation": "le fait chiffré qui motive cette idée — uniquement des chiffres fournis ci-dessus", '
            '"pourquoi": "pourquoi ça peut marcher", '
            '"verifier": "comment la tester à petite échelle avant de généraliser", '
            '"angle_mort": "ce que cette idée ignore"}. '
            "Français, ton direct, ne déforme aucun chiffre."
        )
        if ai_raw:
            txt = ai_raw.strip()
            if txt.startswith("```"):
                txt = txt.strip("`")
                txt = txt[4:] if txt.lower().startswith("json") else txt
            data = _json.loads(txt.strip())
            if all(data.get(k) for k in ("title", "observation", "pourquoi", "verifier", "angle_mort")):
                ai_reco = {
                    "key": "ai", "platform": "ia",
                    "title": str(data["title"])[:90],
                    "observation": str(data["observation"]),
                    "pourquoi": str(data["pourquoi"]),
                    "verifier": str(data["verifier"]),
                    "repere": "",
                    "angle_mort": str(data["angle_mort"]),
                    "confidence": "piste", "priority": 9, "source": "ai",
                }
    except Exception:
        ai_reco = None

    _n_done = sum(1 for v in feedback.values() if v == "done")
    _n_useful = sum(1 for v in feedback.values() if v == "useful")
    _n_skip = sum(1 for v in feedback.values() if v == "not_for_me")

    # ── Thèmes : dépense par label × revenu GA4 (même logique que le rapport) ─
    # (meta_cfg / goog_cfg déjà chargés plus haut pour la matrice)
    themes = None
    if ga4_ctx and ga4_ctx.get("by_campaign"):
        def _norm(s):
            return str(s or "").strip().lower()
        sp_lbl: dict = {}
        if not df_camp.empty:
            for _, r in df_camp.iterrows():
                lbl = (meta_cfg.get(r["campaign_name"], {}) or {}).get("label")
                if lbl:
                    sp_lbl[lbl] = sp_lbl.get(lbl, 0.0) + float(r["spend"])
        if not df_google.empty and "campaign_id" in df_google.columns:
            gw = df_google[
                (df_google["date_start"] >= pd.Timestamp(cur_since))
                & (df_google["date_start"] <= pd.Timestamp(last_full_day))
            ].copy()
            if not gw.empty:
                gw["_cid"] = gw["campaign_id"].astype(str)
                gw["_chf"] = pd.to_numeric(gw["cost_micros"], errors="coerce").fillna(0) / 1_000_000.0
                for cid, chf in gw.groupby("_cid")["_chf"].sum().items():
                    lbl = (goog_cfg.get(cid, {}) or {}).get("label")
                    if lbl and chf > 0:
                        sp_lbl[lbl] = sp_lbl.get(lbl, 0.0) + float(chf)
        name_lbl = {_norm(n): (c or {}).get("label")
                    for n, c in meta_cfg.items() if (c or {}).get("label")}
        for cid, c in goog_cfg.items():
            if (c or {}).get("label") and c.get("campaign_name"):
                name_lbl.setdefault(_norm(c["campaign_name"]), c["label"])
        rv_lbl, orphan = {}, 0.0
        for camp, dd in ga4_ctx["by_campaign"].items():
            rev = float(dd.get("revenue") or 0)
            lbl = name_lbl.get(_norm(camp))
            if lbl:
                rv_lbl[lbl] = rv_lbl.get(lbl, 0.0) + rev
            else:
                orphan += rev
        t_rows = sorted(
            ({"label": lbl, "spend": round(s, 2), "rev": round(rv_lbl.get(lbl, 0.0), 2)}
             for lbl, s in sp_lbl.items() if s > 0),
            key=lambda r: -r["spend"],
        )[:4]
        if t_rows:
            themes = {"rows": t_rows, "orphan": round(orphan, 2)}

    # ── Boucle de la preuve : les « Fait » des semaines passées, re-mesurés ───
    # Le jour où la mesure est passée du compte au thème. Voir plus bas : une
    # action antérieure garde la mesure sur laquelle elle a été photographiée.
    _BASCULE_THEME = "2026-08-12"

    PROOF_KPI = {
        "gaspillage":     ("cpc", "CPC moyen", "CHF", "down", "{:.2f}"),
        "roas":           ("roas", "ROAS", "", "up", "{:.1f}"),
        "scaler":         ("roas", "ROAS", "", "up", "{:.1f}"),
        "funnel":         ("purchases", "achats (GA4)", "", "up", "{:.0f}"),
        "silence":        ("posts", "posts publiés", "", "up", "{:.0f}"),
        "creneau":        ("eng", "engagement moyen", "%", "up", "{:.1f}"),
        "format_gagnant": ("eng", "engagement moyen", "%", "up", "{:.1f}"),
        "page_endormie":  ("reach", "portée moyenne", "", "up", "{:,.0f}"),
    }

    # MESURER UNE ACTION LÀ OÙ ELLE A EU LIEU.
    #
    # Sans le parametre `theme`, cette fonction rend les chiffres du COMPTE
    # ENTIER — et c'est ainsi que les verdicts etaient rendus jusqu'ici : une
    # action prise sur « Audio Tour » etait jugee sur le ROAS de tout le compte.
    # Autant dire qu'elle etait jugee sur le bruit des autres themes.
    #
    # Avec `theme`, chaque source est filtree sur ce theme : les campagnes par
    # leur etiquette, les posts par leurs labels, le revenu GA4 par les
    # campagnes du theme. Le verdict devient enfin une mesure de l'action.
    def _kpis_window(w_since, w_until, theme=None):
        k = {}
        if df_meta_raw is not None and not df_meta_raw.empty:
            m = df_meta_raw[(df_meta_raw["date_start"] >= pd.Timestamp(w_since))
                            & (df_meta_raw["date_start"] <= pd.Timestamp(w_until))]
            if theme:
                m = m[m["campaign_name"].map(lambda n: name2label.get(_nrm(n)) == theme)]
            sp, cl = float(m["spend"].sum()), int(m["clicks"].sum())
            k["spend"] = sp
            k["cpc"] = (sp / cl) if cl > 0 else None
        if not df_insta.empty and "date" in df_insta.columns and "eng" in df_insta.columns:
            dtp = pd.to_datetime(df_insta["date"], errors="coerce")
            p = df_insta[(dtp.dt.date >= w_since) & (dtp.dt.date <= w_until)]
            if theme and "labels" in p.columns:
                p = p[p["labels"].map(
                    lambda l, _t=theme: isinstance(l, (list, tuple)) and _t in l)]
            k["posts"] = float(len(p))
            k["eng"] = float(p["eng"].mean()) if len(p) else None
            k["reach"] = float(p["reach"].mean()) if len(p) and "reach" in p.columns else None
        try:
            from components.ga4 import build_ga4_context as _bgc
            g = _bgc(sb, user_id, w_since, w_until)
        except Exception:
            g = None
        _rev = (g or {}).get("paid_revenue")
        if theme and g:
            # Seules les conversions rattachables aux campagnes DE CE THEME.
            # Rien de rattachable : on ne sait pas, et on se tait — plutot que
            # d'attribuer au theme le revenu du compte.
            _sub = {n: d for n, d in (g.get("by_campaign") or {}).items()
                    if name2label.get(_nrm(n)) == theme}
            _rev = sum(float((d or {}).get("revenue") or 0) for d in _sub.values()) if _sub else None
        if _rev is not None and k.get("spend", 0) > 0:
            k["roas"] = float(_rev) / k["spend"]
        pu = (g or {}).get("funnel", {}).get("purchase")
        # `purchases` reste un chiffre de compte : GA4 ne rattache pas un achat
        # a un theme quand l'UTM ne porte pas le nom de campagne.
        k["purchases"] = float(pu) if pu is not None else None
        return k

    week_start_monday = today - timedelta(days=today.weekday())
    try:
        decisions = fetch_reco_decisions(sb, user_id)
    except Exception:
        decisions = []
    outcomes, pending = [], []
    cur_kpis = None
    for dec in decisions[:4]:
        spec = PROOF_KPI.get(dec["reco_key"])
        if not spec:
            continue
        try:
            w0 = date.fromisoformat(dec["week_start"])
        except Exception:
            continue
        if w0 >= week_start_monday:
            pending.append(dec["reco_key"])
            continue
        kpi, lbl_k, unit, direction, fmt = spec
        if cur_kpis is None:
            cur_kpis = _kpis_window(cur_since, last_full_day)
        then = _kpis_window(w0, w0 + timedelta(days=6)).get(kpi)
        now = cur_kpis.get(kpi)
        if then is None or now is None:
            continue
        delta = ((now - then) / then * 100) if abs(then) > 1e-9 else None
        better = delta is not None and ((delta <= -5) if direction == "down" else (delta >= 5))
        worse = delta is not None and ((delta >= 5) if direction == "down" else (delta <= -5))
        outcomes.append({
            "key": dec["reco_key"],
            "title": KEY_LABELS.get(dec["reco_key"], dec["reco_key"]).capitalize(),
            "week_label": f"sem. du {w0.day} {MONTHS_FR[w0.month]}",
            "kpi": lbl_k, "unit": unit,
            "then": fmt.format(then), "now": fmt.format(now),
            "delta": round(delta, 1) if delta is not None else None,
            "verdict": "better" if better else ("worse" if worse else "stable"),
        })
    preuve = (
        {"outcomes": outcomes[:3],
         "pending": [{"key": k, "title": KEY_LABELS.get(k, k)} for k in pending[:2]]}
        if (outcomes or pending) else None
    )

    # ── Suivi des actions « ▶ Je le teste » ──────────────────────────────────
    # 1) On attache à chaque conseil son indicateur-cible + sa valeur du moment :
    #    c'est la photo prise si l'utilisateur décide de le tester.
    if cur_kpis is None:
        cur_kpis = _kpis_window(cur_since, last_full_day)

    # La baseline d'un conseil se prend sur SON terrain. Un conseil « le CPC de
    # Audio Tour est trop haut » dont la baseline serait le CPC du compte
    # entier serait jugé, deux semaines plus tard, sur un chiffre qui ne parle
    # pas de lui. Le cache évite de recalculer une fenêtre par conseil.
    _kpis_theme = {}

    def _kpis_du_theme(theme):
        if theme is None:
            return cur_kpis
        if theme not in _kpis_theme:
            _kpis_theme[theme] = _kpis_window(cur_since, last_full_day, theme=theme)
        return _kpis_theme[theme]

    def _attach_metric(r, theme=None):
        spec = PROOF_KPI.get(r.get("key"))
        if not spec:
            return
        kpi, lbl_k, _unit, direction, _fmt = spec
        base = _kpis_du_theme(theme).get(kpi)
        r["metric"], r["metric_label"], r["direction"] = kpi, lbl_k, direction
        r["baseline"] = round(base, 4) if base is not None else None

    def _attach_effort(r):
        if not r.get("effort"):
            r["effort"] = EFFORT_BY_KEY.get(r.get("key"), "30 min")

    for _tf in themes_focus:
        for _r in _tf["recos"]:
            _attach_metric(_r, _tf["label"])
            _attach_effort(_r)
    for _r in reglages:
        # Les réglages de base (GA4, funnel) ne portent pas de thème : ce sont
        # des prérequis du compte, leur mesure l'est aussi.
        _attach_metric(_r)
        _attach_effort(_r)

    # ── Les 3 du moment ──────────────────────────────────────────────────────
    # Jusqu'a 9 conseils repartis en 3 themes, personne ne choisit dans 9. Une
    # seule selection en tete, tous themes confondus, classee par
    # (theme prioritaire, confiance, facilite) : de quoi decider en 5 secondes.
    _CONF_W = {"solide": 0, "creuser": 1, "piste": 2}
    _EFF_W = {"10 min": 0, "30 min": 1, "1 h": 2, "2 h+": 3}
    _pool = []
    for _tf in themes_focus:
        for _r in _tf["recos"]:
            _pool.append(dict(_r, theme=_tf["label"], is_priority=_tf["is_priority"]))
    top_recos = _diversifier(
        sorted(
            _pool,
            key=lambda r: (0 if r.get("is_priority") else 1,
                           _CONF_W.get(r.get("confidence"), 3),
                           _EFF_W.get(r.get("effort"), 2),
                           r.get("priority", 99)),
        ),
        3,
    )

    # 2) Les actions déjà lancées restent EN COURS jusqu'à être faites/vérifiées ;
    #    à l'échéance (check_at), on remesure l'indicateur → verdict.
    tracking = None
    try:
        _sa = (sb.table("suivi_actions").select("*")
               .eq("user_id", user_id).in_("status", ["running", "done"])
               .order("check_at").execute().data) or []
    except Exception:
        _sa = []
    if _sa:
        running, verified = [], []
        for a in _sa:
            metric = a.get("metric")
            base = a.get("baseline")
            # LE VERDICT SE MESURE SUR LE MÊME TERRAIN QUE LA BASELINE.
            #
            # Les actions décidées AVANT la bascule ont leur baseline prise sur
            # le compte entier : les mesurer aujourd'hui sur leur thème
            # comparerait deux échelles différentes et rendrait un verdict faux
            # — puis repondérerait les conseils sur ce faux. Elles finissent
            # donc comme elles ont commencé.
            _dec = str(a.get("decided_at"))[:10]
            _sur_theme = bool(a.get("theme")) and _dec >= _BASCULE_THEME
            _k = _kpis_du_theme(a.get("theme")) if _sur_theme else cur_kpis
            now = _k.get(metric) if metric else None
            try:
                chk = date.fromisoformat(str(a.get("check_at"))[:10])
            except Exception:
                chk = today
            status = str(a.get("status") or "running")
            done_at = str(a.get("done_at"))[:10] if a.get("done_at") else None
            # Le compteur des 2 semaines ne tourne que sur une action FAITE :
            # tant qu'elle est a faire, il n'y a rien a mesurer.
            due = status == "done" and today >= chk
            entry = {
                "id": a.get("id"), "title": a.get("title"), "theme": a.get("theme"),
                "reco_key": a.get("reco_key"),
                "metric_label": a.get("metric_label"),
                "status": status, "done_at": done_at,
                "decided_at": str(a.get("decided_at"))[:10],
                "check_at": str(a.get("check_at"))[:10],
            }
            if due and metric and base is not None and now is not None:
                b = float(base)
                delta = ((now - b) / b * 100) if abs(b) > 1e-9 else None
                direction = a.get("direction") or "up"
                better = delta is not None and ((delta <= -5) if direction == "down" else (delta >= 5))
                worse = delta is not None and ((delta >= 5) if direction == "down" else (delta <= -5))
                entry.update({
                    "then": round(b, 2), "now": round(float(now), 2),
                    "delta": round(delta, 1) if delta is not None else None,
                    "verdict": "better" if better else ("worse" if worse else "stable"),
                })
                verified.append(entry)
            else:
                entry["due"] = due  # échéance atteinte mais pas de chiffre auto → à juger soi-même
                # LE POINT D'ÉTAPE À SEPT JOURS.
                #
                # Le verdict tombe à quatorze jours. Attendre deux semaines pour
                # savoir qu'on part dans le mur, c'est deux semaines de budget
                # perdues : à mi-parcours, on dit ce qu'on voit — et seulement
                # ce qu'on voit.
                #
                # Trois conditions, et elles sont strictes, parce qu'un signal
                # précoce qui contredit le verdict final ruine le verdict :
                #   · l'action est FAITE depuis au moins 7 jours pleins ;
                #   · le mouvement dépasse 10 % — sous ce seuil, sept jours de
                #     données ne distinguent pas un effet d'un lundi calme ;
                #   · on ne prononce jamais « ça a marché », seulement un sens.
                if (
                    status == "done" and not due and done_at
                    and metric and base is not None and now is not None
                ):
                    try:
                        _fait = date.fromisoformat(done_at)
                    except ValueError:
                        _fait = None
                    if _fait and (today - _fait).days >= 7 and abs(float(base)) > 1e-9:
                        _d7 = (now - float(base)) / float(base) * 100
                        if abs(_d7) >= 10:
                            _dir = a.get("direction") or "up"
                            entry["etape"] = {
                                "jours": (today - _fait).days,
                                "delta": round(_d7, 1),
                                # « ça penche vers » — pas « ça a marché ». Le
                                # verdict reste le seul à trancher.
                                "sens": "bon" if ((_d7 <= 0) if _dir == "down" else (_d7 >= 0)) else "mauvais",
                            }
                running.append(entry)
        tracking = {"running": running, "verified": verified}

    # ── Vision + matrice compacte pour le payload ────────────────────────────
    vision = None
    if constats:
        _p_since = matrix["period"]["since"] if matrix else None
        try:
            _d = date.fromisoformat(_p_since) if _p_since else None
            period_label = (f"depuis le {_d.day} {MONTHS_FR[_d.month]}" if _d else "")
        except Exception:
            period_label = ""
        vision = {
            "generated_at": today.isoformat(),
            "period_label": period_label,
            "priorities": priority_labels,
            "constats": constats,
        }
    matrice = None
    if matrix:
        matrice = {
            "period": matrix["period"],
            "themes": matrix["themes"][:6],
            "formats": matrix["formats"][:6],
            "campaigns": matrix["campaigns"][:6],
            "slots": matrix["slots"][:3],
            "coverage": matrix["coverage"],
        }

    _all_clicks = total_clicks + g_clicks
    _all_impr = total_impr + g_impr

    # Bloc « lecture simple » des métriques clés de la semaine (section Où on en est).
    _vues = None
    if df_week_posts is not None and not df_week_posts.empty and "views" in df_week_posts.columns:
        _vues = int(pd.to_numeric(df_week_posts["views"], errors="coerce").fillna(0).sum())
    _trafic = None
    try:
        if ga4_ctx:
            _s = ga4_ctx.get("total_sessions")
            _trafic = int(_s) if _s else None
    except Exception:
        _trafic = None
    metrics_read = {
        "trafic": _trafic,   # sessions GA4 (None tant que Google muet)
        "vues": _vues,       # vues Instagram de la semaine
        "clics": _all_clicks,
        "ctr": round((_all_clicks / _all_impr * 100), 2) if _all_impr > 0 else None,
    }

    # Les memes metriques sur la fenetre PRECEDENTE : un chiffre sans repere ne
    # dit rien, le lecteur invente une conclusion. None = pas comparable, et la
    # tuile reste alors muette plutot que d'afficher une variation inventee.
    _vues_prev = None
    if df_prev_posts is not None and not df_prev_posts.empty and "views" in df_prev_posts.columns:
        _vues_prev = int(pd.to_numeric(df_prev_posts["views"], errors="coerce").fillna(0).sum())
    _trafic_prev = None
    try:
        if ga4_prev:
            _sp = ga4_prev.get("total_sessions")
            _trafic_prev = int(_sp) if _sp else None
    except Exception:
        _trafic_prev = None
    _clicks_prev = m_clicks_prev + g_clicks_prev
    _impr_prev = m_impr_prev + g_impr_prev
    metrics_prev = {
        "trafic": _trafic_prev,
        "vues": _vues_prev,
        "clics": _clicks_prev or None,
        "ctr": round((_clicks_prev / _impr_prev * 100), 2) if _impr_prev > 0 else None,
    }

    # ── Ta boussole : LE chiffre qui compte, avec son échelle ────────────────
    # Un nombre seul ne dit rien. Ce module donne les trois choses qui le
    # rendent lisible d'un coup d'oeil : sa valeur, sa trajectoire sur 10
    # semaines, et surtout la ZONE où il se situe (« tu perds » / « sain » /
    # « scalable ») — c'est la zone qui transforme un chiffre en décision.
    def _semaines(nb=10):
        out = []
        for k in range(nb):
            fin = last_full_day - timedelta(days=7 * (nb - 1 - k))
            out.append((fin - timedelta(days=6), fin))
        return out

    def _pub_semaine(d1, d2, canal=None):
        """Depense, clics et impressions d'une semaine. `canal` restreint a une
        regie — sans lui, les deux sont additionnees comme avant.

        Les deux regies vivent dans deux dataframes distincts : separer par
        plateforme ne demande donc aucune donnee de plus, seulement de ne pas
        additionner. C'est ce qui rend possible « ▣ Meta » et « ◆ Google » en
        deux rangees dans la boussole.
        """
        sp = cl = im = 0.0
        if canal in (None, "meta") and df_meta_raw is not None and not df_meta_raw.empty:
            m = df_meta_raw[(df_meta_raw["date_start"] >= pd.Timestamp(d1))
                            & (df_meta_raw["date_start"] <= pd.Timestamp(d2))]
            sp += float(m["spend"].sum()); cl += float(m["clicks"].sum()); im += float(m["impressions"].sum())
        if (canal in (None, "google") and df_google is not None
                and not df_google.empty and "date_start" in df_google.columns):
            g = df_google[(df_google["date_start"] >= pd.Timestamp(d1))
                          & (df_google["date_start"] <= pd.Timestamp(d2))]
            sp += float(g["cost_micros"].sum()) / 1_000_000.0
            cl += float(g["clicks"].sum()); im += float(g["impressions"].sum())
        return sp, cl, im

    def _insta_semaine(d1, d2):
        if df_insta is None or df_insta.empty or "date" not in df_insta.columns:
            return None, None, 0
        dt = pd.to_datetime(df_insta["date"], errors="coerce")
        w = df_insta[(dt.dt.date >= d1) & (dt.dt.date <= d2)]
        if len(w) == 0:
            return None, None, 0
        eng = float(w["eng"].mean()) if "eng" in w.columns else None
        rch = float(w["reach"].mean()) if "reach" in w.columns else None
        return eng, rch, len(w)

    # Revenu payant par semaine : UNE seule lecture GA4 pour les 10 fenêtres.
    _rev_par_sem = {}
    _sess_par_jour = {}
    try:
        from scripts.fetch_data import fetch_ga4_insights as _fga4
        for _r in (_fga4(sb, user_id) or []):
            _d = str(_r.get("date") or "")[:10]
            if not _d:
                continue
            _sess_par_jour[_d] = _sess_par_jour.get(_d, 0) + int(_r.get("sessions") or 0)
            _m = str(_r.get("medium") or "").lower()
            if any(k in _m for k in ("cpc", "ppc", "paid")):
                _rev_par_sem[_d] = _rev_par_sem.get(_d, 0.0) + float(_r.get("revenue") or 0)
    except Exception:
        _rev_par_sem, _sess_par_jour = {}, {}

    def _revenu_semaine(d1, d2):
        if not _rev_par_sem:
            return None
        tot, j = 0.0, d1
        while j <= d2:
            tot += _rev_par_sem.get(j.isoformat(), 0.0)
            j += timedelta(days=1)
        return tot

    _BANDES = {
        "roas": [(1, "tu perds", "neg"), (2, "fragile", "warn"),
                 (3, "sain", "pos"), (None, "tu peux scaler", "pos")],
        "eng": [(1, "faible", "neg"), (3, "correct", "warn"),
                (6, "bon", "pos"), (None, "excellent", "pos")],
        "ctr": [(1, "faible", "neg"), (2, "moyen", "warn"),
                (5, "bon", "pos"), (None, "excellent", "pos")],
    }

    kpi_focus = None
    metrics_series = None
    try:
        _sems = _semaines(10)
        _pts, _lab = [], []
        _cle = _unite = _titre = _repere = None
        _sens = "up"
        for (d1, _d2) in _sems:
            _lab.append(f"{d1.day} {MONTHS_FR[d1.month]}")
        _rev_now = _revenu_semaine(*_sems[-1])
        if objectif == "ventes" and _rev_now is not None and _rev_now > 0:
            _cle, _titre, _unite = "roas", "ROAS", ""
            _repere = ("Sous 1 tu perds de l'argent. Entre 1 et 2, la pub s'autofinance "
                       "à peine. Au-dessus de 3, tu peux augmenter les budgets.")
            for (d1, d2) in _sems:
                sp, _, _ = _pub_semaine(d1, d2)
                rv = _revenu_semaine(d1, d2)
                _pts.append(round(rv / sp, 2) if (sp > 0 and rv is not None) else None)
        elif objectif == "engagement":
            _cle, _titre, _unite, _sens = "eng", "Engagement moyen", " %", "up"
            _repere = ("Part de ton audience touchée qui réagit. Sous 1 % le contenu "
                       "glisse ; au-dessus de 3 % il accroche vraiment.")
            for (d1, d2) in _sems:
                e, _, _ = _insta_semaine(d1, d2)
                _pts.append(round(e, 2) if e is not None else None)
        elif objectif == "notoriete":
            _cle, _titre, _unite = "reach", "Portée moyenne par post", ""
            _repere = ("Nombre de comptes touchés par publication. Ce qui compte n'est "
                       "pas le niveau absolu mais sa pente sur plusieurs semaines.")
            for (d1, d2) in _sems:
                _, r, _ = _insta_semaine(d1, d2)
                _pts.append(round(r) if r is not None else None)
        else:
            _cle, _titre, _unite = "ctr", "CTR publicitaire", " %"
            _repere = ("Part des gens qui cliquent après avoir vu ta pub. Sous 1 % le "
                       "message ne parle pas à l'audience visée.")
            for (d1, d2) in _sems:
                _, cl, im = _pub_semaine(d1, d2)
                _pts.append(round(cl / im * 100, 2) if im > 0 else None)

        # Toutes les metriques suivables, pour que le module soit pilotable :
        # on ne sait jamais mieux que l'utilisateur ce qu'il veut regarder ce
        # jour-la. Celle de son objectif reste celle ouverte par defaut.
        def _serie(f):
            return [f(d1, d2) for (d1, d2) in _sems]

        def _f_roas(d1, d2):
            sp, _, _ = _pub_semaine(d1, d2)
            rv = _revenu_semaine(d1, d2)
            return round(rv / sp, 2) if (sp > 0 and rv is not None) else None

        def _f_ctr(d1, d2):
            _, cl, im = _pub_semaine(d1, d2)
            return round(cl / im * 100, 2) if im > 0 else None

        def _f_cpc(d1, d2):
            sp, cl, _ = _pub_semaine(d1, d2)
            return round(sp / cl, 2) if cl > 0 else None

        def _f_eng(d1, d2):
            e, _, _ = _insta_semaine(d1, d2)
            return round(e, 2) if e is not None else None

        def _f_reach(d1, d2):
            _, r, _ = _insta_semaine(d1, d2)
            return round(r) if r is not None else None

        # LES QUATRE INDICATEURS DE REGIE SE DEDOUBLENT PAR PLATEFORME.
        #
        # « Meta + Google confondus » cachait exactement ce qu'on cherche : un
        # CTR global de 9,8 % peut etre 2 % chez l'un et 15 % chez l'autre, et
        # la moyenne ne dit pas laquelle des deux il faut aller regarder.
        #
        # LE ROAS, LUI, RESTE COMMUN, ET CE N'EST PAS UN OUBLI. Le revenu vient
        # de GA4 (`_revenu_semaine`), qui le donne par JOUR pour tout le compte
        # — sans dimension de regie. Un « ROAS Meta » se calculerait donc en
        # divisant le revenu de TOUT le compte par la seule depense Meta : un
        # chiffre faux, et flatteur. On ne le fabrique pas.
        def _par_canal(f, canal):
            return lambda d1, d2: f(d1, d2, canal)

        def _f_ctr_c(d1, d2, canal=None):
            _, cl, im = _pub_semaine(d1, d2, canal)
            return round(cl / im * 100, 2) if im > 0 else None

        def _f_cpc_c(d1, d2, canal=None):
            sp, cl, _ = _pub_semaine(d1, d2, canal)
            return round(sp / cl, 2) if cl > 0 else None

        def _f_spend_c(d1, d2, canal=None):
            sp, _, _ = _pub_semaine(d1, d2, canal)
            return round(sp, 2) if sp > 0 else None

        def _f_clics_c(d1, d2, canal=None):
            _, cl, _ = _pub_semaine(d1, d2, canal)
            return int(cl) if cl > 0 else None

        _PAR_REGIE = [
            ("ctr", "CTR", " %", "up", _f_ctr_c,
             "Part des gens qui cliquent apres avoir vu ta pub. Sous 1 % le message "
             "ne parle pas a l'audience visee."),
            ("cpc", "Coût par clic", " CHF", "down", _f_cpc_c,
             "Ce que te coûte une visite. Plus il baisse a volume egal, mieux ton "
             "ciblage et ta creation travaillent."),
            ("spend", "Dépense", " CHF", "up", _f_spend_c,
             "Ce que tu investis chaque semaine sur cette regie."),
            ("clics", "Clics", "", "up", _f_clics_c,
             "Clics sur tes publicites de cette regie."),
        ]
        _REGIES = [("meta", "Meta"), ("google", "Google")]

        _CANDIDATS = [
            ("roas", "ROAS", "", "up", _f_roas,
             "Ce que chaque franc de pub te rapporte, toutes régies confondues. "
             "Sous 1 tu perds de l'argent ; au-dessus de 3 tu peux augmenter les budgets."),
            ("eng", "Engagement moyen", " %", "up", _f_eng,
             "Part de ton audience touchee qui reagit. Sous 1 % le contenu glisse ; "
             "au-dessus de 3 % il accroche vraiment."),
            ("reach", "Portée moyenne par post", "", "up", _f_reach,
             "Nombre de comptes touches par publication. Ce qui compte n'est pas le "
             "niveau absolu mais sa pente sur plusieurs semaines."),
        ]

        def _ajoute_option(dest, ck, ct, cu, cd, cf, cr, bandes_de=None):
            pts = _serie(cf)
            reels = [v for v in pts if v is not None]
            if len(reels) < 2:
                return
            val = pts[-1] if pts[-1] is not None else reels[-1]
            prev = next((v for v in reversed(pts[:-1]) if v is not None), None)
            dest.append({
                "key": ck, "titre": ct, "unite": cu, "direction": cd,
                "valeur": val, "precedent": prev, "repere": cr,
                "points": pts,
                "bandes": [{"max": m, "label": l, "tone": t}
                           for (m, l, t) in _BANDES.get(bandes_de or ck, [])],
            })

        _options = []
        for (ck, ct, cu, cd, cf, cr) in _CANDIDATS:
            _ajoute_option(_options, ck, ct, cu, cd, cf, cr)

        # Une regie sans donnees ne produit aucune option : un compte qui n'a
        # que Meta n'aura donc jamais de rangee Google vide. C'est
        # `_ajoute_option` qui s'en charge — moins de deux points, on n'ecrit
        # rien. La cle porte la regie (`ctr:meta`) pour que l'affichage puisse
        # regrouper sans avoir a deviner.
        for _cid, _cnom in _REGIES:
            for (ck, ct, cu, cd, cf, cr) in _PAR_REGIE:
                _ajoute_option(_options, f"{ck}:{_cid}", f"{ct} {_cnom}", cu, cd,
                               _par_canal(cf, _cid), cr, bandes_de=ck)

        if _options:
            _def = next((o for o in _options if o["key"] == _cle), _options[0])
            # Les memes reperes ▲ que sur les frises par theme, mais TOUS
            # themes confondus. La courbe de la boussole est la premiere du
            # rapport : c'est la qu'on doit pouvoir relier « j'ai fait ca » a
            # « ca a bouge », pas trois sections plus bas.
            # La boussole regarde TOUS les themes : ses semaines sont celles de
            # `_sems` (10 semaines glissantes), pas celles de `_wk_idx`.
            _par_sem = {}
            for _dates in _markers.values():
                for _m in _dates:
                    try:
                        _dx = date.fromisoformat(str(_m["date"])[:10])
                    except Exception:
                        continue
                    for _j, (_a1, _a2) in enumerate(_sems):
                        if _a1 <= _dx <= _a2:
                            _par_sem.setdefault(_j, []).append(_m)
                            break
            _kmq = []
            for _j in sorted(_par_sem):
                _lot = sorted(_par_sem[_j], key=lambda m: m["date"])
                _kmq.append({
                    "i": _j,
                    "date": _lot[-1]["date"],
                    "titre": _lot[-1]["titre"] if len(_lot) == 1 else "",
                    "n": len(_lot),
                })
            kpi_focus = {
                "labels": _lab,
                "defaut": _def["key"],
                "options": _options,
                "markers": [r["i"] for r in _kmq],
                "marqueurs": _kmq,
            }

        # Les memes 10 semaines pour les quatre tuiles de lecture rapide.
        def _f_trafic(d1, d2):
            if not _sess_par_jour:
                return None
            tot, j = 0, d1
            while j <= d2:
                tot += _sess_par_jour.get(j.isoformat(), 0)
                j += timedelta(days=1)
            return tot or None

        def _f_vues(d1, d2):
            if df_insta is None or df_insta.empty or "views" not in df_insta.columns:
                return None
            dt = pd.to_datetime(df_insta["date"], errors="coerce")
            w = df_insta[(dt.dt.date >= d1) & (dt.dt.date <= d2)]
            if len(w) == 0:
                return None
            return int(pd.to_numeric(w["views"], errors="coerce").fillna(0).sum())

        def _f_clics(d1, d2):
            _, cl, _ = _pub_semaine(d1, d2)
            return int(cl) if cl > 0 else None

        metrics_series = {
            "labels": _lab,
            "trafic": _serie(_f_trafic),
            "vues": _serie(_f_vues),
            "clics": _serie(_f_clics),
            "ctr": _serie(_f_ctr),
        }

        # Ces trois-la rejoignent la boussole : un seul module pour tout suivre,
        # au lieu de tuiles qui repetaient la meme information a cote.
        if kpi_focus:
            _EXTRAS = [
                ("trafic", "Trafic (sessions)", "", metrics_series["trafic"],
                 "Visites sur ton site, tous canaux confondus (GA4)."),
                ("vues", "Vues Instagram", "", metrics_series["vues"],
                 "Vues de tes posts Instagram, semaine par semaine."),
                # `clics` global ne rejoint plus la boussole : il y vit
                # maintenant dedouble par regie (`clics:meta`, `clics:google`).
                # Il reste dans `metrics_series`, que d'autres modules lisent.
            ]
            for ck, ct, cu, pts, cr in _EXTRAS:
                reels = [v for v in pts if v is not None]
                if len(reels) < 2:
                    continue
                val = pts[-1] if pts[-1] is not None else reels[-1]
                prev = next((v for v in reversed(pts[:-1]) if v is not None), None)
                kpi_focus["options"].append({
                    "key": ck, "titre": ct, "unite": cu, "direction": "up",
                    "valeur": val, "precedent": prev, "repere": cr,
                    "points": pts, "bandes": [],
                })
    except Exception:
        kpi_focus = None
        metrics_series = None

    # Phrase de passage constat -> conseils. Sans elle, le lecteur voit des
    # chiffres puis une liste de conseils sans comprendre que les seconds
    # decoulent des premiers. Deterministe : le verdict est deja calcule, on
    # ne rappelle pas l'IA pour une phrase de liaison.
    themes_intro = None
    if themes_focus:
        _noms = [t["label"] for t in themes_focus[:3]]
        _sur = (_noms[0] if len(_noms) == 1
                else " et ".join([", ".join(_noms[:-1]), _noms[-1]]))
        # Le verdict peut compter plusieurs phrases : on ne reprend que la
        # premiere, sinon la phrase de passage devient un pave.
        _tete = (verdict or "").split(".")[0].strip()
        _quoi = "le levier" if sum(len(t["recos"]) for t in themes_focus) <= 1 else "les leviers"
        themes_intro = (f"{_tete} — voilà {_quoi} sur {_sur}."
                        if _tete else f"Voilà {_quoi} sur {_sur}.")

    # Savoir-faire de fond par thematique — se lit quand on a cinq minutes.
    # Conseils proposés semaine après semaine SANS jamais être appliqués : le
    # signal le plus honnête qu'il manque un savoir-faire, pas de la volonté.
    _recurrents = []
    try:
        _hist = (sb.table("weekly_reports").select("payload")
                 .eq("user_id", user_id).order("week_start", desc=True)
                 .limit(8).execute().data) or []
        _compte, _titre_hist = {}, {}
        for _h in _hist:
            _pl = _h.get("payload") or {}
            _vus_sem = set()
            for _tf in (_pl.get("themes_focus") or []):
                for _r in (_tf.get("recos") or []):
                    _vus_sem.add(_r.get("key")); _titre_hist[_r.get("key")] = _r.get("title")
            for _r in (_pl.get("reglages") or []):
                _vus_sem.add(_r.get("key")); _titre_hist[_r.get("key")] = _r.get("title")
            for _k in _vus_sem:
                _compte[_k] = _compte.get(_k, 0) + 1
        _faits = set()
        try:
            _faits = {r["reco_key"] for r in ((sb.table("reco_feedback").select("reco_key")
                      .eq("user_id", user_id).eq("reaction", "done").execute().data) or [])}
        except Exception:
            _faits = set()
        _recurrents = [
            {"titre": _titre_hist.get(k) or KEY_LABELS.get(k, k), "fois": n}
            for k, n in sorted(_compte.items(), key=lambda kv: -kv[1])
            if n >= 3 and k not in _faits
        ][:4]
    except Exception:
        _recurrents = []

    _bloques = []
    try:
        _bl = (sb.table("reco_feedback").select("reco_key")
               .eq("user_id", user_id).eq("reaction", "too_hard")
               .order("week_start", desc=True).limit(8).execute().data) or []
        _vus = {r["reco_key"] for r in _bl}
        # on remonte le TITRE du conseil, pas sa clé technique
        _titres = {}
        for _tf in themes_focus:
            for _r in _tf["recos"]:
                _titres[_r["key"]] = _r["title"]
        for _r in reglages:
            _titres[_r["key"]] = _r["title"]
        _bloques = [_titres.get(k, KEY_LABELS.get(k, k)) for k in _vus]
    except Exception:
        _bloques = []
    try:
        themes_tips = _themes_tips([t["label"] for t in themes_focus[:3]], _obj_txt0,
                                   bloques=_bloques + [r["titre"] for r in _recurrents])
    except Exception:
        themes_tips = []


    # ── Frise : ce qui TOURNAIT pendant ces semaines ─────────────────────────
    # Les chiffres disent ce que la semaine a donne. Ils ne disent pas ce qui
    # etait en l'air pour l'obtenir. Une campagne lancee le mercredi n'a eu que
    # la moitie de la semaine, et on lui compare pourtant des chiffres de
    # semaine pleine ; un creux de portee suivi de dix jours sans publication
    # n'est pas un probleme d'algorithme.
    #
    # Fenetre d'un AN. Une campagne dure 82 jours en mediane sur le compte
    # reel, et la saisonnalite — printemps, ete, fetes — ne se lit pas sur un
    # trimestre. L'affichage defile horizontalement et s'ouvre sur aujourd'hui ;
    # la semaine du rapport est marquee a part pour qu'on la retrouve sans
    # chercher.
    #
    # Aucune requete supplementaire : les jours ou une campagne a DEPENSE sont
    # deja en base, et ils donnent son debut et sa fin de diffusion reels —
    # mieux que des dates declarees, qui ne disent pas si elle a tourne.
    frise = None
    changements = []
    try:
        # De janvier de l'annee PRECEDENTE a fin decembre de l'annee EN COURS —
        # deux ans, et les deux bornes viennent des donnees reelles : des
        # campagnes ont demarre le 1er janvier 2025, que la fenetre glissante de
        # 365 jours coupait net, et d'autres sont programmees jusqu'a fin 2026,
        # ou l'on doit pouvoir aller regarder.
        #
        # La borne de gauche se resserre sur le premier evenement : sans ca, un
        # compte ouvert en mars afficherait quatorze mois de vide avant sa
        # premiere campagne. La borne de droite, elle, ne bouge pas : c'est le
        # futur, il est vide par nature. Ce qui suit la derniere donnee recoltee
        # est marque « a venir » a l'affichage — jamais presente comme mesure.
        _f_fin = date(today.year, 12, 31)
        _f_debut = date(today.year - 1, 1, 1)

        def _f_theme(nom):
            return name2label.get(_nrm(nom)) or None

        _camps = {}

        def _ajoute(nom, canal, jour, montant):
            if not nom or jour is None:
                return
            if not (_f_debut <= jour <= _f_fin):
                return
            c = _camps.setdefault((canal, str(nom)), {
                "nom": str(nom)[:60], "canal": canal, "theme": _f_theme(nom),
                "debut": jour, "fin": jour, "jours": set(), "depense": 0.0,
                # Le montant JOUR PAR JOUR. La frise n'en a pas besoin, le
                # registre des changements si : un budget doublé ne se voit
                # nulle part ailleurs — aucune API ne nous donne le budget.
                "parjour": {},
            })
            c["debut"] = min(c["debut"], jour)
            c["fin"] = max(c["fin"], jour)
            c["jours"].add(jour)
            c["depense"] += float(montant or 0)
            c["parjour"][jour] = c["parjour"].get(jour, 0.0) + float(montant or 0)

        if df_meta_raw is not None and not df_meta_raw.empty:
            _m = df_meta_raw.copy()
            _m["jourdt"] = pd.to_datetime(_m["date_start"], errors="coerce")
            for _r in _m.itertuples():
                if pd.isna(_r.jourdt) or float(getattr(_r, "spend", 0) or 0) <= 0:
                    continue
                _ajoute(getattr(_r, "campaign_name", None), "meta",
                        _r.jourdt.date(), getattr(_r, "spend", 0))

        if not df_google.empty and "campaign_name" in df_google.columns:
            _g = df_google.copy()
            _g["jourdt"] = pd.to_datetime(_g["date_start"], errors="coerce")
            for _r in _g.itertuples():
                _cost = float(getattr(_r, "cost_micros", 0) or 0) / 1_000_000.0
                if pd.isna(_r.jourdt) or _cost <= 0:
                    continue
                _ajoute(getattr(_r, "campaign_name", None), "google", _r.jourdt.date(), _cost)

        # ── Les dates DECLAREES dans la plateforme ────────────────────────
        # Elles ne se deduisent pas de la depense, d'ou la lecture separee. La
        # distinction qui compte : une ligne SANS end_date veut dire « declaree
        # sans date de fin » ; PAS de ligne du tout veut dire « on ne sait
        # pas ». Le premier cas s'affiche, le second reste muet.
        _declare = {}
        for _table, _canal in (("meta_campaign_config", "meta"),
                               ("google_campaign_config", "google")):
            try:
                _r = (sb.table(_table)
                      .select("campaign_name, start_date, end_date")
                      .eq("user_id", user_id).execute().data) or []
            except Exception:
                _r = []   # migration pas encore passee — la frise reste muette
            for _row in _r:
                _nom = (_row.get("campaign_name") or "").strip()
                if _nom:
                    # Meme troncature que `_ajoute` : les deux cotes doivent
                    # porter la meme forme du nom, sinon une campagne au nom
                    # long perd sa date declaree sans que rien ne le signale.
                    _declare[(_canal, str(_nom)[:60])] = {
                        "start": _row.get("start_date"),
                        "end": _row.get("end_date"),
                    }

        # Une campagne DECLAREE mais qui n'a rien depense n'existe nulle part
        # dans les insights : elle n'aurait aucune barre. C'est pourtant celle
        # qu'on veut le plus voir — elle est programmee et elle arrive.
        _deja = {(c["canal"], c["nom"]) for c in _camps.values()}
        for (_canal, _nom), _d in _declare.items():
            if (_canal, _nom) in _deja or not _d["start"]:
                continue
            try:
                _dep = date.fromisoformat(str(_d["start"])[:10])
            except ValueError:
                continue
            if not (_f_debut <= _dep <= _f_fin):
                continue
            _camps[(_canal, _nom)] = {
                "nom": str(_nom)[:60], "canal": _canal, "theme": _f_theme(_nom),
                "debut": _dep, "fin": _dep, "jours": set(), "depense": 0.0,
                "parjour": {}, "planifiee": True,
            }

        _campagnes = sorted(_camps.values(), key=lambda c: -c["depense"])

        def _sortie(c):
            out = {
                "nom": c["nom"], "canal": c["canal"], "theme": c["theme"],
                "debut": c["debut"].isoformat(), "fin": c["fin"].isoformat(),
                "jours": len(c["jours"]),
                # Un trou au milieu d'une diffusion (campagne coupee puis
                # relancee) doit se voir : sinon la barre ment sur la
                # continuite.
                "continu": len(c["jours"]) == (c["fin"] - c["debut"]).days + 1,
                "depense": round(c["depense"], 2),
            }
            if c.get("planifiee"):
                out["planifiee"] = True
            _d = _declare.get((c["canal"], c["nom"]))
            if _d is not None:
                # `None` est une VALEUR ici (« sans date de fin »), pas une
                # absence : la cle est donc toujours ecrite quand la ligne
                # existe, et jamais quand elle n'existe pas.
                out["fin_prevue"] = str(_d["end"])[:10] if _d["end"] else None
            return out

        _campagnes = [_sortie(c) for c in _campagnes]

        _pubs = []
        if not df_insta.empty and "date" in df_insta.columns:
            _i = df_insta.copy()
            _i["jourdt"] = pd.to_datetime(_i["date"], errors="coerce", utc=True)
            for _r in _i.itertuples():
                if pd.isna(_r.jourdt):
                    continue
                _dj = _r.jourdt.date()
                if not (_f_debut <= _dj <= _f_fin):
                    continue
                _lbls = getattr(_r, "labels", None) or []
                _pubs.append({
                    # La plateforme est portee explicitement, meme si une seule
                    # source existe aujourd'hui : le jour ou TikTok ou LinkedIn
                    # arrivent, la frise les distingue sans changer de format de
                    # payload — et tant qu'il n'y en a qu'une, l'affichage se
                    # rabat sur le format du post, qui lui differencie vraiment.
                    "plateforme": "instagram",
                    "date": _dj.isoformat(),
                    "theme": str(_lbls[0]) if len(_lbls) else None,
                    "type": str(getattr(_r, "type", "") or ""),
                })
        _pubs.sort(key=lambda x: x["date"])

        # Jusqu'ou chaque source est REELLEMENT a jour. Sans cette limite, une
        # barre qui s'arrete au dernier jour recolte se lit « campagne
        # terminee » alors que ce sont les donnees qui s'arretent — les canaux
        # ne se rafraichissent pas tous le meme jour. C'est la regle maison :
        # aucun chiffre non mesure presente comme mesure.
        def _dernier(df, col, utc=False):
            try:
                if df is None or df.empty or col not in df.columns:
                    return None
                _d = pd.to_datetime(df[col], errors="coerce", utc=utc).max()
                return _d.date().isoformat() if pd.notna(_d) else None
            except Exception:
                return None

        _couverture = {
            "meta": _dernier(df_meta_raw, "date_start"),
            "google": _dernier(df_google, "date_start"),
            "instagram": _dernier(df_insta, "date", utc=True),
        }

        # La borne de gauche se cale sur le premier evenement reel, sans jamais
        # depasser la semaine du rapport (qui doit rester dans le cadre).
        _premiers = [c["debut"] for c in _camps.values()]
        _premiers += [date.fromisoformat(p["date"]) for p in _pubs]
        if _premiers:
            _f_debut = max(_f_debut, min(min(_premiers), cur_since))

        # ── CE QUI A BOUGÉ SUR TES PLATEFORMES ────────────────────────────
        #
        # Le fil d'actions ne voyait que ce qu'on décide DANS Pulse. Or
        # l'essentiel se fait ailleurs : une campagne lancée un mardi soir dans
        # le gestionnaire Meta, une autre coupée, un budget doublé. Sans ça, le
        # fil raconte un tiers de l'histoire — et quand la courbe bouge, rien
        # n'explique pourquoi.
        #
        # Tout ce qui suit est DÉDUIT de la dépense quotidienne, jamais d'un
        # champ d'API : aucune plateforme ne nous dit « le budget a changé le
        # 2 août ». On écrit donc ce qu'on observe (« la dépense est passée de
        # 30 à 75 CHF par jour »), pas ce qu'on suppose (« tu as doublé le
        # budget »). C'est plus prudent et c'est plus utile : c'est la dépense
        # qui compte, pas le réglage.
        _FENETRE_CHG = 60      # jours d'historique — au-delà, ce n'est plus une nouvelle
        _SAUT = 0.6            # ±60 % de dépense quotidienne pour parler d'un saut
        _chg = []
        _borne = last_full_day - timedelta(days=_FENETRE_CHG)

        def _couv_canal(canal):
            _c = _couverture.get(canal)
            try:
                return date.fromisoformat(_c) if _c else last_full_day
            except Exception:
                return last_full_day

        for _c in _camps.values():
            _canal, _nom = _c["canal"], _c["nom"]
            _base = {"canal": _canal, "campagne": _nom, "theme": _c["theme"]}

            if _c.get("planifiee"):
                # « PROGRAMMÉE » PROMET UN ÉVÉNEMENT À VENIR. Le test ne portait
                # que sur « déclarée et n'a jamais dépensé », et ce type-là
                # échappait en plus à la fenêtre de 60 jours qui borne tous les
                # autres. Résultat vu chez un client en août 2026 : vingt lignes
                # « est programmée — aucune dépense encore », dont une campagne
                # de Noël 2025 et une campagne saisonnière 2025. Elles ne sont
                # pas programmées, elles n'ont jamais tourné — et elles
                # noyaient les trois faits de la semaine.
                #
                # Deux cas, deux phrases, et le troisième ne s'écrit pas :
                #   · début À VENIR              → elle arrive, c'est une nouvelle ;
                #   · début passé, moins de 60 j → elle devait démarrer et n'a
                #     rien dépensé : ça, c'est un problème, pas une annonce ;
                #   · début passé de plus de 60 j → rien. Ce n'est plus une
                #     nouvelle, c'est un état, et un état ne se raconte pas.
                if _c["debut"] > last_full_day:
                    _chg.append(dict(_base, date=_c["debut"].isoformat(), type="planifiee"))
                elif _c["debut"] >= _borne:
                    _chg.append(dict(_base, date=_c["debut"].isoformat(), type="jamais_lancee"))
                continue

            _jours = sorted(_c["jours"])
            if not _jours:
                continue

            if _jours[0] >= _borne:
                _chg.append(dict(_base, date=_jours[0].isoformat(), type="lancee"))

            # ARRÊTÉE : plus de dépense depuis 3 jours pleins alors que le canal,
            # lui, a des données plus récentes. Sans cette seconde condition on
            # annoncerait un arrêt à chaque fois qu'un canal prend du retard.
            _fin, _couv = _jours[-1], _couv_canal(_canal)
            if _fin >= _borne and (_couv - _fin).days >= 3:
                _chg.append(dict(_base, date=_fin.isoformat(), type="arretee"))

            # REPRISE : un trou d'au moins 3 jours refermé. On ne signale que la
            # dernière — une campagne en pointillé produirait sinon dix lignes.
            _reprise = None
            for _a, _b in zip(_jours, _jours[1:]):
                if (_b - _a).days >= 4 and _b >= _borne:
                    _reprise = (_b, (_b - _a).days - 1)
            if _reprise:
                _chg.append(dict(_base, date=_reprise[0].isoformat(), type="reprise",
                                 detail=f"après {_reprise[1]} jours d'arrêt"))

            # SAUT DE DÉPENSE : la moyenne des 7 derniers jours actifs contre les
            # 7 précédents. Sept jours de chaque côté, parce qu'un seul jour se
            # laisse emporter par un week-end.
            if len(_jours) >= 10:
                _av = [_c["parjour"].get(j, 0.0) for j in _jours[-14:-7]]
                _ap = [_c["parjour"].get(j, 0.0) for j in _jours[-7:]]
                _ma = sum(_av) / len(_av) if _av else 0.0
                _mb = sum(_ap) / len(_ap) if _ap else 0.0
                if _ma > 1 and _jours[-1] >= _borne and abs(_mb - _ma) / _ma >= _SAUT:
                    _chg.append(dict(
                        _base, date=_jours[-7].isoformat(), type="depense",
                        detail=f"{_ma:.0f} → {_mb:.0f} CHF par jour",
                    ))

        _chg.sort(key=lambda x: x["date"], reverse=True)
        changements = _chg[:40]

        if _campagnes or _pubs:
            frise = {
                "debut": _f_debut.isoformat(),
                "fin": _f_fin.isoformat(),
                "semaine_debut": cur_since.isoformat(),
                "couverture": _couverture,
                "campagnes": _campagnes,
                "posts": _pubs,
            }
    except Exception:
        frise = None
        changements = []

    return {
        "version": 2,
        "changements": changements,
        "vision": vision,
        "matrice": matrice,
        "metrics_read": metrics_read,
        "metrics_prev": metrics_prev,
        "kpi_focus": kpi_focus,
        "frise": frise,
        "metrics_series": metrics_series,
        "kpis": {
            # Chiffres bruts (l'email les met en forme) — mêmes fenêtres que Pulse
            "spend": round(total_spend + g_spend, 2),
            "clicks": _all_clicks,
            "ctr": (_all_clicks / _all_impr * 100) if _all_impr > 0 else 0.0,
            "followers_delta": followers_delta,
            "followers_total": followers_current,
        },
        "week_label": week_label,
        "since": cur_since.isoformat(),
        "until": last_full_day.isoformat(),
        "verdict": verdict,
        # Les ingredients du verdict, pour l'afficher en grand. Absents des
        # payloads deja publies → le front retombe sur la phrase seule.
        "verdict_pct": verdict_pct,
        "verdict_metric": verdict_metric,
        "verdict_tone": verdict_tone,
        "brief": brief,
        "suivi": {"applique": _n_done, "utile": _n_useful, "ecarte": _n_skip},
        "todo": [
            {"key": r["key"], "title": r["title"], "platform": r["platform"],
             "done": feedback.get(r["key"]) == "done"}
            for r in todos
        ],
        "recos": [
            {k: r.get(k) for k in (
                "key", "platform", "title", "observation", "pourquoi",
                "verifier", "repere", "angle_mort", "confidence", "priority", "source")}
            for r in sorted(insta_items + meta_items, key=lambda r: r["priority"])
        ] + ([ai_reco] if ai_reco else []),
        # Le cœur du rapport v2 : conseils regroupés PAR THÈME (cross-canal).
        "themes_focus": themes_focus,
        "themes_intro": themes_intro,
        "themes_tips": themes_tips,
        "apprentissage": {
            "bloques": _bloques,
            "recurrents": _recurrents,
            "tips": themes_tips,
        },
        "top_recos": top_recos,
        "reglages": reglages,
        "tracking": tracking,
        "themes": themes,
        "preuve": preuve,
    }


def _display_name(sb, user_id: str, fallback_email: str | None) -> str:
    """Nom pour le « Bonjour … » : compte Instagram connecté, sinon début de l'email."""
    try:
        rows = (sb.table("connected_accounts")
                .select("account_name, instagram_business_id")
                .eq("user_id", user_id).execute().data) or []
        for r in rows:
            if r.get("instagram_business_id") and r.get("account_name"):
                return r["account_name"]
    except Exception:
        pass
    return (fallback_email or "").split("@")[0] or "toi"


def publish_weekly_report(sb, user_id: str, email_to: str | None = None) -> str:
    """Construit + publie le rapport d'un utilisateur ; envoie l'email si email_to.

    L'email lit le MÊME payload que Pulse (une seule source de vérité).
    Sans RESEND_API_KEY, send_email passe en dry-run → aucun envoi, juste un log.
    """
    payload = build_payload(sb, user_id)
    if payload is None:
        return "rapport: pas de données"
    week_start = (date.today() - timedelta(days=date.today().weekday())).isoformat()
    upsert_weekly_report(sb, user_id, week_start, payload)
    log = f"rapport publié ({len(payload['recos'])} conseils)"

    if email_to:
        import os
        from emailing.render import email_from_payload
        from emailing.send import send_email
        app_url = os.getenv("EMAIL_APP_URL", "https://dashboard-analytic-green.vercel.app")
        subject, html = email_from_payload(_display_name(sb, user_id, email_to), payload, app_url)
        res = send_email(to=email_to, subject=subject, html=html)
        log += (f" · email {res['provider']}: "
                f"{'envoyé' if res['ok'] and res['provider'] != 'dry' else res['detail']}")
    return log


def _service_client():
    import os
    from supabase import create_client
    url = os.getenv("SUPABASE_URL") or secret("supabase.url")
    key = os.getenv("SUPABASE_SERVICE_KEY") or secret("supabase.service_role")
    if not url or not key:
        raise SystemExit("SUPABASE_URL / SUPABASE_SERVICE_KEY manquants (env ou secrets.toml)")
    return create_client(url, key)


if __name__ == "__main__":
    args = sys.argv[1:]
    sb = _service_client()
    if "--all" in args:
        profiles = (sb.table("profiles").select("id").execute().data) or []
        for p in profiles:
            print(f"{p['id']} → {publish_weekly_report(sb, p['id'])}")
    elif "--user" in args:
        uid = args[args.index("--user") + 1]
        if "--print" in args:
            payload = build_payload(sb, uid)
            print(json.dumps(payload, ensure_ascii=False, indent=2, default=str))
        else:
            print(publish_weekly_report(sb, uid))
    else:
        print(__doc__)
