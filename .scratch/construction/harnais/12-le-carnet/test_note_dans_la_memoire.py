"""Une note entre dans la mémoire du thème, et JAMAIS dans le repondérage.

C'est la décision §3 de `.scratch/refonte/issues/08-la-memoire-du-travail.md`,
et la frontière tient au `CLAUDE.md` §7 : la mémoire est NARRATIVE (elle
reformule, elle ne calcule pas), donc y verser un fait déclaré ne fabrique
aucun chiffre ; repondérer un conseil sur un texte libre non mesuré ferait
peser une phrase comme un verdict.

`build_prompt` est pure : aucun accès base, aucun appel IA, aucun secret.
"""
import ast
import re

import pulse
from t import ok, egal, bilan
from saas.recos_ia.theme_memoire import build_prompt, condense_theme_memoire

RAPPORT = pulse.SOURCE_RAPPORT.read_text(encoding="utf-8")

HIST = [
    {"titre": "Monter le budget de 20 %", "levier": "argent",
     "decided_at": "2026-08-01", "check_at": "2026-08-15", "verdict": "worse",
     "depart": 1.4, "constate": 1.1, "variation": -21.4, "indicateur": "ROAS"},
]
FAITS = [
    {"jour": "2026-08-20", "texte": "refait tous les visuels"},
    {"jour": "2026-08-28", "texte": "un concurrent a lancé une promo"},
]


def test_le_fait_declare_arrive_tel_quel():
    p = build_prompt("Été", HIST, FAITS)
    for f in FAITS:
        ok(f"« {f['texte']} » est dans le prompt", f["texte"] in p, f["texte"])
        ok(f"sa date {f['jour']} l'accompagne", f["jour"] in p, f["jour"])


def test_le_fait_declare_n_est_pas_presente_comme_une_hypothese_jugee():
    p = build_prompt("Été", HIST, FAITS)
    ok("le prompt les nomme des faits déclarés", "FAITS DÉCLARÉS" in p)
    ok("il interdit de leur attribuer un verdict",
       "ni verdict" in p and "tu ne dois leur en attribuer aucun" in p)
    ok("il redit la frontière du produit", "Pulse marque, le client juge" in p)
    # La ligne d'un fait ne porte NI indicateur NI verdict : la fonction qui
    # l'écrit n'a pas de place pour en mettre un, et c'est la garantie.
    ligne = [l for l in p.splitlines() if FAITS[0]["texte"] in l][0]
    for interdit in ("verdict", "levier", "échéance", "passé de"):
        ok(f"la ligne du fait ne porte pas « {interdit} »", interdit not in ligne, ligne)


def test_aucun_chiffre_n_est_fabrique():
    """La propriété qui protège le §7 : tout nombre des LIGNES DE DONNÉES vient
    de l'entrée.

    On n'inspecte que les lignes en « - » — les consignes en prose portent leurs
    propres nombres (« 1 à 2 phrases », « quatre leviers »), qui ne sont pas des
    mesures et qu'aucune règle n'interdit. Les vérifier reviendrait à autoriser
    n'importe quel chiffre du moment qu'il figure dans une liste blanche."""
    p = build_prompt("Été", HIST, FAITS)
    entree = " ".join(str(v) for item in (HIST + FAITS) for v in item.values())
    lignes = [l for l in p.splitlines() if l.startswith("- ")]
    ok("des lignes de données existent", len(lignes) == 3, lignes)
    for ligne in lignes:
        for n in re.findall(r"\d+(?:[.,]\d+)?", ligne):
            ok(f"le nombre {n} vient de l'entrée",
               n.replace(",", ".").lstrip("+") in entree, f"{n} — {ligne}")


def test_un_theme_qui_n_a_que_des_notes_le_dit():
    """« Rien de testé » et « testé sans effet » ne sont pas la même chose —
    c'est écrit dans le prompt depuis la spec de la mémoire, et un thème qui
    n'a que des notes est exactement le cas où la confusion coûte cher."""
    p = build_prompt("Été", [], FAITS)
    ok("le prompt écrit qu'aucune hypothèse n'a été testée",
       "aucune hypothèse testée sur ce thème" in p)
    ok("les faits y sont quand même", FAITS[0]["texte"] in p)
    ok("l'avertissement sur la confusion est toujours là",
       "aucune hypothèse encore testée" in p)


def test_sans_matiere_aucun_appel_ia():
    appels = []
    r = condense_theme_memoire(object(), "u1", "Été", lambda p: appels.append(p) or "x", None)
    egal("aucune hypothèse, aucune note → rien", r, None)
    egal("et surtout aucun appel IA", len(appels), 0)


def test_des_notes_seules_suffisent_a_declencher_la_condensation():
    """Sans ça, un thème sur lequel le client écrit mais n'a encore rien testé
    n'aurait jamais de mémoire — et c'est le thème d'un compte qui démarre."""
    appels = []

    def faux_appel(prompt):
        appels.append(prompt)
        return "Deux gestes déclarés, aucune hypothèse testée."

    # `save_theme_resume` a besoin d'un vrai client : on l'intercepte, la
    # frontière testée ici est le DÉCLENCHEMENT, pas l'écriture.
    import saas.recos_ia.theme_memoire as tm
    vrai = tm.save_theme_resume
    tm.save_theme_resume = lambda *a, **k: True
    try:
        r = condense_theme_memoire(object(), "u1", "Été", faux_appel, None, FAITS)
    finally:
        tm.save_theme_resume = vrai
    egal("la mémoire est écrite", r, "Deux gestes déclarés, aucune hypothèse testée.")
    egal("un seul appel IA", len(appels), 1)
    ok("et il portait les faits", FAITS[0]["texte"] in appels[0])


def test_le_worker_lit_les_notes_a_part_et_ne_les_juge_pas():
    """La lecture des notes est SÉPARÉE de celle des hypothèses.

    Élargir le filtre `status` de la boucle de verdict aurait fait entrer les
    notes dans la boucle qui ÉCRIT `verdict` en base — exactement ce que la
    décision interdit."""
    ok("la boucle de verdict ne lit toujours que running/done",
       'in_("status", ["running", "done"])' in RAPPORT)
    ok("les notes sont toujours exclues de cette boucle",
       '_sa = [a for a in _sa if a.get("kind") != "note"]' in RAPPORT)
    ok("une lecture de notes à part existe",
       '.eq("kind", "note")' in RAPPORT and '.eq("status", "archived")' in RAPPORT)
    ok("elle est passée à la condensation",
       "_notes_par_theme.get(_mk)" in RAPPORT)
    ok("la raison est écrite au-dessus",
       "JAMAIS DANS LE REPONDÉRAGE" in RAPPORT)
    # Le prix : un thème qui n'a QUE des notes ne fabrique pas un bloc de suivi.
    ok("`tracking` reste absent sans action suivie",
       "if _sa:\n            tracking = {" in RAPPORT)


def test_la_lecture_des_notes_est_bornee_et_ne_lit_pas_les_running():
    """Une note `running` est ce qu'on COMPTE faire : elle ne se date qu'au
    moment où on la coche, donc elle ne raconte encore rien."""
    arbre = ast.parse(RAPPORT)
    source_notes = [n for n in ast.walk(arbre)
                    if isinstance(n, ast.Name) and n.id == "_notes_rows"]
    ok("`_notes_rows` existe dans l'arbre", len(source_notes) > 0)
    ok("la lecture est bornée", '.order("decided_at").limit(200)' in RAPPORT)
    ok("elle exclut les notes pas encore cochées",
       '.eq("kind", "note")\n                       .eq("status", "archived")' in RAPPORT)


if __name__ == "__main__":
    test_le_fait_declare_arrive_tel_quel()
    test_le_fait_declare_n_est_pas_presente_comme_une_hypothese_jugee()
    test_aucun_chiffre_n_est_fabrique()
    test_un_theme_qui_n_a_que_des_notes_le_dit()
    test_sans_matiere_aucun_appel_ia()
    test_des_notes_seules_suffisent_a_declencher_la_condensation()
    test_le_worker_lit_les_notes_a_part_et_ne_les_juge_pas()
    test_la_lecture_des_notes_est_bornee_et_ne_lit_pas_les_running()
    raise SystemExit(0 if bilan("la note dans la mémoire du thème") else 1)
