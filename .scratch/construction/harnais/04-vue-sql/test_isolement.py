"""`security_invoker` n'est pas une décoration : sans lui, la vue montre les
chiffres de tout le monde. Ce harnais le PROUVE dans les deux sens."""
import json, sys, pathlib
from datetime import date, timedelta

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import pg, t

HIER = date.today() - timedelta(days=1)
U = "55555555-5555-4555-8555-555555555555"
V = "66666666-6666-4666-8666-666666666666"


def main():
    db = pg.demarre()
    pg.remonte(db)

    # Le décor minimal de Supabase : `auth.uid()` lit la revendication du jeton.
    db.psql(f"""\\set ON_ERROR_STOP on
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    DROP VIEW IF EXISTS public.theme_sans_invoker;
    DROP POLICY IF EXISTS p1 ON meta_ads_insights;
    DROP POLICY IF EXISTS p2 ON meta_campaign_config;
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pulse_client') THEN
        EXECUTE 'DROP OWNED BY pulse_client';
        EXECUTE 'DROP ROLE pulse_client';
      END IF;
    END $$;
    CREATE ROLE pulse_client;
    GRANT USAGE ON SCHEMA public, auth TO pulse_client;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO pulse_client;

    TRUNCATE meta_ads_insights, meta_campaign_config, ga4_insights;
    INSERT INTO meta_campaign_config VALUES ('{U}', 'CU', 'CHEZ_MOI'), ('{V}', 'CV', 'CHEZ_LUI');
    INSERT INTO meta_ads_insights (user_id, date_start, campaign_name, spend, clicks, impressions)
      VALUES ('{U}', '{HIER}', 'CU', 111, 1, 100), ('{V}', '{HIER}', 'CV', 222, 1, 100);

    -- La RLS des tables de base, dans la forme du dépôt (`a_acces` réduit ici à
    -- « chacun ses lignes » : c'est le cas que la vue doit respecter).
    ALTER TABLE meta_ads_insights     ENABLE ROW LEVEL SECURITY;
    ALTER TABLE meta_campaign_config  ENABLE ROW LEVEL SECURITY;
    CREATE POLICY p1 ON meta_ads_insights    FOR SELECT USING (auth.uid() = user_id);
    CREATE POLICY p2 ON meta_campaign_config FOR SELECT USING (auth.uid() = user_id);

    """)

    # LE TÉMOIN : la MÊME requête, mot pour mot, sans l'option. Elle est
    # fabriquée depuis le fichier de migration — pas recopiée — pour qu'elle
    # reste le témoin de la vue telle qu'elle est écrite aujourd'hui.
    corps = pg.VUE.read_text()
    corps = corps.split("CREATE VIEW public.theme_regroupement\nWITH (security_invoker = true) AS")[1]
    corps = corps.split("COMMENT ON VIEW")[0]
    db.psql("\\set ON_ERROR_STOP on\nCREATE VIEW public.theme_sans_invoker AS" + corps
            + "\nGRANT SELECT ON public.theme_sans_invoker TO pulse_client;")

    def vu_par(qui, vue):
        sql = (f"SET ROLE pulse_client; SET request.jwt.claim.sub = '{qui}'; "
               f"SELECT coalesce(json_agg(x.label ORDER BY x.label), '[]'::json) "
               f"FROM public.{vue} x;")
        lignes = [l for l in db.psql("\\t\n\\a\n" + sql).splitlines() if l.strip()]
        return json.loads(lignes[-1])

    t.egal("l'appelant ne voit QUE ses thèmes", vu_par(U, "theme_regroupement"), ["CHEZ_MOI"])
    t.egal("...et son voisin ne voit que les siens", vu_par(V, "theme_regroupement"), ["CHEZ_LUI"])
    t.egal("un appelant sans jeton ne voit rien", vu_par("", "theme_regroupement"), [])

    # LE TÉMOIN : sans l'option, la même requête rend les deux comptes.
    fuite = vu_par(U, "theme_sans_invoker")
    t.ok("sans `security_invoker`, la vue fuite — c'est bien l'option qui protège",
         sorted(fuite) == ["CHEZ_LUI", "CHEZ_MOI"], f"vu : {fuite}")

    return t.bilan("L'isolement d'un compte")


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
