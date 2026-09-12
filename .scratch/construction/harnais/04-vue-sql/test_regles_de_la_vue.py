"""Ce que la vue décide ELLE-MÊME, et que `build_matrix` n'exprimait pas :
la journée en cours dehors, le seuil de jugement, la conversion choisie, et
l'isolement d'un compte par la RLS.
"""
import json, sys, pathlib
from datetime import date, timedelta

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import pg, t

AUJ = date.today()
HIER = AUJ - timedelta(days=1)
U = "33333333-3333-4333-8333-333333333333"
V = "44444444-4444-4444-8444-444444444444"


def q(db, sql):
    lignes = [l for l in db.psql("\\t\n\\a\n" + sql).splitlines() if l.strip()]
    return lignes[-1]


def themes(db, user_id=U):
    sql = ("SELECT coalesce(json_agg(row_to_json(x) ORDER BY x.label), '[]'::json) "
           f"FROM public.theme_regroupement x WHERE x.user_id = '{user_id}';")
    return {r["label"]: r for r in json.loads(q(db, sql))}


def peuple(db, lignes_sql):
    db.psql("\\set ON_ERROR_STOP on\n" + "TRUNCATE meta_ads_insights, google_ads_insights, "
            "meta_campaign_config, google_campaign_config, ga4_insights, ga4_events, "
            "theme_ga4_events, instagram_organic_posts;\n" + lignes_sql)


def main():
    db = pg.demarre()
    pg.remonte(db)

    # ── 1) La journée en cours est dehors, sur les TROIS sources ─────────────
    peuple(db, f"""
    INSERT INTO meta_campaign_config VALUES ('{U}', 'C', 'T');
    INSERT INTO meta_ads_insights (user_id, date_start, campaign_name, spend, clicks, impressions)
      VALUES ('{U}', '{HIER}', 'C', 100, 10, 1000),
             ('{U}', '{AUJ}',  'C', 999, 99, 9999);
    INSERT INTO ga4_insights (user_id, date, medium, campaign, revenue)
      VALUES ('{U}', '{HIER}', 'cpc', 'C', 50),
             ('{U}', '{AUJ}',  'cpc', 'C', 5000);
    INSERT INTO instagram_organic_posts (user_id, post_id, date, labels, reach, eng)
      VALUES ('{U}', 'a', '{HIER} 12:00+02', ARRAY['T'], 100, 2.0),
             ('{U}', 'b', '{AUJ} 12:00+02',  ARRAY['T'], 9999, 99.0);
    """)
    x = themes(db)["T"]
    t.proche("la dépense du jour en cours n'entre pas", x["spend"], 100.0)
    t.proche("le revenu du jour en cours n'entre pas", x["revenue"], 50.0)
    t.egal("la publication du jour en cours n'entre pas", int(x["posts"]), 1)
    t.proche("la portée moyenne ne compte que les jours pleins", x["reach_avg"], 100.0)

    # ── 2) Le seuil de jugement, aux deux centimes qui l'encadrent ───────────
    peuple(db, f"""
    INSERT INTO meta_campaign_config VALUES ('{U}', 'Sous', 'SOUS'), ('{U}', 'Pile', 'PILE');
    INSERT INTO meta_ads_insights (user_id, date_start, campaign_name, spend, clicks, impressions)
      VALUES ('{U}', '{HIER}', 'Sous',  99.99, 1, 100),
             ('{U}', '{HIER}', 'Pile', 100.00, 1, 100);
    INSERT INTO ga4_insights (user_id, date, medium, campaign, revenue)
      VALUES ('{U}', '{HIER}', 'cpc', 'Sous', 400), ('{U}', '{HIER}', 'cpc', 'Pile', 400);
    """)
    x = themes(db)
    t.egal("99,99 CHF ne se juge pas", x["SOUS"]["juge"], False)
    t.egal("un thème non jugé n'expose AUCUN ROAS, même avec du revenu",
           x["SOUS"]["roas"], None)
    t.proche("...mais son revenu reste lisible — on sait, on ne juge pas",
             x["SOUS"]["revenue"], 400.0)
    t.egal("100,00 CHF se juge", x["PILE"]["juge"], True)
    t.proche("...et son ROAS est calculé", x["PILE"]["roas"], 4.0)

    # ── 3) La conversion choisie remplace le revenu — si elle a des francs ───
    peuple(db, f"""
    INSERT INTO meta_campaign_config VALUES
      ('{U}', 'Vente', 'VENTE'), ('{U}', 'Lead', 'LEAD'), ('{U}', 'Vue', 'VUE');
    INSERT INTO meta_ads_insights (user_id, date_start, campaign_name, spend, clicks, impressions)
      VALUES ('{U}', '{HIER}', 'Vente', 200, 1, 100),
             ('{U}', '{HIER}', 'Lead',  200, 1, 100),
             ('{U}', '{HIER}', 'Vue',   200, 1, 100);
    INSERT INTO ga4_insights (user_id, date, medium, campaign, revenue) VALUES
      ('{U}', '{HIER}', 'cpc', 'Vente', 1000),
      ('{U}', '{HIER}', 'cpc', 'Lead',  1000),
      ('{U}', '{HIER}', 'cpc', 'Vue',   1000);
    INSERT INTO ga4_events (user_id, date, campaign, event_name, event_count, event_value) VALUES
      ('{U}', '{HIER}', 'Vente', 'purchase',      3, 600),
      ('{U}', '{HIER}', 'Lead',  'generate_lead', 40,  0),
      ('{U}', '{HIER}', 'Vue',   'view_item',    99,  50);
    INSERT INTO theme_ga4_events (user_id, label, event_name, rang) VALUES
      ('{U}', 'VENTE', 'purchase',      'principal'),
      ('{U}', 'LEAD',  'generate_lead', 'principal'),
      ('{U}', 'VUE',   'view_item',     'secondaire');
    """)
    x = themes(db)
    t.proche("un principal QUI VAUT DES FRANCS remplace le revenu générique",
             x["VENTE"]["revenue"], 600.0)
    t.proche("un principal mesuré mais SANS valeur ne remplace rien",
             x["LEAD"]["revenue"], 1000.0)
    t.proche("un événement SECONDAIRE ne remplace jamais rien",
             x["VUE"]["revenue"], 1000.0)

    # ── 4) Pas de revenu ≠ revenu nul ───────────────────────────────────────
    peuple(db, f"""
    INSERT INTO meta_campaign_config VALUES ('{U}', 'A', 'MUET'), ('{V}', 'B', 'PARLANT');
    INSERT INTO meta_ads_insights (user_id, date_start, campaign_name, spend, clicks, impressions)
      VALUES ('{U}', '{HIER}', 'A', 500, 1, 100), ('{V}', '{HIER}', 'B', 500, 1, 100);
    -- Le compte V a une attribution GA4 ; le compte U n'en a aucune.
    INSERT INTO ga4_insights (user_id, date, medium, campaign, revenue)
      VALUES ('{V}', '{HIER}', 'cpc', 'Autre', 10),
             ('{U}', '{HIER}', 'organic', 'A', 9999);
    """)
    t.egal("sans attribution GA4 sur le compte : revenu INCONNU, pas zéro",
           themes(db, U)["MUET"]["revenue"], None)
    t.egal("...et donc aucun ROAS", themes(db, U)["MUET"]["roas"], None)
    t.proche("avec attribution GA4 mais rien sur CE thème : zéro, et on le sait",
             themes(db, V)["PARLANT"]["revenue"], 0.0)

    # ── 5) TOUT l'historique, pas l'année en cours ───────────────────────────
    # `build_matrix` ouvrait sa fenêtre GA4 au 1er janvier pendant que sa
    # dépense partait du premier jour connu : le ROAS d'un thème divisait donc
    # un revenu de l'année par une dépense plus ancienne. La vue prend le MÊME
    # périmètre des deux côtés — c'est la règle que le ticket 01 a posée.
    an_dernier = date(AUJ.year - 1, 6, 15)
    peuple(db, f"""
    INSERT INTO meta_campaign_config VALUES ('{U}', 'Vieille', 'ANCIEN');
    INSERT INTO meta_ads_insights (user_id, date_start, campaign_name, spend, clicks, impressions)
      VALUES ('{U}', '{an_dernier}', 'Vieille', 200, 1, 100);
    INSERT INTO ga4_insights (user_id, date, medium, campaign, revenue)
      VALUES ('{U}', '{an_dernier}', 'cpc', 'Vieille', 800);
    """)
    x = themes(db)["ANCIEN"]
    t.proche("la dépense d'avant le 1er janvier compte", x["spend"], 200.0)
    t.proche("...et SON revenu aussi — même périmètre des deux côtés", x["revenue"], 800.0)
    t.proche("...donc un ROAS qui a un sens", x["roas"], 4.0)

    # ── 6) La vue lit avec les droits de l'APPELANT ──────────────────────────
    opts = q(db, "SELECT coalesce(array_to_string(reloptions, ','), '') FROM pg_class "
                 "WHERE relname = 'theme_regroupement';")
    t.ok("la vue est bien `security_invoker`", "security_invoker=true" in opts, opts)

    return t.bilan("Les règles propres à la vue")


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
