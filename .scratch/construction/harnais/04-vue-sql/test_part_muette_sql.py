"""LA PART MUETTE D'UN THÈME, CONTRE LA VRAIE VUE ET UN VRAI POSTGRESQL.

Une campagne étiquetée dont le nom n'apparaît nulle part dans `ga4_insights`
verse sa dépense au dénominateur du ROAS sans pouvoir jamais verser son revenu
au numérateur. La vue publie désormais `spend_muette` et `campagnes_muettes`
pour que ce trou se LISE à côté du chiffre au lieu de se deviner (ticket 18).

Mesuré sur le compte de production le 2026-09-13 : 10 thèmes jugés sur 17 sont
dans ce cas, pour 48 431 CHF de dépense sur 90 515.

    python3.12 test_part_muette_sql.py
"""
import json, sys, pathlib
from datetime import date, timedelta

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import pg, t

HIER = date.today() - timedelta(days=1)
U = "55555555-5555-4555-8555-555555555555"


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

    # ── 1) Le cas de production : Google entre par l'identifiant, GA4 ne
    #      connaît pas son nom ────────────────────────────────────────────────
    #
    # « Muet » reproduit les deux campagnes PMax du compte de David : la config
    # porte un nom que GA4 n'a jamais vu. « Vu » est le témoin — sans lui le
    # compte entier serait aveugle et la vue se tairait sur tout.
    peuple(db, f"""
    INSERT INTO google_campaign_config VALUES ('{U}', '1', 'nom_inconnu_de_ga4', 'Muet');
    INSERT INTO google_ads_insights VALUES ('{U}', '{HIER}', '1', 'nom_inconnu_de_ga4', 1000, 10, 300000000);
    INSERT INTO meta_campaign_config VALUES ('{U}', 'vue', 'Vu');
    INSERT INTO meta_ads_insights VALUES ('{U}', '{HIER}', 'vue', '', 1000, 10, 200);
    INSERT INTO ga4_insights VALUES ('{U}', '{HIER}', 'g', 'cpc', 'vue', 5, 1, 500);
    """)
    th = themes(db)
    t.egal("le thème muet dépense bien 300 CHF", float(th["Muet"]["spend"]), 300.0)
    t.egal("et toute cette dépense est muette", float(th["Muet"]["spend_muette"]), 300.0)
    t.egal("une campagne muette", int(th["Muet"]["campagnes_muettes"]), 1)
    t.egal("son ROAS est publié quand même", float(th["Muet"]["roas"]), 0.0)
    t.ok("le thème publie donc un ROAS de 0 ET la raison de s'en méfier",
         th["Muet"]["roas"] is not None and float(th["Muet"]["spend_muette"]) > 0)

    t.egal("le thème rattachable n'a rien de muet", float(th["Vu"]["spend_muette"]), 0.0)
    t.egal("aucune campagne muette non plus", int(th["Vu"]["campagnes_muettes"]), 0)

    # ── 2) Un nom connu de GA4 qui n'a rien rapporté n'est PAS muet ──────────
    #
    # LA DISTINCTION QUI PORTE LE TICKET. Un ROAS de 0 sur un nom que GA4 suit
    # est un vrai résultat ; un ROAS de 0 sur un nom que GA4 ignore n'est pas un
    # résultat du tout.
    peuple(db, f"""
    INSERT INTO meta_campaign_config VALUES ('{U}', 'suivie', 'Suivie');
    INSERT INTO meta_ads_insights VALUES ('{U}', '{HIER}', 'suivie', '', 1000, 10, 200);
    INSERT INTO ga4_insights VALUES ('{U}', '{HIER}', 'g', 'cpc', 'suivie', 5, 0, 0);
    """)
    th = themes(db)
    t.egal("rien de muet malgré un revenu nul", float(th["Suivie"]["spend_muette"]), 0.0)
    t.egal("et un ROAS de 0 qui, lui, veut dire quelque chose",
           float(th["Suivie"]["roas"]), 0.0)

    # ── 3) UN NOM VU EN ORGANIQUE EST RATTACHABLE ───────────────────────────
    #
    # La question posée par `spend_muette` n'est pas « ce nom a-t-il rapporté ? »
    # mais « ce nom existe-t-il pour Google Analytics ? ». Le filtre `medium`
    # appartient au revenu, pas à l'existence : c'est pour ça que la CTE
    # `noms_ga4_connus` n'en porte pas.
    peuple(db, f"""
    INSERT INTO meta_campaign_config VALUES ('{U}', 'orga', 'Orga');
    INSERT INTO meta_ads_insights VALUES ('{U}', '{HIER}', 'orga', '', 1000, 10, 200);
    INSERT INTO ga4_insights VALUES ('{U}', '{HIER}', 'g', 'organic', 'orga', 5, 0, 0);
    INSERT INTO meta_campaign_config VALUES ('{U}', 'payante', 'Payante');
    INSERT INTO meta_ads_insights VALUES ('{U}', '{HIER}', 'payante', '', 1000, 10, 200);
    INSERT INTO ga4_insights VALUES ('{U}', '{HIER}', 'g', 'cpc', 'payante', 5, 1, 50);
    """)
    th = themes(db)
    t.egal("un nom vu en organique n'est pas muet", float(th["Orga"]["spend_muette"]), 0.0)
    t.egal("son revenu PAYANT reste nul pour autant", float(th["Orga"]["revenue"]), 0.0)

    # ── 4) LA CASSE NE REND PAS UNE CAMPAGNE MUETTE ─────────────────────────
    #
    # `CH_DE_PMax_Herbst_2026` dans Google Ads, `ch_de_pmax_herbst_2026` dans
    # GA4 : c'est le cas réel du compte de David. Les deux côtés normalisent en
    # `lower(btrim(...))`, exactement comme `_nrm` en Python.
    peuple(db, f"""
    INSERT INTO google_campaign_config VALUES ('{U}', '2', '  CH_DE_PMax_Herbst_2026 ', 'Casse');
    INSERT INTO google_ads_insights VALUES ('{U}', '{HIER}', '2', 'CH_DE_PMax_Herbst_2026', 1000, 10, 300000000);
    INSERT INTO ga4_insights VALUES ('{U}', '{HIER}', 'g', 'cpc', 'ch_de_pmax_herbst_2026', 5, 1, 352);
    """)
    th = themes(db)
    t.egal("la casse et les espaces ne rendent rien muet",
           float(th["Casse"]["spend_muette"]), 0.0)
    t.egal("et le revenu rentre", float(th["Casse"]["revenue"]), 352.0)

    # ── 5) SANS RÉPONSE DE GA4 SUR LE COMPTE, ON NE DIT RIEN ────────────────
    #
    # Annoncer « 0 CHF non rattachable » y affirmerait que tout est rattaché —
    # l'inverse de la vérité (CLAUDE.md §7). Même règle que `revenue`.
    peuple(db, f"""
    INSERT INTO meta_campaign_config VALUES ('{U}', 'seule', 'Aveugle');
    INSERT INTO meta_ads_insights VALUES ('{U}', '{HIER}', 'seule', '', 1000, 10, 200);
    """)
    th = themes(db)
    t.egal("pas de revenu", th["Aveugle"]["revenue"], None)
    t.egal("pas de ROAS", th["Aveugle"]["roas"], None)
    t.egal("et pas de part muette annoncée", th["Aveugle"]["spend_muette"], None)
    t.egal("ni de compte de campagnes muettes", th["Aveugle"]["campagnes_muettes"], None)

    # ── 6) LA DÉPENSE PUBLIÉE N'EST JAMAIS AMPUTÉE ──────────────────────────
    #
    # L'option « écarter cette dépense du dénominateur » a été écartée : elle
    # remplaçait un ROAS écrasé par une dépense fausse. `spend_muette` est DANS
    # `spend`, elle ne s'en retranche pas.
    peuple(db, f"""
    INSERT INTO meta_campaign_config VALUES ('{U}', 'connue', 'Mixte');
    INSERT INTO meta_ads_insights VALUES ('{U}', '{HIER}', 'connue', '', 1000, 10, 600);
    INSERT INTO ga4_insights VALUES ('{U}', '{HIER}', 'g', 'cpc', 'connue', 5, 1, 300);
    INSERT INTO meta_campaign_config VALUES ('{U}', 'ignoree', 'Mixte');
    INSERT INTO meta_ads_insights VALUES ('{U}', '{HIER}', 'ignoree', '', 1000, 10, 400);
    """)
    th = themes(db)
    t.egal("la dépense est la somme des deux", float(th["Mixte"]["spend"]), 1000.0)
    t.egal("dont 400 muets", float(th["Mixte"]["spend_muette"]), 400.0)
    t.egal("une seule campagne muette sur deux", int(th["Mixte"]["campagnes_muettes"]), 1)
    t.egal("le ROAS divise par la dépense ENTIÈRE", float(th["Mixte"]["roas"]), 0.30)

    return t.bilan("La part muette, en SQL")


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
