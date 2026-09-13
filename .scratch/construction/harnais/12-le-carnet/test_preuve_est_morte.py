"""Le moteur de preuve compte-entier n'existe plus — ni son calcul, ni sa
lecture, ni son type, ni son fetcher.

CE QU'IL FAUT PROUVER EN MÊME TEMPS : qu'on a retiré UN moteur et pas la
mesure. Le rail rend toujours son verdict sur le thème, et il s'appuie sur les
mêmes pièces (`_METRIC_REGLE`, `_spec_mesure`, `cur_kpis`, `_kpis_window`).
Supprimer sans vérifier la relève retirerait la réponse au lieu d'unifier les
moteurs — c'est la leçon du harnais 09.
"""
import ast

import pulse
from t import ok, egal, bilan

RAPPORT = pulse.SOURCE_RAPPORT.read_text(encoding="utf-8")
FETCH = pulse.SOURCE_FETCH.read_text(encoding="utf-8")
REPORT_TS = pulse.SOURCE_REPORT_TS.read_text(encoding="utf-8")


def _cles_du_payload():
    """Les clés du dict que `build_payload` rend — lues sur l'ARBRE, pas au grep.

    Un `"preuve" not in source` passerait sur un fichier où le mot survit dans
    un commentaire (il y survit, exprès : c'est la pierre tombale)."""
    arbre = ast.parse(RAPPORT)
    for noeud in ast.walk(arbre):
        if isinstance(noeud, ast.FunctionDef) and noeud.name == "build_payload":
            retours = [n for n in ast.walk(noeud) if isinstance(n, ast.Return)]
            for r in retours:
                if isinstance(r.value, ast.Dict):
                    return {k.value for k in r.value.keys
                            if isinstance(k, ast.Constant) and isinstance(k.value, str)}
    return None


def test_le_payload_ne_porte_plus_la_preuve():
    cles = _cles_du_payload()
    ok("le dict de `build_payload` a été trouvé", cles is not None)
    if cles is None:
        return
    ok("`preuve` n'est plus une clé du payload", "preuve" not in cles)
    # Ce qui DOIT rester : le suivi des actions, qui est l'autre moteur — celui
    # qui mesure sur le thème et qu'on garde.
    for vivante in ("tracking", "themes", "themes_focus"):
        ok(f"`{vivante}` est toujours publié", vivante in cles, vivante)


def test_le_fetcher_de_la_preuve_n_existe_plus():
    ok("`fetch_reco_decisions` n'est plus définie", "def fetch_reco_decisions(" not in FETCH)
    ok("le rapport ne l'importe plus",
       "fetch_reco_decisions," not in RAPPORT and "fetch_reco_decisions(" not in RAPPORT)
    # La pierre tombale reste : sans elle, le prochain qui cherche « où est
    # passé le bilan des actions » remesure une deuxième fois.
    ok("la raison est écrite dans `fetch_data.py`",
       "A ÉTÉ RETIRÉE" in FETCH and "12-le-carnet-et-la-mort-de-preuve" in FETCH)
    ok("la raison est écrite dans `build_report.py`",
       "MOTEUR DE PREUVE COMPTE-ENTIER EST MORT" in RAPPORT
       and "12-le-carnet-et-la-mort-de-preuve" in RAPPORT)


def test_le_calcul_a_disparu_du_worker():
    for mort in ("outcomes.append(", "\"pending\":", "decisions = fetch_reco_decisions"):
        ok(f"« {mort} » a quitté le worker", mort not in RAPPORT, mort)
    # `PROOF_KPI` survit en COMMENTAIRE, et c'est voulu : le ticket 06 l'avait
    # déjà retirée, et sa pierre tombale explique où son rôle est parti
    # (`_METRIC_REGLE`). Ce qui doit être mort, c'est la table elle-même.
    for mort in ("PROOF_KPI = ", "PROOF_KPI.get(", "PROOF_KPI["):
        ok(f"« {mort} » n'existe pas", mort not in RAPPORT, mort)


def test_le_type_a_disparu_du_web():
    ok("`ProofOutcome` n'est plus déclaré", "export type ProofOutcome" not in REPORT_TS)
    ok("`ProofOutcome` n'est plus référencé", "ProofOutcome" not in REPORT_TS)
    ok("le champ `preuve?` n'est plus dans le payload lu",
       "preuve?: {" not in REPORT_TS and "outcomes: " not in REPORT_TS)
    ok("la raison est écrite dans `report.ts`", "A ÉTÉ RETIRÉ LE" in REPORT_TS)
    # Le champ survit dans les payloads DÉJÀ publiés : on ne réécrit pas
    # l'historique, on cesse de le lire. La phrase doit le dire.
    ok("l'écran dit que les vieux payloads le portent encore",
       "payloads déjà publiés" in REPORT_TS)


def test_la_releve_est_intacte_le_rail_mesure_toujours():
    """On a retiré un moteur, pas la mesure."""
    for vivante in ("_METRIC_REGLE", "def _spec_mesure(", "cur_kpis = _kpis_window(",
                    "def _kpis_window(", "\"verdict\": _verdict", "tracking = {"):
        ok(f"« {vivante} » est toujours là", vivante in RAPPORT, vivante)
    # Le verdict continue d'être PERSISTÉ : c'est lui que le bilan compte
    # désormais, et sans écriture il n'y aurait rien à compter.
    ok("le verdict s'écrit toujours en base",
       'sb.table("suivi_actions").update(' in RAPPORT and '{"verdict": _verdict}' in RAPPORT)


def test_le_rapport_reste_importable():
    """Le fichier est syntaxiquement entier après la coupe — un `ast.parse` le
    dit sans exécuter une ligne ni toucher à un secret."""
    try:
        ast.parse(RAPPORT)
        entier = True
    except SyntaxError as e:
        entier = False
        print(f"  ✗ SyntaxError {e}")
    ok("`build_report.py` parse", entier)
    egal("une seule définition de `build_payload`", RAPPORT.count("def build_payload("), 1)


if __name__ == "__main__":
    test_le_payload_ne_porte_plus_la_preuve()
    test_le_fetcher_de_la_preuve_n_existe_plus()
    test_le_calcul_a_disparu_du_worker()
    test_le_type_a_disparu_du_web()
    test_la_releve_est_intacte_le_rail_mesure_toujours()
    test_le_rapport_reste_importable()
    raise SystemExit(0 if bilan("preuve est morte") else 1)
