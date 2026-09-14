"""Les quatre situations d'un plan déjà ouvert, mesurées une par une.

C'est ce script qui a trouvé les deux défauts que le ticket 27 ne nommait pas.

AVANT LA CORRECTION :
  · plan sur la SECONDE Hypothèse de la carte → la carte servait
    `page_endormie` DEUX FOIS, la version mémorisée ayant remplacé la
    PREMIÈRE Hypothèse, qui n'était pas elle ;
  · ligne sans `snapshot` et verdict déjà tombé → l'épinglage lâchait, la carte
    servait `adset_inegal`, et la garde d'écriture — qui ne comparait que des
    clés — ne reconnaissait plus le plan : `decided_at` repartait sur la date
    du jour, chaque semaine.

DEPUIS : une Hypothèse par carte dans les quatre situations, et l'écriture ne
survient plus que là où la Stratégie est réellement terminée (verdict rendu,
clé `ai_` coupée, ou carte irrécupérable) — une fois, pas chaque semaine.
"""
from datetime import date

from mesure import THEME, semaine, carte

JOUR = date(2026, 9, 20)


def plan(cle, decided, *, snapshot=True):
    d = {"theme": THEME, "reco_key": cle, "levier": "contenu",
         "decided_at": decided, "resume": None,
         "snapshot": {"key": cle, "role": "hypothese", "levier": "contenu",
                      "title": "épinglée", "titre": "épinglée",
                      "nature": "tester", "platform": "instagram",
                      "cible": "", "confidence": "creuser", "priority": 3,
                      "metric": "reach", "effort": "1 h"}}
    if not snapshot:
        d["snapshot"] = None
    return {"piscine": d}


def montre(nom, **kw):
    lecteur, _, tf = semaine(JOUR, **kw)
    ecrits = [e for e in lecteur.ecrits if e[0] == "plan_de_theme"]
    print(f"\n── {nom} ──")
    print(f"   carte  : {carte(tf)}")
    print(f"   écrit  : {ecrits}")


if __name__ == "__main__":
    montre("plan sur l'AUTRE hypothèse de la carte (page_endormie), épinglable",
           plan=plan("page_endormie", "2026-09-13"))
    montre("plan SANS snapshot (ligne d'avant la colonne) — l'épinglage lâche",
           plan=plan("page_endormie", "2026-09-13", snapshot=False))
    montre("plan avec un VERDICT déjà tombé — l'épinglage lâche",
           plan=plan("page_endormie", "2026-09-13"),
           verdicts={"page_endormie": "stable"})
    montre("plan sur une clé `ai_` — l'épinglage lâche (voulu)",
           plan=plan("ai_vieille_piste", "2026-09-13"))
