"""`page_arrivee_muette` — les clics payés que Google Analytics ne voit pas.

Ce que ce fichier prouve : `sessions=None` (GA4 muet) n'est jamais lu comme zéro
session, la règle exige assez de clics pour juger un taux, elle se place pile sur
`arrivee_perte_max`, et — c'est la limite que le ticket 10 nommait d'avance —
elle ne prétend JAMAIS dire QUELLE page perd les gens : aucune dimension de page
n'est récoltée côté GA4.
"""
import pulse  # noqa: F401
from t import ok, egal, bilan

from saas.recos_ia.reco_engine import SEUILS
from saas.recos_ia.regles_payantes import regle_page_arrivee_muette

PERTE = SEUILS["arrivee_perte_max"]        # 0.5 — GA4 sous la moitié des clics
CLICS_MIN = SEUILS["funnel_views_min"]     # 50 observations pour juger un taux
DEPENSE_MIN = SEUILS["cpc_spend_min"]      # 50 CHF en jeu


def arrivee(**kw):
    base = {"clics": 640, "sessions": 180, "depense": 900.0}
    base.update(kw)
    return base


def test_elle_denonce_l_ecart():
    r = regle_page_arrivee_muette("Été", arrivee())
    ok("un conseil sort", r is not None)
    egal("clé", r["key"], "page_arrivee_muette")
    egal("geste", r["nature"], "corriger")
    egal("preuve", r["role"], "generale")
    ok("les deux chiffres sont dans le titre",
       "640" in r["title"] and "180" in r["title"], r["title"])


def test_ga4_muet_n_est_pas_zero_session():
    """Une absence de mesure n'est pas un zéro (`CLAUDE.md` §7) : sans réponse de
    GA4, la règle ne peut pas accuser un tracking qu'elle n'a pas interrogé."""
    egal("sessions à None", regle_page_arrivee_muette("Été", arrivee(sessions=None)), None)
    egal("dict vide", regle_page_arrivee_muette("Été", {}), None)
    egal("None", regle_page_arrivee_muette("Été", None), None)


def test_zero_session_mesuree_parle_bien():
    """Zéro session MESURÉE, elle, est le signal le plus fort qui soit."""
    ok("zéro session, un conseil",
       regle_page_arrivee_muette("Été", arrivee(sessions=0)) is not None)


def test_elle_se_place_pile_sur_la_perte():
    # 640 clics : la moitié fait 320.
    egal("pile à la moitié, silence",
         regle_page_arrivee_muette("Été", arrivee(sessions=int(640 * PERTE))), None)
    ok("une session de moins, un conseil",
       regle_page_arrivee_muette("Été", arrivee(sessions=int(640 * PERTE) - 1))
       is not None)


def test_elle_exige_assez_de_clics_pour_juger_un_taux():
    egal("un clic sous le plancher d'observations",
         regle_page_arrivee_muette("Été", arrivee(clics=CLICS_MIN - 1, sessions=0)),
         None)
    ok("au plancher exact, un conseil",
       regle_page_arrivee_muette("Été", arrivee(clics=CLICS_MIN, sessions=0))
       is not None)


def test_elle_exige_de_l_argent_en_jeu():
    egal("un franc sous le plancher de dépense",
         regle_page_arrivee_muette("Été", arrivee(depense=DEPENSE_MIN - 1)), None)
    ok("au plancher exact, un conseil",
       regle_page_arrivee_muette("Été", arrivee(depense=DEPENSE_MIN)) is not None)


def test_elle_ne_nomme_jamais_une_page():
    """La limite écrite d'avance par le ticket 10 : GA4 n'a aucune dimension de
    page dans ce qu'on récolte. Nommer une page serait un chiffre fabriqué."""
    r = regle_page_arrivee_muette("Été", arrivee())
    ok("l'angle mort le dit en clair",
       "QUELLE page" in r["angle_mort"], r["angle_mort"])
    texte = " ".join(str(r.get(c) or "") for c in
                     ("title", "observation", "pourquoi", "verifier", "repere"))
    ok("aucune URL n'est affichée", "http" not in texte and ".ch/" not in texte,
       texte[:200])


def test_le_pourquoi_donne_le_repere_documente():
    """10 à 20 % d'écart est normal, au-dessus de 30 % Google parle lui-même d'un
    problème technique. Le client doit lire ces nombres, sinon « 640 contre 180 »
    ne lui dit pas si c'est grave."""
    r = regle_page_arrivee_muette("Été", arrivee())
    ok("10 à 20 % dans le pourquoi", "10 à 20" in r["pourquoi"], r["pourquoi"])
    ok("30 % dans le repère", "30" in r["repere"], r["repere"])


def test_elle_porte_le_theme_en_cible():
    egal("la cible est le thème",
         regle_page_arrivee_muette("Été", arrivee()).get("cible"), "Été")
    ok("et l'enjeu compte les clics perdus",
       regle_page_arrivee_muette("Été", arrivee()).get("_enjeu") == 640 - 180)


for _f in list(globals().values()):
    if callable(_f) and getattr(_f, "__name__", "").startswith("test_"):
        _f()
raise SystemExit(0 if bilan("page_arrivee_muette") else 1)
