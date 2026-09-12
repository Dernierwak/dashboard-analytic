"""LA vérification qui compte : la vue rend EXACTEMENT ce que `build_matrix`
rendait, sur les mêmes lignes.

`build_matrix` est chargée depuis le COMMIT D'ORIGINE, pas depuis le fichier de
travail : comparer la vue au code qu'on vient de modifier ne prouverait rien.

Ce commit est NOMMÉ, il n'est plus `HEAD`. Tant que le ticket 04 n'était pas
commité, `HEAD` PORTAIT la version d'origine ; depuis `319dca0`, `HEAD` porte la
nouvelle — le harnais se comparait donc à lui-même et tombait sur
`TypeError: build_matrix() got an unexpected keyword argument 'theme_events'`.
La référence est le parent de ce commit, et elle ne bougera plus.
"""

ORIGINE = "319dca0~1"   # le dernier état de `insights.py` AVANT que la vue existe
import importlib.util, json, subprocess, sys, tempfile, pathlib, types
from datetime import date, timedelta

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import pg, charge, fixtures as F, t

RACINE = pg.RACINE
sys.path.insert(0, str(RACINE))

# `supabase/` À LA RACINE DU DÉPÔT EST UN DOSSIER DE MIGRATIONS, pas le paquet
# Python du même nom : dès que la racine entre dans `sys.path`, elle masque le
# vrai paquet. Les modules qu'on charge ici n'en veulent que l'annotation de
# type `Client` — on la leur donne, et aucune connexion n'est ouverte nulle part.
_faux = types.ModuleType("supabase")
_faux.Client = object
_faux.create_client = lambda *a, **k: None
sys.modules.setdefault("supabase", _faux)


def build_matrix_d_origine():
    """La version de `build_matrix` telle qu'elle était AVANT ce ticket."""
    src = subprocess.check_output(
        ["git", "show", f"{ORIGINE}:saas/recos_ia/insights.py"], cwd=RACINE).decode()
    d = pathlib.Path(tempfile.mkdtemp())
    f = d / "insights_origine.py"
    f.write_text(src)
    spec = importlib.util.spec_from_file_location("insights_origine", f)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.build_matrix


def ga4_contexte(user_id, last_full_day):
    """Le vrai `build_ga4_context`, sur les fixtures — ses deux lectures Supabase
    sont remplacées, le reste est le code de production."""
    from saas.collecte.ga4 import ga4 as mod
    insights, events = charge.ga4_rows(user_id)
    mod.db_fetch_ga4 = lambda sb, uid: insights
    mod.db_fetch_ga4_events = lambda sb, uid: events
    return mod.build_ga4_context(None, user_id, date(F.ANNEE, 1, 1), last_full_day)


def themes_python(user_id, build_matrix):
    df_meta, df_goog, df_insta = charge.dataframes(user_id)
    meta_cfg, goog_cfg = charge.configs(user_id)
    last_full_day = date.today() - timedelta(days=1)
    m = build_matrix(df_meta, df_goog, df_insta, meta_cfg, goog_cfg,
                     ga4_contexte(user_id, last_full_day), last_full_day,
                     theme_events=charge.theme_events(user_id))
    return {x["label"]: x for x in (m or {}).get("themes", [])}


# ── LES DEUX ÉCARTS VOULUS, DÉCLARÉS ICI PLUTÔT QUE TOLÉRÉS ────────────────
#
# Le thème « E-bike » porte TROIS campagnes dont le nom d'UTM se normalise
# pareil (« Ete_Velo » chez Meta, « ETE_VELO » chez Meta, « Ete_Velo » chez
# Google), et Google Analytics lui attribue 400 CHF sous « Ete_Velo » + 120 CHF
# sous « ete_velo ».
#
#  · `build_matrix` : `rev_by_name = {_norm(k): v for …}` écrase la première
#    orthographe par la seconde → 120 CHF retenus, 400 PERDUS ; puis ces 120 CHF
#    sont donnés à CHACUNE des trois campagnes et additionnés → 360 CHF.
#  · la vue : 400 + 120 = 520 CHF attribués à ce nom, comptés UNE fois → 520 CHF.
#
# Les deux corrections vont dans le même sens : ne rien perdre, ne rien
# fabriquer (CLAUDE.md §7). Elles sont écrites ici pour qu'un changement futur
# de ces chiffres fasse ROUGIR le harnais au lieu de passer inaperçu.
ECARTS_VOULUS = {
    ("E-bike", "revenue"): (520.00, 360.00),
    ("E-bike", "roas"):    (3.52,   2.44),
}


def main():
    db = pg.demarre()
    pg.remonte(db)
    db.psql(charge.sql())
    build_matrix = build_matrix_d_origine()

    for compte, nom in ((F.A, "compte avec GA4"), (F.B, "compte sans GA4")):
        vue = {r["label"]: r for r in charge.vue(db, compte)}
        py = themes_python(compte, build_matrix)

        t.egal(f"[{nom}] les MÊMES thèmes, ni un de plus ni un de moins",
               sorted(vue), sorted(py))

        for lbl in sorted(set(vue) & set(py)):
            v, p = vue[lbl], py[lbl]
            t.proche(f"[{nom}] {lbl} · spend", v["spend"], p["spend"])
            t.egal(f"[{nom}] {lbl} · clicks", int(v["clicks"]), int(p["clicks"]))
            t.proche(f"[{nom}] {lbl} · ctr", v["ctr"], p["ctr"])
            for champ in ("revenue", "roas"):
                attendu = ECARTS_VOULUS.get((lbl, champ))
                if attendu:
                    t.proche(f"[{nom}] {lbl} · {champ} — écart VOULU, côté vue",
                             v[champ], attendu[0])
                    t.proche(f"[{nom}] {lbl} · {champ} — écart VOULU, côté Python",
                             p[champ], attendu[1])
                else:
                    t.proche(f"[{nom}] {lbl} · {champ}", v[champ], p[champ])
            t.egal(f"[{nom}] {lbl} · posts", int(v["posts"]), int(p["posts"]))
            t.proche(f"[{nom}] {lbl} · reach_avg", v["reach_avg"], p["reach_avg"])
            # `round()` de Python travaille sur un flottant et penche vers le
            # pair (4,125 → 4,12) ; `round()` de PostgreSQL travaille sur un
            # `numeric` exact et arrondit au supérieur (4,13). L'écart ne peut
            # dépasser un centième, et c'est la version SQL qui est juste.
            t.proche(f"[{nom}] {lbl} · eng_avg", v["eng_avg"], p["eng_avg"])
            # `juge` n'existait pas en Python : le seuil y était écrit en clair.
            t.egal(f"[{nom}] {lbl} · juge = le seuil des 100 CHF",
                   bool(v["juge"]), float(p["spend"]) >= 100.0)

        print(f"\n— {nom} —")
        for lbl in sorted(set(vue) | set(py)):
            print(f"  {lbl:12} vue={json.dumps(vue.get(lbl), default=str)}")
            print(f"  {'':12} py ={json.dumps(py.get(lbl), default=str)}")

    return t.bilan("Vue SQL vs build_matrix d'origine")


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
