"""`annonce_locomotive` — l'Annonce qui accroche nettement mieux que ses voisines.

Ce que ce fichier prouve : les deux seuils de `SEUILS` commandent seuls le
déclenchement, le conseil désigne le GROUPE D'ANNONCES et jamais l'Annonce, la
comparaison se fait DANS un Groupe (jamais entre deux canaux, où le taux de clic
mesurerait le canal et pas la créa), et elle exclut l'annonce elle-même de sa
propre référence.
"""
import pulse  # noqa: F401
from t import ok, egal, bilan
from fixtures import annonce

from saas.recos_ia.reco_engine import SEUILS
from saas.recos_ia.regles_payantes import regle_annonce_locomotive

RATIO = SEUILS["ctr_ratio"]                  # 1.5 — CTR > 1.5× celui des autres
PLANCHER = SEUILS["ctr_impressions_min"]     # 1 000 impressions minimum


def _a_ctr(cle, nom, ctr_pct, impressions=PLANCHER * 10, groupe="Retargeting CH", **kw):
    """Une annonce au CTR demandé, avec assez d'impressions pour compter.

    Même Groupe par défaut : c'est la seule unité où deux Annonces sont
    comparables, et donc la seule où un test dit quelque chose.
    """
    return annonce(cle, nom, impressions=impressions, groupe=groupe,
                   clics=round(impressions * ctr_pct / 100), depense=50.0, **kw)


def test_elle_se_declenche_au_ratio_exact():
    r = regle_annonce_locomotive("Été", [
        _a_ctr("g:top", "Locomotive", 1.0 * RATIO),
        _a_ctr("g:a", "A", 1.0), _a_ctr("g:b", "B", 1.0)])
    ok("un conseil sort", r is not None)
    egal("clé", r["key"], "annonce_locomotive")
    egal("geste", r["nature"], "augmenter")
    egal("preuve", r["role"], "generale")
    ok("l'annonce est nommée", "Locomotive" in r["title"], r["title"])


def test_le_geste_designe_le_groupe_jamais_l_annonce():
    """« On ne finance pas une Annonce » — décision 1 du ticket 24 : aucune
    plateforme ne prend un budget au niveau de l'annonce."""
    r = regle_annonce_locomotive("Été", [
        _a_ctr("g:top", "Locomotive", 3.0),
        _a_ctr("g:a", "A", 1.0), _a_ctr("g:b", "B", 1.0)])
    ok("le Groupe est nommé dans le geste", "Retargeting CH" in r["verifier"], r["verifier"])
    ok("le budget demandé est celui du Groupe",
       "budget du Groupe" in r["verifier"], r["verifier"])


def test_sans_groupe_connu_elle_se_tait():
    r = regle_annonce_locomotive("Été", [
        _a_ctr("g:top", "Locomotive", 3.0, groupe=""),
        _a_ctr("g:a", "A", 1.0), _a_ctr("g:b", "B", 1.0)])
    egal("rien à financer, rien à dire", r, None)


def test_deux_canaux_ne_se_comparent_jamais():
    """LE DÉFAUT TROUVÉ EN REVUE DE CODE. Un taux de clic Search (3 à 10 %) bat
    un taux de clic social (~1 %) sans qu'aucune créa n'y soit pour rien : à
    `ctr_ratio = 1.5`, la règle aurait désigné la même annonce Search toutes les
    semaines et demandé de monter son budget de +20 % à chaque fois."""
    search = _a_ctr("g:search", "Search", 6.0, canal="google", groupe="Mots-clés marque")
    social = [_a_ctr("m:a", "Social A", 1.0, canal="meta", groupe="Lookalike 1%"),
              _a_ctr("m:b", "Social B", 1.0, canal="meta", groupe="Lookalike 1%")]
    r = regle_annonce_locomotive("Été", [search] + social)
    egal("l'écart de canal n'est pas un écart de créa", r, None)


def test_deux_groupes_du_meme_canal_ne_se_comparent_pas_non_plus():
    """Deux Groupes, c'est deux audiences et deux enchères. Seul le Groupe où
    l'écart existe vraiment parle."""
    plat = [_a_ctr("g:a", "A", 1.0, groupe="Groupe plat"),
            _a_ctr("g:b", "B", 1.0, groupe="Groupe plat")]
    vif = [_a_ctr("g:c", "Vive", 4.0, groupe="Groupe vif"),
           _a_ctr("g:d", "D", 2.0, groupe="Groupe vif")]
    r = regle_annonce_locomotive("Été", plat + vif)
    ok("c'est l'écart INTERNE au groupe vif qui sort", r is not None)
    ok("et l'annonce nommée est la sienne", "Vive" in r["title"], r["title"])
    ok("le Groupe nommé est le sien", "Groupe vif" in r["verifier"], r["verifier"])
    # 4 % contre 2 % dans son groupe = 2,0×, pas 4,0× (ce qu'aurait donné une
    # comparaison à toutes les annonces du thème).
    ok("le ratio est celui du groupe", "2.0×" in r["title"], r["title"])


def test_juste_sous_le_ratio_elle_se_tait():
    r = regle_annonce_locomotive("Été", [
        _a_ctr("g:top", "Locomotive", 1.0 * RATIO - 0.02),
        _a_ctr("g:a", "A", 1.0), _a_ctr("g:b", "B", 1.0)])
    egal("sous le ratio, rien", r, None)


def test_sous_le_plancher_d_impressions_elle_ne_concourt_pas():
    """Un CTR de 10 % sur 999 impressions est du bruit : le plancher existe
    pour ça, et il écarte l'annonce AVANT qu'elle devienne candidate."""
    r = regle_annonce_locomotive("Été", [
        _a_ctr("g:top", "Locomotive", 10.0, impressions=PLANCHER - 1),
        _a_ctr("g:a", "A", 1.0, impressions=PLANCHER * 10),
        _a_ctr("g:b", "B", 1.0, impressions=PLANCHER * 10)])
    egal("le bruit ne devient pas un conseil", r, None)

    r = regle_annonce_locomotive("Été", [
        _a_ctr("g:top", "Locomotive", 10.0, impressions=PLANCHER),
        _a_ctr("g:a", "A", 1.0, impressions=PLANCHER * 10),
        _a_ctr("g:b", "B", 1.0, impressions=PLANCHER * 10)])
    ok("au plancher exact, elle concourt", r is not None)


def test_elle_ne_se_compare_pas_a_elle_meme():
    """La référence est le CTR des AUTRES annonces du Groupe. S'inclure dedans
    amortit son propre écart, et une locomotive seule vaudrait 1,0×."""
    # Trois annonces identiques : personne ne se détache, rien ne sort.
    egal("trois annonces identiques", regle_annonce_locomotive("Été", [
        _a_ctr("g:a", "A", 2.0), _a_ctr("g:b", "B", 2.0), _a_ctr("g:c", "C", 2.0)]), None)
    # Une seule annonce n'a aucun « autre » : la règle n'a rien à comparer.
    egal("une annonce seule", regle_annonce_locomotive("Été", [
        _a_ctr("g:a", "A", 9.0)]), None)


def test_la_reference_est_ponderee_par_les_impressions():
    """Une moyenne de CTR par annonce donnerait le même poids à une annonce vue
    mille fois et à une vue cent mille fois. On agrège clics et impressions."""
    r = regle_annonce_locomotive("Été", [
        _a_ctr("g:top", "Locomotive", 1.6, impressions=PLANCHER * 10),
        # Une petite annonce au CTR nul ne doit pas suffire à faire passer la
        # locomotive au-dessus du ratio.
        _a_ctr("g:a", "A", 1.2, impressions=PLANCHER * 100),
        _a_ctr("g:b", "B", 0.0, impressions=PLANCHER)])
    egal("la grosse annonce commande la référence", r, None)


if __name__ == "__main__":
    for f in list(globals().values()):
        if callable(f) and getattr(f, "__name__", "").startswith("test_"):
            f()
    raise SystemExit(0 if bilan("annonce_locomotive") else 1)
