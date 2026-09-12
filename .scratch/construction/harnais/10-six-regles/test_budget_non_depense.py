"""`budget_non_depense` — un budget posé que la campagne ne dépense pas.

Ce que ce fichier prouve : le seuil est bien celui de David (« 2 fois la dépense
moyenne », donc `cpc_ratio` lu à l'envers), l'argent qui dort doit peser au moins
`cpc_spend_min` sur la fenêtre, une campagne sans budget posé ne se lit pas comme
un budget de zéro, et le relevé est daté dans l'angle mort.
"""
import pulse  # noqa: F401
from t import ok, egal, bilan
from fixtures import campagne_budget

from saas.recos_ia.reco_engine import SEUILS
from saas.recos_ia.regles_payantes import regle_budget_non_depense

RATIO = SEUILS["cpc_ratio"]            # 2.0 — « c'est 2 fois plus que la dépense »
PLANCHER = SEUILS["cpc_spend_min"]     # 50 CHF qui dorment sur la fenêtre


def test_elle_denonce_le_budget_qui_dort():
    r = regle_budget_non_depense("Été", [
        campagne_budget("Retargeting été", pose_jour=25.0, depense_jour=9.0)])
    ok("un conseil sort", r is not None)
    egal("clé", r["key"], "budget_non_depense")
    egal("geste", r["nature"], "corriger")
    egal("preuve — ça se constate demain", r["role"], "generale")
    ok("les deux chiffres sont dans le titre",
       "25" in r["title"] and "9" in r["title"], r["title"])
    ok("la campagne est nommée", "Retargeting été" in r["title"], r["title"])


def test_elle_se_place_pile_sur_le_double():
    """Sous le double, le budget posé décrit encore à peu près la réalité."""
    sous = regle_budget_non_depense("Été", [
        campagne_budget("A", pose_jour=10.0 * RATIO - 0.01, depense_jour=10.0)])
    egal("un centième sous le double, silence", sous, None)
    pile = regle_budget_non_depense("Été", [
        campagne_budget("A", pose_jour=10.0 * RATIO, depense_jour=10.0)])
    ok("au double exact, un conseil", pile is not None)


def test_elle_se_place_pile_sur_le_plancher_d_argent_endormi():
    """(posé − dépensé) × jours doit valoir au moins `cpc_spend_min`."""
    # 7 jours : il faut (posé − dépensé) ≥ 50/7 ≈ 7.143 CHF/jour.
    sous = regle_budget_non_depense("Été", [
        campagne_budget("A", pose_jour=(PLANCHER - 1) / 7, depense_jour=0.0, jours=7)])
    egal("un franc sous le plancher, silence", sous, None)
    pile = regle_budget_non_depense("Été", [
        campagne_budget("A", pose_jour=PLANCHER / 7, depense_jour=0.0, jours=7)])
    ok("au plancher exact, un conseil", pile is not None)


def test_une_campagne_qui_ne_depense_rien_du_tout_parle():
    """C'est le cas le plus utile : 25 CHF/jour réservés, zéro dépensé. Le test
    `posé ≥ 2 × dépensé` ne doit pas se dérober sur une division par zéro."""
    r = regle_budget_non_depense("Été", [
        campagne_budget("Muette", pose_jour=25.0, depense_jour=0.0)])
    ok("zéro dépensé, un conseil", r is not None)


def test_sans_budget_pose_elle_se_tait():
    egal("pose_jour à zéro", regle_budget_non_depense("Été", [
        campagne_budget("A", pose_jour=0.0, depense_jour=0.0)]), None)
    egal("aucune campagne", regle_budget_non_depense("Été", []), None)
    egal("des lignes vides", regle_budget_non_depense("Été", [{}, {}]), None)


def test_zero_jour_de_fenetre_ne_produit_rien():
    egal("jours à zéro", regle_budget_non_depense("Été", [
        campagne_budget("A", pose_jour=100.0, depense_jour=0.0, jours=0)]), None)


def test_c_est_la_campagne_ou_dort_le_plus_d_argent_qui_parle():
    r = regle_budget_non_depense("Été", [
        campagne_budget("Petite", pose_jour=20.0, depense_jour=1.0),
        campagne_budget("Grosse", pose_jour=200.0, depense_jour=10.0),
    ])
    ok("la plus grosse somme endormie", "Grosse" in r["title"], r["title"])


def test_l_angle_mort_date_le_releve():
    r = regle_budget_non_depense("Été", [
        campagne_budget("A", pose_jour=25.0, depense_jour=1.0,
                        releve_le="2026-09-08")])
    ok("la date du relevé est dite", "2026-09-08" in r["angle_mort"], r["angle_mort"])
    sans = regle_budget_non_depense("Été", [
        campagne_budget("A", pose_jour=25.0, depense_jour=1.0, releve_le=None)])
    ok("sans relevé, aucune date inventée",
       "2026" not in sans["angle_mort"], sans["angle_mort"])


def test_elle_porte_sa_cible():
    r = regle_budget_non_depense("Été", [
        campagne_budget("Retargeting été", canal="meta", pose_jour=25.0,
                        depense_jour=1.0)])
    egal("la cible nomme le canal ET la campagne",
         r.get("cible"), "meta:Retargeting été")


for _f in list(globals().values()):
    if callable(_f) and getattr(_f, "__name__", "").startswith("test_"):
        _f()
raise SystemExit(0 if bilan("budget_non_depense") else 1)
