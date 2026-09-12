"""`annonce_sans_conversion` — elle dépense, une voisine convertit.

Ce que ce fichier prouve : une ABSENCE DE MESURE n'est jamais lue comme un
zéro (`CLAUDE.md` §7), la voisine qui convertit est une CONDITION et pas une
décoration, la comparaison se fait DANS un Groupe d'annonces (une annonce
Search qui convertit et une annonce Display qui ne convertit pas est un fait de
canal, pas un fait de créa), et le garde-fou « jamais sur une campagne jeune »
tient aussi ici.
"""
import pulse  # noqa: F401
from t import ok, egal, bilan
from fixtures import annonce

from saas.recos_ia.reco_engine import SEUILS
from saas.recos_ia.regles_payantes import regle_annonce_sans_conversion

PLANCHER = SEUILS["roas_spend_min"]   # 50 CHF — en dessous, l'annonce n'a pas eu sa chance


def _muette(cle="g:muette", nom="Muette", depense=PLANCHER * 2, **kw):
    return annonce(cle, nom, impressions=10_000, clics=120, depense=depense,
                   conversions=0.0, **kw)


def _gagnante(cle="g:ok", nom="Gagnante", conversions=7.0, **kw):
    return annonce(cle, nom, impressions=10_000, clics=110, depense=96.0,
                   conversions=conversions, **kw)


def test_elle_se_declenche_avec_une_voisine_qui_convertit():
    r = regle_annonce_sans_conversion("Été", [_muette(), _gagnante()])
    ok("un conseil sort", r is not None)
    egal("clé", r["key"], "annonce_sans_conversion")
    egal("geste", r["nature"], "couper")
    egal("preuve", r["role"], "generale")
    ok("les deux annonces sont nommées",
       "Muette" in r["observation"] and "Gagnante" in r["observation"], r["observation"])
    ok("le nombre de conversions de la voisine est dit",
       "7 " in r["observation"], r["observation"])


def test_sans_voisine_qui_convertit_elle_se_tait():
    """Zéro conversion partout ne dit rien sur l'annonce : ça dit que l'offre,
    le thème ou la mesure ne vont pas — et `roas` porte déjà ce conseil-là."""
    r = regle_annonce_sans_conversion("Été", [_muette(), _muette("g:m2", "Muette 2")])
    egal("personne ne convertit, rien", r, None)


def test_une_absence_de_mesure_n_est_pas_un_zero():
    """Meta ne remonte pas la conversion au niveau de l'Annonce : ses lignes
    arrivent à `None`. Les compter comme des zéros ferait dénoncer une annonce
    Meta qui vend très bien, sur une mesure qu'on n'a pas.

    Les deux annonces Meta sont dans le MÊME Groupe : sans ça le test passerait
    pour la mauvaise raison (une annonce seule dans son groupe n'est de toute
    façon comparée à personne)."""
    meta_kw = dict(canal="meta", groupe="Lookalike 1%")
    grosse = annonce("meta:1", "Annonce Meta", impressions=10_000, clics=200,
                     depense=PLANCHER * 4, conversions=None, **meta_kw)
    voisine = annonce("meta:2", "Voisine Meta", impressions=10_000, clics=150,
                      depense=80.0, conversions=None, **meta_kw)
    egal("aucune annonce non mesurée n'est dénoncée",
         regle_annonce_sans_conversion("Été", [grosse, voisine]), None)

    # Et une non mesurée ne sert pas non plus de « voisine qui convertit ».
    egal("une annonce non mesurée n'est pas une preuve",
         regle_annonce_sans_conversion(
             "Été", [_muette(**meta_kw), grosse]), None)


def test_deux_canaux_ne_se_comparent_jamais():
    """Une annonce Search qui convertit ne prouve rien sur une annonce Display
    qui ne convertit pas : c'est un fait de canal, pas un fait de créa."""
    muette_display = _muette("g:disp", "Display", canal="google", groupe="Display")
    search = _gagnante("g:search", "Search", canal="google", groupe="Mots-clés")
    egal("l'écart de canal n'est pas un écart de créa",
         regle_annonce_sans_conversion("Été", [muette_display, search]), None)


def test_c_est_le_groupe_qui_perd_le_plus_qui_parle():
    petit = [_muette("g:p", "Petite muette", depense=PLANCHER * 1.5, groupe="Petit"),
             _gagnante("g:p1", "P1", groupe="Petit")]
    gros = [_muette("g:g", "Grosse muette", depense=PLANCHER * 10, groupe="Gros"),
            _gagnante("g:g1", "G1", groupe="Gros")]
    r = regle_annonce_sans_conversion("Été", petit + gros)
    ok("celle qui coûte le plus", "Grosse muette" in r["title"], r["title"])
    ok("et sa voisine est du même Groupe", "G1" in r["observation"], r["observation"])


def test_sous_le_plancher_de_depense_elle_se_tait():
    r = regle_annonce_sans_conversion("Été", [_muette(depense=PLANCHER - 1), _gagnante()])
    egal("20 CHF sans vente n'est pas une information", r, None)

    r = regle_annonce_sans_conversion("Été", [_muette(depense=PLANCHER), _gagnante()])
    ok("au plancher exact, un conseil", r is not None)


def test_une_campagne_jeune_ne_se_coupe_jamais():
    r = regle_annonce_sans_conversion("Été", [_muette(jeune=True), _gagnante()])
    egal("le test a le droit d'être mauvais", r, None)


def test_c_est_la_plus_grosse_depense_qui_est_denoncee():
    petite = _muette("g:p", "Petite", depense=PLANCHER * 1.2)
    grosse = _muette("g:g", "Grosse", depense=PLANCHER * 5)
    r = regle_annonce_sans_conversion("Été", [petite, grosse, _gagnante()])
    ok("celle qui coûte le plus", "Grosse" in r["title"], r["title"])


def test_c_est_la_meilleure_voisine_qui_sert_de_preuve():
    r = regle_annonce_sans_conversion("Été", [
        _muette(), _gagnante("g:ok1", "Une", 2.0), _gagnante("g:ok2", "Deux", 9.0)])
    ok("la voisine la plus convertissante", "Deux" in r["observation"], r["observation"])


if __name__ == "__main__":
    for f in list(globals().values()):
        if callable(f) and getattr(f, "__name__", "").startswith("test_"):
            f()
    raise SystemExit(0 if bilan("annonce_sans_conversion") else 1)
