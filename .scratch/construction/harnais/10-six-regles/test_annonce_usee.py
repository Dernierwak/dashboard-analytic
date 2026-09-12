"""`annonce_usee` — une créa trop revue, et son clic qui monte.

Ce que ce fichier prouve, et c'est le piège que le ticket 10 nommait d'avance :
`reach` compte des personnes DÉDOUBLONNÉES et deux jours de portée ne
s'additionnent pas. La règle ne calcule donc PAS la fréquence hebdomadaire —
elle calcule un PLANCHER de fréquence (impressions ÷ somme des portées
quotidiennes), toujours plus petit que la vraie. Elle se tait donc plus souvent
qu'elle ne le devrait, jamais l'inverse : c'est ce qu'on vérifie ici.

Prouve aussi que la fréquence SEULE ne déclenche rien — sans un prix du clic qui
monte, une audience volontairement étroite se ferait dénoncer pour rien.
"""
import pulse  # noqa: F401
from t import ok, egal, proche, bilan
from fixtures import usure

from saas.recos_ia.reco_engine import SEUILS
from saas.recos_ia.regles_payantes import regle_annonce_usee

FREQ = SEUILS["freq_plancher"]       # 2.5 vues par personne
HAUSSE = SEUILS["freq_cpc_hausse"]   # +20 % sur le prix du clic
PLANCHER = SEUILS["cpc_spend_min"]   # 50 CHF dépensés


def usee(**kw):
    """Une annonce usée par défaut : plancher de fréquence à 3.0, clic +50 %."""
    base = dict(cle="meta:1", nom="Video 1", impressions=30_000,
                portee_cumul=10_000.0, clics=100, depense=150.0, cpc_avant=1.0)
    base.update(kw)
    return usure(**base)


def test_elle_denonce_l_annonce_usee():
    r = regle_annonce_usee("Été", [usee()])
    ok("un conseil sort", r is not None)
    egal("clé", r["key"], "annonce_usee")
    egal("geste", r["nature"], "créer")
    egal("preuve", r["role"], "generale")
    egal("Meta, et Meta seul", r["platform"], "meta")
    ok("l'annonce est nommée", "Video 1" in r["title"], r["title"])
    ok("la fréquence est dans le titre", "3.0" in r["title"], r["title"])


def test_le_chiffre_annonce_est_un_PLANCHER_et_le_dit():
    """30 000 impressions ÷ 10 000 de portées SOMMÉES = 3.0. La vraie fréquence
    hebdomadaire est plus haute, parce que la somme compte plusieurs fois qui
    revient. La règle doit dire « au moins », et son angle mort doit l'expliquer."""
    r = regle_annonce_usee("Été", [usee()])
    ok("le titre dit « au moins »", "au moins" in r["title"], r["title"])
    ok("l'observation aussi", "au moins" in r["observation"], r["observation"])
    ok("l'angle mort nomme le MINIMUM",
       "MINIMUM" in r["angle_mort"] and "quotidiennes" in r["angle_mort"],
       r["angle_mort"])


def test_elle_se_place_pile_sur_la_frequence():
    # portée sommée choisie pour tomber pile : 30 000 / 2.5 = 12 000.
    pile = regle_annonce_usee("Été", [usee(portee_cumul=30_000 / FREQ)])
    ok("à la fréquence exacte, un conseil", pile is not None)
    sous = regle_annonce_usee("Été", [usee(portee_cumul=30_000 / FREQ + 1)])
    egal("une personne de plus au dénominateur, silence", sous, None)


def test_elle_se_place_pile_sur_la_hausse_du_clic():
    """CPC de la semaine = 150/100 = 1.50 CHF."""
    pile = regle_annonce_usee("Été", [usee(cpc_avant=1.50 / HAUSSE)])
    ok("à la hausse exacte, un conseil", pile is not None)
    sous = regle_annonce_usee("Été", [usee(cpc_avant=1.50 / HAUSSE + 0.01)])
    egal("un centième de hausse en moins, silence", sous, None)


def test_la_frequence_seule_ne_suffit_pas():
    """Une audience volontairement étroite tourne haut en fréquence et marche
    très bien. C'est la fatigue qu'on cherche, pas le retargeting."""
    egal("clic stable malgré la fréquence",
         regle_annonce_usee("Été", [usee(cpc_avant=1.50)]), None)
    egal("clic qui DESCEND malgré la fréquence",
         regle_annonce_usee("Été", [usee(cpc_avant=3.0)]), None)


def test_sans_semaine_d_avant_elle_se_tait():
    """Sans point de comparaison, on ne sait pas si le clic MONTE."""
    egal("cpc_avant absent", regle_annonce_usee("Été", [usee(cpc_avant=None)]), None)
    egal("cpc_avant à zéro", regle_annonce_usee("Été", [usee(cpc_avant=0.0)]), None)


def test_une_portee_absente_n_est_pas_une_portee_nulle():
    """Sans portée sommée, pas de fréquence — et une fréquence supposée serait
    un chiffre fabriqué (`CLAUDE.md` §7)."""
    egal("portée à zéro", regle_annonce_usee("Été", [usee(portee_cumul=0.0)]), None)


def test_les_gardes_de_couper_valent_aussi_ici():
    egal("campagne jeune", regle_annonce_usee("Été", [usee(jeune=True)]), None)
    egal("sous le plancher de dépense",
         regle_annonce_usee("Été", [usee(depense=PLANCHER - 1, clics=100,
                                         cpc_avant=0.1)]), None)


def test_c_est_l_annonce_la_plus_chere_qui_parle():
    r = regle_annonce_usee("Été", [
        usee(cle="meta:1", nom="Petite", depense=60.0, clics=40),
        usee(cle="meta:2", nom="Grosse", depense=600.0, clics=400),
    ])
    ok("la plus grosse dépense", "Grosse" in r["title"], r["title"])


def test_elle_designe_l_annonce_et_son_groupe():
    r = regle_annonce_usee("Été", [usee(groupe="Groupe B")])
    egal("l'Annonce désignée", r.get("_annonce"), "meta:1")
    egal("son Groupe, pour l'arbitrage", r.get("_groupe"), ("meta", "Groupe B"))
    egal("la cible", r.get("cible"), "meta:1")
    ok("le Groupe est nommé dans le geste", "Groupe B" in r["verifier"], r["verifier"])


def test_sans_groupe_connu_le_geste_reste_lisible():
    r = regle_annonce_usee("Été", [usee(groupe="")])
    ok("un conseil sort quand même", r is not None)
    ok("aucun Groupe vide affiché", "« »" not in r["verifier"], r["verifier"])
    egal("aucun Groupe désigné", r.get("_groupe"), None)


def test_le_repere_dit_les_nombres_du_metier():
    r = regle_annonce_usee("Été", [usee()])
    ok("2,5 et 4 sont dans le repère",
       "2,5" in r["repere"] and "4" in r["repere"], r["repere"])
    proche("le seuil du code est bien 2,5", FREQ, 2.5)


for _f in list(globals().values()):
    if callable(_f) and getattr(_f, "__name__", "").startswith("test_"):
        _f()
raise SystemExit(0 if bilan("annonce_usee") else 1)
