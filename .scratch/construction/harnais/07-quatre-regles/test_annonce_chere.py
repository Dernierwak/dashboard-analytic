"""`annonce_chere` — l'Annonce qui paie son clic bien plus cher que ses voisines.

Ce que ce fichier prouve : la règle se déclenche sur les DEUX seuils de
`SEUILS` et sur aucun autre nombre, la comparaison se fait DANS un Groupe
d'annonces (jamais entre deux canaux, où le prix du clic mesurerait le canal et
pas la créa), et elle ne coupe jamais une campagne jeune.
"""
from math import ceil

import pulse  # noqa: F401
from t import ok, egal, proche, bilan
from fixtures import annonce

from saas.recos_ia.reco_engine import SEUILS
from saas.recos_ia.regles_payantes import regle_annonce_chere

RATIO = SEUILS["cpc_ratio"]            # 2.0 — CPC > 2× la médiane
PLANCHER = SEUILS["cpc_spend_min"]     # 50 CHF dépensés sur la semaine


def _a_1chf(cle, nom, clics=100, **kw):
    """Une annonce à 1,00 CHF le clic — le repère de toutes les comparaisons."""
    return annonce(cle, nom, clics=clics, depense=float(clics), impressions=10_000, **kw)


def _chere(cle="g:chere", nom="Chère", *, ratio=RATIO, depense=PLANCHER * 3, **kw):
    """Une annonce dont le CPC vaut AU PLUS `ratio` × 1,00 CHF.

    `ceil` et pas `int` : arrondir les clics vers le bas REMONTE le CPC, et un
    ratio de 1,99 se retrouvait à 2,00 pile — le test « juste sous le seuil »
    testait alors le seuil lui-même.
    """
    return annonce(cle, nom, clics=ceil(depense / ratio), depense=depense,
                   impressions=10_000, **kw)


def test_elle_se_declenche_pile_au_seuil():
    r = regle_annonce_chere("Été", [_chere(), _a_1chf("g:a", "A"), _a_1chf("g:b", "B")])
    ok("un conseil sort au ratio exact", r is not None)
    egal("clé", r["key"], "annonce_chere")
    egal("geste", r["nature"], "couper")
    egal("preuve", r["role"], "generale")
    ok("l'annonce est nommée", "Chère" in r["title"], r["title"])
    ok("le CPC est dans le titre", "2.00 CHF" in r["title"], r["title"])
    ok("la médiane est dans le titre", "1.00" in r["title"], r["title"])
    ok("le thème est nommé", "Été" in r["observation"], r["observation"])


def test_juste_sous_le_ratio_elle_se_tait():
    r = regle_annonce_chere("Été", [_chere(ratio=RATIO - 0.01),
                                    _a_1chf("g:a", "A"), _a_1chf("g:b", "B")])
    egal("sous le ratio, rien", r, None)


def test_juste_sous_le_plancher_de_depense_elle_se_tait():
    # Même écart de CPC, mais 1 CHF de moins que le plancher : un clic cher sur
    # trois francs dépensés n'est pas une information.
    r = regle_annonce_chere("Été", [_chere(depense=PLANCHER - 1),
                                    _a_1chf("g:a", "A"), _a_1chf("g:b", "B")])
    egal("sous le plancher, rien", r, None)

    r = regle_annonce_chere("Été", [_chere(depense=PLANCHER),
                                    _a_1chf("g:a", "A"), _a_1chf("g:b", "B")])
    ok("au plancher exact, un conseil", r is not None)


def test_une_campagne_jeune_ne_se_coupe_jamais():
    """Le garde-fou de David : un test a le droit d'être mauvais le temps de
    tourner, et rien en base ne dit qu'une campagne EST un test."""
    r = regle_annonce_chere("Été", [_chere(jeune=True),
                                    _a_1chf("g:a", "A"), _a_1chf("g:b", "B")])
    egal("l'annonce jeune n'est pas dénoncée", r, None)


def test_la_campagne_jeune_ne_gonfle_pas_la_mediane():
    """Elle sort de la comparaison des DEUX côtés : une campagne en
    apprentissage paie ses premiers clics plus cher, la laisser dans la médiane
    masquerait la vraie annonce chère."""
    jeune_tres_chere = annonce("g:jeune", "Jeune", clics=10, depense=100.0,
                               impressions=10_000, jeune=True)
    sans = regle_annonce_chere("Été", [_chere(), _a_1chf("g:a", "A"), _a_1chf("g:b", "B")])
    avec = regle_annonce_chere("Été", [_chere(), _a_1chf("g:a", "A"),
                                       _a_1chf("g:b", "B"), jeune_tres_chere])
    ok("la vraie annonce chère sort dans les deux cas", sans is not None and avec is not None)
    egal("et c'est la même", avec["title"], sans["title"])


def test_deux_canaux_ne_se_comparent_jamais():
    """LE DÉFAUT TROUVÉ EN REVUE DE CODE. Un clic Google Search se paie
    plusieurs fois un clic social : l'annonce « la plus chère du thème » était
    mécaniquement une annonce Search, et le client se voyait demander de couper
    une annonce parfaitement saine, avec une raison — « vous partagez la même
    audience » — qui était fausse."""
    search = annonce("g:search", "Search", canal="google", groupe="Mots-clés",
                     clics=50, depense=200.0, impressions=10_000)   # 4,00 CHF/clic
    social = [_a_1chf("m:a", "Social A"), _a_1chf("m:b", "Social B")]
    for a_ in social:
        a_["canal"], a_["groupe"] = "meta", "Lookalike 1%"
    egal("l'écart de canal n'est pas un écart de créa",
         regle_annonce_chere("Été", [search] + social), None)


def test_c_est_le_groupe_qui_perd_le_plus_qui_parle():
    """Quand deux Groupes ont chacun leur annonce chère, c'est l'argent en jeu
    qui décide laquelle se lit — pas l'ordre des lignes."""
    petit = [_chere("g:p", "Petite chère", depense=PLANCHER * 2, groupe="Petit"),
             _a_1chf("g:p1", "P1", groupe="Petit"), _a_1chf("g:p2", "P2", groupe="Petit")]
    gros = [_chere("g:g", "Grosse chère", depense=PLANCHER * 20, groupe="Gros"),
            _a_1chf("g:g1", "G1", groupe="Gros"), _a_1chf("g:g2", "G2", groupe="Gros")]
    r = regle_annonce_chere("Été", petit + gros)
    ok("un seul conseil, celui qui coûte le plus", "Grosse chère" in r["title"], r["title"])
    ok("et il nomme son Groupe", "Gros" in r["observation"], r["observation"])


def test_une_annonce_sans_groupe_connu_ne_compare_rien():
    """On ne sait pas contre qui elle courait."""
    sans = [_chere("g:x", "Sans groupe", groupe=""),
            _a_1chf("g:a", "A", groupe=""), _a_1chf("g:b", "B", groupe="")]
    egal("aucune comparaison fondée", regle_annonce_chere("Été", sans), None)


def test_une_seule_annonce_n_a_personne_a_qui_se_comparer():
    egal("une annonce seule", regle_annonce_chere("Été", [_chere()]), None)
    egal("aucune annonce", regle_annonce_chere("Été", []), None)


def test_une_annonce_sans_clic_ne_fausse_pas_la_mediane():
    # 0 clic → pas de CPC calculable. L'inclure à 0 tirerait la médiane vers le
    # bas et ferait dénoncer n'importe quelle annonce normale.
    muette = annonce("g:muette", "Muette", clics=0, depense=40.0, impressions=9_000)
    r = regle_annonce_chere("Été", [_a_1chf("g:a", "A"), _a_1chf("g:b", "B"), muette])
    egal("aucune annonce normale n'est dénoncée", r, None)


def test_le_conseil_porte_ses_quatre_champs_de_guide():
    r = regle_annonce_chere("Été", [_chere(), _a_1chf("g:a", "A"), _a_1chf("g:b", "B")])
    for champ in ("observation", "pourquoi", "verifier", "angle_mort", "repere"):
        ok(f"{champ} rempli", bool(str(r.get(champ) or "").strip()))
    proche("priorité", r["priority"], 1, 0)


if __name__ == "__main__":
    for f in list(globals().values()):
        if callable(f) and getattr(f, "__name__", "").startswith("test_"):
            f()
    raise SystemExit(0 if bilan("annonce_chere") else 1)
