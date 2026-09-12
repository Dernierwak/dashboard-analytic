"""La boucle entière, sans réseau : la vue → `fetch_theme_regroupement` →
`build_matrix` → `build_constats`.

Le lecteur Supabase est remplacé par un faux qui interroge le PostgreSQL local :
c'est le SEUL morceau simulé — la vue, `_all_pages`, `build_matrix` et
`build_constats` sont le code de production.
"""
import json, sys, types, pathlib
from datetime import date, timedelta

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import pg, charge, fixtures as F, t

sys.path.insert(0, str(pg.RACINE))
_faux = types.ModuleType("supabase")
_faux.Client = object
sys.modules.setdefault("supabase", _faux)


class FauxPostgREST:
    """Le strict nécessaire de l'interface `supabase.table(...)` : de quoi
    prouver que la pagination de `_all_pages` marche sur la vue."""

    def __init__(self, db, appels):
        self._db, self._appels = db, appels

    def table(self, nom):
        return _Requete(self._db, nom, self._appels)


class _Requete:
    def __init__(self, db, table, appels):
        self._db, self._table, self._appels = db, table, appels
        self._where, self._ordre, self._bornes = [], "", None

    def select(self, _cols):
        return self

    def eq(self, col, val):
        self._where.append(f"{col} = '{val}'")
        return self

    def order(self, col, desc=False):
        self._ordre = f" ORDER BY {col}" + (" DESC" if desc else "")
        return self

    def range(self, debut, fin):
        self._bornes = (debut, fin)
        return self

    def execute(self):
        if self._table != "theme_regroupement":
            raise AssertionError(f"table inattendue : {self._table}")
        ou = (" WHERE " + " AND ".join(self._where)) if self._where else ""
        limite = ""
        if self._bornes:
            d, f = self._bornes
            limite = f" LIMIT {f - d + 1} OFFSET {d}"
        sql = ("\\t\n\\a\nSELECT coalesce(json_agg(row_to_json(x)), '[]'::json) FROM ("
               f"SELECT * FROM public.theme_regroupement{ou}{self._ordre}{limite}) x;")
        self._appels.append(sql)
        lignes = [l for l in self._db.psql(sql).splitlines() if l.strip()]
        return types.SimpleNamespace(data=json.loads(lignes[-1]))


def main():
    db = pg.demarre()
    pg.remonte(db)
    db.psql("\\set ON_ERROR_STOP on\nTRUNCATE meta_ads_insights, google_ads_insights, "
            "meta_campaign_config, google_campaign_config, ga4_insights, ga4_events, "
            "theme_ga4_events, instagram_organic_posts;\n" + charge.sql())

    from saas.commun.fetch_data import fetch_theme_regroupement, VueRegroupementAbsente
    from saas.recos_ia.insights import build_matrix, build_constats, C_SEUILS

    appels: list[str] = []
    sb = FauxPostgREST(db, appels)
    lignes = fetch_theme_regroupement(sb, F.A)

    t.egal("le lecteur rend les thèmes du compte, et EUX SEULS",
           sorted(r["label"] for r in lignes),
           ["Curiosite", "E-bike", "Lifestyle", "Marque", "Newsletter"])
    t.ok("la lecture est bornée au compte demandé",
         all(f"user_id = '{F.A}'" in a for a in appels), appels)
    t.ok("la lecture est PAGINÉE (LIMIT/OFFSET) — PostgREST tronque à 1 000",
         all("LIMIT" in a and "OFFSET" in a for a in appels), appels)
    t.ok("...et ordonnée AVANT de paginer, sinon deux pages se recouvrent",
         all("ORDER BY label" in a for a in appels), appels)

    t.ok("le seuil des 100 CHF a bien quitté Python",
         "theme_spend_min" not in C_SEUILS, sorted(C_SEUILS))

    df_meta, df_goog, df_insta = charge.dataframes(F.A)
    meta_cfg, goog_cfg = charge.configs(F.A)
    veille = date.today() - timedelta(days=1)
    m = build_matrix(df_meta, df_goog, df_insta, meta_cfg, goog_cfg, None, veille, lignes)

    t.egal("`build_matrix` rend les thèmes de la vue, triés par dépense",
           [x["label"] for x in m["themes"]],
           ["Newsletter", "E-bike", "Marque", "Curiosite", "Lifestyle"])
    t.egal("...sans y toucher", m["themes"][0]["spend"], 150.0)
    t.ok("...et sans emporter `user_id` dans le payload publié",
         all("user_id" not in x for x in m["themes"]), m["themes"][0])
    t.ok("les campagnes, formats et couverture restent calculés ici",
         m["campaigns"] and m["coverage"]["campaigns_total"] > 0)
    t.egal("la couverture compte les publications étiquetées",
           m["coverage"]["posts_labeled"], 3)

    # Les constats lisent `juge`, plus un seuil écrit en clair.
    m["coverage"]["ga4"] = True
    cs = build_constats(m, {}, None)
    cles = [c["key"] for c in cs]
    t.ok("un thème SOUS le seuil ne devient jamais « ton moteur »",
         "theme_best:curiosite" not in cles, cles)
    t.ok("un thème jugé qui ne rapporte rien est signalé",
         "theme_worst:newsletter" in cles, cles)

    # Un thème passe sous le seuil : le constat doit disparaître avec lui.
    for x in m["themes"]:
        if x["label"] == "Newsletter":
            x["juge"] = False
    cles = [c["key"] for c in build_constats(m, {}, None)]
    t.ok("`juge` à False suffit à retirer le constat — le seuil n'est plus lu ailleurs",
         "theme_worst:newsletter" not in cles, cles)

    # Un revenu INCONNU n'est pas un revenu nul — même quand le compte, lui,
    # a bien une attribution GA4 ailleurs.
    inconnu = {"label": "Muet", "spend": 500.0, "clicks": 10, "impressions": 1000,
               "ctr": 1.0, "posts": 0, "reach_avg": None, "eng_avg": None,
               "revenue": None, "juge": True, "roas": None}
    m2 = dict(m, themes=[inconnu], coverage=dict(m["coverage"], ga4=True))
    cs2 = build_constats(m2, {}, None)
    cles2 = [c["key"] for c in cs2]
    t.ok("un thème au revenu INCONNU n'est jamais « dépense sans vente attribuée »",
         "theme_worst:muet" not in cles2, cles2)
    t.ok("...et sa phrase dit que le revenu est inconnu, pas qu'il est insuffisant",
         any("revenu inconnu" in c["detail"] for c in cs2 if c["kind"] == "theme_best"),
         [c["detail"] for c in cs2])

    # Le même thème, mais la vue SAIT qu'il n'a rien rapporté.
    m3 = dict(m, themes=[dict(inconnu, revenue=0.0)], coverage=dict(m["coverage"], ga4=False))
    t.ok("revenu à 0 rendu par la vue : le constat tombe, même si coverage.ga4 dit non",
         "theme_worst:muet" in [c["key"] for c in build_constats(m3, {}, None)])

    # La vue absente ne se rattrape pas par un repli.
    class SansVue:
        def table(self, _n):
            raise _erreur_postgrest("42P01")

    try:
        fetch_theme_regroupement(SansVue(), F.A)
        t.ok("vue absente → VueRegroupementAbsente", False, "aucune exception levée")
    except VueRegroupementAbsente as e:
        t.ok("vue absente → VueRegroupementAbsente, qui nomme la migration",
             "theme_regroupement.sql" in str(e), str(e))

    class Panne:
        def table(self, _n):
            raise _erreur_postgrest("08006")   # connexion perdue

    try:
        fetch_theme_regroupement(Panne(), F.A)
        t.ok("une panne réseau ne se déguise PAS en migration manquante", False, "rien levé")
    except VueRegroupementAbsente:
        t.ok("une panne réseau ne se déguise PAS en migration manquante", False,
             "lue comme une migration manquante")
    except Exception:
        t.ok("une panne réseau ne se déguise PAS en migration manquante", True)

    return t.bilan("Python lit la vue")


def _erreur_postgrest(code):
    e = RuntimeError(f"erreur {code}")
    e.code = code
    return e


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
