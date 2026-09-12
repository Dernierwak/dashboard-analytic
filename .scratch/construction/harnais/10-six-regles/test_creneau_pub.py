"""`creneau_pub` — le jour de la semaine où le clic coûte le plus cher.

Ce que ce fichier prouve : un jour ne se juge pas sur une seule occurrence
(`creneau_jours_min` = quatre semaines pleines), le repère est ce que paient les
SIX AUTRES jours réunis, la règle se place pile sur `cpc_ratio`, et son angle
mort dit pourquoi Google est dehors — on ne récolte pas la stratégie d'enchère,
et brider les horaires d'une enchère automatique la dégrade.
"""
import pulse  # noqa: F401
from t import ok, egal, bilan
from fixtures import creneau

from saas.recos_ia.reco_engine import SEUILS
from saas.recos_ia.regles_payantes import regle_creneau_pub

RATIO = SEUILS["cpc_ratio"]              # 2.0
JOURS_MIN = SEUILS["creneau_jours_min"]  # 4 occurrences
PLANCHER = SEUILS["cpc_spend_min"]       # 50 CHF sur ce jour


def semaine(cher_jour=6, cpc_cher=2.0, cpc_autres=1.0, clics=100,
            occurrences=JOURS_MIN):
    """Sept jours, dont un plus cher. Les clics sont entiers et la dépense en
    découle : le prix du clic obtenu est EXACTEMENT celui qu'on teste."""
    return [creneau(j, occurrences=occurrences, clics=clics,
                    depense=(cpc_cher if j == cher_jour else cpc_autres) * clics)
            for j in range(7)]


def test_elle_denonce_le_jour_cher():
    r = regle_creneau_pub("Été", semaine())
    ok("un conseil sort", r is not None)
    egal("clé", r["key"], "creneau_pub")
    egal("geste", r["nature"], "corriger")
    egal("preuve", r["role"], "generale")
    egal("Meta, et Meta seul", r["platform"], "meta")
    ok("le jour est nommé", "dimanche" in r["title"], r["title"])
    egal("la cible porte le THÈME et le jour", r.get("cible"), "Été:dimanche")
    ok("sans le thème, elle n'aurait que sept valeurs pour tout le compte",
       regle_creneau_pub("Hiver", semaine()).get("cible") != r.get("cible"))


def test_un_jour_ne_se_juge_pas_sur_moins_de_quatre_semaines():
    egal("trois occurrences, silence",
         regle_creneau_pub("Été", semaine(occurrences=JOURS_MIN - 1)), None)
    ok("quatre occurrences, un conseil",
       regle_creneau_pub("Été", semaine(occurrences=JOURS_MIN)) is not None)


def test_elle_se_place_pile_sur_le_ratio():
    # Six jours à 1.00 CHF, le septième juste sous puis pile au double.
    sous = regle_creneau_pub("Été", semaine(cpc_cher=RATIO - 0.01))
    egal("un centième sous le ratio, silence", sous, None)
    pile = regle_creneau_pub("Été", semaine(cpc_cher=RATIO))
    ok("au ratio exact, un conseil", pile is not None)


def test_elle_exige_de_l_argent_sur_ce_jour():
    # Un jour à 4× le prix des autres mais 49 CHF dépensés : pas assez en jeu.
    sous = regle_creneau_pub("Été", semaine(cpc_cher=1.0, cpc_autres=0.25,
                                            clics=int(PLANCHER) - 1))
    egal("un franc sous le plancher, silence", sous, None)
    pile = regle_creneau_pub("Été", semaine(cpc_cher=1.0, cpc_autres=0.25,
                                            clics=int(PLANCHER)))
    ok("au plancher exact, un conseil", pile is not None)


def test_le_repere_est_les_six_autres_jours_reunis():
    """Un seul autre jour très cher ne doit pas cacher un dimanche cher : c'est
    le TOTAL des autres qui fait le repère, pondéré par leurs clics."""
    jours = semaine(cher_jour=6, cpc_cher=2.0, cpc_autres=1.0)
    r = regle_creneau_pub("Été", jours)
    ok("le repère est dans l'observation", "1.00 CHF les autres jours" in r["observation"],
       r["observation"])
    ok("le nombre d'occurrences est dit", f"{JOURS_MIN} dimanche" in r["observation"],
       r["observation"])


def test_sans_clics_elle_se_tait():
    egal("aucun créneau", regle_creneau_pub("Été", []), None)
    egal("des lignes vides", regle_creneau_pub("Été", [{}, {}]), None)
    egal("zéro clic partout",
         regle_creneau_pub("Été", [creneau(j, clics=0, depense=10.0) for j in range(7)]),
         None)


def test_un_seul_jour_n_a_personne_a_qui_se_comparer():
    egal("un seul jour dans les données",
         regle_creneau_pub("Été", [creneau(6, clics=200, depense=800.0)]), None)


def test_l_angle_mort_dit_pourquoi_google_est_dehors():
    r = regle_creneau_pub("Été", semaine())
    ok("Google est nommé", "Google" in r["angle_mort"], r["angle_mort"])
    ok("et la raison aussi",
       "enchère" in r["angle_mort"], r["angle_mort"])
    ok("le repère déconseille de couper d'un coup",
       "Baisse-le" in r["repere"] or "coupe jamais" in r["repere"], r["repere"])


def test_c_est_le_jour_le_plus_cher_en_francs_qui_parle():
    jours = [creneau(j, occurrences=JOURS_MIN, clics=100, depense=100.0)
             for j in range(5)]
    jours.append(creneau(5, occurrences=JOURS_MIN, clics=30, depense=90.0))    # 3.00 CHF, 90
    jours.append(creneau(6, occurrences=JOURS_MIN, clics=200, depense=600.0))  # 3.00 CHF, 600
    r = regle_creneau_pub("Été", jours)
    ok("le dimanche, où il part le plus d'argent", "dimanche" in r["title"], r["title"])


for _f in list(globals().values()):
    if callable(_f) and getattr(_f, "__name__", "").startswith("test_"):
        _f()
raise SystemExit(0 if bilan("creneau_pub") else 1)
