"""Un seul moteur répond à « qu'est-ce qui marche chez toi » : `insights.py`.

Ce fichier prouve les DEUX moitiés de la décision, parce que l'une sans l'autre
serait une régression : les deux règles de `reco_engine.py` n'existent plus (ni
la fonction, ni sa clé dans les quatre tables de grammaire, ni sa mention dans
la pondération par constat), ET les constats qui les remplacent sortent
toujours. Supprimer sans vérifier la relève, c'est retirer la réponse, pas
unifier les moteurs.
"""
import ast

import pulse
from t import ok, egal, bilan

from saas.recos_ia import reco_engine
from saas.recos_ia.insights import build_constats
from saas.traitement.build_report import (
    EFFORT_BY_KEY, _GESTE_REGLE, _LEVIER_REGLE, _METRIC_REGLE,
)

MORTES = ("format_gagnant", "creneau")


def _arbre(chemin):
    return ast.parse(chemin.read_text(encoding="utf-8"))


def test_les_deux_regles_n_existent_plus():
    noms = {n.name for n in ast.walk(_arbre(pulse.SOURCE_MOTEUR))
            if isinstance(n, ast.FunctionDef)}
    ok("_rule_format_gagnant n'existe plus", "_rule_format_gagnant" not in noms)
    ok("_rule_creneau n'existe plus", "_rule_creneau" not in noms)
    # Les voisines restent : on a coupé deux règles, pas l'organique.
    for nom in ("_rule_silence", "_rule_page_endormie"):
        ok(f"{nom} est toujours là", nom in noms)


def test_aucune_table_de_conseil_ne_les_nomme_plus():
    """QUATRE tables, pas cinq — voir le test suivant pour la cinquième."""
    for cle in MORTES:
        ok(f"{cle} · hors KEY_LABELS", cle not in reco_engine.KEY_LABELS)
        ok(f"{cle} · hors EFFORT_BY_KEY", cle not in EFFORT_BY_KEY)
        ok(f"{cle} · hors _GESTE_REGLE", cle not in _GESTE_REGLE)
        ok(f"{cle} · hors _LEVIER_REGLE", cle not in _LEVIER_REGLE)
        for nom, obj in reco_engine.OBJECTIFS.items():
            ok(f"{cle} · hors objectif {nom}", cle not in obj["boost_keys"])


def test_une_decision_deja_prise_garde_son_verdict():
    """L'INDICATEUR SURVIT À LA RÈGLE, ET IL LE DOIT.

    Un client a pu cliquer « ▶ Je le teste » sur le créneau la semaine d'avant :
    la décision est en base. La boucle du Verdict lit `_METRIC_REGLE`, et sur un
    `None` elle fait `continue` AVANT la branche « en attente » — la décision
    disparaîtrait sans un mot tout en consommant une des quatre places. Pulse
    promet de dire si ce qui a été fait a marché : la promesse vaut pour ce qui a
    déjà été décidé, pas seulement pour ce qui se décide encore.
    """
    for cle in MORTES:
        egal(f"{cle} · indicateur gardé en lecture seule", _METRIC_REGLE.get(cle), "eng")
    # Mais elles ne concourent plus : `_LEVIER_REGLE` est ce qui fait entrer une
    # clé dans les conseils, et elles n'y sont plus (test précédent).
    ok("aucune règle vivante ne les produit",
       "_rule_creneau" not in pulse.SOURCE_MOTEUR.read_text(encoding="utf-8").split("# ── Orchestration")[1])


def test_les_seuils_sans_emploi_partent_avec_elles():
    """Un seuil qu'aucune règle ne lit se remet à diverger en silence."""
    for seuil in ("format_reach_pct", "format_sample_solide"):
        ok(f"{seuil} · retiré", seuil not in reco_engine.SEUILS)
    # Ceux que `insights.py` lit encore ne bougent pas.
    for seuil in ("slot_cell_min", "slot_total_min"):
        ok(f"{seuil} · gardé (lu par insights.py)", seuil in reco_engine.SEUILS)


def test_la_ponderation_par_constat_ne_les_cite_plus():
    """`VISION_RULES` vit DANS `build_recos` : on lit son arbre, pas son texte."""
    src = _arbre(pulse.SOURCE_MOTEUR)
    tables = [n for n in ast.walk(src)
              if isinstance(n, ast.Assign)
              and any(getattr(c, "id", None) == "VISION_RULES" for c in n.targets)]
    egal("une seule VISION_RULES", len(tables), 1)
    kinds = [k.value for k in tables[0].value.keys]
    egal("les trois constats qui prolongent une règle", sorted(kinds),
         ["campagne_locomotive", "theme_best", "theme_worst"])
    for k in kinds:
        cibles = {c.value for c in tables[0].value.values[kinds.index(k)].elts}
        for cle in MORTES:
            ok(f"{k} ne prolonge plus {cle}", cle not in cibles)


def _matrice(**kw):
    base = {
        "period": {"since": "2026-01-01", "until": "2026-09-11", "days": 254},
        "themes": [], "formats": [], "campaigns": [], "slots": [],
        "account_reach_avg": 0.0,
        "coverage": {"posts_labeled": 0, "posts_total": 0,
                     "campaigns_labeled": 0, "campaigns_total": 0, "ga4": False},
    }
    base.update(kw)
    return base


def test_la_releve_existe_le_format_gagnant_est_un_constat():
    m = _matrice(account_reach_avg=1000.0,
                 formats=[{"format": "Reel", "posts": 8, "reach_avg": 1500.0, "eng_avg": 4.0}])
    kinds = [c["kind"] for c in build_constats(m, {})]
    ok("`format_best` sort", "format_best" in kinds)


def test_la_releve_existe_le_creneau_est_un_constat():
    m = _matrice(slots=[{"dow": 1, "slot": 2, "posts": 4, "reach_avg": 1800.0}])
    cs = build_constats(m, {})
    kinds = [c["kind"] for c in cs]
    ok("`slot_best` sort", "slot_best" in kinds)
    titre = next(c["title"] for c in cs if c["kind"] == "slot_best")
    ok("il nomme le jour et l'heure", "mardi" in titre and "10-13h" in titre, titre)


if __name__ == "__main__":
    test_les_deux_regles_n_existent_plus()
    test_aucune_table_de_conseil_ne_les_nomme_plus()
    test_une_decision_deja_prise_garde_son_verdict()
    test_les_seuils_sans_emploi_partent_avec_elles()
    test_la_ponderation_par_constat_ne_les_cite_plus()
    test_la_releve_existe_le_format_gagnant_est_un_constat()
    test_la_releve_existe_le_creneau_est_un_constat()
    raise SystemExit(0 if bilan("Trois moteurs, un seul") else 1)
