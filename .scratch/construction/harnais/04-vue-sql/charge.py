"""Les mêmes lignes, des deux côtés : en base pour la vue, en DataFrame pour
`build_matrix`. Un seul jeu de fixtures, sinon on compare deux jeux de données
et pas deux implémentations."""
import json
import fixtures as F


def _lit(x):
    if x is None:
        return "NULL"
    if isinstance(x, bool):
        return "true" if x else "false"
    if isinstance(x, (int, float)):
        return repr(x)
    if isinstance(x, list):
        return "ARRAY[" + ",".join(_lit(v) for v in x) + "]::text[]"
    return "'" + str(x).replace("'", "''") + "'"


def _insert(table, colonnes, lignes):
    if not lignes:
        return ""
    vals = ",\n".join("(" + ",".join(_lit(v) for v in l) + ")" for l in lignes)
    return f"INSERT INTO {table} ({','.join(colonnes)}) VALUES\n{vals};\n"


def sql() -> str:
    return "".join([
        "\\set ON_ERROR_STOP on\n",
        _insert("meta_campaign_config", ["user_id", "campaign_name", "label"], F.META_CFG),
        _insert("google_campaign_config",
                ["user_id", "campaign_id", "campaign_name", "label"], F.GOOGLE_CFG),
        _insert("meta_ads_insights",
                ["user_id", "date_start", "campaign_name", "spend", "clicks", "impressions"],
                F.META_ADS),
        _insert("google_ads_insights",
                ["user_id", "date_start", "campaign_id", "cost_micros", "clicks", "impressions"],
                F.GOOGLE_ADS),
        _insert("ga4_insights",
                ["user_id", "date", "source", "medium", "campaign", "revenue"], F.GA4),
        _insert("ga4_events",
                ["user_id", "date", "campaign", "event_name", "event_count", "event_value"],
                F.GA4_EVENTS),
        _insert("theme_ga4_events", ["user_id", "label", "event_name", "rang"], F.THEME_EVENTS),
        _insert("instagram_organic_posts",
                ["user_id", "post_id", "date", "type", "labels", "reach",
                 "likes", "comments", "saved"], F.POSTS),
    ])


def vue(db, user_id) -> list[dict]:
    """Ce que la vue rend, LU COMME LE WORKER LE LIRA : filtré sur le compte."""
    q = ("\\t\n\\a\n"
         "SELECT coalesce(json_agg(row_to_json(t) ORDER BY t.label), '[]'::json) "
         f"FROM public.theme_regroupement t WHERE t.user_id = '{user_id}';")
    # psql annonce ses réglages (« Tuples only is on. ») avant de répondre :
    # la réponse est la DERNIÈRE ligne non vide, pas la sortie entière.
    lignes = [l for l in db.psql(q).splitlines() if l.strip()]
    return json.loads(lignes[-1])


# ── Le côté Python : les mêmes lignes, en DataFrame ─────────────────────────

def dataframes(user_id):
    import pandas as pd
    meta = [{"date_start": d.isoformat(), "campaign_name": c, "spend": s,
             "clicks": k, "impressions": i}
            for (u, d, c, s, k, i) in F.META_ADS if u == user_id]
    goog = [{"date_start": d.isoformat(), "campaign_id": c, "cost_micros": m,
             "clicks": k, "impressions": i}
            for (u, d, c, m, k, i) in F.GOOGLE_ADS if u == user_id]
    # LA COLONNE `eng` EST FABRIQUÉE ICI PARCE QUE `build_report` LA FABRIQUE.
    #
    # La base n'a pas cette colonne (ticket 44) — mais `build_matrix` ne lit
    # JAMAIS la base : son seul appelant de production est `build_report.py`
    # l. 2182, qui pose `df_insta["eng"]` 180 lignes plus haut (l. 1997) et
    # passe le DataFrame enrichi. Nourrir `build_matrix` sans cette colonne
    # reviendrait à comparer la vue à un chemin d'appel qui n'existe nulle
    # part : le harnais cesserait d'inventer une colonne pour inventer un
    # point d'entrée. Relevé en relecture du ticket 44.
    #
    # La formule est RECOPIÉE de `build_report.py` l. 1997-1999 telle quelle,
    # `if r["reach"] > 0 else 0` compris — c'est la version qu'on compare, pas
    # celle qu'on voudrait. `None` devient 0 comme le fait le `fillna(0)` de
    # la l. 1994.
    def _eng(r, li, co, sa):
        portee = r or 0
        return ((li or 0) + (co or 0) + (sa or 0)) / portee * 100 if portee > 0 else 0

    posts = [{"post_id": p, "date": d.isoformat() + "T12:00:00+00:00", "type": t,
              "labels": l, "reach": r, "likes": li, "comments": co, "saved": sa,
              "eng": _eng(r, li, co, sa)}
             for (u, p, d, t, l, r, li, co, sa) in F.POSTS if u == user_id]
    df_meta = pd.DataFrame(meta) if meta else None
    df_goog = pd.DataFrame(goog) if goog else pd.DataFrame()
    df_insta = pd.DataFrame(posts) if posts else None
    return df_meta, df_goog, df_insta


def configs(user_id):
    meta_cfg = {c: {"label": lb} for (u, c, lb) in F.META_CFG if u == user_id}
    goog_cfg = {c: {"campaign_name": n, "label": lb}
                for (u, c, n, lb) in F.GOOGLE_CFG if u == user_id}
    return meta_cfg, goog_cfg


def ga4_rows(user_id):
    insights = [{"date": d.isoformat(), "source": s, "medium": m, "campaign": c,
                 "revenue": r, "conversions": 0, "sessions": 0}
                for (u, d, s, m, c, r) in F.GA4 if u == user_id]
    events = [{"date": d.isoformat(), "source": "", "medium": "", "campaign": c,
               "event_name": n, "event_count": k, "event_value": v}
              for (u, d, c, n, k, v) in F.GA4_EVENTS if u == user_id]
    return insights, events


def theme_events(user_id):
    out: dict[str, list[dict]] = {}
    for (u, lb, n, rang) in F.THEME_EVENTS:
        if u == user_id:
            out.setdefault(lb, []).append({"event_name": n, "rang": rang})
    return out
