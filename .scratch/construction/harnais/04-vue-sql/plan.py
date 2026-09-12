"""Combien de lignes la base lit-elle pour rendre les thèmes D'UN compte ?

La vue est lue à chaque affichage : si le filtre de l'appelant ne descend pas
jusqu'aux tables, chaque lecture parcourt la clientèle entière.
"""
import re, sys, pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import pg, t

JOURS = 120
CIBLE = "00000000-0000-4000-8000-000000000007"


def lignes_lues(db, comptes):
    """Combien de lignes des tables de fond la base touche pour rendre UN compte."""
    pg.remonte(db)
    db.psql(f"""\\set ON_ERROR_STOP on
    INSERT INTO meta_campaign_config
      SELECT ('00000000-0000-4000-8000-' || lpad(u::text, 12, '0'))::uuid, 'C' || u, 'T' || u
      FROM generate_series(1, {comptes}) u;
    INSERT INTO meta_ads_insights (user_id, date_start, campaign_name, spend, clicks, impressions)
      SELECT ('00000000-0000-4000-8000-' || lpad(u::text, 12, '0'))::uuid,
             current_date - (d || ' days')::interval, 'C' || u, 10, 1, 100
      FROM generate_series(1, {comptes}) u, generate_series(1, {JOURS}) d;
    INSERT INTO instagram_organic_posts (user_id, post_id, date, labels, reach, eng)
      SELECT ('00000000-0000-4000-8000-' || lpad(u::text, 12, '0'))::uuid,
             u || '-' || d, current_date - (d || ' days')::interval,
             ARRAY['T' || u], 100, 2
      FROM generate_series(1, {comptes}) u, generate_series(1, 20) d;
    ANALYZE;""")

    plan = db.psql("EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF) SELECT * FROM "
                   f"public.theme_regroupement WHERE user_id = '{CIBLE}';")
    return sum(int(n) for n in re.findall(
        r"Scan on (?:meta_ads_insights|instagram_organic_posts)\b[^\n]*actual rows=(\d+)", plan))


def main():
    db = pg.demarre()
    petit = lignes_lues(db, 300)
    grand = lignes_lues(db, 900)

    # LA PROPRIÉTÉ, telle quelle : le coût d'une lecture suit le compte demandé,
    # pas le nombre de comptes. Une CTE matérialisée, ou un `coalesce()` sur la
    # colonne filtrée, la casse — et ça ne se voit que le jour où il y a des
    # clients.
    t.egal("tripler la clientèle ne change pas ce que coûte la lecture d'un compte",
           grand, petit)
    t.ok(f"...et ce compte ne lit que ses propres lignes ({petit} pour 140 à lui)",
         petit < 300 * 140, f"{petit} lignes")
    print(f"  300 comptes → {petit} lignes lues · 900 comptes → {grand} lignes lues")
    return t.bilan("Le coût d'une lecture")


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
