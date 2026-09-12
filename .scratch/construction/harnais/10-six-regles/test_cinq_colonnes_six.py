"""Les six nouvelles clés portent les cinq colonnes, et les collisions s'arbitrent.

Ce que ce fichier prouve : durée · levier · indicateur · geste · preuve sont
posées pour les six clés du ticket 10 ; les quatre tables de `build_report.py`
les couvrent ; ce qu'une VRAIE sortie de règle déclare est bien ce que la table
annonce ; les clés PRIVÉES (`_annonce`, `_groupe`, `_enjeu`) ne franchissent
jamais `RECO_FIELDS` ; et les six collisions possibles entre les dix règles sont
tranchées ou refusées, jamais laissées au hasard du tri.
"""
import pulse  # noqa: F401
from t import ok, egal, bilan
from fixtures import annonce, usure, campagne_budget, creneau

from saas.traitement.build_report import (
    EFFORTS, EFFORT_BY_KEY, LEVIERS, METRICS_MESURABLES, NATURES, ROLES,
    RECO_FIELDS, _GESTE_REGLE, _LEVIER_REGLE, _METRIC_REGLE, _attach_grammaire,
    _effort_de, _est_conseil, _spec_mesure, _strip_reco,
)
from saas.recos_ia.reco_engine import KEY_LABELS
from saas.recos_ia.regles_payantes import regles_payantes

SIX = ("adset_inegal", "theme_deux_regies", "budget_non_depense",
       "annonce_usee", "page_arrivee_muette", "creneau_pub")

# `page_arrivee_muette` est un PRÉREQUIS DE MESURE (levier `socle`), comme
# `connecter_ga4` et `ga4_muet` : elle n'a pas d'indicateur, et c'est voulu — lui
# en donner un reviendrait à juger sa réussite avec le chiffre qu'elle vient
# justement de déclarer faux.
SANS_INDICATEUR = {"page_arrivee_muette"}


def test_les_six_cles_portent_les_cinq_colonnes():
    for cle in SIX:
        r = _attach_grammaire({"key": cle, "source": "rule"})
        levier = r.get("levier")
        ok(f"{cle} · levier", levier in LEVIERS or levier == "socle", levier)
        ok(f"{cle} · geste", r.get("nature") in NATURES, r.get("nature"))
        ok(f"{cle} · preuve", r.get("role") in ROLES, r.get("role"))
        ok(f"{cle} · durée", _effort_de(r) in EFFORTS, _effort_de(r))
        ok(f"{cle} · servi (un conseil, pas un constat)", _est_conseil(r))
        spec = _spec_mesure(_METRIC_REGLE.get(cle))
        if cle in SANS_INDICATEUR:
            egal(f"{cle} · pas d'indicateur, et c'est voulu", spec, None)
            egal(f"{cle} · ...parce que son levier est le socle", levier, "socle")
        else:
            ok(f"{cle} · indicateur mesurable",
               spec is not None and spec[0] in METRICS_MESURABLES,
               _METRIC_REGLE.get(cle))


def test_les_tables_couvrent_toujours_les_memes_cles():
    egal("durée et levier couvrent les mêmes clés",
         sorted(EFFORT_BY_KEY), sorted(_LEVIER_REGLE))
    for cle in SIX:
        ok(f"{cle} · dans la table des durées", cle in EFFORT_BY_KEY)
        ok(f"{cle} · dans la table des leviers", cle in _LEVIER_REGLE)
        ok(f"{cle} · dans la table des gestes", cle in _GESTE_REGLE)
        ok(f"{cle} · a un libellé lisible", cle in KEY_LABELS)
        ok(f"{cle} · son libellé dit le SUJET, pas le geste",
           not any(g in KEY_LABELS[cle].lower() for g in
                   ("coupe", "augmente", "teste ", "crée", "corrige")),
           KEY_LABELS[cle])


def test_les_deux_premieres_strategies_d_un_compte_payant():
    """Avant ce ticket, les deux seules clés dont la preuve était « à mesurer »
    étaient organiques : un compte sans Instagram n'ouvrait jamais de Stratégie
    (`.scratch/refonte/issues/24-conseils-payants-manquants.md`, exigence 4)."""
    hypotheses = {c for c, (_g, _r) in _GESTE_REGLE.items() if _r == "hypothese"}
    ok("adset_inegal ouvre une Stratégie", "adset_inegal" in hypotheses)
    ok("theme_deux_regies aussi", "theme_deux_regies" in hypotheses)
    ok("les deux organiques sont toujours là",
       {"orga_essoufflement", "page_endormie"} <= hypotheses, hypotheses)
    egal("et personne d'autre n'en a gagné une", len(hypotheses), 4)


def test_annonce_usee_est_la_seule_au_dessus_de_trente_minutes():
    """Écart assumé avec 24 (décision 8) : elle demande de FABRIQUER une créa,
    comme ses voisines organiques qui sont toutes à « 1 h ». Le bac « 2 h+ »,
    lui, reste vide côté pub — c'est ce que la décision protégeait."""
    egal("annonce_usee", EFFORT_BY_KEY["annonce_usee"], "1 h")
    for cle in SIX:
        if cle != "annonce_usee":
            ok(f"{cle} tient en 30 min ou moins",
               EFFORT_BY_KEY[cle] in ("10 min", "30 min"), EFFORT_BY_KEY[cle])
    payantes = ("annonce_sans_conversion", "annonce_locomotive", "annonce_chere",
                "theme_hors_budget") + SIX
    ok("aucune règle payante en « 2 h+ »",
       all(EFFORT_BY_KEY[c] != "2 h+" for c in payantes))


# ── Les sorties réelles, et ce qu'elles déclarent ───────────────────────────

def _ads(cpc_cher=4.0, canal="google"):
    """Trois Groupes de TROIS annonces dans une même campagne, dont un Groupe à
    4 CHF le clic.

    Trois annonces par Groupe, et pas deux : `regle_annonce_chere` compare à la
    MÉDIANE des annonces du Groupe, et une médiane calculée sur deux valeurs
    tombe pile entre elles — la règle ne pourrait jamais y franchir son ratio.
    """
    out = []
    for nom, cpc in (("Retargeting", cpc_cher), ("Lookalike", 1.0), ("Large", 1.0)):
        for i in (1, 2, 3):
            out.append(annonce(f"{canal}:{nom}:{i}", f"{nom} {i}", groupe=nom,
                               canal=canal, campagne="Campagne A",
                               clics=50, depense=cpc * 50, impressions=5_000))
    return out


def _faits():
    return {
        "regies": {"meta": {"spend": 200.0, "revenue": 200.0, "complet": True},
                   "google": {"spend": 200.0, "revenue": 1600.0, "complet": True}},
        "campagnes": [campagne_budget("Retargeting été", pose_jour=25.0,
                                      depense_jour=9.0)],
        "usure": [usure("meta:1", "Video 1", impressions=30_000,
                        portee_cumul=10_000.0, clics=100, depense=150.0,
                        cpc_avant=1.0)],
        "arrivee": {"clics": 640, "sessions": 180, "depense": 900.0},
        "creneaux": [creneau(j, occurrences=4, clics=100,
                             depense=(2.0 if j == 6 else 1.0) * 100)
                     for j in range(7)],
    }


def test_une_vraie_sortie_declare_ce_que_la_table_annonce():
    """`_attach_grammaire` ne remplace jamais ce qu'une règle a déclaré : si les
    deux divergeaient, personne ne le verrait."""
    for r in regles_payantes("Été", _ads(), None, _faits()):
        cle = r["key"]
        if cle not in SIX:
            continue
        defaut = _GESTE_REGLE.get(cle)
        egal(f"{cle} · geste déclaré = geste de la table", r["nature"], defaut[0])
        egal(f"{cle} · preuve déclarée = preuve de la table", r["role"], defaut[1])
        apres = _attach_grammaire(dict(r))
        egal(f"{cle} · la pose n'écrase rien (geste)", apres["nature"], r["nature"])
        egal(f"{cle} · la pose n'écrase rien (preuve)", apres["role"], r["role"])


def test_les_cles_privees_ne_sortent_jamais_dans_le_payload():
    for r in regles_payantes("Été", _ads(), None, _faits()):
        paye = _strip_reco(_attach_grammaire(dict(r)))
        for privee in ("_annonce", "_groupe", "_enjeu"):
            ok(f"{r['key']} · {privee} reste dedans", privee not in paye,
               sorted(paye))
        ok(f"{r['key']} · rien hors de RECO_FIELDS",
           set(paye) <= set(RECO_FIELDS), sorted(set(paye) - set(RECO_FIELDS)))


def test_chaque_conseil_porte_une_cible():
    """Sans `cible`, deux thèmes qui portent le même conseil ont la même
    empreinte et le second est mangé par le premier (`composition.empreinte`)."""
    for r in regles_payantes("Été", _ads(), None, _faits()):
        if r["key"] in SIX:
            ok(f"{r['key']} · une cible", str(r.get("cible") or "").strip() != "",
               r.get("cible"))


# ── Les collisions ──────────────────────────────────────────────────────────

def test_une_seule_strategie_par_theme():
    """`adset_inegal` et `theme_deux_regies` peuvent sortir la même semaine. La
    carte n'en suivrait qu'une, au hasard de l'ordre de tri."""
    sorties = regles_payantes("Été", _ads(), None, _faits())
    marches = [r for r in sorties if r.get("role") == "hypothese"]
    egal("une Marche au plus", len(marches), 1)
    egal("celle qui a le plus d'argent en jeu", marches[0]["key"], "adset_inegal")


def test_le_groupe_accuse_se_tait_quand_une_de_ses_annonces_est_en_cause():
    """Si le prix d'un Groupe est tiré par UNE de ses annonces, ce n'est pas
    l'audience qui coûte cher, c'est la créa — et `adset_inegal` conclurait faux."""
    ads = _ads()
    # On rend UNE annonce de « Retargeting » nettement plus chère que ses deux
    # voisines, pour qu'`annonce_chere` la désigne dans ce même Groupe.
    ads[0] = dict(ads[0], clics=10, depense=400.0)     # 40 CHF le clic
    sorties = {r["key"]: r for r in regles_payantes("Été", ads, None, _faits())}
    ok("annonce_chere désigne bien une annonce du Groupe",
       "annonce_chere" in sorties, sorted(sorties))
    ok("adset_inegal s'efface", "adset_inegal" not in sorties, sorted(sorties))


def test_usee_et_chere_sur_la_meme_annonce_ne_font_qu_un():
    """Les deux constatent le même clic trop cher ; une seule en donne la cause."""
    ads = [annonce("meta:1", "Video 1", groupe="G", canal="meta",
                   clics=100, depense=150.0, impressions=30_000),
           annonce("meta:2", "Video 2", groupe="G", canal="meta",
                   clics=200, depense=60.0, impressions=30_000),
           annonce("meta:3", "Video 3", groupe="G", canal="meta",
                   clics=200, depense=60.0, impressions=30_000)]
    faits = dict(_faits(), regies={}, campagnes=[], arrivee={}, creneaux=[])
    faits["usure"] = [usure("meta:1", "Video 1", groupe="G", impressions=30_000,
                            portee_cumul=10_000.0, clics=100, depense=150.0,
                            cpc_avant=1.0)]
    cles = {r["key"] for r in regles_payantes("Été", ads, None, faits)}
    ok("l'usure reste", "annonce_usee" in cles, cles)
    ok("le prix seul s'efface", "annonce_chere" not in cles, cles)


def test_usee_et_locomotive_sur_la_meme_annonce_ne_font_aucun():
    """« Remplace-la » et « finance son Groupe » se contredisent : on ne sert ni
    l'un ni l'autre plutôt que d'inventer lequel l'emporte."""
    ads = [annonce("meta:1", "Video 1", groupe="G", canal="meta",
                   clics=900, depense=150.0, impressions=30_000),
           annonce("meta:2", "Video 2", groupe="G", canal="meta",
                   clics=100, depense=60.0, impressions=30_000)]
    faits = dict(_faits(), regies={}, campagnes=[], arrivee={}, creneaux=[])
    faits["usure"] = [usure("meta:1", "Video 1", groupe="G", impressions=30_000,
                            portee_cumul=10_000.0, clics=100, depense=150.0,
                            cpc_avant=1.0)]
    cles = {r["key"] for r in regles_payantes("Été", ads, None, faits)}
    ok("la locomotive part", "annonce_locomotive" not in cles, cles)
    ok("l'usure part avec elle", "annonce_usee" not in cles, cles)


def test_le_budget_qui_dort_s_efface_devant_le_budget_qui_deborde():
    """« Tu vas dépasser ton budget » et « ton budget dort » se lisent comme une
    contradiction. Le fait du thème gagne : c'est lui qui a une date."""
    budget = {"prevu_mois": 800.0, "depense_mois": 700.0, "depense_semaine": 259.0,
              "jours_restants": 10, "jours_fenetre": 7, "releve_le": "2026-09-08"}
    cles = {r["key"] for r in regles_payantes("Été", [], budget, _faits())}
    ok("le dépassement reste", "theme_hors_budget" in cles, cles)
    ok("le budget endormi s'efface", "budget_non_depense" not in cles, cles)
    # Sans dépassement, il parle.
    seuls = {r["key"] for r in regles_payantes("Été", [], None, _faits())}
    ok("seul, il parle", "budget_non_depense" in seuls, seuls)


def test_une_regle_qui_plante_n_emporte_pas_les_autres():
    """Même contrat défensif que `build_recos` : le rapport ne casse jamais."""
    faits = dict(_faits(), creneaux="pas une liste", regies=[("n'importe quoi",)])
    cles = {r["key"] for r in regles_payantes("Été", _ads(), None, faits)}
    ok("les autres sortent quand même", len(cles) >= 2, cles)
    ok("et pas les cassées", "creneau_pub" not in cles, cles)


def test_sans_faits_seule_adset_inegal_survit_parmi_les_six():
    """Le harnais du ticket 07 appelle `regles_payantes` en positionnel, sans
    `faits`. Les cinq règles qui lisent `faits` doivent alors se taire — pas
    planter — et `adset_inegal` est la seule des six à ne rien demander de
    neuf : elle relit les MÊMES Annonces que les trois règles d'annonce du
    ticket 07, un cran plus haut."""
    cles = {r["key"] for r in regles_payantes("Été", _ads(), None)}
    egal("les cinq qui lisent `faits` se taisent",
         sorted(set(cles) & set(SIX)), ["adset_inegal"])
    egal("aucune annonce, aucun fait", regles_payantes("Été", [], None), [])
    egal("des lignes vides", regles_payantes("Été", [{}, {}], {}, {}), [])


for _f in list(globals().values()):
    if callable(_f) and getattr(_f, "__name__", "").startswith("test_"):
        _f()
raise SystemExit(0 if bilan("cinq colonnes et collisions") else 1)
