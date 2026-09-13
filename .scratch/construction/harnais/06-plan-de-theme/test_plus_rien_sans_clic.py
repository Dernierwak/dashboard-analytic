"""Plus rien n'entre au carnet sans un clic.

CE QUE CE FICHIER NE PROUVE PAS, ET IL FAUT LE DIRE : il ne fait pas tourner
`build_payload`. Cette fonction prend un client Supabase vivant et va chercher
ses données elle-même — la rendre appelable hors ligne est le ticket 16, pas
celui-ci. Ce qui est vérifiable aujourd'hui sans base, c'est le TEXTE du worker,
et c'est ce qu'on lit ici : l'écriture automatique a disparu, la lecture des
lignes `auto` aussi, le verdict ne tombe plus que sur un « fait », et
`theme_plan` continue de s'écrire à la publication.

Un test de texte se périme dès qu'on renomme une variable — il est là pour
tomber bruyamment si quelqu'un rebranche l'entrée automatique sans savoir
pourquoi elle est morte, pas pour tenir lieu de test de comportement.
"""
import re

import pulse
from t import ok, bilan

SOURCE = pulse.SOURCE_RAPPORT.read_text(encoding="utf-8")
ACTIONS_TS = (pulse.RACINE / "saas" / "web" / "app" / "actions.ts").read_text(encoding="utf-8")


def test_le_worker_n_ecrit_plus_aucune_ligne_auto():
    ok("aucun statut auto écrit", '"status": "auto"' not in SOURCE)
    ok("aucun upsert suivi_actions dans le worker",
       'sb.table("suivi_actions").upsert' not in SOURCE)
    ok("aucune purge de lignes auto",
       'sb.table("suivi_actions").delete' not in SOURCE)
    ok("aucun marqueur d'origine posé", '"origin": "auto"' not in SOURCE)


def test_le_worker_ne_relit_plus_les_lignes_auto():
    lectures = re.findall(r'in_\("status", (\[[^\]]*\])\)', SOURCE)
    ok("une seule lecture par statut", len(lectures) == 1, lectures)
    for liste in lectures:
        ok(f"la lecture exclut auto — {liste}", '"auto"' not in liste)


def test_le_verdict_ne_tombe_que_sur_un_fait():
    ok("le compteur ne tourne que sur un « done »",
       'due = status == "done" and today >= chk' in SOURCE)
    ok("l'ancien gate a disparu",
       'due = status in ("done", "auto")' not in SOURCE)


def test_le_plan_de_theme_reste_ecrit_a_la_publication():
    # C'est la mémoire de Pulse, pas le carnet du client : elle continue de
    # s'écrire chaque semaine, sinon un thème changerait de théorie à chaque
    # rapport — ce que la fenêtre d'attente existe précisément pour empêcher.
    ok("theme_plan toujours écrit", "upsert_theme_plan(" in SOURCE)
    ok("la fenêtre d'attente est toujours lue",
       "ATTENTE_MIN_NOUVELLE_HYPOTHESE.get(_plan.get(\"levier\")" in SOURCE)


def test_l_echeance_part_du_clic():
    # `resolveAction(id, "done")` repose `check_at` au jour du clic : c'est le
    # seul endroit du dépôt qui fixe l'échéance d'un verdict.
    # ÉCRITURE MISE À JOUR PAR LE TICKET 11, pas un assouplissement : la date
    # de réalisation est devenue LIBRE (`done_at` choisi, borné par
    # `decided_at ≤ done_at ≤ aujourd'hui`), donc l'échéance ne part plus du
    # jour du clic mais du JOUR CHOISI — `check = plusJours(jourFait, 14)`.
    # L'assertion visait encore le nom de variable d'avant et ne prouvait donc
    # plus rien depuis `618b950`.
    ok("l'échéance se repose au clic « fait »",
       'status: "done",' in ACTIONS_TS and "check_at: check," in ACTIONS_TS
       and "const check = plusJours(jourFait, 14);" in ACTIONS_TS)
    ok("le levier part avec le clic", "levier?: string | null;" in ACTIONS_TS)


if __name__ == "__main__":
    test_le_worker_n_ecrit_plus_aucune_ligne_auto()
    test_le_worker_ne_relit_plus_les_lignes_auto()
    test_le_verdict_ne_tombe_que_sur_un_fait()
    test_le_plan_de_theme_reste_ecrit_a_la_publication()
    test_l_echeance_part_du_clic()
    raise SystemExit(0 if bilan("Plus rien sans un clic") else 1)
