"""Harnais du ticket 18 : la lecture du budget sur un VRAI changement.

`extra_data` recopié de la réponse de `/activities` pour deux
`update_ad_set_budget` du 2026-02-12 (lu par David le 2026-10-14, lecture
seule) : seuls les noms et les IDs sont remplacés, le dépôt est public. Meta y
écrit le type de budget dans la langue du jeton (« Laufzeitbudget » sur un
compte, « Budget global » sur l'autre) : les deux formes sont gardées.

    python3.12 .scratch/journal-meta/harnais/18/verifier.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))

from saas.data.fetch_data.sources.meta.ads.fetchers.activities import (  # noqa: E402
    hierarchie_depuis_insights, lignes_activites,
)

CAMPAGNE, GROUPE = "100", "200"
parents = hierarchie_depuis_insights([
    {"date_start": "2026-02-12", "campaign_id": CAMPAGNE, "campaign_name": "Campagne A",
     "adset_id": GROUPE, "ad_id": None},
])


def reel(libelle: str) -> str:
    """La chaîne JSON telle que Meta l'envoie, au libellé près."""
    return json.dumps({
        "old_value": {"type": "payment_amount", "currency": "CHF", "old_value": 35000,
                      "additional_type": "status_string", "additional_value": ""},
        "new_value": {"type": "payment_amount", "currency": "CHF", "new_value": 75000,
                      "additional_type": "status_string", "additional_value": libelle},
        "type": "composite_data"}, separators=(",", ":"))


def acte(extra: str, t: str = "2026-02-12T14:18:27+0000") -> dict:
    return {"event_type": "update_ad_set_budget", "event_time": t,
            "object_id": GROUPE, "object_name": "Groupe DE", "extra_data": extra}


echecs: list[str] = []


def verifie(nom: str, ok: bool, detail: str = "") -> None:
    print(("ok   " if ok else "ÉCHEC ") + nom + (f" — {detail}" if detail and not ok else ""))
    if not ok:
        echecs.append(nom)


PHRASE = 'le budget du groupe d\'annonces "Groupe DE" est passé de 350,00 à 750,00 CHF'

for libelle in ("Laufzeitbudget", "Budget global"):
    [l] = lignes_activites([acte(reel(libelle))], parents, "Europe/Zurich")
    verifie(f"{libelle} : catégorie budget, niveau groupe",
            l["categorie"] == "budget" and l["niveau"] == "groupe", str(l))
    verifie(f"{libelle} : avant → après avec la devise de Meta", l["resume"] == PHRASE, l["resume"])
    verifie(f"{libelle} : extra_data gardé tel quel, libellé compris",
            l["extra_data"] == json.loads(reel(libelle)), str(l.get("extra_data")))
    verifie(f"{libelle} : rangé sous sa campagne", l.get("campaign_id") == CAMPAGNE, str(l))

# La même forme sans devise : aucune n'est supposée.
sans_devise = reel("Budget global").replace('"currency":"CHF",', "")
[l] = lignes_activites([acte(sans_devise)], parents, "Europe/Zurich")
verifie("sans devise : montants sans devise",
        l["resume"] == 'le budget du groupe d\'annonces "Groupe DE" est passé de 350,00 à 750,00', l["resume"])

# Le montant d'arrivée absent : « modifié », rien d'inventé.
sans_apres = json.dumps({"old_value": json.loads(reel(""))["old_value"], "type": "composite_data"})
[l] = lignes_activites([acte(sans_apres)], parents, "Europe/Zurich")
verifie("sans montant d'arrivée : « modifié »",
        l["resume"] == 'le budget du groupe d\'annonces "Groupe DE" a été modifié', l["resume"])

print()
print("ÉCHECS :", echecs) if echecs else print("Tout passe.")
sys.exit(1 if echecs else 0)
