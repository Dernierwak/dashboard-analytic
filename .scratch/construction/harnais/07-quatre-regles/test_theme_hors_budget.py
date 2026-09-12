"""`theme_hors_budget` — au rythme de la semaine, le mois finira au-dessus.

Ce que ce fichier prouve : le PASSÉ n'est jamais extrapolé (seuls les jours qui
restent le sont), la règle se tait quand il n'y a pas de budget posé plutôt que
d'en inventer un à zéro, et son angle mort dit la date du relevé.
"""
import pulse  # noqa: F401
from t import ok, egal, bilan

from saas.recos_ia.reco_engine import SEUILS
from saas.recos_ia.regles_payantes import regle_theme_hors_budget

PLANCHER = SEUILS["cpc_spend_min"]   # 50 CHF sur la semaine : assez d'argent en jeu


def budget(**kw):
    """Un mois de 30 jours, 20 écoulés, 10 restants. 800 CHF posés."""
    b = {"prevu_mois": 800.0, "depense_mois": 700.0, "depense_semaine": 259.0,
         "jours_restants": 10, "jours_fenetre": 7, "releve_le": "2026-09-08"}
    b.update(kw)
    return b


def test_elle_annonce_le_depassement():
    # 700 déjà dépensés + 10 jours à 37 CHF/j = 1 070.
    r = regle_theme_hors_budget("Été", budget())
    ok("un conseil sort", r is not None)
    egal("clé", r["key"], "theme_hors_budget")
    egal("geste", r["nature"], "corriger")
    egal("preuve", r["role"], "generale")
    ok("le prévu est dans le titre", "800" in r["title"], r["title"])
    ok("la projection est dans le titre", "1'070" in r["title"] or "1,070" in r["title"]
       or "1 070" in r["title"], r["title"])


def test_seul_l_avenir_est_projete():
    """Le passé est MESURÉ. Extrapoler aussi les 20 jours écoulés à partir du
    rythme de la dernière semaine fabriquerait un chiffre là où on en a un vrai."""
    # Même rythme de semaine, mais un passé deux fois plus sage : la projection
    # doit suivre le passé RÉEL, pas le rythme appliqué à tout le mois.
    sage = regle_theme_hors_budget("Été", budget(depense_mois=400.0))
    egal("un passé sous le budget ne dépasse pas", sage, None)


def test_sans_budget_pose_elle_se_tait():
    """`prevu_mois` à 0 veut dire « aucun relevé », jamais « rien de prévu »."""
    egal("aucun budget connu", regle_theme_hors_budget("Été", budget(prevu_mois=0.0)), None)
    egal("dict vide", regle_theme_hors_budget("Été", {}), None)


def test_le_dernier_jour_du_mois_il_n_y_a_plus_rien_a_corriger():
    egal("zéro jour restant", regle_theme_hors_budget("Été", budget(jours_restants=0)), None)


def test_sous_le_plancher_de_depense_elle_se_tait():
    # Le thème ne dépasserait que de quelques francs, sur une semaine à 49 CHF.
    egal("pas assez d'argent en jeu",
         regle_theme_hors_budget("Été", budget(prevu_mois=10.0, depense_mois=9.0,
                                               depense_semaine=PLANCHER - 1)), None)
    ok("au plancher exact, un conseil",
       regle_theme_hors_budget("Été", budget(prevu_mois=10.0, depense_mois=9.0,
                                             depense_semaine=PLANCHER)) is not None)


def test_pile_sur_le_budget_ce_n_est_pas_un_depassement():
    # 700 + 10 × (350/7) = 1 200 pile.
    egal("projection égale au prévu",
         regle_theme_hors_budget("Été", budget(prevu_mois=1200.0, depense_semaine=350.0)), None)
    ok("un franc au-dessus, un conseil",
       regle_theme_hors_budget("Été", budget(prevu_mois=1199.0,
                                             depense_semaine=350.0)) is not None)


def test_l_angle_mort_date_le_releve():
    """Une photo hebdomadaire ne sait pas ce que le budget valait il y a trois
    semaines — aucune API ne le donne, et le conseil doit le dire."""
    r = regle_theme_hors_budget("Été", budget(releve_le="2026-09-08"))
    ok("la date du relevé est dite", "2026-09-08" in r["angle_mort"], r["angle_mort"])
    r = regle_theme_hors_budget("Été", budget(releve_le=None))
    ok("sans date, la limite est dite quand même",
       "aucune plateforme" in r["angle_mort"], r["angle_mort"])


def test_une_fenetre_absente_ne_divise_pas_par_zero():
    egal("zéro jour de fenêtre", regle_theme_hors_budget("Été", budget(jours_fenetre=0)), None)


if __name__ == "__main__":
    for f in list(globals().values()):
        if callable(f) and getattr(f, "__name__", "").startswith("test_"):
            f()
    raise SystemExit(0 if bilan("theme_hors_budget") else 1)
