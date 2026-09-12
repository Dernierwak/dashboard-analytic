"""Les quatre nouvelles clés portent les cinq colonnes, comme les autres.

Ce que ce fichier prouve : durée · levier · indicateur · geste · preuve sont
posées pour `annonce_chere`, `annonce_locomotive`, `annonce_sans_conversion` et
`theme_hors_budget` ; les quatre tables de `build_report.py` couvrent les mêmes
clés qu'avant plus ces quatre-là ; et les cinq colonnes qu'une VRAIE sortie de
règle porte sont les mêmes que celles que les tables annoncent — une règle qui
déclarerait un geste différent de sa table passerait inaperçue sinon.
"""
import pulse  # noqa: F401
from t import ok, egal, bilan
from fixtures import annonce

from saas.traitement.build_report import (
    EFFORTS, EFFORT_BY_KEY, LEVIERS_IA, METRICS_IA, METRIC_INFO_IA,
    NATURES_IA, ROLES_IA, _GESTE_REGLE, _LEVIER_REGLE, _METRIC_REGLE,
    _attach_grammaire, _effort_de, _est_conseil, _spec_mesure,
)
from saas.recos_ia.reco_engine import KEY_LABELS
from saas.recos_ia.regles_payantes import (
    regle_annonce_chere, regle_annonce_locomotive,
    regle_annonce_sans_conversion, regle_theme_hors_budget, regles_payantes,
)

QUATRE = ("annonce_sans_conversion", "annonce_locomotive",
          "annonce_chere", "theme_hors_budget")


def test_les_quatre_cles_portent_les_cinq_colonnes():
    for cle in QUATRE:
        r = _attach_grammaire({"key": cle, "source": "rule"})
        ok(f"{cle} · levier", r.get("levier") in LEVIERS_IA, r.get("levier"))
        ok(f"{cle} · geste", r.get("nature") in NATURES_IA, r.get("nature"))
        ok(f"{cle} · preuve", r.get("role") in ROLES_IA, r.get("role"))
        ok(f"{cle} · durée", _effort_de(r) in EFFORTS, _effort_de(r))
        spec = _spec_mesure(_METRIC_REGLE.get(cle))
        ok(f"{cle} · indicateur mesurable",
           spec is not None and spec[0] in METRICS_IA, _METRIC_REGLE.get(cle))
        ok(f"{cle} · servi (un conseil, pas un constat)", _est_conseil(r))


def test_les_tables_couvrent_toujours_les_memes_cles():
    egal("durée et levier couvrent les mêmes clés",
         sorted(EFFORT_BY_KEY), sorted(_LEVIER_REGLE))
    for cle in QUATRE:
        ok(f"{cle} · dans la table des durées", cle in EFFORT_BY_KEY)
        ok(f"{cle} · dans la table des leviers", cle in _LEVIER_REGLE)
        ok(f"{cle} · dans la table des indicateurs", cle in _METRIC_REGLE)
        ok(f"{cle} · dans la table des gestes", cle in _GESTE_REGLE)
        ok(f"{cle} · a un libellé lisible", cle in KEY_LABELS)


def test_spend_est_un_indicateur_mesurable():
    """`theme_hors_budget` est le seul conseil dont la réussite est une dépense
    qui REDESCEND. Sans `spend` déclaré, il n'aurait aucun verdict possible."""
    spec = _spec_mesure("spend")
    ok("spend est déclaré", spec is not None)
    egal("l'indicateur", spec[0], "spend")
    egal("le sens d'amélioration", spec[3], "down")
    egal("l'unité", spec[2], "CHF")
    ok("et il est dans la liste fermée", "spend" in METRICS_IA)
    ok("sessions n'y est PAS (non mesurable par `_kpis_window`)",
       "sessions" not in METRICS_IA and "sessions" not in METRIC_INFO_IA)


def _sorties_reelles():
    """Une sortie réelle de chacune des quatre règles."""
    voisines = [annonce(f"g:v{i}", f"Voisine {i}", impressions=10_000, clics=100,
                        depense=100.0, conversions=2.0) for i in range(2)]
    chere = annonce("g:chere", "Chère", impressions=10_000, clics=75,
                    depense=150.0, conversions=1.0)
    loco = annonce("g:loco", "Locomotive", impressions=10_000, clics=900,
                   depense=100.0, conversions=3.0)
    muette = annonce("g:muette", "Muette", impressions=10_000, clics=120,
                     depense=150.0, conversions=0.0)
    bud = {"prevu_mois": 800.0, "depense_mois": 700.0, "depense_semaine": 259.0,
           "jours_restants": 10, "jours_fenetre": 7, "releve_le": "2026-09-08"}
    return [
        regle_annonce_chere("Été", [chere] + voisines),
        regle_annonce_locomotive("Été", [loco] + voisines),
        regle_annonce_sans_conversion("Été", [muette] + voisines),
        regle_theme_hors_budget("Été", bud),
    ]


def test_ce_que_la_regle_declare_est_ce_que_la_table_annonce():
    for r in _sorties_reelles():
        ok("la règle a rendu un conseil", r is not None)
        if r is None:
            continue
        cle = r["key"]
        egal(f"{cle} · geste identique à la table", r["nature"], _GESTE_REGLE[cle][0])
        egal(f"{cle} · preuve identique à la table", r["role"], _GESTE_REGLE[cle][1])
        # `_attach_grammaire` ne doit RIEN remplacer de ce que la règle a dit.
        avant = (r["nature"], r["role"])
        _attach_grammaire(r)
        egal(f"{cle} · la table n'écrase pas la déclaration", (r["nature"], r["role"]), avant)
        egal(f"{cle} · levier posé", r["levier"], _LEVIER_REGLE[cle])
        ok(f"{cle} · servi", _est_conseil(r))


BUDGET_QUI_DEPASSE = {"prevu_mois": 800.0, "depense_mois": 700.0,
                      "depense_semaine": 259.0, "jours_restants": 10,
                      "jours_fenetre": 7, "releve_le": "2026-09-08"}


def test_l_orchestrateur_rend_plusieurs_regles_a_la_fois():
    voisines = [annonce(f"g:v{i}", f"Voisine {i}", impressions=10_000, clics=100,
                        depense=100.0, conversions=2.0) for i in range(2)]
    # Trois annonces DISTINCTES : chacune déclenche sa règle, aucune collision.
    chere = annonce("g:chere", "Chère", impressions=10_000, clics=75,
                    depense=150.0, conversions=1.0)
    muette = annonce("g:muette", "Muette", impressions=10_000, clics=130,
                     depense=130.0, conversions=0.0)
    cles = {r["key"] for r in regles_payantes(
        "Été", [chere, muette] + voisines, BUDGET_QUI_DEPASSE)}
    ok("trois règles peuvent sortir ensemble",
       {"annonce_chere", "annonce_sans_conversion", "theme_hors_budget"} <= cles, cles)


def test_muette_et_chere_sur_la_meme_annonce_ne_font_qu_un_conseil():
    """Les deux disent de couper la même annonce. Zéro conversion pendant qu'une
    voisine en rapporte est une PREUVE, un clic cher n'est qu'un prix : on garde
    la preuve, sinon la carte dépense deux de ses trois places à dire la même
    chose."""
    voisines = [annonce(f"g:v{i}", f"Voisine {i}", impressions=10_000, clics=100,
                        depense=100.0, conversions=2.0) for i in range(2)]
    la_meme = annonce("g:x", "La même", impressions=10_000, clics=75,
                      depense=150.0, conversions=0.0)
    cles = {r["key"] for r in regles_payantes("Été", [la_meme] + voisines, None)}
    egal("la preuve reste, le prix part", cles, {"annonce_sans_conversion"})


def test_locomotive_et_chere_sur_la_meme_annonce_ne_disent_rien():
    """« Monte le budget de son Groupe » et « coupe-la » se contredisent. Rien
    dans la donnée ne dit lequel des deux signaux l'emporte : on ne sert ni
    l'un ni l'autre plutôt que d'inventer l'arbitre."""
    voisines = [annonce(f"g:v{i}", f"Voisine {i}", impressions=10_000, clics=100,
                        depense=100.0, conversions=2.0) for i in range(2)]
    # Accroche 4× mieux (CTR 4 % contre 1 %) ET paie son clic 2× plus cher.
    les_deux = annonce("g:x", "Les deux", impressions=10_000, clics=400,
                       depense=800.0, conversions=3.0)
    cles = {r["key"] for r in regles_payantes(
        "Été", [les_deux] + voisines, BUDGET_QUI_DEPASSE)}
    egal("les deux conseils contradictoires disparaissent",
         cles, {"theme_hors_budget"})


def test_la_cle_privee_ne_sort_pas_dans_le_payload():
    """`_annonce` sert à l'arbitrage et ne doit jamais atteindre le client :
    elle n'est pas dans `RECO_FIELDS`, donc `_strip_reco` ne la recopie pas."""
    from saas.traitement.build_report import RECO_FIELDS, _strip_reco
    voisines = [annonce(f"g:v{i}", f"Voisine {i}", impressions=10_000, clics=100,
                        depense=100.0, conversions=2.0) for i in range(2)]
    chere = annonce("g:chere", "Chère", impressions=10_000, clics=75,
                    depense=150.0, conversions=1.0)
    for r in regles_payantes("Été", [chere] + voisines, None):
        ok(f"{r['key']} · pas de clé privée dans le payload",
           "_annonce" not in _strip_reco(r))
    ok("et RECO_FIELDS ne la contient pas", "_annonce" not in RECO_FIELDS)


def test_l_orchestrateur_ne_casse_jamais():
    egal("aucune annonce, aucun budget", regles_payantes("Été", [], None), [])
    egal("des lignes vides", regles_payantes("Été", [{}, {}], {}), [])


if __name__ == "__main__":
    for f in list(globals().values()):
        if callable(f) and getattr(f, "__name__", "").startswith("test_"):
            f()
    raise SystemExit(0 if bilan("Les cinq colonnes des quatre règles") else 1)
