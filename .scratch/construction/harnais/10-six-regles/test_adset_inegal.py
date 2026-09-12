"""`adset_inegal` — un Groupe d'annonces qui paie son clic bien plus cher.

Ce que ce fichier prouve : la comparaison se fait DANS UNE MÊME CAMPAGNE (deux
campagnes ne jouent pas la même enchère), la règle se déclenche pile sur
`cpc_ratio` et `cpc_spend_min`, une campagne jeune n'entre ni comme candidate ni
dans le repère, et le conseil ouvre bien une Stratégie (`role="hypothese"`).
"""
import pulse  # noqa: F401
from t import ok, egal, bilan
from fixtures import annonce

from saas.recos_ia.reco_engine import SEUILS
from saas.recos_ia.regles_payantes import regle_adset_inegal

RATIO = SEUILS["cpc_ratio"]            # 2.0
PLANCHER = SEUILS["cpc_spend_min"]     # 50 CHF


def groupe(nom_groupe, cpc, clics, *, campagne="Campagne A", canal="google",
           jeune=False):
    """Deux annonces d'un même Groupe, au prix du clic voulu — EXACTEMENT.

    Les clics sont des entiers et la dépense en découle, sinon le prix du clic
    obtenu n'est pas celui qu'on croit tester et un test « pile sur le seuil »
    ne dit plus rien.
    """
    moitie = clics // 2
    return [annonce(f"{canal}:{nom_groupe}:{i}", f"A{i}",
                    groupe=nom_groupe, canal=canal, campagne=campagne,
                    clics=moitie, depense=cpc * moitie, jeune=jeune)
            for i in (1, 2)]


def test_elle_denonce_le_groupe_cher():
    ads = (groupe("Retargeting", 2.0, 100)      # 2.00 CHF le clic, 200 CHF
           + groupe("Lookalike", 1.0, 100)      # 1.00 CHF le clic, 100 CHF
           + groupe("Large", 1.0, 100))
    r = regle_adset_inegal("Été", ads)
    ok("un conseil sort", r is not None)
    egal("clé", r["key"], "adset_inegal")
    egal("geste", r["nature"], "tester")
    egal("preuve — elle ouvre une Stratégie", r["role"], "hypothese")
    ok("le Groupe cher est nommé", "Retargeting" in r["title"], r["title"])
    ok("le repère des voisins est dans l'observation",
       "autres Groupes" in r["observation"], r["observation"])
    ok("le moins cher est nommé", "Lookalike" in r["observation"], r["observation"])


def test_deux_campagnes_ne_se_comparent_jamais():
    """La leçon de `_par_groupe`, un cran plus haut : une campagne Search et une
    campagne Display n'ont pas un prix du clic, elles en ont deux."""
    ads = (groupe("Search - exact", 3.0, 100, campagne="Search")
           + groupe("Display - large", 0.5, 100, campagne="Display"))
    egal("deux campagnes, aucun conseil", regle_adset_inegal("Été", ads), None)
    # Deux Groupes SUFFISENT quand ils sont dans la même campagne : le repère
    # est ce que paient les voisins, pas une médiane qui tomberait entre les deux.
    # Et les MÊMES chiffres dans une seule campagne parlent.
    ads_memes = (groupe("Search - exact", 3.0, 100, campagne="Une seule")
                 + groupe("Display - large", 0.5, 100, campagne="Une seule"))
    ok("une seule campagne, un conseil",
       regle_adset_inegal("Été", ads_memes) is not None)


def test_elle_se_place_pile_sur_le_ratio():
    # Repère à 1.00 CHF (les deux Groupes voisins), candidat juste en dessous du
    # double, puis pile au double.
    base = groupe("B", 1.0, 100) + groupe("C", 1.0, 100)
    sous = groupe("A", RATIO - 0.01, 100) + base
    egal("un centième sous le ratio, silence", regle_adset_inegal("Été", sous), None)
    pile = groupe("A", RATIO, 100) + base
    ok("au ratio exact, un conseil", regle_adset_inegal("Été", pile) is not None)


def test_elle_se_place_pile_sur_le_plancher_de_depense():
    # Voisins à 0.25 CHF le clic, candidat à 1.00 — le ratio est largement
    # franchi, c'est donc bien le PLANCHER DE DÉPENSE qui décide.
    base = groupe("B", 0.25, 100) + groupe("C", 0.25, 100)
    sous = groupe("A", 1.0, int(PLANCHER) - 1) + base
    egal("un franc sous le plancher, silence", regle_adset_inegal("Été", sous), None)
    pile = groupe("A", 1.0, int(PLANCHER)) + base
    ok("au plancher exact, un conseil", regle_adset_inegal("Été", pile) is not None)


def test_une_campagne_jeune_ne_compte_d_aucun_cote():
    """Ni dénoncée, ni dans le repère — une campagne en apprentissage paie ses
    premiers clics plus cher, la laisser dans la médiane masquerait le vrai."""
    jeunes = groupe("Neuf", 4.0, 100, jeune=True)
    egal("le Groupe jeune n'est pas dénoncé",
         regle_adset_inegal("Été", jeunes + groupe("B", 1.0, 100)
                            + groupe("C", 1.0, 100)), None)
    # Et il ne remonte pas le repère : sans lui, A à 2× parle.
    avec = (groupe("A", 2.0, 100) + groupe("B", 1.0, 100)
            + groupe("C", 1.0, 100) + jeunes)
    r = regle_adset_inegal("Été", avec)
    ok("le repère ignore le jeune", r is not None and "« A »" in r["title"],
       r["title"] if r else None)


def test_un_seul_groupe_n_a_personne_a_qui_se_comparer():
    egal("un Groupe seul", regle_adset_inegal("Été", groupe("A", 5.0, 100)), None)
    egal("aucune annonce", regle_adset_inegal("Été", []), None)
    egal("des lignes vides", regle_adset_inegal("Été", [{}, {}]), None)


def test_sans_campagne_connue_elle_se_tait():
    """Sans campagne, on ne sait pas contre quelle enchère ce Groupe courait."""
    ads = [dict(a, campagne="") for a in
           (groupe("A", 4.0, 100) + groupe("B", 1.0, 100))]
    egal("campagne vide", regle_adset_inegal("Été", ads), None)


def test_elle_porte_sa_cible_et_son_enjeu():
    r = regle_adset_inegal("Été", groupe("Retargeting", 3.0, 100)
                           + groupe("Lookalike", 1.0, 100)
                           + groupe("Large", 1.0, 100))
    ok("une cible, pour que deux Groupes différents puissent parler tour à tour",
       "Retargeting" in (r.get("cible") or ""), r.get("cible"))
    ok("un enjeu en CHF, pour départager deux Stratégies",
       float(r.get("_enjeu") or 0) > 0, r.get("_enjeu"))
    egal("le Groupe désigné, pour l'arbitrage des collisions",
         r.get("_groupe"), ("google", "Retargeting"))


for _f in list(globals().values()):
    if callable(_f) and getattr(_f, "__name__", "").startswith("test_"):
        _f()
raise SystemExit(0 if bilan("adset_inegal") else 1)
