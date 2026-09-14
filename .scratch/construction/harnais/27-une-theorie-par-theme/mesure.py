"""La mesure demandée par la consigne de repli du ticket 27, faite hors ligne.

Le ticket demandait de compter, sur le compte de David, combien de lignes
`theme_plan` bougent d'une semaine à l'autre. La base ne répond plus (§ Testing
de `.scratch/construction/spec.md`) : on rejoue à la place la MÊME construction
trois semaines de suite sur des lignes fixes, et on lit ce que le worker a voulu
écrire (`lecteur.ecrits`). Ce n'est pas le compte de David — c'est le
COMPORTEMENT, mesuré au lieu d'être raconté.

CE QU'IL DISAIT AVANT LA CORRECTION : la carte portait DEUX Hypothèses
(`adset_inegal` et `page_endormie`) chacune des trois semaines, et `theme_plan`
n'en suivait qu'une sans que rien ne dise laquelle. Le plan, lui, tenait — c'est
`mesure2.py` qui montre les situations où il lâchait.

CE QU'IL DIT DEPUIS : une seule Hypothèse par carte, et une seule écriture en
trois semaines. Le script reste là parce qu'une mesure qu'on ne peut plus
rejouer n'est plus une mesure.
"""
from datetime import date, timedelta

import pulse  # noqa: F401
from lecteur_fige import Annonce, Campagne
from gree import compte_organique
from saas.traitement.build_report import build_payload

THEME = "Piscine"


def campagne():
    return Campagne(f"{THEME} – Search", theme=THEME, depense_jour=30.0,
                    clics_jour=100, impressions_jour=4000, revenu_jour=40.0,
                    annonces=[Annonce("visuel A", "Groupe 1", 140, 350, 14000, 7),
                              Annonce("visuel B", "Groupe 2", 70, 20, 7000, 0)])


def semaine(jour, plan=None, verdicts=None):
    lecteur = compte_organique([campagne()], etoiles=[THEME], aujourd_hui=jour,
                               theme_organique=THEME, plan=plan,
                               verdicts=verdicts)
    payload = build_payload(lecteur)
    tf = next(t for t in payload["themes_focus"] if t["label"] == THEME)
    return lecteur, payload, tf


def carte(tf):
    return [(r["key"], r.get("role")) for r in tf["recos"]]


if __name__ == "__main__":
    jour = date(2026, 9, 13)
    plan = {}
    for n in range(3):
        j = jour + timedelta(days=7 * n)
        lecteur, payload, tf = semaine(j, plan=plan)
        ecrits = [e for e in lecteur.ecrits if e[0] == "plan_de_theme"]
        print(f"\n── semaine {n + 1} · {j} ──")
        print(f"   plan lu      : {[(k, v['reco_key'], v['decided_at']) for k, v in plan.items()]}")
        print(f"   carte servie : {carte(tf)}")
        print(f"   hypothèses   : {sum(1 for r in tf['recos'] if r.get('role') == 'hypothese')}")
        print(f"   écrit        : {ecrits}")
        for _, theme, cle, levier, decided in ecrits:
            hyp = next(r for r in tf["recos"] if r.get("key") == cle)
            plan[theme.strip().lower()] = {
                "theme": theme, "reco_key": cle, "levier": levier,
                "decided_at": decided, "snapshot": dict(hyp), "resume": None,
            }
