"""LE RATTRAPAGE DE CONDENSATION NE TOURNE PAS DANS LE VIDE.

Le rattrapage reprend un thème qui a de la matière et aucun `resume` stocké, en
s'appuyant sur : *« dès qu'une condensation réussit, `resume` cesse d'être
vide »*. C'est vrai — tant que l'écriture PEUT réussir. `save_theme_resume` est
un `update` ciblé sur `(user_id, theme)` : sans ligne `theme_plan` à ce nom,
elle rend `False` pour toujours. Le thème restait éligible à chaque rapport,
donc un appel Gemini par semaine pour une écriture qui touche zéro ligne —
invisible du client, l'exception étant avalée, mais facturé.

    python3.12 test_rattrapage_borne.py
"""
import pulse  # noqa: F401
from t import ok, egal, bilan

from gree import action, gree, theme_plan
from saas.traitement.build_report import build_payload


def condensations(lecteur):
    return [m[0] for m in lecteur.memoires]


# ── 1 · CE QUE LE RATTRAPAGE DOIT CONTINUER DE FAIRE ─────────────────────────

def test_une_memoire_vide_avec_un_plan_se_rattrape():
    """La raison d'être du rattrapage : un timeout Gemini le jour de la chute
    ne doit pas laisser le thème sans mémoire pour toujours."""
    lecteur = gree(suivi=[action(verdict="worse")],
                   plan=theme_plan("Été", resume=None))
    build_payload(lecteur)
    egal("le thème est repris", condensations(lecteur), ["Été"])


def test_une_memoire_deja_ecrite_ne_se_reecrit_pas():
    """Aucun verdict nouveau, une mémoire en place : zéro appel IA. C'est la
    cadence événementielle du module, et elle doit tenir."""
    lecteur = gree(suivi=[action(verdict="worse")],
                   plan=theme_plan("Été", resume="Deux hypothèses argent."))
    build_payload(lecteur)
    egal("rien n'est recondensé", condensations(lecteur), [])


# ── 2 · CE QU'IL NE DOIT PLUS FAIRE ──────────────────────────────────────────

def test_un_theme_sans_ligne_de_plan_ne_paie_pas_d_appel_ia():
    """Aucune hypothèse n'a jamais démarré sur ce thème : la mémoire n'a pas de
    plan où se poser, et elle n'en aura pas en retentant."""
    lecteur = gree(suivi=[action(verdict="worse")], plan={})
    build_payload(lecteur)
    egal("aucun appel IA", condensations(lecteur), [])


def test_un_theme_renomme_ne_paie_pas_d_appel_ia():
    """`suivi_actions` garde l'ancien libellé, `theme_plan` porte le nouveau :
    le `.eq("theme", …)` ne matchera plus jamais. La mémoire suit le NOM du
    thème, c'est une décision de la spec — mais elle ne se paie pas en appels
    Gemini hebdomadaires."""
    lecteur = gree(suivi=[action(verdict="worse")],
                   plan=theme_plan("Été 2026", resume=None))
    build_payload(lecteur)
    egal("aucun appel IA sur l'ancien nom", condensations(lecteur), [])


def test_une_colonne_resume_non_migree_ne_paie_pas_d_appel_ia():
    """`fetch_theme_plan` retombe alors sur un `select` SANS `resume` : la clé
    est ABSENTE des lignes, `.get("resume")` rend `None` pour tout le monde, et
    chaque thème avec de la matière redevenait éligible chaque semaine — pour
    une écriture qui ne peut pas aboutir."""
    lecteur = gree(suivi=[action(verdict="worse")],
                   plan=theme_plan("Été", colonne_resume=False))
    build_payload(lecteur)
    egal("aucun appel IA tant que la migration n'est pas jouée",
         condensations(lecteur), [])


def test_un_theme_renomme_a_la_casse_pres_ecrit_sur_le_bon_libelle():
    """Le garde compare des clés NORMALISÉES, `save_theme_resume` écrit avec un
    `.eq("theme", …)` sensible à la casse. « été » → « Été » passe donc le
    garde et raterait l'écriture — un appel Gemini par semaine pour toujours,
    masqué par un garde qui a l'air de couvrir le cas. Le libellé passé à la
    condensation doit être celui du PLAN, le seul sur lequel l'écriture
    retombera."""
    lecteur = gree(suivi=[action(theme="été", verdict="worse")],
                   plan=theme_plan("Été", resume=None))
    build_payload(lecteur)
    egal("la condensation vise le libellé du plan",
         condensations(lecteur), ["Été"])


def test_le_verdict_du_jour_attend_que_son_plan_existe():
    """Même règle pour la chute d'un verdict, pas seulement pour le rattrapage :
    appeler Gemini pour une écriture qui ne peut pas aboutir reste du gâchis.
    Le thème est repris au rapport suivant, sa ligne de plan existant alors."""
    lecteur = gree(suivi=[action()], plan={})
    build_payload(lecteur)
    egal("le verdict est quand même écrit", lecteur.verdicts_ecrits(),
         [("a-1", "better")])
    egal("mais aucune mémoire n'est tentée", condensations(lecteur), [])


if __name__ == "__main__":
    for nom, fn in sorted(list(globals().items())):
        if nom.startswith("test_"):
            fn()
    raise SystemExit(0 if bilan("Le rattrapage borné") else 1)
